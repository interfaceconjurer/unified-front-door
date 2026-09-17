process.env.AGENT_PROVIDER = "demo";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { testModules } from "./test-modules.mjs";
if (!process.env.DATABASE_TEST_URL) throw new Error("DATABASE_TEST_URL must explicitly identify an isolated development/test database.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const modules = testModules();
const { transaction, databasePool } = modules.load("lib/db");
const { bootstrap, changeSession, requireSession } = modules.load("lib/server/session");
const { executeCommand } = modules.load("lib/server/application");
const { executeAgentCommand, observeAgent, observeRunEvents } = modules.load("lib/server/agent");
const { claimRun, applyStep, workerTick, reconcileEffect } = modules.load("lib/server/agent-worker");
const { readWorkspace } = modules.load("lib/server/repository");
const { demoAdapter, deterministicAdapter } = modules.load("lib/agent/demo");
const namespaces = [];
const namespaceJournal = join(tmpdir(), `ufd-phase5-agent-test-namespaces-${process.pid}-${randomUUID()}.json`);
const journalNamespaces = () => writeFileSync(namespaceJournal, JSON.stringify(namespaces), { mode: 0o600 });
after(async () => {
  for (const id of namespaces) await transaction(async c => {
    await c.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)", [id]);
    await c.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [id]); await c.query("DELETE FROM workspaces WHERE namespace_id=$1", [id]); await c.query("DELETE FROM demo_namespaces WHERE id=$1", [id]);
  });
  namespaces.length = 0; journalNamespaces();
  await databasePool().end(); modules.cleanup();
});
async function owner(profileId = "jw") { const boot = await transaction(c => bootstrap(c)); namespaces.push(boot.session.namespaceId); journalNamespaces(); return { token: boot.token, session: await transaction(c => changeSession(c, boot.token, { action: "select", profileId, generation: boot.session.generation, commandId: randomUUID() })) }; }
const context = { target: { projectId: null, worktreeId: null, orgId: null }, surface: "home" };
const send = (s, command) => transaction(c => executeAgentCommand(c, s.token, s.session.generation, command));
const snapshot = s => transaction(c => observeAgent(c, s.token, s.session.generation));
const workspace = s => transaction(async c => readWorkspace(c, await requireSession(c, s.token, s.session.generation)));
const app = (s, kind, expectedRevision, fields = {}) => transaction(c => executeCommand(c, s.token, s.session.generation, { kind, expectedRevision, commandId: randomUUID(), ...fields }));
const chat = s => send(s, { kind: "submit", requestId: randomUUID(), context, text: "Build a scoped automation" });
const fastAdapter = { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === "progress" ? { ...result, delayMs: 0 } : result; } };
async function finish(runId) { for (let i = 0; i < 10; i++) if (!await workerTick({ runId, adapter: fastAdapter })) return; throw Error("Run did not finish"); }

