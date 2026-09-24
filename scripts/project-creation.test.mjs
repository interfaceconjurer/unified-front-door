import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { projectCreationCanvas, projectDraftView } = modules.load("lib/projects/creation");
const { capabilitiesForSurface } = modules.load("lib/surface-canvas/capabilities");
const { canvasTarget } = modules.load("lib/surface-canvas/model");
const { applyAssessmentCommand } = modules.load("lib/application/assessment-commands");
const { INITIAL } = modules.load("lib/assessment/state-codec");
const { captureFindings } = modules.load("lib/assessment/model");
const { ASSESSMENT_FINDINGS, ASSESSMENT_ORGS } = modules.load("lib/onboarding/assessment");
const { liveAssessmentView, assessmentBriefing } = modules.load("lib/chat/today-snapshot");
const source = { id: "original", completedAt: "2026-09-19T12:00:00Z", startedAt: "2026-09-19T11:59:00Z", scopeOrgIds: ["prod", "uat"],
  findings: captureFindings("original", ASSESSMENT_FINDINGS, ASSESSMENT_ORGS, "2026-09-19T12:00:00Z"), source: { adapter: "demo-org-assessment", version: "1" } };
const completed = { ...INITIAL, status: "complete", currentRunId: source.id, runs: [source] };
const begin = { kind: "draft.begin", runId: source.id, fields: { name: "Captured plan", goal: "Keep the original evidence", targetOrgId: "sit", findingIds: [source.findings[0].id] }, commandId: "begin", expectedRevision: 0 };
const ctx = { id: () => "test-id", now: "2026-09-19T12:02:00Z", owner: "Sam Patel" };

