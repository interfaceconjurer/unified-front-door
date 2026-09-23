import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { parseCommand } = modules.load('lib/application/contracts');
const { canvasId, canvasTarget, canCopyCanvasToProject } = modules.load('lib/surface-canvas/model');
const { parseObjectFields, suggestedFieldApiName } = modules.load('lib/org-resources/object-fields');
const { workspaceChanges } = modules.load('lib/workspace/changes');
const canvas = { kind: 'org-resource', title: 'Account', params: { orgId: 'uat', resourceType: 'standard-object', apiName: 'Account' } };
const target = canvasTarget(canvas, {});
const field = { label: 'Customer region', apiName: 'Customer_Region__c', type: 'Text' };
const fields = { [field.apiName]: JSON.stringify(field) };
const save = (fields, input = canvas, surface = 'build') => ({ kind: 'canvas.save', commandId: 'field-change', expectedRevision: 0, canvas: input, target: canvasTarget(input, {}), surface, fields });

test('Account additions validate supported types, API names and duplicates at the command boundary', () => {
  assert.equal(suggestedFieldApiName(' Customer region '), 'Customer_region__c');
  for (const type of ['Text', 'Number', 'Checkbox', 'Date', 'Email']) {
    const values = { [field.apiName]: JSON.stringify({ ...field, type }) };
    assert.deepEqual(parseCommand(save(values)).fields, values);
  }
  for (const invalid of [
    { name: 'Unexpected metadata' }, { [field.apiName]: 'bad json' },
    { [field.apiName]: JSON.stringify({ ...field, label: ' ' }) },
    { [field.apiName]: JSON.stringify({ ...field, type: 'Unknown' }) },
    { [field.apiName]: JSON.stringify({ ...field, apiName: 'Other__c' }) },
    { 'Bad_Name': JSON.stringify({ ...field, apiName: 'Bad_Name' }) },
    { 'Customer_Tier__c': JSON.stringify({ ...field, apiName: 'Customer_Tier__c' }) },
    { ...fields, customer_region__c: JSON.stringify({ ...field, apiName: 'customer_region__c' }) },
  ]) assert.throws(() => parseCommand(save(invalid)));
  assert.deepEqual(parseObjectFields(canvas.params, { [field.apiName]: '' }), []);
  for (const params of [{ ...canvas.params, apiName: 'Contact' }, { ...canvas.params, resourceType: 'flow', apiName: 'Lead_Routing' }, { ...canvas.params, orgId: 'missing' }]) assert.throws(() => parseCommand(save(fields, { ...canvas, params })));
  assert.throws(() => parseCommand(save(fields, canvas, 'code')));
});

test('object changes compare current fields with captured metadata, clear at zero, and isolate org/project/branch identities', () => {
  const draft = { id: canvasId(canvas.kind, canvas.params), surface: 'build', canvas, target, fields, revision: 1 };
  const changes = workspaceChanges('sp', target, [], [draft]);
  assert.equal(changes.length, 1); assert.equal(changes[0].path, '.orgs/uat/objects/Account.object.json');
  assert.equal(changes[0].status, 'M'); assert.equal(changes[0].additions, 5); assert.equal(changes[0].deletions, 0);
  assert.equal(changes[0].draft.id, draft.id); assert.deepEqual(changes[0].canvas, canvas);
  assert.deepEqual(workspaceChanges('sp', target, [], [{ ...draft, fields: { [field.apiName]: '' } }]), []);
  const ownedCanvas = { ...canvas, params: { ...canvas.params, projectId: 'trailblazer-crm', worktreeId: 'main' } };
  const owned = { ...draft, id: canvasId(ownedCanvas.kind, ownedCanvas.params), canvas: ownedCanvas, target: canvasTarget(ownedCanvas, {}) };
  assert.equal(workspaceChanges('am', target, [], [owned]).length, 0);
  assert(workspaceChanges('am', owned.target, [], [owned]).some(change => change.id === owned.id));
  assert(!workspaceChanges('am', { ...owned.target, worktreeId: 'lead-routing' }, [], [owned]).some(change => change.id === owned.id));
  const prodCanvas = { ...canvas, params: { ...canvas.params, orgId: 'prod' } };
  const prod = { ...draft, id: canvasId(prodCanvas.kind, prodCanvas.params), canvas: prodCanvas, target: canvasTarget(prodCanvas, {}) };
  assert.deepEqual(workspaceChanges('sp', target, [], [draft, prod]).map(change => change.path), ['.orgs/prod/objects/Account.object.json', '.orgs/uat/objects/Account.object.json']);
});

test('project copies preserve object and org, require an unassigned source, and retain capability assignment', () => {
  const destination = { ...canvas, params: { ...canvas.params, projectId: 'trailblazer-crm', worktreeId: 'main' } };
  assert(canCopyCanvasToProject(canvas, destination));
  for (const params of [{ ...destination.params, orgId: 'prod' }, { ...destination.params, apiName: 'Contact' }, { ...destination.params, resourceType: 'custom-object' }, canvas.params]) assert(!canCopyCanvasToProject(canvas, { ...canvas, params }));
  assert(!canCopyCanvasToProject(destination, destination));
  const capability = { kind: 'capability', title: 'Automation', params: { scope: 'unbound', surface: 'build', capability: 'automation' } };
  const bound = { ...capability, params: { ...capability.params, scope: 'project', projectId: 'created' } };
  assert(canCopyCanvasToProject(capability, bound));
  assert(!canCopyCanvasToProject(capability, { ...bound, params: { ...bound.params, capability: 'data-model' } }));
});
