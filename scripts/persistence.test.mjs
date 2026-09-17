import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { testModules } from "./test-modules.mjs";
const { load, cleanup } = testModules(["src/components/persistence/PersistenceStatus.tsx"]);
const { BrowserPersistenceStore } = load("lib/browser-persistence");
const { WorkspaceSelectionStore, getWorkspaceSelectionStore } = load("lib/workspace/persistence");
const { SurfaceCanvasStore, getSurfaceCanvasStore } = load("lib/surface-canvas/persistence");
const { DemoProfileStore } = load("lib/demo-profile-persistence");
const { AssessmentStore } = load("lib/onboarding/persistence");
const { PersistenceStatusView } = load("components/persistence/PersistenceStatus");
const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");

let disk, blockedRead, blockedWrite, attached, cleanups;
function storageEvent(key, storageArea = window.localStorage) {
  const event = new Event("storage");
  Object.assign(event, { key, storageArea });
  window.dispatchEvent(event);
}
beforeEach(() => {
  disk = new Map(); blockedRead = false; blockedWrite = false; attached = new Set(); cleanups = [];
  const target = new EventTarget();
  const localStorage = {
    getItem(key) { if (blockedRead) throw Error("Read blocked"); return disk.get(key) ?? null; },
    setItem(key, value) { if (blockedWrite) throw Error("Write blocked"); disk.set(key, value); },
    removeItem(key) { if (blockedWrite) throw Error("Write blocked"); disk.delete(key); },
  };
  globalThis.window = {
    localStorage,
    addEventListener(type, callback) { attached.add(callback); target.addEventListener(type, callback); },
    removeEventListener(type, callback) { attached.delete(callback); target.removeEventListener(type, callback); },
    dispatchEvent: target.dispatchEvent.bind(target),
  };
});
afterEach(() => { for (const cleanup of cleanups) cleanup(); delete globalThis.window; });
after(cleanup);

const cases = [
  { name: "workspace", key: "test.workspace", create: () => new WorkspaceSelectionStore("test.workspace"), edit: (store, value) => store.setActiveProjectId(value), read: (store) => store.getSnapshot().activeProjectId },
  { name: "canvas", key: "test.canvas", create: () => new SurfaceCanvasStore("test.canvas"), edit(store, value) { store.openCanvas("build", { kind: "capability", title: "Agent", params: { scope: "unbound", surface: "build", capability: "agent" } }); store.updateDraft("build", store.getSnapshot().build.activeCanvasId, { name: value }); }, read: (store) => store.getSnapshot().build.canvases[0]?.draft?.name },
  { name: "assessment", key: "ufd.org-assessment.v1.sp", create: () => new AssessmentStore("sp"), edit: (store, value) => { let draft = store.getSnapshot().draft; if (!draft) { store.start(); for (let i = 0; i < 5; i++) store.advance(); store.beginDraft(store.getSnapshot().currentRunId, { name: value, goal: "Goal", targetOrgId: "sit", findingIds: [] }); draft = store.getSnapshot().draft; } store.editDraft(draft.id, { field: "name", value }); }, read: (store) => store.getSnapshot().draft?.name },
  { name: "profile", key: "ufd.demo-user.v1", create: () => new DemoProfileStore(), edit: (store, value) => store.setProfile(value), read: (store) => store.getSnapshot() },
];

