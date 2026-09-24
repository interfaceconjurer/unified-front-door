// This suite can never dispatch a paid request, even with a real key inherited.
process.env.AGENT_PROVIDER = "demo";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fork } from "node:child_process";
import { once } from "node:events";
import { testModules } from "./test-modules.mjs";
if (!process.env.DATABASE_TEST_URL) throw new Error("DATABASE_TEST_URL must explicitly identify an isolated development/test database.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const modules = testModules(), db = modules.load("lib/db"), transaction = db.transaction;
const { bootstrap, changeSession, requireSession } = modules.load("lib/server/session");
const { executeAgentCommand, observeAgent } = modules.load("lib/server/agent");
const { executeCommand } = modules.load("lib/server/application");
const { readWorkspace } = modules.load("lib/server/repository");
const { claimRun, publishModelProgress, workerTick } = modules.load("lib/server/agent-worker");
const { beginModelAttempt, reserveModelCalls } = modules.load("lib/server/model-attempts");
const { MODEL_POLICY, ModelProviderError, serializeModelRequest } = modules.load("lib/server/model-provider");
const { demoAdapter } = modules.load("lib/agent/demo");
const settings = { policy: MODEL_POLICY, globalDailyCalls: 10, namespaceDailyCalls: 5 };
const namespaces = [], scopes = [], journal = join(tmpdir(), `ufd-phase8-model-tests-${process.pid}-${randomUUID()}.json`);
const saveJournal = () => writeFileSync(journal, JSON.stringify({ namespaces, scopes }), { mode: 0o600 });
const scope = () => { const value = `test:${randomUUID()}`; scopes.push(value); saveJournal(); return value; };
const context = { target: { projectId: null, worktreeId: null, orgId: null }, surface: "home" };
const fakeResult = { text: "A human should review these captured sample findings before acting.", model: MODEL_POLICY.model, messageId: "msg_fake_result", requestId: "req_fake_result", usage: { inputTokens: 123, outputTokens: 17 } };
const fakeComplete = async () => structuredClone(fakeResult);
const runtime = (budgetScope, complete = fakeComplete, current = () => settings) => ({ settings: current, complete, budgetScope });
const tick = (runId, model, signal) => workerTick({ runId, model, signal });
const send = (s, command, configured = settings) => transaction(c => executeAgentCommand(c, s.token, s.session.generation, command, undefined, () => configured));
const chat = (s, text = "Explain the captured findings", selected = context) => send(s, { kind: "submit", requestId: randomUUID(), context: selected, text });
const snapshot = s => transaction(c => observeAgent(c, s.token, s.session.generation));
const row = id => transaction(async c => (await c.query("SELECT * FROM agent_runs WHERE id=$1", [id])).rows[0]);
const attempt = id => transaction(async c => (await c.query("SELECT * FROM model_attempts WHERE run_id=$1", [id])).rows[0]);
const expire = id => transaction(c => c.query("UPDATE agent_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [id]));
async function owner(profileId = "jw") {
  const boot = await transaction(c => bootstrap(c)); namespaces.push(boot.session.namespaceId); saveJournal();
  return { token: boot.token, session: await transaction(c => changeSession(c, boot.token, { action: "select", profileId, generation: boot.session.generation, commandId: randomUUID() })) };
}
after(async () => {
  db.transaction = transaction;
  for (const id of namespaces) await transaction(async c => {
    await c.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)", [id]);
    await c.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [id]); await c.query("DELETE FROM workspaces WHERE namespace_id=$1", [id]); await c.query("DELETE FROM demo_namespaces WHERE id=$1", [id]);
  });
  for (const value of scopes) await transaction(async c => {
    await c.query("DELETE FROM model_dispatch_slots WHERE scope=$1", [value]);
    await c.query("DELETE FROM model_call_budgets WHERE scope=$1 OR scope LIKE $2", [value, `${value}:namespace:%`]);
  });
  namespaces.length = 0; scopes.length = 0; saveJournal(); await db.databasePool().end(); modules.cleanup();
});

test("duplicate model submissions and competing workers dispatch once after durable intent", async () => {
  const s = await owner(), budget = scope(), command = { kind: "submit", requestId: randomUUID(), context, text: "Explain once" };
  const [one, two] = await Promise.all([send(s, command), send(s, command)]); assert.deepEqual(one, two);
  let calls = 0;
  const model = runtime(budget, async (prompt, policy) => {
    calls++; const saved = await attempt(one.runId); assert.equal(saved.status, "intent"); assert.ok(saved.request_sha256.length === 64);
    assert.equal(saved.request_sha256, createHash("sha256").update(serializeModelRequest(prompt, policy)).digest("hex"));
    assert.equal(JSON.parse(serializeModelRequest(prompt, policy)).stream, true);
    assert.equal((await row(one.runId)).status, "running"); return structuredClone(fakeResult);
  });
  await Promise.all([tick(one.runId, model), tick(one.runId, model)]); assert.equal(calls, 1);
  const saved = await attempt(one.runId); assert.equal(saved.status, "succeeded"); assert.equal(saved.input_tokens, 123); assert.equal(saved.output_tokens, 17);
  assert.equal((await snapshot(s)).runs[0].execution.provider, "anthropic"); assert.equal((await snapshot(s)).runs[0].result, fakeResult.text);
  assert.equal(await tick(one.runId, model), false); assert.equal(calls, 1);
});

async function waitForPartial(runId, expected) {
  const deadline = Date.now() + 10000;
  for (;;) {
    const saved = await row(runId);
    if (saved?.result === expected) return saved;
    assert(Date.now() < deadline, "Streaming partial was not committed before the deadline");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

test("streaming text commits before completion without releasing the model lease or paid intent", { timeout: 25000 }, async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let finish, started, calls = 0;
  const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { finish = resolve; });
  const partial = "A partial explanation from the real provider boundary";
  const model = runtime(budget, async (_prompt, _policy, _signal, { onText }) => {
    calls++; onText(partial); started(); await gate; return { ...fakeResult, text: partial + ". Finished." };
  });
  const pending = tick(accepted.runId, model);
  try {
    await entered; const during = await waitForPartial(accepted.runId, partial);
    assert.equal(during.status, "streaming"); assert.equal(during.checkpoint, 0); assert(during.lease_until.getTime() > Date.now());
    assert.equal((await attempt(accepted.runId)).status, "intent");
    assert.equal(await transaction(c => claimRun(c, accepted.runId)), null, "A streaming model retains exclusive ownership");
    const captured = await snapshot(s); assert.equal(captured.conversations[0].conversation.messages.at(-1).text, partial);
    const progress = await transaction(c => c.query("SELECT event FROM agent_events WHERE run_id=$1 AND event->>'kind'='streaming'", [accepted.runId]));
    assert.equal(progress.rowCount, 1); assert.equal(progress.rows[0].event.data.text, partial);
  } finally { finish(); await pending; }
  const complete = await row(accepted.runId);
  assert.equal(complete.status, "completed"); assert.equal(complete.result, partial + ". Finished.");
  assert.equal(complete.lease_until, null); assert.equal((await attempt(accepted.runId)).status, "succeeded");
  assert.equal(calls, 1); assert.equal(await tick(accepted.runId, model), false); assert.equal(calls, 1);
});

test("cancellation preserves committed partial text and fences late streaming publications", { timeout: 25000 }, async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let started, finish, publish, providerSignal, calls = 0;
  const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { finish = resolve; });
  const partial = "A proposal that was stopped before completion";
  const model = runtime(budget, async (_prompt, _policy, signal, { onText }) => {
    calls++; providerSignal = signal; publish = onText; onText(partial); started(); await gate; return { ...fakeResult, text: partial + ". Must not complete." };
  });
  const pending = tick(accepted.runId, model);
  try {
    await entered; const during = await waitForPartial(accepted.runId, partial);
    await send(s, { kind: "cancel", requestId: randomUUID(), runId: accepted.runId });
    assert.equal(await transaction(c => publishModelProgress(c, { run: during, fence: during.fence }, partial + ". Stale publication.")), false);
    publish(partial + ". Late text from an uncooperative provider.");
    await pending; assert.equal(providerSignal.aborted, true);
  } finally { finish(); await pending; }
  const cancelled = await row(accepted.runId), captured = await snapshot(s);
  assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.result, partial);
  assert.equal(captured.conversations[0].conversation.messages.at(-1).text, partial);
  assert.equal((await attempt(accepted.runId)).status, "unknown");
  assert.equal(await tick(accepted.runId, model), false); assert.equal(calls, 1);
});

