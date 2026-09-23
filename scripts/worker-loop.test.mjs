import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners } from 'node:events';
import { workerActivity } from './worker-activity.mjs';
import { testModules } from './test-modules.mjs';
const modules = testModules();
const { WorkerWake, runWorkerLoop, WORKER_RECOVERY_MS } = modules.load('lib/server/worker-loop');
const { watchWorkerActivity } = modules.load('lib/server/worker-wake');
after(() => modules.cleanup());
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(t, ms) { for (let elapsed = 0; elapsed < ms; elapsed += 500) { t.mock.timers.tick(Math.min(500, ms - elapsed)); await flush(); } }
function clock(t) { t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 }); }
function start(tick, hasWork = async () => false, onError = () => {}) {
  const controller = new AbortController(), wake = new WorkerWake();
  const done = runWorkerLoop({ signal: controller.signal, wake, tick, hasWork, onError });
  return { controller, wake, done, stop: async () => { controller.abort(); await done; } };
}
test('idle worker leaves uninterrupted five-minute gaps and recovers a lost wake within one hour', async t => {
  clock(t); let pending = false, claimed = false; const scans = [];
  const worker = start(async () => { scans.push(Date.now()); if (pending) { claimed = true; pending = false; return true; } return false; });
  await flush(); await advance(t, 10 * 60000); assert.equal(scans.length, 1);
  pending = true; await advance(t, WORKER_RECOVERY_MS); assert(claimed);
  assert(scans[1] - scans[0] > 5 * 60000);
  await worker.stop(); assert.equal(getEventListeners(worker.controller.signal, 'abort').length, 0);
});
test('a web hint wakes a long-idle worker immediately, bursts coalesce and shutdown interrupts sleep', async t => {
  clock(t); let scans = 0;
  const worker = start(async () => { scans++; return false; });
  await flush(); await advance(t, 10 * 60000); const before = scans;
  for (let i = 0; i < 100; i++) worker.wake.notify();
  await flush(); assert.equal(scans, before + 1); await worker.stop();
  await advance(t, WORKER_RECOVERY_MS); assert.equal(scans, before + 1);
});
test('a hint during a scan survives the decision to sleep', async () => {
  let finish, scans = 0;
  const worker = start(() => { scans++; return scans === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(false); });
  worker.wake.notify(); finish(false); await flush(); assert.equal(scans, 2); await worker.stop();
});
test('workers started at different times share hourly recovery windows', async t => {
  clock(t); const firstScans = [], secondScans = [];
  const first = start(async () => { firstScans.push(Date.now()); return false; });
  await flush(); await advance(t, 1800000);
  const second = start(async () => { secondScans.push(Date.now()); return false; });
  await flush(); await advance(t, WORKER_RECOVERY_MS);
  assert.equal(firstScans.length, 2); assert.equal(secondScans.length, 2);
  assert.equal(firstScans[1], secondScans[1]);
  await Promise.all([first.stop(), second.stop()]);
});
test('future steps and other workers leases keep recovery responsive without browser activity', async t => {
  clock(t); let due = Date.now() + 60000, completed = 0;
  const worker = start(async () => { if (Date.now() < due) return false; assert(Date.now() - due <= 500); completed++; due += 60000; return true; }, async () => true);
  await flush(); await advance(t, 180000); assert.equal(completed, 3); await worker.stop();
  let scanned = false; const restarted = start(async () => { scanned = true; return false; }); assert(scanned); await restarted.stop();
});
test('database failures back off to quiet gaps instead of retrying forever at short intervals', async t => {
  clock(t); let errors = 0;
  const worker = start(async () => { throw Error('unavailable'); }, async () => false, () => { errors++; });
  await flush(); await advance(t, 2 * WORKER_RECOVERY_MS); assert(errors < 20); await worker.stop();
});
function response() { return Object.assign(new EventEmitter(), { destroyed: false, writeHead() {}, end(body) { this.body = JSON.parse(body); } }); }
test('web activity broadcasts without SQL, expires, and cleans up disconnected long polls', async t => {
  clock(t); const activity = workerActivity(), first = response(), second = response();
  activity.handle({}, first); activity.handle({}, second); assert.equal(first.body, undefined);
  activity.touch(); assert.deepEqual(first.body, { active: true }); assert.deepEqual(second.body, { active: true });
  await advance(t, 60000); const idle = response(); activity.handle({}, idle); await advance(t, 20000); assert.deepEqual(idle.body, { active: false });
  const disconnected = response(); activity.handle({}, disconnected); disconnected.destroyed = true; disconnected.emit('close'); activity.touch(); assert.equal(disconnected.body, undefined);
  assert.equal(getEventListeners(disconnected, 'close').length, 0);
});
test('web shutdown releases pending polls without waiting for their timeout', () => {
  const activity = workerActivity(), waiting = response(); activity.handle({}, waiting); activity.close(); assert.deepEqual(waiting.body, { active: false });
  activity.touch(); const late = response(); activity.handle({}, late); assert.deepEqual(late.body, { active: false });
});
test('HTTP wake watcher never wakes for empty or failed responses and aborts in-flight waits', async t => {
  clock(t);
  const env = { APP_ORIGIN: 'https://studio.example', BASIC_AUTH_USER: 'guest', BASIC_AUTH_PASSWORD: 'test-password' };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  let calls = 0; const states = [], wake = new WorkerWake(), controller = new AbortController();
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://studio.example/api/worker/wake'); assert.equal(options.redirect, 'error');
    assert.match(options.headers.authorization, /^Basic /); calls++;
    if (calls === 1) return Response.json({ active: false });
    if (calls === 2) return Response.json({ active: true });
    if (calls === 3) return new Response('', { status: 503 });
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
  });
  const done = watchWorkerActivity({ signal: controller.signal, wake, onState: state => states.push(state) });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(wake.take(), false);
  await advance(t, 1000); await new Promise(resolve => setImmediate(resolve)); assert(wake.take());
  await advance(t, 5000); await new Promise(resolve => setImmediate(resolve)); assert.equal(wake.take(), false); assert(states.includes('unavailable'));
  await advance(t, 5000); controller.abort(); await done;
});
