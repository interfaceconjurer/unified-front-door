import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const home = (owner, orgId) => '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner, surface: null,
  target: { projectId: null, worktreeId: null, orgId } }));
const rows = dialog => dialog.getByRole('listbox').getByRole('option');
async function open(page, keyboard = false) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).waitFor();
  if (keyboard) await page.keyboard.press('Control+Shift+P');
  else await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).waitFor();
  await dialog.locator('[data-modal-motion]').evaluate(async node => {
    node.getBoundingClientRect();
    await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  assert.equal(await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await dialog.getByRole('tab', { name: 'All', exact: true }).count(), 0);
  return dialog;
}
async function tab(dialog, name, query = '') {
  await dialog.getByRole('tab', { name, exact: true }).click();
  const input = dialog.getByRole('combobox', { name: `Search ${name.toLowerCase()}…`, exact: true });
  await input.fill(query);
  return input;
}
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + home('am', 'uat'));

    let dialog = await open(page, true);
    const capabilityInput = dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true });
    await capabilityInput.fill('Start a project');
    assert.equal((await rows(dialog).first().locator('[data-result-label]').innerText()), 'Start a project');
    await capabilityInput.press('Enter'); await dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).canvas?.params.capability === 'project');
    assert.equal(destination(page).surface, 'alm');
    assert.deepEqual(destination(page).target, { projectId: null, worktreeId: null, orgId: 'uat' });
    out.checks.push(`${motion}: shortcut defaults to Capabilities with no All tab; Start a project opens its scoped view`);

    dialog = await open(page);
    const resourceInput = await tab(dialog, 'Resources', 'Account');
    assert.equal(await dialog.getByLabel('Resource org', { exact: true }).inputValue(), 'uat');
    assert.equal(await rows(dialog).first().locator('[data-result-label]').innerText(), 'Account');
    await resourceInput.press('Enter'); await dialog.waitFor({ state: 'detached' });
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.equal(destination(page).canvas.kind, 'org-resource');
    assert.equal(destination(page).target.projectId, null);
    out.checks.push(`${motion}: Resources search ranks an exact object name first and opens it without entering a project`);

    dialog = await open(page);
    await tab(dialog, 'Projects', 'lead routing');
    const text = await rows(dialog).allTextContents();
    const parent = text.findIndex(row => row.startsWith('Trailblazer CRM'));
    assert(parent >= 0 && text[parent + 1].includes('feature/lead-routing'), 'Projects keeps matching worktrees attached');
    assert(text.some(row => row.includes('View Trailblazer CRM plan')), 'Project plan remains searchable in Projects');
    await dialog.locator('[id="cmd-projects-plan:trailblazer-crm"]').getByRole('button').click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Trailblazer CRM', exact: true }).waitFor();
    assert.equal(destination(page).canvas.kind, 'improvement-project');
    assert.equal(destination(page).target.projectId, null, 'Viewing a plan must preserve global context');
    out.checks.push(`${motion}: Projects keeps its worktree tree and the former All project-plan action`);

    dialog = await open(page);
    await tab(dialog, 'Projects', 'lead routing');
    await rows(dialog).filter({ hasText: 'feature/lead-routing' }).first().getByRole('button').click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.worktreeId === 'lead-routing');
    assert.equal(destination(page).target.projectId, 'trailblazer-crm');
    dialog = await open(page);
    await tab(dialog, 'Orgs', 'Production');
    await rows(dialog).filter({ hasText: 'Production' }).first().getByRole('button').click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.orgId === 'prod');
    assert.equal(destination(page).target.worktreeId, 'lead-routing');
    out.checks.push(`${motion}: Projects enters a worktree; Orgs changes only the selected org`);

    dialog = await open(page);
    const scopedResource = await tab(dialog, 'Resources', 'Release_Checklist__c');
    await dialog.getByLabel('Resource org', { exact: true }).selectOption('uat');
    assert.equal(await rows(dialog).count(), 1);
    await dialog.getByLabel('Resource type', { exact: true }).selectOption('flow');
    assert.equal(await rows(dialog).count(), 0);
    await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
    assert.equal(await scopedResource.inputValue(), '');
    assert.equal(await dialog.getByLabel('Resource org', { exact: true }).inputValue(), 'uat');
    assert.equal(await dialog.getByLabel('Resource type', { exact: true }).inputValue(), 'flow');
    await dialog.getByLabel('Resource type', { exact: true }).selectOption('all');
    await scopedResource.fill('Release_Checklist__c');
    await scopedResource.press('Enter'); await dialog.waitFor({ state: 'detached' });
    await page.getByRole('article', { name: 'Release Checklist resource', exact: true }).waitFor();
    assert.equal(destination(page).target.orgId, 'prod');
    assert.equal(destination(page).canvas.params.orgId, 'uat');
    out.checks.push(`${motion}: Resources filters and clear retain state; a resource keeps its captured org without switching the workspace`);
    assert(fixture.commands.every(command => command.kind === 'visit'));
    await context.close();
  }

  {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'sp' }); cleanups.push(fixture.cleanup);
    const finding = fixture.run.findings[0];
    const project = { id: 'palette-plan', name: 'Acme org improvements', goal: 'Reduce unnecessary requests', owner: 'Sam Patel',
      targetOrgId: 'sit', scopeOrgIds: ['prod', 'sit'], createdAt: '2026-09-22T12:00:00Z', revision: 1,
      runId: fixture.run.id, sourceDraftId: 'palette-draft', createCommandId: 'palette-command',
      workItems: [{ id: 'WI-1', title: finding.title, priority: 'High', status: 'todo', findingId: finding.id, finding }] };
    fixture.state.snapshot.assessment.projects.push(project);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const target = { projectId: project.id, worktreeId: null, orgId: 'uat' };
    await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: 'build', target })));
    let dialog = await open(page);
    await tab(dialog, 'Projects', project.name);
    const plan = dialog.locator('[id="cmd-projects-plan:palette-plan"]');
    assert(await plan.getByText('ALM · Project plan', { exact: true }).isVisible());
    await plan.getByRole('button').click(); await dialog.waitFor({ state: 'detached' });
    await page.getByLabel(`Status for ${finding.title}`, { exact: true }).waitFor();
    assert.deepEqual(destination(page).target, target);
    assert.equal(destination(page).canvas.params.projectId, project.id);
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/');
    dialog = await open(page);
    await tab(dialog, 'Projects', project.name);
    await dialog.locator('[id="cmd-projects-plan:palette-plan"]').getByRole('button').click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByLabel(`Status for ${finding.title}`, { exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    assert.equal(destination(page).canvas.params.projectId, project.id);
    out.checks.push('Created project plans remain discoverable in Projects and preserve project or global context');
    await context.close();
  }

  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: 'light', viewport: { width: 390, height: 844 } });
  const fixture = await installAssessment(context, { profileId: 'sp' }); cleanups.push(fixture.cleanup);
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + home('sp', null));
  let dialog = await open(page);
  assert.equal(await dialog.getByRole('listbox').getByRole('option').filter({ hasText: 'Code overview' }).count(), 0);
  await tab(dialog, 'Resources');
  await dialog.getByText('Browse metadata from a connected org', { exact: true }).waitFor();
  await tab(dialog, 'Orgs', 'UAT');
  await rows(dialog).filter({ hasText: 'UAT Sandbox' }).first().getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
  await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.orgId === 'uat');
  dialog = await open(page);
  await tab(dialog, 'Resources', 'Account');
  assert.equal(await rows(dialog).first().locator('[data-result-label]').innerText(), 'Account');
  assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.screenshot({ path: outputPath(`${label}-palette-resources-mobile.png`) });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert(fixture.commands.every(command => command.kind === 'visit'));
  out.checks.push('Restricted, narrow layout keeps capability access and explicit org/resource discovery');
  await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup());
  writeFileSync(outputPath(`${label}-unified-search.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