test("the shared project capability is a scoped planning brief with explicit project fields", () => {
  const capability = capabilitiesForSurface("alm").find(capability => capability.id === "project");
  assert.ok(capability); assert.deepEqual(capability.fields.map(field => field.id), ["name", "projectType", "goal", "context", "repository"]);
  for (const scope of [{ scope: "unbound", orgId: "uat" }, { scope: "project", projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" }]) {
    const input = projectCreationCanvas(scope);
    assert.equal(input.params.capability, "project"); assert.equal(input.params.surface, "alm");
    assert.deepEqual(canvasTarget(input, {}), { projectId: scope.projectId ?? null, worktreeId: scope.worktreeId ?? null, orgId: scope.orgId });
  }
});

test("project review retains draft source findings while Today follows a new scan without rewriting captured history", () => {
  const drafted = applyAssessmentCommand(completed, begin, ctx), history = assessmentBriefing(drafted), originalHistory = JSON.stringify(history);
  const rescanned = applyAssessmentCommand(drafted, { kind: "assessment.rescan", orgIds: ["uat"], commandId: "scan", expectedRevision: 1 }, ctx);
  const view = projectDraftView(rescanned);
  assert.equal(view.draft.id, drafted.draft.id); assert.equal(view.run.id, source.id); assert.equal(view.sourceAvailable, true);
  assert.equal(view.findings[0].id, source.findings[0].id); assert.deepEqual(view.findings[0].evidence, source.findings[0].evidence);
  assert.deepEqual(liveAssessmentView(rescanned).findings, []);
  assert.equal(JSON.stringify(history), originalHistory); assert.equal(history.draft.name, "Captured plan"); assert.equal(history.draft.goal, "Keep the original evidence");
  const created = applyAssessmentCommand(rescanned, { kind: "project.create", draftId: view.draft.id, draftRevision: view.draft.revision, commandId: `create:${view.draft.id}`, expectedRevision: 2 }, ctx);
  assert.equal(created.draft, null); assert.equal(created.projects[0].runId, source.id); assert.deepEqual(created.projects[0].workItems[0].finding, source.findings[0]);
});

test("missing, foreign or allocated source findings cannot be represented as a ready project draft", () => {
  const drafted = applyAssessmentCommand(completed, begin, ctx);
  assert.equal(projectDraftView({ ...drafted, runs: [] }).sourceAvailable, false);
  assert.equal(projectDraftView({ ...drafted, draft: { ...drafted.draft, findingIds: ["foreign"] } }).sourceAvailable, false);
  assert.equal(projectDraftView({ ...drafted, projects: [{ workItems: [{ findingId: source.findings[0].id }] }] }).sourceAvailable, false);
});

test("beginDraft returns only the acknowledged server draft, never a speculative draft or a timer guess", async () => {
  const { applicationClient, getActiveAssessmentStore } = modules.load("lib/application/client");
  const { RemoteWorkspaceStore, EMPTY_APPLICATION } = modules.load("lib/application/remote-store");
  const session = { namespaceId: "phase3", profileId: "sp", generation: "generation", expiresAt: "2099-01-01T00:00:00Z" };
  let saved = { ...structuredClone(EMPTY_APPLICATION), session, assessment: completed, assessmentRevision: 0 };
  let release; let gate = new Promise(resolve => { release = resolve; });
  let sent = false;
  const remote = new RemoteWorkspaceStore(session, { read: async () => structuredClone(saved), send: async (_session, command) => {
    sent = true; await gate;
    saved = { ...saved, assessment: applyAssessmentCommand(saved.assessment, command, ctx), assessmentRevision: saved.assessmentRevision + 1 };
    return { revision: saved.assessmentRevision, ...(command.kind === "project.create" ? { project: saved.assessment.projects.at(-1) } : {}) };
  } }, "phase3-test", () => {});
  await remote.load(); applicationClient.workspace = remote;
  try {
    const adapter = getActiveAssessmentStore();
    let settled = false;
    const pending = adapter.beginDraft(source.id, begin.fields).then(draft => { settled = true; return draft; });
    await Promise.resolve(); assert.equal(sent, true); assert.equal(settled, false); assert.equal(adapter.getSnapshot().draft, null); assert.equal(adapter.isBeginningDraft(), true);
    release(); const acknowledged = await pending;
    assert.deepEqual(acknowledged, saved.assessment.draft); assert.equal(acknowledged.runId, source.id); assert.equal(remote.getPersistenceSnapshot(), "saved");
    assert.equal(adapter.isBeginningDraft(), false);
    gate = new Promise(resolve => { release = resolve; });
    const creation = adapter.createProject("Sam Patel", { draftId: acknowledged.id, expectedRevision: acknowledged.revision, commandId: `create:${acknowledged.id}` });
    assert.equal(adapter.isCreatingProject(acknowledged.id), true, "Re-entered views can recognize a draft already being consumed");
    assert.equal(adapter.isCreatingProject("another-draft"), false);
    release(); const project = await creation;
    assert.equal(project.sourceDraftId, acknowledged.id); assert.equal(adapter.isCreatingProject(acknowledged.id), false);
  } finally { applicationClient.workspace = null; remote.deactivate(); }
});

test("project type and context survive edits, persisted decoding and project creation; old drafts still load", () => {
  const { parseCommand } = modules.load('lib/application/contracts');
  const { parseDraft, parseProject } = modules.load('lib/projects/codec');
  let state = applyAssessmentCommand(completed, begin, ctx);
  assert.equal(parseDraft(state.draft, source.id, false).projectType, undefined);
  for (const [field, value] of [['projectType', 'mulesoft'], ['context', 'Connect CRM and billing; preserve existing customer IDs.']]) {
    const command = parseCommand({ kind: 'draft.edit', commandId: field, expectedRevision: 1, draftId: state.draft.id, edit: { field, value } });
    state = applyAssessmentCommand(state, command, ctx);
  }
  state.draft = parseDraft(JSON.parse(JSON.stringify(state.draft)), source.id, false);
  const result = applyAssessmentCommand(state, { kind: 'project.create', draftId: state.draft.id, draftRevision: state.draft.revision, commandId: 'create-intent', expectedRevision: 3 }, ctx);
  const project = parseProject(JSON.parse(JSON.stringify(result.projects[0])), false);
  assert.equal(project.projectType, 'mulesoft'); assert.equal(project.context, state.draft.context);
  assert.equal(project.goal, begin.fields.goal); assert.equal(project.workItems[0].findingId, source.findings[0].id);
  for (const edit of [{ field: 'projectType', value: 'invented-type' }, { field: 'context', value: 'x'.repeat(6001) }]) {
    assert.throws(() => parseCommand({ kind: 'draft.edit', commandId: 'bad', expectedRevision: 1, draftId: state.draft.id, edit }));
    assert.throws(() => parseCommand({ ...begin, fields: { ...begin.fields, [edit.field]: edit.value } }));
  }
});

test("agent planning briefs respect org, project, worktree and surface boundaries", () => {
  const { projectBriefForContext } = modules.load('lib/projects/brief-context');
  const target = { projectId: null, worktreeId: null, orgId: 'uat' };
  const fields = { name: 'Service app', projectType: 'react', goal: 'Reduce manual handoffs', context: 'Use existing sign-in' };
  const saved = { id: 'brief', revision: 3, surface: 'alm', canvas: projectCreationCanvas({ scope: 'unbound', orgId: 'uat' }), target, fields };
  const workspace = { assessment: { draft: null }, canvases: [saved] };
  assert.equal(projectBriefForContext(workspace, target, 'alm').projectType, 'react');
  for (const other of [{ ...target, orgId: 'sit' }, { ...target, projectId: 'trailblazer-crm', worktreeId: 'main' }]) {
    assert.equal(projectBriefForContext(workspace, other, 'alm'), undefined);
  }
  assert.equal(projectBriefForContext(workspace, target, 'build'), undefined);
  const projectTarget = { ...target, projectId: 'trailblazer-crm', worktreeId: 'main' };
  const scoped = { ...workspace, canvases: [{ ...saved, target: projectTarget }] };
  assert.equal(projectBriefForContext(scoped, { ...projectTarget, worktreeId: 'lead-routing' }, 'alm'), undefined);
  const draft = { ...begin.fields, id: 'assessment-draft', revision: 2, projectType: 'agent' };
  assert.equal(projectBriefForContext({ ...workspace, assessment: { draft } }, { ...target, orgId: 'sit' }, 'alm').source, 'assessment-draft');
});

test('general projects retain intent without fabricating assessment runs or repository connections', () => {
  const { projectFromBrief } = modules.load('lib/projects/from-brief');
  const { decodeAssessment } = modules.load('lib/assessment/state-codec');
  const brief = { id: 'brief', surface: 'alm', canvas: projectCreationCanvas({ scope: 'unbound' }), target: { projectId: null, worktreeId: null, orgId: null }, revision: 2,
    fields: { name: 'Mobile service', goal: 'Reduce handoffs', projectType: 'mobile', context: 'Offline first', repository: 'https://github.com/team/mobile-service' } };
  const project = projectFromBrief(brief, 2, 'Jordan', 'create', '2026-09-20T12:00:00Z', 'p');
  assert.equal(project.source, 'brief'); assert.equal(project.runId, null); assert.equal(project.targetOrgId, null);
  assert.equal(project.context, 'Offline first'); assert.equal(project.projectType, 'mobile'); assert.deepEqual(project.workItems, []);
  const decoded = decodeAssessment({ ...INITIAL, projects: [project] });
  assert.equal(decoded.value.projects[0].repository, brief.fields.repository);
  assert.throws(() => projectFromBrief(brief, 1, 'Jordan', 'create', '', 'p'), error => error.code === 'conflict');
  for (const fields of [{ ...brief.fields, name: ' ' }, { ...brief.fields, goal: '' }, { ...brief.fields, projectType: 'unknown' }, { ...brief.fields, repository: 'javascript:alert(1)' }]) {
    assert.throws(() => projectFromBrief({ ...brief, fields }, 2, 'Jordan', 'create', '', 'p'));
  }
});

test('assessment projects can be saved without a deployment target and never infer one from the connection', () => {
  const { decodeAssessment } = modules.load('lib/assessment/state-codec');
  const { parseCommand } = modules.load('lib/application/contracts');
  const optional = parseCommand({ ...begin, fields: { ...begin.fields, targetOrgId: '' } });
  const context = { id: () => 'optional', owner: 'Sam', now: '2026-09-23T12:00:00Z' };
  const pending = applyAssessmentCommand(completed, optional, context);
  const saved = applyAssessmentCommand(pending, { kind: 'project.create', draftId: pending.draft.id, draftRevision: 1, expectedRevision: 1, commandId: 'create-optional' }, context);
  assert.equal(saved.projects[0].targetOrgId, null);
  assert.deepEqual(decodeAssessment(saved).value.projects, saved.projects);
  assert.equal(saved.projects[0].workItems[0].finding.id, source.findings[0].id);
});