for (const scenario of cases) {
  test(`${scenario.name}: successful state survives read failure, write failure, continued edits, and retry`, () => {
    const store = scenario.create();
    scenario.edit(store, "am");
    const saved = store.getSnapshot();
    const raw = disk.get(scenario.key);
    assert.equal(store.getPersistenceSnapshot(), "saved");
    assert.equal(store.getSnapshot(), saved);
    blockedRead = true;
    assert.equal(store.getSnapshot(), saved);
    assert.equal(store.getPersistenceSnapshot(), "unavailable");
    scenario.edit(store, "jw");
    assert.equal(scenario.read(store), "jw");
    blockedRead = false; blockedWrite = true;
    scenario.edit(store, "kf");
    assert.equal(scenario.read(store), "kf");
    assert.notEqual(store.getPersistenceSnapshot(), "saved");
    assert.equal(disk.get(scenario.key), raw);
    blockedWrite = false;
    store.retryPersistence();
    assert.equal(scenario.read(store), "kf");
    assert.equal(store.getPersistenceSnapshot(), "saved");
    assert.equal(JSON.parse(disk.get(scenario.key)).__ufd, 1);
  });
  test(`${scenario.name}: initially blocked reads retain edits; unknown nonempty baseline conflicts`, () => {
    blockedRead = true;
    const store = scenario.create();
    scenario.edit(store, "am");
    scenario.edit(store, "kf");
    assert.equal(scenario.read(store), "kf");
    blockedRead = false;
    const external = scenario.name === "profile" ? "jw" : JSON.stringify({ __ufd: 1, data: scenario.create().getServerSnapshot() });
    disk.set(scenario.key, external);
    store.retryPersistence();
    assert.equal(store.getPersistenceSnapshot(), "conflict");
    assert.equal(scenario.read(store), "kf");
    assert.equal(disk.get(scenario.key), external);
    store.keepLocalChanges();
    assert.equal(store.getPersistenceSnapshot(), "saved");
    assert.equal(scenario.read(store), "kf");
  });
  test(`${scenario.name}: initially blocked empty storage recovers without losing local edits`, () => {
    blockedRead = true;
    const store = scenario.create();
    scenario.edit(store, "am");
    blockedRead = false;
    store.retryPersistence();
    assert.equal(scenario.read(store), "am");
    assert.equal(store.getPersistenceSnapshot(), "saved");
  });
}

test("cross-tab changes, removal, clear and same-runtime writes notify; unrelated/session keys do not", () => {
  const first = new WorkspaceSelectionStore("sync");
  const second = new WorkspaceSelectionStore("sync");
  let notices = 0;
  const unsubscribe = second.subscribe(() => notices++);
  cleanups.push(unsubscribe);
  assert.equal(attached.size, 2);
  notices = 0;
  first.setActiveProjectId("first");
  assert.equal(notices, 1);
  assert.equal(second.getSnapshot().activeProjectId, "first");
  disk.set("sync", JSON.stringify({ activeProjectId: "external" }));
  storageEvent("unrelated");
  storageEvent("sync", {});
  assert.equal(notices, 1);
  storageEvent("sync");
  assert.equal(notices, 2);
  assert.equal(second.getSnapshot().activeProjectId, "external");
  disk.delete("sync"); storageEvent("sync");
  assert.equal(second.getSnapshot().activeProjectId, null);
  first.setActiveProjectId("again");
  disk.clear(); storageEvent(null);
  assert.equal(second.getSnapshot().activeProjectId, null);
  unsubscribe();
  assert.equal(attached.size, 0);
});

test("dirty local state survives external write/removal; either conflict choice is explicit", () => {
  const store = new WorkspaceSelectionStore("conflict");
  cleanups.push(store.subscribe(() => {}));
  store.setActiveProjectId("base");
  blockedWrite = true; store.setActiveProjectId("local"); blockedWrite = false;
  const external = JSON.stringify({ activeProjectId: "external" });
  disk.set("conflict", external); storageEvent("conflict");
  assert.equal(store.getSnapshot().activeProjectId, "local");
  assert.equal(store.getPersistenceSnapshot(), "conflict");
  store.retryPersistence();
  assert.equal(disk.get("conflict"), external);
  store.useSavedVersion();
  assert.equal(store.getSnapshot().activeProjectId, "external");
  blockedWrite = true; store.setActiveProjectId("next local"); blockedWrite = false;
  disk.delete("conflict"); storageEvent(null);
  assert.equal(store.getPersistenceSnapshot(), "conflict");
  assert.equal(store.getSnapshot().activeProjectId, "next local");
  store.keepLocalChanges();
  assert.equal(new WorkspaceSelectionStore("conflict").getSnapshot().activeProjectId, "next local");
});

