import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const provider = modules.load('lib/server/model-provider');
const db = modules.load('lib/db');
const attempts = modules.load('lib/server/model-attempts');
const worker = modules.load('lib/server/model-worker');
modules.load('lib/server/diagnostics').diagnoseRun = () => {};
const settings = { policy: provider.MODEL_POLICY, globalDailyCalls: 10, namespaceDailyCalls: 5 };
const lease = { run: { id: 'synthetic-run', request_id: 'synthetic-request', execution: { kind: 'model', settings, prompt: { messages: [{role: 'user', content: 'Synthetic scoped request'}] } } }, fence: 1 };
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function harness() {
  const state = { valid: true, begun: 'started', calls: 0, renewals: 0, writes: [], publications: [], partials: [], txns: 0 };
  db.transaction = async fn => { state.txns++; return fn({ query: async (sql, args) => { state.writes.push({sql, args}); if (/SET lease_until/.test(sql)) state.renewals++; return { rows: [], rowCount: 1 }; } }); };
  attempts.beginModelAttempt = async () => state.begun;
  const boundary = { valid: async () => state.valid, publish: async (_c, _l, result) => { state.publications.push(result); return true; },
    progress: async (_c, _l, text) => { if (!state.valid) return false; state.partials.push(text); return true; } };
  const runtime = { settings: () => settings, complete: async (_prompt, _policy, signal) => { state.calls++; state.signal = signal; return new Promise(() => {}); } };
  return {state, boundary, runtime};
}
test('disabled provider and durable existing intent both prevent injected provider invocation', async () => {
  for (const mode of ['disabled', 'existing']) {
    const {state,boundary,runtime} = harness();
    if(mode === 'disabled') runtime.settings = () => null; else state.begun = 'existing';
    await worker.executeModelRun(lease, boundary, undefined, runtime);
    assert.equal(state.calls, 0); assert.equal(state.publications.length, 1);
    assert.equal(state.publications[0].error.code, mode === 'disabled' ? 'unconfigured' : 'model_outcome_unknown');
  }
});

const completion = text => ({ text, messageId: 'msg_stream', model: provider.MODEL_POLICY.model, usage: { inputTokens: 10, outputTokens: 10 } });
function streamingRuntime(state, runtime) {
  let onText, finish, fail;
  runtime.complete = async (_prompt, _policy, signal, options) => {
    state.calls++; state.signal = signal; onText = options.onText;
    return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  };
  return { text: value => onText(value), finish: text => finish(completion(text)), fail: error => fail(error) };
}

test('first provider text is durable before completion; rapid deltas coalesce and finish atomically', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('First'); await settle();
  assert.deepEqual(state.partials, ['First']); assert.equal(state.publications.length, 0);
  for (let i = 1; i <= 100; i++) transport.text('First' + '.'.repeat(i));
  await settle(); assert.equal(state.partials.length, 1);
  t.mock.timers.tick(worker.MODEL_PROGRESS_MS); await settle();
  assert.deepEqual(state.partials, ['First', 'First' + '.'.repeat(100)]);
  transport.text('First' + '.'.repeat(101)); transport.finish('First' + '.'.repeat(101)); await pending;
  assert.equal(state.calls, 1); assert.equal(state.partials.length, 2);
  assert.deepEqual(state.publications, [{ kind: 'complete', text: 'First' + '.'.repeat(101) }]);
  assert(state.writes.some(write => write.sql.includes("SET status='succeeded'")));
  transport.text('Late impossible text'); t.mock.timers.tick(1000); await settle(); assert.equal(state.partials.length, 2);
});

test('slow progress transactions serialize while heartbeats renew the same paid attempt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  let release, inFlight = 0, maximum = 0;
  boundary.progress = async (_c, _l, text) => {
    inFlight++; maximum = Math.max(maximum, inFlight);
    if (!state.partials.length) await new Promise(resolve => { release = resolve; });
    state.partials.push(text); inFlight--; return true;
  };
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('A'); await settle(); transport.text('AB');
  t.mock.timers.tick(worker.MODEL_HEARTBEAT_MS); await settle();
  assert.equal(state.renewals, 1); assert.equal(state.partials.length, 0); assert.equal(maximum, 1);
  release(); await settle(); assert.deepEqual(state.partials, ['A', 'AB']); assert.equal(maximum, 1);
  transport.finish('ABC'); await pending; assert.equal(state.calls, 1);
});

