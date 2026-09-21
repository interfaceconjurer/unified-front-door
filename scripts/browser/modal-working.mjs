import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';

const label = process.argv[2] ?? 'candidate';
const browser = await chromium.launch();
const out = { label, checks: [], errors: [] };
try {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'no-preference', viewport: { width: 1440, height: 1100 } });
    const { state } = await install(context);
    const establishedSession = { ...session, profileId: 'am' };
    state.snapshot.session = establishedSession;
    await context.route('**/api/session', route => route.fulfill({ json: { session: establishedSession } }));
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/build');
    const trigger = page.getByRole('button', { name: 'Search workspace', exact: true });
    const dialog = page.getByRole('dialog');
    for (const tab of ['Sessions']) {
        await trigger.click();
        await dialog.getByRole('tab', { name: tab, exact: true }).click();
        await page.waitForFunction(() => document.querySelector('dialog')?.getAnimations({ subtree: true }).some(animation => animation.effect?.getComputedTiming().iterations === Infinity));
        await page.waitForTimeout(550);
        const start = Date.now();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached', timeout: 5000 });
        assert(await trigger.evaluate(node => node === document.activeElement));
        out.checks.push({ tab, closeMs: Date.now() - start, result: 'Active working StatusDot pulse does not block normal-motion Escape or trigger focus restoration' });
    }
    await context.close();
} catch (error) {
    out.errors.push(error.stack);
} finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-modal-working.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length) process.exitCode = 1;
}
