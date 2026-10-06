import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules();
const { destinationHref } = modules.load('lib/navigation/model');
const { workCanvasInput, RETURNING_WORK } = modules.load('lib/workspace/returning-work');
const { canvasId } = modules.load('lib/surface-canvas/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const project = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'prod' };
const work = RETURNING_WORK.find(item => item.id === 'lead-routing-agent');
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
async function identity(page) {
  const list = page.locator('#workbench [data-view-identity]').getByRole('list', { name: 'Working context' });
  await list.waitFor();
  return list.getByRole('listitem').allInnerTexts();
}
async function palette(page, tab, query) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: tab, exact: true }).click();
  const input = dialog.getByRole('combobox', { name: `Search ${tab.toLowerCase()}…`, exact: true });
  await input.fill(query);
  return { dialog, input };
}
async function chooseProject(page, query, branch, projectId, worktreeId) {
  const { dialog } = await palette(page, 'Projects', query);
  await dialog.getByRole('option').filter({ hasText: branch }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.waitForURL(url => destinationFromUrl(url).target.projectId === projectId && destinationFromUrl(url).target.worktreeId === worktreeId);
}
try {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const fixture = await installAssessment(context, { profileId: 'am' });
  try {
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'build', target: project, canvas: workCanvasInput(work) }));
    const notes = page.getByRole('textbox', { name: 'Your notes', exact: true });
    const note = 'Keep the lead-routing draft and conversation';
    const saved = page.waitForResponse(response => {
      if (!response.url().includes('/api/application') || response.request().method() !== 'POST') return false;
      const command = response.request().postDataJSON()?.command;
      return response.ok() && command?.kind === 'canvas.save' && command.fields?.notes === note;
    });
    await notes.fill(note);
    await saved;
    assert.equal(fixture.state.snapshot.canvases.find(canvas => canvas.id === canvasId(workCanvasInput(work).kind, workCanvasInput(work).params))?.fields.notes, note, 'The note is persisted before navigation');
    assert.deepEqual(destination(page).target, project);
    assert.equal(await page.getByRole('main').count(), 1);
    assert.equal(await page.getByRole('main', { name: 'Workbench' }).count(), 1);

    // Remember a non-primary worktree and SIT connection for Acme, then return
    // to the original project and its Production connection through Back.
    await chooseProject(page, 'search-refresh', 'feature/search-refresh', 'acme-storefront', 'search-refresh');
    const acmeOrg = await palette(page, 'Orgs', 'SIT Sandbox');
    await acmeOrg.dialog.getByRole('option').filter({ hasText: 'SIT Sandbox' }).click();
    await acmeOrg.dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => destinationFromUrl(url).target.projectId === 'acme-storefront' && destinationFromUrl(url).target.orgId === 'sit');
    await page.goBack();
    await page.waitForURL(url => destinationFromUrl(url).target.projectId === 'acme-storefront' && destinationFromUrl(url).target.worktreeId === 'search-refresh');
    await page.goBack();
    await page.waitForURL(url => destinationFromUrl(url).target.projectId === 'trailblazer-crm' && destinationFromUrl(url).target.worktreeId === 'lead-routing');
    await page.waitForURL(url => destinationFromUrl(url).canvas?.params.workId === 'lead-routing-agent');
    await notes.waitFor();
    assert.equal(destination(page).canvas?.params.workId, 'lead-routing-agent', `The original work view is restored at ${page.url()}`);
    assert.equal(await notes.inputValue(), note);
    assert.deepEqual(await identity(page), ['Org\nProduction', 'Project\nTrailblazer CRM · feature/lead-routing']);
    const originalThread = fixture.state.agent.conversations.find(saved => saved.threadKey === JSON.stringify(['project-session', 'trailblazer-crm', 'lead-routing']));
    const historyBefore = structuredClone(originalThread?.conversation.messages.map(message => message.id) ?? []);
    assert(originalThread && historyBefore.length > 0, 'The original project conversation exists before cross-project entry');

    await page.locator('#workspace-panel-toggle').click();
    const panel = page.locator('#workspace-panel');
    await panel.getByRole('group', { name: 'Filter projects panel' }).getByRole('button', { name: 'Apps', exact: true }).click();
    await panel.getByRole('button', { name: /^Acme Storefront, Acme Storefront, Production/ }).click();
    await page.waitForURL(url => destinationFromUrl(url).canvas?.kind === 'app');
    assert.deepEqual(destination(page).target, { projectId: 'acme-storefront', worktreeId: 'search-refresh', orgId: 'prod' });
    assert.deepEqual(destination(page).canvasTarget, { projectId: 'acme-storefront', worktreeId: null, orgId: 'sit' });
    assert.deepEqual(await identity(page), ['Org\nSIT Sandbox', 'Project\nAcme Storefront']);
    assert.equal(await page.getByRole('main', { name: 'Workbench' }).count(), 1);
    assert.equal(await page.getByRole('main').count(), 1);
    const appDestination = destination(page);
    await page.reload();
    await page.getByRole('heading', { name: 'Acme Storefront', exact: true }).waitFor();
    assert.deepEqual(destination(page), appDestination);
    assert.deepEqual(await identity(page), ['Org\nSIT Sandbox', 'Project\nAcme Storefront']);
    await page.goBack();
    await notes.waitFor();
    assert.deepEqual(destination(page).target, project);
    assert.equal(await notes.inputValue(), note);
    const restoredThread = fixture.state.agent.conversations.find(saved => saved.threadKey === JSON.stringify(['project-session', 'trailblazer-crm', 'lead-routing']));
    assert(historyBefore.every(id => restoredThread?.conversation.messages.some(message => message.id === id)), 'Cross-project entry preserves the original conversation history');
    out.checks.push('App row enters remembered project worktree, preserves selected org and captured app org, and Back restores original draft/history after reload');

    const { dialog, input } = await palette(page, 'Projects', 'Acme Storefront');
    assert.equal(await input.getAttribute('aria-autocomplete'), 'list');
    const listbox = dialog.getByRole('listbox');
    const option = listbox.getByRole('option', { name: /View Acme Storefront plan/ });
    assert.equal(await option.evaluate(node => node.tagName), 'BUTTON');
    assert.equal(await option.locator('button').count(), 0, 'A listbox option has no nested interactive control');
    for (let index = 0; index < await listbox.getByRole('option').count()
      && await input.getAttribute('aria-activedescendant') !== await option.getAttribute('id'); index++) await input.press('ArrowDown');
    assert.equal(await input.getAttribute('aria-activedescendant'), await option.getAttribute('id'));
    assert.equal(await option.getAttribute('aria-selected'), 'true');
    assert(await input.evaluate(node => node === document.activeElement), 'Arrow navigation keeps focus in the combobox');
    await input.press('Enter');
    await dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => destinationFromUrl(url).canvas?.kind === 'improvement-project');
    assert.deepEqual(destination(page).target, { projectId: 'acme-storefront', worktreeId: 'search-refresh', orgId: 'prod' });
    assert.deepEqual(destination(page).canvasTarget, { projectId: 'acme-storefront', worktreeId: null, orgId: null });
    assert.deepEqual(await identity(page), ['Org\nNo org selected', 'Project\nAcme Storefront']);
    await page.goBack();
    await notes.waitFor();
    assert.equal(await notes.inputValue(), note);
    out.checks.push('Projects palette keyboard opens cross-project plan with one option control and separate captured identity; Back restores scoped draft');

    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
    assert.equal(await page.getByRole('main', { name: 'Home' }).count(), 1);
    assert.equal(await page.getByRole('main').count(), 1);
    if (await panel.getAttribute('data-open') !== 'true') await page.locator('#workspace-panel-toggle').click();
    await panel.getByRole('group', { name: 'Filter projects panel' }).getByRole('button', { name: 'Apps', exact: true }).click();
    await panel.getByRole('button', { name: /^Acme Storefront, Acme Storefront, Production/ }).click();
    await page.waitForURL(url => destinationFromUrl(url).canvas?.kind === 'app');
    assert.equal(destination(page).target.projectId, null, 'Home app inspection stays global');
    assert.deepEqual(destination(page).canvasTarget, { projectId: 'acme-storefront', worktreeId: null, orgId: 'sit' });
    assert.deepEqual(await identity(page), ['Org\nSIT Sandbox', 'Project\nAcme Storefront']);
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.getByRole('main', { name: 'Home' }).waitFor();
    const globalPalette = await palette(page, 'Projects', 'Acme Storefront');
    await globalPalette.dialog.getByRole('option', { name: /View Acme Storefront plan/ }).click();
    await globalPalette.dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => destinationFromUrl(url).canvas?.kind === 'improvement-project');
    assert.equal(destination(page).target.projectId, null, 'Home plan inspection stays global');
    assert.equal(destination(page).canvasTarget.projectId, 'acme-storefront');
    assert.deepEqual(await identity(page), ['Org\nNo org selected', 'Project\nAcme Storefront']);
    out.checks.push('Home exposes one main landmark and retains global app/plan inspection with captured project identity');
  } finally { await context.close(); fixture.cleanup(); }
  assert.deepEqual(out.errors, []);
} catch (error) { out.errors.push(error.stack); process.exitCode = 1; }
finally {
  await browser.close(); modules.cleanup();
  writeFileSync(outputPath(`${label}-cross-project-accessibility.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

function destinationFromUrl(url) { return JSON.parse(url.searchParams.get('destination')); }
