import { origin, outputPath, httpCredentials } from './config.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { install, href } from './fixtures.mjs';
const label = process.argv[2] || 'candidate';
const browser = await chromium.launch({ headless: true });
const output = { label, origin, browser: browser.version(), viewport: { width: 1440, height: 1100 }, cpuThrottle: 4, transport: 'deterministic intercepted API,80ms per save', samples: [], errors: [] };
try {
    for (const drafts of (process.env.BROWSER_TEST_MODE === 'history' ? [] : [1, 20]))
        for (let repeat = 0; repeat < 3; repeat++) {
            const context = await browser.newContext({ viewport: output.viewport, httpCredentials, reducedMotion: 'reduce' });
            const { stats, state } = await install(context, { drafts, messages: 20 });
            const page = await context.newPage();
            page.setDefaultTimeout(180000);
            page.setDefaultNavigationTimeout(120000);
            page.on('pageerror', e => output.errors.push(e.message));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await cdp.send('Performance.enable');
            await page.goto(origin + href);
            const input = page.getByRole('textbox', { name: 'Name', exact: true });
            await input.waitFor();
            await input.fill('');
            await page.waitForTimeout(1200);
            const before = await cdp.send('Performance.getMetrics');
            stats.posts = 0;
            stats.requestBytes = 0;
            stats.gets = 0;
            stats.commands.length = 0;
            await page.evaluate(() => { window.__metrics = { writes: 0, writeBytes: 0, inputFrames: [], measuring: true }; });
            const start = Date.now();
            await input.pressSequentially('x'.repeat(100), { timeout: 180000 });
            const typingWallMs = Date.now() - start;
            console.log('typed', drafts, repeat, typingWallMs, 'ms; posts', stats.posts);
            await input.blur();
            await page.waitForFunction(() => !Object.keys(localStorage).some(k => k.startsWith('ufd.pending.v1.') && k !== 'ufd.pending.v1.instance'), null, { timeout: 240000 });
            await page.waitForTimeout(100);
            const measured = await page.evaluate(() => { window.__metrics.measuring = false; return window.__metrics; });
            const after = await cdp.send('Performance.getMetrics');
            const task = x => x.metrics.find(x => x.name === 'TaskDuration')?.value ?? 0;
            const sorted = measured.inputFrames.sort((a, b) => a - b);
            assert.equal(await input.inputValue(), 'x'.repeat(100), 'All typed characters remain visible');
            assert.equal(state.snapshot.canvases[0].fields.name, 'x'.repeat(100), 'All typed characters are acknowledged by the fixture server');
            output.samples.push({ kind: 'typing', drafts, repeat, typingWallMs, savePosts: stats.posts, requestBytes: stats.requestBytes, bufferWrites: measured.writes, bufferWriteBytes: measured.writeBytes, inputFrameP50: sorted[Math.floor(sorted.length * .5)], inputFrameP95: sorted[Math.floor(sorted.length * .95)], taskMs: 1000 * (task(after) - task(before)), finalValue: await input.inputValue(), savedValue: state.snapshot.canvases[0].fields.name });
            writeFileSync(outputPath(`${label}-performance.partial.json`), JSON.stringify(output, null, 2));
            console.log('sample', output.samples.length);
            await context.close();
        }
    for (const messages of (process.env.BROWSER_TEST_MODE === 'typing' ? [] : [20, 80, 128]))
        for (let repeat = 0; repeat < 3; repeat++) {
            const context = await browser.newContext({ viewport: output.viewport, httpCredentials, reducedMotion: 'reduce' });
            await install(context, { drafts: 1, messages });
            const page = await context.newPage();
            page.setDefaultTimeout(180000);
            page.setDefaultNavigationTimeout(120000);
            page.on('pageerror', e => output.errors.push(e.message));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await cdp.send('Performance.enable');
            const before = await cdp.send('Performance.getMetrics');
            const start = Date.now();
            await page.goto(origin + href);
            await page.locator('[data-message-id]').last().waitFor();
            await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
            await page.waitForTimeout(500);
            const after = await cdp.send('Performance.getMetrics'), metric = (x, n) => x.metrics.find(m => m.name === n)?.value ?? 0;
            output.samples.push({ kind: 'transcript', messages, repeat, readyWallMs: Date.now() - start, mountedMessages: await page.locator('[data-message-id]').count(), mountedBriefings: await page.getByRole('article', { name: 'Today briefing' }).count(), nodes: await page.locator('*').count(), taskMs: 1000 * (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')), heapBytes: metric(after, 'JSHeapUsedSize') });
            writeFileSync(outputPath(`${label}-performance.partial.json`), JSON.stringify(output, null, 2));
            console.log('sample', output.samples.length);
            await context.close();
        }
}
catch (e) {
    output.errors.push(e.stack);
}
finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-performance.json`), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
    if (output.errors.length)
        process.exitCode = 1;
}
