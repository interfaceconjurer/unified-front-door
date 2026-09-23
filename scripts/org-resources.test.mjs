import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { resourcesForOrg, findResource } = modules.load('lib/org-resources/catalog');
const { searchResources, RESOURCE_TYPES, resourceKey } = modules.load('lib/org-resources/model');
const { canvasId, canvasTarget, parseCanvasInput, inputFromCanonicalId } = modules.load('lib/surface-canvas/model');
const { SurfaceCanvasStore } = modules.load('lib/surface-canvas/persistence');
const { destinationHref, readDestination, resolveDestination } = modules.load('lib/navigation/model');
const { parseCommand } = modules.load('lib/application/contracts');
const { SETUP_AREAS, resourceBelongsToArea } = modules.load('lib/org-resources/setup');
const { isReadOnlyCanvas } = modules.load('lib/surface-canvas/model');
const { capabilityForCanvas } = modules.load('lib/surface-canvas/capabilities');
afterEach(() => { delete global.window; });

test('setup browsers preserve captured scope and reject editable draft saves', () => {
  for (const area of SETUP_AREAS) {
    assert.equal(capabilityForCanvas('build', area.id).group, 'setup');
    assert(resourcesForOrg('uat').some(resource => resourceBelongsToArea(area, resource.resourceType)));
    for (const scope of [{ scope: 'unbound', orgId: 'uat' }, { scope: 'project', projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' }]) {
      const canvas = { kind: 'capability', title: area.title, params: { ...scope, surface: 'build', capability: area.id } };
      const target = { projectId: scope.projectId ?? null, worktreeId: scope.worktreeId ?? null, orgId: 'uat' };
      assert.deepEqual(canvasTarget(canvas, target), target);
      assert(isReadOnlyCanvas(canvas));
      assert.equal(readDestination(destinationHref({ version: 1, owner: 'am', surface: 'build', canvas, target })).kind, 'destination');
      assert.throws(() => parseCommand({ kind: 'canvas.save', commandId: 'setup-write', expectedRevision: 0, surface: 'build', canvas, target, fields: {} }));
    }
  }
  assert(!isReadOnlyCanvas({ kind: 'capability', params: { scope: 'unbound', surface: 'build', capability: 'data-model' } }));
});
const resource = (orgId = 'prod', resourceType = 'standard-object', apiName = 'Account') => ({ kind: 'org-resource', title: 'Account', params: { orgId, resourceType, apiName } });
const destination = (canvas = resource(), surface = RESOURCE_TYPES[canvas.params.resourceType].surface, owner = 'jw') => ({ version: 1, owner, surface, target: canvasTarget(canvas, { projectId: 'ignored-project', worktreeId: 'ignored-branch', orgId: 'ignored-org' }), canvas });
const access = ['build', 'code', 'govern', 'alm'];

test('search covers names, API names, types and groups, with explicit org/type scope', () => {
  const prod = resourcesForOrg('prod');
  assert.deepEqual(searchResources(prod, '  aCcOuNt standard  ').map(r => r.apiName), ['Account', 'Contact']);
  assert.deepEqual(searchResources(prod, 'Project__c', 'custom-object').map(r => r.apiName), ['Project__c']);
  assert(searchResources(prod, 'permission').length >= 3);
  assert(searchResources(prod, 'Automation').every(r => RESOURCE_TYPES[r.resourceType].group === 'Automation'));
  assert.equal(searchResources(prod, 'Release_Checklist__c').length, 0);
  assert.equal(searchResources(resourcesForOrg('uat'), 'Release_Checklist__c').length, 1);
  assert.equal(searchResources(prod, 'Lead', 'dashboard').length, 0);
  assert.deepEqual(resourcesForOrg('scratch-hotfix'), []);
  assert.deepEqual(resourcesForOrg('unknown-org'), []);
});

test('catalog represents every declared type with unique identities and valid same-org related links', () => {
  const resources = resourcesForOrg('uat');
  assert.deepEqual(new Set(resources.map(r => r.resourceType)), new Set(Object.keys(RESOURCE_TYPES)));
  for (const orgId of ['prod', 'uat', 'sit', 'scratch-lead', 'acme-devhub']) {
    const scoped = resourcesForOrg(orgId);
    assert.equal(new Set(scoped.map(resourceKey)).size, scoped.length);
    for (const entry of scoped) for (const ref of entry.related) assert(findResource({ ...ref, orgId }), `${orgId}: ${entry.apiName} -> ${ref.apiName}`);
  }
});

test('resource canvas identity includes org and type, ignores title, and preserves org without a project', () => {
  const input = resource(), id = canvasId(input.kind, input.params);
  assert.deepEqual(inputFromCanonicalId(id).params, input.params);
  assert.notEqual(id, canvasId(input.kind, resource('uat').params));
  assert.notEqual(id, canvasId(input.kind, resource('prod', 'custom-object').params));
  assert.equal(canvasId(input.kind, parseCanvasInput({ ...input, title: 'Renamed' }).params), id);
  assert.deepEqual(destination(input).target, { projectId: null, worktreeId: null, orgId: 'prod' });
  for (const invalid of [{ orgId: '' }, { apiName: '' }, { resourceType: 'unknown' }]) assert.equal(parseCanvasInput({ ...input, params: { ...input.params, ...invalid } }), null);
});

test('navigation roundtrips org resources and rejects conflicting orgs, wrong surfaces, missing metadata and profile access', () => {
  const value = destination(), href = destinationHref(value);
  assert.deepEqual(readDestination(href), { kind: 'destination', value });
  assert.equal(resolveDestination(href, 'jw', access, {}).kind, 'available');
  assert.equal(readDestination(destinationHref({ ...value, target: { ...value.target, orgId: 'uat' } })).kind, 'invalid');
  assert.equal(readDestination(destinationHref({ ...value, surface: 'code' })).kind, 'invalid');
  for (const input of [resource('retired'), resource('prod', 'flow', 'Missing'), resource('prod', 'custom-object', 'Release_Checklist__c')]) assert.equal(resolveDestination(destinationHref(destination(input)), 'jw', access, {}).kind, 'unavailable');
  assert.equal(resolveDestination(destinationHref(destination(resource('acme-devhub'), 'build', 'sp')), 'sp', ['build', 'alm'], {}).kind, 'unavailable');
  assert.equal(resolveDestination(destinationHref(destination(resource('prod', 'apex-class', 'LeadRoutingService'), 'code', 'sp')), 'sp', ['build', 'alm'], {}).kind, 'unavailable');
});

test('project resource URLs preserve project and branch, with distinct global and branch identities', () => {
  const global = resource('uat');
  const scoped = { ...global, params: { ...global.params, projectId: 'trailblazer-crm', worktreeId: 'lead-routing' } };
  const value = destination(scoped, 'build', 'am'), target = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
  assert.deepEqual(value.target, target);
  assert.deepEqual(readDestination(destinationHref(value)), { kind: 'destination', value });
  assert.equal(resolveDestination(destinationHref(value), 'am', access, {}).kind, 'available');
  const id = canvasId(scoped.kind, scoped.params);
  assert.deepEqual(inputFromCanonicalId(id).params, scoped.params);
  assert.notEqual(id, canvasId(global.kind, global.params));
  assert.notEqual(id, canvasId(scoped.kind, { ...scoped.params, worktreeId: 'main' }));
  assert.equal(readDestination(destinationHref({ ...value, target: { ...target, projectId: null, worktreeId: null } })).kind, 'invalid');
  for (const scope of [{ worktreeId: 'main' }, { projectId: '' }, { projectId: 'trailblazer-crm', worktreeId: '' }]) assert.equal(parseCanvasInput({ ...global, params: { ...global.params, ...scope } }), null);
});

test('reopening focuses existing resource, separate org tabs persist, and arbitrary metadata edits are rejected', () => {
  const disk = new Map(); global.window = { localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) }, addEventListener() {}, removeEventListener() {} };
  const store = new SurfaceCanvasStore('resource-test');
  for (const orgId of ['prod', 'prod', 'uat']) {
    const input = resource(orgId), id = canvasId(input.kind, input.params);
    store.captureTarget('build', id, destination(input).target); store.openCanvas('build', input);
  }
  assert.equal(store.getSnapshot().build.canvases.length, 2);
  const restored = new SurfaceCanvasStore('resource-test');
  assert.deepEqual(restored.getSnapshot(), store.getSnapshot());
  assert.throws(() => restored.openCanvas('code', resource()), /Invalid canvas/);
  const input = resource(), id = canvasId(input.kind, input.params);
  restored.closeCanvas('build', id); restored.openCanvas('build', input);
  assert.equal(restored.getSnapshot().build.canvases.length, 2);
  assert.deepEqual(restored.getSnapshot().build.targets[id], destination(input).target);
  assert.throws(() => parseCommand({ kind: 'canvas.save', commandId: 'resource-write', expectedRevision: 0, surface: 'build', canvas: input, target: destination(input).target, fields: { name: 'Edit' } }));
});
