import { origin, outputPath, httpCredentials } from './config.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { install, href } from './fixtures.mjs';
const label = process.argv[2] || 'candidate1';
const browser = await chromium.launch({ headless: true }), out = { label, origin, checks: [], errors: [] };
try {
    for (const motion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, httpCredentials, reducedMotion: motion });
        await install(context);
        const page = await context.newPage();
        page.on('pageerror', e => out.errors.push(e.message));
        await page.goto(origin + href);
        await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor();
        const trigger = page.getByRole('button', { name: 'Search workspace', exact: true }), dialog = page.getByRole('dialog'), composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
        await composer.fill('Draft survives keyboard navigation');
        await composer.evaluate(n => { n.setSelectionRange(6, 14); });
        await trigger.click();
        await dialog.waitFor();
        await page.waitForTimeout(motion === 'reduce' ? 50 : 550);
        const search = dialog.locator('input');
        assert(await search.evaluate(n => n === document.activeElement));
        await search.fill('Build');
        await search.evaluate(n => n.setSelectionRange(2, 2));
        await page.keyboard.press('ArrowLeft');
        assert.equal(await search.evaluate(n => n.selectionStart), 1);
        assert.equal(await dialog.getByRole('tab', { selected: true }).innerText(), 'Surfaces');
        await page.keyboard.press('ArrowRight');
        assert.equal(await search.evaluate(n => n.selectionStart), 2);
        await search.fill('');
        for (const key of ['Tab', 'Shift+Tab'])
            for (let i = 0; i < 18; i++) {
                await page.keyboard.press(key);
                assert(await dialog.evaluate(n => n.contains(document.activeElement)), key + ' escaped dialog');
            }
        await composer.evaluate(n => n.focus());
        assert(await dialog.evaluate(n => n.contains(document.activeElement)), 'Background focused while modal');
        const surfaces = dialog.getByRole('tab', { name: 'Surfaces', exact: true });
        await surfaces.focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await dialog.getByRole('tab', { selected: true }).innerText(), 'Projects');
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Projects');
        await page.keyboard.press('End');
        assert.equal(await dialog.getByRole('tab', { selected: true }).innerText(), 'Resources');
        await page.keyboard.press('Home');
        assert.equal(await dialog.getByRole('tab', { selected: true }).innerText(), 'Surfaces');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert(await trigger.evaluate(n => n === document.activeElement));
        out.checks.push(motion + ': caret, tab roving, bidirectional containment, background inert, Escape/tab, focus restoration');
        for (const kind of ['input', 'result', 'guided']) {
            await trigger.click();
            await dialog.waitFor();
            if (kind === 'guided') {
                await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
                await dialog.getByRole('button', { name: 'Start your first project' }).focus();
            }
            else if (kind === 'result') {
                await dialog.getByRole('option').first().getByRole('button').focus();
            }
            else
                await dialog.locator('input').focus();
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'detached' });
            assert(await trigger.evaluate(n => n === document.activeElement));
        }
        out.checks.push(motion + ': Escape input/result/guided-action and trigger restore');
        if (motion === 'no-preference') {
            await trigger.click();
            await dialog.waitFor();
            await page.waitForTimeout(550);
            const durations = await dialog.locator(':scope > div').evaluate(n => getComputedStyle(n).transitionDuration.split(',').map(v => v.trim()));
            assert(durations.every(v => v === '0.5s'), 'Normal palette keeps500ms transitions');
            await search.evaluate(n => n.animate([{ opacity: 0.99 }, { opacity: 1 }], { duration: 1000, iterations: Infinity }));
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'detached', timeout: 5000 });
            assert(await trigger.evaluate(n => n === document.activeElement));
            out.checks.push('normal: infinite child animation cannot block dismissal or focus restoration');
            await trigger.click();
            await dialog.waitFor();
            await page.waitForTimeout(550);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(70);
            await page.keyboard.press('Control+Shift+P');
            await page.waitForTimeout(650);
            assert.equal(await dialog.count(), 1);
            assert(await dialog.evaluate(n => n.matches(':modal')));
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'detached' });
            out.checks.push('normal: reopen cancels pending dismissal');
            out.durations = durations;
        }
        await trigger.click();
        await dialog.waitFor();
        await page.mouse.click(5, 5);
        await dialog.waitFor({ state: 'detached' });
        assert(await trigger.evaluate(n => n === document.activeElement));
        out.checks.push(motion + ': backdrop dismiss restores trigger');
        await trigger.click();
        await dialog.waitFor();
        await dialog.getByRole('option').filter({ hasText: 'Code' }).first().getByRole('button').click();
        await dialog.waitFor({ state: 'detached' });
        await page.waitForURL('**/code?**');
        assert.equal(await composer.inputValue(), 'Draft survives keyboard navigation');
        await page.goBack();
        await page.waitForURL('**/build?**');
        assert.equal(await composer.inputValue(), 'Draft survives keyboard navigation');
        out.checks.push(motion + ': palette route + browser Back preserve composer');
        await context.close();
    }
}
catch (e) {
    out.errors.push(e.stack);
}
finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-interactions.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length)
        process.exitCode = 1;
}
