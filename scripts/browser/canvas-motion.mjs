import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, href } from './fixtures.mjs';
import { openOverview } from './workbench-helpers.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const settle = page => page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    await install(context, { drafts: 7, messages: 6 });
    await context.addInitScript(() => {
      window.__canvasMotion = [];
      window.__canvasEffects = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        if (this.matches('[role="tabpanel"]')) window.__canvasEffects.push(args[0]);
        return animate.apply(this, args);
      };
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
    // One workbench strip spans plugins; legacy per-surface tabs arrive in plugin order.
    const tabs = page.getByRole('tablist', { name: 'Open views' });
    const tab = name => tabs.getByRole('tab', { name, exact: true });
    const selected = name => page.waitForFunction(name => document.querySelector('[role="tablist"][aria-label="Open views"] [role="tab"][aria-selected="true"]')?.textContent.trim() === name, name);
    assert.deepEqual(await tabs.getByRole('tab').allInnerTexts(), ['Build an automation', 'data-model', 'agent', 'experience', 'sfdx-project', 'react-app', 'apex'],
      'Saved per-surface tabs restore into one workbench in plugin order');
    await composer.fill('Keep this draft while switching canvases');
    await settle(page);
    await composer.evaluate(node => { window.__composer = node; window.__composerBounds = node.getBoundingClientRect().toJSON(); });
    await tabs.evaluate(node => { window.__tabs = node; window.__tabBounds = node.getBoundingClientRect().toJSON(); });
    await page.evaluate(() => { window.__canvasMotion = []; });
    await tab('data-model').click();
    await selected('data-model');
    await settle(page);
    assert.deepEqual(await page.evaluate(() => window.__canvasMotion), [], 'Switching tabs must not animate the canvas or the surrounding UI');
    assert(await composer.evaluate(node => node === window.__composer && JSON.stringify(node.getBoundingClientRect().toJSON()) === JSON.stringify(window.__composerBounds)));
    assert(await tabs.evaluate(node => node === window.__tabs && JSON.stringify(node.getBoundingClientRect().toJSON()) === JSON.stringify(window.__tabBounds)));
    out.checks.push(`${motion}: instant canvas selection; stable tabs and composer`);

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
    await selected('Build an automation');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await selected('experience');
    await settle(page);
    await page.getByRole('tabpanel').evaluate(panel => {
      const label = panel.getAttribute('aria-labelledby');
      window.__closeFrames = [];
      const capture = () => {
        if (!panel.isConnected || panel.getAttribute('aria-labelledby') !== label) return;
        window.__closeFrames.push({ opacity: Number(getComputedStyle(panel).opacity), inert: panel.inert });
        requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
    });
    // Closing must keep content sharp until the replacement commits, with no
    // exit delay, opacity drop or temporary inert state.
    await page.keyboard.press('Delete');
    await tab('experience').waitFor({ state: 'detached' });
    // The neighbor that slid into the closed view's slot is selected, even when
    // it belongs to another plugin.
    await selected('sfdx-project');
    await settle(page);
    await tab('agent').click();
    await selected('agent');
    await settle(page);
    assert(await page.evaluate(() => window.__closeFrames.every(frame => frame.opacity === 1 && !frame.inert)), 'Closing must not fade or disable the old canvas');
    assert.deepEqual(await page.evaluate(() => window.__canvasEffects), [], 'Closing must not schedule an exit animation');
    await page.evaluate(() => { window.__canvasMotion = []; });
    await tab('agent').focus();
    assert(await page.getByRole('tabpanel').evaluate(node => !node.inert && getComputedStyle(node).filter === 'none'));
    await tab('Build an automation').click();
    await selected('Build an automation');
    await settle(page);
    assert.deepEqual(await page.evaluate(() => window.__canvasMotion), [], 'Same-plugin keyboard selection and closing are immediate');
    await page.goBack();
    await selected('agent');
    await settle(page);
    assert.equal(await composer.inputValue(), 'Keep this draft while switching canvases');
    out.checks.push(`${motion}: active-tab no-op, rapid arrows, instant same-plugin close, focus, Back, retained draft`);

    await tab('Build an automation').click();
    await selected('Build an automation');
    // Close immediately after selection, then select overview during another close.
    await page.keyboard.press('Delete');
    await tab('Build an automation').waitFor({ state: 'detached' });
    await selected('data-model'); await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'data-model');
    assert(await page.getByRole('tabpanel').evaluate(node => !node.inert && getComputedStyle(node).filter === 'none' && getComputedStyle(node).opacity === '1'));
    await page.keyboard.press('Delete');
    await tab('agent').click();
    await tab('data-model').waitFor({ state: 'detached' });
    await selected('agent'); await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'agent');
    assert(await page.getByRole('tabpanel').evaluate(node => !node.inert && getComputedStyle(node).filter === 'none' && getComputedStyle(node).opacity === '1'));
    assert.equal(await composer.inputValue(), 'Keep this draft while switching canvases');
    assert.deepEqual(await page.evaluate(() => window.__canvasMotion), []);
    assert.deepEqual(await page.evaluate(() => window.__canvasEffects), []);
    out.checks.push(`${motion}: rapid close and selection keep the latest tab, focus and composer without animations`);

    await tab('apex').click();
    await selected('apex');
    await settle(page);
    const surfaceAnimations = await page.evaluate(() => window.__canvasMotion);
    if (motion === 'no-preference') {
      assert(surfaceAnimations.some(frame => frame.name === 'surface-recede' && frame.pseudo.includes('surface-canvas')), 'Changing plugin still recedes');
      assert(surfaceAnimations.some(frame => frame.name === 'surface-land' && frame.pseudo.includes('surface-canvas')), 'Changing plugin still lands');
      assert(!surfaceAnimations.some(frame => frame.pseudo.includes('agent-conversation')), 'The continuous chat stays sharp');
    } else assert.deepEqual(surfaceAnimations, []);
    out.checks.push(`${motion}: switching to another plugin's view retains the whole-view transition and respects reduced motion`);
    await openOverview(page, 'Code'); await selected('Code overview'); await settle(page);
    await page.evaluate(() => { window.__canvasMotion = []; });
    for (const name of ['react-app', 'sfdx-project', 'Code overview']) {
      await tab(name).click();
      await selected(name); await settle(page);
      assert.deepEqual(await page.evaluate(() => window.__canvasMotion), [], 'Code views and the Code overview switch without a transition');
    }
    assert.equal(await composer.inputValue(), 'Keep this draft while switching canvases');
    out.checks.push(`${motion}: Code views and the Code overview view change instantly and keep the chat draft`);
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
