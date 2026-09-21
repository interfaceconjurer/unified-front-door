import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const labels = { build: 'Build & Setup', code: 'Code', govern: 'Govern & Observe', alm: 'ALM' };
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const menu = page => page.getByRole('menu', { name: 'Switch surface', exact: true, includeHidden: true });
const surfaceTab = (page, surface) => page.getByRole('tab', { name: labels[surface], exact: true });
const trigger = page => page.getByRole('button', { name: 'Switch surface', exact: true });
const item = (page, surface) => menu(page).getByRole('menuitemradio', { name: labels[surface], exact: true });
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
async function open(page, surface) {
  await trigger(page).click();
  await menu(page).waitFor();
  await page.waitForFunction(text => document.activeElement?.getAttribute('role') === 'menuitemradio' && document.activeElement.textContent === text, labels[surface]);
  assert.equal(await trigger(page).getAttribute('aria-expanded'), 'true');
  assert.equal(await item(page, surface).getAttribute('aria-checked'), 'true');
}
try {
  for (const motion of ['no-preference', 'reduce']) for (const project of [false, true]) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const target = { projectId: project ? 'trailblazer-crm' : null, worktreeId: project ? 'lead-routing' : null, orgId: 'uat' };
    const canvas = { kind: 'capability', title: 'Build an automation', params: { surface: 'build', capability: 'automation', orgId: 'uat', ...(project ? { scope: 'project', projectId: target.projectId, worktreeId: target.worktreeId } : { scope: 'unbound' }) } };
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface: 'build', target, canvas })));
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.waitFor();
    await name.fill('Keep my automation draft');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep my chat draft');
    await settle(page);
    const start = page.url();
    await open(page, 'build');
    assert.equal(page.url(), start, 'Opening the menu must not select overview or change workspace');
    assert.equal(await page.getByRole('tab', { name: 'Build an automation', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(await menu(page).getByRole('menuitemradio').allTextContents(), Object.values(labels));
    const bounds = await menu(page).boundingBox(), anchor = await trigger(page).locator('..').boundingBox();
    assert(Math.abs(bounds.x - anchor.x) < 1 && Math.abs(bounds.y - anchor.y - anchor.height - 6) < 1, JSON.stringify({ bounds, anchor }));
    // The menu is painted above the canvas, outside the tab strip's scroll clip.
    assert(await menu(page).evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 20)); }));
    if (!project && motion === 'no-preference') await page.screenshot({ path: outputPath(`${label}-surface-switcher-dark.png`) });
    await page.keyboard.press('End');
    assert(await item(page, 'alm').evaluate(node => node === document.activeElement));
    await page.keyboard.press('ArrowDown');
    assert(await item(page, 'build').evaluate(node => node === document.activeElement));
    await page.keyboard.press('ArrowUp');
    assert(await item(page, 'alm').evaluate(node => node === document.activeElement));
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await menu(page).waitFor({ state: 'hidden' });
    assert(await trigger(page).evaluate(node => node === document.activeElement));
    assert.equal(page.url(), start);
    await trigger(page).press('ArrowDown');
    await menu(page).waitFor();
    await composer.click();
    await menu(page).waitFor({ state: 'hidden' });
    assert(await composer.evaluate(node => node === document.activeElement));
    await open(page, 'build');
    await page.keyboard.press('Tab');
    await menu(page).waitFor({ state: 'hidden' });
    assert(!(await menu(page).evaluate(node => node.contains(document.activeElement))));
    assert.equal(page.url(), start);
    out.checks.push(`${motion}/${project ? 'project' : 'global'}: anchored unclipped menu; checked surface; keyboard navigation, Escape/Tab/outside dismissal leave canvas unchanged`);

    let current = 'build';
    for (const next of ['code', 'govern', 'alm', 'build']) {
      await open(page, current);
      if (next === 'code') { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); }
      else await item(page, next).click();
      await page.waitForURL(url => url.pathname === '/' + next);
      await menu(page).waitFor({ state: 'hidden' });
      await settle(page);
      assert.deepEqual(destination(page).target, target);
      assert.equal(await composer.inputValue(), 'Keep my chat draft');
      current = next;
    }
    await name.waitFor();
    assert.equal(await name.inputValue(), 'Keep my automation draft');
    await surfaceTab(page, 'build').click();
    await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('destination')).canvas);
    assert.equal(await surfaceTab(page, 'build').getAttribute('aria-selected'), 'true');
    assert.equal(await menu(page).isVisible(), false, 'Clicking the surface label directly opens overview, not the menu');
    assert.deepEqual(destination(page).target, target);
    // The separate chevron remains keyboard reachable from the overview tab.
    await surfaceTab(page, 'build').focus();
    await page.keyboard.press('Tab');
    assert(await trigger(page).evaluate(node => node === document.activeElement));
    await page.keyboard.press('Enter');
    await menu(page).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Build an automation', exact: true }).click();
    await name.waitFor();
    assert.equal(await name.inputValue(), 'Keep my automation draft');
    assert.equal(await composer.inputValue(), 'Keep my chat draft');
    // The dropdown's existing current-surface option still opens overview too.
    await open(page, 'build');
    await item(page, 'build').click();
    await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('destination')).canvas);
    assert.equal(await surfaceTab(page, 'build').getAttribute('aria-selected'), 'true');
    assert.deepEqual(destination(page).target, target);
    await page.getByRole('tab', { name: 'Build an automation', exact: true }).click();
    await name.waitFor();
    assert.equal(await name.inputValue(), 'Keep my automation draft');
    out.checks.push(`${motion}/${project ? 'project' : 'global'}: label opens overview directly; separate chevron supports keyboard/menu switching; scope and canvas/chat drafts survive both actions`);
    await context.close();
  }
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: 'light', viewport: { width: 390, height: 844 } });
  const fixture = await installAssessment(context, { profileId: 'kf' }); cleanups.push(fixture.cleanup);
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/build');
  await trigger(page).waitFor();
  await open(page, 'build');
  assert.deepEqual(await menu(page).getByRole('menuitemradio').allTextContents(), ['Build & Setup', 'ALM']);
  const bounds = await menu(page).boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844, JSON.stringify(bounds));
  await page.screenshot({ path: outputPath(`${label}-surface-switcher-mobile-light.png`) });
  await page.setViewportSize({ width: 390, height: 640 });
  const shortBounds = await menu(page).boundingBox();
  assert(shortBounds.y >= 0 && shortBounds.y + shortBounds.height <= 640, JSON.stringify(shortBounds));
  await item(page, 'alm').click();
  await page.waitForURL(url => url.pathname === '/alm');
  out.checks.push('Restricted profile sees only accessible surfaces; menu fits a narrow light-theme viewport');
  await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup());
  writeFileSync(outputPath(`${label}-surface-switcher.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (out.errors.length) process.exitCode = 1;
}
