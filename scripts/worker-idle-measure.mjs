// Run alone against an empty, migrated, disposable database. Local web server, no
// external provider calls. Measures wall time; the simulated-hour test is separate.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { freePort, startProduction, waitForServer } from './production-process.mjs';
import { testModules } from './test-modules.mjs';
if (!process.env.DATABASE_TEST_URL) throw Error('An explicit disposable test database is required');
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? '';
process.env.AGENT_PROVIDER = 'demo';
const modules = testModules();
const { transaction, databasePool } = modules.load('lib/db');
const { bootstrap, changeSession, SESSION_COOKIE } = modules.load('lib/server/session');
const { executeAgentCommand } = modules.load('lib/server/agent');
const { claimRun } = modules.load('lib/server/agent-worker');
const children = new Map(), report = { measuredOn: new Date().toISOString().slice(0, 10), environment: 'Local PostgreSQL, production web server, two independent worker processes, no browser/provider traffic', node: process.versions.node, passed: false, measurements: {}, cleanup: false };
let boot, session, server;
const port = await freePort(), origin = `http://127.0.0.1:${port}`;
Object.assign(process.env, { APP_ORIGIN: origin, BASIC_AUTH_USER: 'guest', BASIC_AUTH_PASSWORD: randomUUID() });
const authorization = 'Basic ' + Buffer.from(`guest:${process.env.BASIC_AUTH_PASSWORD}`).toString('base64');
const context = { target: { projectId: null, worktreeId: null, orgId: null }, surface: 'home' };
const row = id => transaction(async c => (await c.query('SELECT * FROM agent_runs WHERE id=$1', [id])).rows[0]);
async function waitFor(check, timeout = 5000) {
  const end = Date.now() + timeout;
  while (!check()) { assert(Date.now() < end, 'worker observation deadline'); await sleep(10); }
}
function start(mode) {
  const messages = [], errors = [];
  const child = fork(new URL('./worker-idle-child.mjs', import.meta.url), [mode], { execArgv: ['--conditions=react-server'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  child.on('message', message => messages.push(message)); child.stderr.on('data', chunk => errors.push(chunk.toString()));
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => { children.delete(child); resolve({ code, signal }); }); });
  children.set(child, exited);
  return { child, messages, scans: () => messages.filter(m => m.event === 'scan'), async stop(signal = 'SIGTERM') {
    child.kill(signal);
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { const result = await exited; if (signal !== 'SIGKILL') assert.equal(result.code, 0, errors.join('')); }
    finally { clearTimeout(timer); }
  } };
}
async function sample(workers, durationMs) {
  const beforeLog = process.env.WORKER_TEST_PG_LOG ? (await readFile(process.env.WORKER_TEST_PG_LOG)).length : null;
  const since = Date.now(); await sleep(durationMs); const until = Date.now();
  const scans = workers.flatMap(w => w.scans()).filter(m => m.at >= since && m.at < until);
  const queries = workers.flatMap(w => w.messages).filter(m => m.event === 'query' && m.at >= since && m.at < until);
  const log = beforeLog === null ? null : (await readFile(process.env.WORKER_TEST_PG_LOG)).subarray(beforeLog).toString();
  return { workers: workers.length, durationMs: until - since, scans: scans.length, queryCalls: queries.length, databaseLogEntries: log === null ? null : (log.match(/LOG:  (?:statement:|execute )/g) ?? []).length, scansPerMinute: Number((scans.length * 60000 / (until - since)).toFixed(2)) };
}
async function submit() {
  const result = await transaction(c => executeAgentCommand(c, boot.token, session.generation, { kind: 'submit', requestId: randomUUID(), context, text: 'Measure idle pickup' }));
  return { id: result.runId, committedAt: Date.now() };
}
async function picked(worker, submitted, timeout = 5000) {
  // First successful tick includes execution/publication, making this a
  // conservative submission-to-first-progress measurement.
  await waitFor(() => worker.scans().some(m => m.worked && m.at >= submitted.committedAt), timeout);
  return worker.scans().find(m => m.worked && m.at >= submitted.committedAt).at - submitted.committedAt;
}
async function finished(id) {
  const until = Date.now() + 5000;
  while ((await row(id)).status !== 'completed') { assert(Date.now() < until); await sleep(50); }
}
try {
  assert.equal((await transaction(c => c.query('SELECT count(*)::int AS n FROM agent_runs'))).rows[0].n, 0, 'Use an empty disposable database, exclusively');
  boot = await transaction(c => bootstrap(c));
  session = await transaction(c => changeSession(c, boot.token, { action: 'select', profileId: 'am', generation: boot.session.generation, commandId: randomUUID() }));
  await mkdir('.release/worker-idle', { recursive: true });
  server = startProduction(port, { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, '.release/worker-idle/measurement-web.log');
  await waitForServer(origin, server);
  const baseline = start('baseline'); await waitFor(() => baseline.scans().length);
  report.measurements.beforeIdle = await sample([baseline], 30000); await baseline.stop();
  const candidate = start('candidate'), companion = start('candidate');
  await waitFor(() => candidate.scans().length && companion.scans().length);
  await sleep(1000);
  // Avoid straddling the deliberate hourly recovery boundary in this sample.
  const toBoundary = 3600000 - Date.now() % 3600000;
  if (toBoundary < 311000) await sleep(toBoundary + 1000);
  const liveTimer = setInterval(() => { void fetch(origin + '/api/live', { headers: { authorization } }).then(r => r.text()); }, 5000);
  try { report.measurements.afterIdle = await sample([candidate, companion], 310000); }
  finally { clearInterval(liveTimer); }
  assert.equal(report.measurements.afterIdle.queryCalls, 0);
  if (report.measurements.afterIdle.databaseLogEntries !== null) assert.equal(report.measurements.afterIdle.databaseLogEntries, 0);
  const submittedAt = Date.now();
  const response = await fetch(origin + '/api/agent', { method: 'POST', headers: { authorization, origin, 'content-type': 'application/json', 'x-ufd-mutation': '1', cookie: `${SESSION_COOKIE}=${boot.token}` },
    body: JSON.stringify({ generation: session.generation, command: { kind: 'submit', requestId: randomUUID(), context, text: 'Measure after five minutes idle' } }) });
  assert.equal(response.status, 200); const body = await response.json();
  const all = { scans: () => [...candidate.scans(), ...companion.scans()].sort((a,b) => a.at - b.at) };
  report.measurements.httpSubmitToProgressMs = await picked(all, { committedAt: submittedAt });
  await finished(body.result.runId);
  assert(candidate.messages.some(m => m.event === 'wake' && m.outcome === 'available'));
  assert(companion.messages.some(m => m.event === 'wake' && m.outcome === 'available'));
  const stoppingAt = Date.now(); await Promise.all([candidate.stop(), companion.stop()]);
  report.measurements.shutdownMs = Date.now() - stoppingAt;
  // No HTTP hint: direct durable submission survives a worker restart.
  const beforeRestart = await submit();
  const lease = await transaction(c => claimRun(c, beforeRestart.id)); assert(lease);
  const restartAt = Date.now(), restarted = start('missed');
  report.measurements.restartLeaseRecoveryMs = await picked(restarted, { committedAt: restartAt }, 12000);
  await finished(beforeRestart.id); assert.equal((await row(beforeRestart.id)).recoveries, 1);
  await restarted.stop();
  assert(report.measurements.httpSubmitToProgressMs < 1500);
  assert(report.measurements.beforeIdle.scansPerMinute >= 110);
  report.passed = true;
} finally {
  const stopped = [...children.values()];
  for (const child of children.keys()) child.kill('SIGKILL');
  await Promise.all(stopped);
  await server?.stop();
  if (boot) await transaction(async c => {
    await c.query('DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)', [boot.session.namespaceId]);
    await c.query('DELETE FROM demo_sessions WHERE namespace_id=$1', [boot.session.namespaceId]);
    await c.query('DELETE FROM workspaces WHERE namespace_id=$1', [boot.session.namespaceId]);
    await c.query('DELETE FROM demo_namespaces WHERE id=$1', [boot.session.namespaceId]);
  });
  report.cleanup = true; await databasePool().end(); modules.cleanup();
  await mkdir('.release/worker-idle', { recursive: true });
  await writeFile('.release/worker-idle/measurements.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