test("provider failure commits its buffered text and failed status atomically without redispatch", { timeout: 25000 }, async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let calls = 0;
  const first = "A validated prefix", final = first + " with the final sentence that arrived before the provider failed.";
  const model = runtime(budget, async (_prompt, _policy, _signal, { onText }) => {
    calls++;
    // Both deltas arrive synchronously: the first write is still in flight,
    // so the second cannot escape through the periodic progress writer.
    onText(first); onText(final);
    throw new ModelProviderError("invalid_response", true);
  });
  await tick(accepted.runId, model);
  const failed = await row(accepted.runId), captured = await snapshot(s), savedAttempt = await attempt(accepted.runId);
  assert.equal(failed.status, "failed"); assert.equal(failed.error.code, "model_failed");
  assert.equal(failed.result, final); assert.equal(failed.lease_until, null);
  assert.equal(captured.conversations[0].conversation.messages.at(-1).text, final);
  assert.equal(savedAttempt.status, "unknown"); assert.equal(savedAttempt.error_code, "model_failed");
  const events = (await transaction(c => c.query(`SELECT event,xmin::text AS transaction_id FROM agent_events
    WHERE run_id=$1 AND event->>'kind' IN ('streaming','failed') ORDER BY sequence`, [accepted.runId]))).rows;
  assert.deepEqual(events.map(row => row.event.kind), ["streaming", "streaming", "failed"]);
  assert.equal(events[0].event.data.text, first); assert.equal(events[1].event.data.text, final);
  assert.notEqual(events[0].transaction_id, events[1].transaction_id, "The initial prefix was already committed separately");
  assert.equal(events[1].transaction_id, events[2].transaction_id, "Postgres committed the buffered tail and failed event in one transaction");
  assert.equal(await tick(accepted.runId, model), false); assert.equal(calls, 1);
});

