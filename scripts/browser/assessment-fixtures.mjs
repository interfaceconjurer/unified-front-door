import { randomUUID } from 'node:crypto';
import { install, session, assessment } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';

/** Browser fixtures use the existing domain transitions; no live provider or database. */
export async function installAssessment(context, { profileId = 'sp', beforeCommand } = {}) {
  const modules = testModules();
  const { captureFindings } = modules.load('lib/assessment/model');
  const { ASSESSMENT_FINDINGS, ASSESSMENT_ORGS } = modules.load('lib/onboarding/assessment');
  const { projectFromBrief, briefSourceId } = modules.load('lib/projects/from-brief');
  const { applyAssessmentCommand } = modules.load('lib/application/assessment-commands');
  const { updateConversation } = modules.load('lib/chat/conversation');
  const { captureToday } = modules.load('lib/chat/today-snapshot');
  const profile = modules.load('lib/demo-profiles').demoProfileById(profileId);
  const { projectsForProfile, workForProfile } = modules.load('lib/workspace/demo-workspace');
  const projects = projectsForProfile(profileId);
  const recent = workForProfile(profileId).map(work => {
    const project = projects.find(project => project.id === work.projectId);
    return { ...work, projectName: project.name, branch: project.worktrees.find(tree => tree.id === work.worktreeId)?.branch };
  });
  const { state, stats } = await install(context, { drafts: 0, messages: 0 });
  const current = { ...session, profileId }, commands = [];
  const run = { id: 'captured-original', startedAt: '2026-09-19T11:00:00Z', completedAt: '2026-09-19T11:05:00Z', scopeOrgIds: ['prod', 'uat'], source: { adapter: 'demo-org-assessment', version: '1' },
    findings: captureFindings('captured-original', ASSESSMENT_FINDINGS, ASSESSMENT_ORGS, '2026-09-19T11:05:00Z') };
  run.findings[0].evidence = ['Original captured evidence remains readable after later assessments.'];
  state.snapshot.session = current;
  state.snapshot.assessment = { ...structuredClone(assessment), status: 'complete', step: 5, completedAt: run.completedAt, scopeOrgIds: run.scopeOrgIds, runs: [run], currentRunId: run.id };
  state.agent.conversations = [];
  await context.route('**/api/session', route => route.fulfill({ json: { session: current } }));
  await context.route('**/api/agent*', route => {
    const request = route.request(), id = new URL(request.url()).searchParams.get('runId');
    if (request.method() === 'GET') return route.fulfill({ json: id ? { run: state.agent.runs.find(run => run.id === id), events: [] } : state.agent });
    const command = request.postDataJSON().command; commands.push(command);
    if (command.kind === 'retry') {
      const previous = state.agent.runs.find(run => run.id === command.runId);
      if (!previous) throw new Error('Missing assessment attempt');
      const next = { ...previous, id: randomUUID(), retryOf: previous.id, status: 'pending', error: null };
      state.agent.runs.push(next);
      return route.fulfill({ json: { result: { run: next } } });
    }
    if (command.kind !== 'visit') throw new Error('Assessment navigation must not invoke model work');
    const target = command.context.target, threadKey = JSON.stringify(target.projectId ? ['project-session', target.projectId, target.worktreeId] : ['unbound-session', null]);
    let saved = state.agent.conversations.find(saved => saved.threadKey === threadKey);
    if (!saved) { saved = { id: randomUUID(), threadKey, revision: 0, conversation: { scopeKey: 'home', messages: [] } }; state.agent.conversations.push(saved); }
    const today = captureToday({ capturedAt: new Date().toISOString(), profile, scope: 'global', projectName: 'All projects', branch: '', hasProjects: !!recent.length || !!state.snapshot.assessment.projects.length, recent, working: recent.filter(work => work.status === 'working').length, assessment: state.snapshot.assessment });
    const withOrg = updateConversation(saved.conversation, { type: 'org', orgId: target.orgId, label: ASSESSMENT_ORGS.find(org => org.id === target.orgId)?.label ?? null });
    saved.conversation = updateConversation(withOrg, command.context.surface === 'home'
      ? target.projectId ? { type: 'project', label: 'Project', reply: 'Your saved project plan is ready to review.' } : { type: 'today', snapshot: today, force: command.refreshToday }
      : { type: 'surface', scopeKey: command.context.surface, label: command.context.surface, reply: 'Continue with the captured workspace.' });
    saved.revision++;
    return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
  });
  await context.route('**/api/application*', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: state.snapshot });
    const command = route.request().postDataJSON().command;
    if (command.kind.startsWith('canvas.')) return route.fallback();
    commands.push(command);
    await beforeCommand?.(command);
    if (command.kind === 'project.createFromBrief') {
      let project = state.snapshot.assessment.projects.find(project => project.sourceDraftId === briefSourceId(command.sourceId, command.sourceRevision));
      if (!project) {
        const source = state.snapshot.canvases.find(canvas => canvas.id === command.sourceId);
        project = projectFromBrief(source, command.sourceRevision, profile.name, command.commandId, new Date().toISOString(), 'project-' + randomUUID());
        state.snapshot.assessment.projects.push(project); state.snapshot.assessmentRevision++;
        source.fields = {}; source.revision++;
      }
      return route.fulfill({ json: { result: { revision: state.snapshot.assessmentRevision, project } } });
    }
    const saved = applyAssessmentCommand(state.snapshot.assessment, command, { id: randomUUID, now: new Date().toISOString(), owner: profile.name });
    state.snapshot.assessment = saved; state.snapshot.assessmentRevision++;
    if (command.kind.startsWith('assessment.')) {
      const status = saved.status === 'running' ? 'running' : saved.status === 'complete' ? 'completed' : 'cancelled';
      state.agent.runs = [{ id: 'execution-' + saved.currentRunId, requestId: command.commandId, turnId: null, conversationId: null, retryOf: null, kind: 'assessment', status, sequence: state.snapshot.assessmentRevision,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assessmentRunId: saved.currentRunId,
        context: { target: { projectId: null, worktreeId: null, orgId: 'uat' }, surface: 'home' }, error: null, result: null, checkpoint: saved.step }];
    }
    return route.fulfill({ json: { result: { revision: state.snapshot.assessmentRevision, ...(command.kind === 'project.create' ? { project: saved.projects.find(project => project.createCommandId === command.commandId) } : {}) } } });
  });
  return { state, stats, commands, run, profile, cleanup: modules.cleanup };
}
