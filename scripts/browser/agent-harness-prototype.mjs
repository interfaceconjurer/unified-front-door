import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { origin, outputPath, httpCredentials } from './config.mjs';

const label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const browser = await chromium.launch();
const entry = new URL('/prototypes/agent-harness.html', origin);
const tabs = ['All', 'Capabilities', 'Projects', 'Sessions', 'Orgs', 'Resources', 'Plugins'];

async function cardMetrics(section) {
    return section.evaluate(element => {
        const properties = selector => {
            const style = getComputedStyle(element.querySelector(selector));
            return Object.fromEntries(['padding', 'fontSize', 'lineHeight', 'borderRadius', 'gap', 'margin'].map(key => [key, style[key]]));
        };
        return Object.fromEntries(['.composition-label', '.study-choice', '.choice-title', '.choice-eyebrow', '.choice-description'].map(selector => [selector, properties(selector)]));
    });
}

async function checkSharedEdges(page, study) {
    const edges = await page.locator(study).evaluate(root => ['.composition-label', '.study-choice', '.composition-harness > :first-child'].map(selector => Math.round(root.querySelector(selector).getBoundingClientRect().left)));
    assert.equal(new Set(edges).size, 1, `${study} label, choices, and harness frame share one left edge: ${edges}`);
}

