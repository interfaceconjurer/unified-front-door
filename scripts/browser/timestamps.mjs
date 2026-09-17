import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';

const label = process.argv[2] ?? 'candidate';
const browser = await chromium.launch();
const out = { label, checks: [], errors: [] };
const summaries = [
    'Refactoring OpportunityTriggerHandler — 3 files touched; last update at 2026-09-14 14:56 UTC.',
    'Fix for W-9821 is ready for review; last activity at 2026-09-14 14:35 UTC.',
];
try {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1100 } });
    const { state } = await install(context);
    const establishedSession = { ...session, profileId: 'am' };
    state.snapshot.session = establishedSession;
    await context.route('**/api/session', route => route.fulfill({ json: { session: establishedSession } }));
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/govern');
    await page.getByRole('heading', { name: 'Keep your workspace in view.', exact: true }).waitFor();
    const toggle = page.getByRole('button', { name: 'Toggle workspace panel', exact: true });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    const workspace = page.getByRole('complementary', { name: 'Workspace', exact: true });
    for (const summary of summaries) await workspace.getByText(summary, { exact: true }).waitFor();
    out.checks.push('Workspace session summaries display fixed scenario UTC times');

    await page.getByRole('button', { name: 'Go to a surface', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Sessions', exact: true }).click();
    for (const summary of summaries) await dialog.getByRole('option').filter({ hasText: summary }).waitFor();
    out.checks.push('Palette session summaries display the same fixed scenario UTC times');
    await dialog.getByRole('tab', { name: 'Orgs', exact: true }).click();
    const scratch = dialog.getByRole('option').filter({ hasText: 'scratch · lead-routing' });
    assert((await scratch.innerText()).includes('At capture: 5 days remaining'));
    assert(!(await dialog.innerText()).includes('5d left'));
    out.checks.push('Palette labels relative scratch-org expiry as captured data');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    const environments = page.getByRole('region', { name: 'Connected environments', exact: true });
    const connected = environments.getByRole('button').filter({ hasText: 'scratch · lead-routing' });
    assert((await connected.innerText()).includes('At capture: 5 days remaining'));
    const expired = environments.getByRole('button').filter({ hasText: 'scratch · hotfix-9821' });
    assert((await expired.innerText()).includes('Expired'));
    assert(!/last 4 min|activity in 25 min|Expires in 5 days|5d left/.test(await page.locator('body').innerText()));
    out.checks.push('Govern environments label captured expiry and retain terminal Expired state');
    await context.close();
} catch (error) {
    out.errors.push(error.stack);
} finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-timestamps.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length) process.exitCode = 1;
}
