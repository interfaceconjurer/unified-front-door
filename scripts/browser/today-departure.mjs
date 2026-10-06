import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { openTodayOverview } from './workbench-helpers.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
async function prepare(motion, profileId = 'am') {
  const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
  const fixture = await installAssessment(context, { profileId });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: profileId, surface: null, target: { projectId: null, worktreeId: null, orgId: 'uat' } })));
  await page.locator('fieldset[aria-label="Today"]').waitFor();
  const trigger = page.locator('fieldset[aria-label="Today"]').getByRole('button', { name: 'Build & Setup', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Today"]').getAnimations({ subtree: true }).every(animation => animation.effect.getComputedTiming().iterations === Infinity || animation.playState === 'finished'));
  return { context, fixture, page, trigger };
}
async function track(page, interrupt = false) {
  await page.evaluate(interrupt => {
    const card = document.querySelector('fieldset[aria-label="Today"]').parentElement;
    const log = card.closest('[role="log"]');
    window.__departureCard = card; window.__departureFrames = []; window.__departureInterrupted = false; window.__departureDone = false;
    // Sample after the animation frame is painted, including scroll anchoring
    // and ResizeObserver layout corrections from the same frame.
    const schedule = () => requestAnimationFrame(() => setTimeout(frame, 0));
    function frame() {
      const rect = card.getBoundingClientRect(), viewport = log.getBoundingClientRect();
      const split = document.querySelector('#workbench').parentElement.getBoundingClientRect();
      const chatWidth = log.closest('[data-chat-only]').getBoundingClientRect().width;
      const contentBottom = rect.bottom - parseFloat(getComputedStyle(card.querySelector('fieldset')).paddingBottom);
      const readOnly = card.hasAttribute('data-read-only'), retiring = card.hasAttribute('data-retiring');
      const button = card.querySelector('button');
      const rowsVisible = [...card.querySelectorAll('[data-today-row]')].every(row => getComputedStyle(row).opacity === '1' && getComputedStyle(row).filter === 'none');
      window.__departureFrames.push({ readOnly, retiring, rowsVisible, contentBottom, top: rect.top, scrollTop: log.scrollTop, chatWidth, splitWidth: split.width, time: performance.now(), viewportTop: viewport.top, viewportBottom: viewport.bottom, filter: getComputedStyle(card).filter, opacity: getComputedStyle(card).opacity, background: button && getComputedStyle(button).backgroundColor });
      const scroll = log.getAnimations().find(animation => animation.id === 'conversation-scroll');
      if (interrupt && scroll && !window.__departureInterrupted) {
        scroll.pause(); window.__departureInterrupted = true;
        log.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
      }
      if (!readOnly || chatWidth > split.width * 0.41 || document.querySelector('[aria-label="Agent"]')?.dataset.motion !== 'idle') schedule();
      else window.__departureDone = true;
    }
    schedule();
  }, interrupt);
}
try {
  const focusCase = await prepare('no-preference');
  try {
    await focusCase.trigger.focus();
    await focusCase.page.getByRole('textbox', { name: 'Message the agent', exact: true }).focus();
    const row = await focusCase.trigger.evaluate(async trigger => {
      await new Promise(requestAnimationFrame);
      const style = getComputedStyle(trigger.closest('[data-today-row]'));
      return { opacity: style.opacity, filter: style.filter };
    });
    assert.deepEqual(row, { opacity: '1', filter: 'none' }, 'Leaving a focused Today capability trigger must not restart its reveal');
    out.checks.push('Moving focus away from Today capability triggers keeps their revealed appearance');
  } finally { await focusCase.context.close(); focusCase.fixture.cleanup(); }
  for (const motion of ['no-preference', 'reduce']) for (const profileId of ['am', 'sp', 'kf']) {
    const { context, fixture, page } = await prepare(motion, profileId);
    try {
      await track(page); await openTodayOverview(page, 'Build & Setup');
      await page.waitForFunction(() => window.__departureDone);
      const frames = await page.evaluate(() => window.__departureFrames);
      writeFileSync(outputPath(`${label}-today-departure-${motion}-${profileId}-frames.json`), JSON.stringify(frames, null, 2));
      const deactivated = frames.find(frame => frame.readOnly);
      assert(deactivated.contentBottom <= deactivated.viewportTop + 1 || deactivated.top >= deactivated.viewportBottom, JSON.stringify(deactivated));
      if (motion === 'no-preference') {
        assert(frames.filter(frame => !frame.readOnly).every(frame => frame.rowsVisible), 'Today rows stay sharp from click through layout and scrolling');
        const visible = frames.filter(frame => frame.retiring && frame.contentBottom > frame.viewportTop && frame.top < frame.viewportBottom);
        assert(visible.length > 2, 'Observe the active-looking Today during its outgoing scroll');
        assert(visible.every(frame => frame.chatWidth >= frame.splitWidth - 1), 'Keep the chat at full width until Today has scrolled out');
        assert(frames.filter(frame => frame.chatWidth < frame.splitWidth - 1).every(frame => frame.contentBottom <= frame.viewportTop + 1), 'Today must not reappear while the panel opens');
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
  const paletteCase = await prepare('no-preference');
  try {
    const toggle = paletteCase.page.getByRole('button', { name: 'Workbench', exact: true });
    await toggle.click(); await toggle.click();
    await paletteCase.page.waitForFunction(() => ![...document.querySelectorAll('[data-workspace-motion]')].some(node => node.getAnimations().some(animation => animation.playState === 'running')));
    await paletteCase.page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    const dialog = paletteCase.page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill('Build an automation');
    await track(paletteCase.page);
    await paletteCase.page.keyboard.press('Enter');
    await paletteCase.page.waitForFunction(() => window.__departureDone);
    const frames = await paletteCase.page.evaluate(() => window.__departureFrames);
    assert(frames.some(frame => frame.retiring && frame.contentBottom > frame.viewportTop), 'Observe Today departing for a capability selection');
    assert(frames.filter(frame => frame.retiring && frame.contentBottom > frame.viewportTop).every(frame => frame.chatWidth >= frame.splitWidth - 1), 'Capability selection scrolls Today out at full width');
    assert(frames.filter(frame => frame.chatWidth < frame.splitWidth - 1).every(frame => frame.contentBottom <= frame.viewportTop + 1), 'Capability selection keeps Today out while the panel opens');
    await paletteCase.page.locator('#workbench [data-capability="Build an automation"]').waitFor();
    out.checks.push('Selecting a capability from Today scrolls first, then opens its workbench view without showing Today again');
  } finally { await paletteCase.context.close(); paletteCase.fixture.cleanup(); }
  const { context, fixture, page } = await prepare('no-preference');
  try {
    await track(page, true); await openTodayOverview(page, 'Build & Setup');
    await page.waitForFunction(() => window.__departureInterrupted && document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    const waiting = await page.evaluate(() => {
      const card = window.__departureCard, rect = card.getBoundingClientRect(), viewport = card.closest('[role="log"]').getBoundingClientRect();
      return { retiring: card.hasAttribute('data-retiring'), readOnly: card.hasAttribute('data-read-only'), inert: card.inert, bottom: rect.bottom, viewportTop: viewport.top, opacity: getComputedStyle(card).opacity };
    });
    assert(waiting.retiring && !waiting.readOnly && waiting.inert && waiting.bottom > waiting.viewportTop && waiting.opacity === '1', JSON.stringify(waiting));
    await page.waitForFunction(() => document.querySelector('#workbench')?.getAttribute('aria-hidden') === 'false');
    await page.screenshot({ path: outputPath(`${label}-today-departure-interrupted.png`) });
    await page.evaluate(() => { const log = window.__departureCard.closest('[role="log"]'); log.scrollTop = log.scrollHeight; });
    await page.waitForFunction(() => window.__departureCard.hasAttribute('data-read-only'));
    out.checks.push('Interrupted scroll keeps Today visually active and prevents stale clicks until manual scrolling moves it out of view');
  } finally { await context.close(); fixture.cleanup(); }
  assert.deepEqual(out.errors, []);
} finally { writeFileSync(outputPath(`${label}-today-departure.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out)); await browser.close(); }