test("malformed and unsupported bytes are protected through edits, reset, retry, and failed useSavedVersion", () => {
  for (const raw of ["{", "[]", "{}", '{"__ufd":2,"data":{"activeProjectId":"future"}}']) {
    const store = new WorkspaceSelectionStore("invalid");
    disk.set("invalid", raw);
    assert.equal(store.getPersistenceSnapshot(), raw.includes('__ufd') ? "unsupported" : "invalid");
    store.setActiveProjectId("local"); store.retryPersistence(); store.useSavedVersion();
    assert.equal(store.getSnapshot().activeProjectId, "local");
    assert.equal(disk.get("invalid"), raw);
    store.reset();
    assert.equal(disk.get("invalid"), raw);
    store.keepLocalChanges();
    assert.equal(store.getPersistenceSnapshot(), "saved");
  }
});

test("legacy payloads and original keys survive; edited closed drafts restore and profiles remain isolated", () => {
  disk.set("ufd.demo-user.v1", "sp");
  assert.equal(new DemoProfileStore().getSnapshot(), "sp");
  assert.equal(disk.get("ufd.demo-user.v1"), "sp");
  disk.set("ufd.workspace.v1", JSON.stringify({ activeProjectId: "original" }));
  assert.equal(getWorkspaceSelectionStore("jw").getSnapshot().activeProjectId, "original");
  assert.equal(getWorkspaceSelectionStore("am").getSnapshot().activeProjectId, "trailblazer-crm");
  const store = getSurfaceCanvasStore("jw");
  const input = { kind: "capability", title: "Legacy", params: { scope: "unbound", surface: "build", capability: "agent" } };
  store.openCanvas("build", input);
  const id = store.getSnapshot().build.activeCanvasId;
  store.updateDraft("build", id, { name: "Keep this" });
  store.closeCanvas("build", id);
  // An old raw payload is still readable without rewriting it during hydration.
  const legacyRaw = JSON.stringify(store.getSnapshot());
  disk.set("ufd.surface-canvas.v1", legacyRaw);
  const restored = new SurfaceCanvasStore("ufd.surface-canvas.v1");
  assert.equal(restored.getSnapshot().build.closedDrafts[id].name, "Keep this");
  assert.equal(disk.get("ufd.surface-canvas.v1"), legacyRaw);
  restored.openCanvas("build", input);
  assert.equal(restored.getSnapshot().build.canvases[0].draft.name, "Keep this");
  assert.equal(getSurfaceCanvasStore("kf").getSnapshot().build.canvases.length, 0);
  restored.reset();
  assert.equal(new SurfaceCanvasStore("ufd.surface-canvas.v1").getSnapshot().build.canvases.length, 0);
  const profile = new DemoProfileStore(); profile.setProfile(null);
  assert.equal(disk.has("ufd.demo-user.v1"), false);
});

test("server snapshots are stable/browser independent; snapshot reads never notify; same raw decodes once", () => {
  let decodes = 0, notices = 0;
  const initial = { count: 0 };
  const store = new BrowserPersistenceStore("stable", initial, (value) => { decodes++; return { value }; });
  disk.set("stable", JSON.stringify({ count: 1 }));
  const unsubscribe = store.subscribe(() => notices++); cleanups.push(unsubscribe);
  notices = 0;
  const snapshot = store.getSnapshot();
  for (let i = 0; i < 10; i++) { assert.equal(store.getSnapshot(), snapshot); store.getPersistenceSnapshot(); }
  assert.equal(decodes, 1);
  disk.set("stable", JSON.stringify({ count: 2 }));
  assert.equal(store.getSnapshot().count, 2);
  assert.equal(notices, 0);
  assert.equal(store.getServerSnapshot(), initial);
  assert.equal(store.getServerPersistenceSnapshot(), "loading");
  const profile = new DemoProfileStore(); profile.setProfile("am");
  assert.equal(profile.getServerSnapshot(), undefined);
  const savedWindow = globalThis.window; delete globalThis.window;
  assert.equal(store.getSnapshot(), initial);
  assert.equal(profile.getSnapshot(), undefined);
  globalThis.window = savedWindow;
});