async function checkReadableLayout(page) {
    const result = await page.evaluate(() => {
        const elements = [...document.querySelectorAll('body *')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
        const hasText = element => [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        const rgba = value => (value.match(/[\d.]+/g) || []).map(Number);
        const luminance = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const backdrop = element => {
            for (let node = element; node; node = node.parentElement) {
                const [r, g, b, a = 1] = rgba(getComputedStyle(node).backgroundColor);
                if (a > 0.5) return [r, g, b];
            }
            return rgba(getComputedStyle(document.documentElement).backgroundColor);
        };
        const lowContrast = elements.filter(element => hasText(element) && !element.closest('button:disabled, [inert]') && !element.closest('dialog:not([open])')).flatMap(element => {
            const style = getComputedStyle(element);
            if (parseFloat(style.opacity) < 1) return [];
            const [r, g, b, a = 1] = rgba(style.color);
            if (a < 1) return [{ element: element.className || element.tagName, color: style.color }];
            const [light, dark] = [luminance([r, g, b]), luminance(backdrop(element))].sort((x, y) => y - x);
            const ratio = (light + 0.05) / (dark + 0.05);
            return ratio < 4.5 ? [{ element: element.className || element.tagName, ratio: Math.round(ratio * 100) / 100 }] : [];
        });
        return {
            lowContrast,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            small: elements.filter(element => hasText(element) && parseFloat(getComputedStyle(element).fontSize) < 13).map(element => element.className),
            overflow: elements.filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2 && !['auto', 'scroll'].includes(getComputedStyle(element).overflowX) && getComputedStyle(element).textOverflow !== 'ellipsis').map(element => element.className),
        };
    });
    assert.deepEqual(result, { lowContrast: [], pageOverflow: false, small: [], overflow: [] });
}

try {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    const response = await page.goto(entry.href);
    assert.equal(response.status(), 200);
    assert.deepEqual(await page.locator('[data-action=study-view]').allTextContents(), ['Plugin model', 'Harness integration']);
    assert(await page.locator('#model-study').isVisible());
    assert.equal(await page.locator('[data-action=model-layer][data-value=plugin]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#model-palette-tab-plugins').getAttribute('aria-selected'), 'true');
    await checkReadableLayout(page);
    await checkSharedEdges(page, '#model-study');
    await page.reload();
    assert.equal(new URL(page.url()).hash, '#model');
    assert.equal(await page.locator('#model-palette-tab-plugins').getAttribute('aria-selected'), 'true');
    out.checks.push('Plugin model precedes Harness integration and opens on Plugin with the Plugins palette, including reload');
    await page.goto(entry.href + '#thread');
    await page.reload();
    assert.equal(await page.locator('#demo-study .composition-label').textContent(), 'Plug-in capability presentation layers');
    assert.equal(await page.locator('#demo-study .study-choice').count(), 3);
    assert.equal(await page.locator('.story-review').count(), 0, 'Single-capability example has no nudge');
    await checkSharedEdges(page, '#demo-study');
    assert.equal(await page.locator('#shell .conversation-tools, #shell [data-action=working-set]:not(#working-set *)').count(), 0, 'No conversation toolbar or expand-working-set action');
    assert.equal(await page.locator('#shell').getByRole('button', { name: /Open workbench|Close workbench|Expand working set/ }).count(), 0);
    const demoMetrics = await cardMetrics(page.locator('.demo-presentations'));
    await page.locator('#steer-input').fill('Keep this direction while changing presentations');
    await page.evaluate(() => { window.__priorArtifact = document.querySelector('.story-artifact'); });
    await page.locator('[data-action=presentation][data-value=desk]').click();
    assert(await page.locator('#review-presentation [data-action=review-together]').isVisible(), '02 opens on the review summary');
    assert.equal(await page.locator('#working-set').count(), 0);
    assert.equal(new URL(page.url()).hash, '#working-set');
    assert.equal(await page.locator('#steer-input').inputValue(), 'Keep this direction while changing presentations');
    assert(await page.evaluate(() => window.__priorArtifact === document.querySelector('.story-artifact')));
    await page.reload();
    assert(await page.locator('#review-presentation [data-action=review-together]').isVisible(), 'Summary default survives reload');
    await page.locator('#review-presentation [data-action=review-together]').click();
    assert(await page.locator('#working-set').isVisible());
    assert.equal(new URL(page.url()).hash, '#working-set-expanded');
    await page.reload();
    assert(await page.locator('#working-set').isVisible(), 'Expanded link survives reload');
    for (const hash of ['desk', 'working-set-summary']) {
        await page.goto(`${entry.href}#${hash}`);
        await page.reload();
        assert(await page.locator('#review-presentation [data-action=review-together]').isVisible(), `#${hash} opens on the review summary`);
    }
    await page.locator('#review-presentation [data-action=review-together]').click();
    await page.locator('#reset-example').click();
    assert(await page.locator('#review-presentation [data-action=review-together]').isVisible(), 'Reset restores the summary default');
    await page.locator('#review-presentation [data-action=review-together]').click();
    assert(await page.locator('#working-set').isVisible());
    const draft = 'Request and validate the missing region before assigning the owner.';
    await page.locator('#working-set .rule-input').fill(draft);
    assert.equal(await page.locator('.story-artifact .rule-input').inputValue(), draft);
    assert.match(await page.locator('.header-status').innerText(), /Draft ready/);
    await page.locator('#working-set').getByRole('button', { name: /View more/ }).nth(1).click();
    assert(await page.locator('.surface-pane').isVisible());
    assert.equal(await page.locator('.surface-pane .rule-input').inputValue(), draft);
    assert.equal(await page.locator('#working-set').count(), 0);
    const openSurfaceNames = () => page.locator('.workbench-artifacts [data-action=workbench-activate]').allTextContents();
    assert.deepEqual(await openSurfaceNames(), ['Routing rule']);
    await page.locator('.surface-pane .depth-section').nth(1).locator('summary').first().click();
    await page.locator('.surface-pane .depth-related [data-value=trace]').click();
    assert.deepEqual(await openSurfaceNames(), ['Routing rule', 'Execution trace']);
    assert.equal(await page.locator('.surface-pane').getByRole('button', { name: /Open capability|Hide workbench/ }).count(), 0, 'The panel has no open-capability or close controls of its own');
    assert.equal(await page.locator('#shell [data-workbench-toggle]').getAttribute('aria-pressed'), 'true');
    await page.locator('#shell [data-action=tools]').first().click();
    await page.locator('#demo-tool-query').fill('Inspect access');
    await page.locator('#tools-dialog [data-action=palette-invoke][data-value=open]').click();
    assert.deepEqual(await openSurfaceNames(), ['Routing rule', 'Execution trace', 'Access inspection']);
    await page.locator('#shell [data-workbench-toggle]').click();
    assert.equal(await page.locator('.surface-pane').count(), 0);
    assert.equal(await page.locator('#shell [data-workbench-toggle]').getAttribute('aria-pressed'), 'false');
    await page.locator('#shell [data-workbench-toggle]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#shell [data-workbench-toggle]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await openSurfaceNames(), ['Routing rule', 'Execution trace', 'Access inspection']);
    await page.getByRole('button', { name: 'Close Execution trace', exact: true }).click();
    assert(await page.locator('.surface-pane [data-surface=access]').isVisible());
    await page.locator('.workbench-artifacts [data-value=edit][data-action=workbench-activate]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.surface-pane .rule-input').inputValue(), draft);
    await page.getByRole('button', { name: 'Close Routing rule', exact: true }).click();
    assert(await page.locator('.surface-pane [data-surface=access]').isVisible());
    await page.getByRole('button', { name: 'Close Access inspection', exact: true }).click();
    assert.equal(await page.locator('.surface-pane').count(), 0);
    await page.locator('.story-artifact [data-action=workbench-surface][data-value=edit]').click();
    assert.deepEqual(await openSurfaceNames(), ['Routing rule']);
    assert.equal(await page.locator('.surface-pane .rule-input').inputValue(), draft);
    out.checks.push('Workbench surfaces open in any order from related artifacts or the capability palette; closing active/inactive views and keyboard switching preserve shared drafts');
    await page.locator('#review-presentation [data-action=review-together]').click();
    assert.equal(await page.locator('.surface-pane').count(), 0);
    assert.equal(await page.locator('#working-set .rule-input').inputValue(), draft);
    await page.locator('#working-set [data-action=evaluate]').click();
    await page.locator('#working-set [data-action=review]').waitFor();
    await page.locator('#working-set [data-action=review]').click();
    await page.locator('#working-set [data-action=approve]').click();
    assert.match(await page.locator('.header-status').innerText(), /Review recorded/);
    await page.locator('#reset-example').click();
    out.checks.push('Presentation defaults, summary reload, prior-message/composer preservation, shared draft, workbench round trip, invalidated checks and simulated review');

    await page.locator('#shell [data-action=tools]').first().click();
    assert.deepEqual(await page.locator('#tools-dialog [role=tab]').allTextContents(), tabs);
    await page.locator('#tools-dialog [data-action=palette-lifecycle][data-value=testing]').click();
    const results = await page.locator('#tools-dialog .command-copy small').allTextContents();
    assert(results.length && results.every(text => text.includes('Testing')));
    await page.locator('#tools-dialog [data-action=palette-plugin]').click();
    assert.equal(await page.locator('#demo-palette-tab-plugins').getAttribute('aria-selected'), 'true');
    await page.locator('#tools-dialog [data-action=palette-plugin-capabilities]').click();
    assert.equal(await page.locator('#demo-palette-tab-capabilities').getAttribute('aria-selected'), 'true');
    await page.locator('#demo-palette-tab-capabilities').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#demo-palette-tab-plugins').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('#shell [data-action=preferences]').click();
    assert(await page.locator('#preferences-dialog').isVisible());
    await checkReadableLayout(page);
    await page.keyboard.press('Escape');
    out.checks.push('Capabilities and Plugins stay separate; Plugins is last; ALM filtering, source links, keyboard tabs and personal settings remain accessible');

    await page.locator('[data-action=study-view][data-value=model]').click();
    assert.equal(await page.locator('#model-palette-tab-plugins').getAttribute('aria-selected'), 'true');
    assert.deepEqual(await cardMetrics(page.locator('#model-study .composition-contributions')), demoMetrics);
    assert.equal(await page.locator('.model-edge').count(), 2);
    for (const edge of await page.locator('.model-edge').all()) {
        assert.equal((await edge.textContent()).trim(), '');
        assert.equal(await edge.locator('svg').count(), 1);
    }
    const layers = [
        ['plugin', 'plugins', ['Identity & version', 'Configuration', 'Contributions']],
        ['capability', 'capabilities', ['ALM stages', 'Inputs & actions', 'Results']],
        ['surface', null, ['View & interaction', 'Shared artifact', 'Edits & decisions']],
    ];
    for (const [layer, tab, tokens] of layers) {
        await page.locator(`[data-action=model-layer][data-value=${layer}]`).click();
        assert.equal(await page.locator(`[data-action=model-layer][data-value=${layer}]`).getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await page.locator('.model-detail-tokens span').allTextContents(), tokens);
        if (tab) assert.equal(await page.locator(`#model-palette-tab-${tab}`).getAttribute('aria-selected'), 'true');
        else {
            assert(await page.locator('#harness-map .surface-pane.is-callout').isVisible(), 'Surface calls out the workbench panel');
            assert.equal(await page.locator('#harness-map [data-workbench-toggle]').getAttribute('aria-pressed'), 'true');
        }
    }
    const headerShape = selector => page.locator(`${selector} .unified-header`).evaluate(header => [...header.querySelectorAll('.studio-brand, .top-session, .header-context, .header-capabilities, [aria-label="Capability settings"], .avatar, [data-workbench-toggle]')].map(element => element.className.split(' ')[0] || element.tagName));
    const modelHeader = await headerShape('#harness-map');
    assert.equal(await page.locator('#harness-map .surface-pane').getByRole('button', { name: /Open capability|Hide workbench|Dismiss/ }).count(), 0);
    await page.locator('#harness-map [data-workbench-toggle]').click();
    assert.equal(await page.locator('#harness-map .surface-pane').count(), 0, 'The model toggle closes the panel');
    assert.equal(await page.locator('#harness-map [data-workbench-toggle]').getAttribute('aria-pressed'), 'false');
    await page.locator('#harness-map [data-workbench-toggle]').click();
    assert(await page.locator('#harness-map .surface-pane').isVisible(), 'The same toggle reopens it');
    await page.locator('[data-action=study-view][data-value=demo]').click();
    assert.deepEqual(await headerShape('#shell'), modelHeader, 'Both views use the same harness header');
    await page.locator('[data-action=study-view][data-value=model]').click();
    await page.locator('[data-action=model-layer][data-value=plugin]').click();
    await page.locator('[data-launcher=model] [data-action=palette-plugin-filter][data-value=available]').click();
    assert.match(await page.locator('[data-launcher=model] .launcher-preview h2').innerText(), /Plugin C/);
    await page.locator('[data-launcher=model] [data-action=palette-install]').click();
    await page.locator('[data-launcher=model] [data-action=palette-plugin-capabilities]').click();
    assert.deepEqual(await page.locator('[data-launcher=model] .command-copy strong').allTextContents(), ['Capability E', 'Capability F']);
    out.checks.push('Both tabs share compact card geometry/type and one harness UI; the top-bar workbench icon alone opens and closes the panel; contribution arrows remain; model details retain metadata; installing a plugin contributes discoverable capabilities');

    for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of ['model', 'demo']) {
            await page.locator(`[data-action=study-view][data-value=${view}]`).click();
            if (view === 'model') await page.locator('[data-action=model-layer][data-value=capability]').click();
            else await page.locator('[data-action=presentation][data-value=desk]').click();
            await checkReadableLayout(page);
            if (view === 'demo') {
                await page.locator('#review-presentation [data-action=review-together]').click();
                await checkReadableLayout(page);
                await page.locator('[data-action=presentation][data-value=beside]').click();
                await checkReadableLayout(page);
            }
        }
        await page.locator('#shell [data-action=tools]').first().click();
        await checkReadableLayout(page);
        await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('[data-action=presentation][data-value=thread]').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert(await page.locator('#review-presentation [data-action=review-together]').isVisible());
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: outputPath(`${label}-agent-harness-prototype.png`) });
    const download = page.locator('a[download]');
    const downloadResponse = await context.request.get(new URL(await download.getAttribute('href'), entry).href);
    assert.equal(downloadResponse.status(), 200);
    assert.match(await downloadResponse.text(), /Plug-in capability presentation layers/);
    await page.getByRole('link', { name: 'Earlier study', exact: true }).click();
    assert(new URL(page.url()).pathname.endsWith('/navigation-study.html'));
    const current = page.locator('a[href="./agent-harness.html"]');
    assert(await current.count() > 0);
    const currentResponse = await context.request.get(new URL(await current.first().getAttribute('href'), page.url()).href);
    assert.equal(currentResponse.status(), 200);
    out.checks.push('Text meets 4.5:1 contrast against its background, 13px minimum and contained desktop/mobile layouts, keyboard choice activation, downloadable HTML and historical/current links');
    await context.close();

    const darkContext = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: 'dark', viewport: { width: 1440, height: 1100 } });
    const dark = await darkContext.newPage();
    dark.on('pageerror', error => out.errors.push(error.message));
    const pageColors = () => dark.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, background: getComputedStyle(document.body).backgroundColor, pressed: document.querySelector('#theme-toggle').getAttribute('aria-pressed') }));
    await dark.goto(entry.href);
    const systemDark = await pageColors();
    assert.deepEqual([systemDark.theme, systemDark.pressed], [null, 'true'], 'Dark system preference is followed without a saved choice');
    for (const hash of ['model', 'thread', 'working-set', 'beside']) {
        await dark.goto(`${entry.href}#${hash}`);
        await dark.reload();
        await checkReadableLayout(dark);
    }
    await dark.locator('#shell [data-action=tools]').first().click();
    await checkReadableLayout(dark);
    await dark.keyboard.press('Escape');
    await dark.locator('#theme-toggle').click();
    const chosenLight = await pageColors();
    assert.deepEqual([chosenLight.theme, chosenLight.pressed], ['light', 'false']);
    assert.notEqual(chosenLight.background, systemDark.background);
    await checkReadableLayout(dark);
    await dark.reload();
    assert.deepEqual(await pageColors(), chosenLight, 'Chosen appearance persists across reload');
    await dark.locator('#theme-toggle').focus();
    await dark.keyboard.press('Enter');
    assert.equal((await pageColors()).background, systemDark.background);
    await darkContext.close();
    out.checks.push('Appearance follows the system in light and dark, the toggle is keyboard operable and persists, and dark views and the palette keep 4.5:1 text contrast');
} catch (error) {
    out.errors.push(error.stack);
} finally {
    await browser.close();
    writeFileSync(outputPath(`${label}-agent-harness-prototype.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length) process.exitCode = 1;
}