test("pre-intent crash can reclaim; durable intent crash never automatically redispatches", async () => {
  const s = await owner(), budget = scope(); let calls = 0;
  const first = await chat(s); await transaction(c => claimRun(c, first.runId)); await expire(first.runId);
  await tick(first.runId, runtime(budget, async () => { calls++; return fakeResult; })); assert.equal(calls, 1);
  const second = await chat(s), lease = await transaction(c => claimRun(c, second.runId));
  assert.equal(await transaction(c => beginModelAttempt(c, lease.run, lease.run.execution, settings, budget)), "started");
  await expire(second.runId); assert.equal(await tick(second.runId, runtime(budget, async () => { calls++; return fakeResult; })), false);
  assert.equal(calls, 1); assert.equal((await row(second.runId)).error.code, "model_outcome_unknown"); assert.equal((await attempt(second.runId)).status, "unknown");
  const retry = await send(s, { kind: "retry", requestId: randomUUID(), runId: second.runId });
  assert.deepEqual((await row(retry.runId)).execution, (await row(second.runId)).execution); assert.notEqual(retry.runId, second.runId);
  await tick(retry.runId, runtime(budget, async () => { calls++; return fakeResult; })); assert.equal(calls, 2);
});

test("killed model worker is restarted without redispatching its durable paid intent", { timeout: 45000 }, async () => {
  const s = await owner(), accepted = await chat(s), budget = scope();
  const startChild = () => fork(new URL("./model-worker-child.mjs", import.meta.url), [accepted.runId, budget], { execArgv: ["--conditions=react-server"], env: process.env, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const first = startChild();
  try {
    assert.deepEqual((await once(first, "message", { signal: AbortSignal.timeout(20000) }))[0], { type: "provider-entered" }); assert.equal((await attempt(accepted.runId)).status, "intent");
    const stopped = once(first, "exit", { signal: AbortSignal.timeout(5000) }); first.kill("SIGKILL"); await stopped;
    await expire(accepted.runId);
    const restarted = startChild();
    try {
      const [message, exited] = await Promise.all([once(restarted, "message", { signal: AbortSignal.timeout(20000) }), once(restarted, "exit", { signal: AbortSignal.timeout(20000) })]);
      assert.deepEqual(message[0], { type: "finished", claimed: false }); assert.equal(exited[0], 0);
    }
    finally { if (restarted.exitCode === null && !restarted.signalCode) restarted.kill("SIGKILL"); }
    assert.equal((await row(accepted.runId)).error.code, "model_outcome_unknown"); assert.equal((await attempt(accepted.runId)).status, "unknown");
  } finally { if (first.exitCode === null && !first.signalCode) first.kill("SIGKILL"); }
});

test("uncertain intent commit acknowledgement cannot send a provider request", async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let injected = false, calls = 0;
  db.transaction = async work => { const result = await transaction(work); if (result === "started" && !injected) { injected = true; throw Error("Lost intent commit acknowledgement"); } return result; };
  try { await tick(accepted.runId, runtime(budget, async () => { calls++; return fakeResult; })); }
  finally { db.transaction = transaction; }
  assert.equal(injected, true); assert.equal(calls, 0); assert.equal((await attempt(accepted.runId)).status, "unknown");
  assert.equal((await row(accepted.runId)).error.code, "model_outcome_unknown");
});

test("failed result commit rolls back transcript and keeps charged outcome uncertain", async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let injected = false, calls = 0;
  db.transaction = work => transaction(async c => {
    const query = c.query.bind(c);
    c.query = async (...args) => { const result = await query(...args); if (!injected && String(args[0]).includes("SET status='succeeded'")) { injected = true; throw Error("Result commit failed"); } return result; };
    try { return await work(c); } finally { c.query = query; }
  });
  try { await tick(accepted.runId, runtime(budget, async () => { calls++; return fakeResult; })); }
  finally { db.transaction = transaction; }
  assert.equal(injected, true); assert.equal(calls, 1); assert.equal((await attempt(accepted.runId)).status, "unknown");
  const saved = await snapshot(s); assert.equal(saved.runs[0].result, null); assert.equal(saved.conversations[0].conversation.messages.at(-1).text, "");
  await tick(accepted.runId, runtime(budget, async () => { calls++; return fakeResult; })); assert.equal(calls, 1);
});

