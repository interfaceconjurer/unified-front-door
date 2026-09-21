import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const target = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
const href = (scope, surface = null) => `${origin}${surface ? `/${surface}` : '/'}?destination=${encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface, target: scope }))}`;
const current = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1800, height: 1100 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(href(target, 'code'));
    const launch = page.getByRole('button', { name: 'Preview project', exact: true });
    await launch.click();
    const preview = page.getByRole('article', { name: 'Project preview', exact: true });
    await preview.getByRole('heading', { name: 'Trailblazer CRM', exact: true }).waitFor();
    assert.deepEqual(current(page).target, target);
    assert.equal(current(page).surface, 'build');
    assert.equal(current(page).canvas.kind, 'preview');
    assert.equal(await launch.getAttribute('aria-pressed'), 'true');
    assert(await preview.getByText('feature/lead-routing', { exact: true }).isVisible());
    assert(await preview.getByText('UAT Sandbox', { exact: true }).isVisible());
    assert.equal(await preview.getByRole('button', { name: /^Open worktree/ }).count(), 0);
    await preview.getByRole('button', { name: 'Route sample lead', exact: true }).click();
    assert(await preview.getByRole('status').filter({ hasText: 'Enterprise sales' }).isVisible());
    await preview.getByRole('button', { name: 'Reset demo', exact: true }).click();
    assert(await preview.getByRole('button', { name: 'Route sample lead', exact: true }).isEnabled());
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    await page.screenshot({ path: outputPath(`${label}-preview-desktop-${motion}.png`) });
    await preview.getByRole('button', { name: 'Mobile', exact: true }).click();
    const frame = preview.locator('[data-device="mobile"]');
    assert((await frame.boundingBox()).width <= 391);
    assert(await frame.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.screenshot({ path: outputPath(`${label}-preview-mobile-${motion}.png`) });
    await preview.getByRole('button', { name: 'Accounts', exact: true }).click();
    assert(await preview.getByRole('heading', { name: 'Northstar Labs', exact: true }).isVisible());
    await preview.getByRole('button', { name: 'Desktop', exact: true }).click();
    const popupPromise = page.waitForEvent('popup');
    await preview.getByRole('link', { name: 'Open preview in new tab', exact: true }).click();
    const popup = await popupPromise;
    await popup.getByRole('article', { name: 'Project preview', exact: true }).waitFor();
    assert.deepEqual(current(popup).target, target);
    await popup.close();
    await page.reload(); await preview.waitFor();
    assert.deepEqual(current(page).target, target);
    out.checks.push(`${motion}: header launches scoped preview, sample interaction/reset, responsive frame, new tab and reload work`);

    const global = { projectId: null, worktreeId: null, orgId: 'prod' };
    await page.goto(href(global));
    await page.getByRole('group', { name: 'Today', exact: true }).getByRole('button', { name: 'Review Lead routing → UAT', exact: true }).click();
    const work = page.getByRole('region', { name: 'Work context', exact: true });
    await work.getByRole('button', { name: 'Preview', exact: true }).click();
    await preview.waitFor();
    assert.deepEqual(current(page).target, global);
    assert.deepEqual(current(page).canvasTarget, target);
    assert(await preview.getByText('UAT Sandbox', { exact: true }).isVisible());
    assert.equal(await launch.count(), 0);
    await preview.getByRole('button', { name: 'Open worktree lead-routing in Trailblazer CRM', exact: true }).click();
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.projectId === 'trailblazer-crm');
    assert.deepEqual(current(page).target, target);
    assert.equal(current(page).canvas.kind, 'preview');
    await page.goBack(); await preview.getByRole('button', { name: /^Open worktree/ }).waitFor();
    assert.deepEqual(current(page).target, global);
    out.checks.push(`${motion}: global review opens captured preview without entering its project; explicit entry and browser Back preserve both contexts`);

    await page.goto(href({ projectId: 'acme-storefront', worktreeId: 'main', orgId: 'sit' }, 'alm'));
    assert.equal(await page.getByRole('tab', { name: 'Preview · lead-routing', exact: true }).count(), 0);
    await launch.click(); await preview.getByRole('heading', { name: 'Acme Storefront', exact: true }).waitFor();
    await preview.getByRole('button', { name: 'Add to bag', exact: true }).first().click();
    await preview.getByRole('button', { name: 'Bag (1)', exact: true }).click();
    await preview.getByRole('region', { name: 'Sample shopping bag', exact: true }).waitFor();
    await page.setViewportSize({ width: 1000, height: 1000 }); await page.emulateMedia({ colorScheme: 'light' });
    assert(await preview.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.screenshot({ path: outputPath(`${label}-preview-storefront-${motion}.png`) });
    assert(fixture.commands.every(command => command.kind === 'visit'), 'Preview must not invoke model work or approvals');
    out.checks.push(`${motion}: project switch excludes the other worktree preview; storefront demo bag and narrow light canvas work`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup());
  writeFileSync(outputPath(`${label}-project-preview.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
