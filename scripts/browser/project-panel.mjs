import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
try {
  for (const motion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const target = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
    const href = origin + destinationHref({ version: 1, owner: 'am', surface: 'build', target });
    await page.goto(href);
    const link = page.getByRole('button', { name: 'Trailblazer CRM, show in projects panel', exact: true });
    await link.waitFor();
    const panel = page.locator('#workspace-panel');
    assert.equal(await panel.getAttribute('data-open'), 'false');
    await link.click();
    await page.waitForFunction(() => document.querySelector('#workspace-panel')?.dataset.open === 'true');
    const filter = panel.getByRole('group', { name: 'Filter projects panel', exact: true });
    assert.equal(await filter.getByRole('button', { name: 'Projects', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => document.activeElement?.closest('#workspace-panel') && document.activeElement.textContent.includes('Trailblazer CRM'));
    const selected = panel.getByRole('button').filter({ hasText: 'lead-routing' }).first();
    assert.equal(await selected.getAttribute('aria-current'), 'true');
    assert.equal(page.url(), href);
    await filter.getByRole('button', { name: 'Apps', exact: true }).click();
    await page.locator('#workspace-panel-toggle').click();
    await link.focus(); await link.press('Enter');
    await page.waitForFunction(() => document.activeElement?.closest('#workspace-panel') && document.activeElement.textContent.includes('Trailblazer CRM'));
    assert.equal(await filter.getByRole('button', { name: 'Projects', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('destination')).target, target);
    await page.locator('header[data-project-scoped]').getByRole('button', { name: /Switch project, current project: Trailblazer CRM/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('tab', { name: 'Projects', exact: true }).getAttribute('aria-selected'), 'true');
    out.checks.push(`${motion}: overview reveals/focuses parent and Projects filter without changing worktree; keyboard works and top bar still opens navigator`);
    await context.close();
  }
  for (const profileId of ['jw', 'kf', 'sp', 'am']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const fixture = await installAssessment(context, { profileId }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + destinationHref({ version: 1, owner: profileId, surface: null, target: { projectId: null, worktreeId: null, orgId: 'uat' } }));
    const panel = page.locator('#workspace-panel');
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
    if (await panel.getAttribute('data-open') !== 'true') await page.locator('#workspace-panel-toggle').click();
    const projects = panel.getByRole('region', { name: 'Projects', exact: true });
    const start = projects.getByRole('button', { name: 'Start project', exact: true });
    await start.waitFor();
    assert.equal(await panel.getByRole('button', { name: /Start a conversation/ }).count(), 0);
    if (profileId === 'sp') await panel.getByText('Your chats will appear here.', { exact: true }).waitFor();
    await page.setViewportSize({ width: 900, height: 500 });
    if (profileId === 'am') {
      for (const name of ['Apps', 'Projects', 'All']) {
        await projects.getByRole('button', { name, exact: true }).click();
        const button = await start.boundingBox(), section = await projects.boundingBox();
        assert(button.y + button.height <= section.y + section.height, 'Start project stays inside the section while its list scrolls');
      }
    }
    await start.click(); await page.waitForURL(url => url.pathname === '/alm');
    await page.getByRole('heading', { name: 'Start a project', exact: true }).waitFor();
    assert.equal(await page.getByRole('radio').count(), 8, 'Every profile can choose a project type');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('radio', { name: /^MuleSoft/ }).check();
    assert(await page.getByRole('radio', { name: /^MuleSoft/ }).isChecked());
    out.checks.push(`${profileId}: persistent project footer works; Sessions has no creation action; all eight project types work at mobile width`);
    await context.close();
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-project-panel.json`), JSON.stringify(out, null, 2));
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
