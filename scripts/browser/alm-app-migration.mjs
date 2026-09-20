import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const { canvasId } = modules.load('lib/surface-canvas/model');
const { emptyState } = modules.load('lib/surface-canvas/persistence');
const { RETURNING_WORK, workCanvasInput } = modules.load('lib/workspace/returning-work');
const { PROJECTS } = modules.load('lib/workspace/fixtures');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }; let fixture;
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
try {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  fixture = await installAssessment(context, { profileId: 'am' });
  const work = RETURNING_WORK.find(work => work.id === 'storefront-app'), input = workCanvasInput(work), id = canvasId(input.kind, input.params);
  const target = { projectId: 'acme-storefront', worktreeId: 'main', orgId: 'prod' };
  // The server read migration is covered by the database suite; this exercises legacy local preferences + URLs.
  fixture.state.snapshot.canvases = [{ id, surface: 'alm', canvas: input, target, fields: { notes: 'Saved before apps moved to ALM' }, revision: 3 }];
  const prefs = emptyState();
  prefs.build = { ...prefs.build, canvases: [{ ...input, id }], activeCanvasId: id, targets: { [id]: target } };
  const session = fixture.state.snapshot.session;
  await context.addInitScript(({ key, prefs }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(prefs)); },
    { key: `ufd.canvas-preferences.v2.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`, prefs });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  const oldDestination = { version: 1, owner: 'am', surface: 'build', target, canvas: input };
  await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify(oldDestination)));
  await page.waitForURL(url => url.pathname === '/alm');
  await page.getByRole('heading', { name: work.title, exact: true }).waitFor();
  assert.equal(destination(page).canvas.params.workId, work.id); assert.deepEqual(destination(page).target, target);
  const notes = page.getByLabel('Your notes', { exact: true });
  assert.equal(await notes.inputValue(), 'Saved before apps moved to ALM');
  await notes.fill('Continued in ALM');
  await page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/application')
    && response.request().postDataJSON().command.fields?.notes === 'Continued in ALM');
  assert.equal(fixture.stats.commands.at(-1).surface, 'alm');
  await page.reload(); assert.equal(await notes.inputValue(), 'Continued in ALM');
  await page.getByRole('button', { name: `Close ${work.title}`, exact: true }).click();
  await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify(oldDestination)));
  await page.waitForURL(url => url.pathname === '/alm');
  assert.equal(await notes.inputValue(), 'Continued in ALM');
  out.checks.push('Legacy Build work URL and saved tab become ALM, retaining target, ID, notes, reload, and close/reopen');

  await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'build', target }));
  await page.getByRole('heading', { name: 'Keep your ideas moving.', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Deployed apps', exact: true }).count(), 0);
  await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'alm', target }));
  await page.getByRole('heading', { name: 'Deployed apps', exact: true }).waitFor();
  const release = RETURNING_WORK.find(work => work.id === 'storefront-release');
  await page.getByRole('button', { name: `Open release progress for ${release.title}`, exact: true }).click();
  await page.getByRole('heading', { name: release.title, exact: true }).waitFor();
  assert.equal(destination(page).canvas.params.workId, release.id);
  out.checks.push('Build keeps builders; ALM shows deployed apps and release progress selects the actual release plan');

  const project = PROJECTS.find(project => project.id === target.projectId), app = project.apps[0];
  const appTarget = { ...target, worktreeId: null };
  const oldApp = { version: 1, owner: 'am', surface: 'build', target: appTarget, canvas: { kind: 'app', title: app.label, params: { projectId: project.id, appId: app.id } } };
  await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify(oldApp)));
  await page.waitForURL(url => url.pathname === '/alm');
  await page.getByText(`Deployed app · ${project.name}`, { exact: true }).waitFor();
  assert.equal(destination(page).canvas.kind, 'app'); assert.deepEqual(destination(page).target, appTarget);
  await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'alm', target: { projectId: 'trailblazer-crm', worktreeId: 'main', orgId: 'uat' } }));
  await page.getByRole('heading', { name: 'Move your next change forward.', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Acme Storefront', exact: true }).count(), 0);
  out.checks.push('Legacy deployed-app link opens ALM and Acme tabs stay hidden in Trailblazer');
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-alm-app-migration.json`), JSON.stringify(out, null, 2));
  await browser.close(); fixture?.cleanup(); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
