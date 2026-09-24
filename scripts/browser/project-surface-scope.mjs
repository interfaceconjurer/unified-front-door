import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules(), { planProject } = modules.load('lib/projects/model');
const { projectFromBrief } = modules.load('lib/projects/from-brief');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const main = { projectId: 'trailblazer-crm', worktreeId: 'main', orgId: 'uat' };
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
async function overview(page, label) {
  await tab(page, label).click();
  await page.waitForFunction(() => !JSON.parse(new URL(location.href).searchParams.get('destination')).canvas);
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
}
async function selectProject(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  await dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }).getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
}
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const href = surface => origin + '/' + surface + '?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface, target: main }));
    await page.goto(href('code'));
    await page.getByRole('heading', { name: 'Back to your code.', exact: true }).waitFor();
    const panel = page.getByRole('tabpanel');
    assert.equal(await page.getByRole('region', { name: 'Agent sessions across worktrees' }).count(), 0);
    assert.deepEqual(await panel.getByRole('button', { name: /^Resume / }).allTextContents().then(rows => rows.map(row => row.includes('OpportunityTriggerHandler.cls') ? 'handler' : row.includes('CRM developer toolkit') ? 'toolkit' : row)), ['handler', 'toolkit']);
    assert.equal(await tab(page, 'W-9821 regression tests').count(), 0);
    assert.equal(await tab(page, 'Enterprise accounts.soql').count(), 0);
    await panel.getByRole('button', { name: 'Resume OpportunityTriggerHandler.cls', exact: true }).click();
    const notes = page.getByRole('textbox', { name: 'Your notes', exact: true });
    await notes.fill('Main work stays in main');
    assert.deepEqual(destination(page).target, main);
    await selectProject(page, 'hotfix/W-9821');
    await page.getByRole('heading', { name: 'W-9821 regression tests', exact: true }).waitFor();
    assert.equal(destination(page).target.worktreeId, 'hotfix-9821');
    assert.equal(await tab(page, 'OpportunityTriggerHandler.cls').count(), 0);
    assert.equal(await tab(page, 'CRM developer toolkit').count(), 0);
    await notes.fill('Hotfix work stays in hotfix');
    await overview(page, 'Code');
    assert.equal(await panel.getByRole('button', { name: /^Resume / }).count(), 1);
    await panel.getByRole('button', { name: 'Resume W-9821 regression tests', exact: true }).click();
    assert.equal(await notes.inputValue(), 'Hotfix work stays in hotfix');
    await page.getByRole('button', { name: 'Close W-9821 regression tests', exact: true }).click();
    await tab(page, 'W-9821 regression tests').waitFor({ state: 'detached' });
    assert.equal(destination(page).target.worktreeId, 'hotfix-9821', 'Closing cannot select a hidden main tab');
    await selectProject(page, 'Trailblazer CRM');
    await page.getByRole('heading', { name: 'OpportunityTriggerHandler.cls', exact: true }).waitFor();
    assert.equal(await notes.inputValue(), 'Main work stays in main');
    assert.deepEqual(destination(page).target, main);
    await overview(page, 'Code');
    await page.screenshot({ path: outputPath(`${label}-contained-code-${motion}.png`) });
    out.checks.push(`${motion}: Code has no embedded worktree/session navigation; work and tabs are worktree-scoped; explicit navigator switches and hidden drafts remain intact`);

    await page.goto(href('alm'));
    await page.getByRole('button', { name: 'Open Partner Portal', exact: true }).click();
    await page.getByText('Deployed app · Trailblazer CRM', { exact: true }).waitFor();
    assert.deepEqual(destination(page).target, main);
    assert.equal(destination(page).canvasTarget.worktreeId, null, 'The app remains project-owned');
    const captured = destination(page);
    await page.reload();
    await page.getByText('Deployed app · Trailblazer CRM', { exact: true }).waitFor();
    assert.deepEqual(destination(page), captured);
    await page.getByRole('button', { name: 'Switch surface', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Code', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/code');
    await page.getByRole('button', { name: 'Switch surface', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'ALM', exact: true }).click();
    await page.getByText('Deployed app · Trailblazer CRM', { exact: true }).waitFor();
    assert.deepEqual(destination(page), captured);
    await page.getByRole('button', { name: 'Close Partner Portal', exact: true }).click();
    await tab(page, 'Partner Portal').waitFor({ state: 'detached' });
    assert.deepEqual(destination(page).target, main);
    assert.equal(await tab(page, 'Lead routing → UAT').count(), 0);
    out.checks.push(`${motion}: project-wide app opens, reloads, restores across surfaces and closes without dropping the worktree or changing ownership`);
    await context.close();
  }
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const fixture = await installAssessment(context, { profileId: 'sp' }); cleanups.push(fixture.cleanup);
  const projects = ['Current plan', 'Another plan'].map((name, index) => planProject({ id: `draft-${index}`, revision: 1, name, goal: 'Review captured findings', targetOrgId: 'uat', findingIds: [fixture.run.findings[0].id], runId: fixture.run.id }, fixture.run.findings, 'Sam', `create-${index}`, '2026-09-20T12:00:00Z', `plan-${index}`, ['uat']));
  const brief = projectFromBrief({ id: 'brief-canvas', surface: 'alm', revision: 1,
    target: { projectId: null, worktreeId: null, orgId: 'uat' },
    canvas: { kind: 'capability', title: 'Start a project', params: { scope: 'unbound', orgId: 'uat', surface: 'alm', capability: 'project' } },
    fields: { name: 'New app', goal: 'Make account reviews easier', projectType: 'react', context: 'Keep this context inside the project canvas.' },
  }, 1, 'Sam', 'create-brief', '2026-09-20T12:00:00Z', 'brief-project');
  fixture.state.snapshot.assessment.projects = [...projects, brief];
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  const selected = { projectId: projects[0].id, worktreeId: null, orgId: 'uat' };
  await page.goto(origin + '/alm?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: 'alm', target: selected })));
  const panel = page.getByRole('tabpanel');
  const table = panel.getByRole('table', { name: 'Your projects', exact: true });
  await table.waitFor();
  assert.equal(await table.getByRole('row').count(), 2, 'Selected project scope shows just its row and the table header');
  assert.equal(await panel.getByRole('heading', { name: 'Current plan', exact: true }).count(), 0);
  assert.equal(await panel.getByRole('heading', { name: 'Work items & plans', exact: true }).count(), 0);
  assert.equal(await panel.getByText('Another plan', { exact: true }).count(), 0);
  assert(await panel.getByRole('region', { name: 'Start planning', exact: true }).getByRole('button', { name: /^Start a project/ }).isVisible());
  assert.deepEqual(destination(page).target, selected);
  await table.getByRole('button', { name: 'Current plan', exact: true }).click();
  await panel.getByRole('heading', { name: 'Current plan', exact: true }).waitFor();
  assert.equal(destination(page).canvas.kind, 'improvement-project');
  assert.deepEqual(destination(page).target, selected);
  await panel.getByRole('heading', { name: 'Work items & plans', exact: true }).waitFor();
  await page.reload();
  await panel.getByRole('heading', { name: 'Current plan', exact: true }).waitFor();
  await overview(page, 'ALM');
  await table.waitFor();
  assert.equal(await panel.getByRole('heading', { name: 'Work items & plans', exact: true }).count(), 0);
  await page.getByRole('link', { name: 'Global home', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/');
  await page.goto(origin + '/alm?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: 'alm', target: { ...selected, projectId: null } })));
  await panel.getByRole('heading', { name: 'Your projects', exact: true }).waitFor();
  assert.equal(await table.getByRole('row').count(), 4);
  assert.equal(await table.getByRole('button', { name: 'Another plan', exact: true }).count(), 1);
  assert(await table.getByRole('row').filter({ hasText: 'New app' }).getByRole('cell', { name: 'No work items yet', exact: true }).isVisible());
  await page.screenshot({ path: outputPath(`${label}-alm-projects-table.png`) });
  await page.setViewportSize({ width: 760, height: 1050 });
  await table.scrollIntoViewIfNeeded();
  assert(await table.evaluate(node => node.getBoundingClientRect().right <= innerWidth), 'The compact table fits a narrow viewport');
  await page.screenshot({ path: outputPath(`${label}-alm-projects-table-narrow.png`) });
  await table.getByRole('button', { name: 'New app', exact: true }).click();
  await panel.getByRole('heading', { name: 'New app', exact: true }).waitFor();
  await panel.getByRole('heading', { name: 'Project goal', exact: true }).waitFor();
  assert.equal(destination(page).canvas.params.projectId, brief.id);
  assert.deepEqual(destination(page).target, { ...selected, projectId: null }, 'Global browsing opens a dedicated canvas without selecting a project or changing the connected org');
  await overview(page, 'ALM');
  assert.equal(await panel.getByRole('heading', { name: 'Project goal', exact: true }).count(), 0);
  await table.getByRole('button', { name: 'Another plan', exact: true }).click();
  await panel.getByRole('heading', { name: 'Another plan', exact: true }).waitFor();
  assert.equal(destination(page).canvas.params.projectId, projects[1].id);
  out.checks.push('ALM keeps project summaries in a scoped table; assessment and brief rows open dedicated canvases, preserve global/project scope and org, survive reload, and fit narrow layouts without inline plans');
  await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
  writeFileSync(outputPath(`${label}-project-surface-scope.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
