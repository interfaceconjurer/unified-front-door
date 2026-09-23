import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { testModules } from "./test-modules.mjs";
const { load, cleanup } = testModules();
const { AssessmentStore } = load("lib/onboarding/persistence");
const { ASSESSMENT_FINDINGS, ASSESSMENT_ORGS, ASSESSMENT_STEPS } = load("lib/onboarding/assessment");
const { currentFindings, orgAvailability } = load("lib/assessment/model");
const { workspaceProject } = load("lib/projects/model");
const { projectDraftView } = load("lib/projects/creation");
const { buildProjectTree, allSessionRows } = load("lib/workspace/selectors");
const { PROJECTS } = load("lib/workspace/fixtures");
const { destinationHref, resolveDestination } = load("lib/navigation/model");
const { updateConversation } = load("lib/chat/conversation");
const { primaryWorktree, sessionKey } = load("lib/workspace/model");
const { assessmentBriefing, liveAssessmentView, captureToday, BRIEFING_LIMITS } = load("lib/chat/today-snapshot");
const { SurfaceCanvasStore } = load("lib/surface-canvas/persistence");
const { canvasId, parseCanvasInput, inputFromCanonicalId } = load("lib/surface-canvas/model");
const { workCanvasInput, workForCanvas } = load("lib/workspace/returning-work");
const RETURNING_WORK = load("lib/workspace/demo-workspace").workForProfile("am");
const { DEMO_PROFILES } = load("lib/demo-profiles");
let disk;
beforeEach(() => { disk = new Map(); globalThis.window = { localStorage: { getItem: (key) => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: (key) => disk.delete(key) } }; });
after(() => { delete globalThis.window; cleanup(); });
function complete(store = new AssessmentStore("sp")) { if (store.getSnapshot().status === "idle") store.start(); for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance(); return store; }
function draft(store) { store.beginDraft(store.getSnapshot().currentRunId, { name: "Captured plan", goal: "Keep history", targetOrgId: "sit", findingIds: [currentFindings(store.getSnapshot())[0].id] }); return store.getSnapshot().draft; }
function create(store) { const origin = draft(store); return store.createProject("Sam", { draftId: origin.id, commandId: `create:${origin.id}`, expectedRevision: origin.revision }); }
const key = "ufd.org-assessment.v1.sp";
const legacyProject = { id: "org-improvement-old", name: "Historical plan", goal: "Original goal", owner: "Sam", targetOrgId: "retired-sandbox", scopeOrgIds: ["retired-org"], createdAt: "2026-01-01T00:00:00Z", workItems: [{ id: "WI-1", findingId: "removed-finding", title: "Original title", priority: "High", status: "in-progress" }] };

test("legacy history survives unknown scope/target/finding with truthful unavailable evidence and run-qualified identities", () => {
  disk.set(key, JSON.stringify({ status: "complete", step: 5, scopeOrgIds: ["retired-org"], completedAt: "2026-01-01T00:00:00Z", draft: null, projects: [legacyProject, { ...legacyProject, id: "org-improvement-second" }] }));
  const store = new AssessmentStore("sp"), state = store.getSnapshot();
  assert.equal(state.projects.length, 2); assert.deepEqual(state.scopeOrgIds, ["retired-org"]);
  const item = state.projects[0].workItems[0];
  assert.equal(item.title, "Original title"); assert.equal(item.status, "in-progress"); assert.equal(item.finding.provenance.evidence, "legacy-unavailable");
  assert.deepEqual(item.finding.evidence, []); assert.equal(item.finding.category, "Unknown");
  assert.notEqual(item.findingId, state.projects[1].workItems[0].findingId);
  assert.equal(orgAvailability(state.projects[0].targetOrgId, ASSESSMENT_ORGS).available, false);
  store.setWorkItemStatus(state.projects[0].id, item.id, "done");
  assert.equal(new AssessmentStore("sp").getSnapshot().projects[0].workItems[0].status, "done");
});

