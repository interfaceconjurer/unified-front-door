import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install } from './fixtures.mjs';
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, clock: 'simulated browser time', checks: [], errors: [] };
try {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce' });
  await install(context, { drafts: 0, messages: 0 });
  const page = await context.newPage(); let reads = 0;
  page.on('pageerror', error => out.errors.push(error.message));
  page.on('request', request => { if (request.method() === 'GET' && /\/api\/(session|application|agent)/.test(request.url())) reads++; });
  await page.clock.install(); await page.goto(origin + '/');
  await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).waitFor(); await sleep(300);
  await page.clock.fastForward(65000); await sleep(300);
  const before = reads; await page.clock.fastForward(600000); await sleep(300);
  assert.equal(reads, before); out.idleReadsInTenMinutes = reads - before;
  out.checks.push('An untouched visible tab makes no session, workspace or agent GETs after one minute of inactivity.');
  await page.keyboard.press('Shift');
  const deadline = Date.now() + 3000; while (reads === before && Date.now() < deadline) await sleep(20);
  assert(reads > before); out.checks.push('Keyboard input resumes refresh immediately without a reload.');
  await sleep(300); await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = reads; await page.clock.fastForward(600000); await sleep(300); assert.equal(reads, hidden);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(300); assert(reads > hidden); out.checks.push('Hidden tabs remain quiet and refresh when made visible.');
  assert.deepEqual(out.errors, []); out.passed = true;
} finally { await browser.close(); writeFileSync(outputPath(`${label}-idle-suspension.json`), JSON.stringify(out, null, 2)); }
console.log(JSON.stringify(out, null, 2));
