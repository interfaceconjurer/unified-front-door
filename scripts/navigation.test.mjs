import test, { afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup);
const { resolveWorkspace, UNBOUND_TARGET } = modules.load("lib/workspace/context");
const { NavigationController, destinationHref, readDestination, canvasTarget } = modules.load("lib/navigation/model");
const { canvasId, parseCanvasInput } = modules.load("lib/surface-canvas/model");
const { SurfaceCanvasStore } = modules.load("lib/surface-canvas/persistence");
const { WorkspaceSelectionStore } = modules.load("lib/workspace/persistence");
const { PROJECTS, ORGS } = modules.load("lib/workspace/fixtures");
afterEach(() => { delete global.window; });
function browser(values = {}) { const data = new Map(Object.entries(values)); global.window = { localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }, addEventListener() {}, removeEventListener() {} }; return data; }
const project = PROJECTS[0], worktree = project.worktrees[0];
const ready = { projectId: project.id, worktreeId: worktree.id, orgId: project.defaultOrgId };
const capability = (scope = { scope: "unbound" }) => ({ kind: "capability", title: "Write Apex", params: { surface: "code", capability: "apex", ...scope } });
const destination = (canvas = capability(), target = UNBOUND_TARGET, surface = "code") => ({ version: 1, owner: "am", surface, target, canvas });

test("workspace models loading, empty, planning, ready and unavailable without fabricated or fallback resources", () => {
  assert.equal(resolveWorkspace(UNBOUND_TARGET, [], [], false).status, "loading");
  const empty = resolveWorkspace(UNBOUND_TARGET, [], ORGS); assert.equal(empty.status, "empty"); assert.equal(empty.org, null); assert.equal(empty.project, null);
  const planning = { ...project, id: "plan", worktrees: [], defaultOrgId: "retired" };
  assert.equal(resolveWorkspace({ projectId: "plan", worktreeId: null, orgId: null }, [planning], []).status, "planning");
  assert.equal(resolveWorkspace(ready, PROJECTS, ORGS).status, "ready");
  assert.equal(resolveWorkspace({ ...ready, worktreeId: null }, PROJECTS, ORGS).status, "ready", "project/app need not request a worktree");
  for (const [key, id] of [["projectId", "gone"], ["worktreeId", "gone"], ["orgId", "gone"]]) {
    const result = resolveWorkspace({ ...ready, [key]: id }, PROJECTS, ORGS); assert.equal(result.status, "unavailable"); assert.equal(result.target[key], id);
  }
  const expired = resolveWorkspace(ready, PROJECTS, ORGS.map((org) => org.id === ready.orgId ? { ...org, connection: "expired" } : org));
  assert.equal(expired.status, "unavailable"); assert.equal(expired.org, null);
});

test("explicit unbound and invalid stored targets cannot fall back to legacy selected project", () => {
  const legacy = { activeProjectId: project.id, worktreeByProject: { [project.id]: worktree.id }, orgByProject: { [project.id]: project.defaultOrgId } };
  browser({ selection: JSON.stringify({ ...legacy, target: UNBOUND_TARGET }) });
  assert.deepEqual(new WorkspaceSelectionStore("selection").getSnapshot().target, UNBOUND_TARGET);
  for (const target of [{ ...ready, worktreeId: 17 }, { ...ready, projectId: "" }, { ...ready, projectId: null }]) {
    browser({ selection: JSON.stringify({ ...legacy, target }) }); const store = new WorkspaceSelectionStore("selection");
    assert.equal(store.getSnapshot().activeProjectId, null); assert.equal(store.getPersistenceSnapshot(), "invalid");
  }
});

test("capability scope is required and participates in identity independently of labels", () => {
  assert.equal(parseCanvasInput({ kind: "capability", title: "Old", params: { surface: "code", capability: "apex" } }), null);
  const global = capability(), bound = capability({ scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: "retired" });
  assert.notEqual(canvasId(global.kind, global.params), canvasId(bound.kind, bound.params));
  assert.equal(canvasId(bound.kind, bound.params), canvasId(bound.kind, { ...bound.params }));
  assert.deepEqual(canvasTarget(bound, UNBOUND_TARGET), { projectId: project.id, worktreeId: worktree.id, orgId: "retired" });
});

