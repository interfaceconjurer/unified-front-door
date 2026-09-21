import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install } from './fixtures.mjs';

const label = process.argv[2] ?? 'candidate', browser = await chromium.launch();
const out = { label, checks: [], errors: [] };
try {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 0 });
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    let submits = 0, progressReads = 0, retryCount = 0;
    let current;
    function publish(text, status = 'streaming') {
        current.result = text; current.status = status; current.sequence++;
        const reply = state.agent.conversations[0].conversation.messages.find(message => message.role === 'agent');
        reply.text = text; reply.runId = current.id;
        state.agent.conversations[0].revision++;
    }
    await page.route('**/api/agent*', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === 'GET') {
            const id = url.searchParams.get('runId');
            if (id) { progressReads++; return route.fulfill({ json: { run: state.agent.runs.find(run => run.id === id), events: [] } }); }
            return route.fulfill({ json: state.agent });
        }
        const command = request.postDataJSON().command;
        if (command.kind === 'submit') {
            submits++;
            current = { id: 'streamed-run', requestId: command.requestId, turnId: 'streamed-turn', conversationId: 'phase6-conversation', retryOf: null,
                kind: 'chat', status: 'pending', sequence: 1, checkpoint: 0, result: null, error: null, context: command.context,
                createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-17T00:00:00.000Z', assessmentRunId: null,
                execution: { provider: 'anthropic', model: 'simulated-stream' } };
            state.agent.runs.push(current);
            state.agent.conversations[0].revision++;
            state.agent.conversations[0].conversation.messages.push(
                { id: 1, role: 'user', text: command.text, turnId: current.turnId, runId: current.id },
                { id: 2, role: 'agent', text: '', turnId: current.turnId, runId: current.id });
        } else if (command.kind === 'cancel') {
            publish(current.result ?? '', 'cancelled');
        } else if (command.kind === 'retry') {
            retryCount++;
            current = { ...current, id: 'retry-streamed-run', requestId: command.requestId, retryOf: current.id, result: null, error: null, status: 'running', sequence: 2 };
            state.agent.runs.push(current);
            const reply = state.agent.conversations[0].conversation.messages.find(message => message.role === 'agent');
            reply.runId = current.id; reply.text = ''; state.agent.conversations[0].revision++;
        }
        return route.fulfill({ json: { result: { conversationId: 'phase6-conversation', ...(current ? { runId: current.id, turnId: current.turnId } : {}) } } });
    });
    await page.goto(origin + '/');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.waitFor();
    await composer.fill('Explain the findings as you work.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const suggestions = page.locator('[aria-label="Suggested prompts"]');
    await page.locator('[data-run-status="pending"]').waitFor();
    assert.equal(await suggestions.count(), 0, 'No suggestions while queued');
    publish('', 'running');
    await page.locator('[data-run-status="running"]').waitFor();
    assert.equal(await suggestions.count(), 0, 'No suggestions while preparing a reply');
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]').dataset.motion === 'idle');
    const reply = page.locator('[data-kind="agent"]');
    const first = 'First streamed words';
    publish(first);
    await page.waitForFunction(text => document.querySelector('[data-kind="agent"]')?.textContent.includes(text), first);
    assert.equal(await page.locator('[data-run-status="completed"]').count(), 0);
    assert(await page.getByRole('button', { name: 'Cancel reply', exact: true }).isVisible());
    assert.equal(await suggestions.count(), 0, 'No suggestions during streaming');
    const replyStyle = await page.locator('[data-streamed-text]').evaluate(node => {
        const style = getComputedStyle(node.parentElement);
        return { background: style.backgroundColor, border: style.borderTopWidth, padding: style.paddingLeft };
    });
    assert.deepEqual(replyStyle, { background: 'rgba(0, 0, 0, 0)', border: '0px', padding: '0px' }, 'Agent prose has no bubble');
    assert(await page.locator('[data-kind="user"]').evaluate(node => {
        const style = getComputedStyle(node.firstElementChild.firstElementChild);
        return style.borderTopWidth === '1px' && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(style.paddingLeft) > 0;
    }), 'User messages keep their bubbles');
    out.checks.push('Agent prose has no bubble; user bubbles remain; pending/running/streaming replies hide suggestions');
    await page.evaluate(() => {
        const text = document.querySelector('[data-streamed-text]');
        window.streamingNode = text;
        window.streamingFrames = [];
        new MutationObserver(() => window.streamingFrames.push({ text: text.textContent, at: performance.now() }))
            .observe(text, { childList: true, characterData: true, subtree: true });
    });
    const second = first + ', followed by a second chunk while the response is still running. ' + 'These are real received words. '.repeat(5);
    publish(second);
    await page.waitForFunction(text => document.querySelector('[data-kind="agent"]')?.textContent.includes(text), second);
    assert.equal(await page.locator('[data-run-status="streaming"]').count(), 1);
    assert(progressReads >= 2);
    out.checks.push('Two separately published prefixes render in one reply before completion; targeted progress polling runs and cancellation stays available');
    const frames = await page.evaluate(() => ({ frames: window.streamingFrames, sameNode: window.streamingNode === document.querySelector('[data-streamed-text]') }));
    assert(frames.sameNode);
    assert(frames.frames.length >= 5, 'A batched prefix must appear in multiple small increments');
    for (let i = 0; i < frames.frames.length; i++) {
        assert(second.startsWith(frames.frames[i].text), 'Display only text already received');
        if (i) assert(frames.frames[i].text.startsWith(frames.frames[i - 1].text), 'Never retype or remove an earlier prefix');
    }
    assert(frames.frames.at(-1).at - frames.frames[0].at < 650, 'Catch up without a growing presentation backlog');
    out.checks.push('Normal-motion delivery shows at least five incremental prefixes in one stable text node and catches up within 650 ms');

    const long = second + '\n\n' + 'A captured finding can support a proposed next step. '.repeat(110);
    publish(long);
    await page.waitForFunction(text => document.querySelector('[data-kind="agent"]')?.textContent.includes(text), long);
    const log = page.getByRole('log', { name: 'Conversation', exact: true });
    const followed = await log.evaluate(node => {
        const status = node.querySelector('[data-run-id]');
        return { scroll: node.scrollTop, replyBottom: status.parentElement.getBoundingClientRect().bottom, viewportBottom: node.getBoundingClientRect().bottom };
    });
    assert(followed.scroll > 0); assert(followed.replyBottom <= followed.viewportBottom + 14);
    await log.dispatchEvent('wheel', { deltaY: -600 });
    await log.evaluate(node => { node.scrollTop = 0; });
    const more = long + '\nMore text should not pull you away from earlier content.';
    publish(more);
    await page.waitForFunction(text => document.querySelector('[data-kind="agent"]')?.textContent.includes(text), more);
    assert.equal(await log.evaluate(node => node.scrollTop), 0);
    out.checks.push('Growing reply follows into view; scrolling up prevents subsequent text from moving the reader');
    await log.dispatchEvent('wheel', { deltaY: 600 });
    await log.evaluate(node => {
        const bubble = node.querySelector('[data-streamed-text]').parentElement;
        node.scrollTop += bubble.getBoundingClientRect().bottom - node.getBoundingClientRect().bottom + 12;
    });
    await page.waitForTimeout(50);
    const resumed = more + '\nFollowing resumes when the reader scrolls back down. '.repeat(8);
    publish(resumed);
    await page.waitForFunction(text => document.querySelector('[data-streamed-text]')?.textContent === text, resumed);
    assert(await log.evaluate(node => node.querySelector('[data-streamed-text]').parentElement.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 14));
    out.checks.push('Deliberately scrolling back to the reply resumes following');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = resumed + '\nReduced motion shows new received text immediately.';
    await page.evaluate(() => { window.streamingFrames = []; });
    publish(reduced);
    await page.waitForFunction(text => document.querySelector('[data-streamed-text]')?.textContent === text, reduced);
    assert((await page.evaluate(() => window.streamingFrames)).every(frame => frame.text === reduced));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    out.checks.push('Reduced motion bypasses incremental animation');

    const cancelledText = reduced + '\n' + 'This received tail must flush on cancellation. '.repeat(50);
    publish(cancelledText);
    await page.waitForFunction(({ prior, complete }) => {
        const length = document.querySelector('[data-streamed-text]')?.textContent.length ?? 0;
        return length > prior && length < complete;
    }, { prior: reduced.length, complete: cancelledText.length });
    const beforeCancel = await page.evaluate(() => {
        const length = document.querySelector('[data-streamed-text]').textContent.length;
        [...document.querySelectorAll('button')].find(button => button.textContent === 'Cancel reply').click();
        return length;
    });
    assert(beforeCancel < cancelledText.length, 'Cancellation must be issued while text is buffered');
    await page.locator('[data-run-status="cancelled"]').waitFor();
    assert.equal(await suggestions.count(), 0, 'Cancelled replies keep retry controls without next-step suggestions');
    assert.equal(await page.locator('[data-streamed-text]').textContent(), cancelledText);
    await page.evaluate(() => { window.streamingFrames = []; });
    await page.waitForTimeout(600);
    assert.equal((await page.evaluate(() => window.streamingFrames)).length, 0, 'Terminal text must have no late animation writes');
    assert((await reply.textContent()).includes(cancelledText));
    out.checks.push('Cancellation during a normal-motion backlog flushes all received text immediately and stops subsequent frame updates');
    await page.reload();
    await page.locator('[data-run-status="cancelled"]').waitFor();
    assert((await page.locator('[data-kind="agent"]').textContent()).includes(cancelledText));
    assert.equal(submits, 1);
    out.checks.push('Cancellation retains partial text with Cancelled status across reload and does not submit again');

    await page.getByRole('button', { name: 'Retry reply', exact: true }).click();
    await page.locator('[data-run-id="retry-streamed-run"]').waitFor();
    assert.equal(await suggestions.count(), 0, 'Retry waits for its new reply to complete');
    assert(!(await page.locator('[data-kind="agent"]').textContent()).includes(first));
    const retriedText = 'The explicit retry streams its own new answer.';
    publish(retriedText);
    await page.waitForFunction(text => document.querySelector('[data-kind="agent"]')?.textContent.includes(text), retriedText);
    const completed = retriedText + ' Finished. ' + 'Complete history is available immediately. '.repeat(30);
    publish(completed, 'completed');
    await page.locator('[data-run-status="completed"]').waitFor();
    assert.equal(await page.locator('[data-kind="agent"]').count(), 1);
    assert.equal(retryCount, 1); assert.equal(submits, 1);
    assert.equal(await page.locator('[data-streamed-text]').textContent(), completed);
    await suggestions.waitFor();
    assert(await suggestions.getByRole('button').count() > 0);
    out.checks.push('Suggestions appear with the completed reply; cancellation and retry keep their own status controls');
    await page.reload();
    await page.locator('[data-run-status="completed"]').waitFor();
    assert.equal(await page.locator('[data-streamed-text]').textContent(), completed);
    await page.screenshot({ path: outputPath(`${label}-streaming.png`) });
    out.checks.push('Explicit retry replaces its earlier partial and completes one existing reply without duplicates');
    await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-streaming.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length) process.exitCode = 1;
}