test("captured evidence and project title survive fixture mutation, removal, and org expiry", () => {
  const store = complete(), project = create(store), original = structuredClone(project);
  const finding = ASSESSMENT_FINDINGS[0], org = ASSESSMENT_ORGS.find((org) => org.id === "sit"), previous = structuredClone(finding), connection = org.connection;
  try { finding.title = "Renamed today"; finding.evidence[0] = "New evidence"; org.connection = "expired"; ASSESSMENT_FINDINGS.shift();
    const restored = new AssessmentStore("sp").getSnapshot().projects[0]; assert.deepEqual(restored, original);
    assert.equal(orgAvailability(restored.targetOrgId, ASSESSMENT_ORGS).reason, "Connection expired");
  } finally { Object.assign(finding, previous); ASSESSMENT_FINDINGS.unshift(finding); org.connection = connection; }
});

test("separate runs allow recurring findings without changing an earlier plan", () => {
  const store = complete(), first = create(store), original = structuredClone(first);
  store.rescan(["prod"]); complete(store); const second = create(store);
  assert.ok(second); assert.notEqual(first.runId, second.runId); assert.notEqual(first.workItems[0].findingId, second.workItems[0].findingId);
  assert.equal(first.workItems[0].finding.sourceFindingId, second.workItems[0].finding.sourceFindingId);
  assert.deepEqual(store.getSnapshot().projects[0], original);
});

test("create command replay survives reload and rejects conflicting/stale draft revisions", () => {
  const store = complete(), origin = draft(store), command = { draftId: origin.id, commandId: "request-one", expectedRevision: origin.revision };
  store.editDraft(origin.id, { field: "name", value: "Revised" }); assert.equal(store.createProject("Sam", command), null);
  const valid = { ...command, expectedRevision: store.getSnapshot().draft.revision };
  const project = store.createProject("Sam", valid); assert.ok(project);
  const restored = new AssessmentStore("sp"); assert.deepEqual(restored.createProject("Sam", valid), project); assert.equal(restored.getSnapshot().projects.length, 1);
  assert.equal(restored.createProject("Sam", { ...valid, draftId: "different" }), null);
});

test("rescan keeps edited draft origin and field commands cannot overwrite unrelated/new drafts", () => {
  const store = complete(), origin = draft(store), firstRun = origin.runId;
  store.editDraft(origin.id, { field: "goal", value: "New goal" });
  store.editDraft(origin.id, { field: "name", value: "New name" }); assert.equal(store.getSnapshot().draft.goal, "New goal");
  store.rescan(["uat"]); assert.equal(store.getSnapshot().draft.runId, firstRun);
  assert.equal(projectDraftView(store.getSnapshot()).findings[0].runId, firstRun);
  assert.deepEqual(liveAssessmentView(store.getSnapshot()).findings, [], "Today follows the current unfinished scan; the project canvas retains its original evidence");
  const project = store.createProject("Sam", { draftId: origin.id, commandId: "origin-create", expectedRevision: store.getSnapshot().draft.revision }); assert.ok(project); assert.equal(project.runId, firstRun);
  complete(store); const next = draft(store); store.editDraft(origin.id, { field: "name", value: "Stale overwrite" }); store.discardDraft(origin.id);
  assert.equal(store.getSnapshot().draft.id, next.id); assert.equal(store.getSnapshot().draft.name, "Captured plan");
});

test("legacy draft preserves scope and unknown priority when planned", () => {
  disk.set(key, JSON.stringify({ status: "complete", scopeOrgIds: ["prod", "uat", "sit"], completedAt: "2026-01-01T00:00:00Z", projects: [], draft: { name: "Legacy", goal: "Keep", targetOrgId: "sit", findingIds: ["api-headroom"] } }));
  const store = new AssessmentStore("sp"); assert.equal(currentFindings(store.getSnapshot())[0].priority, "Unknown");
  const origin = store.getSnapshot().draft; const project = store.createProject("Sam", { draftId: origin.id, commandId: "legacy-create", expectedRevision: origin.revision }); assert.deepEqual(project.scopeOrgIds, ["prod", "uat", "sit"]); assert.equal(project.workItems[0].finding.provenance.evidence, "legacy-unavailable");
});

