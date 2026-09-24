import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const target = { projectId: null, worktreeId: null, orgId: 'prod' };
const href = surface => origin + (surface ? '/alm' : '/') + '?destination=' + encodeURIComponent(JSON.stringify({
  version: 1, owner: 'sp', surface, target,
  ...(surface ? { canvas: { kind: 'capability', title: 'Start a project', params: { scope: 'unbound', orgId: 'prod', surface: 'alm', capability: 'project' } } } : {}),
}));
async function headingAppearance(page) {
  return page.getByRole('heading', { name: 'Start a project', exact: true }).evaluate(heading => {
    const header = heading.closest('header'), icon = header?.querySelector('svg');
    const style = getComputedStyle(heading);
    return { text: heading.textContent, fontSize: style.fontSize, fontWeight: style.fontWeight,
      lineHeight: style.lineHeight, icon: icon?.outerHTML, description: header?.querySelector('p')?.textContent };
  });
}
try {
  for (const motion of ['no-preference', 'reduce']) {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: motion === 'reduce' ? 'dark' : 'light', viewport: { width: 1440, height: 1000 } });
    const fixture = await installAssessment(context, { beforeCommand: command => command.kind === 'draft.begin' ? gate : undefined });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    try {
      await page.goto(href('alm'));
      await page.getByRole('heading', { name: 'Start a project', exact: true }).waitFor();
      const standardHeader = await headingAppearance(page);
      assert(standardHeader.icon, 'The ordinary project canvas has its main icon');
      await page.goto(href(null));
      const today = page.getByRole('group', { name: 'Today', exact: true });
      const opportunities = today.getByRole('checkbox', { name: /^Include / });
      await opportunities.first().waitFor();
      for (let index = 0; index < await opportunities.count(); index++) await opportunities.nth(index).setChecked(index === 0);
      const button = today.getByRole('button', { name: 'Shape a project', exact: true });
      await button.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Today"]').getAnimations({ subtree: true })
        .every(animation => animation.effect.getComputedTiming().iterations === Infinity || animation.playState === 'finished'));
      await opportunities.first().focus();
      await page.evaluate(() => {
        const today = document.querySelector('fieldset[aria-label="Today"]');
        const root = today.parentElement, cards = [...today.querySelectorAll('article[data-today-container]')];
        window.__shapeFrames = []; window.__shapeTracking = true;
        const sample = () => {
          window.__shapeFrames.push({ time: performance.now(), path: location.pathname,
            connected: today.isConnected, readOnly: root.hasAttribute('data-read-only'),
            draftVisible: !!today.querySelector('[aria-label="Project draft"]'),
            cards: cards.map(card => ({ connected: card.isConnected, top: card.getBoundingClientRect().top - today.getBoundingClientRect().top,
              opacity: Number(getComputedStyle(card).opacity), filter: getComputedStyle(card).filter })) });
          if (window.__shapeTracking) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const began = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/api/application') && request.postDataJSON().command.kind === 'draft.begin');
      await button.click(); await began;
      await page.waitForTimeout(250); // Sample the waiting state across multiple paints.
      assert.equal(new URL(page.url()).pathname, '/', 'Stay on Today until the draft is acknowledged');
      const waiting = await page.evaluate(() => window.__shapeFrames);
      assert(waiting.every(frame => !frame.draftVisible), 'Do not show a speculative resume card while project preparation is pending');
      assert(waiting.every(frame => frame.cards.every((card, index) => Math.abs(card.top - waiting[0].cards[index].top) < 1)),
        'Preparing the draft must not shift the opportunity cards');
      release();
      await page.waitForURL(url => url.pathname === '/alm');
      await page.getByRole('heading', { name: 'Start a project', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
      const frames = await page.evaluate(() => { window.__shapeTracking = false; return window.__shapeFrames; });
      writeFileSync(outputPath(`${label}-assessment-project-${motion}-frames.json`), JSON.stringify(frames, null, 2));
      const activeFrames = frames.filter(frame => !frame.readOnly);
      assert(activeFrames.length > 2, 'Observed the original Today during preparation and departure');
      assert(activeFrames.every(frame => frame.connected && frame.cards.every(card => card.connected && card.opacity > 0.99
        && (card.filter === 'none' || card.filter === 'blur(0px)'))), 'Opportunity cards must not replay their reveal when focus leaves or project preparation begins');
      assert.equal(fixture.commands.filter(command => command.kind === 'draft.begin').length, 1);
      assert.equal(fixture.state.snapshot.assessment.draft.findingIds.length, 1);
      assert.deepEqual(await headingAppearance(page), standardHeader, 'Assessment creation uses the same main title, icon and description as ordinary project creation');
      const source = page.getByRole('complementary', { name: 'Project source', exact: true });
      await source.waitFor();
      const titleBox = await page.getByRole('heading', { name: 'Start a project', exact: true }).boundingBox();
      assert((await source.boundingBox()).y > titleBox.y + titleBox.height, 'Assessment provenance follows the primary header');
      await page.screenshot({ path: outputPath(`${label}-assessment-project-${motion}.png`) });
      await page.getByRole('button', { name: 'Back to Today', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/');
      await page.getByRole('button', { name: 'Continue project draft', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Continue project draft', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/alm');
      assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), fixture.state.snapshot.assessment.draft.name);
      if (motion === 'reduce') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: outputPath(`${label}-assessment-project-narrow.png`) });
        assert(await page.getByRole('heading', { name: 'Start a project', exact: true }).isVisible());
        assert(await page.getByRole('button', { name: 'Back to Today', exact: true }).isVisible());
      }
      out.checks.push(`${motion}: one selected opportunity stays visible through acknowledged handoff; standard project header, secondary source context, and Back to Today preserve draft resumption`);
    } finally { release(); await context.close(); fixture.cleanup(); }
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-assessment-project-transition.json`), JSON.stringify(out, null, 2));
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
