import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
try {
  for (const owner of ['jw', 'kf', 'am', 'sp']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: owner }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const orgId = owner === 'jw' ? null : 'uat';
    await page.goto(origin + destinationHref({ version: 1, owner, surface: null, target: { projectId: null, worktreeId: null, orgId } }));
    await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
    const panel = page.locator('#workspace-panel');
    const start = async () => {
      if (await panel.getAttribute('data-open') !== 'true') await page.locator('#workspace-panel-toggle').click();
      await panel.getByRole('button', { name: 'Start project', exact: true }).click();
      await page.getByRole('heading', { name: 'Start a project', exact: true }).waitFor();
    };
    await start();
    const name = `${owner} service app`;
    const create = page.getByRole('button', { name: 'Create project', exact: true });
    assert(await create.isDisabled());
    await page.getByLabel('Project name', { exact: true }).fill(name);
    await page.getByRole('radio', { name: /^React app/ }).check();
    await page.getByLabel('What should this project achieve?', { exact: true }).fill('Reduce manual handoffs for the service team.');
    await page.getByLabel('Context for the agent (optional)', { exact: true }).fill('Use existing sign-in. Start with one useful workflow.');
    await create.click();
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination') ?? '{}').target?.projectId?.startsWith('project-'));
    const project = fixture.state.snapshot.assessment.projects[0];
    assert.equal(project.name, name); assert.equal(project.projectType, 'react'); assert.equal(project.targetOrgId, orgId);
    await page.getByRole('heading', { name, exact: true }).waitFor();
    assert.equal(await panel.getAttribute('data-open'), 'true');
    await panel.getByRole('button', { name: `${name} Planning project`, exact: true }).waitFor();
    assert.equal(fixture.commands.filter(command => command.kind === 'project.createFromBrief').length, 1);
    await page.reload(); await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/');
    await panel.getByRole('button', { name: `${name} Planning project`, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    assert.equal(JSON.parse(new URL(page.url()).searchParams.get('destination')).target.projectId, project.id);
    await page.getByRole('link', { name: 'Global home', exact: true }).click(); await page.waitForURL(url => url.pathname === '/');
    await start();
    assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), '', 'The previous acknowledged brief was reset for another project');
    await page.getByLabel('Project name', { exact: true }).fill(`${name} two`);
    await page.getByLabel('What should this project achieve?', { exact: true }).fill('Try a second project in the same org.');
    await create.click();
    await page.getByRole('heading', { name: `${name} two`, exact: true }).waitFor();
    assert.equal(fixture.state.snapshot.assessment.projects.length, 2);
    out.checks.push(`${owner}: create, sidebar entry, reload, explicit reopen, retained intent, and second project${!orgId ? ' without an org' : ''}`);
    await page.screenshot({ path: outputPath(`${label}-created-${owner}.png`) });
    await context.close();
  }
  for (const scenario of ['delayed', 'retry']) {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'jw', beforeCommand: command => scenario === 'delayed' && command.kind === 'project.createFromBrief' ? gate : undefined }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const target = { projectId: null, worktreeId: null, orgId: null };
    await page.goto(origin + destinationHref({ version: 1, owner: 'jw', surface: 'alm', target, canvas: { kind: 'capability', title: 'Start a project', params: { scope: 'unbound', surface: 'alm', capability: 'project' } } }));
    await page.getByLabel('Project name', { exact: true }).fill('Recovery project');
    await page.getByLabel('What should this project achieve?', { exact: true }).fill('Keep the user in control.');
    const failCreate = route => route.request().method() === 'POST' && route.request().postDataJSON().command.kind === 'project.createFromBrief' ? route.abort('failed') : route.fallback();
    if (scenario === 'retry') await page.route('**/api/application*', failCreate);
    const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/api/application') && request.postDataJSON().command.kind === 'project.createFromBrief');
    await page.getByRole('button', { name: 'Create project', exact: true }).click(); await sent;
    if (scenario === 'delayed') {
      assert(await page.getByLabel('Project name', { exact: true }).isDisabled());
      await page.getByRole('link', { name: 'Global home', exact: true }).click(); await page.waitForURL(url => url.pathname === '/');
      const href = page.url();
      const acknowledged = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/application') && response.request().postDataJSON().command.kind === 'project.createFromBrief');
      const refreshed = page.waitForResponse(response => response.request().method() === 'GET' && response.url().includes('/api/application'));
      release(); await acknowledged; await refreshed;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(page.url(), href);
    } else {
      const retry = page.getByRole('tabpanel').getByRole('button', { name: 'Retry saving', exact: true }).filter({ visible: true });
      await retry.first().waitFor();
      const enabled = await retry.all(); const action = await Promise.all(enabled.map(button => button.isEnabled()));
      const index = action.findIndex(Boolean); assert(index >= 0, 'Recovery stays enabled while creation fields are frozen');
      await page.unroute('**/api/application*', failCreate); await enabled[index].click();
      await page.getByRole('tabpanel').locator('[data-persistence=saved]').first().waitFor();
    }
    assert.equal(fixture.state.snapshot.assessment.projects.length, 1);
    out.checks.push(`${scenario}: creation is saved once, recovery remains usable, and later navigation is preserved`);
    await context.close();
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-project-create-end-to-end.json`), JSON.stringify(out, null, 2));
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
