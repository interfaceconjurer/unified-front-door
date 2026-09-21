import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const target = page => JSON.parse(new URL(page.url()).searchParams.get('destination')).target;
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
async function home(page) {
  await page.getByRole('link', { name: 'Global home', exact: true }).click();
  // Retiring Today cards remain enabled-but-inert until they leave view.
  // Wait for the live briefing, rather than matching one still scrolling away.
  await page.getByRole('group', { name: 'Today', exact: true }).getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
}
async function surface(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
  await dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }).getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
  await tab(page, name).waitFor();
}
async function project(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  await dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }).getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
}
try {
  for (const motion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1600, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' });
    try {
      const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
      await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface: 'build', target: { projectId: null, worktreeId: null, orgId: 'uat' } })));
      await page.getByRole('heading', { name: 'Configure your org' }).waitFor();
      assert.equal(await tab(page, 'Lead routing assistant').count(), 0, 'Global Home does not inherit seeded project tabs');
      await page.getByRole('button', { name: /^Data & Objects/ }).click();
      await page.getByRole('button', { name: 'Open Account', exact: true }).click();
      await page.getByRole('article', { name: 'Account resource' }).waitFor();
      const globalTabs = await page.locator('#surface-panel [role="tab"]').allTextContents();

      await project(page, 'Trailblazer CRM');
      await surface(page, 'Build & Setup');
      assert.equal(await tab(page, 'Account · UAT Sandbox').count(), 0, 'Project does not inherit global resource tabs');
      await page.getByRole('button', { name: /^Access & Permissions/ }).click();
      await page.getByRole('button', { name: 'Open Sales Operations', exact: true }).click();
      await page.getByRole('article', { name: 'Sales Operations resource' }).waitFor();
      const projectTabs = await page.locator('#surface-panel [role="tab"]').allTextContents();
      await home(page); await surface(page, 'Build & Setup');
      await page.getByRole('article', { name: 'Account resource' }).waitFor();
      assert.deepEqual(await page.locator('#surface-panel [role="tab"]').allTextContents(), globalTabs);
      assert.equal(await tab(page, 'Sales Operations · UAT Sandbox').count(), 0);
      await page.reload(); await page.getByRole('article', { name: 'Account resource' }).waitFor();
      assert.deepEqual(await page.locator('#surface-panel [role="tab"]').allTextContents(), globalTabs);
      await project(page, 'Trailblazer CRM');
      await page.getByRole('article', { name: 'Sales Operations resource' }).waitFor();
      assert.deepEqual(await page.locator('#surface-panel [role="tab"]').allTextContents(), projectTabs);
      await surface(page, 'Code'); await surface(page, 'Build & Setup');
      await page.getByRole('article', { name: 'Sales Operations resource' }).waitFor();
      await project(page, 'feature/lead-routing'); await surface(page, 'Build & Setup');
      assert.equal(await tab(page, 'Sales Operations · UAT Sandbox').count(), 0, 'Another worktree has its own tab set');
      await page.getByRole('tab', { name: 'Lead routing assistant', exact: true }).click();
      const notes = page.getByRole('textbox', { name: 'Your notes', exact: true });
      await notes.fill('Keep this worktree draft');
      await home(page); await surface(page, 'Build & Setup');
      await page.getByRole('article', { name: 'Account resource' }).waitFor();
      assert.equal(await tab(page, 'Lead routing assistant').count(), 0);
      out.checks.push(`${motion}: Global, project and worktree tabs/active canvases restore independently across surfaces, Home and reload`);

      // Explicit global inspection creates a Home tab, without taking over the
      // project's view or changing the saved draft's captured ownership.
      await home(page);
      await page.getByRole('group', { name: 'Today', exact: true }).getByRole('button', { name: 'Resume Lead routing assistant', exact: true }).click();
      await page.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
      assert.equal(target(page).projectId, null);
      assert.equal(await notes.inputValue(), 'Keep this worktree draft');
      await notes.fill('Reviewed from Home');
      await page.waitForFunction(() => document.querySelector('[role="tabpanel"]')?.textContent.includes('Saved to database'));
      await page.getByRole('button', { name: 'Close Lead routing assistant', exact: true }).click();
      await tab(page, 'Lead routing assistant').waitFor({ state: 'detached' });
      await project(page, 'feature/lead-routing');
      await page.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
      assert.equal(await notes.inputValue(), 'Reviewed from Home');
      assert.equal(target(page).worktreeId, 'lead-routing');
      await home(page); await surface(page, 'Build & Setup');
      assert.equal(await tab(page, 'Lead routing assistant').count(), 0, 'Returning from the project cannot reopen a closed global tab');
      await page.reload(); await page.getByRole('article', { name: 'Account resource' }).waitFor();
      assert.equal(await tab(page, 'Lead routing assistant').count(), 0);
      out.checks.push(`${motion}: Explicit global project-file inspection retains shared draft ownership; closing Home tab leaves project tab open and stays closed after return/reload`);
      await page.screenshot({ path: outputPath(`${label}-workspace-tabs-${motion}.png`) });
    } finally { await context.close(); fixture.cleanup(); }
  }
  assert.deepEqual(out.errors, []);
} finally { writeFileSync(outputPath(`${label}-workspace-tabs.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out)); await browser.close(); }
