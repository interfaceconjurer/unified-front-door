import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const target = { projectId: null, worktreeId: null, orgId: 'uat' };
const home = owner => origin + destinationHref({ version: 1, owner, surface: null, target });
const projectCanvas = owner => origin + destinationHref({ version: 1, owner, surface: 'alm', target,
  canvas: { kind: 'capability', title: 'Start a project', params: { scope: 'unbound', orgId: 'uat', surface: 'alm', capability: 'project' } } });
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
async function setup(options) {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const fixture = await installAssessment(context, options); cleanups.push(fixture.cleanup);
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  return { context, page, ...fixture };
}
try {
  const general = await setup({ profileId: 'jw' });
  await general.page.goto(home('jw'));
  await general.page.getByRole('group', { name: 'Today', exact: true }).waitFor();
  if (await general.page.locator('#workspace-panel').getAttribute('data-open') !== 'true') await general.page.locator('#workspace-panel-toggle').click();
  await general.page.getByRole('button', { name: 'Start project', exact: true }).click();
  await general.page.waitForURL(url => url.pathname === '/alm');
  assert.equal(destination(general.page).canvas.params.capability, 'project');
  assert.deepEqual(destination(general.page).target, target);
  await general.page.getByLabel('Project name', { exact: true }).fill('Account experience plan');
  await general.page.getByLabel('What should this project achieve?', { exact: true }).fill('Help account managers quickly find customers.');
  await general.page.getByRole('radio', { name: /^React app/ }).check();
  await general.page.getByText(/Describe your users, their main journey/).waitFor();
  await general.page.getByLabel('Context for the agent (optional)', { exact: true }).fill('Account managers; use existing sign-in. Success means fewer handoffs.');
  await general.page.getByRole('radio', { name: /^Agent / }).check();
  await general.page.getByText(/which actions require a person/).waitFor();
  assert.equal(await general.page.getByLabel('What should this project achieve?', { exact: true }).inputValue(), 'Help account managers quickly find customers.');
  await general.page.getByRole('radio', { name: /^React app/ }).check();
  await general.page.getByLabel('Repository URL (optional)', { exact: true }).fill('https://github.com/example/account-experience');
  await general.page.waitForResponse(response => response.request().method() === 'POST'
    && response.url().includes('/api/application')
    && response.request().postDataJSON().command.kind === 'canvas.save'
    && Object.values(response.request().postDataJSON().command.fields).includes('https://github.com/example/account-experience'));
  await general.page.getByRole('button', { name: 'Create project', exact: true }).waitFor();
  await general.page.getByRole('link', { name: 'Global home', exact: true }).click();
  await general.page.waitForURL(url => url.pathname === '/');
  await general.page.goto(projectCanvas('jw'));
  await general.page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'Account experience plan'));
  await general.page.reload();
  assert.equal(await general.page.getByLabel('Project name', { exact: true }).inputValue(), 'Account experience plan');
  assert(await general.page.getByRole('radio', { name: /^React app/ }).isChecked());
  assert.equal(await general.page.getByLabel('Context for the agent (optional)', { exact: true }).inputValue(), 'Account managers; use existing sign-in. Success means fewer handoffs.');
  await general.page.screenshot({ path: outputPath(`${label}-project-setup.png`) });
  assert.equal(general.state.snapshot.assessment.projects.length, 0);
  assert(general.stats.commands.every(command => command.kind === 'canvas.save'));
  out.checks.push('General starter opens scoped ALM project planning; acknowledged fields survive Home and reload without fabricating a project');
  await general.context.close();

  const assessment = await setup({ profileId: 'sp' });
  await assessment.page.goto(home('sp'));
  await assessment.page.getByRole('button', { name: 'Shape a project', exact: true }).click();
  await assessment.page.waitForURL(url => url.pathname === '/alm');
  assert(assessment.state.snapshot.assessment.draft, 'Draft must be acknowledged before the canvas opens');
  assert.equal(destination(assessment.page).canvas.params.capability, 'project');
  assert.deepEqual(destination(assessment.page).target, target);
  const draftId = assessment.state.snapshot.assessment.draft.id;
  await assessment.page.getByLabel('Project name', { exact: true }).fill('Captured opportunity plan');
  await assessment.page.getByRole('radio', { name: /^LWC & Apex/ }).check();
  await assessment.page.getByLabel('Context for the agent (optional)', { exact: true }).fill('Improve lead assignment for service teams; validate in UAT.');
  await assessment.page.getByRole('link', { name: 'Global home', exact: true }).click();
  await assessment.page.waitForURL(url => url.pathname === '/');
  await assessment.page.getByRole('button', { name: 'Continue project draft', exact: true }).click();
  await assessment.page.waitForURL(url => url.pathname === '/alm');
  assert.equal(assessment.state.snapshot.assessment.draft.id, draftId);
  assert.equal(await assessment.page.getByLabel('Project name', { exact: true }).inputValue(), 'Captured opportunity plan');
  const oldRun = assessment.run;
  assessment.state.snapshot.assessment.currentRunId = 'newer-assessment';
  assessment.state.snapshot.assessment.runs.push({ ...structuredClone(oldRun), id: 'newer-assessment', findings: [] });
  await assessment.page.reload();
  await assessment.page.getByRole('heading', { name: /Planned work items/ }).waitFor();
  assert.equal(assessment.state.snapshot.assessment.draft.runId, oldRun.id);
  await assessment.page.getByRole('button', { name: 'Create project', exact: true }).click();
  await assessment.page.waitForURL(url => JSON.parse(url.searchParams.get('destination') ?? '{}').target?.projectId?.startsWith('org-improvement-'));
  const created = assessment.state.snapshot.assessment.projects[0];
  assert.equal(created.runId, oldRun.id);
  assert.equal(created.name, 'Captured opportunity plan');
  assert.equal(created.projectType, 'lwc-apex');
  assert.equal(created.context, 'Improve lead assignment for service teams; validate in UAT.');
  assert.equal(assessment.state.snapshot.assessment.draft, null);
  assert.equal(assessment.commands.filter(command => command.kind === 'project.create').length, 1);
  assert.equal(assessment.commands.find(command => command.kind === 'project.create').commandId, `create:${draftId}`);
  await assessment.page.getByRole('heading', { name: created.name, exact: true }).waitFor();
  assert(assessment.state.agent.conversations.some(thread => JSON.parse(thread.threadKey)[1] === created.id));
  out.checks.push('Assessment draft is acknowledged before opening, survives Home, preserves source run after rescan, and creates one project with its own conversation');
  await assessment.context.close();

  for (const delayedKind of ['draft.begin', 'project.create']) {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const delayed = await setup({ profileId: 'sp', beforeCommand: command => command.kind === delayedKind ? gate : undefined });
    await delayed.page.goto(home('sp'));
    const began = delayed.page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/api/application') && request.postDataJSON().command.kind === 'draft.begin');
    await delayed.page.getByRole('button', { name: 'Shape a project', exact: true }).click();
    await began;
    if (delayedKind === 'draft.begin') {
      await delayed.page.getByRole('link', { name: 'Build & Setup', exact: true }).click();
      await delayed.page.waitForURL(url => url.pathname === '/build');
    } else {
      await delayed.page.waitForURL(url => url.pathname === '/alm');
      const creating = delayed.page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/api/application') && request.postDataJSON().command.kind === 'project.create');
      await delayed.page.getByRole('button', { name: 'Create project', exact: true }).click();
      await creating;
      assert(await delayed.page.getByLabel('Project name', { exact: true }).isDisabled(), 'Creation freezes its submitted fields until acknowledged');
      await delayed.page.getByRole('link', { name: 'Global home', exact: true }).click();
      await delayed.page.waitForURL(url => url.pathname === '/');
    }
    const expectedHref = delayed.page.url();
    const acknowledged = delayed.page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/application') && response.request().postDataJSON().command.kind === delayedKind);
    const refreshed = delayed.page.waitForResponse(response => response.request().method() === 'GET' && response.url().includes('/api/application'));
    release(); await acknowledged; await refreshed;
    await delayed.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(delayed.page.url(), expectedHref, 'A delayed acknowledgement must not override the newer navigation');
    if (delayedKind === 'draft.begin') assert(delayed.state.snapshot.assessment.draft);
    else assert.equal(delayed.state.snapshot.assessment.projects.length, 1);
    out.checks.push(`${delayedKind}: a delayed acknowledgement preserves the saved result without overriding newer navigation`);
    await delayed.context.close();
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-project-creation.json`), JSON.stringify(out, null, 2));
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
