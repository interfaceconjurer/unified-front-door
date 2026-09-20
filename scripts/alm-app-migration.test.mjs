import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { canvasId } = modules.load("lib/surface-canvas/model");
const { emptyState, parseState, SurfaceCanvasStore } = modules.load("lib/surface-canvas/persistence");
const { canonicalCanvasSurface } = modules.load("lib/surface-canvas/routing");
const { readDestination, destinationHref, destinationIdentity, NavigationController, resolveDestination } = modules.load("lib/navigation/model");
const { RETURNING_WORK, workCanvasInput } = modules.load("lib/workspace/returning-work");
const { decodeLegacy } = modules.load("lib/application/legacy");
const { parseCommand, stableJson } = modules.load("lib/application/contracts");
const { RemoteWorkspaceStore, EMPTY_APPLICATION } = modules.load("lib/application/remote-store");
const { projectCanvases } = modules.load("lib/surface-canvas/projection");
const { WorkspaceSelectionStore } = modules.load("lib/workspace/persistence");
const { navigationOptions, navigationMatchesContext, resolveNavigationCall } = modules.load("lib/agent/navigation");
const { demoProfileById } = modules.load("lib/demo-profiles");
const work = RETURNING_WORK.find(item => item.id === "storefront-app"), input = workCanvasInput(work), id = canvasId(input.kind, input.params);
const target = { projectId: work.projectId, worktreeId: work.worktreeId, orgId: "prod" };
const app = { kind: "app", title: "Storefront operations", params: { projectId: work.projectId, appId: "storefront" } }, appId = canvasId(app.kind, app.params), appTarget = { ...target, worktreeId: null };
const old = { version: 1, owner: "am", surface: "build", target, canvas: input };
const rawHref = value => `/${value.surface}?destination=${encodeURIComponent(JSON.stringify(value))}`;
function browser(values = {}) { const disk = new Map(Object.entries(values)); global.window = { localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) }, addEventListener() {}, removeEventListener() {} }; return disk; }

test("legacy app/work links replace the actual route while preserving identity and exact captured target", () => {
  for (const legacy of [old, { ...old, canvas: app, target: appTarget }]) {
    const bytes = JSON.stringify(legacy), decoded = readDestination(rawHref(legacy));
    assert.equal(decoded.kind, "destination"); assert.equal(decoded.value.surface, "alm");
    assert.deepEqual(decoded.value.target, legacy.target); assert.equal(destinationIdentity(decoded.value), destinationIdentity(legacy));
    const applied = [], pushes = [], controller = new NavigationController(value => applied.push(value), (href, replace) => pushes.push({ href, replace }));
    assert.equal(controller.restore(rawHref(legacy)), true);
    assert.equal(applied[0].surface, "alm"); assert.deepEqual(pushes[0], { href: destinationHref(decoded.value), replace: true });
    controller.navigate(legacy); assert.equal(applied.at(-1).surface, "alm");
    assert.equal(JSON.stringify(legacy), bytes);
    assert.equal(resolveDestination(rawHref(legacy), "am", ["build"], {}).kind, "unavailable", "ALM access remains required");
  }
  const builder = { kind: "capability", title: "Experience", params: { scope: "unbound", surface: "build", capability: "experience" } };
  assert.equal(canonicalCanvasSurface("build", builder), "build");
  assert.equal(resolveDestination(rawHref({ ...old, surface: "code" }), "am", ["code", "alm"], {}).kind, "unavailable");
});

test("open, closed, active and target preferences move together and survive close/reload without losing builder tabs", () => {
  const state = emptyState(), fields = { notes: "Exact original notes\nSecond line" };
  const builder = { kind: "capability", title: "Automation", params: { scope: "unbound", surface: "build", capability: "automation" } }, builderId = canvasId(builder.kind, builder.params);
  state.build = { ...state.build, canvases: [{ ...input, id, draft: fields }, { ...builder, id: builderId }], activeCanvasId: id,
    closedDrafts: { [appId]: { notes: "Closed operation notes" } }, targets: { [id]: target, [appId]: appTarget } };
  browser({ migration: JSON.stringify(state) });
  const store = new SurfaceCanvasStore("migration"), next = store.getSnapshot();
  assert.deepEqual(next.build.canvases.map(canvas => canvas.id), [builderId]); assert.equal(next.build.activeCanvasId, "overview");
  assert.equal(next.alm.activeCanvasId, id); assert.deepEqual(next.alm.canvases[0].draft, fields);
  assert.deepEqual(next.alm.targets, { [id]: target, [appId]: appTarget }); assert.equal(next.alm.closedDrafts[appId].notes, "Closed operation notes");
  assert.deepEqual(parseState(next).value, next, "migration is idempotent");
  store.closeCanvas("build", id); store.openCanvas("build", app);
  const restored = new SurfaceCanvasStore("migration"); restored.openCanvas("build", input);
  assert.deepEqual(restored.getSnapshot().alm.canvases.find(canvas => canvas.id === id).draft, fields);
  assert.equal(restored.getSnapshot().alm.canvases.find(canvas => canvas.id === appId).draft.notes, "Closed operation notes");
});