test('failure and cancellation retain committed partials, reject late text, and never dispatch again', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const reason of ['provider', 'shutdown', 'ownership']) {
    const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime), stop = new AbortController();
    const pending = worker.executeModelRun(lease, boundary, stop.signal, runtime);
    await settle(); transport.text('A partial proposal'); await settle();
    if (reason === 'provider') transport.fail(new provider.ModelProviderError('incomplete', true));
    else if (reason === 'shutdown') stop.abort();
    else { state.valid = false; transport.text('A partial proposal with stale text'); t.mock.timers.tick(worker.MODEL_PROGRESS_MS); }
    await pending; assert.deepEqual(state.partials, ['A partial proposal']); assert.equal(state.calls, 1); assert.equal(state.signal.aborted, true);
    assert(state.publications.every(publication => publication.kind === 'failed'));
    if (reason === 'provider') assert.equal(state.publications[0].error.code, 'model_incomplete');
    if (reason === 'ownership') assert.equal(state.publications.length, 0);
    transport.text('Must not be committed'); transport.finish('Must not be completed'); await settle();
    assert.deepEqual(state.partials, ['A partial proposal']);
  }
});

test('uncertain partial commit aborts the stream instead of repeating dispatch or publishing completion', async () => {
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  boundary.progress = async (_c, _l, text) => { state.partials.push(text); throw Error('Lost partial commit acknowledgement'); };
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('Committed or uncertain text'); await pending;
  assert.equal(state.calls, 1); assert.equal(state.signal.aborted, true);
  assert.deepEqual(state.partials, ['Committed or uncertain text']);
  assert.deepEqual(state.publications.map(value => value.error.code), ['model_outcome_unknown']);
  transport.finish('Late completion'); await settle(); assert.equal(state.publications.length, 1);
});

test('provider failure preserves the buffered tail in the same transaction as its failed status', async () => {
  for (const reason of ['invalid_response', 'incomplete', 'refused', 'provider_failed']) {
    const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
    const originalProgress = boundary.progress, originalPublish = boundary.publish, progressClients = [], terminalClients = [];
    boundary.progress = async (client, ...args) => { progressClients.push(client); return originalProgress(client, ...args); };
    boundary.publish = async (client, ...args) => { terminalClients.push(client); return originalPublish(client, ...args); };
    const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
    await settle(); transport.text('The full'); await settle();
    transport.text('The full sentence is available.');
    transport.fail(new provider.ModelProviderError(reason, true)); await pending;
    assert.deepEqual(state.partials, ['The full', 'The full sentence is available.']);
    assert.equal(progressClients.at(-1), terminalClients[0], 'Tail and failure use one transaction');
    assert.notEqual(progressClients[0], terminalClients[0]);
    assert.equal(state.publications.length, 1); assert.equal(state.publications[0].kind, 'failed');
    assert.equal(state.calls, 1); assert.equal(state.signal.aborted, true);
  }
});

test('terminal tail waits for in-flight progress and never overlaps or reorders writes', async () => {
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  let release, writing = 0, maximum = 0;
  boundary.progress = async (_client, _lease, text) => {
    writing++; maximum = Math.max(maximum, writing);
    if (!state.partials.length) await new Promise(resolve => { release = resolve; });
    state.partials.push(text); writing--; return true;
  };
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('First'); await settle();
  transport.text('First and last.'); transport.fail(new provider.ModelProviderError('incomplete', true)); await settle();
  assert.equal(state.publications.length, 0); assert.equal(maximum, 1);
  release(); await pending;
  assert.deepEqual(state.partials, ['First', 'First and last.']); assert.equal(maximum, 1);
  assert.equal(state.publications[0].error.code, 'model_incomplete'); assert.equal(state.calls, 1);
});

test('shutdown and invalidated ownership do not flush buffered text after interruption', async () => {
  for (const reason of ['shutdown', 'ownership']) {
    const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime), stop = new AbortController();
    const pending = worker.executeModelRun(lease, boundary, stop.signal, runtime);
    await settle(); transport.text('Committed text'); await settle(); transport.text('Committed text with a buffered tail');
    if (reason === 'shutdown') stop.abort();
    else { state.valid = false; transport.fail(new provider.ModelProviderError('invalid_response', true)); }
    await pending; assert.deepEqual(state.partials, ['Committed text']);
    if (reason === 'ownership') assert.equal(state.publications.length, 0);
    assert.equal(state.calls, 1);
  }
});

