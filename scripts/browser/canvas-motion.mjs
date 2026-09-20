import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, href } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    await install(context, { drafts: 4, messages: 6 });
    await context.addInitScript(() => {
      window.__canvasMotion = [];
      const seen = new WeakSet();
      const capture = () => {
        for (const animation of document.getAnimations()) {
          if (!animation.animationName || !animation.effect?.pseudoElement || seen.has(animation)) continue;
          seen.add(animation);
          window.__canvasMotion.push({ name: animation.animationName, pseudo: animation.effect.pseudoElement });
        }
        requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
    });
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + href);
    await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    const tabs = page.getByRole('tablist', { name: 'Build & Setup canvases' });
    const tab = name => tabs.getByRole('tab', { name, exact: true });
    const selected = name => page.waitForFunction(name => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim() === name, name);
    await composer.fill('Keep this draft while switching canvases');
    await settle(page);
    await composer.evaluate(node => { window.__composer = node; window.__composerBounds = node.getBoundingClientRect().toJSON(); });
    await tabs.evaluate(node => { window.__tabs = node; window.__tabBounds = node.getBoundingClientRect().toJSON(); });
    await page.evaluate(() => { window.__canvasMotion = []; });
    await tab('data-model').click();
    await selected('data-model');
    if (motion === 'no-preference') {
      await page.waitForFunction(() => window.__canvasMotion.some(frame => frame.name === 'surface-land'));
      const animations = await page.evaluate(() => window.__canvasMotion);
      out.animations = animations;
      assert(animations.some(frame => frame.name === 'surface-recede' && frame.pseudo.includes('canvas-content')));
      assert(animations.some(frame => frame.name === 'surface-land' && frame.pseudo.includes('canvas-content')));
      assert(animations.every(frame => frame.pseudo.includes('canvas-content')), 'Only the canvas body participates');
    }
    await settle(page);
    if (motion === 'reduce') assert.deepEqual(await page.evaluate(() => window.__canvasMotion), []);
    assert(await composer.evaluate(node => node === window.__composer && JSON.stringify(node.getBoundingClientRect().toJSON()) === JSON.stringify(window.__composerBounds)));
    assert(await tabs.evaluate(node => node === window.__tabs && JSON.stringify(node.getBoundingClientRect().toJSON()) === JSON.stringify(window.__tabBounds)));
    out.checks.push(`${motion}: canvas-only recede/land; stable tabs and composer; reduced motion respected`);

    await page.evaluate(() => { window.__canvasMotion = []; });
    await tab('data-model').click();
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => window.__canvasMotion), [], 'Active tab must not replay motion');
    await tab('data-model').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await selected('experience');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'experience');
    await page.keyboard.press('Home');
    await selected('Build & Setup');
    await page.keyboard.press('End');
    await selected('experience');
    // Close while an incoming canvas can still be animating.
    await page.keyboard.press('Delete');
    await tab('experience').waitFor({ state: 'detached' });
    await selected('agent');
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'agent');
    assert(await page.getByRole('tabpanel').evaluate(node => !node.inert && getComputedStyle(node).filter === 'none'));
    await tab('Build an automation').click();
    await selected('Build an automation');
    await settle(page);
    await page.goBack();
    await selected('agent');
    await settle(page);
    assert.equal(await composer.inputValue(), 'Keep this draft while switching canvases');
    out.checks.push(`${motion}: active-tab no-op, rapid arrow selection, Home/End, close during motion, Back, retained draft`);
    await context.close();
  }
} catch (error) {
  out.errors.push(error.stack);
} finally {
  await browser.close();
  writeFileSync(outputPath(`${label}-canvas-motion.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (out.errors.length) process.exitCode = 1;
}