test("lost acknowledgement after atomic result commit preserves success without another charge", async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let commitResult = false, injected = false, calls = 0;
  db.transaction = async work => {
    const result = await transaction(async c => {
      const query = c.query.bind(c); c.query = async (...args) => { const result = await query(...args); if (String(args[0]).includes("SET status='succeeded'")) commitResult = true; return result; };
      try { return await work(c); } finally { c.query = query; }
    });
    if (commitResult && !injected) { injected = true; throw Error("Lost result commit acknowledgement"); } return result;
  };
  try { await tick(accepted.runId, runtime(budget, async () => { calls++; return fakeResult; })); }
  finally { db.transaction = transaction; }
  assert.equal(injected, true); assert.equal((await attempt(accepted.runId)).status, "succeeded"); assert.equal((await row(accepted.runId)).result, fakeResult.text);
  await tick(accepted.runId, runtime(budget, async () => { calls++; return fakeResult; })); assert.equal(calls, 1);
});

test("disabled current configuration blocks queued model calls despite captured settings", async () => {
  const s = await owner(), accepted = await chat(s); let calls = 0;
  await tick(accepted.runId, runtime(scope(), async () => { calls++; return fakeResult; }, () => null));
  assert.equal(calls, 0); assert.equal(await attempt(accepted.runId), undefined); assert.equal((await row(accepted.runId)).error.code, "unconfigured");
});

