import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules();
const { INITIAL } = modules.load('lib/assessment/state-codec');
const { applyAssessmentCommand } = modules.load('lib/application/assessment-commands');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1100 } });
const fixture = await installAssessment(context);
const { state, commands } = fixture;
state.snapshot.assessment = structuredClone(INITIAL);
const page = await context.newPage();
page.on('pageerror', error => out.errors.push(error.message));
const destination = () => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const today = () => page.getByRole('group', { name: 'Today', exact: true });
const home = async () => {
  await page.getByRole('link', { name: 'Global home', exact: true }).click();
  await today().waitFor();
};
const mutations = () => commands.filter(command => command.kind.startsWith('assessment.'));
async function selectOrg(name, id) {
  await page.getByRole('button', { name: /^Switch org, current org:/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }).getByRole('button').click();
  await page.waitForURL(url => JSON.parse(url.searchParams.get('destination') ?? '{}').target?.orgId === id);
  await today().waitFor();
}
async function selectProject(name, id) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  await dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }).getByRole('button').click();
  await page.waitForURL(url => JSON.parse(url.searchParams.get('destination') ?? '{}').target?.projectId === id);
}
async function complete() {
  for (let i = 0; i < 5; i++) state.snapshot.assessment = applyAssessmentCommand(state.snapshot.assessment,
    { kind: 'assessment.advance', commandId: randomUUID(), expectedRevision: state.snapshot.assessmentRevision }, { id: randomUUID, now: new Date().toISOString(), owner: 'Sam Patel' });
  state.agent.runs.at(-1).status = 'completed'; state.agent.runs.at(-1).sequence++;
  await page.reload();
  await today().getByRole('button', { name: 'Run again', exact: true }).waitFor();
}
try {
  await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: null, target: { projectId: null, worktreeId: null, orgId: 'prod' } })));
  await page.locator('[data-run-status="running"]').waitFor({ state: 'attached' });
  assert.deepEqual(state.snapshot.assessment.scopeOrgIds, ['prod']);
  assert.equal(mutations().filter(c => c.kind === 'assessment.start').length, 1);
  assert.equal(mutations()[0].orgId, 'prod');
  const firstRun = state.snapshot.assessment.currentRunId;
  await selectOrg('UAT Sandbox', 'uat');
  assert(await today().getByRole('button', { name: 'Run assessment', exact: true }).isDisabled());
  assert.equal(state.snapshot.assessment.currentRunId, firstRun);
  assert.deepEqual(state.snapshot.assessment.scopeOrgIds, ['prod']);
  await selectOrg('Acme Production', 'prod');
  await complete();
  assert.equal(await today().getByRole('checkbox', { name: /^Include / }).count(), 4);
  const production = structuredClone(state.snapshot.assessment.runs[0]);
  out.checks.push('First assessment starts automatically for the selected org only; switching connections leaves its worker scope intact');

  const projects = [];
  for (const [name, target, title] of [
    ['API project', 'sit', 'Give your integrations more API headroom'],
    ['Routing project', '', 'Keep new leads moving to the right team'],
  ]) {
    const choices = today().getByRole('checkbox', { name: /^Include / });
    for (let index = 0; index < await choices.count(); index++) await choices.nth(index).setChecked(await choices.nth(index).getAttribute('aria-label') === `Include ${title}`);
    await today().getByRole('button', { name: 'Shape a project', exact: true }).click();
    await page.getByRole('heading', { name: 'Start a project', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Deployment target (optional)', { exact: true }).inputValue(), '');
    await page.getByLabel('Project name', { exact: true }).fill(name);
    if (target) await page.getByLabel('Deployment target (optional)', { exact: true }).selectOption(target);
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    assert.equal(destination().target.orgId, 'prod');
    const project = state.snapshot.assessment.projects.at(-1); projects.push(project);
    assert.equal(project.targetOrgId, target || null);
    assert.equal(project.workItems.length, 1);
    assert(project.workItems[0].finding.evidence.length);
    await home();
    assert.equal(await today().getByRole('heading', { name: title, exact: true }).count(), 0, 'Allocated opportunity no longer appears on Today');
    assert.equal(await today().getByRole('checkbox', { name: /^Include / }).count(), 4 - projects.length);
  }
  await selectOrg('UAT Sandbox', 'uat');
  const before = mutations().length;
  await today().getByRole('button', { name: 'Run assessment', exact: true }).waitFor();
  assert.equal(await today().getByRole('checkbox', { name: /^Include / }).count(), 0);
  await page.reload();
  await today().getByRole('button', { name: 'Run assessment', exact: true }).waitFor();
  assert.equal(mutations().length, before, 'An unassessed org does not start automatically, including on reload');
  for (const project of projects) {
    await selectProject(project.name, project.id);
    await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
    assert.equal(destination().target.orgId, 'uat', 'Project switching keeps the connection despite its target or earlier destination');
    await page.reload();
    await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
    assert.equal(destination().target.orgId, 'uat');
  }
  await home();
  out.checks.push('Project creation supports an optional deployment destination; project switching and reload retain the selected connection; assigned opportunities leave Today');

  await today().getByRole('button', { name: 'Run assessment', exact: true }).click();
  await page.locator('[data-run-status="running"]').waitFor({ state: 'attached' });
  assert.deepEqual(state.snapshot.assessment.scopeOrgIds, ['uat']);
  await complete();
  const uat = state.snapshot.assessment.runs.at(-1);
  assert(uat.findings.length && uat.findings.every(f => f.orgId === 'uat'));
  assert.deepEqual(state.snapshot.assessment.runs[0], production);
  await selectOrg('Acme Production', 'prod');
  await today().getByRole('button', { name: 'Run again', exact: true }).waitFor();
  await today().getByRole('checkbox', { name: /^Include / }).first().waitFor();
  assert.deepEqual((await today().getByRole('checkbox', { name: /^Include / }).evaluateAll(choices => choices.map(choice => choice.getAttribute('aria-label')))).sort(), [
    'Include Give service representatives the access they need', 'Include Make room before data storage gets tight',
  ].sort());
  assert.equal(state.snapshot.assessment.runs.length, 2);
  await selectOrg('SIT Sandbox', 'sit');
  await today().getByRole('button', { name: 'Run assessment', exact: true }).waitFor();
  await today().getByRole('button', { name: 'Run assessment', exact: true }).click();
  await page.locator('[data-run-status="running"]').waitFor({ state: 'attached' });
  await complete();
  await today().getByRole('heading', { name: 'No findings in this demo scope', exact: true }).waitFor();
  await selectOrg('UAT Sandbox', 'uat');
  await today().getByRole('checkbox', { name: /^Include / }).first().waitFor();
  assert.equal(await today().getByRole('checkbox', { name: /^Include / }).count(), uat.findings.length);
  await page.screenshot({ path: outputPath(`${label}-org-assessment-scope.png`) });
  out.checks.push('Each subsequent org has an explicit assessment action; switching back restores that org’s findings, including completed empty runs and allocated-card removal');
  assert.deepEqual(out.errors, []);
} catch (error) { out.errors.push(error.stack); await page.screenshot({ path: outputPath(`${label}-scope-failure.png`) }); writeFileSync(outputPath(`${label}-scope-failure.txt`), await page.locator("body").innerText()); }
finally {
  await browser.close(); fixture.cleanup(); modules.cleanup();
  writeFileSync(outputPath(`${label}-org-assessment-scope.json`), JSON.stringify(out, null, 2));
}
console.log(JSON.stringify(out, null, 2));
if (out.errors.length) process.exitCode = 1;
