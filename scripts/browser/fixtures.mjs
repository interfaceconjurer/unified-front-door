export const session = { namespaceId: '00000000-0000-4000-8000-000000000606', profileId: 'am', generation: 'phase6-browser-generation', workspaceEpoch: 'phase6-browser-epoch', expiresAt: '2099-01-01T00:00:00.000Z' };
export const target = { projectId: null, worktreeId: null, orgId: null };
import { testModules } from '../test-modules.mjs';
const profileModules = testModules();
export const profile = profileModules.load('lib/demo-profiles').demoProfileById('am');
profileModules.cleanup();
export const assessment = { schemaVersion: 2, status: 'idle', step: 0, scopeOrgIds: ['prod', 'uat', 'sit'], completedAt: null, draft: null, projects: [], runs: [], currentRunId: null };
export const canvas = { kind: 'capability', title: 'Build an automation', params: { scope: 'unbound', surface: 'build', capability: 'automation' } };
export const idFor = c => `canvas:v2:${JSON.stringify([c.kind, Object.entries(c.params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)])}`;
export const href = '/build?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'am', surface: 'build', target, canvas }));
const catalog = { build: ['automation', 'data-model', 'agent', 'experience'], code: ['sfdx-project', 'react-app', 'apex', 'query', 'tests', 'agent', 'toolkit'], govern: ['security', 'health', 'policies', 'agent-activity'], alm: ['work', 'pipeline', 'validation', 'release'] };
export function fixtures(drafts = 1, messages = 20) {
    const inputs = Object.entries(catalog).flatMap(([surface, keys]) => keys.map(capability => ({ kind: 'capability', title: capability, params: { scope: 'unbound', surface, capability } })));
    inputs.push({ kind: 'capability', title: 'Toolkit skills', params: { scope: 'unbound', surface: 'code', capability: 'toolkit', section: 'skills' } });
    inputs[0] = canvas;
    const canvases = inputs.slice(0, drafts).map((c, i) => ({ id: idFor(c), surface: c.params.surface, canvas: c, target, fields: { name: i ? 'Saved ' + i : '', goal: 'Representative saved draft. '.repeat(700) }, revision: 1 }));
    const prefs = Object.fromEntries(Object.keys(catalog).map(s => [s, { canvases: canvases.filter(c => c.surface === s).map(c => ({ ...c.canvas, id: c.id })), activeCanvasId: s === 'build' ? idFor(canvas) : 'overview', closedDrafts: {}, targets: {} }]));
    const brief = { capturedAt: '2026-09-15T14:00:00.000Z', profile, projectName: 'No project', branch: '', hasProjects: false, recent: [], totalRecent: 0, truncated: false, working: 0, assessment: { ...assessment, findings: [], totalFindings: 0, totalProjects: 0, findingsAvailable: true, truncated: false } };
    const thread = Array.from({ length: messages }, (_, i) => i % 8 === 0 ? { id: i + 1, role: 'today', snapshot: structuredClone(brief) } : { id: i + 1, role: i % 2 ? 'agent' : 'user', text: `History entry ${i + 1}. ` + 'Representative conversation text. '.repeat(16) });
    return { snapshot: { session, assessment: structuredClone(assessment), assessmentRevision: 0, canvases, imports: [] }, prefs, agent: { conversations: [{ id: 'phase6-conversation', threadKey: JSON.stringify(['unbound-session', null]), revision: 1, conversation: { scopeKey: 'build', messages: thread } }], runs: [] } };
}
export async function install(context, { drafts = 1, messages = 20, latency = 80 } = {}) {
    const state = fixtures(drafts, messages), stats = { posts: 0, requestBytes: 0, gets: 0, commands: [] };
    await context.addInitScript(({ prefs, session }) => {
        // Zero drafts leaves normal profile seed tabs intact in project workspaces.
        if (Object.values(prefs).some(slice => slice.canvases.length)) localStorage.setItem(`ufd.canvas-preferences.v2.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`, JSON.stringify(prefs));
        const original = Storage.prototype.setItem;
        window.__metrics = { writes: 0, writeBytes: 0, inputFrames: [], measuring: false };
        Storage.prototype.setItem = function (k, v) { if (window.__metrics.measuring && k.startsWith('ufd.pending.')) {
            window.__metrics.writes++;
            window.__metrics.writeBytes += new TextEncoder().encode(v).length;
        } return original.call(this, k, v); };
        document.addEventListener('input', () => { if (window.__metrics.measuring) {
            const start = performance.now();
            requestAnimationFrame(() => window.__metrics.inputFrames.push(performance.now() - start));
        } }, true);
    }, { prefs: state.prefs, session });
    await context.route('**/api/session', route => route.fulfill({ json: { session } }));
    await context.route('**/api/agent*', route => {
        const runId = new URL(route.request().url()).searchParams.get('runId');
        return route.fulfill({ json: route.request().method() === 'GET'
            ? runId ? { run: state.agent.runs.find(run => run.id === runId), events: [] } : state.agent
            : { result: { conversationId: 'phase6-conversation' } } });
    });
    await context.route('**/api/application*', async (route) => {
        if (route.request().method() === 'GET') {
            stats.gets++;
            return route.fulfill({ json: state.snapshot });
        }
        stats.posts++;
        const body = route.request().postDataJSON();
        stats.requestBytes += Buffer.byteLength(route.request().postData() || '');
        const cmd = body.command;
        stats.commands.push(structuredClone(cmd));
        await new Promise(resolve => setTimeout(resolve, latency));
        if (cmd.kind === 'canvas.save') {
            let c = state.snapshot.canvases.find(c => c.id === idFor(cmd.canvas));
            if (!c) {
                c = { id: idFor(cmd.canvas), surface: cmd.surface, canvas: cmd.canvas, target: cmd.target, fields: {}, revision: 0 };
                state.snapshot.canvases.push(c);
            }
            c.fields = { ...c.fields, ...cmd.fields };
            c.revision++;
            return route.fulfill({ json: { result: { revision: c.revision } } });
        }
        return route.fulfill({ json: { result: { revision: ++state.snapshot.assessmentRevision } } });
    });
    return { state, stats };
}
