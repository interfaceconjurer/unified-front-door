import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { testModules } from "./test-modules.mjs";
const { load, cleanup } = testModules();
const { AssessmentStore, parseAssessment } = load("lib/onboarding/persistence");
const { findingsForScope, ASSESSMENT_STEPS } = load("lib/onboarding/assessment");

let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
});
after(() => { delete globalThis.window; cleanup(); });

function completedStore(id = "sp") {
  const store = new AssessmentStore(id);
  store.start();
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  return store;
}
function draft(store, ids = ["api-headroom", "lead-routing"]) {
  const state = store.getSnapshot();
  if (state.draft) store.discardDraft(state.draft.id);
  const run = state.runs.find((run) => run.id === state.currentRunId);
  store.beginDraft(state.currentRunId, { name: "Reliability", goal: "Reduce operational friction", targetOrgId: "sit", findingIds: ids.map((id) => run?.findings.find((finding) => finding.sourceFindingId === id)?.id ?? id) });
}

function create(store, owner = "Sam") {
  const draft = store.getSnapshot().draft;
  return store.createProject(owner, { draftId: draft?.id ?? "missing", commandId: `create:${draft?.id ?? "missing"}`, expectedRevision: draft?.revision ?? 1 });
}

test("scope excludes unknown and expired connections and only yields findings for selected orgs", () => {
  assert.equal(findingsForScope(["unknown", "scratch-hotfix"]).length, 0);
  assert.deepEqual(findingsForScope(["uat"]).map((finding) => finding.orgId), ["uat"]);
  assert.equal(findingsForScope(["sit"]).length, 0);
  const store = completedStore();
  store.rescan(["uat", "unknown", "scratch-hotfix"]);
  assert.deepEqual(store.getSnapshot().scopeOrgIds, ["uat"]);
  store.rescan([]);
  assert.deepEqual(store.getSnapshot().scopeOrgIds, ["uat"]);
});

test("paused assessments persist and cannot advance until resumed", () => {
  const store = new AssessmentStore("sp");
  store.start(); store.advance(); store.pause(); store.advance();
  const restored = new AssessmentStore("sp");
  assert.equal(restored.getSnapshot().status, "paused");
  assert.equal(restored.getSnapshot().step, 1);
  restored.start(); restored.advance();
  assert.equal(restored.getSnapshot().step, 2);
});

test("drafts, projects, and work item statuses survive reload without leaking between profiles", () => {
  const store = completedStore();
  draft(store);
  assert.equal(new AssessmentStore("sp").getSnapshot().draft.name, "Reliability");
  const project = create(store, "Sam Patel");
  assert.equal(project.workItems.length, 2);
  store.setWorkItemStatus(project.id, project.workItems[0].id, "in-progress");
  const restored = new AssessmentStore("sp").getSnapshot();
  assert.equal(restored.projects[0].workItems[0].status, "in-progress");
  assert.equal(restored.draft, null);
  assert.equal(new AssessmentStore("am").getSnapshot().projects.length, 0);
});

test("creation requires a completed assessment, valid scope, sandbox, and nonempty project", () => {
  const store = new AssessmentStore("sp");
  draft(store);
  assert.equal(create(store, "Sam"), null);
  store.start();
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  for (const invalid of [
    { name: " " }, { goal: " " }, { targetOrgId: "prod" }, { findingIds: [] }, { findingIds: ["unknown"] },
  ]) {
    draft(store);
    const current = store.getSnapshot().draft;
    store.discardDraft(current.id);
    store.beginDraft(current.runId, { ...current, ...invalid });
    assert.equal(create(store, "Sam"), null);
  }
  store.rescan(["uat"]);
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  draft(store, ["api-headroom"]);
  assert.equal(create(store, "Sam"), null);
});

test("repeated creation does not duplicate work and rescans preserve existing projects", () => {
  const store = completedStore();
  draft(store);
  assert.ok(create(store, "Sam"));
  assert.equal(create(store, "Sam"), null);
  draft(store);
  assert.equal(create(store, "Sam"), null);
  const originDraft = store.getSnapshot().draft;
  store.rescan(["sit"]);
  assert.equal(store.getSnapshot().projects.length, 1);
  assert.equal(store.getSnapshot().draft, originDraft);
});

test("malformed state is protected while historical scope remains catalog-independent", () => {
  for (const raw of [null, "{", "null", "[]", '{"scopeOrgIds":["unknown"]}']) {
    assert.equal(parseAssessment(raw).status, "idle");
  }
  const state = parseAssessment(JSON.stringify({ status: "running", step: -20, scopeOrgIds: ["uat", "unknown"], projects: [], draft: null }));
  assert.equal(state.step, 0);
  assert.deepEqual(state.scopeOrgIds, ["uat", "unknown"]);
  assert.deepEqual(state.projects, []);
});

