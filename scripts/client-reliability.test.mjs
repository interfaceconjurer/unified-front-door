import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { RemoteWorkspaceStore, EMPTY_APPLICATION } = modules.load('lib/application/remote-store');
const { ApplicationError } = modules.load('lib/application/contracts');
const { canvasId } = modules.load('lib/surface-canvas/model');
const { SurfaceCanvasStore, emptyState } = modules.load('lib/surface-canvas/persistence');
const { projectCanvases } = modules.load('lib/surface-canvas/projection');
const { NavigationController } = modules.load('lib/navigation/model');
const { applyAssessmentCommand } = modules.load('lib/application/assessment-commands');
const { AssessmentStore } = modules.load('lib/onboarding/persistence');
const { applicationClient } = modules.load('lib/application/client');
const session = { namespaceId: 'phase6-test', profileId: 'sp', generation: 'generation', workspaceEpoch: 'epoch', expiresAt: '2099-01-01' };
const canvas = { kind: 'capability', title: 'Automation', params: { scope: 'unbound', surface: 'build', capability: 'automation' } };
const target = { projectId: null, worktreeId: null, orgId: null };
const save = fields => ({ kind: 'canvas.save', surface: 'build', canvas, target, fields });
const snapshot = () => structuredClone({ ...EMPTY_APPLICATION, session });
function browser() {
  const disk = new Map(), listeners = new Map();
  global.window = { localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) }, addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: (event) => listeners.delete(event), dispatchEvent() {} };
  return { disk, listeners };
}
function gate() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function remote() {
  let saved = snapshot(); const sent = [];
  const transport = { read: async () => structuredClone(saved), send: async (_session, command) => {
    sent.push(structuredClone(command));
    const id = canvasId(command.canvas.kind, command.canvas.params), old = saved.canvases.find(item => item.id === id);
    assert.equal(command.expectedRevision, old?.revision ?? 0);
    saved = { ...saved, canvases: [...saved.canvases.filter(item => item.id !== id), { id, canvas: command.canvas, target: command.target, surface: command.surface, fields: { ...old?.fields, ...command.fields }, revision: (old?.revision ?? 0) + 1 }] };
    return { revision: (old?.revision ?? 0) + 1 };
  } };
  const store = new RemoteWorkspaceStore(session, transport, 'pending', () => {});
  return { store, transport, sent, saved: () => saved };
}

test('workspace tab stores separate views while sharing one remote draft and one global scope across orgs', async () => {
  browser(); const r = remote(); await r.store.load();
  const client = new applicationClient.constructor(); client.workspace = r.store;
  const home = client.canvasStoreFor(target), projectTarget = { projectId: 'crm', worktreeId: 'main', orgId: 'uat' };
  const project = client.canvasStoreFor(projectTarget), branch = client.canvasStoreFor({ ...projectTarget, worktreeId: 'feature' });
  try {
    assert.equal(client.canvasStoreFor({ ...target, orgId: 'prod' }), home);
    assert.equal(client.canvasStoreFor({ ...projectTarget, orgId: 'prod' }), project);
    assert.notEqual(home, project); assert.notEqual(project, branch);
    const input = { ...canvas, params: { ...canvas.params, scope: 'project', ...projectTarget } }, id = canvasId(input.kind, input.params);
    project.openCanvas('build', input);
    assert.equal(home.getSnapshot().build.canvases.length, 0);
    assert.equal(branch.getSnapshot().build.canvases.length, 0);
    home.openCanvas('build', input);
    await r.store.enqueue({ ...save({ notes: 'One saved file' }), canvas: input, target: projectTarget });
    assert.equal(home.getSnapshot().build.canvases[0].draft.notes, 'One saved file');
    assert.equal(project.getSnapshot().build.canvases[0].draft.notes, 'One saved file');
    home.closeCanvas('build', id);
    assert.equal(project.getSnapshot().build.activeCanvasId, id);
    assert.equal(project.getSnapshot().build.canvases.length, 1);
    assert.equal(home.getSnapshot().build.canvases.length, 0);
  } finally { for (const store of [home, project, branch]) store.dispose(); r.store.deactivate(); }
});