test('a failed terminal tail transaction rejects without retrying or completing the paid attempt', async () => {
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  let writes = 0;
  boundary.progress = async (_client, _lease, text) => { if (++writes === 2) throw Error('Terminal transaction unavailable'); state.partials.push(text); return true; };
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('Committed'); await settle(); transport.text('Committed with a tail');
  transport.fail(new provider.ModelProviderError('incomplete', true));
  await assert.rejects(pending, /Terminal transaction unavailable/);
  assert.deepEqual(state.partials, ['Committed']); assert.equal(state.publications.length, 0);
  assert.equal(writes, 2); assert.equal(state.calls, 1); assert.equal(state.signal.aborted, true);
});

test('lost authority at the terminal tail leaves intent untouched and publishes no failure', async () => {
  const { state, boundary, runtime } = harness(), transport = streamingRuntime(state, runtime);
  let writes = 0;
  boundary.progress = async (_client, _lease, text) => { if (++writes === 2) return false; state.partials.push(text); return true; };
  const pending = worker.executeModelRun(lease, boundary, undefined, runtime);
  await settle(); transport.text('Committed'); await settle(); transport.text('Committed with a stale tail');
  transport.fail(new provider.ModelProviderError('invalid_response', true)); await pending;
  assert.deepEqual(state.partials, ['Committed']); assert.equal(state.publications.length, 0);
  assert(!state.writes.some(write => write.sql.includes('UPDATE model_attempts')));
  assert.equal(writes, 2); assert.equal(state.calls, 1); assert.equal(state.signal.aborted, true);
});
test('ownership loss on heartbeat aborts uncooperative provider and prevents publication', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {state,boundary,runtime} = harness();
  const pending = worker.executeModelRun(lease,boundary,undefined,runtime);
  await settle(); assert.equal(state.calls,1); state.valid=false;
  t.mock.timers.tick(worker.MODEL_HEARTBEAT_MS); await pending;
  assert.equal(state.signal.aborted,true); assert.equal(state.publications.length,0); assert.equal(state.calls,1);
});
test('renewal extends owned lease before an external shutdown aborts the paid attempt', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {state,boundary,runtime}=harness(), signal=new AbortController();
  const pending=worker.executeModelRun(lease,boundary,signal.signal,runtime);
  await settle(); t.mock.timers.tick(worker.MODEL_HEARTBEAT_MS); await settle();
  assert.equal(state.renewals,1); signal.abort(); await pending;
  assert.equal(state.signal.aborted,true); assert.equal(state.calls,1);
  assert.equal(state.publications[0].error.providerCost,'unknown');
});
test('worker deadline bounds an uncooperative provider independently of transport implementation', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {state,boundary,runtime}=harness();
  const pending=worker.executeModelRun(lease,boundary,undefined,runtime);
  await settle(); t.mock.timers.tick(provider.MODEL_POLICY.timeoutMs); await pending;
  assert.equal(state.signal.aborted,true); assert.equal(state.calls,1); assert.equal(state.publications.length,1);
  assert.equal(state.publications[0].error.providerCost,'unknown');
  assert.equal(state.publications[0].error.code,'model_timeout');
});
test('uncertain intent commit rejects before dispatch and records conservative failure', async () => {
  const {state,boundary,runtime}=harness();
  const transaction=db.transaction; let first=true;
  db.transaction=async fn => {const result=await transaction(fn); if(first){ first=false; throw Error('synthetic uncertain commit'); } return result;};
  await worker.executeModelRun(lease,boundary,undefined,runtime);
  assert.equal(state.calls,0); assert.equal(state.publications[0].error.code,'model_outcome_unknown');
});
test('safe provider classifications survive worker persistence separately from unknown cost', async () => {
  for (const [code, expected] of [['refused','model_refused'],['incomplete','model_incomplete'],['rate_limited','model_rate_limited'],['unconfigured','unconfigured'],['invalid_response','model_failed']]) {
    const {state,boundary,runtime}=harness();
    runtime.complete=async () => {state.calls++; throw new provider.ModelProviderError(code,true);};
    await worker.executeModelRun(lease,boundary,undefined,runtime);
    assert.equal(state.calls,1); assert.equal(state.publications[0].error.code,expected);
    assert.equal(state.publications[0].error.providerCost,'unknown');
    assert.equal(state.publications[0].error.message,new provider.ModelProviderError(code,true).message);
  }
});
