import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const target = { projectId: null, worktreeId: null, orgId: 'uat' };
const actions = [
  ['Start a project', 'project'], ['Plan your work', 'work'], ['Set up a pipeline', 'pipeline'],
  ['Validate a change', 'validation'], ['Prepare a release', 'release'],
];
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));

async function checkOverview(page) {
  const panel = page.getByRole('tabpanel');
  await panel.getByRole('heading', { name: 'Move your next change forward.', exact: true }).waitFor();
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
  const starters = panel.getByRole('region', { name: 'Start planning', exact: true });
  for (const [title] of actions) assert(await starters.getByRole('button', { name: new RegExp('^' + title) }).isVisible(), `${title} is exposed without expanding a disclosure`);
  assert.equal(await starters.evaluate(node => !!node.closest('details')), false);
  assert.equal(await panel.getByText('Turn opportunities into progress.', { exact: true }).count(), 0);
  assert.equal(await panel.getByRole('button', { name: 'Return to org assessment', exact: true }).count(), 0);
  assert.deepEqual(destination(page).target, target);
}

try {
  for (const profileId of ['sp', 'kf', 'jw', 'am']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: profileId === 'sp' ? 'no-preference' : 'reduce',
      colorScheme: profileId === 'sp' ? 'light' : 'dark', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { profileId }); cleanups.push(fixture.cleanup);
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const href = surface => origin + (surface ? '/' + surface : '/') + '?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: profileId, surface, target }));
    // Sam enters ALM through Today so the assessment handoff stays on its source page.
    if (profileId === 'sp') {
      await page.goto(href(null));
      const today = page.getByRole('group', { name: 'Today', exact: true });
      await today.getByRole('button', { name: 'Shape a project', exact: true }).waitFor();
      await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
      await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Today"]')?.getAnimations({ subtree: true })
        .every(animation => animation.effect?.getTiming().iterations === Infinity || animation.playState === 'finished'));
      await today.getByRole('link', { name: 'ALM', exact: true }).click();
    } else await page.goto(href('alm'));
    await checkOverview(page);
    assert.equal(fixture.state.snapshot.assessment.projects.length, 0);
    await page.screenshot({ path: outputPath(`${label}-alm-overview-${profileId}.png`) });
    await page.reload();
    await checkOverview(page);
    assert.equal(fixture.stats.posts, 0, 'The overview does not create drafts');

    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep my planning notes.');
    for (const [title, capability] of actions) {
      await page.getByRole('region', { name: 'Start planning', exact: true }).getByRole('button', { name: new RegExp('^' + title) }).click();
      await page.getByRole('tabpanel').getByRole('heading', { name: title, exact: true }).waitFor();
      assert.deepEqual(destination(page).target, target);
      assert.equal(destination(page).canvas.kind, 'capability');
      assert.equal(destination(page).canvas.params.capability, capability);
      assert.equal(await composer.inputValue(), 'Keep my planning notes.');
      await page.getByRole('tab', { name: 'ALM', exact: true }).click();
      await checkOverview(page);
    }
    assert(fixture.commands.every(command => command.kind === 'visit'), 'Browsing ALM does not start assessments, create projects, or submit agent work');
    assert(fixture.stats.commands.every(command => command.kind === 'canvas.save'), 'Opening tools only initializes their normal canvas drafts');
    assert.equal(fixture.state.snapshot.assessment.projects.length, 0);
    out.checks.push(`${profileId}: full ALM actions exposed on entry/reload; all five canvases open with connection and composer intact, without submitting or creating work`);

    if (profileId === 'sp') {
      await page.setViewportSize({ width: 760, height: 1050 });
      await checkOverview(page);
      const starters = page.getByRole('region', { name: 'Start planning', exact: true });
      await starters.scrollIntoViewIfNeeded();
      assert(await starters.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Narrow launcher fits its container');
      await page.screenshot({ path: outputPath(`${label}-alm-overview-narrow.png`) });
      await page.getByRole('link', { name: 'Global home', exact: true }).click();
      await page.getByRole('group', { name: 'Today', exact: true }).getByRole('button', { name: 'Shape a project', exact: true }).waitFor();
      out.checks.push('Sam: Today retains assessment-to-project guidance; empty ALM is general-purpose and its visible tools fit a narrow layout');
    }
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup());
  writeFileSync(outputPath(`${label}-alm-overview.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
