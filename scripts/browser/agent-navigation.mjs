import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules();
const { navigationOptions } = modules.load('lib/agent/navigation');
const { demoProfileById } = modules.load('lib/demo-profiles');
const { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
try {
  for (const scenario of ['surface', 'canvas', 'stale', 'failed', 'retry', 'reload']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 0 });
    const currentSession = { ...session, profileId: 'am' };
    const target = { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' };
    const captured = { profile: demoProfileById('am'), target, surface: 'code', orgLabel: 'UAT Sandbox', improvement: null };
    const action = { ...navigationOptions(captured).find(option => option.id === (scenario === 'surface' ? 'surface:build' : 'resource:standard-object:Account')), toolCallId: 'toolu_browser' };
    assert(action.destination);
    state.snapshot.session = currentSession;
    const saved = state.agent.conversations[0];
    saved.threadKey = JSON.stringify(['project-session', target.projectId, target.worktreeId]);
    saved.conversation.scopeKey = 'code';
    let run;
    const publish = (status = 'completed') => {
      run.status = status; run.sequence++; run.result = 'The Account object is available in Build & Setup.';
      const message = saved.conversation.messages.at(-1);
      message.text = run.result;
      if (status === 'completed') message.navigation = structuredClone(action);
      saved.revision++;
    };
    await context.route('**/api/session', route => route.fulfill({ json: { session: currentSession } }));
    await context.route('**/api/agent*', route => {
      const request = route.request();
      if (request.method() === 'GET') {
        const runId = new URL(request.url()).searchParams.get('runId');
        return route.fulfill({ json: runId ? { run: state.agent.runs.find(item => item.id === runId), events: [] } : state.agent });
      }
      const command = request.postDataJSON().command;
      if (command.kind === 'submit' || command.kind === 'retry') {
        const retry = command.kind === 'retry';
        run = { id: retry ? 'retry-navigation-run' : 'navigation-run', requestId: command.requestId, turnId: 'navigation-turn',
          conversationId: saved.id, retryOf: retry ? 'navigation-run' : null, kind: 'chat', status: 'running', sequence: 1,
          checkpoint: 0, result: null, error: null, context: { target, surface: 'code' }, assessmentRunId: null,
          createdAt: '2026-09-19T12:00:00Z', updatedAt: '2026-09-19T12:00:00Z', execution: { provider: 'anthropic', model: 'fixture' } };
        state.agent.runs.push(run);
        saved.conversation.messages = [
          { id: 1, role: 'user', text: 'Open the Account object', turnId: run.turnId, runId: run.id },
          { id: 2, role: 'agent', text: '', turnId: run.turnId, runId: run.id },
        ];
        saved.revision++;
      }
      return route.fulfill({ json: { result: { conversationId: saved.id, ...(run ? { runId: run.id, turnId: run.turnId } : {}) } } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: 'code', target }));
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Open the Account object');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.locator('[data-run-status="running"]').waitFor();
    if (scenario === 'stale') {
      await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
      await dialog.getByRole('option').filter({ has: page.getByText('ALM', { exact: true }) }).getByRole('button').click();
      await page.waitForURL(url => url.pathname === '/alm');
    }
    if (scenario === 'reload') {
      await page.reload();
      await composer.waitFor();
    }
    if (scenario === 'retry') {
      publish('failed');
      run.error = { code: 'model_failed', message: 'Fixture failure', retryable: true, effects: 'none' };
      await page.getByRole('button', { name: 'Retry reply', exact: true }).click();
      await page.locator('[data-run-id="retry-navigation-run"][data-run-status="running"]').waitFor();
    }
    publish(scenario === 'failed' ? 'failed' : 'completed');
    if (['surface', 'canvas', 'retry'].includes(scenario)) {
      await page.waitForURL(url => url.pathname === '/build');
      const destination = JSON.parse(new URL(page.url()).searchParams.get('destination'));
      assert.deepEqual(destination.target, target);
      assert.equal(destination.canvas?.kind, scenario === 'surface' ? undefined : 'org-resource');
      if (destination.canvas) assert.equal(destination.canvas.params.apiName, 'Account');
      await composer.fill('A draft after navigating');
      await page.waitForTimeout(800);
      assert.equal(await composer.inputValue(), 'A draft after navigating');
      await page.reload();
      await composer.waitFor();
      assert.equal(new URL(page.url()).pathname, '/build');
    } else {
      await page.locator('[data-run-status="' + (scenario === 'failed' ? 'failed' : 'completed') + '"]').waitFor();
      if (scenario !== 'failed') {
        await page.getByRole('button', { name: 'Open Account · Standard object', exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, scenario === 'stale' ? '/alm' : '/code');
        await page.getByRole('button', { name: 'Open Account · Standard object', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/build');
        assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('destination')).target, target);
      } else {
        assert.equal(new URL(page.url()).pathname, '/code');
        assert.equal(await page.getByRole('button', { name: /^Open Account/ }).count(), 0);
      }
    }
    out.checks.push(scenario + ': scoped navigation and replay rules pass');
    await context.close();
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-agent-navigation.json`), JSON.stringify(out, null, 2));
  await browser.close(); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
