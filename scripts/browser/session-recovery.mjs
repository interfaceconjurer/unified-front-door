import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
async function prepare() {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const { state } = await install(context, { drafts: 0, messages: 0 });
  const control = { session: { ...session }, sessionDown: false, workspaceDown: false, loseAck: false, rejectChange: false, delayRead: 0, reads: 0, changes: [] };
  const unavailable = route => route.fulfill({ status: 503, json: { error: { code: 'unavailable', message: 'Temporarily unavailable' } } });
  await context.route('**/api/session', async route => {
    if (route.request().method() === 'GET') { control.reads++; if (control.delayRead) await new Promise(resolve => setTimeout(resolve, control.delayRead)); }
    if (control.sessionDown) return unavailable(route);
    if (route.request().method() === 'POST') {
      const command = route.request().postDataJSON(); control.changes.push(command);
      if (control.rejectChange) return unavailable(route);
      control.session = { ...control.session, profileId: command.action === 'signout' ? null : command.profileId, generation: `generation-${control.changes.length}` };
      state.snapshot.session = control.session;
      if (control.loseAck) { control.loseAck = false; return unavailable(route); }
    }
    return route.fulfill({ json: { session: control.session } });
  });
  await context.route('**/api/application*', route => control.workspaceDown ? unavailable(route) : route.fallback());
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  return { page, context, control };
}
try {
  // Successful sign-out and a committed sign-out whose response was lost must
  // both arrive at the chooser; a component-local success callback isn't enough.
  for (const loseAck of [false, true]) {
    const { page, context, control } = await prepare();
    try {
      await page.goto(origin + '/');
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).click();
      control.loseAck = loseAck;
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor({ timeout: 10000 });
      assert.equal(new URL(page.url()).pathname, '/login');
      assert.equal(control.changes.length, 1);
      assert(await page.getByRole('button', { name: 'Clear data for Karen Flores', exact: true }).isEnabled());
      out.checks.push(`Sign-out reaches the chooser${loseAck ? ' after a lost acknowledgement' : ''}, with clear-data actions available`);
    } finally { await context.close(); }
  }
  {
    const { page, context, control } = await prepare();
    try {
      control.delayRead = 6500;
      await page.goto(origin + '/');
      await page.getByRole('heading', { name: 'Opening your workspace…', exact: true }).waitFor();
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).waitFor({ timeout: 10000 });
      assert.equal(control.reads, 1, 'The five-second poll must share the slow startup request');
      out.checks.push('A session read slower than the poll interval shows progress and completes without duplicate requests');
    } finally { await context.close(); }
  }
  {
    const { page, context, control } = await prepare();
    try {
      await page.goto(origin + '/');
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).click();
      control.sessionDown = true;
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { name: 'Connection interrupted', exact: true }).waitFor();
      control.sessionDown = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).waitFor();
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      out.checks.push('A failed sign-out and unavailable reconciliation recovers the confirmed account before a subsequent sign-out');
    } finally { await context.close(); }
  }
  {
    const { page, context, control } = await prepare();
    try {
      control.sessionDown = true;
      await page.goto(origin + '/');
      await page.getByRole('heading', { name: 'Connection interrupted', exact: true }).waitFor({ timeout: 7000 });
      assert.equal(new URL(page.url()).pathname, '/', 'An unavailable session is not a confirmed sign-out');
      control.sessionDown = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).waitFor();
      assert.equal(control.changes.length, 0, 'Recovery only reads existing state');
      out.checks.push('Initial session 503 shows recovery and resumes the existing profile without signing out');
    } finally { await context.close(); }
  }
  {
    const { page, context, control } = await prepare();
    try {
      await page.goto(origin + '/');
      await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).click();
      control.workspaceDown = true;
      await page.getByRole('button', { name: /Switch to Karen Flores/ }).click();
      await page.getByRole('heading', { name: 'Connection interrupted', exact: true }).waitFor({ timeout: 7000 });
      assert.equal(await page.getByRole('button', { name: 'User menu for Alex Morgan', exact: true }).count(), 0);
      await page.screenshot({ path: outputPath(`${label}-session-recovery.png`) });
      control.workspaceDown = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByRole('button', { name: 'User menu for Karen Flores', exact: true }).waitFor();
      assert.equal(control.changes.length, 1, 'Workspace retry never resends the profile change');
      out.checks.push('Workspace 503 after profile switch has a visible retry and loads only the selected profile');
    } finally { await context.close(); }
  }
  assert.deepEqual(out.errors, []);
} catch (error) { out.errors.push(error.stack); }
finally { await browser.close(); writeFileSync(outputPath(`${label}-session-recovery.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1; }
