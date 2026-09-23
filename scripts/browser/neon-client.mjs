process.env.AGENT_PROVIDER = "demo";
import { origin, outputPath, httpCredentials } from './config.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canvas, target } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';
if (!process.env.DATABASE_TEST_URL)
    throw new Error('DATABASE_TEST_URL must identify the authorized disposable test database.');
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const label = process.argv[2] || 'candidate1', b = await chromium.launch();
const modules = testModules(), { transaction, databasePool } = modules.load('lib/db');
const { destinationHref } = modules.load('lib/navigation/model');
const canvasHref = owner => destinationHref({ version: 1, owner, surface: 'build', target, canvas });
const out = { label, checks: [], errors: [], cleanup: false, stage: 'bootstrap', responses: [] };
let namespace, confirmedTarget = false;
const c = await b.newContext({ httpCredentials, viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
c.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.startsWith('/api/')) return;
    const requestId = response.headers()['x-request-id'];
    out.responses.push({ pathname, status: response.status(), ...(/^[a-f0-9-]{36}$/i.test(requestId ?? '') ? { requestId } : {}) });
    if (out.responses.length > 40) out.responses.shift();
});
const headers = { Origin: origin, 'x-ufd-mutation': '1' };
async function post(data) { const response = await c.request.post(origin + '/api/session', { headers, data }); assert.equal(response.status(), 200, `session ${data.action} failed`); return (await response.json()).session; }
async function select(profileId) { let response = await c.request.get(origin + '/api/session'); let { session } = await response.json(); return post({ action: 'select', profileId, generation: session.generation, commandId: randomUUID() }); }
try {
    let session = await post({ action: 'bootstrap' });
    namespace = session.namespaceId;
    writeFileSync(outputPath('neon-client-namespace.json'), JSON.stringify([namespace]), { mode: 0o600 });
    assert.equal((await transaction(db => db.query('SELECT id FROM demo_namespaces WHERE id=$1', [namespace]))).rowCount, 1, 'Browser server and cleanup database must use the same test target');
    confirmedTarget = true;
    out.stage = 'select-first-persona';
    session = await select('jw');
    const p = await c.newPage();
    p.on('pageerror', e => out.errors.push(e.message));
    out.stage = 'open-canvas';
    await p.goto(origin + canvasHref(session.profileId));
    const input = p.getByRole('textbox', { name: 'Name', exact: true });
    const canvasPanel = p.getByRole('tabpanel');
    const retrySaving = canvasPanel.getByRole('button', { name: 'Retry saving', exact: true });
    out.stage = 'initial-canvas-field';
    await input.waitFor();
    const text = 'Phase6 saved ' + randomUUID().slice(0, 8);
    await input.fill(text);
    await input.blur();
    out.stage = 'save-canvas-field';
    await canvasPanel.locator('[data-persistence=saved]').waitFor({ timeout: 45000 });
    out.stage = 'reload-saved-canvas';
    await p.reload();
    await input.waitFor();
    assert.equal(await input.inputValue(), text);
    out.checks.push('Real Neon acknowledges new capability draft; reload restores saved field');
    out.stage = 'recover-interrupted-edit';
    const fail = route => route.request().method() === 'POST' ? route.abort('failed') : route.continue();
    await p.route('**/api/application*', fail);
    const latest = text + ' newer pending text';
    await input.fill(latest);
    await p.reload();
    await input.waitFor();
    assert.equal(await input.inputValue(), latest);
    await retrySaving.waitFor();
    await p.unroute('**/api/application*', fail);
    await retrySaving.click();
    await canvasPanel.locator('[data-persistence=saved]').waitFor({ timeout: 45000 });
    await p.reload();
    assert.equal(await input.inputValue(), latest);
    out.checks.push('Interrupted/coalesced edit remains in synchronous recovery buffer across immediate reload; retry saves exact latest field to Neon');
    out.stage = 'persona-isolation';
    session = await select('kf');
    await p.goto(origin + canvasHref(session.profileId));
    await input.waitFor();
    assert.equal(await input.inputValue(), '');
    session = await select('jw');
    await p.goto(origin + canvasHref(session.profileId));
    await input.waitFor();
    assert.equal(await input.inputValue(), latest);
    out.checks.push('Saved draft remains isolated by persona and returns when original persona resumes');
    const response = await c.request.get(origin + '/api/application?generation=' + encodeURIComponent(session.generation));
    assert.equal(response.status(), 200);
    const snapshot = await response.json();
    assert.equal(snapshot.canvases.find(v => v.canvas.params.capability === 'automation').fields.name, latest);
    out.stage = 'assessment';
    session = await select('sp');
    await p.goto(origin + '/');
    let assessmentRun;
    for (let i = 0; i < 50; i++) {
        const observed = await c.request.get(origin + '/api/agent?generation=' + encodeURIComponent(session.generation));
        assert.equal(observed.status(), 200);
        assessmentRun = (await observed.json()).runs.find(r => r.kind === 'assessment' && ['pending', 'running'].includes(r.status));
        if (assessmentRun)
            break;
        await p.waitForTimeout(300);
    }
    assert(assessmentRun, 'Sam automatic assessment queued');
    const { workerTick } = modules.load('lib/server/agent-worker'), { demoAdapter } = modules.load('lib/agent/demo');
    const fast = { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === 'progress' ? { ...result, delayMs: 0 } : result; } };
    for (let i = 0; i < 10; i++)
        if (!await workerTick({ runId: assessmentRun.id, adapter: fast }))
            break;
    await p.getByRole('button', { name: 'Shape a project', exact: true }).waitFor({ timeout: 45000 });
    out.stage = 'create-project';
    await p.getByRole('button', { name: 'Shape a project', exact: true }).click();
    const projectName = p.getByRole('textbox', { name: 'Project name', exact: true });
    await projectName.waitFor();
    const planName = 'Phase6 immediate creation ' + randomUUID().slice(0, 8);
    await projectName.fill(planName);
    await p.getByRole('button', { name: 'Create project', exact: true }).click();
    await p.getByRole('heading', { name: planName, exact: true }).waitFor({ timeout: 45000 });
    const planned = await c.request.get(origin + '/api/application?generation=' + encodeURIComponent(session.generation));
    assert.equal(planned.status(), 200);
    const plans = (await planned.json()).assessment.projects;
    assert.equal(plans.filter(v => v.name === planName).length, 1);
    out.checks.push('Actual Neon project creation flushes the newest assessment draft edit with correct revision before creating exactly one saved plan');
    out.stage = 'complete';
}
catch (e) {
    out.errors.push(e.stack);
}
finally {
    await b.close();
    if (namespace && confirmedTarget) {
        try {
            await transaction(async (db) => { await db.query('DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)', [namespace]); await db.query('DELETE FROM demo_sessions WHERE namespace_id=$1', [namespace]); await db.query('DELETE FROM workspaces WHERE namespace_id=$1', [namespace]); await db.query('DELETE FROM demo_namespaces WHERE id=$1', [namespace]); });
            out.cleanup = true;
            writeFileSync(outputPath('neon-client-namespace.json'), '[]', { mode: 0o600 });
        }
        catch (e) {
            out.errors.push('Cleanup: ' + e.message);
        }
    }
    await databasePool().end();
    modules.cleanup();
    writeFileSync(outputPath(`${label}-neon-client.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (out.errors.length)
        process.exitCode = 1;
}