test("provider failures preserve safe classification, uncertain cost and no automatic retry", async () => {
  for (const [providerCode, expected] of [["refused", "model_refused"], ["incomplete", "model_incomplete"], ["rate_limited", "model_rate_limited"], ["timeout", "model_timeout"], ["provider_failed", "model_outcome_unknown"]]) {
    const s = await owner(), accepted = await chat(s); let calls = 0;
    await tick(accepted.runId, runtime(scope(), async () => { calls++; throw new ModelProviderError(providerCode, true); }));
    const failed = await row(accepted.runId); assert.equal(failed.error.code, expected); assert.equal(failed.error.providerCost, "unknown");
    assert.equal((await attempt(accepted.runId)).status, "unknown"); assert.equal(calls, 1);
  }
});

test("concurrent daily reservations obey global and namespace limits across reset and new namespaces", async () => {
  const a = await owner(), b = await owner(), budget = scope(), limits = { ...settings, globalDailyCalls: 3, namespaceDailyCalls: 2 };
  const reserved = await Promise.all(Array.from({ length: 8 }, (_, i) => transaction(c => reserveModelCalls(c, i % 2 ? a.session.namespaceId : b.session.namespaceId, limits, budget))));
  assert.equal(reserved.filter(Boolean).length, 3);
  a.session = await transaction(c => changeSession(c, a.token, { action: "reset", generation: a.session.generation, commandId: randomUUID() }));
  const newer = await owner(); assert.equal(await transaction(c => reserveModelCalls(c, newer.session.namespaceId, limits, budget)), null);
  assert.equal(await transaction(c => reserveModelCalls(c, newer.session.namespaceId, { ...limits, globalDailyCalls: 10 }, budget)), null, "raising config cannot raise today's durable cap");
  const nextDay = await transaction(c => reserveModelCalls(c, newer.session.namespaceId, limits, budget, "2099-01-02")); assert.equal(nextDay, "2099-01-02");
});

test("cap2 dispatch slots survive workspace reset and serialize reservations across UTC days", async () => {
  const budget = scope(), s = await owner();
  const reserved = await Promise.all(Array.from({ length: 6 }, (_, i) => transaction(c => reserveModelCalls(c, randomUUID(), settings, budget, i % 2 ? "2099-01-01" : "2099-01-02", randomUUID()))));
  assert.equal(reserved.filter(value => value !== "busy").length, 2); assert.equal(reserved.filter(value => value === "busy").length, 4);
  s.session = await transaction(c => changeSession(c, s.token, { action: "reset", generation: s.session.generation, commandId: randomUUID() }));
  assert.equal(await transaction(c => reserveModelCalls(c, s.session.namespaceId, settings, budget, "2099-01-03", randomUUID())), "busy");
  await transaction(c => c.query("UPDATE model_dispatch_slots SET expires_at=clock_timestamp()-interval '1 second' WHERE scope=$1", [budget]));
  assert.equal(await transaction(c => reserveModelCalls(c, s.session.namespaceId, settings, budget, "2099-01-03", randomUUID())), "2099-01-03");
});

test("actual worker renews the lease while a provider call waits and suppresses a second claim", { timeout: 25000 }, async () => {
  const s = await owner(), accepted = await chat(s), budget = scope(); let started, finish;
  const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { finish = resolve; });
  const pending = tick(accepted.runId, runtime(budget, async () => { started(); await gate; return fakeResult; }));
  await entered; const initial = (await row(accepted.runId)).lease_until.getTime();
  try {
    const deadline = Date.now() + 12000;
    while ((await row(accepted.runId)).lease_until.getTime() <= initial) { assert.ok(Date.now() < deadline, "lease heartbeat did not renew"); await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.equal(await transaction(c => claimRun(c, accepted.runId)), null);
  } finally { finish(); await pending; }
  assert.equal((await row(accepted.runId)).status, "completed");
});

