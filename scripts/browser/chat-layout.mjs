import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition') &&
  ![...document.querySelectorAll('[data-workspace-motion]')].some(node => node.getAnimations().some(animation => animation.playState === 'running')));
const geometry = page => page.evaluate(() => {
  const transcript = document.querySelector('[aria-label="Conversation"]');
  const thread = transcript.querySelector('[data-workspace-motion]');
  const composer = document.querySelector('#agent-composer');
  const dock = composer.closest('form').parentElement;
  const bounds = node => ({ left: node.getBoundingClientRect().left, width: node.getBoundingClientRect().width });
  return { thread: bounds(thread), dock: bounds(dock), transcript: { ...bounds(transcript), width: transcript.clientWidth }, agent: bounds(dock.parentElement) };
});
async function checkLayout(page, centered) {
  await settle(page);
  const g = await geometry(page);
  for (const [content, parent] of [[g.thread, g.transcript], [g.dock, g.agent]]) {
    assert(Math.abs(content.width - Math.min(1200, parent.width)) < 1, JSON.stringify(g));
    const expectedLeft = parent.left + (centered ? Math.max(0, (parent.width - 1200) / 2) : 0);
    assert(Math.abs(content.left - expectedLeft) < 1, JSON.stringify({ centered, g }));
  }
}
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 2 });
    state.agent.conversations[0].conversation.scopeKey = 'home';
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.waitFor();
    await checkLayout(page, true);
    await composer.fill('Keep this draft and selection while panels move.');
    await composer.evaluate(node => { window.__originalComposer = node; node.setSelectionRange(5, 15); });
    await page.evaluate(() => {
      window.__alignmentMotion = [];
      const capture = () => {
        const nodes = [...document.querySelectorAll('[data-workspace-motion]')];
        for (const node of nodes) for (const animation of node.getAnimations()) {
          if (['margin-inline-start', 'margin-left'].includes(animation.transitionProperty)) {
            window.__alignmentMotion.push({ composer: node.contains(window.__originalComposer), thread: node.parentElement?.getAttribute('aria-label') === 'Conversation' });
          }
        }
        requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
    });
    await page.keyboard.press('Control+b');
    await checkLayout(page, false);
    const animations = await page.evaluate(() => window.__alignmentMotion);
    if (motion === 'no-preference') {
      assert(animations.some(frame => frame.thread), 'Transcript alignment must animate');
      assert(animations.some(frame => frame.composer), 'Composer alignment must animate');
    } else assert.deepEqual(animations, [], 'Reduced motion skips alignment animation');
    assert(await composer.evaluate(node => node === window.__originalComposer && node === document.activeElement && node.selectionStart === 5 && node.selectionEnd === 15));
    await page.keyboard.press('Control+b');
    await checkLayout(page, true);
    out.checks.push(`${motion}: 1200px centered chat; workspace panel left-aligns both columns; shared motion and retained composer focus/selection`);

    // At this width even the 40% chat pane exceeds the cap, exposing incorrect
    // centering when the surface is the only open panel.
    await page.setViewportSize({ width: 3200, height: 1000 });
    await page.keyboard.press('Control+Shift+b');
    await page.waitForURL('**/build?**');
    await checkLayout(page, false);
    await page.keyboard.press('Control+b');
    await checkLayout(page, false);
    await page.keyboard.press('Control+Shift+b');
    await checkLayout(page, false);
    await page.keyboard.press('Control+b');
    await checkLayout(page, true);
    assert.equal(await composer.inputValue(), 'Keep this draft and selection while panels move.');
    out.checks.push(`${motion}: surface-only and both-panel layouts stay left-aligned; hiding both re-centers`);

    await page.setViewportSize({ width: 390, height: 844 });
    await checkLayout(page, true);
    await page.keyboard.press('Control+b');
    await checkLayout(page, false);
    assert(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), 'Mobile must not overflow horizontally');
    await page.keyboard.press('Control+b');
    await page.setViewportSize({ width: 1600, height: 1000 });
    await checkLayout(page, true);
    await page.keyboard.press('Control+b');
    await checkLayout(page, false);
    await page.screenshot({ path: outputPath(`${label}-chat-layout-${motion}.png`) });
    out.checks.push(`${motion}: narrow viewport fits; reopening panels preserves draft and layout`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close();
  writeFileSync(outputPath(`${label}-chat-layout.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (out.errors.length) process.exitCode = 1;
}
