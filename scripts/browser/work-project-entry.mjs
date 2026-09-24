import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const { RETURNING_WORK } = modules.load('lib/workspace/returning-work');
const { PROJECTS } = modules.load('lib/workspace/fixtures');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
try {
  for (const [id, motion] of [['lead-routing-release', 'no-preference'], ['storefront-release', 'reduce']]) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId: 'am' }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const work = RETURNING_WORK.find(work => work.id === id), project = PROJECTS.find(project => project.id === work.projectId);
    const tree = project.worktrees.find(tree => tree.id === work.worktreeId);
    const captured = { projectId: project.id, worktreeId: tree.id, orgId: project.defaultOrgId };
    const global = { projectId: null, worktreeId: null, orgId: 'prod' };
    // Leave a different remembered destination in this worktree. Explicit entry
    // from a work canvas must open that work, not restore this old overview.
    await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'alm', target: captured }));
    await page.getByRole('tabpanel').waitFor();
    await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: null, target: global }));
    await page.getByRole('group', { name: 'Today', exact: true }).getByRole('button', { name: `Review ${work.title}`, exact: true }).click();
    const panel = page.getByRole('tabpanel');
    await panel.getByRole('heading', { name: work.title, exact: true }).waitFor();
    assert.deepEqual(destination(page).target, global);
    assert.deepEqual(destination(page).canvasTarget, captured);
    const contextRow = panel.getByRole('region', { name: 'Work context', exact: true });
    assert.deepEqual(await contextRow.locator('dl > div').evaluateAll(rows => rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])), [
      ['Project', project.name], ['Worktree', tree.label], ['Branch', tree.branch],
    ]);
    assert.equal(await panel.locator('header > p').first().innerText(), 'Release plan');
    assert.equal(await panel.locator('header > p').first().locator('svg').count(), 0, 'Item type must not carry a branch icon');
    const buttonName = tree.isPrimary ? `Open project ${project.name}` : `Open worktree ${tree.label} in ${project.name}`;
    const entry = contextRow.getByRole('button', { name: buttonName, exact: true });
    await entry.waitFor();
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    await page.screenshot({ path: outputPath(`${label}-${id}-work-context.png`) });
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    assert(await contextRow.evaluate(row => row.scrollWidth <= row.clientWidth + 1), 'Context and CTA fit the narrow canvas');
    await page.screenshot({ path: outputPath(`${label}-${id}-work-context-narrow.png`) });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const notes = panel.getByRole('textbox', { name: 'Your notes', exact: true });
    const note = `Review ${id} before entering its project`;
    await notes.fill(note);
    const globalThread = fixture.state.agent.conversations.find(saved => JSON.parse(saved.threadKey)[0] === 'unbound-session');
    const before = structuredClone(globalThread.conversation);
    await entry.focus(); await entry.press('Enter');
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.projectId === project.id);
    await panel.getByRole('heading', { name: work.title, exact: true }).waitFor();
    assert.deepEqual(destination(page).target, { ...captured, orgId: global.orgId });
    assert.equal(destination(page).canvas.params.workId, id);
    assert.deepEqual(destination(page).canvasTarget, captured);
    assert.equal(await entry.count(), 0, 'Project views do not embed project/worktree switching');
    assert.equal(await notes.inputValue(), note);
    assert.deepEqual(globalThread.conversation, before, 'Project entry leaves the global conversation intact');
    out.checks.push(`${id}: labeled type/project/worktree/branch and responsive explicit entry retain the exact canvas, target and draft; global browsing stays global until entry`);

    await page.goBack();
    await entry.waitFor();
    assert.deepEqual(destination(page).target, global);
    assert.deepEqual(destination(page).canvasTarget, captured);
    assert.equal(await notes.inputValue(), note);
    await page.goForward();
    await page.waitForURL(url => JSON.parse(url.searchParams.get('destination')).target.projectId === project.id);
    await page.reload();
    await panel.getByRole('heading', { name: work.title, exact: true }).waitFor();
    assert.deepEqual(destination(page).target, { ...captured, orgId: global.orgId });
    assert.equal(destination(page).canvas.params.workId, id);
    assert.equal(await notes.inputValue(), note);
    assert.equal(await entry.count(), 0);
    assert(fixture.commands.every(command => command.kind === 'visit'), 'Entry must not approve changes or invoke model work');
    out.checks.push(`${id}: browser Back restores global canvas/org, Forward and reload restore entered worktree and notes (${motion})`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
  writeFileSync(outputPath(`${label}-work-project-entry.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
