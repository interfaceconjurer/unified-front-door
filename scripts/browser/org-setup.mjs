import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const target = { projectId: null, worktreeId: null, orgId: 'uat' };
const selected = page => JSON.parse(new URL(page.url()).searchParams.get('destination')).target;
const overview = page => page.getByRole('tab', { name: 'Build & Setup', exact: true }).click();
async function setup(profileId, workspace = target, colorScheme = 'dark', width = 1600) {
  const context = await browser.newContext({ httpCredentials, colorScheme, reducedMotion: 'reduce', viewport: { width, height: 1000 } });
  const fixture = await installAssessment(context, { profileId });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: profileId, surface: 'build', target: workspace })));
  await page.getByRole('heading', { name: 'Configure your org' }).waitFor();
  return { context, page, fixture };
}
try {
  const { context, page, fixture } = await setup('am');
  await page.screenshot({ path: outputPath(`${label}-setup-overview.png`) });
  await page.getByRole('button', { name: /^Data & Objects/ }).click();
  let area = page.getByRole('article', { name: 'Object Manager', exact: true });
  await area.getByRole('button', { name: 'Open Account', exact: true }).waitFor();
  await area.getByRole('searchbox').fill('Project__c');
  assert.equal(await area.getByRole('button', { name: /^Open / }).count(), 1);
  await area.getByRole('searchbox').fill('missing-object');
  await area.getByText('No matching resources').waitFor();
  await area.getByRole('button', { name: 'Clear filters' }).click();
  await area.getByLabel('Setup resource type').selectOption('standard-object');
  assert.equal(await area.getByRole('button', { name: 'Open Project', exact: true }).count(), 0);
  await area.getByRole('button', { name: 'Open Account', exact: true }).click();
  await page.getByRole('article', { name: 'Account resource' }).getByRole('heading', { name: 'Fields', exact: true }).waitFor();
  assert.deepEqual(selected(page), target);
  await page.reload();
  await page.getByRole('article', { name: 'Account resource' }).waitFor();
  await page.getByRole('tab', { name: 'Object Manager', exact: true }).click();
  await area.getByRole('button', { name: 'Access & Permissions', exact: true }).click();
  area = page.getByRole('article', { name: 'Access & Permissions', exact: true });
  await area.getByLabel('Setup resource type').selectOption('permission-set');
  await area.getByRole('button', { name: 'Open Sales Operations', exact: true }).click();
  await page.getByRole('article', { name: 'Sales Operations resource' }).waitFor();
  assert.deepEqual(selected(page), target);
  out.checks.push('Object search, type filters, empty recovery, object/permission details and reload stay global');

  await overview(page);
  await page.getByRole('button', { name: /^Org Settings & Features/ }).click();
  area = page.getByRole('article', { name: 'Org Settings & Features', exact: true });
  await area.getByLabel('Setup resource type').selectOption('org-feature');
  assert.equal(await area.getByRole('button', { name: /^Open / }).count(), 3);
  await area.getByText('Not enabled', { exact: true }).waitFor();
  await page.screenshot({ path: outputPath(`${label}-setup-features.png`) });
  await area.getByRole('button', { name: 'Open Experience Cloud', exact: true }).click();
  await page.getByRole('article', { name: 'Experience Cloud resource' }).getByRole('heading', { name: 'Configuration review' }).waitFor();
  assert.equal(await page.getByRole('switch').count(), 0);
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill('object manager');
  await dialog.getByRole('option').filter({ hasText: 'Object Manager' }).getByRole('button').click();
  area = page.getByRole('article', { name: 'Object Manager', exact: true });
  await area.waitFor();
  await area.getByLabel('Setup org', { exact: true }).selectOption('prod');
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('destination')).target.orgId === 'prod');
  assert.equal(selected(page).projectId, null);
  await page.getByRole('tab', { name: 'Object Manager', exact: true }).first().click();
  await page.waitForFunction(() => JSON.parse(new URL(location.href).searchParams.get('destination')).canvas.params.orgId === 'uat');
  assert.equal(await area.getByLabel('Setup org', { exact: true }).inputValue(), 'uat');
  assert(!fixture.stats.commands.some(command => command.kind === 'canvas.save'));
  out.checks.push('Feature status and review, All search discovery, separate captured org tabs, no draft writes');
  await context.close(); fixture.cleanup();

  const project = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
  const scoped = await setup('am', project);
  await scoped.page.getByRole('button', { name: /^Access & Permissions/ }).click();
  await scoped.page.getByRole('button', { name: 'Open Sales Operations', exact: true }).click();
  await scoped.page.getByRole('article', { name: 'Sales Operations resource' }).waitFor();
  assert.deepEqual(selected(scoped.page), project);
  out.checks.push('Setup and resource selection preserve the selected project and worktree');
  await scoped.context.close(); scoped.fixture.cleanup();

  for (const profileId of ['kf', 'sp', 'jw']) {
    const empty = await setup(profileId, { ...target, orgId: null }, 'light', 900);
    await empty.page.getByRole('button', { name: /^Data & Objects/ }).click();
    const browser = empty.page.getByRole('article', { name: 'Object Manager', exact: true });
    await browser.getByRole('heading', { name: 'Choose a connected org' }).waitFor();
    await browser.getByLabel('Setup org', { exact: true }).selectOption('uat');
    await browser.getByRole('button', { name: 'Open Account', exact: true }).waitFor();
    assert.equal(selected(empty.page).projectId, null);
    assert(await browser.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    if (profileId === 'kf') await empty.page.screenshot({ path: outputPath(`${label}-setup-objects-light.png`) });
    await empty.context.close(); empty.fixture.cleanup();
  }
  out.checks.push('All profile types expose setup, empty org selection is explicit, light/narrow layout fits');
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-org-setup.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out)); await browser.close();
}