test("cancel, reset, persona, revocation, expiry and shutdown abort I/O and reject late replies", { timeout: 45000 }, async () => {
  await Promise.all(["cancel", "reset", "persona", "revoke", "expire", "shutdown"].map(async action => {
    const s = await owner(), accepted = await chat(s), budget = scope(), shutdown = new AbortController(); let started, providerSignal, finish;
    const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { finish = resolve; });
    const pending = tick(accepted.runId, runtime(budget, async (_prompt, _policy, signal) => { providerSignal = signal; started(); await gate; return fakeResult; }), shutdown.signal);
    await entered;
    if (action === "cancel") await send(s, { kind: "cancel", requestId: randomUUID(), runId: accepted.runId });
    else if (action === "reset" || action === "persona") s.session = await transaction(c => changeSession(c, s.token, { action: action === "reset" ? "reset" : "select", ...(action === "persona" ? { profileId: "am" } : {}), generation: s.session.generation, commandId: randomUUID() }));
    else if (action === "revoke" || action === "expire") {
      // SessionView deliberately omits the database id. Resolve the owned
      // server record and prove the mutation actually reached one session.
      const owned = await transaction(c => requireSession(c, s.token, s.session.generation));
      const changed = await transaction(c => c.query(action === "revoke"
        ? "UPDATE demo_sessions SET revoked=true WHERE id=$1 RETURNING revoked AS invalidated"
        : "UPDATE demo_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1 RETURNING expires_at<clock_timestamp() AS invalidated", [owned.id]));
      assert.equal(changed.rowCount, 1, `${action} must target the actual owned session`); assert.equal(changed.rows[0].invalidated, true);
    }
    else shutdown.abort();
    try { await pending; assert.equal(providerSignal.aborted, true, action); }
    finally { finish(); }
    const saved = await row(accepted.runId); assert.ok(!saved || saved.status !== "completed", action);
    if (saved) assert.equal(saved.result, null, action);
    const slots = await transaction(c => c.query("SELECT run_id FROM model_dispatch_slots WHERE scope=$1", [budget])); assert.equal(slots.rowCount, 1, `${action} keeps uncertain dispatch slot`);
  }));
});

test("captured findings and acknowledged history obey target, persona and namespace boundaries", async () => {
  const s = await owner("sp"), other = await owner("sp"), budget = scope();
  await transaction(c => executeCommand(c, s.token, s.session.generation, { kind: "assessment.start", orgId: "prod", expectedRevision: 0, commandId: randomUUID() }));
  const assessmentRun = (await snapshot(s)).runs[0];
  const fast = { async step(...args) { const outcome = await demoAdapter.step(...args); return outcome.kind === "progress" ? { ...outcome, delayMs: 0 } : outcome; } };
  for (let i = 0; i < 10 && await workerTick({ runId: assessmentRun.id, adapter: fast }); i++) { /* bounded fixture execution */ }
  const workspace = await transaction(async c => readWorkspace(c, await requireSession(c, s.token, s.session.generation)));
  const orgId = workspace.assessment.runs.find(run => run.id === workspace.assessment.currentRunId).findings[0].orgId;
  const scoped = { ...context, target: { ...context.target, orgId } }, one = await chat(s, "Unique same-target history", scoped);
  const first = await row(one.runId), captured = JSON.parse(first.execution.prompt.messages.at(-1).content);
  assert.ok(captured.evidence.findings.length > 0); assert.ok(captured.evidence.findings.every(f => f.orgId === orgId));
  await tick(one.runId, runtime(budget));
  const allOrgs = await chat(s, "Unbound target excludes scoped history"), all = await row(allOrgs.runId);
  assert.deepEqual(all.execution.provenance.history, []); assert.ok(!JSON.stringify(all.execution.prompt).includes("Unique same-target history"));
  await tick(allOrgs.runId, runtime(budget));
  const again = await chat(s, "Same target acknowledges prior turn", scoped), next = await row(again.runId);
  assert.equal(next.execution.provenance.history.length, 2); assert.ok(JSON.stringify(next.execution.prompt).includes("Unique same-target history"));
  const foreign = await chat(other, "Foreign namespace"), isolated = await row(foreign.runId);
  assert.deepEqual(isolated.execution.provenance.history, []); assert.ok(!JSON.stringify(isolated.execution.prompt).includes("Unique same-target history"));
  await assert.rejects(send(other, { kind: "retry", requestId: randomUUID(), runId: one.runId }), error => error.code === "invalid");
  assert.deepEqual((await row(one.runId)).execution, first.execution, "later state cannot change the accepted snapshot");
});