test("blocked local storage retains progress and projects in memory", () => {
  globalThis.window.localStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  const store = completedStore();
  draft(store);
  assert.ok(create(store, "Sam"));
  assert.equal(store.getSnapshot().status, "complete");
  assert.equal(store.getSnapshot().projects.length, 1);
});


test("day-zero reset clears assessment progress, projects, and drafts durably", () => {
  const store = completedStore();
  draft(store);
  assert.ok(create(store, "Sam"));
  draft(store, ["release-validation"]);
  const other = completedStore("am");
  store.reset();
  assert.deepEqual(store.getSnapshot(), parseAssessment(null));
  assert.deepEqual(new AssessmentStore("sp").getSnapshot(), parseAssessment(null));
  assert.equal(other.getSnapshot().status, "complete");
  store.start();
  assert.equal(store.getSnapshot().status, "running");
  assert.equal(store.getSnapshot().step, 0);
});

test("day-zero reset clears cached progress when browser storage is blocked", () => {
  globalThis.window.localStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  const store = completedStore();
  draft(store);
  assert.ok(create(store, "Sam"));
  store.reset();
  assert.deepEqual(store.getSnapshot(), parseAssessment(null));
});

test("new assessment commands capture exactly one selected org; org views preserve independent history", () => {
  const { applyAssessmentCommand } = load("lib/application/assessment-commands");
  const { INITIAL, decodeAssessment } = load("lib/assessment/state-codec");
  const { assessmentForOrg } = load("lib/assessment/selected-org");
  const { captureToday } = load("lib/chat/today-snapshot");
  const { demoProfileById } = load("lib/demo-profiles");
  let sequence = 0, state = structuredClone(INITIAL);
  const apply = operation => { state = applyAssessmentCommand(state, { ...operation, commandId: `c-${++sequence}`, expectedRevision: 0 }, { id: () => `id-${sequence}`, now: "2026-09-23T12:00:00Z", owner: "Sam" }); };
  assert.throws(() => apply({ kind: "assessment.start" }), /connected org/);
  assert.throws(() => apply({ kind: "assessment.start", orgId: "scratch-hotfix" }), /connected org/);
  apply({ kind: "assessment.start", orgId: "prod" });
  assert.deepEqual(state.scopeOrgIds, ["prod"]);
  assert.equal(assessmentForOrg(state, "uat").status, "idle");
  assert.equal(assessmentForOrg(state, "prod").status, "running");
  assert.throws(() => apply({ kind: "assessment.start", orgId: "uat" }), /another org/);
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) apply({ kind: "assessment.advance" });
  const original = structuredClone(state.runs[0]);
  assert(original.findings.length > 1 && original.findings.every(f => f.orgId === "prod"));
  const today = captureToday({ capturedAt: original.completedAt, profile: demoProfileById("sp"), hasProjects: false, working: 0, projectName: "", branch: "", recent: [], assessment: state, orgId: "prod" });
  assert.throws(() => apply({ kind: "assessment.rescan", orgIds: ["prod", "uat"] }), /one connected org/);
  apply({ kind: "assessment.rescan", orgIds: ["uat"] });
  assert.equal(assessmentForOrg(state, "prod").status, "complete");
  assert.equal(assessmentForOrg(state, "uat").status, "running");
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) apply({ kind: "assessment.advance" });
  assert.deepEqual(state.runs[0], original);
  assert.deepEqual(assessmentForOrg(state, "prod").runs[0].findings, original.findings);
  assert(assessmentForOrg(state, "uat").runs[0].findings.every(f => f.orgId === "uat"));
  assert.equal(assessmentForOrg(state, "sit").status, "idle");
  assert.equal(assessmentForOrg(state, null).runs.length, 0);
  assert.deepEqual(today.assessment.findings, original.findings, "Previously captured Today remains unchanged");
  assert.deepEqual(decodeAssessment(state).value, state, "Per-org runs survive persistence roundtrip");
});

test("legacy multi-org evidence is filtered for Today without changing its source or allocated projects", () => {
  const { assessmentForOrg } = load("lib/assessment/selected-org");
  const store = completedStore("legacy-multi");
  const original = structuredClone(store.getSnapshot());
  const selected = assessmentForOrg(original, "prod");
  assert(selected.runs[0].findings.every(f => f.orgId === "prod"));
  assert.deepEqual(selected.scopeOrgIds, ["prod"]);
  assert(original.runs[0].findings.some(f => f.orgId === "uat"));
  assert.equal(selected.runs[0].id, original.runs[0].id);
});
