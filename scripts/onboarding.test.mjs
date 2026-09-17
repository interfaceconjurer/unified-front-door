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
