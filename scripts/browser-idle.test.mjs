import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules();
after(() => modules.cleanup());
const { AgentClient } = modules.load('lib/agent/client');
const { browserActivity } = modules.load('lib/browser-activity');
const session = { namespaceId: 'n', profileId: 'am', generation: 'g', workspaceEpoch: 'e', expiresAt: 'future' };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(t, ms) { for (let elapsed = 0; elapsed < ms; elapsed += 500) { t.mock.timers.tick(Math.min(500, ms - elapsed)); await flush(); } }
function browser(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const previous = { window: global.window, document: global.document };
  global.window = new EventTarget(); global.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } });
}
test('idle agent history stops after a minute, including read failures; input resumes immediately', async t => {
  browser(t); let reads = 0, fail = false;
  const client = new AgentClient(session, { read: async () => { reads++; if (fail) throw Error('offline'); return { runs: [], conversations: [] }; } }, () => {}, () => {});
  try {
    client.start(); await flush(); await advance(t, 65000); const before = reads;
    await advance(t, 600000); assert.equal(reads, before); assert.equal(browserActivity.isActive(), false);
    fail = true; window.dispatchEvent(new Event('keydown')); await flush(); assert.equal(reads, before + 1);
    await advance(t, 65000); const failedReads = reads; await advance(t, 600000); assert.equal(reads, failedReads);
    fail = false; window.dispatchEvent(new Event('focus')); await flush(); assert.equal(reads, failedReads + 1);
  } finally { client.deactivate(); }
});
test('active runs keep refreshing without input; hidden tabs pause and visibility resumes', async t => {
  browser(t); let reads = 0, terminal = false;
  const client = new AgentClient(session, { read: async () => { reads++; return { runs: [{ id: 'r', kind: 'chat', status: terminal ? 'completed' : 'running', sequence: terminal ? 2 : 1 }], conversations: [] }; } }, () => {}, () => {});
  try {
    client.start(); await flush(); await advance(t, 65000); const activeReads = reads;
    await advance(t, 10000); assert(reads > activeReads);
    document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); const hiddenReads = reads;
    await advance(t, 600000); assert.equal(reads, hiddenReads);
    terminal = true; document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(reads, hiddenReads + 1);
    await advance(t, 65000); const doneReads = reads; await advance(t, 600000); assert.equal(reads, doneReads);
  } finally { client.deactivate(); }
});
test('selected streaming progress also pauses while hidden and resumes on visibility', async t => {
  browser(t); let progressReads = 0;
  const run = { id: 'r', conversationId: 'c', kind: 'chat', status: 'streaming', sequence: 1 };
  const client = new AgentClient(session, {
    read: async () => ({ runs: [run], conversations: [{ id: 'c', threadKey: 'thread', revision: 1, conversation: { scopeKey: 'home', messages: [] } }] }),
    readRun: async () => { progressReads++; return { run }; },
  }, () => {}, () => {});
  try {
    client.setThread('thread'); client.start(); await flush(); await advance(t, 65000);
    const activeReads = progressReads; await advance(t, 5000); assert(progressReads > activeReads);
    document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    const hiddenReads = progressReads; await advance(t, 600000); assert.equal(progressReads, hiddenReads);
    document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await flush();
    await advance(t, 500); assert(progressReads > hiddenReads);
  } finally { client.deactivate(); }
});
