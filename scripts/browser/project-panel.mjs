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
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-project-panel.json`), JSON.stringify(out, null, 2));
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
