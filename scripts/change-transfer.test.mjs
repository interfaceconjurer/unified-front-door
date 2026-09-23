import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { parseCommand, briefTransferSources } = modules.load('lib/application/contracts');
const { canvasId, canvasTarget } = modules.load('lib/surface-canvas/model');
const { planChangeTransfer } = modules.load('lib/workspace/change-transfer');
const { workspaceChanges } = modules.load('lib/workspace/changes');
const { RemoteWorkspaceStore, EMPTY_APPLICATION } = modules.load('lib/application/remote-store');
const canvas = { kind: 'capability', title: 'Automation', params: { scope: 'unbound', surface: 'build', capability: 'automation', orgId: 'uat' } };
const object = { kind: 'org-resource', title: 'Account', params: { orgId: 'prod', resourceType: 'standard-object', apiName: 'Account' } };
const saved = (canvas, fields) => ({ id: canvasId(canvas.kind, canvas.params), canvas, target: canvasTarget(canvas, {}), surface: 'build', fields, revision: 2 });
const drafts = [saved(canvas, { name: 'Routing' }), saved(object, { Region__c: JSON.stringify({ label: 'Region', apiName: 'Region__c', type: 'Text' }) })];
const sources = drafts.map(draft => ({ sourceId: draft.id, sourceRevision: draft.revision }));
const transfer = { kind: 'changes.transfer', projectId: 'new-project', sources, expectedRevision: 0, commandId: 'transfer-1' };

test('transfer commands and persisted new-project selections validate revisions, identities and bounded batches', () => {
  assert.deepEqual(parseCommand(transfer), transfer);
  assert.deepEqual(briefTransferSources(JSON.stringify(sources)), sources);
  assert.deepEqual(briefTransferSources(undefined), []);
  for (const patch of [{ projectId: '' }, { expectedRevision: 1 }, { sources: [] }, { sources: [sources[0], sources[0]] }, { sources: [{ ...sources[0], sourceRevision: 0 }] }, { sources: [{ ...sources[0], fields: {} }] }]) assert.throws(() => parseCommand({ ...transfer, ...patch }));
  for (const value of ['broken json', '{}', '[]']) assert.throws(() => briefTransferSources(value));
});

test('whole-batch preflight preserves every source on a stale revision or collision, and retains orgs for valid transfers', () => {
  const before = structuredClone(drafts);
  const plan = planChangeTransfer(sources, drafts, 'new-project', 'main');
  assert.deepEqual(plan.map(item => item.destination.target), [
    { projectId: 'new-project', worktreeId: 'main', orgId: 'uat' }, { projectId: 'new-project', worktreeId: 'main', orgId: 'prod' },
  ]);
  assert.deepEqual(plan.map(item => item.destination.fields), drafts.map(draft => draft.fields));
  assert.throws(() => planChangeTransfer([sources[0], { ...sources[1], sourceRevision: 1 }], drafts, 'new-project', 'main'), error => error.code === 'conflict');
  assert.throws(() => planChangeTransfer(sources, [...drafts, plan[1].destination], 'new-project', 'main'), error => error.code === 'conflict');
  assert.throws(() => planChangeTransfer(sources, [drafts[0]], 'new-project', 'main'), error => error.code === 'conflict');
  assert.throws(() => planChangeTransfer(sources, [drafts[0], { ...drafts[1], fields: {} }], 'new-project', 'main'), error => error.code === 'conflict');
  assert.deepEqual(drafts, before, 'Preflight never changes either source');
});

test('creation transfer metadata alone does not appear as a global file change', () => {
  const brief = { kind: 'capability', title: 'Start project', params: { scope: 'unbound', surface: 'alm', capability: 'project', orgId: 'uat' } };
  const record = { ...saved(brief, { transferSources: JSON.stringify(sources) }), surface: 'alm' };
  assert.deepEqual(workspaceChanges('sp', record.target, [], [record]), []);
});

test('uncertain transfers keep global changes until confirmation; retry reuses the receipt and clears sources once', async () => {
  const disk = new Map(); global.window = { localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) }, addEventListener() {}, removeEventListener() {} };
  const session = { namespaceId: 'transfer-test', profileId: 'sp', generation: 'g', expiresAt: '2027-01-01' };
  const snapshot = structuredClone({ ...EMPTY_APPLICATION, session, assessmentRevision: 7, canvases: drafts });
  const receipts = new Map(), sent = [];
  let release; const gate = new Promise(resolve => { release = resolve; });
  const transport = { read: async () => structuredClone(snapshot), send: async (_session, command) => {
    sent.push(structuredClone(command));
    if (receipts.has(command.commandId)) return receipts.get(command.commandId);
    await gate;
    const plan = planChangeTransfer(command.sources, snapshot.canvases, command.projectId, null);
    for (const { source, destination } of plan) { snapshot.canvases.push(destination); source.fields = {}; source.revision++; }
    receipts.set(command.commandId, { revision: 0 }); throw new Error('Acknowledgement lost after commit');
  } };
  const store = new RemoteWorkspaceStore(session, transport, 'pending-transfer', () => {});
  await store.load(); const pending = store.enqueue({ kind: 'changes.transfer', projectId: 'new-project', sources }, 'same-transfer');
  assert.deepEqual(store.getSnapshot().canvases.map(draft => draft.fields), drafts.map(draft => draft.fields));
  assert.equal(store.getPersistenceSnapshot(), 'saving'); release(); assert.equal(await pending, null);
  assert.equal(store.getPersistenceSnapshot(), 'unavailable');
  assert.equal(store.canKeepLocalChanges(), false, 'A transfer cannot be rebased as an ordinary field overwrite');
  store.deactivate();
  const restored = new RemoteWorkspaceStore(session, transport, 'pending-transfer', () => {});
  await restored.retryPersistence();
  for (let i = 0; restored.hasPending() && i < 30; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(restored.getPersistenceSnapshot(), 'saved'); assert.deepEqual(sent[0], sent[1]);
  assert.equal(sent[0].expectedRevision, 0, 'Transfers do not consume assessment revisions');
  assert.equal(snapshot.canvases.length, 4); assert(snapshot.canvases.slice(0, 2).every(draft => draft.revision === 3 && !Object.keys(draft.fields).length));
  assert.equal(disk.has('pending-transfer'), false); restored.deactivate();
});
