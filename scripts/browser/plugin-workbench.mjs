import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

// Plugin → capability → workbench model: palette tabs and plugins, one
// workbench across plugins, view identity/context, the single top-bar toggle,
// the empty prompt, saved drafts and legacy per-surface tab preferences.
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const TABS = ['All', 'Capabilities', 'Projects', 'Sessions', 'Orgs', 'Resources', 'Plugins'];
const home = (owner, orgId = 'uat') => '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner, surface: null, target: { projectId: null, worktreeId: null, orgId } }));
const idFor = c => `canvas:v2:${JSON.stringify([c.kind, Object.entries(c.params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)])}`;
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
async function openPalette(page, keyboard = false) {
  if (keyboard) await page.keyboard.press('Control+Shift+P');
  else await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tablist', { name: 'Palette section' }).waitFor();
  await dialog.locator('[data-modal-motion]').evaluate(async node => { await Promise.all(node.getAnimations().map(a => a.finished.catch(() => {}))); });
  return dialog;
}
const toggle = page => page.getByRole('button', { name: 'Workbench', exact: true });
const views = page => page.getByRole('tablist', { name: 'Open views' });
const view = (page, name) => views(page).getByRole('tab', { name, exact: true });
const header = page => page.locator('#workbench [data-view-identity]');
// Cross-plugin switches are route navigations; wait for the addressed view.
const selected = (page, name) => page.waitForFunction(name => document.querySelector('[role="tablist"][aria-label="Open views"] [role="tab"][aria-selected="true"]')?.textContent.trim() === name
  && document.querySelector('#workbench [data-view-identity]')?.getAttribute('data-capability') === name, name);
