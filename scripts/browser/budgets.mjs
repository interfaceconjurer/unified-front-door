import { origin, outputPath, httpCredentials } from './config.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { install, href, canvas, target, idFor, session } from './fixtures.mjs';
const label = process.argv[2] || 'candidate1', b = await chromium.launch(), out = { label, checks: [], errors: [] };
const options = { httpCredentials, viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' };
try {
    const c = await b.newContext(options);
    await install(c, { messages: 128 });
    const p = await c.newPage();
    p.setDefaultTimeout(60000);
    p.on('pageerror', e => out.errors.push(e.message));
    await p.goto(origin + href);
    await p.locator('[data-message-id]').last().waitFor();
    const ids = () => p.locator('[data-message-id]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.messageId)));
    let current = await ids();
    assert.equal(current.length, 40);
    assert.equal(current.at(-1), 128);
    const seen = [...current];
    await p.getByRole('button', { name: 'Older messages', exact: true }).click();
    current = await ids();
    const anchor = [...current];
    seen.push(...current);
    assert.deepEqual(await ids(), anchor);
    while (!await p.getByRole('button', { name: 'Older messages', exact: true }).isDisabled()) {
        await p.getByRole('button', { name: 'Older messages', exact: true }).click();
        current = await ids();
        assert(current.length <= 40);
        seen.push(...current);
    }
    assert.equal(seen.length, 128);
    assert.equal(new Set(seen).size, 128);
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 128 }, (_, i) => i + 1));
    await p.getByRole('button', { name: 'Latest messages', exact: true }).click();
    assert.equal((await ids()).length, 40);
    assert.equal((await ids()).at(-1), 128);
    out.checks.push('All128retained entries reachable exactly once in <=40entry pages; Latest returns to128');
    await c.close();
    const ca = await b.newContext(options), { state: appended } = await install(ca, { messages: 120 });
    const pa = await ca.newPage();
    pa.on('pageerror', e => out.errors.push(e.message));
    await pa.goto(origin + href);
    await pa.locator('[data-message-id]').last().waitFor();
    await pa.getByRole('button', { name: 'Older messages', exact: true }).click();
    const olderIds = await pa.locator('[data-message-id]').evaluateAll(nodes => nodes.map(n => n.dataset.messageId));
    appended.agent.conversations[0].conversation.messages.push({ id: 121, role: 'agent', text: 'Appended within supported128entry ceiling' });
    await pa.getByRole('navigation', { name: 'Conversation history', exact: true }).getByRole('status').filter({ hasText: 'of 121' }).waitFor();
    assert.deepEqual(await pa.locator('[data-message-id]').evaluateAll(nodes => nodes.map(n => n.dataset.messageId)), olderIds);
    await pa.getByRole('button', { name: 'Latest messages', exact: true }).click();
    assert.equal(await pa.locator('[data-message-id]').count(), 40);
    assert.equal(await pa.locator('[data-message-id]').last().getAttribute('data-message-id'), '121');
    out.checks.push('Supported120→121append preserves older page anchor and explicit Latest follows new entry');
    await ca.close();
    for (const total of [20, 21]) {
        const c = await b.newContext(options), { state } = await install(c);
        const entries = Array.from({ length: total }, (_, i) => { const spec = i === 0 ? canvas : { ...canvas, title: `Existing ${i}`, params: { ...canvas.params, section: `budget-${i}` } }; return { id: idFor(spec), surface: 'build', canvas: spec, target, fields: { name: `Preserved ${i}` }, revision: 1 }; });
        state.snapshot.canvases = entries;
        const active = entries.at(-1);
        const prefs = { build: { canvases: entries.map(v => ({ ...v.canvas, id: v.id })), activeCanvasId: active.id, closedDrafts: {}, targets: {} }, code: { canvases: [], activeCanvasId: 'overview' }, govern: { canvases: [], activeCanvasId: 'overview' }, alm: { canvases: [], activeCanvasId: 'overview' } };
        await c.addInitScript(({ prefs, session }) => localStorage.setItem(`ufd.canvas-preferences.v2.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`, JSON.stringify(prefs)), { prefs, session });
        const p = await c.newPage();
        p.setDefaultTimeout(60000);
        p.on('pageerror', e => out.errors.push(e.message));
        const dest = spec => origin + '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'jw', surface: 'build', target, canvas: spec }));
        await p.goto(dest(active.canvas));
        await p.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
        assert.equal(await p.getByRole('tablist', { name: 'Build & Setup canvases', exact: true }).getByRole('tab').count(), total + 1);
        assert.equal(await p.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), `Preserved ${total - 1}`);
        if (total === 20) {
            const next = { ...canvas, title: 'New blocked view', params: { ...canvas.params, section: 'over-budget' } };
            await p.goto(dest(next));
            await p.getByRole('tablist', { name: 'Build & Setup canvases', exact: true }).waitFor();
            assert.equal(await p.getByRole('tablist', { name: 'Build & Setup canvases', exact: true }).getByRole('tab').count(), 21);
            assert.equal(await p.getByRole('tab', { name: 'New blocked view', exact: true }).count(), 0);
            await p.getByRole('tab', { name: 'Existing 18', exact: true }).click();
            await p.waitForFunction(() => new URL(location.href).searchParams.get('destination')?.includes('budget-18'));
            await p.goBack();
            assert.equal(await p.getByRole('tab', { name: 'New blocked view', exact: true }).count(), 0);
            await p.goBack();
            await p.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
            assert.equal(await p.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Preserved 19');
            out.checks.push('Direct21stview refuses tab synthesis; denial→away→Back cannot promote it to a captured view');
            const other = await c.newPage();
            await other.goto(dest(entries[0].canvas));
            await other.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
            const replacement = { kind: 'capability', title: 'Replacement', params: { scope: 'unbound', surface: 'build', capability: 'data-model' } };
            await other.evaluate(({ key, closed, replacement, replacementId, target }) => { const raw = JSON.parse(localStorage.getItem(key)); const data = raw.__ufd === 1 ? raw.data : raw; data.build.canvases = data.build.canvases.filter(v => v.id !== closed); data.build.canvases.push({ ...replacement, id: replacementId }); data.build.targets = { ...data.build.targets, [closed]: target }; data.build.activeCanvasId = replacementId; localStorage.setItem(key, JSON.stringify({ __ufd: 1, data })); }, { key: `ufd.canvas-preferences.v2.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`, closed: active.id, replacement, replacementId: idFor(replacement), target });
            await p.waitForFunction(() => document.querySelectorAll('[role=tablist][aria-label="Build & Setup canvases"] [role=tab]').length === 22);
            assert.equal(await p.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Preserved 19');
            await p.getByRole('textbox', { name: 'Name', exact: true }).fill('Closed in another tab but still editable');
            assert.equal(await p.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Closed in another tab but still editable');
            out.checks.push('20sharedopenviews +1URL-only captured closed draft remain bounded and editable after another tab replaces the view');
        }
        else {
            await p.getByRole('button', { name: 'Close Existing 20', exact: true }).click();
            await p.waitForFunction(() => document.querySelectorAll('[role=tablist][aria-label="Build & Setup canvases"] [role=tab]').length === 21);
            out.checks.push('Legacy21openviews retained/readable; closing extra view returns to20 without deleting other tabs');
        }
        await c.close();
    }
    const c2 = await b.newContext(options), { state: long } = await install(c2);
    long.snapshot.canvases[0].fields.name = 'z'.repeat(17000);
    const p2 = await c2.newPage();
    p2.on('pageerror', e => out.errors.push(e.message));
    await p2.goto(origin + href);
    const input = p2.getByRole('textbox', { name: 'Name', exact: true });
    await input.waitFor();
    assert.equal((await input.inputValue()).length, 17000);
    await input.focus();
    await input.press('End');
    await input.press('x');
    assert.equal((await input.inputValue()).length, 17000);
    await input.fill('');
    await input.fill('y'.repeat(16001));
    assert.equal((await input.inputValue()).length, 16000);
    out.checks.push('Legacy17000characterfield is retained; native16000newinput limit does not silently truncate saved value');
    await c2.close();
}
catch (e) {
    out.errors.push(e.stack);
}
finally {
    await b.close();
    writeFileSync(outputPath(`${label}-budgets.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length)
        process.exitCode = 1;
}
