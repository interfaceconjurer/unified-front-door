import test, { after } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules();
after(() => modules.cleanup());
const { modelExecution, captureModelExecution } = modules.load("lib/server/model-context");
const { MODEL_POLICY, serializeModelRequest } = modules.load("lib/server/model-provider");
const { parseAgentCommand } = modules.load("lib/agent/contracts");
const settings = { policy: MODEL_POLICY, globalDailyCalls: 10, namespaceDailyCalls: 5 };
const context = { profile: modules.load("lib/demo-profiles").demoProfileById("sp"), target: { projectId: null, worktreeId: null, orgId: "prod" }, surface: "home", capturedAt: "2026-09-16T00:00:00Z", projectName: "Workspace", branch: "Planning", orgLabel: null, improvement: null };
const finding = (id, orgId = "prod") => ({ id, orgId, title: `Finding ${id}`, runId: "assessment", evidence: ["Captured sample evidence"] });
const assessment = { currentRunId: "assessment", runs: [{ id: "assessment", scopeOrgIds: ["prod", "sit"], completedAt: "2026-09-16T00:00:00Z", source: { adapter: "demo", version: "1" }, findings: [finding("A"), finding("B", "sit")] }] };
const evidence = execution => JSON.parse(execution.prompt.messages.at(-1).content).evidence;

test("model snapshot includes completed evidence and detaches all mutable source records", () => {
  const original = structuredClone(assessment), config = structuredClone(settings), captured = modelExecution(context, original, "Explain the findings", [], config);
  original.runs[0].findings[0].title = "Changed after submission"; config.globalDailyCalls = 99;
  assert.equal(evidence(captured).findings[0].title, "Finding A"); assert.equal(captured.settings.globalDailyCalls, 10);
  assert.equal(evidence(captured).provenance.dataSource, "demo-workspace");
  const incomplete = modelExecution(context, { ...assessment, runs: [{ ...assessment.runs[0], completedAt: null }] }, "Explain", [], settings);
  assert.deepEqual(evidence(incomplete).findings, []); assert.equal(evidence(incomplete).assessment, null);
});

test("standalone org scope and owned project source evidence remain distinct", () => {
  const scoped = { ...context, target: { ...context.target, orgId: "sit" } };
  assert.deepEqual(evidence(modelExecution(scoped, assessment, "Explain", [], settings)).findings.map(f => f.id), ["B"]);
  const project = { ...scoped, improvement: { id: "project", runId: "assessment", revision: 2, name: "Captured plan", targetOrgId: "sit", goal: "Investigate production evidence in a sandbox", workItems: [finding("A")].map(f => ({ id: f.id, findingId: f.id, status: "planned", finding: f })) } };
  const rescanned = { ...assessment, currentRunId: "new-rescan", runs: [...assessment.runs, { ...assessment.runs[0], id: "new-rescan" }] };
  const projected = evidence(modelExecution(project, rescanned, "Explain", [], settings));
  assert.deepEqual(projected.findings.map(f => f.id), ["A"]); assert.deepEqual(projected.project.workItems.map(item => item.findingId), ["A"]);
  assert.equal(projected.project.targetOrgId, "sit"); assert.deepEqual(projected.project.sourceOrgIds, ["prod"]);
  assert.equal(projected.project.sourceRunId, "assessment"); assert.equal(projected.assessment.id, "assessment");
  assert.deepEqual(evidence(modelExecution({ ...scoped, target: { ...scoped.target, orgId: "unrepresented" } }, assessment, "Explain", [], settings)).findings, []);
});

test("input budget trims whole history pairs and findings with explicit omissions", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ messageId: i, runId: `run-${Math.floor(i / 2)}`, role: i % 2 ? "assistant" : "user", content: "🙂".repeat(1200) }));
  const large = { ...assessment, runs: [{ ...assessment.runs[0], findings: Array.from({ length: 30 }, (_, i) => ({ ...finding(String(i)), evidence: ["é".repeat(2000)] })) }] };
  const captured = modelExecution(context, large, "Keep this exact user request", history, settings), body = serializeModelRequest(captured.prompt, captured.settings.policy);
  assert.ok(Buffer.byteLength(body) <= MODEL_POLICY.maxRequestBytes); assert.ok(captured.provenance.omittedFindings > 0); assert.ok(captured.provenance.omittedHistoryMessages > 0);
  assert.equal(captured.prompt.messages[0].role, "user"); assert.equal(captured.provenance.history.length % 2, 0);
  assert.equal(JSON.parse(captured.prompt.messages.at(-1).content).request, "Keep this exact user request");
  assert.throws(() => modelExecution(context, assessment, "🙂".repeat(40000), [], settings), error => error.code === "input_limit");
});

test("captured history excludes Today blobs, greetings, incomplete turns, and failed replies", async () => {
  const conversation = { scopeKey: "home", messages: [
    { id: 1, role: "today", snapshot: { privateUI: "Do not send" } }, { id: 2, role: "agent", text: "Greeting" },
    { id: 3, role: "user", text: "Acknowledged question", turnId: "good" }, { id: 4, role: "agent", text: "Acknowledged answer", turnId: "good", runId: "good-run" },
    { id: 5, role: "user", text: "Failed question", turnId: "failed" }, { id: 6, role: "agent", text: "Partial failure", turnId: "failed", runId: "failed-run" },
    { id: 7, role: "user", text: "Pending question", turnId: "pending" }, { id: 8, role: "agent", text: "", turnId: "pending", runId: "pending-run" },
  ] };
  const captured = await captureModelExecution({ query: async () => ({ rows: [{ id: "good-run", turn_id: "good" }] }) }, { namespaceId: "n", profileId: "jw", workspaceEpoch: "e" }, "conversation", conversation, context, assessment, "Next request", settings);
  assert.deepEqual(captured.prompt.messages.slice(0, -1), [{ role: "user", content: "Acknowledged question" }, { role: "assistant", content: "Acknowledged answer" }]);
  assert.deepEqual(captured.provenance.history.map(h => h.messageId), [3, 4]);
  assert.ok(!JSON.stringify(captured).includes("Do not send")); assert.ok(!JSON.stringify(captured).includes("Partial failure"));
});

