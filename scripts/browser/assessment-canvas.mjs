import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
let fixtures;
try {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  fixtures = await installAssessment(context);
  const { run, state, commands } = fixtures;
  const target = { projectId: null, worktreeId: null, orgId: 'uat' };
  const destination = (runId, findingId) => ({ version: 1, owner: 'sp', surface: 'build', target,
    canvas: { kind: 'org-assessment', title: findingId ? run.findings[0].title : 'Org assessment', params: { scope: 'unbound', orgId: 'uat', runId, ...(findingId ? { findingId } : {}) } } });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + destinationHref({ version: 1, owner: 'sp', surface: null, target }));
  await page.getByRole('button', { name: 'UAT Sandbox', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/build');
  let routed = JSON.parse(new URL(page.url()).searchParams.get('destination'));
  assert.deepEqual(routed.target, target); assert.equal(routed.canvas.kind, 'org-assessment'); assert.equal(routed.canvas.params.runId, run.id);
  await page.getByRole('heading', { name: 'Org assessment', exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox').count(), 0, 'Scope follows the connection rather than a multi-org picker');
  out.checks.push('Today scope opens Build assessment with the selected org and captured run; new scans follow one selected connected org');
  const oldFindingHref = origin + destinationHref(destination(run.id, run.findings[0].id));
  await page.goto(oldFindingHref);
  await page.getByText(run.findings[0].evidence[0], { exact: true }).waitFor();
  await page.reload();
  await page.getByText(run.findings[0].evidence[0], { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Pause assessment|Resume assessment/ }).count(), 0);
  out.checks.push('Finding evidence is captured data, survives reload, and has no live-run controls');
  await page.goto(origin + destinationHref(destination(run.id)));
  let releaseRefresh, refreshBlocked, held = false;
  const refreshGate = new Promise(resolve => releaseRefresh = resolve);
  const pendingRefresh = new Promise(resolve => refreshBlocked = resolve);
  await context.route('**/api/application*', async route => {
    if (!held && route.request().method() === 'GET' && state.snapshot.assessment.currentRunId !== run.id) {
      held = true; refreshBlocked(); await refreshGate;
    }
    await route.fallback();
  });
  const rescanned = page.waitForResponse(response => response.url().includes('/api/application') && response.request().method() === 'POST'
    && response.request().postDataJSON().command.kind === 'assessment.rescan');
  await page.getByRole('button', { name: 'Run assessment', exact: true }).click();
  const rescanResponse = await rescanned;
  const newRunId = state.snapshot.assessment.currentRunId;
  assert.notEqual(newRunId, run.id);
  const commandId = rescanResponse.request().postDataJSON().command.commandId;
  const replayed = page.waitForResponse(response => response.url().includes('/api/application') && response.request().method() === 'POST'
    && response.request().postDataJSON().command.commandId === commandId);
  // Leave after commit but before the confirming read: the buffered rescan must
  // replay with its original identity, without inventing a second assessment.
  try { await pendingRefresh; await page.goto(oldFindingHref); }
  finally { releaseRefresh(); }
  await replayed;
  await page.getByText(run.findings[0].evidence[0], { exact: true }).waitFor();
  const rescans = commands.filter(command => command.kind === 'assessment.rescan');
  assert.equal(rescans.length, 2, 'The interrupted acknowledgement is replayed');
  assert.equal(rescans[0].commandId, rescans[1].commandId);
  assert.equal(state.snapshot.assessment.currentRunId, newRunId);
  assert.equal(state.snapshot.assessment.runs.length, 2, 'Original evidence plus one new assessment');
  assert.equal(await page.getByRole('button', { name: /Pause assessment|Resume assessment/ }).count(), 0);
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('destination')).canvas.params.runId, run.id);
  out.checks.push('Interrupted rescan acknowledgement replays once without creating another run or changing old finding evidence');
  await page.goto(origin + destinationHref(destination(newRunId)));
  await page.getByRole('button', { name: 'Pause assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Resume assessment', exact: true }).waitFor();
  assert.equal(state.snapshot.assessment.status, 'paused');
  await page.getByRole('button', { name: 'Resume assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Pause assessment', exact: true }).waitFor();
  assert.equal(state.snapshot.assessment.status, 'running');
  out.checks.push('Current-run pause/resume use durable assessment commands');
  const failed = state.agent.runs.at(-1);
  failed.status = 'failed'; failed.error = { code: 'worker_failed', message: 'Fixture worker interruption', retryable: true };
  await page.reload();
  await page.getByText('Fixture worker interruption', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Pause assessment', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Retry assessment', exact: true }).click();
  await page.getByText('Assessment queued. It will continue when the worker is available.', { exact: true }).waitFor();
  assert(commands.some(command => command.kind === 'retry' && command.runId === failed.id));
  out.checks.push('Failed current assessment exposes its error and retry; retry acknowledges queued work');
  await page.goto(origin + destinationHref(destination('missing-owned-run')));
  await page.getByText(/assessment.*unavailable/i).first().waitFor();
  assert(commands.some(command => command.kind === 'assessment.rescan'));
  assert(commands.every(command => command.kind !== 'canvas.save' && command.kind !== 'submit'));
  assert.deepEqual(out.errors, []);
  out.checks.push('Missing run has an unavailable state; opening evidence does not save drafts or submit model work');
} finally {
  writeFileSync(outputPath(`${label}-assessment-canvas.json`), JSON.stringify(out, null, 2));
  await browser.close(); fixtures?.cleanup(); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