test('100 edits synchronously buffer the latest fields, coalesce one request and resolve every caller only after ACK', async () => {
  const { disk } = browser(), r = remote(); await r.store.load();
  const promises = Array.from({ length: 100 }, (_, i) => r.store.enqueueEdit(save({ source: `edit ${i}` })));
  assert.ok(promises.every(result => result === promises[0]));
  assert.equal(r.sent.length, 0); assert.equal(r.store.getPersistenceSnapshot(), 'unsaved');
  const buffered = JSON.parse(disk.get('pending'));
  assert.equal(buffered.commands.length, 1); assert.equal(buffered.commands[0].fields.source, 'edit 99');
  assert.equal(r.store.getSnapshot().canvases[0].fields.source, 'edit 99');
  r.store.flushEdits(); const results = await Promise.all(promises);
  assert.equal(results.length, 100); assert.ok(results.every(result => result?.revision === 1));
  assert.equal(r.sent.length, 1); assert.equal(r.saved().canvases[0].fields.source, 'edit 99');
  assert.equal(r.store.getPersistenceSnapshot(), 'saved'); assert.equal(disk.has('pending'), false); r.store.deactivate();
});

test('reload before dispatch preserves the last edit and restored commands never coalesce with new input', async () => {
  const { disk } = browser(), first = remote(); await first.store.load();
  void first.store.enqueueEdit(save({ notes: 'saved before any network request' })); const raw = disk.get('pending'); first.store.deactivate();
  const next = remote(); await next.store.load();
  void next.store.enqueueEdit(save({ notes: 'new browser edit' }));
  assert.equal(next.store.getPending().length, 2);
  assert.deepEqual(next.store.getPending()[0], JSON.parse(raw).commands[0]);
  next.store.flushEdits(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(next.sent.length, 2); assert.equal(next.saved().canvases[0].fields.notes, 'new browser edit'); next.store.deactivate();
});

test('continuous typing dispatches by one second and focus/pagehide explicitly flush without waiting', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const { listeners } = browser(), r = remote(); await r.store.load();
  const promises = [];
  for (let i = 0; i < 10; i++) { promises.push(r.store.enqueueEdit(save({ notes: String(i) }))); t.mock.timers.tick(100); }
  assert.equal(r.sent.length, 1); await Promise.all(promises);
  const focus = r.store.enqueueEdit(save({ notes: 'blur flush' })); listeners.get('focusout')(); await focus;
  const hide = r.store.enqueueEdit(save({ notes: 'pagehide flush' })); listeners.get('pagehide')(); await hide;
  assert.equal(r.sent.length, 3); assert.equal(r.saved().canvases[0].fields.notes, 'pagehide flush'); r.store.deactivate();
});

test('failed storage retains latest coalesced fields in memory and retry restores the exact pending envelope', async () => {
  browser(); const r = remote(); await r.store.load();
  window.localStorage.setItem = () => { throw new Error('storage unavailable'); };
  void r.store.enqueueEdit(save({ source: 'memory one' })); void r.store.enqueueEdit(save({ source: 'memory latest' }));
  assert.equal(r.store.getPersistenceSnapshot(), 'unsaved'); assert.equal(r.store.hasBufferFailure(), true);
  assert.match(r.store.pendingLocation(), /only in this tab/); assert.equal(r.store.getPending()[0].fields.source, 'memory latest');
  let buffered; window.localStorage.setItem = (_key, raw) => { buffered = raw; };
  r.store.retryPersistence(); assert.equal(JSON.parse(buffered).commands[0].fields.source, 'memory latest');
  r.store.flushEdits(); await new Promise(resolve => setImmediate(resolve)); assert.equal(r.store.getPersistenceSnapshot(), 'saved'); r.store.deactivate();
});

