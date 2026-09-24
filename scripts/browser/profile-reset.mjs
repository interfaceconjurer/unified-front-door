import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
try {
  const context = await browser.newContext({ httpCredentials, viewport: { width: 1440, height: 1000 } });
  const { state } = await install(context, { drafts: 0, messages: 0 });
  let current = { ...session, profileId: null, workspaceEpoch: undefined };
  const saved = { sp: ['saved assessment'], jw: ['saved chat'], am: ['saved project'], kf: ['saved draft'] };
  const receipts = new Map(), commands = [];
  let hold, release, loseAck = false;
  await context.route('**/api/session', async route => {
    const command = route.request().postDataJSON();
    if (route.request().method() === 'POST') {
      commands.push(command);
      if (command.action === 'reset-profile') {
        if (!receipts.has(command.commandId)) { saved[command.profileId] = []; receipts.set(command.commandId, structuredClone(command)); }
        else assert.deepEqual(command, receipts.get(command.commandId));
        if (hold) await hold;
        if (loseAck) { loseAck = false; return route.abort('failed'); }
      } else if (command.action === 'select') {
        current = { ...current, profileId: command.profileId, generation: 'selected-generation', workspaceEpoch: 'fresh-epoch' };
        state.snapshot.session = current;
      }
    }
    return route.fulfill({ json: { session: current } });
  });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/login');
  const sam = page.getByRole('button', { name: 'Clear data for Sam Patel', exact: true });
  await sam.waitFor();
  assert.equal(await page.getByRole('button', { name: /^Clear data for / }).count(), 4);
  await sam.click();
  const dialog = page.getByRole('dialog', { name: 'Clear data for Sam Patel?', exact: true });
  assert(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(node => node === document.activeElement));
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert(await sam.evaluate(node => node === document.activeElement));
  assert.equal(commands.length, 0);
  await sam.click(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(commands.length, 0);
  out.checks.push('Four separately labeled clear actions; Cancel and Escape send no request and return focus');

  await sam.click(); hold = new Promise(resolve => { release = resolve; });
  const clear = dialog.getByRole('button', { name: 'Clear data', exact: true });
  const confirmationText = await dialog.innerText();
  await clear.click();
  await dialog.locator('button[aria-busy="true"]').waitFor();
  assert(await clear.locator('span[aria-hidden="true"]').isVisible(), 'Clearing progress stays inside the button');
  assert.equal(await dialog.innerText(), confirmationText, 'Clearing adds no text to the modal and keeps the Clear data label');
  assert(await clear.isDisabled());
  assert(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
  await page.keyboard.press('Escape'); assert(await dialog.isVisible());
  release(); hold = undefined;
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('status').filter({ hasText: 'Clear data completed for Sam Patel.' }).waitFor();
  assert.equal(commands.length, 1); assert.equal(commands[0].action, 'reset-profile'); assert.equal(commands[0].profileId, 'sp');
  assert.equal(current.profileId, null); assert.equal(new URL(page.url()).pathname, '/login');
  assert.deepEqual(saved, { sp: [], jw: ['saved chat'], am: ['saved project'], kf: ['saved draft'] });
  out.checks.push('One confirmed scoped request clears only its target, stays signed out on login, and disables duplicate input with a spinner inside Clear data and no extra modal text while pending');

  const alex = page.getByRole('button', { name: 'Clear data for Alex Morgan', exact: true });
  await alex.click(); loseAck = true;
  await page.getByRole('dialog').getByRole('button', { name: 'Clear data', exact: true }).click();
  await page.getByRole('button', { name: 'Retry clear', exact: true }).waitFor();
  const first = commands.at(-1);
  assert.deepEqual(saved.am, []);
  saved.am = ['work created after reset'];
  await page.reload();
  await alex.waitFor(); await page.waitForTimeout(100);
  assert.equal(commands.length, 2, 'Reload must not automatically send a reset');
  await alex.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear data', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Clear data completed for Alex Morgan.' }).waitFor();
  assert.deepEqual(commands.at(-1), first);
  assert.deepEqual(saved.am, ['work created after reset']);
  out.checks.push('Lost acknowledgment survives reload; the next confirmed attempt replays the same request without deleting later work');

  await page.setViewportSize({ width: 375, height: 812 });
  await sam.click();
  assert(await dialog.isVisible());
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const bounds = await dialog.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 375);
  await page.screenshot({ path: outputPath(`${label}-profile-reset-mobile.png`) });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Alex Morgan Returning developer/ }).click();
  await page.getByRole('radio', { name: /UAT Sandbox/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/login');
  assert.equal(commands.at(-1).action, 'select'); assert.equal(current.profileId, 'am');
  out.checks.push('Confirmation fits a narrow viewport and profile sign-in still works independently');
  await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); writeFileSync(outputPath(`${label}-profile-reset.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
