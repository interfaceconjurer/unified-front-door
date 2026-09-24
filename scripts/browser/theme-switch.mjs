import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, href } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
async function expectTheme(page, theme) {
  await page.waitForFunction(value => document.querySelector('[role="switch"][aria-label="Dark mode"]')?.getAttribute('aria-checked') === String(value === 'dark'), theme);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme);
  const mismatches = await page.evaluate(value => [...document.body.querySelectorAll('*')]
    .filter(element => element.tagName !== 'NEXTJS-PORTAL' && element.getClientRects().length && getComputedStyle(element).colorScheme !== value)
    .map(element => element.tagName + '.' + element.className + ': ' + getComputedStyle(element).colorScheme).slice(0, 5), theme);
  assert.deepEqual(mismatches, [], 'All shell, chat and canvas elements inherit the chosen appearance');
}
try {
  for (const system of ['light', 'dark']) {
    const context = await browser.newContext({ httpCredentials, colorScheme: system, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    await install(context, { drafts: 1, messages: 1 });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + href);
    const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
    await page.waitForFunction(value => document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === String(value === 'dark'), system);
    assert.equal(await page.getByRole('button', { name: 'Help', exact: true }).count(), 0);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Keep my work while changing themes');
    const opposite = system === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: opposite });
    await page.waitForFunction(value => document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === String(value === 'dark'), opposite);
    await toggle.click();
    await expectTheme(page, system);
    assert.equal(await name.inputValue(), 'Keep my work while changing themes');
    assert.equal(await page.evaluate(() => localStorage.getItem('ufd.appearance.v1')), system);
    await page.reload(); await expectTheme(page, system);
    await toggle.focus(); await page.keyboard.press('Space'); await expectTheme(page, opposite);
    await page.screenshot({ path: outputPath(`${label}-theme-switch-${opposite}.png`) });
    await page.getByRole('button', { name: 'Switch surface', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'ALM', exact: true }).click();
    await page.getByRole('tab', { name: 'ALM', exact: true }).waitFor();
    await expectTheme(page, opposite);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await toggle.isVisible(), 'The appearance switch remains available on narrow screens');
    await toggle.click(); await expectTheme(page, system);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    out.checks.push(`${system} system: follows OS until selected; click/keyboard switch changes the whole app, preserves work, survives reload/navigation and fits narrow screens`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); writeFileSync(outputPath(`${label}-theme-switch.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
