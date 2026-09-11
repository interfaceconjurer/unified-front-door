import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Use the existing TypeScript compiler; the app itself is type-checked by build.
const output = mkdtempSync(join(tmpdir(), "ufd-onboarding-test-"));
for (const name of ["assessment", "persistence"]) {
  const source = readFileSync(new URL(`../src/lib/onboarding/${name}.ts`, import.meta.url), "utf8");
  writeFileSync(join(output, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { AssessmentStore, parseAssessment } = require(join(output, "persistence.js"));
const { findingsForScope, ASSESSMENT_STEPS } = require(join(output, "assessment.js"));

let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
});
after(() => { delete globalThis.window; rmSync(output, { recursive: true, force: true }); });

function completedStore(id = "sp") {
  const store = new AssessmentStore(id);
  store.start();
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  return store;
}
function draft(store, ids = ["api-headroom", "lead-routing"]) {
  store.saveDraft({ name: "Reliability", goal: "Reduce operational friction", targetOrgId: "sit", findingIds: ids });
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
  const project = store.createProject("Sam Patel");
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
  assert.equal(store.createProject("Sam"), null);
  store.start();
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  for (const invalid of [
    { name: " " }, { goal: " " }, { targetOrgId: "prod" }, { findingIds: [] }, { findingIds: ["unknown"] },
  ]) {
    draft(store);
    store.saveDraft({ ...store.getSnapshot().draft, ...invalid });
    assert.equal(store.createProject("Sam"), null);
  }
  store.rescan(["uat"]);
  for (let i = 0; i < ASSESSMENT_STEPS.length; i++) store.advance();
  draft(store, ["api-headroom"]);
  assert.equal(store.createProject("Sam"), null);
});

test("repeated creation does not duplicate work and rescans preserve existing projects", () => {
  const store = completedStore();
  draft(store);
  assert.ok(store.createProject("Sam"));
  assert.equal(store.createProject("Sam"), null);
  draft(store);
  assert.equal(store.createProject("Sam"), null);
  store.rescan(["sit"]);
  assert.equal(store.getSnapshot().projects.length, 1);
  assert.equal(store.getSnapshot().draft, null);
});

test("malformed saved state is sanitized without exposing inaccessible findings", () => {
  for (const raw of [null, "{", "null", "[]", '{"scopeOrgIds":["unknown"]}']) {
    assert.equal(parseAssessment(raw).status, "idle");
  }
  const state = parseAssessment(JSON.stringify({ status: "running", step: -20, scopeOrgIds: ["uat", "unknown"], projects: [null, {}, { id: 7 }], draft: [] }));
  assert.equal(state.step, 0);
  assert.deepEqual(state.scopeOrgIds, ["uat"]);
  assert.deepEqual(state.projects, []);
});

test("blocked local storage retains progress and projects in memory", () => {
  globalThis.window.localStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  const store = completedStore();
  draft(store);
  assert.ok(store.createProject("Sam"));
  assert.equal(store.getSnapshot().status, "complete");
  assert.equal(store.getSnapshot().projects.length, 1);
});