try {
  for (const motion of ['no-preference', 'reduce']) {
    // Alex: all four first-party plugins.
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + home('am'));
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep this note across the workbench');

    // One top-bar icon; pressed state and label; no legacy surface toggle.
    assert.equal(await page.getByRole('button', { name: /^(Show|Hide) surfaces$/ }).count(), 0, 'The surfaces toggle is replaced');
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'false');
    assert.equal(await toggle(page).getAttribute('aria-controls'), 'workbench');
    assert.equal(await page.getByRole('button', { name: 'Switch surface', exact: true }).count(), 0, 'No surface switcher');

    // Empty workbench prompts for a capability and opens the Capabilities tab.
    await toggle(page).click();
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'true');
    const prompt = page.locator('#workbench').getByRole('button', { name: 'Choose a capability', exact: true });
    await prompt.waitFor();
    assert.equal(await views(page).count(), 0, 'Empty workbench lists no views');
    await prompt.click();
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).waitFor();
    assert.equal(await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    await toggle(page).click();
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'false');
    out.checks.push(`${motion}: one pressed/unpressed Workbench toggle; empty workbench prompts to choose a capability via the Capabilities tab`);

    // Palette tabs, order and keyboard; Surfaces is gone.
    dialog = await openPalette(page, true);
    assert.deepEqual(await dialog.getByRole('tablist', { name: 'Palette section' }).getByRole('tab').allInnerTexts(), TABS);
    await dialog.getByRole('tab', { name: 'All', exact: true }).focus();
    for (const name of TABS.slice(1)) {
      await page.keyboard.press('ArrowRight');
      assert.equal(await dialog.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
      assert(await dialog.getByRole('tab', { name, exact: true }).evaluate(node => node === document.activeElement));
    }
    await page.keyboard.press('Home');
    assert.equal(await dialog.getByRole('tab', { name: 'All', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await dialog.getByRole('tab', { name: 'Plugins', exact: true }).getAttribute('aria-selected'), 'true');
    out.checks.push(`${motion}: palette tabs are All, Capabilities, Projects, Sessions, Orgs, Resources, Plugins with Arrow/Home/End support`);

    // Plugins: installed first-party packages with details and contributions.
    const rows = () => dialog.getByRole('listbox').getByRole('option');
    const pluginNames = await rows().locator('[data-result-label]').allInnerTexts();
    assert.deepEqual(pluginNames.sort(), ['ALM', 'Build & Setup', 'Code', 'Govern & Observe']);
    const details = dialog.getByRole('region', { name: 'Plugin details' });
    await rows().filter({ hasText: 'Govern & Observe' }).hover();
    await details.getByRole('heading', { name: 'Govern & Observe', exact: true }).waitFor();
    for (const text of ['Installed', 'Publisher', 'Version', '1.0.0']) assert(await details.getByText(text, { exact: true }).first().isVisible(), `Plugin details show ${text}`);
    await details.getByRole('button', { name: /^Review security/ }).scrollIntoViewIfNeeded();
    assert(await details.getByRole('button', { name: /^Review security/ }).isVisible(), 'Plugin details list contributed capabilities');

    // Uninstall hides its capabilities; reinstall restores them.
    await details.getByRole('button', { name: 'Uninstall Govern & Observe', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: 'Govern & Observe uninstalled' }).waitFor();
    await dialog.getByRole('button', { name: 'Available', exact: true }).click();
    await rows().filter({ hasText: 'Govern & Observe' }).waitFor();
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill('Review security');
    await dialog.getByText('No capabilities match “Review security”.', { exact: true }).waitFor();
    // Category tabs keep the query; clear it before browsing packages again.
    await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
    await dialog.getByRole('tab', { name: 'Plugins', exact: true }).click();
    await dialog.getByRole('button', { name: 'Available', exact: true }).click();
    await rows().filter({ hasText: 'Govern & Observe' }).hover();
    await details.getByRole('button', { name: 'Install Govern & Observe', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: 'Govern & Observe installed. 5 capabilities added.' }).waitFor();
    out.checks.push(`${motion}: Plugins lists first-party packages with publisher/version/contributions; uninstall hides and install restores their capabilities`);

    // Capability details link back to their plugin; stage filter narrows.
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    const search = dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true });
    await search.fill('');
    const stages = dialog.getByRole('group', { name: 'ALM stage' });
    for (const stage of ['All stages', 'Planning', 'Building', 'Testing', 'Releasing', 'Observing']) await stages.getByRole('button', { name: stage, exact: true }).waitFor();
    await stages.getByRole('button', { name: 'Testing', exact: true }).click();
    assert.equal(await stages.getByRole('button', { name: 'Testing', exact: true }).getAttribute('aria-pressed'), 'true');
    const testing = await rows().locator('[data-result-label]').allInnerTexts();
    assert(testing.includes('Create & run tests') && testing.includes('Validate a change') && !testing.includes('Write Apex'), `Testing filter: ${testing}`);
    await stages.getByRole('button', { name: 'All stages', exact: true }).click();
    await search.fill('Write Apex');
    const capabilityDetails = dialog.getByRole('region', { name: 'Capability details' });
    await capabilityDetails.getByRole('heading', { name: 'Write Apex', exact: true }).waitFor();
    await capabilityDetails.getByRole('button', { name: 'View Code in Plugins', exact: true }).click();
    assert.equal(await dialog.getByRole('tab', { name: 'Plugins', exact: true }).getAttribute('aria-selected'), 'true');
    await details.getByRole('heading', { name: 'Code', exact: true }).waitFor();
    out.checks.push(`${motion}: Capabilities filter by ALM stage and link back to their source plugin`);

    // Open a capability from the palette: it becomes a workbench view.
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await search.fill('Build an automation');
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'detached' });
    await settle(page);
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'true');
    await view(page, 'Build an automation').waitFor();
    assert.equal(await header(page).getAttribute('data-plugin'), 'Build & Setup');
    assert.equal(await header(page).getAttribute('data-capability'), 'Build an automation');
    for (const text of ['Build & Setup', 'Build an automation']) assert(await header(page).getByText(text, { exact: true }).first().isVisible(), `View header shows ${text}`);
    assert.deepEqual(await header(page).getByRole('list', { name: 'Working context' }).getByRole('listitem').allInnerTexts(), ['Org\nUAT Sandbox', 'Project\nUnbound']);
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Lead intake automation');

    // A second plugin's capability joins the same workbench.
    dialog = await openPalette(page);
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill('Write Apex');
    await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'detached' });
    await selected(page, 'Write Apex'); await settle(page);
    assert.deepEqual(await views(page).getByRole('tab').allInnerTexts(), ['Build an automation', 'Write Apex']);
    assert.equal(await header(page).getAttribute('data-plugin'), 'Code');
    assert.equal(new URL(page.url()).pathname, '/code');

    // Switch in any order, including by keyboard.
    await view(page, 'Write Apex').focus(); await page.keyboard.press('ArrowLeft');
    await selected(page, 'Build an automation'); await settle(page);
    assert(await view(page, 'Build an automation').evaluate(node => node === document.activeElement), 'Keyboard focus follows the selected view');
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Lead intake automation');
    assert.equal(new URL(page.url()).pathname, '/build');
    // Close the first view; its draft survives reopening.
    await views(page).getByRole('button', { name: 'Close Build an automation', exact: true }).click();
    await selected(page, 'Write Apex'); await settle(page);
    assert.deepEqual(await views(page).getByRole('tab').allInnerTexts(), ['Write Apex']);
    assert.equal(await view(page, 'Write Apex').getAttribute('aria-selected'), 'true');
    dialog = await openPalette(page);
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill('Build an automation');
    await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'detached' });
    await selected(page, 'Build an automation'); await settle(page);
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Lead intake automation', 'Closing a view keeps its draft');
    assert.equal(await composer.inputValue(), 'Keep this note across the workbench', 'The agent conversation stays mounted');
    out.checks.push(`${motion}: capabilities from two plugins share one workbench; views switch by click/keyboard, close in any order and keep drafts; composer stays mounted`);

    // Hiding keeps views; the toggle restores them. Reload restores views and the draft.
    await toggle(page).click();
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#workbench').getAttribute('aria-hidden'), 'true');
    await toggle(page).click();
    assert.deepEqual(await views(page).getByRole('tab').allInnerTexts(), ['Write Apex', 'Build an automation']);
    await page.keyboard.press('Control+Shift+B');
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Control+Shift+B');
    assert.equal(await toggle(page).getAttribute('aria-pressed'), 'true');
    await page.reload();
    await view(page, 'Build an automation').waitFor();
    assert.deepEqual(await views(page).getByRole('tab').allInnerTexts(), ['Write Apex', 'Build an automation']);
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Lead intake automation');
    out.checks.push(`${motion}: hiding the workbench keeps its views; ⌘⇧B toggles; reload restores views, order and draft`);

    // Today's plugin links open that plugin's overview as a view.
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor(); await settle(page);
    const explore = page.getByRole('group', { name: 'Today', exact: true }).getByRole('navigation', { name: 'Explore capabilities', exact: true });
    await explore.getByRole('link', { name: 'ALM', exact: true }).click(); await settle(page);
    await view(page, 'ALM overview').waitFor();
    assert.equal(await header(page).getAttribute('data-plugin'), 'ALM');
    out.checks.push(`${motion}: Today’s Explore capabilities links open plugin overviews in the workbench`);
    await context.close();
  }

  // Saved per-surface tabs from the previous release migrate into one workbench.
  {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const session = fixture.state.snapshot.session, target = { projectId: null, worktreeId: null, orgId: 'uat' };
    const automation = { kind: 'capability', title: 'Build an automation', params: { scope: 'unbound', orgId: 'uat', surface: 'build', capability: 'automation' } };
    const apex = { kind: 'capability', title: 'Write Apex', params: { scope: 'unbound', orgId: 'uat', surface: 'code', capability: 'apex' } };
    fixture.state.snapshot.canvases.push({ id: idFor(automation), surface: 'build', canvas: automation, target, fields: { name: 'Saved before the workbench' }, revision: 1 });
    const empty = { canvases: [], activeCanvasId: 'overview', closedDrafts: {}, targets: {} };
    const legacy = { build: { ...empty, canvases: [{ ...automation, id: idFor(automation) }], activeCanvasId: idFor(automation), targets: { [idFor(automation)]: target } },
      code: { ...empty, canvases: [{ ...apex, id: idFor(apex) }], activeCanvasId: idFor(apex), targets: { [idFor(apex)]: target } }, govern: empty, alm: empty };
    const key = `ufd.canvas-preferences.v3.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}.${JSON.stringify(['unbound-session', null])}`;
    await context.addInitScript(({ key, legacy }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ __ufd: 1, data: legacy })); }, { key, legacy });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const link = '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface: 'build', target, canvas: automation }));
    await page.goto(origin + link);
    await view(page, 'Build an automation').waitFor();
    assert.deepEqual(await views(page).getByRole('tab').allInnerTexts(), ['Build an automation', 'Write Apex']);
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Saved before the workbench');
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data, key);
    assert.equal(stored.build.canvases[0].id, idFor(automation), 'Per-plugin tab records keep their canonical ids');
    assert.equal(stored.code.canvases[0].id, idFor(apex));
    out.checks.push('Legacy per-surface open tabs, a saved draft and an old shared link restore into one workbench without changing canvas ids');
    await context.close();
  }

  // Restricted profile: plugins outside access are neither listed nor installable.
  {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'kf' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + home('kf'));
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
    const dialog = await openPalette(page);
    await dialog.getByRole('tab', { name: 'Plugins', exact: true }).click();
    const names = await dialog.getByRole('listbox').getByRole('option').locator('[data-result-label]').allInnerTexts();
    assert.deepEqual(names.sort(), ['ALM', 'Build & Setup']);
    await dialog.getByRole('button', { name: 'Available', exact: true }).click();
    assert.equal(await dialog.getByRole('listbox').getByRole('option').locator('[data-result-label]').count(), 0);
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill('Write Apex');
    await dialog.getByText('No capabilities match “Write Apex”.', { exact: true }).waitFor();
    out.checks.push('Karen sees only her accessible plugins and capabilities; unavailable plugins cannot be installed');
    await context.close();
  }
} catch (error) {
  out.failure = error.stack;
  process.exitCode = 1;
} finally {
  for (const cleanup of cleanups) cleanup();
  await browser.close();
  writeFileSync(outputPath(`${label}-plugin-workbench.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
