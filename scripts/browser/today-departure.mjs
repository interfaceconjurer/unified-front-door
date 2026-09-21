import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
async function prepare(motion, profileId = 'am') {
  const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
  const fixture = await installAssessment(context, { profileId });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: profileId, surface: null, target: { projectId: null, worktreeId: null, orgId: 'uat' } })));
  await page.locator('fieldset[aria-label="Today"]').waitFor();
  const link = page.locator('fieldset[aria-label="Today"]').getByRole('link', { name: 'Build & Setup', exact: true });
  await link.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Today"]').getAnimations({ subtree: true }).every(animation => animation.effect.getComputedTiming().iterations === Infinity || animation.playState === 'finished'));
  return { context, fixture, page, link };
}
async function track(page, interrupt = false) {
  await page.evaluate(interrupt => {
    const card = document.querySelector('fieldset[aria-label="Today"]').parentElement;
    const log = card.closest('[role="log"]');
    window.__departureCard = card; window.__departureFrames = []; window.__departureInterrupted = false;
    function frame() {
      const rect = card.getBoundingClientRect(), viewport = log.getBoundingClientRect();
      const contentBottom = rect.bottom - parseFloat(getComputedStyle(card.querySelector('fieldset')).paddingBottom);
      const readOnly = card.hasAttribute('data-read-only'), retiring = card.hasAttribute('data-retiring');
      const button = card.querySelector('button');
      const rowsVisible = [...card.querySelectorAll('[data-today-row]')].every(row => getComputedStyle(row).opacity === '1' && getComputedStyle(row).filter === 'none');
      window.__departureFrames.push({ readOnly, retiring, rowsVisible, contentBottom, top: rect.top, scrollTop: log.scrollTop, time: performance.now(), viewportTop: viewport.top, viewportBottom: viewport.bottom, filter: getComputedStyle(card).filter, opacity: getComputedStyle(card).opacity, background: button && getComputedStyle(button).backgroundColor });
      const scroll = log.getAnimations().find(animation => animation.id === 'conversation-scroll');
      if (interrupt && scroll && !window.__departureInterrupted) {
        scroll.pause(); window.__departureInterrupted = true;
        log.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
      }
      if (!readOnly) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, interrupt);
}
try {
  const focusCase = await prepare('no-preference');
  try {
    await focusCase.link.focus();
    await focusCase.page.getByRole('textbox', { name: 'Message the agent', exact: true }).focus();
    const row = await focusCase.link.evaluate(async link => {
      await new Promise(requestAnimationFrame);
      const style = getComputedStyle(link.closest('[data-today-row]'));
      return { opacity: style.opacity, filter: style.filter };
    });
    assert.deepEqual(row, { opacity: '1', filter: 'none' }, 'Leaving a focused Today surface link must not restart its reveal');
    out.checks.push('Moving focus away from Today surface links keeps their revealed appearance');
  } finally { await focusCase.context.close(); focusCase.fixture.cleanup(); }
  for (const motion of ['no-preference', 'reduce']) for (const profileId of ['am', 'sp', 'kf']) {
    const { context, fixture, page, link } = await prepare(motion, profileId);
    try {
      await track(page); await link.click();
      await page.waitForFunction(() => window.__departureFrames.some(frame => frame.readOnly));
      const frames = await page.evaluate(() => window.__departureFrames);
      writeFileSync(outputPath(`${label}-today-departure-${motion}-${profileId}-frames.json`), JSON.stringify(frames, null, 2));
      const deactivated = frames.find(frame => frame.readOnly);
      assert(deactivated.contentBottom <= deactivated.viewportTop + 1 || deactivated.top >= deactivated.viewportBottom, JSON.stringify(deactivated));
      if (motion === 'no-preference') {
        assert(frames.filter(frame => !frame.readOnly).every(frame => frame.rowsVisible), 'Today rows stay sharp from click through layout and scrolling');
        const visible = frames.filter(frame => frame.retiring && frame.contentBottom > frame.viewportTop && frame.top < frame.viewportBottom);
        assert(visible.length > 2, 'Observe the active-looking Today during its outgoing scroll');
        assert(visible.every(frame => frame.filter === 'none' && frame.opacity === '1'), JSON.stringify(visible));
        assert(visible.every(frame => frame.rowsVisible), 'Outgoing rows stay visible instead of replaying their entrance animation');
        assert.equal(new Set(visible.map(frame => frame.background)).size, 1, 'Card backgrounds stay unchanged until offscreen');
      }
      await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
      await page.evaluate(() => {
        const card = window.__departureCard, log = card.closest('[role="log"]');
        log.scrollTop += card.getBoundingClientRect().top - log.getBoundingClientRect().top;
      });
      assert(await page.evaluate(() => {
        const card = window.__departureCard;
        return card.hasAttribute('data-read-only') && !card.inert && card.querySelector('fieldset').disabled
          && !card.querySelector('button:enabled, a[href]') && getComputedStyle(card).opacity === '0.78'
          && card.querySelectorAll('[data-today-container]').length > 0
          && [...card.querySelectorAll('[data-today-container]')].every(container => getComputedStyle(container).backgroundColor === 'rgba(0, 0, 0, 0.03)');
      }));
      if (motion === 'no-preference') await page.screenshot({ path: outputPath(`${label}-today-history-${profileId}.png`) });
      await page.reload();
      await page.getByRole('group', { name: 'Earlier Today (read only)', exact: true }).waitFor();
      assert.equal(await page.locator('[data-retiring]').count(), 0, 'Reloaded history never replays departure');
      out.checks.push(`${motion}/${profileId}: Today keeps its appearance until offscreen; returning history has faint containers and disabled, readable content; reload does not replay`);
    } finally { await context.close(); fixture.cleanup(); }
  }
  const { context, fixture, page, link } = await prepare('no-preference');
  try {
    await track(page, true); await link.click();
    await page.waitForFunction(() => window.__departureInterrupted && document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    const waiting = await page.evaluate(() => {
      const card = window.__departureCard, rect = card.getBoundingClientRect(), viewport = card.closest('[role="log"]').getBoundingClientRect();
      return { retiring: card.hasAttribute('data-retiring'), readOnly: card.hasAttribute('data-read-only'), inert: card.inert, bottom: rect.bottom, viewportTop: viewport.top, opacity: getComputedStyle(card).opacity };
    });
    assert(waiting.retiring && !waiting.readOnly && waiting.inert && waiting.bottom > waiting.viewportTop && waiting.opacity === '1', JSON.stringify(waiting));
    await page.screenshot({ path: outputPath(`${label}-today-departure-interrupted.png`) });
    await page.evaluate(() => { const log = window.__departureCard.closest('[role="log"]'); log.scrollTop = log.scrollHeight; });
    await page.waitForFunction(() => window.__departureCard.hasAttribute('data-read-only'));
    out.checks.push('Interrupted scroll keeps Today visually active and prevents stale clicks until manual scrolling moves it out of view');
  } finally { await context.close(); fixture.cleanup(); }
  assert.deepEqual(out.errors, []);
} finally { writeFileSync(outputPath(`${label}-today-departure.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out)); await browser.close(); }