test("assessment transitions preserve a new external scope at refresh and block divergence before write", () => {
  for (const changedOnRead of [1, 2]) {
    const store = new AssessmentStore("race");
    const key = "ufd.org-assessment.v1.race";
    disk.delete(key);
    store.getSnapshot();
    const original = window.localStorage.getItem;
    let reads = 0;
    const external = JSON.stringify({ ...store.getServerSnapshot(), scopeOrgIds: ["uat"] });
    window.localStorage.getItem = (readKey) => {
      if (++reads === changedOnRead) disk.set(key, external);
      return original(readKey);
    };
    store.start();
    window.localStorage.getItem = original;
    if (changedOnRead === 1) {
      assert.deepEqual(store.getSnapshot().scopeOrgIds, ["uat"]);
      assert.equal(store.getPersistenceSnapshot(), "saved");
    } else {
      assert.equal(store.getPersistenceSnapshot(), "conflict");
      assert.equal(disk.get(key), external);
    }
  }
});

test("initially blocked explicit resets and sign-out retain their intent when old data returns", () => {
  for (const scenario of cases) {
    const saved = scenario.create();
    scenario.edit(saved, "am");
    const raw = disk.get(scenario.key);
    blockedRead = true;
    const store = scenario.create();
    const initial = scenario.name === "profile" ? null : store.getServerSnapshot();
    if (scenario.name === "profile") store.setProfile(null);
    else store.reset();
    assert.equal(store.getSnapshot(), initial);
    blockedRead = false;
    store.retryPersistence();
    assert.equal(store.getPersistenceSnapshot(), "conflict");
    assert.equal(store.getSnapshot(), initial);
    assert.equal(disk.get(scenario.key), raw);
    store.keepLocalChanges();
    assert.deepEqual(JSON.parse(JSON.stringify(scenario.create().getSnapshot())), initial);
  }
});

test("actual status UI renders truthful saved/failure/recovery controls including status-only transitions", () => {
  const actions = { retry() {}, keepLocal() {}, useSaved() {} };
  const render = (status) => renderToStaticMarkup(createElement(PersistenceStatusView, { ...actions, status }));
  assert.match(render("saved"), /Saved in this browser/);
  for (const status of ["unavailable", "unsaved", "conflict", "invalid", "unsupported"]) {
    const html = render(status);
    assert.doesNotMatch(html, /Saved in this browser/);
    assert.match(html, /Retry saving/);
    assert.match(html, /role="status"/);
  }
  assert.match(render("conflict"), /discard my changes/);
  assert.doesNotMatch(render("unsupported"), /Use saved version/);
  const serverPending = renderToStaticMarkup(createElement(PersistenceStatusView, {...actions,status:"unsaved",location:"server"}));
  assert.match(serverPending,/Saving to database/);assert.doesNotMatch(serverPending,/Retry saving/);
  const memoryOnly = renderToStaticMarkup(createElement(PersistenceStatusView,{...actions,status:"saving",location:"server",onlyProblems:true,bufferFailure:true,pendingLocation:"Pending edits are only in this tab"}));
  assert.match(memoryOnly,/only in this tab/);
  const store = new WorkspaceSelectionStore("status-only");
  store.setActiveProjectId("saved");
  const snapshot = store.getSnapshot();
  let observed;
  cleanups.push(store.subscribe(() => { observed = render(store.getPersistenceSnapshot()); }));
  blockedRead = true; storageEvent("status-only");
  assert.equal(store.getSnapshot(), snapshot);
  assert.match(observed, /Saving is unavailable/);
  blockedRead = false; store.retryPersistence();
  assert.equal(store.getSnapshot(), snapshot);
  assert.match(observed, /Saved in this browser/);
});