test("unknown schema and ambiguous duplicate identities protect original bytes through edits/retry", () => {
  const good = complete().getSnapshot();
  for (const change of [(state) => { state.schemaVersion = 99; }, (state) => state.runs.push(state.runs[0]), (state) => { state.runs[0].findings.push(state.runs[0].findings[0]); }]) {
    const state = structuredClone(good); change(state); const raw = JSON.stringify(state); disk.set(key, raw);
    const store = new AssessmentStore("sp"); assert.ok(["invalid", "unsupported"].includes(store.getPersistenceSnapshot()));
    store.start(); store.retryPersistence(); assert.equal(disk.get(key), raw);
  }
  const state = structuredClone(good); state.draft = { id: "draft", runId: "missing", revision: 1, name: "A", goal: "B", targetOrgId: "sit", findingIds: [] };
  disk.set(key, JSON.stringify(state)); assert.equal(new AssessmentStore("sp").getPersistenceSnapshot(), "invalid");
});

test("planning projects have no fabricated worktree or execution session", () => {
  const project = workspaceProject(create(complete())); assert.deepEqual(project.worktrees, []); assert.equal(primaryWorktree(project), null);
  assert.equal(buildProjectTree([project])[0].base, null); assert.deepEqual(project.agentSessions, []);
  assert.notEqual(sessionKey("a::b", "c"), sessionKey("a", "b::c")); assert.notEqual(sessionKey("a", null), sessionKey("a", "main"));
});

test("briefing history is bounded, detached and signals omissions while live input remains complete", () => {
  const store = complete(), project = create(store), state = structuredClone(store.getSnapshot());
  const finding = state.runs[0].findings[0]; finding.evidence = Array.from({ length: 1000 }, () => "E".repeat(5000));
  state.projects = Array.from({ length: 40 }, (_, i) => ({ ...structuredClone(project), id: `p${i}`, name: "N".repeat(300) }));
  state.runs[0].findings = Array.from({ length: 100 }, (_, i) => ({ ...finding, id: `f${i}` }));
  const snapshot = assessmentBriefing(state); assert.equal(snapshot.findings.length, BRIEFING_LIMITS.findings); assert.equal(snapshot.projects.length, BRIEFING_LIMITS.projects);
  assert.equal(snapshot.findings[0].evidence.length, BRIEFING_LIMITS.entries); assert.equal(snapshot.findings[0].evidence[0].length, BRIEFING_LIMITS.text);
  assert.equal(snapshot.totalProjects, 40); assert.equal(snapshot.totalFindings, 100); assert.equal(snapshot.truncated, true); assert.equal("runs" in snapshot, false);
  assert.equal(liveAssessmentView(state).findings.length, 100); assert.equal(liveAssessmentView(state).projects.length, 40);
  finding.evidence[0] = "MUTATED"; state.projects.at(-1).name = "Changed"; assert.notEqual(snapshot.findings[0].evidence[0], "MUTATED"); assert.notEqual(snapshot.projects.at(-1).name, "Changed");
});

test("Today snapshot clips recent display without copying source/activity and exposes truncation", () => {
  const state = complete().getSnapshot(); const work = { ...RETURNING_WORK[0], summary: "x".repeat(5000), source: "secret giant source", activity: Array(1000).fill("event") };
  const today = captureToday({ capturedAt: "now", profile: DEMO_PROFILES[0], projectName: "Project", branch: "main", hasProjects: true, working: 0, recent: Array(20).fill(work), assessment: state });
  assert.equal(today.recent.length, 12); assert.equal(today.totalRecent, 20); assert.equal(today.truncated, true); assert.equal(today.recent[0].source, undefined); assert.deepEqual(today.recent[0].activity, []);
});

