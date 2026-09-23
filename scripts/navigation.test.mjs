import test, { afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup);
const { resolveWorkspace, UNBOUND_TARGET } = modules.load("lib/workspace/context");
const { NavigationController, destinationHref, readDestination, canvasTarget, canvasDestination, destinationCanvasTarget, resolveDestination, destinationIdentity } = modules.load("lib/navigation/model");
const { canvasId, parseCanvasInput, canvasVisibleInWorkspace } = modules.load("lib/surface-canvas/model");
const { SurfaceCanvasStore } = modules.load("lib/surface-canvas/persistence");
const { preferencesForWorkspace } = modules.load("lib/surface-canvas/workspace-preferences");
const { WorkspaceSelectionStore } = modules.load("lib/workspace/persistence");
const { PROJECTS, ORGS } = modules.load("lib/workspace/fixtures");
const { signInDestination } = modules.load("lib/navigation/sign-in");
const { connectedOrgForProfile, orgsForProfile } = modules.load("lib/workspace/orgs");
afterEach(() => { delete global.window; });
function browser(values = {}) { const data = new Map(Object.entries(values)); global.window = { localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }, addEventListener() {}, removeEventListener() {} }; return data; }
const project = PROJECTS[0], worktree = project.worktrees[0];
const ready = { projectId: project.id, worktreeId: worktree.id, orgId: project.defaultOrgId };
const capability = (scope = { scope: "unbound" }) => ({ kind: "capability", title: "Write Apex", params: { surface: "code", capability: "apex", ...scope } });
const destination = (canvas = capability(), target = UNBOUND_TARGET, surface = "code") => ({ version: 1, owner: "am", surface, target, canvas });

test('browsing a project record preserves the selected org while retaining its captured plan environment', () => {
  const { canvasDestination, destinationCanvasTarget } = modules.load('lib/navigation/model');
  const canvas = { kind: 'improvement-project', title: 'Saved plan', params: { projectId: 'plan' } };
  const captured = { projectId: 'plan', worktreeId: null, orgId: 'sit' };
  for (const workspace of [{ ...captured, orgId: 'uat' }, { projectId: null, worktreeId: null, orgId: 'uat' }]) {
    const result = canvasDestination('sp', 'alm', canvas, captured, workspace);
    assert.deepEqual(result.target, workspace);
    assert.deepEqual(destinationCanvasTarget(result), captured);
    assert.deepEqual(readDestination(destinationHref(result)).value, result);
  }
});

test("sign-in preserves matching deep links without retargeting saved canvases to another org or profile", () => {
  const target = { ...UNBOUND_TARGET, orgId: 'uat' };
  const work = destination(capability({ scope: 'unbound', orgId: 'uat' }), target);
  const href = destinationHref(work);
  assert.equal(signInDestination('am', 'uat', href), href);
  const elsewhere = readDestination(signInDestination('am', 'sit', href)).value;
  assert.deepEqual(elsewhere.target, { ...UNBOUND_TARGET, orgId: 'sit' });
  assert.equal(elsewhere.surface, null); assert.equal(elsewhere.canvas, undefined);
  assert.equal(readDestination(signInDestination('kf', 'uat', href)).value.owner, 'kf');
  const overview = { version: 1, owner: 'am', surface: 'build', target: UNBOUND_TARGET };
  assert.deepEqual(readDestination(signInDestination('am', 'uat', destinationHref(overview))).value, { ...overview, target });
  assert.equal(readDestination(signInDestination('am', 'uat', 'https://example.com')).value.surface, null);
});

test("every profile has a connected starting org; unavailable preferences never become selected connections", () => {
  for (const id of ['sp', 'jw', 'am', 'kf']) {
    assert.equal(connectedOrgForProfile(id).connection, 'connected');
    assert.equal(connectedOrgForProfile(id, 'scratch-hotfix').connection, 'connected');
    assert.equal(connectedOrgForProfile(id, 'sit').id, 'sit');
  }
  assert(!orgsForProfile('sp').some(org => org.id === 'acme-devhub'));
});