test('a dispatched unknown request stays byte-identical and newer edits get a distinct tail identity', async () => {
  browser(); const r = remote(); await r.store.load();
  r.transport.send = async (_session, command) => { r.sent.push(structuredClone(command)); throw new Error('lost ACK'); };
  const first = r.store.enqueueEdit(save({ source: 'first' })); r.store.flushEdits(); await first;
  const original = structuredClone(r.store.getPending()[0]); void r.store.enqueueEdit(save({ source: 'second' }));
  assert.deepEqual(r.store.getPending()[0], original); assert.equal(r.store.getPending().length, 2);
  r.store.retryPersistence(); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(r.sent[1], original); r.store.deactivate();
});

test('discard freezes clicked coalescible commands so input typed during the read is preserved (P6-R1)', async () => {
  browser(); const r = remote(); await r.store.load();
  r.transport.send = async () => { throw new ApplicationError('conflict', 'Changed', 409); };
  await r.store.enqueue(save({ source: 'conflict' })); void r.store.enqueueEdit(save({ notes: 'before click' }));
  const clicked = new Set(r.store.getPending().map(command => command.commandId)); const read = gate(); r.transport.read = () => read.promise;
  r.store.useSavedVersion(); void r.store.enqueueEdit(save({ notes: 'after click' }));
  const newest = r.store.getPending().at(-1); assert.equal(clicked.has(newest.commandId), false);
  read.resolve(snapshot()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.store.getPending().length, 1); assert.equal(r.store.getSnapshot().canvases[0].fields.notes, 'after click');
  assert.equal(r.store.getPersistenceSnapshot(), 'conflict'); r.store.deactivate();
});

test('project creation flushes coalesced fields in order with their projected draft revision', async () => {
  browser(); const legacy = new AssessmentStore('sp'); legacy.start(); for (let i = 0; i < 10; i++) legacy.advance();
  const state = legacy.getSnapshot(), finding = state.runs[0].findings[0];
  legacy.beginDraft(state.currentRunId, { name: 'Original', goal: 'Goal', targetOrgId: 'sit', findingIds: [finding.id] });
  let saved = { ...snapshot(), assessment: legacy.getSnapshot(), assessmentRevision: 1 }; const sent = [];
  const store = new RemoteWorkspaceStore(session, { read: async () => structuredClone(saved), send: async (_session, command) => {
    sent.push(command); assert.equal(command.expectedRevision, saved.assessmentRevision);
    saved = { ...saved, assessment: applyAssessmentCommand(saved.assessment, command, { id: () => command.commandId, now: '2026-09-16', owner: 'Sam' }), assessmentRevision: saved.assessmentRevision + 1 };
    return { revision: saved.assessmentRevision };
  } }, 'pending', () => {});
  await store.load(); const id = saved.assessment.draft.id;
  void store.enqueueEdit({ kind: 'draft.edit', draftId: id, edit: { field: 'name', value: 'Intermediate' } });
  void store.enqueueEdit({ kind: 'draft.edit', draftId: id, edit: { field: 'name', value: 'Final name' } });
  void store.enqueueEdit({ kind: 'draft.edit', draftId: id, edit: { field: 'goal', value: 'Final goal' } });
  const revision = store.getSnapshot().assessment.draft.revision;
  assert.ok(await store.enqueue({ kind: 'project.create', draftId: id, draftRevision: revision }, 'project-command'));
  assert.deepEqual(sent.map(command => command.kind), ['draft.edit', 'draft.edit', 'project.create']);
  assert.equal(saved.assessment.projects[0].name, 'Final name'); assert.equal(saved.assessment.projects[0].goal, 'Final goal'); store.deactivate();
});

test('projection retains unrelated surface/draft identities and skips status-only snapshots', () => {
  const prefs = emptyState(), id = canvasId(canvas.kind, canvas.params);
  prefs.build.canvases.push({ ...canvas, id });
  const saved = [{ id, canvas, surface: 'build', target, fields: { source: 'one' }, revision: 1 }];
  const first = projectCanvases(prefs, prefs, saved), repeat = projectCanvases(first, prefs, structuredClone(saved));
  assert.equal(repeat, first);
  const second = projectCanvases(first, prefs, [{ ...saved[0], fields: { source: 'two' } }]);
  assert.equal(second.alm, first.alm); assert.equal(second.code, first.code); assert.notEqual(second.build, first.build);
  assert.equal(second.build.canvases[0].draft.source, 'two');
});

