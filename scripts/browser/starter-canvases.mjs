import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session, assessment } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules();
const { updateConversation } = modules.load('lib/chat/conversation');
const { captureToday } = modules.load('lib/chat/today-snapshot');
const { demoProfileById } = modules.load('lib/demo-profiles');
const { STARTER_PROMPTS } = modules.load('lib/agent/starters');
const { destinationHref } = modules.load('lib/navigation/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const output = { label, checks: [], errors: [] };
try {
  for (const [profileId, title, surface, capability, motion = 'reduce'] of [
    ['jw', 'Start your first project', 'alm', 'project'],
    ['jw', 'Build your first agent', 'build', 'agent'],
    ['jw', 'Build a React app', 'code', 'react-app'],
    ['jw', 'Set up a release pipeline', 'alm', 'pipeline'],
    ['jw', 'Bring your project', 'code', 'sfdx-project'],
    ['kf', 'Build an app experience', 'build', 'experience'],
    ['jw', 'Build your first agent', 'build', 'agent', 'no-preference'],
  ]) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 0 });
    const current = { ...session, profileId }, profile = demoProfileById(profileId);
    state.snapshot.session = current;
    const today = captureToday({ capturedAt: '2026-09-19T12:00:00Z', profile, scope: 'global', projectName: 'All projects', branch: '', hasProjects: false, recent: [], working: 0, assessment });
    const saved = state.agent.conversations[0]; saved.conversation = { scopeKey: 'home', targetOrgId: 'uat', messages: [{ id: 1, role: 'today', snapshot: today }] };
    const commands = [];
    await context.route('**/api/session', route => route.fulfill({ json: { session: current } }));
    await context.route('**/api/agent*', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: state.agent });
      const command = route.request().postDataJSON().command; commands.push(command);
      assert.equal(command.kind, 'visit', 'Starter clicks never submit a model request');
      const withOrg = updateConversation(saved.conversation, { type: 'org', orgId: command.context.target.orgId, label: 'UAT Sandbox' });
      saved.conversation = updateConversation(withOrg, command.context.surface === 'home'
        ? { type: 'today', snapshot: today, force: command.refreshToday }
        : { type: 'surface', scopeKey: command.context.surface, label: command.context.surface, reply: 'Ready to help with this canvas.' });
      saved.revision++;
      return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
    });
    const page = await context.newPage(); page.on('pageerror', error => output.errors.push(error.message));
    const target = { projectId: null, worktreeId: null, orgId: 'uat' };
    await page.goto(origin + destinationHref({ version: 1, owner: profileId, surface: null, target }));
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    const replaceStarter = capability === 'pipeline';
    await composer.fill(replaceStarter ? STARTER_PROMPTS[1] : 'Keep this existing draft.');
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.waitForURL(url => url.pathname === '/' + surface);
    const destination = JSON.parse(new URL(page.url()).searchParams.get('destination'));
    assert.deepEqual(destination.target, target);
    assert.equal(destination.canvas.kind, 'capability'); assert.equal(destination.canvas.params.capability, capability);
    if (replaceStarter) assert.equal(await composer.inputValue(), STARTER_PROMPTS[3]);
    else assert((await composer.inputValue()).startsWith('Keep this existing draft.\n\n'));
    await page.waitForFunction(() => document.activeElement?.id === 'agent-composer');
    assert.equal(commands.filter(command => command.kind === 'submit').length, 0);
    const earlier = page.getByRole('group', { name: 'Earlier Today (read only)', exact: true });
    await earlier.waitFor();
    assert(await earlier.evaluate(node => node.disabled || !!node.closest('[inert]')), 'Departing Today immediately prevents interaction');
    await page.locator('fieldset[aria-label="Earlier Today (read only)"]:disabled').waitFor();
    assert.equal(await earlier.getByRole('button', { name: new RegExp(title) }).isDisabled(), true);
    assert.equal(state.agent.conversations.length, 1);
    output.checks.push(motion + ' ' + profileId + ': ' + title + ' opens ' + surface + '/' + capability + ', preserves org/draft/history, and does not submit');
    await context.close();
  }
  assert.deepEqual(output.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-starter-canvases.json`), JSON.stringify(output, null, 2));
  await browser.close(); modules.cleanup();
}
console.log(JSON.stringify(output, null, 2));