test("fresh profile epochs start on Today while existing profiles resume their own last view", () => {
  browser();
  for (const owner of ['sp', 'kf', 'jw', 'am']) {
    const store = new WorkspaceSelectionStore(`profile-${owner}-epoch-one`);
    const initial = readDestination(signInDestination(owner, 'uat', null, store.getSnapshot().lastDestination)).value;
    assert.equal(initial.surface, null);
    assert.deepEqual(initial.target, { ...UNBOUND_TARGET, orgId: 'uat' });
    assert.equal(store.getSnapshot().panelOpen ?? false, false);
    const last = { ...initial, surface: 'build', canvas: { kind: 'org-resource', title: 'Account', params: { orgId: 'uat', resourceType: 'standard-object', apiName: 'Account' } } };
    store.rememberDestination(last); store.setPanelOpen(true); store.setSurfacePanelOpen(false);
    const restored = new WorkspaceSelectionStore(`profile-${owner}-epoch-one`).getSnapshot();
    assert.equal(signInDestination(owner, 'uat', null, restored.lastDestination), destinationHref(last));
    assert.equal(restored.panelOpen, true); assert.equal(restored.surfacePanelOpen, false);
    const cleared = new WorkspaceSelectionStore(`profile-${owner}-epoch-two`).getSnapshot();
    assert.equal(cleared.lastDestination, undefined); assert.equal(cleared.panelOpen ?? false, false);
    assert.equal(readDestination(signInDestination(owner, 'uat', null, cleared.lastDestination)).value.surface, null);
  }
});

test("explicit sign-in targets override remembered views; mismatched org/profile and removed access never resume", () => {
  const saved = destinationHref(destination(capability({ scope: 'unbound', orgId: 'uat' }), { ...UNBOUND_TARGET, orgId: 'uat' }));
  const explicit = destinationHref({ version: 1, owner: 'am', surface: 'alm', target: { ...UNBOUND_TARGET, orgId: 'uat' } });
  assert.equal(signInDestination('am', 'uat', explicit, saved), explicit);
  assert.equal(readDestination(signInDestination('am', 'sit', null, saved)).value.surface, null);
  assert.equal(readDestination(signInDestination('kf', 'uat', null, saved)).value.surface, null);
  const oldJordanCode = saved.replace('am', 'jw');
  assert.equal(readDestination(signInDestination('jw', 'uat', null, oldJordanCode)).value.surface, null);
});

test("shared legacy tabs split into independent workspace preferences without losing drafts or changing the original", () => {
  browser(); const legacy = new SurfaceCanvasStore("legacy-tabs");
  const global = capability({ scope: "unbound", orgId: "prod" });
  const own = capability({ scope: "project", projectId: ready.projectId, worktreeId: ready.worktreeId, orgId: ready.orgId });
  const otherBranch = capability({ scope: "project", projectId: ready.projectId, worktreeId: "other", orgId: ready.orgId });
  for (const input of [global, own, otherBranch]) {
    const id = canvasId(input.kind, input.params);
    legacy.openCanvas("code", input); legacy.captureTarget("code", id, canvasTarget(input, UNBOUND_TARGET));
    legacy.updateDraft("code", id, { source: id });
  }
  legacy.closeCanvas("code", canvasId(otherBranch.kind, otherBranch.params));
  const before = structuredClone(legacy.getSnapshot());
  const home = preferencesForWorkspace(before, UNBOUND_TARGET), project = preferencesForWorkspace(before, ready);
  assert.deepEqual(home.code.canvases.map(c => c.id), [canvasId(global.kind, global.params)]);
  assert.equal(home.code.activeCanvasId, "overview");
  assert.deepEqual(project.code.canvases.map(c => c.id), [canvasId(own.kind, own.params)]);
  assert.equal(project.code.activeCanvasId, canvasId(own.kind, own.params));
  assert.equal(project.code.canvases[0].draft.source, canvasId(own.kind, own.params));
  assert.deepEqual(preferencesForWorkspace(before, { ...ready, worktreeId: "other" }).code.closedDrafts, before.code.closedDrafts);
  const homeStore = new SurfaceCanvasStore("home-tabs", home), projectStore = new SurfaceCanvasStore("project-tabs", project);
  homeStore.openCanvas("code", own); homeStore.closeCanvas("code", canvasId(own.kind, own.params));
  assert.equal(projectStore.getSnapshot().code.activeCanvasId, canvasId(own.kind, own.params));
  assert.deepEqual(legacy.getSnapshot(), before);
  assert.deepEqual(new SurfaceCanvasStore("home-tabs").getSnapshot(), homeStore.getSnapshot());
});