test('tab budget rejects new views without deleting older data; existing overflow can be read/closed', () => {
  browser(); const prefs = emptyState();
  const input = i => ({ kind: 'app', title: `App ${i}`, params: { projectId: 'project', appId: `app-${i}` } });
  for (let i = 0; i < 22; i++) { const item = input(i); prefs.build.canvases.push({ ...item, id: canvasId(item.kind, item.params), draft: { notes: String(i) } }); }
  const store = new SurfaceCanvasStore('tabs', prefs);
  // Legacy Build app inputs normalize into ALM without losing the overflow.
  assert.equal(store.getSnapshot().build.canvases.length, 0);
  assert.equal(store.getSnapshot().alm.canvases.length, 22);
  assert.equal(store.openCanvas('build', input(22)), false); assert.equal(store.openCanvas('build', input(0)), true);
  for (let i = 0; i < 3; i++) store.closeCanvas('build', canvasId(input(i).kind, input(i).params));
  assert.equal(store.openCanvas('build', input(22)), true); assert.equal(store.getSnapshot().alm.canvases.length, 20);
  assert.equal(Object.keys(store.getSnapshot().alm.closedDrafts).length, 3);
});

test('rejected navigation does not push a phantom destination or supersede the previous accepted href', () => {
  const pushes = []; const controller = new NavigationController(destination => destination.canvas ? false : true, href => pushes.push(href));
  const home = { version: 1, owner: 'jw', surface: null, target };
  controller.navigate(home); const accepted = pushes[0];
  controller.navigate({ ...home, surface: 'build', canvas });
  assert.deepEqual(pushes, [accepted]); assert.equal(controller.restore(accepted), true);
});

test('sample timestamps normalize offsets, retain UTC, and decline invented instants for legacy labels (P6-R2)', () => {
  const { displayTimestamp } = modules.load('lib/display-timestamp');
  assert.deepEqual(displayTimestamp('2026-09-14T14:56:00Z'), { dateTime: '2026-09-14T14:56:00.000Z', label: '2026-09-14 14:56 UTC' });
  assert.equal(displayTimestamp('2026-09-14T14:56:00-04:00').label, '2026-09-14 18:56 UTC');
  for (const value of ['Yesterday', '4 min ago', '2026-09-14T14:56:00', '2026-99-14T14:56:00Z']) assert.equal(displayTimestamp(value), null);
});

test('edit coalescing preserves intervening aggregate ordering and isolates caller-owned objects', async () => {
  browser(); const r = remote(); await r.store.load();
  const first = save({ notes: 'first' }); const firstResult = r.store.enqueueEdit(first); first.fields.notes = 'caller mutation';
  const other = { ...save({ notes: 'other' }), canvas: { ...canvas, params: { ...canvas.params, capability: 'experience' } } };
  const middleResult = r.store.enqueueEdit(other), lastResult = r.store.enqueueEdit(save({ notes: 'last' }));
  assert.deepEqual(r.store.getPending().map(command => command.fields.notes), ['first', 'other', 'last']);
  assert.deepEqual(r.store.getPending().map(command => command.expectedRevision), [0, 0, 1]);
  r.store.flushEdits(); await Promise.all([firstResult, middleResult, lastResult]); assert.equal(r.sent.length, 3); r.store.deactivate();
});

test('composer limits refuse a seventeenth draft or oversize edit without erasing prior content', () => {
  const { editComposerDraft } = modules.load('lib/chat/composer-drafts');
  let state = { drafts: {}, problem: '' };
  for (let i = 0; i < 16; i++) state = editComposerDraft(state, `thread-${i}`, `preserved ${i}`);
  const full = state.drafts; state = editComposerDraft(state, 'thread-17', 'new');
  assert.equal(state.drafts, full); assert.match(state.problem, /16 unsent drafts/);
  state = editComposerDraft(state, 'thread-1', 'x'.repeat(8001)); assert.equal(state.drafts, full); assert.match(state.problem, /8,000/);
  state = editComposerDraft(state, 'thread-1', ''); state = editComposerDraft(state, 'thread-17', 'accepted');
  assert.equal(state.drafts['thread-17'], 'accepted'); assert.equal(state.drafts['thread-0'], 'preserved 0'); assert.equal(Object.keys(state.drafts).length, 16);
});

