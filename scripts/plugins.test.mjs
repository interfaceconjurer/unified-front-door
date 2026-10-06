import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { PLUGINS, PLUGIN_IDS, ALM_STAGES, capabilityCatalog, pluginForCanvas, viewCapability, PluginInstallStore } = modules.load('lib/plugins/catalog');
const { SURFACE_IDS } = modules.load('lib/workspace/surfaces');
const { capabilitiesForSurface } = modules.load('lib/surface-canvas/capabilities');
const { demoProfileById } = modules.load('lib/demo-profiles');
const { SurfaceCanvasStore, emptyState, workbenchViews, overviewViewId } = modules.load('lib/surface-canvas/persistence');
const { canvasId } = modules.load('lib/surface-canvas/model');
afterEach(() => { delete global.window; });
function browser(values = {}) {
  const data = new Map(Object.entries(values));
  global.window = { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }, addEventListener() {}, removeEventListener() {} };
  return data;
}

test('the four surfaces are first-party plugins with unchanged ids and versioned package details', () => {
  assert.deepEqual(PLUGIN_IDS, SURFACE_IDS);
  assert.deepEqual(PLUGIN_IDS.map(id => PLUGINS[id].name), ['Build & Setup', 'Code', 'Govern & Observe', 'ALM']);
  for (const id of PLUGIN_IDS) for (const key of ['name', 'publisher', 'version', 'description']) assert.equal(typeof PLUGINS[id][key], 'string', `${id}.${key}`);
});

test('every existing capability keeps its identity, gains stage tags, and each plugin contributes an overview', () => {
  const catalog = capabilityCatalog(['build', 'code', 'govern', 'alm']);
  for (const plugin of PLUGIN_IDS) {
    const ids = catalog.filter(item => item.plugin === plugin).map(item => item.capability);
    assert.deepEqual(ids, ['overview', ...capabilitiesForSurface(plugin).map(capability => capability.id)]);
  }
  for (const item of catalog) {
    assert(item.stages.length > 0, `${item.plugin}:${item.capability} has stages`);
    assert(item.stages.every(stage => ALM_STAGES.includes(stage)));
    assert.equal(typeof item.name, 'string'); assert.equal(typeof item.description, 'string');
  }
  const agents = catalog.filter(item => item.capability === 'agent');
  assert.deepEqual(agents.map(item => item.plugin), ['build', 'code'], 'Same capability id in two plugins stays distinct');
  assert.deepEqual(catalog.filter(item => item.stages.includes('testing')).map(item => item.name), ['Create & run tests', 'Validate a change']);
});

test('capability catalog follows plugin access and installation', () => {
  const karen = demoProfileById('kf');
  assert.deepEqual([...new Set(capabilityCatalog(karen.surfaceAccess).map(item => item.plugin))], ['build', 'alm']);
  assert.deepEqual([...new Set(capabilityCatalog(['build', 'code', 'alm']).map(item => item.plugin))], ['build', 'code', 'alm']);
});

test('every view kind names its plugin and capability', () => {
  const scope = { scope: 'unbound' };
  const cases = [
    [{ kind: 'capability', title: 'x', params: { ...scope, surface: 'code', capability: 'apex' } }, 'code', 'Write Apex'],
    [{ kind: 'capability', title: 'x', params: { ...scope, surface: 'build', capability: 'object-manager' } }, 'build', 'Object Manager'],
    [{ kind: 'org-resource', title: 'x', params: { orgId: 'uat', resourceType: 'apex-class', apiName: 'A' } }, 'code', 'Browse org resources'],
    [{ kind: 'org-resource', title: 'x', params: { orgId: 'uat', resourceType: 'report', apiName: 'R' } }, 'govern', 'Browse org resources'],
    [{ kind: 'org-assessment', title: 'x', params: scope }, 'build', 'Assess your org'],
    [{ kind: 'work-item-change', title: 'x', params: { projectId: 'p', workItemId: 'w' } }, 'build', 'Change a work item'],
    [{ kind: 'preview', title: 'x', params: { projectId: 'p', worktreeId: 'w' } }, 'build', 'Preview project'],
    [{ kind: 'app', title: 'x', params: { projectId: 'p', appId: 'a' } }, 'alm', 'Deployed app'],
    [{ kind: 'improvement-project', title: 'x', params: { projectId: 'p' } }, 'alm', 'Project plan'],
  ];
  for (const [canvas, plugin, capability] of cases) {
    assert.equal(pluginForCanvas('build', canvas), plugin, canvas.kind);
    assert.equal(viewCapability(plugin, canvas), capability, canvas.kind);
  }
  assert.equal(viewCapability('alm', undefined), 'ALM overview');
});

test('install state is simulated per profile, limited to accessible plugins, and survives reload', () => {
  const data = browser();
  const store = new PluginInstallStore('ufd.plugins.test', ['build', 'alm']);
  assert.deepEqual(store.installed(), ['build', 'alm']);
  store.uninstall('alm'); assert.deepEqual(store.installed(), ['build']);
  assert.equal(store.install('code'), false, 'Inaccessible plugins cannot be installed');
  assert.deepEqual(new PluginInstallStore('ufd.plugins.test', ['build', 'alm']).installed(), ['build']);
  assert.equal(store.install('alm'), true); assert.deepEqual(store.installed(), ['build', 'alm']);
  assert(data.has('ufd.plugins.test'));
  // Access still bounds stored state if a profile loses a plugin.
  assert.deepEqual(new PluginInstallStore('ufd.plugins.test', ['build']).installed(), ['build']);
});