test("canonical pre-scope capability open, active and closed drafts migrate together without project assignment", () => {
  const oldParams = { capability: "apex", surface: "code" }, oldId = `canvas:v2:${JSON.stringify(["capability", Object.entries(oldParams)])}`;
  browser({ canvas: JSON.stringify({ code: { canvases: [{ id: oldId, kind: "capability", title: "Old name", params: oldParams }], activeCanvasId: oldId, closedDrafts: { [oldId]: { source: "preserved bytes" } } } }) });
  const store = new SurfaceCanvasStore("canvas"), migrated = store.getSnapshot().code;
  const id = canvasId("capability", capability().params); assert.equal(migrated.activeCanvasId, id); assert.equal(migrated.canvases[0].params.scope, "unbound");
  store.openCanvas("code", capability()); assert.equal(store.getSnapshot().code.canvases[0].draft.source, "preserved bytes");
  store.closeCanvas("code", id); assert.equal(new SurfaceCanvasStore("canvas").getSnapshot().code.closedDrafts[id].source, "preserved bytes");
});

test("explicit assignment copies source, preserves unavailable captured IDs, and refuses open or closed target overwrite", () => {
  browser(); const store = new SurfaceCanvasStore("canvas"), source = capability(), id = canvasId(source.kind, source.params);
  const bound = capability({ scope: "project", projectId: "retired-project", orgId: "retired-org" }), boundId = canvasId(bound.kind, bound.params);
  store.openCanvas("code", source); store.updateDraft("code", id, { source: "original" });
  assert.equal(store.copyDraft("code", id, bound), true); store.updateDraft("code", boundId, { source: "bound edit" });
  assert.equal(store.copyDraft("code", id, bound), false); store.closeCanvas("code", boundId); assert.equal(store.copyDraft("code", id, bound), false);
  assert.equal(store.getSnapshot().code.canvases.find((item) => item.id === id).draft.source, "original");
  assert.equal(store.getSnapshot().code.closedDrafts[boundId].source, "bound edit");
});

test("work target capture survives close/reload/reopen and conflicting targets cannot rewrite it", () => {
  browser(); const store = new SurfaceCanvasStore("canvas");
  const input = { kind: "app", title: "App", params: { projectId: project.id, appId: "example" } }, id = canvasId(input.kind, input.params);
  const target = { ...ready, worktreeId: null }; assert.equal(store.captureTarget("build", id, target), true);
  store.openCanvas("build", input); store.updateDraft("build", id, { notes: "keep" }); store.closeCanvas("build", id);
  const restored = new SurfaceCanvasStore("canvas"); assert.deepEqual(restored.getSnapshot().build.targets[id], target);
  assert.equal(restored.captureTarget("build", id, { ...target, orgId: "other-org" }), false);
  restored.openCanvas("build", input); assert.deepEqual(restored.getSnapshot().build.targets[id], target); assert.equal(restored.getSnapshot().build.canvases[0].draft.notes, "keep");
});

test("URL boundary serializes only destination fields, never runtime draft/id metadata, and rejects contradictory targets", () => {
  const value = destination({ ...capability(), id: "private-id", draft: { source: "SECRET SOURCE", notes: "SECRET NOTES" } });
  const href = destinationHref({ ...value, private: "SECRET EXTRA" });
  assert.equal(decodeURIComponent(href).includes("SECRET"), false); assert.equal(decodeURIComponent(href).includes("private-id"), false);
  assert.equal(readDestination(href).kind, "destination");
  assert.equal(readDestination(href.replace("/code?", "/alm?")).kind, "invalid");
  assert.equal(readDestination("/code?destination=%7Bbroken").kind, "invalid");
  assert.equal(readDestination(destinationHref({ ...value, target: ready })).kind, "invalid");
});

test("same-path encoded-space/apostrophe arrivals are acknowledged and Back/Forward restore their precise destination", () => {
  const applied = [], pushes = [], controller = new NavigationController((value) => applied.push(value), (href, replace) => pushes.push({ href, replace }));
  const one = destination({ ...capability(), title: "Alex's Apex draft" }); controller.navigate(one);
  const url = new URL(destinationHref(one), "http://localhost"), alternate = `${url.pathname}?${url.searchParams.toString()}`;
  assert.notEqual(alternate, destinationHref(one)); assert.equal(controller.restore(alternate), true);
  const two = destination({ ...capability(), params: { scope: "unbound", surface: "code", capability: "query" } }); controller.navigate(two);
  assert.equal(controller.restore(destinationHref(one), true), true); assert.equal(controller.restore(destinationHref(two), true), true);
  assert.equal(applied.at(-1).canvas.params.capability, "query");
});

test("superseded route arrivals repair URL and Back during pending navigation cannot revive the cancelled destination", () => {
  const applied = [], pushes = [], controller = new NavigationController((value) => applied.push(value), (href, replace) => pushes.push({ href, replace }));
  const one = destination(), two = destination(undefined, UNBOUND_TARGET, "build"); delete two.canvas;
  controller.navigate(one); controller.navigate(two);
  assert.equal(controller.restore(destinationHref(one)), false); assert.equal(pushes.at(-1).href, destinationHref(two)); assert.equal(pushes.at(-1).replace, true);
  assert.equal(controller.restore(destinationHref(one), true), true);
  assert.equal(controller.restore(destinationHref(two)), false); assert.equal(pushes.at(-1).href, destinationHref(one)); assert.equal(applied.at(-1).surface, "code");
});