test('long coalesced bursts share one promise and deactivation settles it without recursive callbacks (P6-R3)', async () => {
  browser(); const r = remote(); await r.store.load();
  const shared = r.store.enqueueEdit(save({ notes: '0' }));
  for (let i = 1; i < 10000; i++) assert.equal(r.store.enqueueEdit(save({ notes: String(i) })), shared);
  assert.equal(r.store.getPending().length, 1); assert.equal(r.store.getPending()[0].fields.notes, '9999');
  r.store.deactivate(); assert.equal(await shared, null);
});

test('explicit Keep Local transfers shared unresolved tail completion to the rebuilt command identity (P6-R3)', async () => {
  browser(); const r = remote(); await r.store.load(); const originalSend = r.transport.send;
  r.transport.send = async () => { throw new ApplicationError('conflict', 'Changed', 409); };
  assert.equal(await r.store.enqueue(save({ source: 'conflicted' })), null);
  const pending = r.store.enqueueEdit(save({ notes: 'first tail' }));
  assert.equal(r.store.enqueueEdit(save({ notes: 'last tail' })), pending);
  const before = r.store.getPending().map(command => command.commandId);
  r.transport.send = originalSend; r.store.keepLocalChanges(); r.store.flushEdits();
  assert.ok(await pending); assert.equal(r.store.getPersistenceSnapshot(), 'saved');
  assert.ok(r.sent.every(command => !before.includes(command.commandId)));
  assert.equal(r.saved().canvases[0].fields.notes, 'last tail'); r.store.deactivate();
});

test('a previously captured closed URL view survives20 shared tabs while unknown URL denial cannot manufacture a target', () => {
  browser(); const prefs = emptyState();
  const input = i => ({ kind: 'app', title: `App ${i}`, params: { projectId: 'project', appId: `app-${i}` } });
  for (let i = 0; i < 20; i++) { const item = input(i); prefs.build.canvases.push({ ...item, id: canvasId(item.kind, item.params) }); }
  const store = new SurfaceCanvasStore('tabs-url', prefs), selected = input(0), selectedId = canvasId(selected.kind, selected.params);
  const projectTarget = { projectId: 'project', worktreeId: null, orgId: null };
  store.captureTarget('build', selectedId, projectTarget); store.updateDraft('build', selectedId, { notes: 'preserved closed draft' });
  store.closeCanvas('build', selectedId); assert.equal(store.openCanvas('build', input(20)), true);
  assert.equal(store.canOpenCanvas('build', selected), false); assert.equal(store.canViewCanvas('build', selected), true);
  const unknown = input(21), unknownId = canvasId(unknown.kind, unknown.params);
  assert.equal(store.canViewCanvas('build', unknown), false);
  const { destinationHref } = modules.load('lib/navigation/model');
  const home = { version: 1, owner: 'jw', surface: null, target };
  const controller = new NavigationController((destination, source) => {
    if (destination.canvas && source === 'restore' && !store.canViewCanvas('build', destination.canvas)) return false;
    if (destination.canvas && source === 'capture') store.captureTarget('build', canvasId(destination.canvas.kind, destination.canvas.params), destination.target);
  }, () => {});
  controller.navigate(home);
  const badUrl = destinationHref({ ...home, surface: 'build', canvas: unknown, target: projectTarget });
  assert.equal(controller.restore(badUrl, true), false); controller.navigate(home);
  assert.equal(controller.restore(badUrl, true), false); assert.equal(store.getSnapshot().alm.targets[unknownId], undefined);
  assert.equal(store.getSnapshot().alm.closedDrafts[selectedId].notes, 'preserved closed draft');
  assert.equal(store.getSnapshot().alm.canvases.length, 20);
});
