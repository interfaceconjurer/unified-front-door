import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { openCapability, openOverview, workbenchTab, workbenchViews } from './workbench-helpers.mjs';

// Replaces the retired surface switcher (pinned surface tab + chevron menu).
// The same guarantees now hold for workbench views across plugins: one physical
// click switches even during motion, overviews open as views, keyboard access,
// scope and canvas/chat drafts are retained, restricted profiles see only their
// plugins, and narrow layouts contain the workbench.
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
const selected = (page, name) => page.waitForFunction(name => document.querySelector('[role="tablist"][aria-label="Open views"] [role="tab"][aria-selected="true"]')?.textContent.trim() === name, name);
// One physical click, without Playwright waiting for transition overlays to
// disappear or retrying a missed target. Navigation must work during motion.
async function clickOnce(page, locator) {
  const box = await locator.boundingBox();
  assert(box, 'The navigation control is visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const target = { projectId: null, worktreeId: null, orgId: 'prod' };
    await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: null, target })));
    const opportunities = page.getByRole('checkbox', { name: /^Include / });
    await opportunities.first().waitFor();
    await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Today"]').getAnimations({ subtree: true })
      .every(animation => animation.effect.getComputedTiming().iterations === Infinity || animation.playState === 'finished'));
    for (let index = 0; index < await opportunities.count(); index++) await opportunities.nth(index).setChecked(index === 0);
    await page.getByRole('button', { name: 'Shape a project', exact: true }).click();
    const name = page.getByLabel('Project name', { exact: true }); await name.waitFor();
    await name.fill('Keep Sam’s project draft');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep Sam’s unsent note');
    await settle(page);
    await openOverview(page, 'Build & Setup'); await selected(page, 'Build & Setup overview'); await settle(page);
    // Stretch the existing whole-view motion so the checks exercise live frames.
    await page.addStyleTag({ content: '::view-transition-group(.surface-swap), ::view-transition-old(.surface-swap), ::view-transition-new(.surface-swap) { animation-duration: 3s; }' });
    await clickOnce(page, workbenchTab(page, 'Start a project'));
    await page.waitForURL(url => url.pathname === '/alm'); await name.waitFor();
    if (motion === 'no-preference') await page.waitForFunction(() => document.getAnimations().some(animation => animation.animationName === 'surface-land' && animation.playState === 'running'));
    await clickOnce(page, workbenchTab(page, 'Build & Setup overview'));
    await page.waitForURL(url => url.pathname === '/build');
    await selected(page, 'Build & Setup overview');
    assert.equal(destination(page).canvas, undefined, 'An overview view addresses its plugin without a canvas');
    assert.deepEqual(destination(page).target, target);
    await clickOnce(page, workbenchTab(page, 'Start a project'));
    await page.waitForURL(url => url.pathname === '/alm'); await name.waitFor();
    assert.equal(await name.inputValue(), 'Keep Sam’s project draft');
    assert.equal(await composer.inputValue(), 'Keep Sam’s unsent note');
    assert.equal(fixture.state.snapshot.assessment.draft.findingIds.length, 1);
    assert.equal(fixture.commands.filter(command => command.kind === 'draft.begin').length, 1);
    assert(!fixture.commands.some(command => command.kind === 'project.create'));
    out.checks.push(`${motion}: Sam shapes one opportunity; one physical click switches plugins even during active motion, preserving project/chat drafts and the connected org`);
    await context.close();
  }
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
    // Every plugin's overview opens as its own view, keeping scope and drafts.
    for (const plugin of ['Code', 'Govern & Observe', 'ALM', 'Build & Setup']) {
      await openOverview(page, plugin);
      await selected(page, `${plugin} overview`); await settle(page);
      assert.deepEqual(destination(page).target, target);
      assert.equal(await composer.inputValue(), 'Keep my chat draft');
    }
    const views = await workbenchViews(page).getByRole('tab').allInnerTexts();
    assert(['Code overview', 'Govern & Observe overview', 'ALM overview', 'Build & Setup overview', 'Build an automation'].every(view => views.includes(view)), views.join());
    // Keyboard: one tab stop, Arrow/Home/End across plugins, Enter-free selection.
    await workbenchTab(page, 'Build & Setup overview').focus();
    await page.keyboard.press('Home'); await settle(page);
    const first = views[0];
    await selected(page, first);
    assert(await workbenchTab(page, first).evaluate(node => node === document.activeElement));
    assert.equal(await workbenchViews(page).locator('[role="tab"][tabindex="0"]').count(), 1, 'Views use a single roving tab stop');
    await page.keyboard.press('End'); await selected(page, views.at(-1)); await settle(page);
    await workbenchTab(page, 'Build an automation').click(); await selected(page, 'Build an automation'); await settle(page);
    assert.equal(await name.inputValue(), 'Keep my automation draft');
    // Closing an overview view is like closing any view; it can be reopened.
    await workbenchViews(page).getByRole('button', { name: 'Close Code overview', exact: true }).click();
    await workbenchTab(page, 'Code overview').waitFor({ state: 'detached' });
    await selected(page, 'Build an automation');
    await openOverview(page, 'Code'); await selected(page, 'Code overview');
    assert.deepEqual(destination(page).target, target);
    await workbenchTab(page, 'Build an automation').click(); await selected(page, 'Build an automation'); await settle(page);
    assert.equal(await name.inputValue(), 'Keep my automation draft');
    assert.equal(await composer.inputValue(), 'Keep my chat draft');
    if (!project && motion === 'no-preference') await page.screenshot({ path: outputPath(`${label}-workbench-switching-dark.png`) });
    out.checks.push(`${motion}/${project ? 'project' : 'global'}: plugin overviews open as views; Arrow/Home/End and a single tab stop span plugins; overview views close and reopen; scope and canvas/chat drafts survive`);
    await context.close();
  }
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: 'light', viewport: { width: 390, height: 844 } });
  const fixture = await installAssessment(context, { profileId: 'kf' }); cleanups.push(fixture.cleanup);
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/build');
  await workbenchTab(page, 'Build & Setup overview').waitFor();
  await openCapability(page, 'ALM overview');
  await workbenchTab(page, 'ALM overview').waitFor();
  await page.waitForURL(url => url.pathname === '/alm');
  const dialog = await (async () => { await page.getByRole('button', { name: 'Search workspace', exact: true }).click(); return page.getByRole('dialog'); })();
  await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
  const plugins = [...new Set(await dialog.getByRole('listbox').getByRole('option').evaluateAll(nodes => nodes.map(node => node.querySelector('[class*="surfaceLabel"]')?.textContent)))];
  assert.deepEqual(plugins, ['Build & Setup', 'ALM'], 'Restricted profile sees only accessible plugins');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  const strip = await workbenchViews(page).boundingBox();
  assert(strip.x >= 0 && strip.x + strip.width <= 390, JSON.stringify(strip));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: outputPath(`${label}-workbench-switching-mobile-light.png`) });
  out.checks.push('Restricted profile sees only accessible plugins; the workbench fits a narrow light-theme viewport');
  await context.close();

  // All plugin overviews expose their starter cards directly. ALM has its own
  // overview check; the other three share ReturningSurface and SurfaceLauncher.
  const starters = [
    { surface: 'build', plugin: 'Build & Setup', heading: 'Start configuring', action: 'Model your data', capability: 'data-model' },
    { surface: 'code', plugin: 'Code', heading: 'Start building', action: 'Write Apex', capability: 'apex' },
    { surface: 'govern', plugin: 'Govern & Observe', heading: 'Start exploring', action: 'Review security', capability: 'security' },
  ];
  for (const [layout, viewport, colorScheme] of [
    ['desktop', { width: 1440, height: 1000 }, 'dark'],
    ['narrow', { width: 390, height: 844 }, 'light'],
  ]) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme, viewport });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    for (const { surface, plugin, heading, action, capability } of starters) {
      const target = { projectId: null, worktreeId: null, orgId: 'uat' };
      await page.goto(origin + `/${surface}?destination=` + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface, target })));
      const overview = page.getByRole('tabpanel');
      const launcher = overview.getByRole('region', { name: heading, exact: true });
      const card = launcher.getByRole('button', { name: new RegExp(`^${action}`) });
      await card.waitFor();
      await card.scrollIntoViewIfNeeded();
      assert(await card.isVisible(), `${plugin} starter card is visible on entry`);
      assert.equal(await launcher.evaluate(node => !!node.closest('details')), false, `${plugin} starter cards are not inside a disclosure`);
      assert.equal(await overview.getByText('Start something new', { exact: true }).count(), 0, `${plugin} has no Start something new control`);
      if (surface === 'build') await page.screenshot({ path: outputPath(`${label}-visible-starters-${layout}.png`) });
      await card.click();
      await page.waitForURL(url => JSON.parse(url.searchParams.get('destination') ?? '{}').canvas?.params?.capability === capability);
      assert.deepEqual(destination(page).target, target);
      assert.equal(destination(page).canvas.params.surface, surface);
      await workbenchTab(page, `${plugin} overview`).click();
      await launcher.waitFor();
    }
    out.checks.push(`${layout}: Build & Setup, Code and Govern & Observe show starter cards without disclosure; actions open scoped canvases and overviews restore`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup());
  writeFileSync(outputPath(`${label}-workbench-switching.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (out.errors.length) process.exitCode = 1;
}
