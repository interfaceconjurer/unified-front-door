import { origin, outputPath, httpCredentials } from './config.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { install, href } from './fixtures.mjs';
const label = process.argv[2] || 'candidate1', b = await chromium.launch();
const out = { label, checks: [], errors: [] };
try {
    for (const test of ['ack-refresh', 'lost-ack-reload', 'late-same-path']) {
        const c = await b.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1100 } });
        const { state } = await install(c, { drafts: 20, messages: 20 });
        const p = await c.newPage();
        p.on('pageerror', e => out.errors.push(e.message));
        let held = false, release, submits = [], dropped = false, receipt = { conversationId: 'phase6-conversation', runId: 'phase6-run', turnId: 'phase6-turn' }, blockGet = false;
        const gate = new Promise(r => release = r);
        const text = 'Retain my exact draft';
        await p.route('**/api/agent*', async (route) => {
            if (route.request().method() === 'GET') {
                if (blockGet) {
                    held = true;
                    await gate;
                    blockGet = false;
                }
                return route.fulfill({ json: state.agent });
            }
            const cmd = route.request().postDataJSON().command;
            if (cmd.kind === 'submit') {
                submits.push(cmd);
                if (submits.length === 1) {
                    const conv = state.agent.conversations[0].conversation;
                    conv.messages.push({ id: 21, role: 'user', text: cmd.text, turnId: receipt.turnId }, { id: 22, role: 'agent', text: 'Reply retained once', runId: receipt.runId, turnId: receipt.turnId });
                }
                if (test === 'ack-refresh' && submits.length === 1)
                    blockGet = true;
                if (test === 'late-same-path') {
                    held = true;
                    await gate;
                    return route.fulfill({ json: { result: { ...receipt, destination: 'govern' } } });
                }
                if (test === 'lost-ack-reload' && !dropped) {
                    dropped = true;
                    await route.abort('failed');
                    return;
                }
                return route.fulfill({ json: { result: receipt } });
            }
            return route.fulfill({ json: { result: { conversationId: 'phase6-conversation' } } });
        });
        await p.goto(origin + href);
        await p.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
        const composer = p.getByRole('textbox', { name: 'Message the agent', exact: true });
        await composer.fill(text);
        await p.getByRole('button', { name: 'Send message', exact: true }).click();
        if (test === 'ack-refresh') {
            for (let i = 0; i < 150 && !held; i++)
                await p.waitForTimeout(20);
            assert(held, 'held postACK refresh');
            assert.equal(await composer.inputValue(), '');
            await composer.fill(text);
            release();
            await p.waitForTimeout(2200);
            assert.equal(await composer.inputValue(), text);
            assert.equal(submits.length, 1);
            out.checks.push('One ACK clears once; retyped identical draft survives held refresh and polling');
        }
        else if (test === 'lost-ack-reload') {
            await p.getByRole('button', { name: 'Retry request', exact: true }).waitFor();
            const first = submits[0];
            await p.reload();
            await p.getByRole('button', { name: 'Retry request', exact: true }).waitFor();
            await p.getByRole('button', { name: 'Retry request', exact: true }).click();
            await p.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(n => n.textContent === 'Retry request'));
            assert.equal(submits.length, 2);
            assert.deepEqual(submits[1], first);
            assert.equal(await p.locator('[data-kind=user]').filter({ hasText: text }).count(), 1);
            assert.equal(await p.locator('[data-kind=agent]').filter({ hasText: 'Reply retained once' }).count(), 1);
            out.checks.push('Lost ACK reload replays exact request once; same turn retained without duplicates');
        }
        else {
            for (let i = 0; i < 150 && !held; i++)
                await p.waitForTimeout(20);
            assert(held);
            await p.getByRole('tab', { name: 'data-model', exact: true }).click();
            await p.waitForFunction(() => new URL(location.href).searchParams.get('destination')?.includes('data-model'));
            const chosen = p.url();
            release();
            await p.waitForTimeout(1600);
            assert.equal(p.url(), chosen);
            assert.equal(new URL(p.url()).pathname, '/build');
            assert.equal(await p.locator('[data-kind=agent]').filter({ hasText: 'Reply retained once' }).count(), 1);
            out.checks.push('Newer same-path canvas selection survives late navigation recommendation and reply remains visible');
        }
        await c.close();
    }
}
catch (e) {
    out.errors.push(e.stack);
}
finally {
    await b.close();
    writeFileSync(outputPath(`${label}-agent-regressions.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length)
        process.exitCode = 1;
}