test("one destination decision rejects conflicting captured targets, wrong ownership and profile without granting a usable context", () => {
  const { resolveDestination } = modules.load("lib/navigation/model");
  const input = { kind: "app", title: "Saved app", params: { projectId: project.id, appId: "app" } }, target = { ...ready, worktreeId: null };
  const value = destination(input, target, "build"), id = canvasId(input.kind, input.params), state = { build: { targets: { [id]: target } } };
  const allowed = resolveDestination(destinationHref(value), "am", ["build", "code"], state); assert.equal(allowed.kind, "available");
  for (const changed of [{ ...value, target: { ...target, orgId: "other" } }, { ...value, owner: "jw" }]) {
    const result = resolveDestination(destinationHref(changed), "am", ["build", "code"], state);
    assert.equal(result.kind, "unavailable"); assert.equal(result.destination, undefined);
  }
  const wrongWork = destination({ kind: "work", title: "Wrong", params: { workId: "unknown", projectId: project.id, worktreeId: worktree.id } }, ready);
  assert.equal(resolveDestination(destinationHref(wrongWork), "am", ["code"], {}).kind, "unavailable");
  assert.equal(resolveDestination(destinationHref(value), "am", ["code"], state).kind, "unavailable");
});

test("per-tab destinations remain independent of shared resume selection or active-tab changes", () => {
  const { resolveDestination } = modules.load("lib/navigation/model");
  const value = destination(), href = destinationHref(value);
  const state = { code: { activeCanvasId: "other-browser-tab", targets: {} } };
  assert.deepEqual(resolveDestination(href, "am", ["code"], state).destination, value);
  state.code.activeCanvasId = "another-view";
  assert.deepEqual(resolveDestination(href, "am", ["code"], state).destination, value);
});

test("restoration is distinguished from explicit navigation so loading an existing view never writes saved state", () => {
  const sources = [], controller = new NavigationController((_value, source) => sources.push(source), () => {});
  controller.navigate(destination(), true, "restore"); controller.restore(destinationHref(destination()));
  assert.deepEqual(sources, ["restore", "restore"]);
  controller.navigate(destination()); assert.equal(sources.at(-1), "navigation");
});

test("restored sole closed content hydrates before a partial edit without losing unrelated fields", () => {
  const input = capability(), id = canvasId(input.kind, input.params);
  browser({ canvas: JSON.stringify({ code: { canvases: [{ ...input, id }], activeCanvasId: id, closedDrafts: { [id]: { source: "class Legacy {}", name: "LegacyClass" } } } }) });
  const store = new SurfaceCanvasStore("canvas"); assert.equal(store.getSnapshot().code.canvases[0].draft, undefined);
  store.updateDraft("code", id, { name: "RenamedClass" }); store.closeCanvas("code", id);
  assert.deepEqual(store.getSnapshot().code.closedDrafts[id], { source: "class Legacy {}", name: "RenamedClass" });
  store.updateDraft("code", id, { name: "stale edit" }); assert.equal(store.getSnapshot().code.closedDrafts[id].name, "RenamedClass");
});

test("direct closed unbound source can be assigned while retaining its original bytes; unrelated capability copies are rejected", () => {
  const input = capability(), id = canvasId(input.kind, input.params), draft = { source: "class Closed {}", name: "ClosedClass" };
  browser({ canvas: JSON.stringify({ code: { canvases: [], activeCanvasId: "overview", closedDrafts: { [id]: draft } } }) });
  const store = new SurfaceCanvasStore("canvas"), bound = capability({ scope: "project", projectId: project.id, orgId: project.defaultOrgId });
  assert.equal(store.copyDraft("code", id, { ...bound, params: { ...bound.params, capability: "query" } }), false);
  assert.equal(store.copyDraft("code", id, bound), true); assert.deepEqual(store.getSnapshot().code.canvases[0].draft, draft);
  assert.deepEqual(store.getSnapshot().code.closedDrafts[id], draft);
});

