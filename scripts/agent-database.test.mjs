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
async function owner(profileId = "am") { const boot = await transaction(c => bootstrap(c)); namespaces.push(boot.session.namespaceId); journalNamespaces(); return { token: boot.token, session: await transaction(c => changeSession(c, boot.token, { action: "select", profileId, generation: boot.session.generation, commandId: randomUUID() })) }; }
const context = { target: { projectId: null, worktreeId: null, orgId: null }, surface: "home" };
const send = (s, command) => transaction(c => executeAgentCommand(c, s.token, s.session.generation, command));
const snapshot = s => transaction(c => observeAgent(c, s.token, s.session.generation));
const workspace = s => transaction(async c => readWorkspace(c, await requireSession(c, s.token, s.session.generation)));
const app = (s, kind, expectedRevision, fields = {}) => transaction(c => executeCommand(c, s.token, s.session.generation, { kind, expectedRevision, commandId: randomUUID(), ...(kind === "assessment.start" && expectedRevision === 0 ? { orgId: "prod" } : {}), ...fields }));
const chat = s => send(s, { kind: "submit", requestId: randomUUID(), context, text: "Build a scoped automation" });
const fastAdapter = { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === "progress" ? { ...result, delayMs: 0 } : result; } };

test("idle scheduler sees future work and active leases until cancellation or completion", async () => {
  const { workerHasWork } = modules.load("lib/server/agent-worker");
  assert.equal(await workerHasWork(), false);
  const s = await owner(), accepted = await chat(s);
  await transaction(c => c.query("UPDATE agent_runs SET ready_at=clock_timestamp()+interval '60 seconds' WHERE id=$1", [accepted.runId]));
  assert.equal(await workerTick({ runId: accepted.runId }), false);
  assert.equal(await workerHasWork(), true, "future-ready work must prevent hibernation");
  await transaction(c => c.query("UPDATE agent_runs SET ready_at=clock_timestamp() WHERE id=$1", [accepted.runId]));
  const claims = await Promise.all([transaction(c => claimRun(c, accepted.runId)), transaction(c => claimRun(c, accepted.runId))]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(await workerHasWork(), true, "a live lease on another worker remains recoverable");
  await send(s, { kind: "cancel", requestId: randomUUID(), runId: accepted.runId });
  assert.equal(await workerHasWork(), false);
});

test("expansion profiles capture only their scenario work and reject unavailable surfaces on the server", async () => {
  for (const [profileId, count, restricted] of [["sp", 0, ["govern", "code"]], ["kf", 4, ["govern", "code"]], ["jw", 13, ["code"]], ["am", 21, []]]) {
    const s = await owner(profileId);
    const opened = await send(s, { kind: "visit", requestId: randomUUID(), context });
    const today = opened.conversation.conversation.messages.at(-1).snapshot;
    assert.equal(today.totalRecent, count);
    assert.equal(today.recent.length, Math.min(count, 12));
    for (const surface of restricted) await assert.rejects(send(s, { kind: "visit", requestId: randomUUID(), context: { ...context, surface } }), /unavailable/);
    if (profileId === "kf" || profileId === "jw") {
      const work = await send(s, { kind: "visit", requestId: randomUUID(), context: { ...context, surface: "build" }, workId: profileId === "kf" ? "builder-lead-routing" : "lead-routing-agent" });
      assert.equal(work.conversationId, opened.conversationId);
      if (profileId === "kf") await assert.rejects(send(s, { kind: "visit", requestId: randomUUID(), context: { ...context, surface: "alm" }, workId: "storefront-release" }), /unavailable/);
    }
  }
});

test("builder project-only work saves and resumes without a fabricated worktree", async () => {
  const s = await owner("kf");
  const work = modules.load("lib/workspace/demo-workspace").workForProfile("kf")[0];
  const canvas = modules.load("lib/workspace/returning-work").workCanvasInput(work);
  const target = { projectId: work.projectId, worktreeId: null, orgId: "uat" };
  await app(s, "canvas.save", 0, { canvas, target, surface: work.surfaceId, fields: { notes: "Project-level review" } });
  const saved = (await workspace(s)).canvases.find(item => item.canvas.params.workId === work.id);
  assert.deepEqual(saved.target, target);
  assert.equal(saved.fields.notes, "Project-level review");
  const opened = await send(s, { kind: "visit", requestId: randomUUID(), context: { target, surface: work.surfaceId }, workId: work.id });
  assert.equal(opened.conversation.threadKey, JSON.stringify(["project-session", work.projectId, null]));
  await assert.rejects(send(s, { kind: "visit", requestId: randomUUID(), context: { target: { ...target, worktreeId: "main" }, surface: "build" } }), /unavailable/);
});

test("navigation returns committed history, keeps receipts compact, and retries without replaying older context", async () => {
  const s = await owner(), command = { kind: "visit", requestId: randomUUID(), context: { ...context, surface: "build" } };
  const first = await send(s, command);
  assert.deepEqual(first.conversation, (await snapshot(s)).conversations[0]);
  const stored = await transaction(c => c.query("SELECT result FROM agent_receipts WHERE namespace_id=$1 AND profile_id=$2 AND request_id=$3", [s.session.namespaceId, s.session.profileId, command.requestId]));
  assert.deepEqual(stored.rows[0].result, { conversationId: first.conversationId });
  const next = await send(s, { ...command, requestId: randomUUID(), context: { ...context, surface: "code" } });
  const replay = await send(s, command);
  assert.deepEqual(replay.conversation, next.conversation);
  assert(replay.conversation.revision > first.conversation.revision);
  await assert.rejects(transaction(async c => {
    await executeAgentCommand(c, s.token, s.session.generation, { ...command, requestId: randomUUID(), context: { ...context, surface: "alm" } });
    throw Error("rollback navigation");
  }), /rollback navigation/);
  assert.deepEqual((await snapshot(s)).conversations[0], next.conversation);
});
test("legacy deployed-app visits retain their request identity while opening ALM", async () => {
  const s = await owner("am");
  const { hash } = modules.load("lib/server/session");
  const { stableJson } = modules.load("lib/application/contracts");
  const command = { kind: "visit", requestId: randomUUID(), context: {
    surface: "build", target: { projectId: "acme-storefront", worktreeId: "main", orgId: "sit" },
  }, workId: "storefront-app" };
  const opened = await send(s, command);
  assert.equal(opened.conversation.conversation.scopeKey, "alm");
  const receipt = await transaction(async c => (await c.query("SELECT payload_hash FROM agent_receipts WHERE namespace_id=$1 AND profile_id=$2 AND request_id=$3", [s.session.namespaceId, s.session.profileId, command.requestId])).rows[0]);
  assert.equal(receipt.payload_hash, hash(stableJson(command)), "The legacy request hash remains unchanged");
  const next = await send(s, { kind: "visit", requestId: randomUUID(), context: { ...command.context, surface: "code" } });
  assert.deepEqual((await send(s, command)).conversation, next.conversation, "Retrying an old acknowledgement does not revisit its surface");
});
async function finish(runId) { for (let i = 0; i < 10; i++) if (!await workerTick({ runId, adapter: fastAdapter })) return; throw Error("Run did not finish"); }

test("global work visits stay in one conversation and never enter their owning projects", async () => {
  const s = await owner("am"), global = { ...context, target: { ...context.target, orgId: "uat" } };
  const home = await send(s, { kind: "visit", requestId: randomUUID(), context: global });
  for (const [workId, surface] of [["lead-routing-agent", "build"], ["storefront-health", "govern"]]) {
    const command = { kind: "visit", requestId: randomUUID(), workId, context: { ...global, surface } };
    const opened = await send(s, command);
    assert.equal(opened.conversationId, home.conversationId);
    assert.equal(opened.conversation.conversation.targetOrgId, "uat");
    assert.equal(opened.conversation.conversation.visitKey, `work:${workId}`);
    assert.deepEqual((await send(s, command)).conversation, opened.conversation);
  }
  assert.equal((await snapshot(s)).conversations.length, 1);
  assert.equal((await snapshot(s)).runs.length, 0);
  await assert.rejects(send(s, { kind: "visit", requestId: randomUUID(), workId: "storefront-health", context: { surface: "govern", target: { projectId: "trailblazer-crm", worktreeId: "main", orgId: "uat" } } }), /unavailable/);
  const empty = await owner("sp");
  await assert.rejects(send(empty, { kind: "visit", requestId: randomUUID(), workId: "lead-routing-agent", context: { ...context, surface: "build" } }), /unavailable/);
});

test("Home reuses trailing Today after project visits and appends once after new global content", async () => {
  const s = await owner("am");
  const home = { ...context, target: { ...context.target, orgId: "uat" } };
  const first = await send(s, { kind: "visit", requestId: randomUUID(), context: home });
  await send(s, { kind: "visit", requestId: randomUUID(), context: { surface: "alm", target: { ...home.target, projectId: "trailblazer-crm", worktreeId: "main" } } });
  const reused = await send(s, { kind: "visit", requestId: randomUUID(), context: home, refreshToday: true });
  assert.equal(reused.conversationId, first.conversationId);
  assert.deepEqual(reused.conversation.conversation.messages, JSON.parse(JSON.stringify(first.conversation.conversation.messages)));
  const explored = await send(s, { kind: "visit", requestId: randomUUID(), context: { ...home, surface: "build" } });
  const command = { kind: "visit", requestId: randomUUID(), context: home, refreshToday: true };
  const returned = await send(s, command);
  const before = explored.conversation.conversation.messages, after = returned.conversation.conversation.messages;
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(after.slice(0, -1), JSON.parse(JSON.stringify(before)));
  assert.equal(after.at(-1).role, "today");
  assert.notEqual(after.at(-1).id, first.conversation.conversation.messages.at(-1).id);
  assert.deepEqual((await send(s, command)).conversation, JSON.parse(JSON.stringify(returned.conversation)));
  assert.deepEqual((await send(s, { kind: "visit", requestId: randomUUID(), context: home })).conversation.conversation.messages, JSON.parse(JSON.stringify(after)));
});

test("first Home return carries a project's org without printing content that duplicates Today", async () => {
  const s = await owner("am");
  const first = await send(s, { kind: "visit", requestId: randomUUID(), context });
  const project = { surface: "alm", target: { projectId: "trailblazer-crm", worktreeId: "main", orgId: "uat" } };
  await send(s, { kind: "visit", requestId: randomUUID(), context: project });
  const home = { ...context, target: { ...context.target, orgId: "uat" } };
  const returned = await send(s, { kind: "visit", requestId: randomUUID(), context: home, refreshToday: true });
  assert.equal(returned.conversation.conversation.targetOrgId, "uat");
  assert.deepEqual(returned.conversation.conversation.messages, JSON.parse(JSON.stringify(first.conversation.conversation.messages)));
  const arrival = await send(s, { kind: "visit", requestId: randomUUID(), context: home });
  assert.deepEqual(arrival.conversation.conversation.messages, returned.conversation.conversation.messages);
  // Choosing another org explicitly on Home still records that change.
  const changed = await send(s, { kind: "visit", requestId: randomUUID(), context: { ...home, target: { ...home.target, orgId: "prod" } } });
  assert.equal(changed.conversation.conversation.messages.at(-2).text, "Connected org · Production");
  assert.equal(changed.conversation.conversation.messages.at(-1).role, "today");
});

test("org changes share global history, log once, and preserve in-flight execution scope", async () => {
  const s = await owner("am");
  const visit = context => send(s, { kind: "visit", requestId: randomUUID(), context });
  const home = await visit(context);
  const uat = { surface: "build", target: { ...context.target, orgId: "uat" } };
  const opened = await visit(uat);
  assert.equal(opened.conversationId, home.conversationId);
  assert.deepEqual(opened.conversation.conversation.messages[0], JSON.parse(JSON.stringify(home.conversation.conversation.messages[0])));
  assert.equal(opened.conversation.conversation.messages.filter(message => message.text === "Connected org · UAT Sandbox").length, 1);
  const repeated = await visit(uat); assert.deepEqual(repeated.conversation, opened.conversation);
  const reply = await send(s, { kind: "submit", requestId: randomUUID(), context: uat, text: "Keep the captured org" });
  const prod = { ...uat, target: { ...uat.target, orgId: "prod" } };
  const switched = await visit(prod);
  assert.equal(switched.conversationId, opened.conversationId);
  assert.equal(switched.conversation.conversation.messages.at(-1).text, "Connected org · Production");
  assert.deepEqual((await snapshot(s)).runs.find(run => run.id === reply.runId).context.target, uat.target);
  await finish(reply.runId);
  const returned = await visit({ ...prod, surface: "home" });
  assert.equal(returned.conversationId, home.conversationId);
  assert.equal(returned.conversation.conversation.messages.at(-1).role, "today");
  assert.equal(returned.conversation.conversation.targetOrgId, "prod");
  assert.equal((await snapshot(s)).conversations.length, 1);
});

test("Home aggregates all accessible projects while project visits resume their conversation without Today", async () => {
  const s = await owner("am");
  const visit = context => send(s, { kind: "visit", requestId: randomUUID(), context });
  const home = await visit(context), today = home.conversation.conversation.messages.at(-1).snapshot;
  assert.equal(today.scope, "global");
  assert.equal(new Set(today.recent.map(work => work.projectId)).size, 2);
  assert(today.recent.some(work => work.id === "lead-routing-release" && work.attention && work.branch === "feature/lead-routing"));
  assert(today.recent.some(work => work.id === "integration-access" && work.attention));
  assert.deepEqual(today.recent.filter(work => work.attention).map(work => work.id).sort(), [
    "hotfix-tests", "integration-access", "lead-routing-release", "storefront-health", "storefront-release",
  ]);
  assert.equal(today.working, 2);
  assert(today.recent[0].attention); assert(today.recent.every(work => work.projectName));
  const scoped = { target: { projectId: "trailblazer-crm", worktreeId: "main", orgId: "uat" }, surface: "code" };
  const opened = await visit(scoped);
  assert(opened.conversation.conversation.messages.every(message => message.role !== "today"));
  await visit(context);
  const resumed = await visit(scoped);
  assert.deepEqual(resumed.conversation, opened.conversation);
  const projectHome = await visit({ ...scoped, surface: "home" });
  assert.deepEqual(projectHome.conversation, opened.conversation);
  const freshProjectHome = await visit({ surface: "home", target: { ...scoped.target, worktreeId: "lead-routing" } });
  assert(freshProjectHome.conversation.conversation.messages.some(message => message.role === "agent"), "the target-org marker must not suppress a project's first introduction");
  assert(freshProjectHome.conversation.conversation.messages.every(message => message.role !== "today"));
  const empty = await owner("sp");
  const other = await send(empty, { kind: "visit", requestId: randomUUID(), context });
  assert.equal(other.conversation.conversation.messages.at(-1).snapshot.recent.length, 0, "empty profiles must not receive another profile's work");
});

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
    await app(s, "assessment.start", 0, { orgId: undefined }); const paused = await workspace(s);
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
  const projectContext = { target: { projectId: created.project.id, worktreeId: null, orgId: created.project.targetOrgId }, surface: "alm" };
  const openedProject = await send(s, { kind: "visit", requestId: randomUUID(), context: projectContext });
  assert(openedProject.conversation.conversation.messages.every(message => message.role !== "today"));
  assert.match(openedProject.conversation.conversation.messages.at(-1).text, /ready for planning/);
  assert.doesNotMatch(openedProject.conversation.conversation.messages.at(-1).text, /synced|GitHub/);
  const resumedProject = await send(s, { kind: "visit", requestId: randomUUID(), context: projectContext });
  assert.deepEqual(resumedProject.conversation, openedProject.conversation);
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
  const s = await owner("sp"), start = { kind: "assessment.start", orgId: "prod", commandId: randomUUID(), expectedRevision: 0 };
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

test('workers and archived Today preserve the selected org; optional project targets persist independently', async () => {
  const s = await owner('sp');
  const home = orgId => ({ surface: 'home', target: { projectId: null, worktreeId: null, orgId } });
  await send(s, { kind: 'visit', requestId: randomUUID(), context: home('prod') });
  await app(s, 'assessment.start', 0, { orgId: 'prod' });
  await finish((await snapshot(s)).runs[0].id);
  let state = await workspace(s);
  const production = structuredClone(state.assessment.runs[0]);
  assert.deepEqual(production.scopeOrgIds, ['prod']);
  assert(production.findings.every(f => f.orgId === 'prod'));
  await app(s, 'draft.begin', state.assessmentRevision, { runId: production.id,
    fields: { name: 'Project without deployment', goal: 'Work in version control', targetOrgId: '', findingIds: [production.findings[0].id] } });
  state = await workspace(s);
  await app(s, 'project.create', state.assessmentRevision, { draftId: state.assessment.draft.id, draftRevision: state.assessment.draft.revision });
  state = await workspace(s);
  assert.equal(state.assessment.projects[0].targetOrgId, null);
  assert.equal(state.assessment.projects[0].workItems[0].finding.id, production.findings[0].id);
  await send(s, { kind: 'visit', requestId: randomUUID(), context: home('uat') });
  const before = (await snapshot(s)).conversations[0].conversation.messages;
  const archivedProduction = structuredClone(before.find(m => m.role === 'today'));
  assert.deepEqual(archivedProduction.snapshot.assessment.scopeOrgIds, ['prod']);
  assert.equal(before.at(-1).snapshot.assessment.status, 'idle');
  await app(s, 'assessment.rescan', state.assessmentRevision, { orgIds: ['uat'] });
  await finish((await snapshot(s)).runs.at(-1).id);
  const messages = (await snapshot(s)).conversations[0].conversation.messages;
  assert.deepEqual(messages.find(m => m.role === 'today'), archivedProduction);
  assert.deepEqual(messages.at(-1).snapshot.assessment.scopeOrgIds, ['uat']);
  assert(messages.at(-1).snapshot.assessment.findings.every(f => f.orgId === 'uat'));
  await send(s, { kind: 'visit', requestId: randomUUID(), context: home('prod') });
  const returned = (await snapshot(s)).conversations[0].conversation.messages.at(-1).snapshot.assessment;
  assert.equal(returned.currentRunId, production.id);
  assert.deepEqual(returned.findings, production.findings);
  assert.equal(returned.projects[0].targetOrgId, null);
});

test('permissions chat follows a manual edit, commits once with its receipt, and supports durable undo in global and project scope', async () => {
  const { canvasId, canvasTarget } = modules.load('lib/surface-canvas/model');
  const { permissionUsers } = modules.load('lib/org-resources/permissions');
  const { workspaceChanges } = modules.load('lib/workspace/changes');
  for (const project of [false, true]) {
    const s = await owner('am');
    const canvas = { kind: 'org-resource', title: 'Service Reps', params: { orgId: 'prod', resourceType: 'permission-set-group', apiName: 'Service_Reps', ...(project ? { projectId: 'acme-storefront', worktreeId: 'main' } : {}) } };
    const target = canvasTarget(canvas, {}), id = canvasId(canvas.kind, canvas.params);
    const context = { target, surface: 'build', canvas };
    const visit = await send(s, { kind: 'visit', requestId: randomUUID(), context });
    assert.match(visit.conversation.conversation.messages.at(-1).text, /6 service representatives/);
    assert.equal((await workspace(s)).canvases.some(draft => draft.id === id), false, 'Viewing does not create a change');
    await app(s, 'canvas.save', 0, { canvas, target, surface: 'build', fields: { maya_chen: 'standard' } });
    const command = { kind: 'submit', requestId: randomUUID(), context: { ...context, canvasRevision: 1 }, text: 'Can you update all of these users permissions to standard access?' };
    const receipts = await Promise.all([send(s, command), send(s, command)]);
    assert.deepEqual(receipts[0], receipts[1]);
    let draft = (await workspace(s)).canvases.find(draft => draft.id === id);
    assert.equal(draft.revision, 2); assert(permissionUsers(draft.fields).every(user => !user.canDelete));
    const run = (await snapshot(s)).runs.find(run => run.id === receipts[0].runId);
    assert.equal(run.status, 'completed'); assert.match(run.result, /5 users/); assert.match(run.result, /1 already/);
    assert.deepEqual(run.context.canvas, canvas);
    assert.equal(await workerTick({ runId: run.id }), false, 'Completed local edits cannot be dispatched again');
    await app(s, 'canvas.save', 2, { canvas, target, surface: 'build', fields: { jordan_lee: '' } });
    draft = (await workspace(s)).canvases.find(draft => draft.id === id);
    assert.equal(permissionUsers(draft.fields).filter(user => user.canDelete).length, 1);
    await send(s, { kind: 'submit', requestId: randomUUID(), context: { ...context, canvasRevision: 3 }, text: 'Undo all permission changes' });
    const state = await workspace(s); draft = state.canvases.find(draft => draft.id === id);
    assert.equal(draft.revision, 4); assert(permissionUsers(draft.fields).every(user => user.canDelete));
    assert.equal(workspaceChanges('am', target, state.assessment.projects, [draft]).filter(file => file.path.includes('Service_Reps')).length, 0);
  }
});

test('permission chat rejects stale or forged scope and rolls back edits, runs and receipts together', async () => {
  const { canvasId } = modules.load('lib/surface-canvas/model');
  const s = await owner('sp');
  const canvas = { kind: 'org-resource', title: 'Service Reps', params: { orgId: 'prod', resourceType: 'permission-set-group', apiName: 'Service_Reps' } };
  const target = { projectId: null, worktreeId: null, orgId: 'prod' };
  const context = { target, surface: 'build', canvas, canvasRevision: 0 };
  const command = { kind: 'submit', requestId: randomUUID(), context, text: 'Remove Delete Cases access for all users' };
  await app(s, 'canvas.save', 0, { canvas, target, surface: 'build', fields: { maya_chen: 'standard' } });
  await assert.rejects(send(s, command), error => error.code === 'conflict');
  assert.equal((await snapshot(s)).runs.length, 0);
  const other = await owner('sp');
  await assert.rejects(send(other, { ...command, context: { ...context, canvas: { ...canvas, params: { ...canvas.params, projectId: 'foreign-project' } } } }), /unavailable/);
  await assert.rejects(send(s, { ...command, context: { ...context, canvas: { ...canvas, params: { ...canvas.params, orgId: 'scratch-hotfix' } } } }), error => error.code === 'invalid');
  const current = { ...command, context: { ...context, canvasRevision: 1 } };
  await assert.rejects(transaction(async client => {
    await executeAgentCommand(client, s.token, s.session.generation, current, undefined, () => { throw Error('Permission edits must not call a model'); });
    throw Error('rollback permissions');
  }), /rollback permissions/);
  const id = canvasId(canvas.kind, canvas.params);
  assert.deepEqual((await workspace(s)).canvases.find(draft => draft.id === id).fields, { maya_chen: 'standard' });
  assert.equal((await snapshot(s)).runs.length, 0);
  await send(s, current);
  assert.equal((await workspace(s)).canvases.find(draft => draft.id === id).revision, 2);
});

test('explicit navigation still uses the existing agent path from a permissions canvas', async () => {
  const s = await owner('sp');
  const canvas = { kind: 'org-resource', title: 'Service Reps', params: { orgId: 'prod', resourceType: 'permission-set-group', apiName: 'Service_Reps' } };
  const accepted = await send(s, { kind: 'submit', requestId: randomUUID(), text: 'Open ALM', context: { target: { projectId: null, worktreeId: null, orgId: 'prod' }, surface: 'build', canvas, canvasRevision: 0 } });
  assert.equal(accepted.destination, 'alm');
  assert.equal((await snapshot(s)).runs.find(run => run.id === accepted.runId).status, 'pending');
  assert.equal((await workspace(s)).canvases.length, 0);
  await send(s, { kind: 'cancel', requestId: randomUUID(), runId: accepted.runId });
});
