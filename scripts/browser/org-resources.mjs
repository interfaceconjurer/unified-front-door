import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
async function setup(profileId = 'jw', width = 1440, colorScheme = 'dark') {
  const context = await browser.newContext({ httpCredentials, viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme });
  const { state, stats } = await install(context, { drafts: 0, messages: 1 });
  const current = { ...session, profileId };
  state.snapshot.session = current;
  await context.route('**/api/session', route => route.fulfill({ json: { session: current } }));
  // This suite never submits chat or changes application data.
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + (profileId === 'sp' ? '/build' : '/'));
  await page.getByRole('button', { name: 'Search workspace', exact: true }).waitFor();
  return { context, page, stats };
}
async function palette(page) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Resources', exact: true }).click();
  return dialog;
}
async function search(dialog, query, type = 'all', org) {
  if (org) await dialog.getByLabel('Resource org', { exact: true }).selectOption(org);
  await dialog.getByLabel('Resource type', { exact: true }).selectOption(type);
  await dialog.getByRole('combobox', { name: 'Search resources…', exact: true }).fill(query);
}
async function choose(dialog, text) { await dialog.getByRole('listbox').getByRole('option').filter({ hasText: text }).getByRole('button').click(); await dialog.waitFor({ state: 'detached' }); }
const article = (page, name) => page.getByRole('article', { name: `${name} resource`, exact: true });
try {
  const { context, page, stats } = await setup();
  let dialog = await palette(page);
  await dialog.getByText('Choose an org above', { exact: false }).waitFor();
  assert.equal(await dialog.getByRole('listbox').getByRole('option').count(), 0);
  await search(dialog, '', 'all', 'prod');
  assert(await dialog.getByRole('listbox').getByRole('option').count() > 25);
  assert(!(await dialog.getByLabel('Resource org', { exact: true }).innerText()).includes('hotfix'));
  const input = dialog.getByRole('combobox', { name: 'Search resources…', exact: true });
  await input.focus();
  for (let i = 0; i < 18; i++) await input.press('ArrowDown');
  assert(await dialog.getByRole('listbox').evaluate(list => {
    const row = list.querySelector('[aria-selected="true"]').getBoundingClientRect(), bounds = list.getBoundingClientRect();
    return row.top >= bounds.top - 1 && row.bottom <= bounds.bottom + 1 && list.scrollTop > 0;
  }));
  await search(dialog, 'Lead_Routing', 'flow');
  assert.equal(await dialog.getByRole('listbox').getByRole('option').count(), 1);
  await input.press('Enter');
  await article(page, 'Lead Routing').waitFor();
  assert(new URL(page.url()).pathname === '/build');
  assert((await article(page, 'Lead Routing').innerText()).includes('Production'));
  await article(page, 'Lead Routing').getByRole('button', { name: /^Lead Standard object/ }).click();
  await article(page, 'Lead').waitFor();
  await article(page, 'Lead').getByRole('button', { name: /^Lead Routing Service Apex class/ }).click();
  await article(page, 'Lead Routing Service').waitFor();
  assert.equal(new URL(page.url()).pathname, '/code');
  await page.reload(); await article(page, 'Lead Routing Service').waitFor();
  assert((await article(page, 'Lead Routing Service').innerText()).includes('public with sharing'));
  await page.goBack(); await article(page, 'Lead').waitFor();
  out.checks.push('Org-only search, type/API-name filtering, keyboard scrolling, related resources, surface routing, reload and Back');

  dialog = await palette(page);
  assert.equal(await dialog.getByLabel('Resource org', { exact: true }).inputValue(), 'prod');
  await search(dialog, 'Release_Checklist__c', 'custom-object');
  assert.equal(await dialog.getByRole('listbox').getByRole('option').count(), 0);
  await dialog.getByLabel('Resource org', { exact: true }).selectOption('uat');
  assert.equal(await dialog.getByRole('listbox').getByRole('option').count(), 1);
  await choose(dialog, 'Release Checklist'); await article(page, 'Release Checklist').waitFor();
  assert((await article(page, 'Release Checklist').innerText()).includes('UAT Sandbox'));
  dialog = await palette(page); await search(dialog, 'Account', 'standard-object', 'prod');
  await choose(dialog, 'Standard object · Account'); await article(page, 'Account').waitFor();
  dialog = await palette(page); await search(dialog, 'Account', 'standard-object');
  await choose(dialog, 'Standard object · Account');
  assert.equal(await page.getByRole('tab', { name: 'Account · Production', exact: true }).count(), 1);
  dialog = await palette(page); await search(dialog, 'Account', 'standard-object', 'uat');
  await choose(dialog, 'Standard object · Account'); await article(page, 'Account').getByText('UAT Sandbox', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: /^Account · / }).count(), 2);
  await page.getByRole('tab', { name: 'Account · Production', exact: true }).click();
  await article(page, 'Account').getByText('Production', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close Account · Production', exact: true }).click();
  await page.getByRole('tab', { name: 'Account · Production', exact: true }).waitFor({ state: 'detached' });
  dialog = await palette(page); await search(dialog, 'Account', 'standard-object', 'prod');
  await choose(dialog, 'Standard object · Account'); await article(page, 'Account').getByText('Production', { exact: true }).waitFor();
  await page.screenshot({ path: outputPath(`${label}-resource-canvas-dark.png`) });
  dialog = await palette(page); await search(dialog, '', 'all');
  await page.screenshot({ path: outputPath(`${label}-resource-palette-dark.png`) });
  out.checks.push('Org-specific catalog, correct empty state, tab deduplication, close/reopen, and separate captured org tabs');
  assert.equal(stats.posts, 0, 'Browsing org metadata must never save an editable draft');
  await context.close();

  const restricted = await setup('sp');
  dialog = await palette(restricted.page); await search(dialog, 'LeadRoutingService', 'all', 'prod');
  assert.equal(await dialog.getByRole('listbox').getByRole('option').count(), 0);
  assert(!(await dialog.getByLabel('Resource type', { exact: true }).innerText()).includes('Apex'));
  await search(dialog, 'Sales_Operations', 'permission-set'); await choose(dialog, 'Sales Operations');
  await article(restricted.page, 'Sales Operations').waitFor();
  out.checks.push('Day-zero profiles browse permissions without a project and cannot launch inaccessible surfaces');
  await restricted.context.close();

  const scoped = await setup('am', 1440, 'light');
  await scoped.page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  dialog = scoped.page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  await choose(dialog, 'Trailblazer CRM');
  const header = scoped.page.locator('header[data-project-scoped]');
  let project = header.getByRole('button', { name: /Switch project, current project: Trailblazer CRM, branch: main/ });
  await project.waitFor();
  assert((await header.getByRole('button', { name: 'Search workspace', exact: true }).boundingBox()).width >= 400);
  await scoped.page.screenshot({ path: outputPath(`${label}-project-header-light.png`) });
  await project.click(); dialog = scoped.page.getByRole('dialog');
  assert.equal(await dialog.getByRole('tab', { name: 'Projects', exact: true }).getAttribute('aria-selected'), 'true');
  await choose(dialog, 'feature/lead-routing');
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  await header.getByRole('button', { name: /Switch project/ }).click(); dialog = scoped.page.getByRole('dialog');
  await choose(dialog, 'Acme Storefront');
  await header.getByRole('button', { name: /current project: Acme Storefront/ }).waitFor();
  await scoped.page.goBack();
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  await scoped.page.reload();
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  out.checks.push('Prominent launcher and project/branch badge follow project switching, browser Back, and reload');

  const scopedTarget = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
  const currentDestination = () => JSON.parse(new URL(scoped.page.url()).searchParams.get('destination'));
  dialog = await palette(scoped.page); await search(dialog, 'Account', 'standard-object');
  await choose(dialog, 'Standard object · Account'); await article(scoped.page, 'Account').waitFor();
  assert.deepEqual(currentDestination().target, scopedTarget);
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  await scoped.page.reload(); await article(scoped.page, 'Account').waitFor();
  assert.deepEqual(currentDestination().target, scopedTarget);
  await article(scoped.page, 'Account').getByRole('button', { name: /^Customer Tier Custom field/ }).click();
  await article(scoped.page, 'Customer Tier').waitFor();
  assert.deepEqual(currentDestination().target, scopedTarget);
  await scoped.page.getByRole('link', { name: 'Global home', exact: true }).click();
  await scoped.page.waitForURL(url => url.pathname === '/');
  assert.deepEqual(currentDestination().target, { projectId: null, worktreeId: null, orgId: 'uat' });
  await header.getByRole('button', { name: /Switch project/ }).waitFor({ state: 'detached' });
  await scoped.page.reload();
  await header.getByRole('link', { name: 'Global home', exact: true }).waitFor();
  assert.deepEqual(currentDestination().target, { projectId: null, worktreeId: null, orgId: 'uat' });
  await scoped.page.goBack(); await article(scoped.page, 'Customer Tier').waitFor();
  assert.deepEqual(currentDestination().target, scopedTarget);
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  await scoped.page.getByRole('link', { name: 'Global home', exact: true }).click();
  await scoped.page.waitForURL(url => url.pathname === '/');
  await header.getByRole('button', { name: 'Search workspace', exact: true }).click();
  dialog = scoped.page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
  await choose(dialog, 'Build & Setup');
  await scoped.page.waitForURL(url => url.pathname === '/build');
  assert.deepEqual(currentDestination().target, { projectId: null, worktreeId: null, orgId: 'uat' });
  assert.deepEqual(currentDestination().canvasTarget, scopedTarget, 'Global browsing retains the restored file ownership without entering that project');
  assert.equal(currentDestination().canvas.params.apiName, 'Account.Customer_Tier__c');
  dialog = await palette(scoped.page); await search(dialog, 'Account', 'standard-object', 'uat');
  await choose(dialog, 'Standard object · Account'); await article(scoped.page, 'Account').waitFor();
  assert.deepEqual(currentDestination().target, { projectId: null, worktreeId: null, orgId: 'uat' });
  await header.getByRole('button', { name: 'Search workspace', exact: true }).click();
  dialog = scoped.page.getByRole('dialog'); await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  await choose(dialog, 'feature/lead-routing');
  await header.getByRole('button', { name: /current project: Trailblazer CRM, branch: feature\/lead-routing/ }).waitFor();
  dialog = await palette(scoped.page); await search(dialog, 'Account', 'standard-object', 'uat');
  await choose(dialog, 'Standard object · Account'); await article(scoped.page, 'Account').waitFor();
  assert.deepEqual(currentDestination().target, scopedTarget, 'Existing global resource tabs must not clear project scope');
  await scoped.page.screenshot({ path: outputPath(`${label}-project-resource-scope.png`) });
  out.checks.push('Resource and related-resource launches preserve project/branch through reload; Home retains org while clearing project, Back restores it, and global surface navigation stays global');

  await scoped.page.setViewportSize({ width: 390, height: 844 });
  await scoped.page.screenshot({ path: outputPath(`${label}-project-header-mobile.png`) });
  assert(await header.evaluate(el => el.scrollWidth <= el.clientWidth));
  dialog = await palette(scoped.page); await search(dialog, 'Project__c', 'custom-object', 'prod');
  await scoped.page.screenshot({ path: outputPath(`${label}-resource-palette-mobile.png`) });
  assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
  await choose(dialog, 'Custom object · Project__c'); await article(scoped.page, 'Project').waitFor();
  assert.equal(await header.getByRole('button', { name: /Switch project/ }).count(), 1);
  assert.deepEqual(currentDestination().target, { ...scopedTarget, orgId: 'prod' });
  out.checks.push('Mobile header and resource search fit; choosing another org preserves the active project and branch');
  await scoped.context.close();
} catch (error) {
  out.errors.push(error.stack);
  for (const context of browser.contexts()) for (const page of context.pages()) if (!page.isClosed()) await page.screenshot({ path: outputPath(`${label}-resource-failure.png`) }).catch(() => {});
}
finally {
  await browser.close(); writeFileSync(outputPath(`${label}-org-resources.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
