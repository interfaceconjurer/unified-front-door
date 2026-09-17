import { chromium } from 'playwright';
import { origin, outputPath, httpCredentials } from './config.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { install, href } from './fixtures.mjs';
const label = process.argv[2] || 'candidate';
const browser = await chromium.launch({ headless: true }), out = { label, origin, checks: [], expectedErrors: [], errors: [], chunks: [] };
const context = async () => browser.newContext({ viewport: { width: 1440, height: 1100 }, httpCredentials, reducedMotion: 'reduce' });
const remember = async (page) => { const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true }); await composer.fill('Composer survives a failed feature'); await composer.evaluate(n => { n.setSelectionRange(4, 13); window.__preservedComposer = n; }); return composer; };
const verify = async (composer) => { assert.equal(await composer.inputValue(), 'Composer survives a failed feature'); assert(await composer.evaluate(n => n === window.__preservedComposer), 'composer DOM node changed'); assert.deepEqual(await composer.evaluate(n => [n.selectionStart, n.selectionEnd]), [4, 13]); };
try {
    // A held real lazy chunk exercises the actual production loading boundary.
    {
        const c = await context();
        await install(c);
        const page = await c.newPage();
        let release;
        const held = new Promise(r => release = r);
        let intercepted = false;
        await page.route('**/_next/static/**/*.js', async (route) => { const response = await route.fetch(); const body = await response.text(); if (!intercepted && body.includes('Assign a copy to project')) {
            intercepted = true;
            out.chunks.push({ kind: 'held', url: route.request().url() });
            await held;
        } await route.fulfill({ response, body }); });
        try {
            await page.goto(origin + href, { waitUntil: 'domcontentloaded' });
            await page.getByRole('status').filter({ hasText: 'Loading view' }).waitFor({ timeout: 20000 });
            const composer = await remember(page);
            release();
            await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
            await verify(composer);
            out.checks.push('held production canvas chunk shows local loading; composer stays mounted and editable');
        }
        finally {
            release();
            await c.close();
        }
    }
    // A failed chunk must be requested again on Retry, not cached forever by lazy/import.
    {
        const c = await context();
        await install(c);
        const page = await c.newPage();
        let failures = 0, failChunk = true;
        page.on('pageerror', e => out.expectedErrors.push(e.message));
        await page.route('**/_next/static/**/*.js', async (route) => { const response = await route.fetch(); const body = await response.text(); if (failChunk && body.includes('Assign a copy to project')) {
            failures++;
            out.chunks.push({ kind: 'aborted', url: route.request().url() });
            await route.abort('failed');
            return;
        } await route.fulfill({ response, body }); });
        try {
            await page.goto(origin + href, { waitUntil: 'domcontentloaded' });
            await page.getByRole('alert', { name: 'Canvas unavailable' }).waitFor({ timeout: 20000 });
            const composer = await remember(page);
            failChunk = false;
            await page.getByRole('button', { name: 'Retry canvas', exact: true }).click();
            await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor({ timeout: 20000 });
            await verify(composer);
            assert.ok(failures >= 1);
            out.checks.push('failed production canvas chunk recovers on Retry without remounting composer');
        }
        finally {
            await c.close();
        }
    }
    // Inject only a named render failure through a test-controlled standard method patch.
    {
        const c = await context();
        const { state } = await install(c, { latency: 5000 });
        const page = await c.newPage();
        page.on('pageerror', e => out.expectedErrors.push(e.message));
        try {
            await page.goto(origin + href);
            const input = page.getByRole('textbox', { name: 'Name', exact: true });
            await input.waitFor();
            const composer = await remember(page);
            await page.evaluate(() => { const trim = String.prototype.trim; window.__injectCanvasFault = true; String.prototype.trim = function () { if (window.__injectCanvasFault && String(this).startsWith('P6_RENDER_FAULT'))
                throw Error('P6 controlled canvas render failure'); return trim.call(this); }; });
            await input.fill('P6_RENDER_FAULT_draft');
            await page.getByRole('alert', { name: 'Canvas unavailable' }).waitFor();
            await verify(composer);
            assert(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('ufd.pending.') && localStorage.getItem(k)?.includes('P6_RENDER_FAULT_draft'))), 'pending edit not recoverable during failure');
            await page.evaluate(() => window.__injectCanvasFault = false);
            await page.getByRole('button', { name: 'Retry canvas', exact: true }).click();
            await input.waitFor();
            assert.equal(await input.inputValue(), 'P6_RENDER_FAULT_draft');
            await verify(composer);
            await page.waitForFunction(() => !Object.keys(localStorage).some(k => k.startsWith('ufd.pending.v1.') && k !== 'ufd.pending.v1.instance'), null, { timeout: 20000 });
            assert.equal(state.snapshot.canvases[0].fields.name, 'P6_RENDER_FAULT_draft');
            out.checks.push('canvas render error preserves pending buffered field, Retry restores it, server ACK follows, composer node/text/selection retained');
            await page.evaluate(() => window.__injectCanvasFault = true);
            await input.fill('P6_RENDER_FAULT_second');
            await page.getByRole('alert', { name: 'Canvas unavailable' }).waitFor();
            await page.evaluate(() => window.__injectCanvasFault = false);
            await page.getByRole('tab', { name: 'Build & Setup', exact: true }).click();
            await page.getByRole('alert', { name: 'Canvas unavailable' }).waitFor({ state: 'detached' });
            await page.getByRole('tab', { name: 'Build an automation', exact: true }).click();
            await input.waitFor();
            assert.equal(await input.inputValue(), 'P6_RENDER_FAULT_second');
            await verify(composer);
            await page.waitForTimeout(5500);
            out.checks.push('navigation escapes failed canvas and reopening keeps the draft');
        }
        finally {
            await c.close();
        }
    }
    // Corrupt only the mocked historical view; real parent/child boundary handles projection failure.
    {
        const c = await context();
        const { state } = await install(c);
        const page = await c.newPage();
        page.on('pageerror', e => out.expectedErrors.push(e.message));
        try {
            await page.goto(origin + href);
            await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
            const composer = await remember(page);
            const message = state.agent.conversations[0].conversation.messages[0], snapshot = structuredClone(message.snapshot);
            message.snapshot = null;
            await page.getByRole('alert', { name: 'Conversation unavailable' }).waitFor({ timeout: 10000 });
            await verify(composer);
            await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Canvas remains usable');
            message.snapshot = snapshot;
            await page.waitForTimeout(1300);
            await page.getByRole('button', { name: 'Retry conversation', exact: true }).click();
            await page.getByRole('article', { name: 'Today briefing' }).first().waitFor();
            await verify(composer);
            out.checks.push('transcript projection failure stays local; canvas/composer remain usable; Retry keeps composer node/text/selection');
        }
        finally {
            await c.close();
        }
    }
    for (const error of out.expectedErrors) {
        if (!/chunk|P6 controlled canvas render failure|capturedAt/i.test(error))
            out.errors.push('Unexpected browser error: ' + error);
    }
}
catch (error) {
    out.errors.push(error.stack);
}
finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-fault-browser.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length)
        process.exitCode = 1;
}