test("conflicting ALM and legacy edits preserve both versions and their targets for recovery", () => {
  const state = emptyState(), otherTarget = { ...target, orgId: "uat" };
  state.build = { ...state.build, canvases: [{ ...input, id, draft: { notes: "OLDER-BUILD" } }], targets: { [id]: target }, activeCanvasId: id };
  state.alm = { ...state.alm, canvases: [{ ...input, id, draft: { notes: "CURRENT-ALM" } }], targets: { [id]: otherTarget }, activeCanvasId: id };
  const next = parseState(state).value;
  assert.equal(next.alm.canvases[0].draft.notes, "CURRENT-ALM"); assert.deepEqual(next.alm.targets[id], otherTarget);
  assert.equal(next.alm.recovery.length, 1); assert.equal(next.alm.recovery[0].original.canvas.draft.notes, "OLDER-BUILD");
  assert.deepEqual(next.alm.recovery[0].original.target, target); assert.deepEqual(parseState(next).value, next);
});

test("legacy imports and project resume adapt routes without rewriting original import bytes", () => {
  const state = emptyState(); state.build = { ...state.build, canvases: [{ ...input, id, draft: { notes: "Imported notes" } }], activeCanvasId: id, targets: { [id]: target } };
  const source = { profileId: "am", assessment: null, canvases: JSON.stringify(state) }, bytes = JSON.stringify(source);
  const decoded = decodeLegacy(source); assert.equal(decoded.canvases[0].surface, "alm"); assert.equal(decoded.canvases[0].id, id);
  assert.equal(decoded.canvases[0].fields.notes, "Imported notes"); assert.equal(JSON.stringify(source), bytes);
  const { sessionKey } = modules.load("lib/workspace/model");
  browser({ selection: JSON.stringify({ activeProjectId: target.projectId, worktreeByProject: {}, orgByProject: {}, panelOpen: false,
    destinationsBySession: { [sessionKey(target.projectId, target.worktreeId)]: rawHref(old) } }) });
  const resumed = new WorkspaceSelectionStore("selection").destinationFor("am", target.projectId, target.worktreeId);
  assert.equal(resumed.surface, "alm"); assert.deepEqual(resumed.target, target);
});

test("pending legacy saves project into ALM while keeping their exact receipt payload and edits", async () => {
  const session = { namespaceId: "test", profileId: "am", generation: "generation", expiresAt: "2026-10-01" };
  const command = { kind: "canvas.save", surface: "build", canvas: input, target, fields: { notes: "Unacknowledged edit" }, commandId: "legacy", expectedRevision: 2 };
  const bytes = stableJson(command); assert.deepEqual(parseCommand(command), command);
  browser({ pending: JSON.stringify({ session, commands: [command] }) });
  const saved = { ...structuredClone(EMPTY_APPLICATION), session, canvases: [{ id, surface: "alm", canvas: input, target, fields: { notes: "Saved notes", extra: "Keep" }, revision: 2 }] };
  const store = new RemoteWorkspaceStore(session, { read: async () => saved, send: async () => { throw new Error("offline"); } }, "pending", () => {});
  await store.load();
  const projected = store.getSnapshot().canvases[0]; assert.equal(projected.surface, "alm"); assert.deepEqual(projected.fields, { notes: "Unacknowledged edit", extra: "Keep" });
  assert.equal(stableJson(store.getPending()[0]), bytes);
  const prefs = emptyState(); prefs.alm.canvases = [{ ...input, id }];
  const tabs = projectCanvases(emptyState(), prefs, store.getSnapshot().canvases);
  assert.deepEqual(tabs.alm.canvases[0].draft, projected.fields); assert.equal(tabs.build.canvases.length, 0);
  store.deactivate();
});

test("old captured model catalog handoffs validate against current ALM ownership without rewriting saved actions", () => {
  const context = { profile: demoProfileById("am"), target, surface: "build", threadKey: "test", capturedAt: "now", hasProjects: true };
  const option = navigationOptions(context).find(option => option.id === "work:storefront-app"); assert.equal(option.destination.surface, "alm");
  const legacy = { ...option, destination: { ...option.destination, surface: "build" } }, bytes = JSON.stringify(legacy);
  const action = resolveNavigationCall([legacy], { id: "toolu_legacy", name: "open_canvas", input: { destinationId: legacy.id } });
  assert.equal(action.destination.surface, "build"); assert.equal(navigationMatchesContext(action, context), true);
  assert.equal(navigationMatchesContext({ ...action, destination: { ...action.destination, target: { ...target, orgId: "uat" } } }, context), false);
  assert.equal(JSON.stringify(legacy), bytes);
});