test("distinct assessment starts converge and worker alone produces immutable findings", async () => {
  const s = await owner("sp"); await Promise.all([app(s, "assessment.start", 0), app(s, "assessment.start", 0)]);
  let state = await workspace(s), runs = (await snapshot(s)).runs; assert.equal(state.assessment.runs.length, 1); assert.equal(runs.length, 1);
  await assert.rejects(app(s, "assessment.advance", state.assessmentRevision), e => e.code === "invalid");
  await finish(runs[0].id); state = await workspace(s); assert.equal(state.assessment.status, "complete"); assert.ok(state.assessment.runs[0].findings.length > 0);
  const original = structuredClone(state.assessment.runs[0]); await app(s, "assessment.rescan", state.assessmentRevision, { orgIds: state.assessment.scopeOrgIds });
  runs = (await snapshot(s)).runs; await finish(runs.at(-1).id); assert.deepEqual((await workspace(s)).assessment.runs[0], original);
});
test("chat replay, namespace isolation, busy response, cursor order and retry identity", async () => {
  const s = await owner(), command = { kind: "submit", requestId: randomUUID(), context, text: "Keep original input" };
  const [a, b] = await Promise.all([send(s, command), send(s, command)]); assert.deepEqual(a, b);
  await assert.rejects(send(s, { ...command, text: "Changed payload" }), e => e.code === "conflict"); await assert.rejects(chat(s), e => e.code === "conflict");
  const other = await owner(); await assert.rejects(send(other, { kind: "cancel", requestId: randomUUID(), runId: a.runId }), e => e.code === "invalid");
  await workerTick({ runId: a.runId, adapter: deterministicAdapter({ fail: true }) });
  const retry = await send(s, { kind: "retry", requestId: randomUUID(), runId: a.runId }); assert.notEqual(retry.runId, a.runId); assert.equal(retry.turnId, a.turnId);
  await finish(retry.runId); const saved = await snapshot(s), messages = saved.conversations[0].conversation.messages;
  assert.equal(messages.filter(m => m.role === "user").length, 1); assert.equal(messages.filter(m => m.turnId === a.turnId && m.role === "agent").length, 1);
  const events = await transaction(c => observeRunEvents(c, s.token, s.session.generation, retry.runId, 1)); assert.deepEqual(events.events.map(e => e.sequence), [2, 3, 4]);
});
test("cancel, expiry reclaim, stale lease and session reset fence late publication", async () => {
  const s = await owner(), accepted = await chat(s), old = await transaction(c => claimRun(c, accepted.runId)); assert.ok(old);
  await transaction(c => c.query("UPDATE agent_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [accepted.runId]));
  const next = await transaction(c => claimRun(c, accepted.runId)); assert.equal(next.fence, old.fence + 1); assert.equal(next.run.recoveries, 1);
  assert.equal(await transaction(c => applyStep(c, old, { kind: "complete", text: "Stale" })), false);
  await send(s, { kind: "cancel", requestId: randomUUID(), runId: accepted.runId }); assert.equal(await transaction(c => applyStep(c, next, { kind: "complete", text: "Late" })), false);
  const another = await chat(s), lease = await transaction(c => claimRun(c, another.runId));
  s.session = await transaction(c => changeSession(c, s.token, { action: "reset", generation: s.session.generation, commandId: randomUUID() }));
  assert.equal(await transaction(c => applyStep(c, lease, { kind: "complete", text: "Wrong epoch" })), false); assert.deepEqual((await snapshot(s)).runs, []);
});
test("effect intent survives failure, denies blind retry, and reconciles recorded tool once", async () => {
  const s = await owner(), accepted = await chat(s); let invoked = 0, effectId;
  const tools = { "test.effect": { effect: "write", authorize: (input, authority) => input.projectId === authority.context.target.projectId,
    async execute(_input, _authority, id) { invoked++; effectId = id; throw Error("Lost effect acknowledgement"); },
    async reconcile(id) { assert.equal(id, effectId); return { kind: "complete", text: "Confirmed once" }; } } };
  await workerTick({ runId: accepted.runId, adapter: deterministicAdapter({ tool: { name: "test.effect", input: { projectId: null } } }), tools });
  const failed = (await snapshot(s)).runs[0]; assert.equal(failed.error.effects, "unknown"); assert.equal(failed.error.retryable, false);
  await assert.rejects(send(s, { kind: "retry", requestId: randomUUID(), runId: accepted.runId }), e => e.code === "conflict");
  assert.equal(await reconcileEffect(s.token, s.session.generation, accepted.runId, tools), true); assert.equal(await reconcileEffect(s.token, s.session.generation, accepted.runId, tools), false); assert.equal(invoked, 1);
  assert.equal((await snapshot(s)).runs[0].result, "Confirmed once");
});
test("cancel and persona change prevent delayed read-tool dispatch", async () => {
  for (const action of ["cancel", "persona"]) {
    const s = await owner(), accepted = await chat(s); let entered, release, calls = 0;
    const started = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
    const pending = workerTick({ runId: accepted.runId, adapter: { async step() { entered(); await gate; return { kind: "tool", name: "test.read", input: {} }; } },
      tools: { "test.read": { effect: "read", authorize: () => true, async execute() { calls++; return { kind: "complete", text: "Read" }; } } } });
    await started;
    if (action === "cancel") await send(s, { kind: "cancel", requestId: randomUUID(), runId: accepted.runId });
    else s.session = await transaction(c => changeSession(c, s.token, { action: "select", profileId: "am", generation: s.session.generation, commandId: randomUUID() }));
    release(); await pending; assert.equal(calls, 0, action);
  }
});
test("nonterminal write-tool result keeps its durable unknown effect for reconciliation", async () => {
  const s = await owner(), accepted = await chat(s);
  const tools = { "test.nonterminal": { effect: "write", authorize: () => true, async execute() { return { kind: "progress", checkpoint: 1, delayMs: 0 }; }, async reconcile() { return { kind: "complete", text: "Resolved effect" }; } } };
  await workerTick({ runId: accepted.runId, adapter: deterministicAdapter({ tool: { name: "test.nonterminal", input: {} } }), tools });
  assert.equal((await snapshot(s)).runs[0].error.effects, "unknown"); assert.equal(await reconcileEffect(s.token, s.session.generation, accepted.runId, tools), true);
});
test("expiry during business writes rolls the complete result and transcript back", async () => {
  const s = await owner(), accepted = await chat(s), lease = await transaction(c => claimRun(c, accepted.runId));
  const before = await snapshot(s); let injected = false;
  await assert.rejects(transaction(async c => {
    const query = c.query.bind(c);
    c.query = async (...args) => {
      const result = await query(...args);
      if (!injected && String(args[0]).startsWith("UPDATE agent_conversations SET conversation=")) {
        injected = true; await query("UPDATE agent_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [accepted.runId]);
      }
      return result;
    };
    try { return await applyStep(c, lease, { kind: "complete", text: "Must roll back" }); }
    finally { c.query = query; }
  }), /lease changed before publication/);
  assert.equal(injected, true); assert.deepEqual(await snapshot(s), before);
});
test("malformed complete write result retains unknown certainty instead of confirming failure", async () => {
  const s = await owner(), accepted = await chat(s);
  const tools = { "test.invalid": { effect: "write", authorize: () => true, async execute() { return { kind: "complete", text: "x".repeat(32001) }; }, async reconcile() { return { kind: "complete", text: "Trusted reconciled result" }; } } };
  await workerTick({ runId: accepted.runId, adapter: deterministicAdapter({ tool: { name: "test.invalid", input: {} } }), tools });
  const run = (await snapshot(s)).runs[0]; assert.equal(run.status, "failed"); assert.equal(run.error.effects, "unknown");
  assert.equal(await reconcileEffect(s.token, s.session.generation, accepted.runId, tools), true);
});
test("assessment tools stay read-only even when an injected registry offers writes", async () => {
  const s = await owner("sp"); await app(s, "assessment.start", 0); const run = (await snapshot(s)).runs[0]; let writes = 0;
  await workerTick({ runId: run.id, adapter: deterministicAdapter({ tool: { name: "test.write", input: {} } }), tools: { "test.write": { effect: "write", authorize: () => true, async execute() { writes++; return { kind: "complete", text: "Wrong assessment result" }; } } } });
  const failed = (await snapshot(s)).runs[0]; assert.equal(writes, 0); assert.equal(failed.error.code, "tool_denied"); assert.equal(failed.error.effects, "none"); assert.equal((await workspace(s)).assessment.status, "paused");
});
test("trailing Today freezes the latest acknowledged draft before becoming immutable history", async () => {
  const s = await owner("sp"); await app(s, "assessment.start", 0); await finish((await snapshot(s)).runs[0].id);
  await send(s, { kind: "visit", requestId: randomUUID(), context });
  let state = await workspace(s);
  await app(s, "draft.begin", state.assessmentRevision, { runId: state.assessment.currentRunId, fields: { name: "First assessment plan", goal: "Retain acknowledged history", targetOrgId: "sit", findingIds: [state.assessment.runs[0].findings[0].id] } });
  state = await workspace(s);
  await app(s, "draft.edit", state.assessmentRevision, { draftId: state.assessment.draft.id, edit: { field: "name", value: "Latest acknowledged plan" } });
  await send(s, { kind: "visit", requestId: randomUUID(), context: { ...context, surface: "build" } });
  const history = (await snapshot(s)).conversations[0].conversation.messages[0]; assert.equal(history.snapshot.assessment.draft.name, "Latest acknowledged plan");
  state = await workspace(s); await app(s, "draft.edit", state.assessmentRevision, { draftId: state.assessment.draft.id, edit: { field: "name", value: "Later live change" } });
  await send(s, { kind: "visit", requestId: randomUUID(), context });
  assert.deepEqual((await snapshot(s)).conversations[0].conversation.messages[0], history);
});
test("legacy running assessments preserve unavailable scope and pause before worker attachment", async () => {
  for (const orgIds of [[], ["unknown-org"], ["prod", "unknown-org"]]) {
    const s = await owner("sp"), logical = `legacy-${randomUUID()}`;
    await transaction(async c => {
      const record = { id: logical, startedAt: null, completedAt: null, scopeOrgIds: orgIds, source: { adapter: "legacy-browser", version: "1" } };
      await c.query("INSERT INTO assessment_runs(namespace_id,profile_id,id,record) VALUES($1,$2,$3,$4)", [s.session.namespaceId, s.session.profileId, logical, record]);
      await c.query("UPDATE workspaces SET assessment_cursor=$3 WHERE namespace_id=$1 AND profile_id=$2", [s.session.namespaceId, s.session.profileId, { schemaVersion: 2, status: "running", step: 0, scopeOrgIds: orgIds, completedAt: null, currentRunId: logical }]);
    });
    await app(s, "assessment.start", 0); const paused = await workspace(s);
    assert.equal(paused.assessment.status, "paused"); assert.deepEqual(paused.assessment.scopeOrgIds, orgIds); assert.equal(paused.assessment.currentRunId, logical); assert.equal((await snapshot(s)).runs.length, 0);
    await app(s, "assessment.rescan", paused.assessmentRevision, { orgIds: ["prod"] }); const resumed = await workspace(s);
    assert.notEqual(resumed.assessment.currentRunId, logical); assert.deepEqual(resumed.assessment.runs.find(run => run.id === logical).scopeOrgIds, orgIds); assert.equal((await snapshot(s)).runs.length, 1);
  }
});

test("autonomous assessment updates preserve command revisions and concurrent project intent", async () => {
  const s = await owner("sp"); await app(s, "assessment.start", 0); await finish((await snapshot(s)).runs[0].id);
  let state = await workspace(s);
  const source = { profileId: "sp", assessment: JSON.stringify(state.assessment), canvases: null };
  await app(s, "draft.begin", state.assessmentRevision, { runId: state.assessment.currentRunId, fields: { name: "Concurrent plan", goal: "Keep original findings", targetOrgId: "sit", findingIds: [state.assessment.runs[0].findings[0].id] } });
  state = await workspace(s); const draftId = state.assessment.draft.id, draftRevision = state.assessment.draft.revision;
  await app(s, "assessment.rescan", state.assessmentRevision, { orgIds: ["prod"] }); state = await workspace(s);
  const observedRevision = state.assessmentRevision, execution = (await snapshot(s)).runs.at(-1);
  await workerTick({ runId: execution.id, adapter: fastAdapter });
  assert.equal((await workspace(s)).assessmentRevision, observedRevision, "worker progress must not invalidate unrelated captured user intent");
  await app(s, "draft.edit", observedRevision, { draftId, edit: { field: "name", value: "Edited during rescan" } });
  await assert.rejects(app(s, "draft.edit", observedRevision, { draftId, edit: { field: "goal", value: "Stale human edit" } }), e => e.code === "conflict");
  state = await workspace(s);
  await assert.rejects(app(s, "project.create", state.assessmentRevision, { draftId, draftRevision }), e => e.code === "conflict");
  await assert.rejects(app(s, "project.create", observedRevision, { draftId, draftRevision: state.assessment.draft.revision }), e => e.code === "conflict");
  const create = { kind: "project.create", commandId: randomUUID(), expectedRevision: state.assessmentRevision, draftId, draftRevision: state.assessment.draft.revision };
  await finish(execution.id);
  assert.equal((await workspace(s)).assessmentRevision, create.expectedRevision, "completion also preserves the command token");
  const created = await transaction(c => executeCommand(c, s.token, s.session.generation, create));
  assert.equal(created.project.name, "Edited during rescan");
  state = await workspace(s); const completedHistory = structuredClone(state.assessment.runs);
  await app(s, "legacy.import", state.assessmentRevision, { source }); state = await workspace(s);
  assert.deepEqual(state.assessment.runs, completedHistory); assert.equal(state.assessment.status, "complete");
  assert.equal(state.assessment.projects[0].id, created.project.id); assert.equal(state.assessment.draft, null);
  await app(s, "assessment.rescan", state.assessmentRevision, { orgIds: ["prod"] }); state = await workspace(s);
  let currentRun = (await snapshot(s)).runs.at(-1);
  await workerTick({ runId: currentRun.id, adapter: fastAdapter });
  await app(s, "assessment.pause", state.assessmentRevision); state = await workspace(s); assert.equal(state.assessment.status, "paused");
  await app(s, "assessment.start", state.assessmentRevision); state = await workspace(s); currentRun = (await snapshot(s)).runs.at(-1);
  await workerTick({ runId: currentRun.id, adapter: deterministicAdapter({ fail: true }) });
  const failed = await workspace(s); assert.equal(failed.assessment.status, "paused"); assert.equal(failed.assessmentRevision, state.assessmentRevision);
  await app(s, "assessment.rescan", state.assessmentRevision, { orgIds: ["prod"] }); state = await workspace(s); currentRun = (await snapshot(s)).runs.at(-1);
  await workerTick({ runId: currentRun.id, adapter: fastAdapter });
  await app(s, "assessment.rescan", state.assessmentRevision, { orgIds: ["uat"] });
  assert.deepEqual((await workspace(s)).assessment.scopeOrgIds, ["uat"]);
});

test("duplicate assessment joins preserve the command token and legacy attachment still executes", async () => {
  const s = await owner("sp"), start = { kind: "assessment.start", commandId: randomUUID(), expectedRevision: 0 };
  const first = await transaction(c => executeCommand(c, s.token, s.session.generation, start));
  const joined = await app(s, "assessment.start", 0);
  assert.equal(joined.revision, first.revision); assert.equal((await workspace(s)).assessmentRevision, first.revision);
  assert.equal((await snapshot(s)).runs.length, 1);
  await app(s, "assessment.pause", first.revision); assert.equal((await workspace(s)).assessment.status, "paused");
  assert.deepEqual(await transaction(c => executeCommand(c, s.token, s.session.generation, start)), first);
  assert.equal((await workspace(s)).assessment.status, "paused", "a receipt replay must not resume the run");
  const legacy = await owner("sp"), logical = `legacy-${randomUUID()}`;
  await transaction(async c => {
    const record = { id: logical, startedAt: null, completedAt: null, scopeOrgIds: ["prod"], source: { adapter: "legacy-browser", version: "1" } };
    await c.query("INSERT INTO assessment_runs(namespace_id,profile_id,id,record) VALUES($1,$2,$3,$4)", [legacy.session.namespaceId, legacy.session.profileId, logical, record]);
    await c.query("UPDATE workspaces SET assessment_cursor=$3 WHERE namespace_id=$1 AND profile_id=$2", [legacy.session.namespaceId, legacy.session.profileId, { schemaVersion: 2, status: "running", step: 0, scopeOrgIds: ["prod"], completedAt: null, currentRunId: logical }]);
  });
  assert.equal((await app(legacy, "assessment.start", 0)).revision, 0);
  const attached = await snapshot(legacy); assert.equal(attached.runs.length, 1); assert.equal(attached.runs[0].assessmentRunId, logical);
  await app(legacy, "assessment.pause", 0); assert.equal((await workspace(legacy)).assessment.status, "paused");
  assert.equal((await snapshot(legacy)).runs[0].status, "cancelled");
});