test("preview identity captures project, worktree and org while global inspection retains global scope", () => {
  browser();
  const { previewCanvas } = modules.load("lib/preview/model");
  const input = previewCanvas("trailblazer-crm", "lead-routing", "uat");
  const captured = { projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" };
  const global = { ...UNBOUND_TARGET, orgId: "prod" };
  const browsing = canvasDestination("am", "code", input, captured, global);
  assert.equal(browsing.surface, "build");
  assert.deepEqual(browsing.target, global);
  assert.deepEqual(destinationCanvasTarget(browsing), captured);
  assert.deepEqual(readDestination(destinationHref(browsing)), { kind: "destination", value: browsing });
  assert.equal(resolveDestination(destinationHref(browsing), "am", ["build"], {}).kind, "available");
  assert.notEqual(canvasId(input.kind, input.params), canvasId(input.kind, { ...input.params, orgId: "sit" }));
  assert.notEqual(canvasId(input.kind, input.params), canvasId(input.kind, { ...input.params, worktreeId: "main" }));
  assert.equal(canvasVisibleInWorkspace(input, { ...captured, worktreeId: "main" }), false);
  const store = new SurfaceCanvasStore("preview-tabs");
  store.openCanvas("build", input); store.captureTarget("build", canvasId(input.kind, input.params), captured);
  const restored = new SurfaceCanvasStore("preview-tabs").getSnapshot().build;
  assert.equal(restored.canvases[0].kind, "preview");
  assert.deepEqual(restored.targets[restored.canvases[0].id], captured);
});

test("unavailable previews and preview mutations are rejected", () => {
  const { previewCanvas } = modules.load("lib/preview/model");
  const { parseCommand } = modules.load("lib/application/contracts");
  const input = previewCanvas("trailblazer-crm", "main", "uat");
  for (const params of [{ ...input.params, projectId: "gone" }, { ...input.params, worktreeId: "gone" }, { ...input.params, orgId: "scratch-hotfix" }]) {
    const invalid = { ...input, params };
    assert.equal(resolveDestination(destinationHref(destination(invalid, canvasTarget(invalid, UNBOUND_TARGET), "build")), "am", ["build"], {}).kind, "unavailable");
  }
  const scoped = destination(input, canvasTarget(input, UNBOUND_TARGET), "build");
  assert.equal(resolveDestination(destinationHref({ ...scoped, owner: "sp" }), "sp", ["build"], {}).kind, "unavailable");
  assert.equal(parseCanvasInput({ ...input, params: { projectId: "trailblazer-crm" } }), null);
  assert.throws(() => parseCommand({ kind: "canvas.save", canvas: input, target: scoped.target, surface: "build", fields: { source: "mutation" }, commandId: "preview-save", expectedRevision: 0 }));
});

test("global canvas browsing roundtrips separate ownership without changing project resume or draft targets", () => {
  browser();
  const selection = new WorkspaceSelectionStore("global-browsing"), store = new SurfaceCanvasStore("global-canvas");
  const input = capability({ scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: ready.orgId });
  const id = canvasId(input.kind, input.params), original = destination(input, ready);
  selection.rememberDestination(original);
  store.openCanvas("code", input); store.captureTarget("code", id, ready); store.updateDraft("code", id, { source: "Owned project draft" });
  const global = { ...UNBOUND_TARGET, orgId: "uat" };
  const browsing = canvasDestination("am", "code", input, ready, global);
  assert.deepEqual(browsing.target, global);
  assert.deepEqual(destinationCanvasTarget(browsing), ready);
  assert.deepEqual(readDestination(destinationHref(browsing)), { kind: "destination", value: browsing });
  assert.equal(resolveDestination(destinationHref(browsing), "am", ["code"], store.getSnapshot()).kind, "available");
  selection.rememberDestination(browsing); selection.setTarget(browsing.target);
  assert.deepEqual(selection.destinationFor("am", project.id, worktree.id), original);
  assert.deepEqual(store.getSnapshot().code.targets[id], ready);
  assert.equal(store.getSnapshot().code.canvases[0].draft.source, "Owned project draft");
  assert.notEqual(destinationIdentity(browsing), destinationIdentity(original));
  assert.deepEqual(canvasDestination("am", "code", input, ready, ready), original, "Explicit project selection keeps the legacy destination");
  // A work canvas has stable identity independent of its captured org.
  const work = { kind: "work", title: "Lead routing", params: { workId: "lead-routing-agent", projectId: "trailblazer-crm", worktreeId: "lead-routing" } };
  const workTarget = { projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" };
  const workView = canvasDestination("am", "build", work, workTarget, global);
  const saved = { build: { targets: { [canvasId(work.kind, work.params)]: workTarget } } };
  assert.equal(resolveDestination(destinationHref(workView), "am", ["build"], saved).kind, "available");
  assert.equal(resolveDestination(destinationHref({ ...workView, canvasTarget: { ...workTarget, orgId: "prod" } }), "am", ["build"], saved).kind, "unavailable", "Global browsing cannot retarget a saved canvas");
});

test("separate canvas ownership cannot weaken project isolation or appear on a bare surface", () => {
  const input = capability({ scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: ready.orgId });
  const valid = canvasDestination("am", "code", input, ready, UNBOUND_TARGET);
  for (const bad of [
    { ...valid, target: ready },
    { ...valid, canvas: undefined },
    { ...valid, canvasTarget: null },
    { ...valid, canvasTarget: UNBOUND_TARGET },
    { ...valid, canvasTarget: { ...ready, projectId: "another-project" } },
  ]) {
    const href = `/code?destination=${encodeURIComponent(JSON.stringify(bad))}`;
    assert.equal(readDestination(href).kind, "invalid");
  }
});

test("project tab projection excludes global, other-project and other-worktree canvases without discarding drafts", () => {
  browser(); const store = new SurfaceCanvasStore("scoped-tabs");
  const own = capability({ scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: ready.orgId });
  const other = { kind: "work", title: "Other work", params: { workId: "other-work", projectId: "another-project", worktreeId: "main" } };
  const global = capability();
  const branch = capability({ scope: "project", projectId: project.id, worktreeId: "another-branch", orgId: ready.orgId });
  const projectWide = capability({ scope: "project", projectId: project.id, orgId: ready.orgId });
  for (const input of [own, other, global, branch, projectWide]) { store.openCanvas("code", input); store.updateDraft("code", canvasId(input.kind, input.params), { notes: input.title }); }
  const snapshot = store.getSnapshot().code;
  const visible = snapshot.canvases.filter(canvas => canvasVisibleInWorkspace(canvas, ready, snapshot.targets?.[canvas.id]));
  assert.deepEqual(visible.map(canvas => canvas.id), [canvasId(own.kind, own.params), canvasId(projectWide.kind, projectWide.params)]);
  assert.equal(canvasVisibleInWorkspace({ id: "overview", kind: "overview", title: "Overview" }, ready), true);
  assert.equal(snapshot.canvases.filter(canvas => canvasVisibleInWorkspace(canvas, UNBOUND_TARGET)).length, 5);
  assert.equal(canvasVisibleInWorkspace(branch, { ...ready, worktreeId: null }), false, "No selected worktree must not expose branch-specific files");
  assert.equal(store.getSnapshot().code, snapshot);
  assert.equal(new SurfaceCanvasStore("scoped-tabs").getSnapshot().code.canvases.find(canvas => canvas.id === canvasId(other.kind, other.params)).draft.notes, other.title);
});

test("project-wide resources preserve the selected worktree without changing saved ownership", () => {
  browser(); const store = new SurfaceCanvasStore("project-wide-app");
  const input = { kind: "app", title: "Project app", params: { projectId: project.id, appId: project.apps[0].id } };
  const captured = { ...ready, worktreeId: null }, id = canvasId(input.kind, input.params);
  store.openCanvas("alm", input); store.captureTarget("alm", id, captured);
  const browsing = canvasDestination("am", "alm", input, captured, ready);
  assert.deepEqual(browsing.target, ready);
  assert.deepEqual(destinationCanvasTarget(browsing), captured);
  assert.deepEqual(readDestination(destinationHref(browsing)), { kind: "destination", value: browsing });
  assert.equal(resolveDestination(destinationHref(browsing), "am", ["alm"], store.getSnapshot()).kind, "available");
  assert.equal(canvasVisibleInWorkspace(input, ready, captured), true);
  assert.equal(readDestination(destinationHref({ ...browsing, target: { ...ready, projectId: "other-project" } })).kind, "invalid");
  assert.equal(resolveDestination(destinationHref({ ...browsing, canvasTarget: { ...captured, orgId: "prod" } }), "am", ["alm"], store.getSnapshot()).kind, "unavailable");
  assert.deepEqual(store.getSnapshot().alm.targets[id], captured);
});

test("Home leaves the project but retains its org, and org selection does not split global chat", () => {
  const { conversationKey, homeTarget } = modules.load("lib/workspace/context");
  const home = homeTarget(ready);
  assert.deepEqual(home, { projectId: null, worktreeId: null, orgId: ready.orgId });
  assert.equal(conversationKey(home), conversationKey(UNBOUND_TARGET));
  assert.equal(conversationKey({ ...home, orgId: "prod" }), conversationKey(home));
  assert.notEqual(conversationKey(ready), conversationKey(home));
  const input = capability({ scope: "unbound", orgId: "uat" });
  assert.deepEqual(canvasTarget(parseCanvasInput(input), UNBOUND_TARGET), { ...UNBOUND_TARGET, orgId: "uat" });
  assert.notEqual(canvasId(input.kind, input.params), canvasId(input.kind, { ...input.params, orgId: "prod" }), "global drafts still capture separate execution targets");
  assert.equal(readDestination(destinationHref(destination(input, { ...UNBOUND_TARGET, orgId: "uat" }))).kind, "destination");
});

test("project resume retains separate worktree destinations through Home and reload without storing drafts", () => {
  const storage = browser(), store = new WorkspaceSelectionStore("resume");
  const first = destination({ ...capability({ scope: "project", projectId: project.id, worktreeId: worktree.id, orgId: ready.orgId }), draft: { source: "PRIVATE SOURCE" } }, ready);
  const other = { version: 1, owner: "am", surface: "build", target: { ...ready, worktreeId: "other" } };
  store.rememberDestination(first); store.rememberDestination(other);
  store.rememberDestination({ version: 1, owner: "am", surface: null, target: UNBOUND_TARGET });
  store.setTarget(UNBOUND_TARGET);
  const restored = new WorkspaceSelectionStore("resume");
  assert.equal(restored.destinationFor("am", project.id, worktree.id).canvas.params.capability, "apex");
  assert.deepEqual(restored.destinationFor("am", project.id, "other"), other);
  assert.equal(restored.destinationFor("jw", project.id, worktree.id), null);
  assert.equal(restored.destinationFor("am", "another-project", worktree.id), null);
  assert.equal(storage.get("resume").includes("PRIVATE SOURCE"), false);
  assert.deepEqual(restored.getSnapshot().target, UNBOUND_TARGET);
});

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
  const restored = new SurfaceCanvasStore("canvas"); assert.deepEqual(restored.getSnapshot().alm.targets[id], target);
  assert.equal(restored.captureTarget("build", id, { ...target, orgId: "other-org" }), false);
  restored.openCanvas("build", input); assert.deepEqual(restored.getSnapshot().alm.targets[id], target); assert.equal(restored.getSnapshot().alm.canvases[0].draft.notes, "keep");
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
  const value = destination(input, target, "build"), id = canvasId(input.kind, input.params), state = { alm: { targets: { [id]: target } } };
  const allowed = resolveDestination(destinationHref(value), "am", ["alm", "code"], state); assert.equal(allowed.kind, "available");
  for (const changed of [{ ...value, target: { ...target, orgId: "other" } }, { ...value, owner: "jw" }]) {
    const result = resolveDestination(destinationHref(changed), "am", ["alm", "code"], state);
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
  controller.restore(destinationHref(original)); assert.equal(store.getSnapshot().alm.targets[id], undefined);
  controller.navigate({ version: 1, owner: "am", surface: "build", target: { ...original.target, orgId: "sit" } });
  assert.deepEqual(events, ["restore", "capture", "navigation"]); assert.equal(store.getSnapshot().alm.targets[id].orgId, "uat");
  assert.equal(store.getSnapshot().alm.activeCanvasId, "overview"); assert.equal(store.getSnapshot().alm.canvases.length, 0);
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
