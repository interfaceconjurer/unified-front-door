import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const panels = async (page, left, right) => {
  assert.equal(await page.locator('#workspace-panel-toggle').getAttribute('aria-pressed'), String(left));
  assert.equal(await page.locator('#surface-panel-toggle').getAttribute('aria-pressed'), String(right));
};
try {
  for (const profileId of ['sp', 'kf', 'jw', 'am']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId }), initial = structuredClone(fixture.state.snapshot);
    let epoch = 1, generation = 0, current = { ...initial.session, profileId: null };
    await context.route('**/api/session', route => {
      if (route.request().method() === 'POST') {
        const command = route.request().postDataJSON();
        if (command.action === 'reset-profile') {
          assert.equal(command.profileId, profileId); epoch++;
          fixture.state.snapshot = structuredClone(initial); fixture.state.agent.conversations = [];
        } else {
          current = { ...current, profileId: command.action === 'signout' ? null : command.profileId, generation: `generation-${++generation}`, workspaceEpoch: `epoch-${epoch}` };
        }
        fixture.state.snapshot.session = current;
      }
      return route.fulfill({ json: { session: current } });
    });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const signIn = async () => {
      await page.getByRole('button', { name: new RegExp(`^${fixture.profile.name} `) }).click();
      await page.getByRole('radio', { name: /UAT Sandbox/ }).check();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: `User menu for ${fixture.profile.name}`, exact: true }).waitFor();
    };
    const signOut = async () => {
      await page.getByRole('button', { name: `User menu for ${fixture.profile.name}`, exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
    };
    try {
      await page.goto(origin + '/login'); await signIn();
      await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
      await panels(page, false, false);
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(await page.locator('[data-chat-only=true]').count(), 1);
      await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('tab', { name: 'Resources', exact: true }).click();
      await dialog.getByLabel('Resource type', { exact: true }).selectOption('standard-object');
      await dialog.getByRole('combobox', { name: 'Search resources…', exact: true }).fill('Account');
      await dialog.getByRole('option').filter({ hasText: 'Standard object · Account' }).getByRole('button').click();
      await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
      const canvasUrl = page.url();
      await page.locator('#workspace-panel-toggle').click();
      await page.getByRole('button', { name: 'Hide surfaces', exact: true }).click();
      await panels(page, true, false);
      await page.reload();
      await page.getByRole('button', { name: `User menu for ${fixture.profile.name}`, exact: true }).waitFor();
      await panels(page, true, false);
      await signOut(); await signIn();
      await page.waitForURL(canvasUrl);
      await panels(page, true, false);
      await page.getByRole('button', { name: 'Show surfaces', exact: true }).click();
      await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
      await panels(page, true, true);
      await signOut();
      await page.getByRole('button', { name: `Clear data for ${fixture.profile.name}`, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Clear data', exact: true }).click();
      await page.getByRole('status').filter({ hasText: `Clear data completed for ${fixture.profile.name}.` }).waitFor();
      await signIn();
      await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
      await panels(page, false, false);
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(await page.locator('[data-chat-only=true]').count(), 1);
      out.checks.push(`${profileId}: fresh and cleared profiles start centered on Today; used profiles retain canvas and panel choices through reload and sign-out/in`);
    } finally { await context.close(); fixture.cleanup(); }
  }
  assert.deepEqual(out.errors, []);
} catch (error) { out.errors.push(error.stack); }
finally { await browser.close(); writeFileSync(outputPath(`${label}-profile-start.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1; }
