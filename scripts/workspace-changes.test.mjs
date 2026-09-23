import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { workspaceChanges, lineChanges } = modules.load('lib/workspace/changes');
const { projectContextFiles } = modules.load('lib/projects/context-files');
const { projectFiles, workFilePath } = modules.load('lib/workspace/project-files');
const { canvasId } = modules.load('lib/surface-canvas/model');
const { workForProfile } = modules.load('lib/workspace/demo-workspace');
const { workCanvasInput } = modules.load('lib/workspace/returning-work');
const scope = (projectId = null, worktreeId = null) => ({ projectId, worktreeId, orgId: 'uat' });
const project = { id: 'created', name: 'Service app', projectType: 'react', goal: 'Reduce handoffs', context: 'Use existing sign-in', owner: 'Sam', targetOrgId: 'uat', scopeOrgIds: ['uat'], createdAt: '2026-09-23T12:00:00Z', source: 'brief', runId: null, sourceDraftId: 'private-draft', createCommandId: 'private-command', revision: 1, workItems: [] };
function draft(target, fields, capability = 'automation', surface = 'build') {
  const canvas = { kind: 'capability', title: 'Automation', params: { scope: target.projectId ? 'project' : 'unbound', surface, capability,
    ...(target.projectId ? { projectId: target.projectId } : {}), ...(target.worktreeId ? { worktreeId: target.worktreeId } : {}), orgId: target.orgId } };
  return { id: canvasId(canvas.kind, canvas.params), canvas, target, fields, surface, revision: 1 };
}
test('line counts handle additions, replacements, removals, repeated lines and final newlines', () => {
  for (const [before, after, additions, deletions] of [
    ['', 'a\nb\n', 2, 0], ['a\nb\n', '', 0, 2], ['a\nb\nc\n', 'a\nx\nc\n', 1, 1],
    ['a\nb\na\n', 'a\na\n', 0, 1], ['a\n', 'a', 1, 1], ['same', 'same', 0, 0],
    ['a\nb\nc\nd\n', 'z\na\nc\ny\nd\n', 2, 1],
  ]) assert.deepEqual(lineChanges(before, after), { additions, deletions });
});
test('created project exports are added files with exact current counts and no leakage to Home or another project', () => {
  const files = workspaceChanges('sp', scope(project.id), [project], []);
  assert.deepEqual(files.map(file => file.path), ['.project/project.json', '.project/work-items.json']);
  assert(files.every(file => file.status === 'A' && file.deletions === 0));
  assert.deepEqual(files.map(file => file.additions), projectContextFiles(project).map(file => file.content.split('\n').length - 1));
  assert(files.every(file => file.canvas.params.projectId === project.id && file.canvas.params.worktreeId === null));
  for (const target of [scope(), scope('other'), scope(project.id, 'missing')]) assert.deepEqual(workspaceChanges('sp', target, [project], []), []);
  assert.deepEqual(workspaceChanges('sp', scope(project.id), [], []), []);
  const changed = { ...project, context: 'Line one\nLine two', workItems: [{ id: 'WI-1', title: 'Review', status: 'todo', priority: 'High', findingId: 'f', finding: {} }] };
  assert(workspaceChanges('sp', scope(project.id), [changed], [])[1].additions > files[1].additions);
});
test('global changes include edited unassigned drafts, not merely opened, project-owned or inaccessible drafts', () => {
  const global = draft(scope(), { name: 'Routing', goal: 'Route new leads' });
  const blank = draft(scope(), { name: '', goal: '  ' }, 'data-model');
  const owned = draft(scope(project.id), { name: 'Owned' });
  const restricted = draft(scope(), { source: 'class Test {}' }, 'apex', 'code');
  const changes = workspaceChanges('sp', scope(), [project], [global, blank, owned, restricted]);
  assert.equal(changes.length, 1); assert.equal(changes[0].path, '.drafts/uat/build/automation.json');
  assert.equal(changes[0].additions, 4); assert.equal(changes[0].draft.id, global.id);
  assert.equal(workspaceChanges('sp', scope(project.id), [project], [global, owned]).length, 3);
});
test('sample branches and saved source edits use actual modeled line comparisons without sibling changes', () => {
  const search = workspaceChanges('am', scope('acme-storefront', 'search-refresh'), [], []);
  const file = search.find(file => file.path === 'src/components/AccountSearch.tsx');
  assert.deepEqual([file.status, file.additions, file.deletions], ['M', 1, 1]);
  const target = scope('trailblazer-crm', 'main');
  const work = workForProfile('am').find(work => work.projectId === target.projectId && work.worktreeId === target.worktreeId && work.source);
  assert(work, 'Fixture has an editable primary-branch file');
  const canvas = workCanvasInput(work), saved = { id: canvasId(canvas.kind, canvas.params), canvas, target, surface: work.surfaceId, fields: { source: '// Added review note\n' + work.source }, revision: 2 };
  const before = projectFiles('am', target).find(file => file.path === workFilePath(work));
  assert(before);
  const changes = workspaceChanges('am', target, [], [saved]);
  const change = changes.find(file => file.path === before.path);
  assert(change.additions > 0); assert.equal(change.deletions, 0); assert.equal(change.canvas.kind, 'work');
  assert(!workspaceChanges('am', target, [], [{ ...saved, fields: { source: work.source } }]).some(file => file.path === before.path), 'Restoring original source clears its change');
  assert(!workspaceChanges('am', scope('trailblazer-crm', 'lead-routing'), [], [saved]).some(file => file.canvas.kind === 'work'));
  assert(!workspaceChanges('am', scope(), [], [saved]).length);
});