test("returning review scenarios agree with waiting sessions and route to their owned project/worktree", () => {
  const added = ["hotfix-tests", "storefront-health", "storefront-release"], profile = DEMO_PROFILES.find(profile => profile.id === "am");
  assert.equal(RETURNING_WORK.filter(work => work.attention).length, 5);
  for (const id of added) {
    const work = RETURNING_WORK.find(work => work.id === id), project = PROJECTS.find(project => project.id === work.projectId);
    assert.equal(work.attention, true); assert.equal(work.status, "review");
    assert.equal(project.agentSessions.find(session => session.worktreeId === work.worktreeId).status, "waiting");
    const target = { projectId: project.id, worktreeId: work.worktreeId, orgId: project.defaultOrgId };
    const result = resolveDestination(destinationHref({ version: 1, owner: profile.id, surface: work.surfaceId, target, canvas: workCanvasInput(work) }), profile.id, profile.surfaceAccess, {});
    assert.equal(result.kind, "available"); assert.deepEqual(result.destination.target, target); assert.equal(result.destination.canvas.params.workId, id);
  }
  const statuses = allSessionRows(PROJECTS).map(row => row.session.status);
  assert.equal(statuses.filter(status => status === "waiting").length, 3);
  assert.equal(statuses.filter(status => status === "working").length, 2);
  assert.deepEqual(statuses, [...statuses].sort((a, b) => ["waiting", "working", "idle"].indexOf(a) - ["waiting", "working", "idle"].indexOf(b)));
  assert.equal(RETURNING_WORK.find(work => work.id === "storefront-app").surfaceId, "alm");
});

test("a refreshed attention briefing leaves earlier Today statuses, routes and absolute timestamps intact", () => {
  const profile = DEMO_PROFILES.find(profile => profile.id === "am"), state = complete().getSnapshot();
  const historical = structuredClone(RETURNING_WORK).map(work => ["hotfix-tests", "storefront-health", "storefront-release"].includes(work.id)
    ? { ...work, attention: false, status: "saved", statusLabel: "Previously saved" } : work.id === "storefront-app" ? { ...work, surfaceId: "build" } : work);
  const capture = recent => captureToday({ capturedAt: "2026-09-20T10:00:00Z", profile, scope: "global", projectName: "All projects", branch: "", hasProjects: true, working: 1, recent, assessment: state });
  let conversation = updateConversation(undefined, { type: "today", snapshot: capture(historical) });
  const before = JSON.stringify(conversation.messages[0]);
  conversation = updateConversation(conversation, { type: "surface", scopeKey: "code", label: "Code", reply: "Review the captured regression coverage." });
  conversation = updateConversation(conversation, { type: "today", snapshot: capture(RETURNING_WORK), force: true });
  assert.equal(JSON.stringify(conversation.messages[0]), before);
  assert.equal(conversation.messages[0].snapshot.recent.filter(work => work.attention).length, 2);
  assert.equal(conversation.messages.at(-1).snapshot.recent.filter(work => work.attention).length, 5);
  for (const [id, timestamp] of [["hotfix-tests", "2026-09-14T14:35:00Z"], ["storefront-health", "2026-09-14T13:00:00Z"], ["storefront-release", "2026-09-13T15:00:00Z"]]) {
    assert.equal(conversation.messages.at(-1).snapshot.recent.find(work => work.id === id).updated, timestamp);
  }
});

test("canvas contracts reject missing required fields and canonical IDs are delimiter-safe and label-independent", () => {
  for (const kind of ["app", "capability", "work", "improvement-project"]) assert.equal(parseCanvasInput({ kind, title: "Invalid", params: {} }), null);
  assert.equal(parseCanvasInput({ kind: "capability", title: "Invalid", params: { surface: "other", capability: "apex" } }), null);
  const a = { kind: "app", title: "One", params: { appId: "x&projectId=y", projectId: "z" } }, b = { kind: "app", title: "Two", params: { appId: "x", projectId: "y&projectId=z" } };
  const id = canvasId(a.kind, a.params); assert.notEqual(id, canvasId(b.kind, b.params)); assert.deepEqual(inputFromCanonicalId(id).params, a.params);
  assert.equal(id, canvasId(a.kind, { projectId: "z", appId: "x&projectId=y", name: "Renamed" }));
  const store = new SurfaceCanvasStore("canvases"); store.openCanvas("build", a); store.openCanvas("build", { ...a, title: "Renamed" }); assert.equal(store.getSnapshot().alm.canvases.length, 1);
});