test("one project conversation does not share model history across different selected orgs", async () => {
  const s = await owner("am"), budget = scope();
  const selected = orgId => ({ ...context, target: { projectId: "acme-storefront", worktreeId: "main", orgId } });
  const first = await chat(s, "Only sandbox history", selected("sit")); await tick(first.runId, runtime(budget));
  const other = await chat(s, "Production question", selected("prod"));
  assert.equal(other.conversationId, first.conversationId, "the test must exercise SQL target filtering within the same thread");
  assert.deepEqual((await row(other.runId)).execution.provenance.history, []); await tick(other.runId, runtime(budget));
  const again = await chat(s, "Back in sandbox", selected("sit")), execution = (await row(again.runId)).execution;
  assert.equal(again.conversationId, first.conversationId); assert.equal(execution.provenance.history.length, 2);
  assert.ok(JSON.stringify(execution.prompt).includes("Only sandbox history")); assert.ok(!JSON.stringify(execution.prompt).includes("Production question"));
});

test("navigation is committed with the completed reply and retains captured scope", async () => {
  const s = await owner("am"), selected = { surface: "code", target: { projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" } };
  const accepted = await chat(s, "Open the Account object", selected);
  let action;
  await tick(accepted.runId, runtime(scope(), async prompt => {
    const option = prompt.navigation.find(option => option.id === "resource:standard-object:Account");
    assert(option);
    action = { ...option, toolCallId: "toolu_database" };
    return { ...fakeResult, navigation: action };
  }));
  const state = await snapshot(s), saved = state.conversations.find(item => item.id === accepted.conversationId);
  const reply = saved.conversation.messages.find(message => message.role === "agent" && message.runId === accepted.runId);
  assert.deepEqual(reply.navigation, action);
  assert.deepEqual(reply.navigation.destination.target, selected.target);
  assert.equal((await row(accepted.runId)).status, "completed");
  assert.equal((await attempt(accepted.runId)).status, "succeeded");
});

test("provider cannot publish a destination outside its captured project even through an injected adapter", async () => {
  const s = await owner("am"), accepted = await chat(s, "Open a surface");
  await tick(accepted.runId, runtime(scope(), async prompt => {
    const action = structuredClone(prompt.navigation.find(option => option.id === "surface:build"));
    action.destination.target = { projectId: "trailblazer-crm", worktreeId: "main", orgId: "uat" };
    return { ...fakeResult, navigation: { ...action, toolCallId: "toolu_invalid_scope" } };
  }));
  const state = await snapshot(s);
  assert.equal((await row(accepted.runId)).status, "failed");
  assert(state.conversations.every(saved => saved.conversation.messages.every(message => !message.navigation)));
});

test("Home planning keeps acknowledged conversation history without granting navigation tools", async () => {
  const s = await owner(), budget = scope();
  const firstText = "Help me plan a React app for account managers";
  const first = await chat(s, firstText);
  await tick(first.runId, runtime(budget, async (prompt, policy) => {
    assert.equal(policy.promptVersion, "workspace-planner-v3");
    assert.equal(prompt.navigation, undefined);
    assert.equal(JSON.parse(serializeModelRequest(prompt, policy)).tools, undefined);
    return { ...fakeResult, text: "What should account managers be able to accomplish first?" };
  }));
  const second = await chat(s, "Find a customer by name and review their recent activity");
  assert.equal(second.conversationId, first.conversationId);
  await tick(second.runId, runtime(budget, async (prompt, policy) => {
    assert.equal(prompt.navigation, undefined);
    assert.equal(JSON.parse(serializeModelRequest(prompt, policy)).tools, undefined);
    assert(prompt.messages.some(message => message.role === "user" && message.content === firstText));
    assert(prompt.messages.some(message => message.role === "assistant" && message.content.includes("accomplish first")));
    return { ...fakeResult, text: "Start with account search and a customer activity view, then validate the workflow with an account manager." };
  }));
  const state = await snapshot(s), saved = state.conversations.find(item => item.id === first.conversationId);
  assert.equal(saved.conversation.scopeKey, "home");
  assert(saved.conversation.messages.every(message => !message.navigation));
  assert.equal((await row(second.runId)).status, "completed");
});

test("a planning turn rejects even an otherwise scoped navigation from a custom provider", async () => {
  const s = await owner(), accepted = await chat(s, "Help me design an automation; stay in this chat");
  const captured = (await row(accepted.runId)).input.context;
  const option = modules.load("lib/agent/navigation").navigationOptions(captured).find(option => option.id === "surface:build");
  assert(option);
  await tick(accepted.runId, runtime(scope(), async prompt => {
    assert.equal(prompt.navigation, undefined);
    return { ...fakeResult, navigation: { ...option, toolCallId: "toolu_unrequested" } };
  }));
  assert.equal((await row(accepted.runId)).status, "failed");
  assert((await snapshot(s)).conversations.every(saved => saved.conversation.messages.every(message => !message.navigation)));
});

test("a queued v2 navigation run retains its captured execution under a v3 worker", async () => {
  const s = await owner(), previousSettings = { ...settings, policy: { ...MODEL_POLICY, promptVersion: "workspace-navigator-v2" } };
  const accepted = await send(s, { kind: "submit", requestId: randomUUID(), context, text: "Help with an automation" }, previousSettings);
  const execution = (await row(accepted.runId)).execution;
  assert(execution.prompt.navigation.length);
  const body = serializeModelRequest(execution.prompt, execution.settings.policy);
  await tick(accepted.runId, runtime(scope(), async (prompt, policy) => {
    assert.equal(policy.promptVersion, "workspace-navigator-v2");
    assert.equal(serializeModelRequest(prompt, policy), body);
    return { ...fakeResult, navigation: { ...prompt.navigation.find(option => option.id === "surface:build"), toolCallId: "toolu_queued_v2" } };
  }));
  assert.equal((await row(accepted.runId)).status, "completed");
});

test("queued app navigation keeps its original model snapshot while accepting the ALM destination migration", async () => {
  for (const promptVersion of ["workspace-navigator-v2", "workspace-planner-v3"]) {
    const s = await owner("am"), selected = { surface: "code", target: { projectId: "acme-storefront", worktreeId: "main", orgId: "prod" } };
    const accepted = await send(s, { kind: "submit", requestId: randomUUID(), context: selected, text: "Open Acme Storefront" }, { ...settings, policy: { ...MODEL_POLICY, promptVersion } });
    const execution = (await row(accepted.runId)).execution;
    const option = execution.prompt.navigation.find(option => option.id === "work:storefront-app");
    assert(option);
    option.destination.surface = "build"; // A run captured before deployed apps moved.
    await transaction(client => client.query("UPDATE agent_runs SET execution=$2 WHERE id=$1", [accepted.runId, execution]));
    const originalBody = serializeModelRequest(execution.prompt, execution.settings.policy);
    await tick(accepted.runId, runtime(scope(), async (prompt, policy) => {
      assert.equal(serializeModelRequest(prompt, policy), originalBody);
      return { ...fakeResult, navigation: { ...prompt.navigation.find(option => option.id === "work:storefront-app"), toolCallId: "toolu_old_app" } };
    }));
    assert.equal((await row(accepted.runId)).status, "completed");
    assert.deepEqual((await row(accepted.runId)).execution, execution, "Routing migration must not rewrite captured model inputs");
    const state = await snapshot(s), reply = state.conversations.find(saved => saved.id === accepted.conversationId).conversation.messages.at(-1);
    const { destinationHref, readDestination } = modules.load("lib/navigation/model");
    assert.equal(readDestination(destinationHref(reply.navigation.destination)).value.surface, "alm");
  }
});
