import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const output = mkdtempSync(join(tmpdir(), "ufd-surface-canvas-test-"));
for (const [name, sourcePath] of [["model", "surface-canvas/model"], ["persistence", "surface-canvas/persistence"], ["returning-work", "workspace/returning-work"]]) {
  const source = readFileSync(new URL(`../src/lib/${sourcePath}.ts`, import.meta.url), "utf8").replaceAll("@/lib/workspace/returning-work", "./returning-work");
  writeFileSync(join(output, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { canvasId, canvasesForProject } = require(join(output, "model.js"));
let getSurfaceCanvasStore;
let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  delete require.cache[join(output, "persistence.js")];
  ({ getSurfaceCanvasStore } = require(join(output, "persistence.js")));
});
after(() => { delete globalThis.window; rmSync(output, { recursive: true, force: true }); });
const query = projectId => ({ kind: "capability", title: "SOQL query", params: {
  surface: "code", capability: "query", ...(projectId ? { projectId } : {}),
} });

test("returning canvas tabs are restricted to their project while other projects stay saved", () => {
  const store = getSurfaceCanvasStore("am");
  const saved = store.getSnapshot().code.canvases;
  const crm = canvasesForProject(saved, "trailblazer-crm");
  const acme = canvasesForProject(saved, "acme-storefront");
  assert.deepEqual(crm.map(canvas => canvas.title), ["OpportunityTriggerHandler.cls", "W-9821 regression tests", "CRM developer toolkit"]);
  assert.deepEqual(acme.map(canvas => canvas.title), ["Enterprise accounts.soql"]);
  assert.equal(canvasesForProject(saved, null).length, 0);
  assert.equal(store.getSnapshot().code.canvases, saved);
});

test("the same tool in different projects retains independent drafts after close and reload", () => {
  const store = getSurfaceCanvasStore("am");
  const crm = query("trailblazer-crm");
  const acme = query("acme-storefront");
  const crmId = canvasId(crm.kind, crm.params);
  const acmeId = canvasId(acme.kind, acme.params);
  store.openCanvas("code", crm);
  store.updateDraft("code", crmId, { source: "CRM draft" });
  store.openCanvas("code", acme);
  store.updateDraft("code", acmeId, { source: "Acme draft" });
  store.closeCanvas("code", crmId);
  store.openCanvas("code", crm);
  delete require.cache[join(output, "persistence.js")];
  const restored = require(join(output, "persistence.js")).getSurfaceCanvasStore("am").getSnapshot();
  assert.equal(restored.code.canvases.find(canvas => canvas.id === crmId).draft.source, "CRM draft");
  assert.equal(restored.code.canvases.find(canvas => canvas.id === acmeId).draft.source, "Acme draft");
});

test("legacy unowned tools adopt one project with their draft and selection intact", () => {
  const store = getSurfaceCanvasStore("am");
  const legacy = query();
  const oldId = canvasId(legacy.kind, legacy.params);
  store.openCanvas("code", legacy);
  store.updateDraft("code", oldId, { source: "Keep this legacy draft" });
  store.adoptUnscopedCanvases("trailblazer-crm");
  const adopted = store.getSnapshot();
  const current = adopted.code.canvases.find(canvas => canvas.id === adopted.code.activeCanvasId);
  assert.equal(current.params.projectId, "trailblazer-crm");
  assert.equal(current.draft.source, "Keep this legacy draft");
  assert.notEqual(current.id, oldId);
  store.adoptUnscopedCanvases("acme-storefront");
  assert.equal(store.getSnapshot(), adopted);
  assert.ok(!canvasesForProject(adopted.code.canvases, "acme-storefront").includes(current));
  assert.equal(JSON.parse(storage.get("ufd.surface-canvas.v1.am")).code.activeCanvasId, current.id);
});

test("adopting a legacy duplicate keeps edited fields and does not duplicate its tab", () => {
  const store = getSurfaceCanvasStore("am");
  const legacy = query();
  const scoped = query("trailblazer-crm");
  store.openCanvas("code", legacy);
  store.updateDraft("code", canvasId(legacy.kind, legacy.params), { source: "Legacy source", name: "Old title" });
  store.openCanvas("code", scoped);
  store.updateDraft("code", canvasId(scoped.kind, scoped.params), { name: "Project query" });
  store.adoptUnscopedCanvases("trailblazer-crm");
  const queries = store.getSnapshot().code.canvases.filter(canvas => canvas.kind === "capability");
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].draft, { source: "Legacy source", name: "Project query" });
});

test("saved app tabs and app work move into ALM without losing drafts or project ownership", () => {
  const app = { kind: "app", title: "Acme Storefront", params: { projectId: "acme-storefront", appId: "storefront" } };
  const id = canvasId(app.kind, app.params);
  const work = { kind: "work", title: "Acme Storefront", params: { projectId: "acme-storefront", worktreeId: "main", workId: "storefront-app" } };
  const workId = canvasId(work.kind, work.params);
  storage.set("ufd.surface-canvas.v1.am", JSON.stringify({
    build: { canvases: [{ ...app, id, draft: { notes: "Keep app notes" } }, { ...work, id: workId, draft: { notes: "Keep work notes" } }], activeCanvasId: id },
    alm: { canvases: [{ ...app, id, draft: { owner: "Alex" } }], activeCanvasId: id },
  }));
  const store = getSurfaceCanvasStore("am");
  const state = store.getSnapshot();
  assert.equal(state.build.canvases.length, 0);
  assert.equal(state.build.activeCanvasId, "overview");
  assert.equal(state.alm.canvases.length, 2);
  assert.equal(state.alm.activeCanvasId, id);
  assert.deepEqual(state.alm.canvases.find(canvas => canvas.id === id).draft, { notes: "Keep app notes", owner: "Alex" });
  assert.equal(state.alm.canvases.find(canvas => canvas.id === workId).draft.notes, "Keep work notes");
  assert.equal(canvasesForProject(state.alm.canvases, "trailblazer-crm").length, 0);
  store.openCanvas("build", app);
  assert.equal(store.getSnapshot().build.canvases.length, 0);
  assert.equal(store.getSnapshot().alm.canvases.length, 2);
  assert.equal(JSON.parse(storage.get("ufd.surface-canvas.v1.am")).build.canvases.length, 0);
});

test("closed app drafts reopen in ALM and new onboarding canvases survive reload", () => {
  const app = { kind: "app", title: "Acme Storefront", params: { projectId: "acme-storefront", appId: "storefront" } };
  const id = canvasId(app.kind, app.params);
  storage.set("ufd.surface-canvas.v1.sp", JSON.stringify({ build: { canvases: [], activeCanvasId: "overview", closedDrafts: { [id]: { notes: "Closed app notes" } } } }));
  const store = getSurfaceCanvasStore("sp");
  store.openCanvas("alm", app);
  assert.equal(store.getSnapshot().alm.canvases[0].draft.notes, "Closed app notes");
  store.openCanvas("alm", { kind: "project-creation", title: "New project" });
  store.openCanvas("govern", { kind: "org-assessment", title: "API headroom", params: { findingId: "api-headroom" } });
  delete require.cache[join(output, "persistence.js")];
  const restored = require(join(output, "persistence.js")).getSurfaceCanvasStore("sp");
  assert.equal(restored.getSnapshot().alm.activeCanvasId, "project-creation");
  assert.equal(restored.getSnapshot().govern.canvases[0].params.findingId, "api-headroom");
  restored.adoptUnscopedCanvases("new-project");
  assert.equal(canvasesForProject(restored.getSnapshot().alm.canvases, "new-project")[0].kind, "project-creation");
});
