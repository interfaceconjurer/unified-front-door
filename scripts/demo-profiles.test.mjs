import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { DEMO_PROFILES, demoProfileById, PROFILE_SCENARIOS } = modules.load('lib/demo-profiles');
const { projectsForProfile, workForProfile } = modules.load('lib/workspace/demo-workspace');
const { workCanvasInput, RETURNING_WORK } = modules.load('lib/workspace/returning-work');
const { navigationOptions } = modules.load('lib/agent/navigation');
const { destinationHref, readDestination, resolveDestination } = modules.load('lib/navigation/model');
const { assessmentCanvas } = modules.load('lib/assessment/canvas');
const { emptyState, migrateCanvasSurfaces } = modules.load('lib/surface-canvas/persistence');
const { canvasId, inputFromCanonicalId, parseCanvasInput } = modules.load('lib/surface-canvas/model');
const { updateConversation } = modules.load('lib/chat/conversation');
const { captureToday } = modules.load('lib/chat/today-snapshot');
const { INITIAL } = modules.load('lib/assessment/state-codec');
const target = { projectId: null, worktreeId: null, orgId: 'uat' };

test('four expansion scenarios expose exactly their promised surfaces and coherent sample work', () => {
  assert.deepEqual(DEMO_PROFILES.map(profile => profile.id), ['sp', 'kf', 'jw', 'am']);
  const expected = { sp: ['build', 'alm'], kf: ['build', 'alm'], jw: ['build', 'alm', 'govern'], am: ['build', 'code', 'govern', 'alm'] };
  for (const profile of DEMO_PROFILES) {
    assert.deepEqual(profile.surfaceAccess, expected[profile.id]);
    assert(PROFILE_SCENARIOS[profile.id].description);
    const projects = projectsForProfile(profile.id), work = workForProfile(profile.id);
    for (const item of work) {
      assert(profile.surfaceAccess.includes(item.surfaceId));
      assert(projects.some(project => project.id === item.projectId && (item.worktreeId === null ? project.worktrees.length === 0 : project.worktrees.some(tree => tree.id === item.worktreeId))));
    }
    const options = navigationOptions({ profile, target, surface: 'home', orgLabel: 'UAT Sandbox' });
    assert(options.every(option => expected[profile.id].includes(option.destination.surface)));
    for (const surface of ['build', 'alm', 'govern', 'code']) assert.equal(
      resolveDestination('/' + surface, profile.id, profile.surfaceAccess, {}).kind,
      profile.surfaceAccess.includes(surface) ? 'absent' : 'unavailable');
  }
  assert.equal(projectsForProfile('sp').length, 0);
  assert.equal(projectsForProfile('kf').length, 2);
  assert(projectsForProfile('kf').every(project => project.worktrees.length === 0));
  assert.equal(projectsForProfile('jw').length, 4);
  assert.deepEqual(projectsForProfile('jw').map(project => project.worktrees.filter(tree => !tree.isPrimary).length), [2, 2, 0, 0]);
  assert.equal(projectsForProfile('am').length, 6);
  assert(projectsForProfile('am').every(project => project.worktrees.some(tree => !tree.isPrimary)));
  assert(projectsForProfile('kf')[0].facets.objects < projectsForProfile('am')[1].facets.objects);
  assert.equal(workForProfile('kf').length, 4);
  assert(workForProfile('kf').every(work => work.worktreeId === null));
  assert.equal(workForProfile('jw').filter(work => work.attention).length, 4);
  assert.equal(workForProfile('am').length, 21);
  assert(projectsForProfile('jw')[0].agentSessions.every(session => !/refactoring|code review/i.test(session.summary)));
});

test('direct global work links cannot reach another scenario’s sample project or unavailable surface', () => {
  for (const profile of DEMO_PROFILES) for (const work of RETURNING_WORK) {
    const destination = { version: 1, owner: profile.id, surface: work.surfaceId, target,
      canvasTarget: { projectId: work.projectId, worktreeId: work.worktreeId, orgId: 'uat' }, canvas: workCanvasInput(work) };
    assert.equal(resolveDestination(destinationHref(destination), profile.id, profile.surfaceAccess, {}).kind,
      workForProfile(profile.id).some(item => item.id === work.id) ? 'available' : 'unavailable');
  }
});