test("legacy migration maps active structured spec, preserves competing closed bytes and duplicate colliding tabs", () => {
  const oldId = "capability:capability=query&surface=code";
  disk.set("canvases", JSON.stringify({ code: { canvases: [{ id: oldId, kind: "capability", title: "Query", params: { scope: "unbound", surface: "code", capability: "query" }, draft: { source: "OPEN" } }, { id: oldId, kind: "capability", title: "Query duplicate", params: { scope: "unbound", surface: "code", capability: "query" }, draft: { source: "DUPLICATE" } }], activeCanvasId: oldId, closedDrafts: { [oldId]: { source: "CLOSED" } } } }));
  const store = new SurfaceCanvasStore("canvases"), state = store.getSnapshot().code; assert.equal(state.canvases.length, 1); assert.equal(state.activeCanvasId, "overview");
  const id = state.canvases[0].id; store.closeCanvas("code", id);
  const restored = new SurfaceCanvasStore("canvases").getSnapshot().code; const bytes = JSON.stringify(restored); for (const content of ["OPEN", "CLOSED", "DUPLICATE"]) assert.ok(bytes.includes(content));
});

test("ordinary active legacy draft migrates and canonical closed draft restores; ambiguous ID-only draft remains recoverable", () => {
  const oldId = "capability:capability=apex&surface=code", input = { kind: "capability", title: "Apex", params: { scope: "unbound", surface: "code", capability: "apex" } };
  disk.set("canvases", JSON.stringify({ code: { canvases: [{ ...input, id: oldId, draft: { source: "Keep Apex" } }], activeCanvasId: oldId, closedDrafts: { "capability:capability=query&surface=code": { source: "Unassigned query" } } } }));
  const store = new SurfaceCanvasStore("canvases"), state = store.getSnapshot().code; assert.equal(state.activeCanvasId, canvasId(input.kind, input.params)); assert.match(JSON.stringify(state.recovery), /Unassigned query/);
  store.closeCanvas("code", state.activeCanvasId); const restored = new SurfaceCanvasStore("canvases"); restored.openCanvas("code", input); assert.equal(restored.getSnapshot().code.canvases[0].draft.source, "Keep Apex"); assert.match(JSON.stringify(restored.getSnapshot().code.recovery), /Unassigned query/);
});

test("work inputs cannot disagree with resolved ownership or enclosing surface", () => {
  const work = RETURNING_WORK.find((work) => work.surfaceId === "alm"), input = workCanvasInput(work), store = new SurfaceCanvasStore("canvases");
  assert.throws(() => store.openCanvas("code", input), /Invalid/);
  assert.throws(() => store.openCanvas("alm", { ...input, params: { ...input.params, projectId: "wrong" } }), /Invalid/);
  assert.equal(workForCanvas({ ...input.params, projectId: "wrong" }), undefined);
  store.openCanvas("alm", input); assert.equal(store.getSnapshot().alm.canvases.length, 1);
});


test("begin and create commands cannot implicitly replace or choose a newer draft", () => {
  const store = complete(), origin = draft(store);
  store.beginDraft(origin.runId, { name: "Stale begin", goal: "Wrong", targetOrgId: "sit", findingIds: [] });
  assert.equal(store.getSnapshot().draft.id, origin.id); assert.equal(store.getSnapshot().draft.name, "Captured plan");
  assert.equal(store.createProject("Sam"), null);
  for (const expectedRevision of [undefined, NaN, -1, 1.5]) assert.equal(store.createProject("Sam", { draftId: origin.id, commandId: "invalid", expectedRevision }), null);
  assert.equal(store.getSnapshot().projects.length, 0);
});

