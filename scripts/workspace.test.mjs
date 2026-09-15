import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const output = mkdtempSync(join(tmpdir(), "ufd-workspace-test-"));
for (const name of ["fixtures", "returning-work", "persistence"]) {
  const source = readFileSync(new URL(`../src/lib/workspace/${name}.ts`, import.meta.url), "utf8");
  writeFileSync(join(output, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { PROJECTS } = require(join(output, "fixtures.js"));
const { RETURNING_WORK, workCanvasInput } = require(join(output, "returning-work.js"));
let getWorkspaceSelectionStore;
let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  delete require.cache[join(output, "persistence.js")];
  ({ getWorkspaceSelectionStore } = require(join(output, "persistence.js")));
});
after(() => { delete globalThis.window; rmSync(output, { recursive: true, force: true }); });

test("every returning workspace has attention items that open its own work", () => {
  for (const project of PROJECTS) {
    for (const tree of project.worktrees) {
      const attention = RETURNING_WORK.filter((work) => work.projectId === project.id && work.worktreeId === tree.id && work.attention);
      assert.ok(attention.length > 0, `${project.name}/${tree.id} needs attention content`);
      for (const work of attention) {
        assert.equal(work.status, "review");
        assert.ok(work.summary.length && work.activity.length && work.details.length);
        assert.deepEqual(workCanvasInput(work).params, { workId: work.id, projectId: project.id, worktreeId: tree.id });
      }
    }
  }
});

test("a workspace switch publishes project and worktree together, preserving other selections", () => {
  const store = getWorkspaceSelectionStore("am");
  store.selectWorkspace("acme-storefront", "main");
  store.setOrgForProject("acme-storefront", "sit");
  store.setPanelOpen(true);
  const observed = [];
  const unsubscribe = store.subscribe(() => observed.push(store.getSnapshot()));
  store.selectWorkspace("trailblazer-crm", "hotfix-9821");
  unsubscribe();
  assert.equal(observed.length, 1);
  assert.equal(observed[0].activeProjectId, "trailblazer-crm");
  assert.deepEqual(observed[0].worktreeByProject, { "trailblazer-crm": "hotfix-9821", "acme-storefront": "main" });
  assert.deepEqual(observed[0].orgByProject, { "trailblazer-crm": "uat", "acme-storefront": "sit" });
  assert.equal(observed[0].panelOpen, true);
  assert.deepEqual(JSON.parse(storage.get("ufd.workspace.v1.am")), observed[0]);
});

test("workspace selection survives a fresh store without changing another profile", () => {
  const other = getWorkspaceSelectionStore("sp");
  const original = other.getSnapshot();
  getWorkspaceSelectionStore("am").selectWorkspace("trailblazer-crm", "lead-routing");
  delete require.cache[join(output, "persistence.js")];
  const restored = require(join(output, "persistence.js")).getWorkspaceSelectionStore("am").getSnapshot();
  assert.equal(restored.activeProjectId, "trailblazer-crm");
  assert.equal(restored.worktreeByProject[restored.activeProjectId], "lead-routing");
  assert.equal(other.getSnapshot(), original);
});
