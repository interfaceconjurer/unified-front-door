import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { projectsForProfile } = modules.load('lib/workspace/demo-workspace');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const surfaces = { build: 'Build & Setup', alm: 'ALM', govern: 'Govern & Observe', code: 'Code' };
try {
  for (const [profileId, expected] of [['sp', ['build', 'alm']], ['kf', ['build', 'alm']], ['jw', ['build', 'alm', 'govern']], ['am', ['build', 'alm', 'govern', 'code']]]) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: 'dark', viewport: { width: 1440, height: 1050 } });
    const fixture = await installAssessment(context, { profileId }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const destination = { version: 1, owner: profileId, surface: null, target: { projectId: null, worktreeId: null, orgId: 'uat' } };
    await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify(destination)));
    const today = page.getByRole('group', { name: 'Today', exact: true }); await today.waitFor();
    for (const [id, name] of Object.entries(surfaces)) assert.equal(await today.getByRole('link', { name, exact: true }).count(), expected.includes(id) ? 1 : 0, `${profileId}: Today ${name}`);
    if (profileId === 'kf') {
      await today.getByRole('button', { name: 'Review Lead routing → UAT', exact: true }).waitFor();
      assert.equal(await today.getByRole('button', { name: 'Review Integration user access', exact: true }).count(), 0);
    }
    if (profileId === 'jw') await today.getByRole('button', { name: 'Review Integration user access', exact: true }).waitFor();
    await page.screenshot({ path: outputPath(`${label}-expansion-${profileId}.png`) });
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
    assert.equal(await dialog.getByRole('option').count(), expected.length + 1, 'Home plus allowed surfaces');
    for (const [id, name] of Object.entries(surfaces)) assert.equal(await dialog.getByRole('option').filter({ hasText: name }).count(), expected.includes(id) ? 1 : 0);
    await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
    const samples = projectsForProfile(profileId);
    assert.equal(samples.length, { sp: 0, kf: 2, jw: 4, am: 6 }[profileId]);
    assert.equal(await dialog.getByRole('option').count(), samples.reduce((count, project) => count + 1 + project.worktrees.filter(tree => !tree.isPrimary).length, 0));
    for (const project of samples) await dialog.getByRole('option').filter({ hasText: project.name }).first().waitFor();
    if (profileId === 'kf') assert(!/feature\/|hotfix\/|main/.test(await dialog.getByRole('listbox').innerText()), 'Builder projects have no branch entries');
    await dialog.getByRole('tab', { name: 'Resources', exact: true }).click();
    const search = dialog.getByRole('combobox', { name: 'Search resources…', exact: true });
    await search.fill('OpportunityTriggerHandler');
    await page.waitForFunction(count => document.querySelectorAll('dialog [role=option]').length === count, profileId === 'am' ? 1 : 0);
    await page.keyboard.press('Escape');
    await today.getByRole('link', { name: 'Build & Setup', exact: true }).click();
    await page.getByRole('tab', { name: 'Build & Setup', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Switch surface', exact: true }).click();
    const menu = page.getByRole('menu', { name: 'Switch surface', exact: true });
    assert.equal(await menu.getByRole('menuitemradio').count(), expected.length);
    await page.keyboard.press('Escape');
    if (profileId === 'kf') {
      await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
      await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
      await dialog.getByRole('option').filter({ hasText: 'Trailblazer CRM' }).click();
      await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.projectId === 'trailblazer-crm');
      assert.equal(JSON.parse(new URL(page.url()).searchParams.get('destination')).target.worktreeId, null);
      await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
      await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
      await dialog.getByRole('option').filter({ hasText: 'Build & Setup' }).click();
      await page.getByRole('tab', { name: 'Build & Setup', exact: true }).click();
      await page.getByRole('tabpanel').getByRole('button', { name: 'Resume Lead routing assistant', exact: true }).click();
      const canvas = page.getByRole('tabpanel');
      await canvas.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
      const scope = canvas.getByRole('region', { name: 'Work context', exact: true });
      assert.deepEqual(await scope.locator('dt').allTextContents(), ['Project']);
      await canvas.getByRole('textbox', { name: 'Your notes', exact: true }).fill('Keep the project-only review');
      await page.waitForFunction(() => [...document.querySelectorAll('[role=tabpanel]')].some(el => el.textContent.includes('Saved to database')));
      await page.reload();
      await canvas.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
      assert.equal(await canvas.getByRole('textbox', { name: 'Your notes', exact: true }).inputValue(), 'Keep the project-only review');
      await page.locator('#workspace-panel-toggle').click();
      const sessions = page.locator('#workspace-panel').getByRole('region', { name: 'Sessions', exact: true });
      assert.equal(await sessions.getByRole('button').count(), 2);
      assert(!/main|feature\//.test(await sessions.innerText()), 'Project-level chats show project names without branch labels');
    }
    if (profileId !== 'am') {
      await page.goto(origin + '/code');
      await page.getByText('This surface is unavailable for your demo profile.', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Back to your code.', exact: true }).count(), 0);
    }
    assert(fixture.commands.every(command => command.kind !== 'submit'), 'Browsing scenarios never invokes a model');
    out.checks.push(`${profileId}: Today, sample work, navigator, resources, surface switcher and direct routes match expansion access`);
    await context.close();
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-expansion-profiles.json`), JSON.stringify(out, null, 2));
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