test("public commands cannot select provider, prompt, budget scope, model or execution", () => {
  const command = { kind: "submit", requestId: "request", context: { target: context.target, surface: "home" }, text: "Explain" };
  for (const field of ["provider", "model", "execution", "settings", "budgetScope", "prompt"]) assert.throws(() => parseAgentCommand({ ...command, [field]: "client controlled" }));
});

test("v3 offers scoped navigation only for the current explicit request; old history cannot authorize it", () => {
  const current = { ...context, profile: modules.load("lib/demo-profiles").demoProfileById("am"), target: { projectId: null, worktreeId: null, orgId: "uat" } };
  const history = [{ messageId: 1, runId: "old", role: "user", content: "Open Code" }, { messageId: 2, runId: "old", role: "assistant", content: "Code is available." }];
  for (const request of ["Help me plan a React app", "Show me how to open Account", "Open Account, but stay here", 'Explain the example "open Code"']) {
    const captured = modelExecution(current, assessment, request, history, settings);
    assert.equal(captured.prompt.navigation, undefined, request);
    assert.equal(JSON.parse(serializeModelRequest(captured.prompt, settings.policy)).tools, undefined);
    assert.equal(captured.provenance.history.length, 2);
  }
  const captured = modelExecution(current, assessment, "Please open Account object", history, settings);
  assert.ok(captured.prompt.navigation.some(option => option.id === "resource:standard-object:Account"));
  assert.ok(captured.prompt.navigation.every(option => JSON.stringify(option.destination.target) === JSON.stringify(current.target)));
  assert.equal(modelExecution(current, assessment, "Explain", [], { ...settings, policy: { ...settings.policy, promptVersion: "workspace-explainer-v1" } }).prompt.navigation, undefined);
  assert.ok(modelExecution(current, assessment, "Explain", [], { ...settings, policy: { ...settings.policy, promptVersion: "workspace-navigator-v2" } }).prompt.navigation.length);
});

test('model requests include saved project intent without treating the brief as a created project', () => {
  const brief = { id: 'brief', revision: 2, source: 'planning-brief', name: 'Service app', projectType: 'react', goal: 'Reduce handoffs', context: 'Use existing sign-in' };
  const execution = modelExecution({ ...context, projectBrief: brief }, assessment, 'Help plan the first step', [], settings);
  brief.context = 'Changed later';
  assert.equal(evidence(execution).projectBrief.context, 'Use existing sign-in');
  assert.equal(evidence(execution).projectBrief.projectType, 'react');
  assert.equal(evidence(execution).project, null);
  const improvement = { id: 'p', revision: 1, name: 'Agent plan', runId: 'assessment', targetOrgId: 'uat', projectType: 'agent', goal: 'Triage service requests', context: 'Require approval before sending a reply', workItems: [] };
  const created = evidence(modelExecution({ ...context, improvement }, assessment, 'What should we do next?', [], settings));
  assert.equal(created.project.projectType, 'agent'); assert.equal(created.project.context, improvement.context);
});

test('a project created from a brief keeps its intent without inheriting the current org assessment', () => {
  const improvement = { id: 'p', revision: 1, name: 'Service app', source: 'brief', runId: null, targetOrgId: null, projectType: 'react', goal: 'Reduce handoffs', context: 'Use existing sign-in', workItems: [] };
  const captured = evidence(modelExecution({ ...context, improvement }, assessment, 'Plan the first milestone', [], settings));
  assert.equal(captured.project.goal, improvement.goal);
  assert.equal(captured.project.context, improvement.context);
  assert.equal(captured.project.sourceRunId, null);
  assert.equal(captured.assessment, null);
  assert.deepEqual(captured.findings, []);
});

test('permission reasoning captures current workspace assignments separately from the connected org', () => {
  const permissionContext = { ...context, surface: 'build', target: { ...context.target, orgId: 'uat' },
    canvas: { kind: 'org-resource', title: 'Service Reps', params: { orgId: 'prod', resourceType: 'permission-set-group', apiName: 'Service_Reps' } },
    permissions: { revision: 4, fields: { maya_chen: 'standard' } } };
  const captured = modelExecution(permissionContext, assessment, 'How should we validate this change?', [], settings);
  permissionContext.permissions.fields.maya_chen = '';
  const permissions = evidence(captured).permissions;
  assert.equal(permissions.sourceOrgId, 'prod'); assert.equal(permissions.revision, 4);
  assert.equal(permissions.users.find(user => user.id === 'maya_chen').canDelete, false);
  assert.equal(permissions.users.filter(user => user.canDelete).length, 5);
  assert.match(permissions.state, /connected org has not been changed/);
  assert.equal(evidence(captured).workspace.target.orgId, 'uat');
});