test('old Govern assessment links and tab preferences retain exact evidence in Build', () => {
  const canvas = assessmentCanvas({ scope: 'unbound', orgId: 'uat' }, 'captured-run', { id: 'finding-1', title: 'API usage' });
  const id = canvasId(canvas.kind, canvas.params), original = { version: 1, owner: 'sp', surface: 'govern', target, canvas };
  const legacyHref = '/govern?destination=' + encodeURIComponent(JSON.stringify(original));
  const result = readDestination(legacyHref);
  assert.deepEqual(result, { kind: 'destination', value: { ...original, surface: 'build' } });
  assert.equal(resolveDestination(legacyHref, 'sp', demoProfileById('sp').surfaceAccess, {}).kind, 'available');
  const state = emptyState();
  state.govern = { canvases: [{ ...canvas, id }], activeCanvasId: id, targets: { [id]: target }, closedDrafts: {} };
  const moved = migrateCanvasSurfaces(state);
  assert.equal(moved.build.activeCanvasId, id);
  assert.deepEqual(moved.build.canvases[0].params, canvas.params);
  assert.deepEqual(moved.build.targets[id], target);
  assert.equal(moved.govern.canvases.length, 0);
  assert.equal(state.govern.canvases.length, 1, 'Migration does not mutate its input');
});

test('an existing trailing Today adopts the new scenario once without duplicating cards or rewriting history', () => {
  const profile = demoProfileById('kf');
  const snapshot = captureToday({ profile: { ...profile, experience: 'new', workspaceExperience: 'empty' }, capturedAt: '2026-09-20T12:00:00Z', projectName: 'All projects', branch: '', scope: 'global', hasProjects: false, recent: [], working: 0, assessment: INITIAL });
  const old = { id: 1, role: 'today', snapshot };
  const thread = { scopeKey: 'home', messages: [old, { id: 2, role: 'agent', text: 'Earlier work' }, { ...old, id: 3 }] };
  const fresh = captureToday({ ...snapshot, profile, capturedAt: '2026-09-22T12:00:00Z', hasProjects: true, recent: workForProfile('kf'), assessment: INITIAL });
  const next = updateConversation(thread, { type: 'today', snapshot: fresh });
  assert.equal(next.messages.length, 3);
  assert.equal(next.messages[0], old);
  assert.equal(next.messages[2].id, 3);
  assert.equal(next.messages[2].snapshot.capturedAt, snapshot.capturedAt);
  assert.equal(next.messages[2].snapshot.recent.length, 4);
  assert.equal(next.messages[2].snapshot.profile.workspaceExperience, 'established');
  assert.equal(updateConversation(next, { type: 'today', snapshot: fresh }), next);
  const reordered = { ...fresh, profile: Object.fromEntries(Object.entries(fresh.profile).reverse()) };
  assert.equal(updateConversation(next, { type: 'today', snapshot: reordered }), next, 'Postgres JSON property ordering must not refresh an unchanged briefing');
});

const { allSessionRows } = modules.load('lib/workspace/selectors');
test('project-only work and chats use null scope, round-trip drafts and remain accessible to the agent', () => {
  for (const profile of DEMO_PROFILES) {
    const projects = projectsForProfile(profile.id), work = workForProfile(profile.id);
    for (const project of projects) {
      assert(work.some(item => item.projectId === project.id), `${profile.id}/${project.id}: has sample work`);
      const sessions = allSessionRows([project]);
      assert.equal(sessions.length, project.agentSessions.length, 'No orphaned sample sessions');
      for (const row of sessions) assert.equal(row.worktree?.id ?? null, row.session.worktreeId);
    }
    for (const item of work.filter(item => item.worktreeId === null)) {
      const canvas = workCanvasInput(item), id = canvasId(canvas.kind, canvas.params);
      assert.deepEqual(parseCanvasInput(canvas), canvas);
      assert.deepEqual(inputFromCanonicalId(id).params, canvas.params);
      const scoped = { ...target, projectId: item.projectId };
      const options = navigationOptions({ profile, target: scoped, surface: item.surfaceId, orgLabel: 'UAT Sandbox' });
      assert(options.some(option => option.destination.canvas?.params.workId === item.id));
    }
  }
});