test("read-only legacy work arrival captures its original org at the next explicit navigation without selecting or reopening it", () => {
  browser(); const store = new SurfaceCanvasStore("canvas");
  const input = { kind: "app", title: "Legacy app", params: { projectId: project.id, appId: "legacy" } }, id = canvasId(input.kind, input.params);
  const original = destination(input, { ...ready, worktreeId: null, orgId: "uat" }, "build"), events = [];
  const controller = new NavigationController((value, source) => {
    events.push(source);
    if (source === "capture" && value.canvas) store.captureTarget(value.surface, canvasId(value.canvas.kind, value.canvas.params), value.target);
  }, () => {});
  controller.restore(destinationHref(original)); assert.equal(store.getSnapshot().build.targets[id], undefined);
  controller.navigate({ version: 1, owner: "am", surface: "build", target: { ...original.target, orgId: "sit" } });
  assert.deepEqual(events, ["restore", "capture", "navigation"]); assert.equal(store.getSnapshot().build.targets[id].orgId, "uat");
  assert.equal(store.getSnapshot().build.activeCanvasId, "overview"); assert.equal(store.getSnapshot().build.canvases.length, 0);
});

test("login continuation only returns normalized typed internal destinations; denied bare routes resolve unavailable", () => {
  const { normalizeDestinationHref, resolveDestination } = modules.load("lib/navigation/model");
  const valid = destinationHref(destination()); assert.equal(normalizeDestinationHref(valid), valid);
  for (const raw of [`https://evil.example${valid}`, `//evil.example${valid}`, `javascript:alert(1)`, `/\\evil.example${valid}`, "/code", "/code?destination=broken", null]) assert.equal(normalizeDestinationHref(raw), null);
  assert.equal(resolveDestination("/code", "kf", ["build", "alm"], {}).kind, "unavailable");
  assert.equal(resolveDestination("/build", "kf", ["build", "alm"], {}).kind, "absent");
});

test("a newly created plan navigates from its authoritative result before any workspace projection refresh", () => {
  browser();
  const { AssessmentStore } = modules.load("lib/onboarding/persistence");
  const { currentFindings } = modules.load("lib/assessment/model");
  const { improvementProjectDestination } = modules.load("lib/navigation/model");
  const assessment = new AssessmentStore("sp");
  assessment.start(); for (let index = 0; index < 5; index++) assessment.advance();
  const observed = assessment.getSnapshot(), staleProjection = observed.projects;
  assessment.beginDraft(observed.currentRunId, { name: "Just saved", goal: "Preserve selected sandbox", targetOrgId: "sit", findingIds: currentFindings(observed).slice(0, 1).map((finding) => finding.id) });
  const draft = assessment.getSnapshot().draft;
  const saved = assessment.createProject("Sam", { draftId: draft.id, expectedRevision: draft.revision, commandId: "new-project-navigation" });
  assert.ok(saved); assert.equal(staleProjection.length, 0);
  const initial = improvementProjectDestination("sp", saved);
  const { assessmentBriefing, liveAssessmentView } = modules.load("lib/chat/today-snapshot");
  assert.deepEqual(improvementProjectDestination("sp", liveAssessmentView(assessment.getSnapshot()).projects[0]), initial);
  assert.deepEqual(improvementProjectDestination("sp", assessmentBriefing(assessment.getSnapshot()).projects[0]), initial);
  assert.equal(initial.target.orgId, saved.targetOrgId); assert.equal(initial.target.orgId, "sit"); assert.equal(initial.target.worktreeId, null);
  assert.equal(readDestination(destinationHref(initial)).value.target.orgId, "sit");
  assert.deepEqual(improvementProjectDestination("sp", assessment.getSnapshot().projects[0]), initial);
  const retired = improvementProjectDestination("sp", { ...saved, targetOrgId: "retired-sandbox" }); assert.equal(retired.target.orgId, "retired-sandbox");
  const previousCapture = { ...initial.target, orgId: "uat" };
  assert.deepEqual(improvementProjectDestination("sp", saved, previousCapture).target, previousCapture, "existing captured target wins without being overwritten");
});

test("database JSONB target key order cannot change destination identity or captured scope", () => {
  const { resolveDestination, improvementProjectDestination } = modules.load("lib/navigation/model");
  const scope = { scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: project.defaultOrgId };
  const input = capability(scope), requested = destination(input, ready), id = canvasId(input.kind,input.params);
  const databaseTarget = { orgId: ready.orgId, projectId: ready.projectId, worktreeId: ready.worktreeId };
  const stored = { code: { targets: { [id]: databaseTarget } } };
  assert.equal(resolveDestination(destinationHref(requested), "am", ["code"], stored).kind, "available");
  const plan = { id:"plan-jsonb",name:"Plan",targetOrgId:"sit" };
  assert.equal(improvementProjectDestination("sp",plan,{orgId:"sit",worktreeId:null,projectId:plan.id}).target.orgId,"sit");
  const store = new SurfaceCanvasStore("ordered");browser();assert.equal(store.captureTarget("code",id,databaseTarget),true);assert.equal(store.captureTarget("code",id,ready),true);
});
