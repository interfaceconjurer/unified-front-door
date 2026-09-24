import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(() => modules.cleanup());
const { SERVICE_REPS, permissionUsers, permissionFileContent } = modules.load('lib/org-resources/permissions');
const { permissionReply } = modules.load('lib/agent/permission-actions');
const { parseAgentCommand } = modules.load('lib/agent/contracts');
const { parseCommand } = modules.load('lib/application/contracts');
const { canvasId, canvasTarget } = modules.load('lib/surface-canvas/model');
const { workspaceChanges } = modules.load('lib/workspace/changes');
const { planChangeTransfer } = modules.load('lib/workspace/change-transfer');
const canvas = { kind: 'org-resource', title: 'Service Reps', params: { orgId: 'prod', resourceType: 'permission-set-group', apiName: 'Service_Reps' } };
const target = canvasTarget(canvas, {});
const saved = fields => ({ id: canvasId(canvas.kind, canvas.params), canvas, target, fields, surface: 'build', revision: 1 });

test('individual permission assignments track exact scoped changes and undo returns to the captured baseline', () => {
  assert.equal(permissionUsers().filter(user => user.canDelete).length, 6);
  assert.equal(workspaceChanges('sp', target, [], [saved({})]).length, 0);
  const draft = saved({ maya_chen: 'standard' });
  const changes = workspaceChanges('sp', target, [], [draft]);
  assert.equal(changes.length, 1); assert.equal(changes[0].path, '.orgs/prod/access/Service_Reps.assignments.json');
  assert(changes[0].additions && changes[0].deletions);
  const file = JSON.parse(permissionFileContent(draft.fields));
  assert.deepEqual(file.baselineAccess, ['Read', 'Create', 'Edit']);
  assert.deepEqual(file.assignments[0].permissionSets, []);
  assert.deepEqual(file.assignments[1].permissionSets, ['Case_Delete']);
  assert.equal(workspaceChanges('sp', target, [], [saved({ maya_chen: '' })]).length, 0);
});

test('permission edits validate users, values, surface, ownership and transfer with the existing protocol', () => {
  const command = { kind: 'canvas.save', commandId: 'manual', expectedRevision: 0, surface: 'build', canvas, target, fields: { maya_chen: 'standard' } };
  assert.deepEqual(parseCommand(command), command);
  for (const fields of [{ unknown: 'standard' }, { maya_chen: 'admin' }, { maya_chen: 'false' }, { source: 'code' }]) assert.throws(() => parseCommand({ ...command, fields }));
  assert.throws(() => parseCommand({ ...command, target: { ...target, projectId: 'foreign' } }));
  assert.throws(() => parseCommand({ ...command, surface: 'code' }));
  const draft = saved(command.fields);
  const [{ destination }] = planChangeTransfer([{ sourceId: draft.id, sourceRevision: 1 }], [draft], 'project', null);
  assert.equal(destination.target.projectId, 'project'); assert.equal(destination.target.orgId, 'prod');
  assert.deepEqual(destination.fields, draft.fields);
  assert.notEqual(destination.id, draft.id);
  const context = { target, surface: 'build', canvas, canvasRevision: 1 };
  assert.deepEqual(parseAgentCommand({ kind: 'submit', requestId: 'bulk', context, text: 'Remove Delete Cases for everyone' }).context, context);
  assert.throws(() => parseAgentCommand({ kind: 'submit', requestId: 'bulk', context: { ...context, fields: { maya_chen: 'standard' } }, text: 'remove all' }));
  assert.throws(() => parseAgentCommand({ kind: 'visit', requestId: 'visit', context: { ...context, surface: 'alm' } }));
});

test('chat edits only remaining users, supports explicit standard access and undo, and never invents broader permissions', () => {
  const manual = { maya_chen: 'standard' };
  for (const request of ['Remove Delete Cases access for the remaining users', 'Can you update all of these users permissions to standard access?', 'Set all users to read, create and edit', 'Do the same for everyone else']) {
    const result = permissionReply(request, manual);
    assert.equal(Object.keys(result.patch).length, 5, request);
    assert.equal(result.patch.maya_chen, undefined);
    assert(permissionUsers({ ...manual, ...result.patch }).every(user => !user.canDelete));
  }
  const all = Object.fromEntries(SERVICE_REPS.map(user => [user.id, 'standard']));
  assert.equal(Object.keys(permissionReply('Remove Delete Cases access for everyone', all).patch).length, 0);
  assert.deepEqual(permissionReply('Undo all permission changes', all).patch, Object.fromEntries(SERVICE_REPS.map(user => [user.id, ''])));
  for (const request of ['What if I remove Delete Cases for everyone?', "Don't remove Delete Cases for all users", 'Remove Delete Cases for everyone except Maya', 'Update all users to read only', 'Set all users to admin', 'Remove read and Delete Cases for everyone', 'Remove Delete Cases for all Sales users', 'Do the same for everyone else']) {
    assert.equal(permissionReply(request, {}).patch, undefined, request);
  }
});