test("legacy result absence is unavailable rather than a zero-result health claim; resumed capture has actual provenance", () => {
  disk.set(key, JSON.stringify({ status: "complete", scopeOrgIds: ["prod"], completedAt: "2026-01-01T00:00:00Z", projects: [], draft: null }));
  assert.equal(liveAssessmentView(new AssessmentStore("sp").getSnapshot()).findingsAvailable, false);
  disk.set(key, JSON.stringify({ status: "paused", step: 4, scopeOrgIds: ["prod"], projects: [], draft: null }));
  const store = new AssessmentStore("sp"); store.start(); store.advance();
  assert.equal(liveAssessmentView(store.getSnapshot()).findingsAvailable, true); assert.ok(currentFindings(store.getSnapshot()).length);
  assert.equal(store.getSnapshot().runs[0].source.adapter, "demo-org-assessment");
});

test("normal canonical reopen consumes closed storage without spurious legacy recovery after editing", () => {
  const store = new SurfaceCanvasStore("canvases"), input = { kind: "capability", title: "Apex", params: { scope: "unbound", surface: "code", capability: "apex" } };
  store.openCanvas("code", input); const id = store.getSnapshot().code.activeCanvasId; store.updateDraft("code", id, { source: "Before" });
  store.closeCanvas("code", id); store.openCanvas("code", input); store.updateDraft("code", id, { source: "After" });
  const state = new SurfaceCanvasStore("canvases").getSnapshot().code; assert.equal(state.canvases[0].draft.source, "After"); assert.deepEqual(state.closedDrafts, {}); assert.deepEqual(state.recovery, []);
});

test("focusing an existing legacy tab transfers its sole closed content before removing the closed copy", () => {
  const input = { kind: "capability", title: "Apex", params: { scope: "unbound", surface: "code", capability: "apex" } }, oldId = "capability:capability=apex&surface=code";
  disk.set("canvases", JSON.stringify({ code: { canvases: [{ ...input, id: oldId }], activeCanvasId: oldId, closedDrafts: { [oldId]: { source: "SOLE COPY" } } } }));
  const store = new SurfaceCanvasStore("canvases"); store.openCanvas("code", input);
  const restored = new SurfaceCanvasStore("canvases").getSnapshot().code; assert.equal(restored.canvases[0].draft.source, "SOLE COPY"); assert.deepEqual(restored.closedDrafts, {});
});

test("an unavailable paused legacy scope remains paused until an explicit accessible rescan", () => {
  disk.set(key, JSON.stringify({ status: "paused", step: 4, scopeOrgIds: ["retired-org"], projects: [legacyProject], draft: null }));
  const store = new AssessmentStore("sp"), before = structuredClone(store.getSnapshot()); store.start(); store.advance();
  assert.deepEqual(store.getSnapshot(), before);
  store.rescan(["uat"]); complete(store); assert.equal(store.getSnapshot().status, "complete"); assert.deepEqual(store.getSnapshot().projects, before.projects);
  assert.equal(currentFindings(store.getSnapshot())[0].orgId, "uat");
});


test("an already-running unavailable legacy scope pauses instead of completing a false zero-result scan", () => {
  disk.set(key, JSON.stringify({ status: "running", step: 4, scopeOrgIds: ["retired-org"], projects: [legacyProject], draft: null }));
  const store = new AssessmentStore("sp"), before = structuredClone(store.getSnapshot()); store.advance();
  assert.equal(store.getSnapshot().status, "paused"); assert.equal(store.getSnapshot().step, 4); assert.equal(store.getSnapshot().completedAt, null);
  assert.deepEqual(store.getSnapshot().runs, before.runs); assert.deepEqual(store.getSnapshot().projects, before.projects);
});
