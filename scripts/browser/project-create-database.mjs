process.env.AGENT_PROVIDER = 'demo';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { testModules } from '../test-modules.mjs';
if (!process.env.DATABASE_TEST_URL) throw new Error('An explicitly authorized development/test database is required.');
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? '';
const modules = testModules(), { transaction, databasePool } = modules.load('lib/db');
const { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
const label = process.argv[2] ?? 'candidate', out = { checks: [], errors: [], cleanup: false };
let namespace, confirmed = false;
const headers = { Origin: origin, 'x-ufd-mutation': '1' };
async function sessionPost(data) {
  const response = await context.request.post(origin + '/api/session', { headers, data });
  assert.equal(response.status(), 200); return (await response.json()).session;
}
try {
  const initial = await sessionPost({ action: 'bootstrap' }); namespace = initial.namespaceId;
  assert.equal((await transaction(db => db.query('SELECT id FROM demo_namespaces WHERE id=$1', [namespace]))).rowCount, 1);
  confirmed = true;
  await sessionPost({ action: 'select', profileId: 'jw', generation: initial.generation, commandId: randomUUID() });
  const page = await context.newPage(); page.on('pageerror', e => out.errors.push(e.message));
  // This check exercises creation and navigation only; never submits provider work.
  await page.route('**/api/agent*', route => route.request().method() === 'POST' && route.request().postDataJSON().command.kind !== 'visit' ? route.abort() : route.continue());
  await page.goto(origin + destinationHref({ version: 1, owner: 'jw', surface: null, target: { projectId: null, worktreeId: null, orgId: null } }));
  await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
  const panel = page.locator('#workspace-panel');
  if (await panel.getAttribute('data-open') !== 'true') await page.locator('#workspace-panel-toggle').click();
  await panel.getByRole('button', { name: 'Start project', exact: true }).click();
  const name = 'Creation acceptance ' + randomUUID().slice(0, 8);
  await page.getByLabel('Project name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: /^React app/ }).check();
  await page.getByLabel('What should this project achieve?', { exact: true }).fill('Verify creation, persistence, and sidebar entry.');
  await page.getByLabel('Context for the agent (optional)', { exact: true }).fill('Synthetic acceptance data.');
  await page.getByRole('button', { name: 'Create project', exact: true }).click({ timeout: 45000 });
  await page.getByRole('heading', { name, exact: true }).waitFor({ timeout: 45000 });
  const id = JSON.parse(new URL(page.url()).searchParams.get('destination')).target.projectId;
  const row = await transaction(async db => (await db.query("SELECT record FROM improvement_projects WHERE namespace_id=$1 AND profile_id='jw' AND id=$2", [namespace, id])).rows[0]);
  assert.equal(row.record.projectType, 'react'); assert.equal(row.record.context, 'Synthetic acceptance data.'); assert.equal(row.record.runId, null);
  await panel.getByRole('button', { name: `${name} Planning project`, exact: true }).waitFor();
  await page.reload(); await page.getByRole('heading', { name, exact: true }).waitFor({ timeout: 45000 });
  await page.getByRole('link', { name: 'Global home', exact: true }).click(); await page.waitForURL(url => url.pathname === '/');
  await panel.getByRole('button', { name: `${name} Planning project`, exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  out.checks.push('Real database acknowledgement creates a project; sidebar entry, intent, reload, and explicit reopening work without provider calls');
  assert.deepEqual(out.errors, []);
} finally {
  await context.close(); await browser.close();
  if (confirmed) await transaction(async db => {
    await db.query('DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)', [namespace]);
    await db.query('DELETE FROM demo_sessions WHERE namespace_id=$1', [namespace]);
    await db.query('DELETE FROM workspaces WHERE namespace_id=$1', [namespace]);
    await db.query('DELETE FROM demo_namespaces WHERE id=$1', [namespace]);
    out.cleanup = true;
  });
  await databasePool().end(); modules.cleanup();
  writeFileSync(outputPath(`${label}-project-create-database.json`), JSON.stringify(out, null, 2));
}
console.log(JSON.stringify(out, null, 2));