test('workbench order spans plugins, is derived for legacy per-surface tabs, and keeps canonical ids', () => {
  const data = browser();
  const automation = { kind: 'capability', title: 'Build an automation', params: { scope: 'unbound', surface: 'build', capability: 'automation' } };
  const apex = { kind: 'capability', title: 'Write Apex', params: { scope: 'unbound', surface: 'code', capability: 'apex' } };
  const legacy = emptyState();
  legacy.code = { ...legacy.code, canvases: [{ ...apex, id: canvasId(apex.kind, apex.params) }], activeCanvasId: canvasId(apex.kind, apex.params) };
  legacy.build = { ...legacy.build, canvases: [{ ...automation, id: canvasId(automation.kind, automation.params), draft: { name: 'Kept' } }] };
  data.set('ufd.wb.test', JSON.stringify({ __ufd: 1, data: legacy }));
  const store = new SurfaceCanvasStore('ufd.wb.test');
  const derived = workbenchViews(store.getSnapshot());
  assert.deepEqual(derived.views, [canvasId(automation.kind, automation.params), canvasId(apex.kind, apex.params)], 'Legacy slices derive plugin order, then tab order');
  assert.equal(store.getSnapshot().build.canvases[0].draft.name, 'Kept');
  // Opening moves nothing; it appends across plugins and focuses one active view.
  store.openCanvas('alm', { kind: 'capability', title: 'Plan your work', params: { scope: 'unbound', surface: 'alm', capability: 'work' } });
  const next = workbenchViews(store.getSnapshot());
  assert.equal(next.views.length, 3); assert.equal(next.active, next.views[2]);
  store.openOverview('govern');
  assert.equal(workbenchViews(store.getSnapshot()).active, overviewViewId('govern'));
  store.closeView(overviewViewId('govern'));
  assert(!workbenchViews(store.getSnapshot()).views.includes(overviewViewId('govern')));
  store.closeCanvas('build', canvasId(automation.kind, automation.params));
  assert.equal(store.getSnapshot().build.closedDrafts[canvasId(automation.kind, automation.params)].name, 'Kept', 'Closing a view keeps its draft');
  assert(!workbenchViews(store.getSnapshot()).views.includes(canvasId(automation.kind, automation.params)));
  // The persisted form keeps per-plugin slices so older builds can still read it.
  const persisted = JSON.parse(data.get('ufd.wb.test')).data;
  assert.equal(persisted.code.canvases[0].id, canvasId(apex.kind, apex.params));
  assert(Array.isArray(persisted.workbench.views));
});

test('stored workbench order survives reload, drops views that are no longer open, and appends new tabs', () => {
  const data = browser();
  const apex = { kind: 'capability', title: 'Write Apex', params: { scope: 'unbound', surface: 'code', capability: 'apex' } };
  const work = { kind: 'capability', title: 'Plan your work', params: { scope: 'unbound', surface: 'alm', capability: 'work' } };
  const store = new SurfaceCanvasStore('ufd.wb.order');
  store.openCanvas('code', apex); store.openOverview('build'); store.openCanvas('alm', work);
  const ids = [canvasId(apex.kind, apex.params), overviewViewId('build'), canvasId(work.kind, work.params)];
  assert.deepEqual(workbenchViews(store.getSnapshot()).views, ids);
  // Another build (or older release) removes a tab behind our back; order stays coherent.
  const raw = JSON.parse(data.get('ufd.wb.order'));
  raw.data.alm.canvases = [];
  raw.data.code.canvases.push({ kind: 'capability', title: 'Query your data', params: { scope: 'unbound', surface: 'code', capability: 'query' }, id: canvasId('capability', { scope: 'unbound', surface: 'code', capability: 'query' }) });
  data.set('ufd.wb.order', JSON.stringify(raw));
  const reloaded = workbenchViews(new SurfaceCanvasStore('ufd.wb.order').getSnapshot());
  assert.deepEqual(reloaded.views, [ids[0], ids[1], canvasId('capability', { scope: 'unbound', surface: 'code', capability: 'query' })]);
  assert.equal(reloaded.active, null, 'An active view that is no longer open is not selected');
});

test('an unreadable workbench field never discards per-plugin tabs', () => {
  const data = browser();
  const apex = { kind: 'capability', title: 'Write Apex', params: { scope: 'unbound', surface: 'code', capability: 'apex' } };
  const state = emptyState();
  state.code = { ...state.code, canvases: [{ ...apex, id: canvasId(apex.kind, apex.params) }] };
  data.set('ufd.wb.bad', JSON.stringify({ __ufd: 1, data: { ...state, workbench: { views: 'not-a-list', active: 3 } } }));
  const store = new SurfaceCanvasStore('ufd.wb.bad');
  assert.equal(store.getPersistenceSnapshot(), 'saved');
  assert.deepEqual(workbenchViews(store.getSnapshot()).views, [canvasId(apex.kind, apex.params)]);
});
