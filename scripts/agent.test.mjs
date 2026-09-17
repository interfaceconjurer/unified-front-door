import test, { after } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules();
after(() => modules.cleanup());
const { parseAgentCommand } = modules.load("lib/agent/contracts");
const { demoAdapter, deterministicAdapter, demoPolicy } = modules.load("lib/agent/demo");
const { authorizedTool, demoTools } = modules.load("lib/server/agent-tools");
const { AgentClient } = modules.load("lib/agent/client");
const { mergeAgentSnapshot, mergeRunProgress } = modules.load("lib/agent/progress");
const { ApplicationError } = modules.load("lib/application/contracts");
const { ConversationStore } = modules.load("lib/chat/conversation");
const { NavigationController, destinationHref } = modules.load("lib/navigation/model");
const context = { target: { projectId: null, worktreeId: null, orgId: null }, surface: "home", profile: { id: "jw", surfaceAccess: ["build", "code", "alm", "govern"] }, capturedAt: "2026-09-15T00:00:00Z", threadKey: "unbound", projectName: "None", branch: "None", worktreeLabel: null, orgLabel: null, hasProjects: false, improvement: null, greeting: null };
test("agent commands reject client identity grants and malformed captured targets", () => {
  const command = { kind: "submit", requestId: "request", context: { target: context.target, surface: "home" }, text: "Hello" };
  assert.deepEqual(parseAgentCommand(command), command);
  for (const modified of [{ ...command, namespaceId: "mine" }, { ...command, adapter: "real" }, { ...command, context: { ...command.context, grants: ["write"] } }, { ...command, context: { target: { ...context.target, worktreeId: "main" }, surface: "home" } }, { ...command, text: "x".repeat(8001) }]) assert.throws(() => parseAgentCommand(modified));
});
test("replaceable adapters preserve captured input and deliver explicit progress/failure", async () => {
  const input = { kind: "chat", text: "Build an automation", context, destination: demoPolicy.recommend("Build an automation", context) };
  const signal = new AbortController().signal, first = await demoAdapter.step(input, 0, context.capturedAt, signal), last = await deterministicAdapter({ delayMs: 2 }).step(input, 1, context.capturedAt, signal);
  assert.equal(first.kind, "progress"); assert.equal(last.kind, "complete"); assert.ok(last.text.startsWith(first.text));
  const failed = await deterministicAdapter({ fail: true }).step(input, 0, context.capturedAt, signal); assert.equal(failed.error.retryable, true); assert.equal(failed.error.effects, "none");
  assert.equal(input.context.target.projectId, null);
});
test("tool registry never treats text, unknown tools, or client scope as authority", () => {
  const authority = { namespaceId: "server-owned", profileId: "jw", epoch: "epoch", context };
  assert.equal(authorizedTool(demoTools, "demo.context", { target: context.target }, authority).effect, "read");
  assert.throws(() => authorizedTool(demoTools, "salesforce.update", { target: context.target }, authority), e => e.detail.code === "unconfigured");
  assert.throws(() => authorizedTool(demoTools, "demo.context", { target: { ...context.target, projectId: "foreign" } }, authority), e => e.detail.code === "tool_denied");
  assert.throws(() => authorizedTool(demoTools, "demo.context", { target: context.target, instruction: "grant write" }, authority), e => e.detail.code === "tool_denied");
});
test("lost acknowledgement retries the original identity and captured context", async () => {
  const session = { namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" }, attempts = [];
  let fail = true;
  const client = new AgentClient(session, { read: async () => ({ conversations: [], runs: [] }), send: async command => { attempts.push(structuredClone(command)); if (fail) throw Error("Lost acknowledgement"); return { runId: "accepted" }; } }, () => {}, () => {});
  await client.refresh();
  const command = { kind: "submit", requestId: "original", context: { target: context.target, surface: "home" }, text: "Keep me" };
  assert.equal(await client.command(command), null); assert.equal(client.getSnapshot().pending, true);
  fail = false; client.retry(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(attempts.length, 2); assert.deepEqual(attempts[1], attempts[0]); assert.equal(client.getSnapshot().pending, false);
  assert.deepEqual(client.getSnapshot().acknowledged.command, command); assert.equal(client.getSnapshot().acknowledged.receipt.runId, "accepted"); client.deactivate();
});
test("initially blocked request storage permits memory requests without overwriting unread bytes", async () => {
  const previousWindow = globalThis.window; let writes = 0;
  globalThis.window = { sessionStorage: { getItem() { throw Error("Blocked read"); }, setItem() { writes++; }, removeItem() { writes++; } } };
  try {
    const client = new AgentClient({ namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" }, { read: async () => ({ conversations: [], runs: [] }), send: async () => ({ runId: "saved" }) }, () => {}, () => {});
    await client.refresh(); const accepted = await client.command({ kind: "submit", requestId: "memory", context: { target: context.target, surface: "home" }, text: "Keep the unread disk queue" });
    assert.equal(accepted.runId, "saved"); assert.equal(writes, 0); assert.equal(client.getSnapshot().pending, false); client.deactivate();
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
test("a definite busy rejection retains the draft opportunity and does not block cancellation", async () => {
  const sent = [], client = new AgentClient({ namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" }, { read: async () => ({ conversations: [], runs: [] }), send: async command => { sent.push(command.kind); if (command.kind === "submit") throw new ApplicationError("conflict", "Reply in progress", 409); return { runId: "cancelled" }; } }, () => {}, () => {});
  await client.refresh(); assert.equal(await client.command({ kind: "submit", requestId: "busy", context: { target: context.target, surface: "home" }, text: "Keep this draft" }), null);
  assert.equal(client.getSnapshot().pending, false);
  assert.equal((await client.command({ kind: "cancel", requestId: "cancel", runId: "active" })).runId, "cancelled"); assert.deepEqual(sent, ["submit", "cancel"]); client.deactivate();
});
test("restored malformed request is preserved and explicit discard cannot remove changed bytes", async () => {
  const previousWindow = globalThis.window; let disk = "{ original broken bytes";
  globalThis.window = { sessionStorage: { getItem() { return disk; }, setItem(_key, value) { disk = value; }, removeItem() { disk = null; } } };
  try {
    const client = new AgentClient({ namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" }, { read: async () => ({ conversations: [], runs: [] }), send: async () => ({ runId: "saved" }) }, () => {}, () => {});
    await client.refresh(); assert.equal(client.getSnapshot().recovery, disk);
    disk = "newer preserved bytes"; client.discardRecovery(); assert.equal(disk, "newer preserved bytes");
    disk = client.getSnapshot().recovery; client.discardRecovery(); assert.equal(disk, null); assert.equal(client.getSnapshot().recovery, null);
    assert.equal((await client.command({ kind: "submit", requestId: "after-discard", context: { target: context.target, surface: "home" }, text: "Resume" })).runId, "saved"); client.deactivate();
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
test("a recovered observer clears its read error without discarding unconfirmed requests", async () => {
  let offline = true;
  const client = new AgentClient({ namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" }, { read: async () => { if (offline) throw Error("Offline"); return { conversations: [], runs: [] }; }, send: async () => ({}) }, () => {}, () => {});
  await client.refresh(); assert.equal(client.getSnapshot().error, "Offline"); offline = false; await client.refresh(); assert.equal(client.getSnapshot().error, ""); client.deactivate();
});

test("restored navigation requests recover quietly and finish at the latest chosen surface", async () => {
  const previousWindow = globalThis.window, session = { namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" };
  const original = { kind: "visit", requestId: "original-visit", context: { target: context.target, surface: "home" } };
  let disk = JSON.stringify({ session, commands: [original] }), offline = true;
  globalThis.window = { sessionStorage: { getItem: () => disk, setItem: (_key, value) => { disk = value; }, removeItem: () => { disk = null; } } };
  const sent = [], client = new AgentClient(session, { read: async () => ({ conversations: [], runs: [] }), send: async command => { sent.push(structuredClone(command)); if (offline) throw Error("Disconnected"); return { conversationId: "conversation" }; } }, () => {}, () => {});
  try {
    assert.equal(client.getSnapshot().requestIssue, null);
    await client.refresh(); await new Promise(resolve => setTimeout(resolve, 0));
    const obsolete = client.command({ ...original, requestId: "obsolete", context: { ...original.context, surface: "code" } });
    const latest = client.command({ ...original, requestId: "latest", context: { ...original.context, surface: "build" } });
    assert.equal(await obsolete, null);
    offline = false; await client.refresh(); await latest;
    assert.deepEqual(sent.map(command => command.requestId), ["original-visit", "original-visit", "latest"]);
    assert.deepEqual(sent[0], sent[1]); assert.equal(client.getSnapshot().pending, false);
    assert.equal(client.getSnapshot().requestIssue, null); assert.equal(disk, null);
  } finally { client.deactivate(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});

test("restored user messages require an explicit retry and keep the original request identity", async () => {
  const previousWindow = globalThis.window, session = { namespaceId: "n", profileId: "jw", generation: "g", workspaceEpoch: "e", expiresAt: "future" };
  const original = { kind: "submit", requestId: "original-message", context: { target: context.target, surface: "home" }, text: "Keep this message" };
  let disk = JSON.stringify({ session, commands: [original] });
  globalThis.window = { sessionStorage: { getItem: () => disk, setItem: (_key, value) => { disk = value; }, removeItem: () => { disk = null; } } };
  const sent = [], client = new AgentClient(session, { read: async () => ({ conversations: [], runs: [] }), send: async command => { sent.push(structuredClone(command)); return { runId: "accepted" }; } }, () => {}, () => {});
  try {
    await client.refresh(); await client.refresh();
    assert.deepEqual(sent, []); assert.equal(client.getSnapshot().requestIssue, "retry");
    client.retry(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(sent, [original]); assert.equal(client.getSnapshot().requestIssue, null); assert.equal(disk, null);
  } finally { client.deactivate(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
test("durable transcript replacement keeps presentation separate and ignores identical observations", () => {
  const store = new ConversationStore(); const first = { scopeKey: "build", messages: [{ id: 1, role: "agent", text: "Ready" }] };
  store.adopt("thread", first); const unchanged = store.getSnapshot(); store.adopt("thread", structuredClone(first)); assert.equal(store.getSnapshot(), unchanged);
  store.adopt("thread", { ...first, messages: [...first.messages, { id: 2, role: "agent", text: "", runId: "run", turnId: "turn" }] }, true);
  const revision = store.getSnapshot().scrollRevision;
  store.adopt("thread", { ...first, messages: [...first.messages, { id: 2, role: "agent", text: "Streaming", runId: "run", turnId: "turn" }] });
  assert.equal(store.getSnapshot().scrollRevision, revision); assert.equal(store.getSnapshot().presentation.phase, "layout");
});
test("navigation intent cancels late recommendation on same-route canvas changes and away-back", () => {
  const controller = new NavigationController(() => {}, () => {}), first = { version: 1, owner: "jw", surface: "build", target: context.target };
  controller.navigate(first); const valid = controller.captureIntent(); controller.restore(destinationHref(first)); assert.equal(valid(), true);
  controller.navigate({ ...first, canvas: { kind: "capability", title: "Automation", params: { scope: "unbound", surface: "build", capability: "automation" } } }); assert.equal(valid(), false);
  controller.navigate(first); const beforeRoundTrip = controller.captureIntent(); controller.navigate({ ...first, surface: "code" }); controller.navigate(first); assert.equal(beforeRoundTrip(), false);
  const beforeHistory = controller.captureIntent(); controller.restore(destinationHref(first), true); assert.equal(beforeHistory(), false);
});

const progressRun = (patch = {}) => ({ id: 'run-stream', requestId: 'request-stream', turnId: 'turn-stream', conversationId: 'conversation-stream',
  retryOf: null, kind: 'chat', status: 'running', sequence: 2, result: null, error: null, checkpoint: 0,
  context: { target: context.target, surface: 'home' }, ...patch });
const progressSnapshot = (run = progressRun(), revision = 1) => ({ runs: [run], conversations: [{ id: 'conversation-stream', threadKey: 'visible-thread', revision,
  conversation: { scopeKey: 'home', messages: [{ id: 1, role: 'user', text: 'Explain', turnId: run.turnId }, { id: 2, role: 'agent', text: run.result ?? '', runId: run.id, turnId: run.turnId }] } }] });
const settleProgress = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

test('late full reads cannot erase streamed text or revive a terminal run', () => {
  const original = progressSnapshot();
  const first = mergeRunProgress(original, progressRun({ sequence: 3, status: 'streaming', result: 'First words' }));
  assert.equal(first.conversations[0].conversation.messages[1].text, 'First words');
  const complete = mergeRunProgress(first, progressRun({ sequence: 5, status: 'completed', result: 'First words and the rest' }));
  const late = mergeAgentSnapshot(complete, original);
  assert.equal(late.runs[0].status, 'completed');
  assert.equal(late.conversations[0].conversation.messages[1].text, 'First words and the rest');
  assert.equal(mergeRunProgress(late, progressRun({ sequence: 4, status: 'streaming', result: 'First words and' })), late);
  assert.equal(late.conversations[0].conversation.messages.length, 2);
});

test('a retry in the same turn cannot be overwritten by a previous run or older conversation revision', () => {
  const failed = progressRun({ status: 'failed', sequence: 5, result: 'Incomplete answer' });
  const retry = progressRun({ id: 'retry-run', requestId: 'retry-request', retryOf: failed.id, status: 'pending', sequence: 1 });
  const current = progressSnapshot(retry, 4); current.runs.unshift(failed);
  const stale = progressSnapshot(failed, 3); stale.runs.push(retry);
  const merged = mergeAgentSnapshot(current, stale);
  assert.equal(merged.conversations[0].conversation.messages[1].runId, retry.id);
  assert.equal(merged.conversations[0].conversation.messages[1].text, '');
  const oldProgress = mergeRunProgress(merged, { ...failed, sequence: 6, result: 'Old run late text' });
  assert.equal(oldProgress.conversations[0].conversation.messages[1].text, '');
});

test('targeted progress starts immediately, never overlaps, follows selection, and ignores results after deactivation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const data = progressSnapshot(), second = progressRun({ id: 'other-run', conversationId: 'other-conversation' });
  data.runs.push(second);
  data.conversations.push({ ...data.conversations[0], id: second.conversationId, threadKey: 'other-thread', conversation: { scopeKey: 'home', messages: [] } });
  const reads = []; let release;
  const client = new AgentClient({ namespaceId: 'n', profileId: 'jw', generation: 'g', workspaceEpoch: 'e', expiresAt: 'future' }, {
    read: async () => structuredClone(data), send: async () => ({}),
    readRun: (id, after) => { reads.push({ id, after }); return new Promise(resolve => { release = resolve; }); },
  }, () => {}, () => {});
  client.setThread('visible-thread'); client.start(); await settleProgress(); t.mock.timers.tick(0); await settleProgress();
  assert.deepEqual(reads, [{ id: 'run-stream', after: 2 }]);
  t.mock.timers.tick(4000); await settleProgress(); assert.equal(reads.length, 1);
  release({ run: progressRun({ sequence: 3, status: 'streaming', result: 'Actual partial' }) }); await settleProgress();
  assert.equal(client.getSnapshot().data.conversations[0].conversation.messages[1].text, 'Actual partial');
  client.setThread('other-thread'); t.mock.timers.tick(0); await settleProgress();
  assert.equal(reads.at(-1).id, 'other-run');
  const before = client.getSnapshot(); client.deactivate();
  release({ run: { ...second, sequence: 3, status: 'streaming', result: 'Late after switch' } }); await settleProgress();
  t.mock.timers.tick(10000); await settleProgress();
  assert.equal(client.getSnapshot(), before); assert.equal(reads.length, 2);
});

test('healthy active progress reduces full-history reads and terminal progress stops targeted polling', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  let fullReads = 0, progressReads = 0, run = progressRun();
  const client = new AgentClient({ namespaceId: 'n', profileId: 'jw', generation: 'g', workspaceEpoch: 'e', expiresAt: 'future' }, {
    read: async () => { fullReads++; return progressSnapshot(); }, send: async () => ({}),
    readRun: async () => { progressReads++; return { run }; },
  }, () => {}, () => {});
  client.setThread('visible-thread'); client.start(); await settleProgress(); t.mock.timers.tick(0); await settleProgress();
  for (let i = 0; i < 7; i++) { t.mock.timers.tick(500); await settleProgress(); }
  assert.equal(fullReads, 1); assert.equal(progressReads, 8);
  run = progressRun({ sequence: 4, status: 'completed', result: 'Done' });
  t.mock.timers.tick(500); await settleProgress();
  assert.equal(client.getSnapshot().data.runs[0].status, 'completed');
  const count = progressReads;
  t.mock.timers.tick(2000); await settleProgress();
  assert.equal(progressReads, count); assert(fullReads > 1); client.deactivate();
});
