import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { projectFiles, projectFileCanvas, projectFileTree } = modules.load('lib/workspace/project-files');
const { demoProfileById } = modules.load('lib/demo-profiles');
const { projectsForProfile } = modules.load('lib/workspace/demo-workspace');
const { canvasId, canvasTarget, isReadOnlyCanvas, inputFromCanonicalId, parseCanvasInput } = modules.load('lib/surface-canvas/model');
const { destinationHref, resolveDestination } = modules.load('lib/navigation/model');
const { parseCommand } = modules.load('lib/application/contracts');
const { projectContextFiles } = modules.load('lib/projects/context-files');
const scope = (projectId, worktreeId = null) => ({ projectId, worktreeId, orgId: 'uat' });

test('sample file trees are scoped to the profile, project and worktree with no sibling changes', () => {
  assert.deepEqual(projectFiles('sp', scope('trailblazer-crm')), []);
  assert.deepEqual(projectFiles('kf', scope('trailblazer-crm', 'main')), []);
  assert.deepEqual(projectFiles('am', scope('missing', 'main')), []);
  for (const id of ['kf', 'jw', 'am']) for (const project of projectsForProfile(id)) {
    for (const worktree of project.worktrees.length ? project.worktrees : [{ id: null }]) {
      const files = projectFiles(id, scope(project.id, worktree.id));
      assert(files.length >= 6);
      assert.equal(new Set(files.map(file => file.path)).size, files.length);
      assert(files.every(file => demoProfileById(id).surfaceAccess.includes(file.surfaceId)));
    }
  }
  const lead = projectFiles('am', scope('trailblazer-crm', 'lead-routing'));
  assert(lead.some(file => file.path.endsWith('OpportunityTriggerHandler.cls')), 'A worktree inherits base files');
  assert(lead.some(file => file.path === 'agents/lead-routing-agent/instructions.md' && file.modified));
  assert(!lead.some(file => file.path.includes('W-9821') || file.path.includes('storefront')));
  const tree = projectFileTree(lead), flatten = nodes => nodes.flatMap(node => node.file ? [node.file.path] : flatten(node.children));
  assert.deepEqual(flatten(tree).sort(), lead.map(file => file.path).sort());
});

test('file canvases round-trip exact scope and reject wrong profiles, branches, paths, orgs and surfaces', () => {
  const target = scope('trailblazer-crm'), file = projectFiles('kf', target).find(file => file.path.endsWith('.flow-meta.xml'));
  const canvas = projectFileCanvas(file, target), id = canvasId(canvas.kind, canvas.params);
  assert.deepEqual(inputFromCanonicalId(id).params, canvas.params);
  assert.deepEqual(canvasTarget(canvas, scope('other')), target);
  assert(isReadOnlyCanvas(canvas));
  const destination = { version: 1, owner: 'kf', surface: 'build', target, canvas };
  const check = value => resolveDestination(destinationHref(value), value.owner, demoProfileById(value.owner).surfaceAccess, {}).kind;
  assert.equal(check(destination), 'available');
  assert.equal(check({ ...destination, surface: 'alm' }), 'unavailable');
  assert.equal(check({ ...destination, owner: 'sp' }), 'unavailable');
  for (const params of [{ ...canvas.params, path: 'missing.xml' }, { ...canvas.params, worktreeId: 'main' }, { ...canvas.params, orgId: 'missing' }]) {
    assert.equal(check({ ...destination, canvas: { ...canvas, params }, target: { projectId: params.projectId, worktreeId: params.worktreeId, orgId: params.orgId } }), 'unavailable');
  }
  for (const path of ['../other', '/absolute', 'a//b', 'a/./b', 'a\\b']) assert.equal(parseCanvasInput({ ...canvas, params: { ...canvas.params, path } }), null);
  assert.throws(() => parseCommand({ kind: 'canvas.save', commandId: 'no-file-write', expectedRevision: 0, surface: 'build', canvas, target, fields: { source: 'overwrite' } }));
});

test('saved projects expose portable live context without duplicating private persistence records', () => {
  const project = { id: 'created', name: 'Service app', projectType: 'react', goal: 'Reduce handoffs', context: 'Keep café notes\nUse existing sign-in', owner: 'Sam', repository: 'https://github.com/acme/service', targetOrgId: 'uat', scopeOrgIds: ['uat'], createdAt: '2026-09-22T12:00:00Z', sourceDraftId: 'internal-draft', createCommandId: 'internal-command', revision: 1, workItems: [] };
  const target = scope(project.id), files = projectFiles('sp', target, [project]);
  assert.deepEqual(files.map(file => file.path), ['.project/project.json', '.project/work-items.json']);
  assert(files.every(file => file.surfaceId === 'alm' && file.source === 'saved-project'));
  const definition = JSON.parse(files[0].content);
  assert.equal(definition.context, project.context);
  assert.equal(definition.goal, project.goal); assert.equal(definition.repository, project.repository);
  assert.equal(definition.schemaVersion, 1);
  assert(!files[0].content.includes('internal-command')); assert(!files[0].content.includes('internal-draft'));
  assert.deepEqual(JSON.parse(files[1].content).workItems, []);
  const canvas = projectFileCanvas(files[0], target), destination = { version: 1, owner: 'sp', surface: 'alm', target, canvas };
  assert.equal(resolveDestination(destinationHref(destination), 'sp', ['alm'], {}, [project]).kind, 'available');
  assert.equal(resolveDestination(destinationHref(destination), 'sp', ['alm'], {}, []).kind, 'unavailable', 'Deleted/unowned project files cannot resolve');
  assert.deepEqual(projectFiles('sp', scope(project.id, 'main'), [project]), [], 'A saved planning project has no fabricated branch');
  const updated = { ...project, goal: 'Shorten intake', revision: 2, workItems: [{ id: 'WI-1', title: 'Route incoming requests', priority: 'High', status: 'done', findingId: 'finding-1', finding: { evidence: ['Captured baseline'], steps: ['Validate routing'], validation: 'Every request reaches an owner' } }] };
  const next = projectContextFiles(updated);
  assert.equal(JSON.parse(next[0].content).goal, updated.goal);
  assert.deepEqual(JSON.parse(next[1].content).workItems, updated.workItems);
  assert.deepEqual(JSON.parse(files[1].content).workItems, [], 'An exported snapshot remains stable');
  assert.deepEqual(next, projectContextFiles(updated), 'Unchanged records export deterministically');
});
