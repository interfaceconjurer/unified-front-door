import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules(), { updateConversation } = modules.load('lib/chat/conversation');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1440, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 1 });
    const saved = state.agent.conversations[0]; saved.conversation.scopeKey = 'home';
    let release, hold = false, failOnce = false, reads = 0;
    await context.route('**/api/agent*', async route => {
      if (route.request().method() === 'GET') { reads++; return route.fulfill({ json: state.agent }); }
      const command = route.request().postDataJSON().command;
      assert.equal(command.kind, 'visit', 'Navigation must not invoke paid work');
      if (hold) await new Promise(resolve => { release = resolve; });
      if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: { code: 'unavailable', message: 'Temporary test interruption' } } }); }
      if (command.context.surface !== 'home') {
        saved.conversation = updateConversation(saved.conversation, { type: 'surface', scopeKey: command.context.surface,
          label: command.context.surface, reply: `Ready in ${command.context.surface}` }); saved.revision++;
      }
      return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
    });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/');
    const agent = page.getByRole('region', { name: 'Agent', exact: true });
    const activity = agent.locator('header').first().getByRole('status');
    await page.getByRole('article', { name: 'Today briefing' }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"] header [role="status"]')?.textContent === '');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep this draft while navigation waits');
    hold = true; const readsBefore = reads;
    await page.getByRole('navigation', { name: 'Explore surfaces', exact: true }).getByRole('link', { name: 'Build & Setup', exact: true }).click();
    await activity.getByText('Updating conversation…', { exact: true }).waitFor();
    const indicator = await activity.evaluate(node => {
      const heading = node.parentElement.querySelector('h1').getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      const badge = node.nextElementSibling.getBoundingClientRect();
      const spinner = node.querySelector('[aria-hidden="true"]');
      return { gap: bounds.left - heading.right, right: bounds.right, badgeLeft: badge.left,
        spinnerWidth: spinner.getBoundingClientRect().width, animation: getComputedStyle(spinner).animationName };
    });
    assert(indicator.gap >= 0 && indicator.gap <= 16, 'Activity belongs immediately after Agent');
    assert(indicator.right <= indicator.badgeLeft && indicator.spinnerWidth >= 12, JSON.stringify(indicator));
    assert.equal(indicator.animation === 'none', motion === 'reduce', 'Spinner respects reduced motion');
    assert.equal(await composer.inputValue(), 'Keep this draft while navigation waits');
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"] header [role="status"]')?.textContent.includes('Still updating'), null, { timeout: 8000 });
    await page.screenshot({ path: outputPath(`${label}-chat-waiting-${motion}.png`) });
    if (motion === 'reduce') {
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await activity.evaluate(node => {
        const bounds = node.getBoundingClientRect(), badge = node.nextElementSibling.getBoundingClientRect();
        return bounds.right <= badge.left && badge.right <= innerWidth && node.querySelector('[aria-hidden="true"]').getBoundingClientRect().width >= 12;
      }), 'Narrow headers keep the spinner and scope badge visible without overlap');
      await page.screenshot({ path: outputPath(`${label}-chat-waiting-mobile.png`) });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    assert.equal(reads, readsBefore, 'A pending visit should not compete with redundant full-history polling');
    hold = false; release();
    if (motion === 'no-preference') {
      await page.waitForFunction(() => {
        const agent = document.querySelector('[aria-label="Agent"]');
        const entry = agent?.querySelector('[data-kind="agent"]:last-child');
        return agent?.dataset.motion === 'scrolling' && entry && !entry.hasAttribute('data-pending') && Number(getComputedStyle(entry).opacity) > .05;
      });
      out.checks.push('Incoming content becomes visible during scrolling instead of waiting until the scroll finishes');
    }
    await page.getByText('Ready in build', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    assert.equal(await activity.innerText(), '');
    assert.equal(await composer.inputValue(), 'Keep this draft while navigation waits');
    out.checks.push(`${motion}: immediate waiting feedback, longer-wait message, inline history, preserved draft, cleared status`);

    if (motion === 'reduce') {
      failOnce = true;
      await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
      await dialog.getByRole('option').filter({ has: page.getByText('Code', { exact: true }) }).getByRole('button').click();
      await activity.getByText('Reconnecting…', { exact: true }).waitFor();
      await page.getByText('Ready in code', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[aria-label="Agent"] header [role="status"]')?.textContent === '');
      assert.equal(await composer.inputValue(), 'Keep this draft while navigation waits');
      out.checks.push('A transient failure shows Reconnecting and recovers the same navigation automatically');
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); modules.cleanup();
  writeFileSync(outputPath(`${label}-chat-latency.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
