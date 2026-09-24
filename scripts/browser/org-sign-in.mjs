import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules();
const { demoProfileById } = modules.load('lib/demo-profiles');
const { captureToday } = modules.load('lib/chat/today-snapshot');
const { updateConversation } = modules.load('lib/chat/conversation');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
async function prepare(width = 1440) {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', colorScheme: width < 500 ? 'light' : 'dark', viewport: { width, height: 1000 } });
  const { state } = await install(context, { drafts: 0, messages: 0 });
  let current = { ...session, profileId: null, workspaceEpoch: undefined }, failNext = false;
  const posts = [], visits = [];
  await context.route('**/api/session', async route => {
    if (route.request().method() === 'POST') {
      const command = route.request().postDataJSON(); posts.push(command);
      if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: { message: 'Try again', code: 'unavailable' } } }); }
      current = { ...current, profileId: command.action === 'signout' ? null : command.profileId, generation: `generation-${posts.length}`, workspaceEpoch: `epoch-${command.profileId}` };
      state.snapshot.session = current; state.agent.conversations = [];
    }
    return route.fulfill({ json: { session: current } });
  });
  await context.route('**/api/agent*', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: state.agent });
    const command = route.request().postDataJSON().command; visits.push(command);
    assert.equal(command.kind, 'visit', 'Sign-in must not submit model work');
    const snapshot = captureToday({ capturedAt: new Date().toISOString(), profile: demoProfileById(current.profileId), scope: 'global', projectName: 'All projects', branch: '', hasProjects: current.profileId === 'am', recent: [], working: 0, assessment: state.snapshot.assessment });
    const target = command.context.target, threadKey = JSON.stringify(target.projectId ? ['project-session', target.projectId, target.worktreeId] : ['unbound-session', null]);
    let saved = state.agent.conversations.find(item => item.threadKey === threadKey);
    if (!saved) { saved = { id: `conversation-${state.agent.conversations.length}`, threadKey, revision: 0, conversation: { scopeKey: 'home', messages: [] } }; state.agent.conversations.push(saved); }
    saved.conversation = updateConversation(saved.conversation, command.context.surface === 'home' ? { type: 'today', snapshot } : { type: 'surface', scopeKey: command.context.surface, label: command.context.surface, reply: 'Ready to continue.' });
    saved.revision++;
    return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
  });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  return { context, page, posts, visits, fail: () => { failNext = true; } };
}
try {
  for (const id of ['sp', 'jw', 'am', 'kf']) {
    const profile = demoProfileById(id), test = await prepare(id === 'kf' ? 375 : 1440);
    const { page, context, posts, visits } = test;
    try {
      await page.goto(origin + '/login');
      await page.getByRole('button', { name: new RegExp(profile.name + ' ') }).click();
      await page.getByRole('heading', { name: 'Choose an org', exact: true }).waitFor();
      assert.equal(posts.length, 0, 'Choosing a profile does not enter the workspace');
      assert(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled());
      assert.equal(await page.getByRole('radio', { name: /hotfix/i }).count(), 0);
      assert.equal(await page.getByRole('radio').count(), id === 'sp' ? 3 : 5);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      assert.equal(posts.length, 0);
      await page.getByRole('button', { name: new RegExp(profile.name + ' ') }).click();
      await page.getByRole('radio', { name: /SIT Sandbox/ }).check();
      if (id === 'sp') {
        test.fail(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'couldn’t sign in' }).waitFor();
        assert(await page.getByRole('radio', { name: /SIT Sandbox/ }).isChecked());
        assert.equal(new URL(page.url()).pathname, '/login');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.getByRole('button', { name: 'Continue', exact: true }).evaluate(button => {
        const style = getComputedStyle(button);
        return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.color !== style.backgroundColor;
      }), 'Continue remains a visible filled primary action in both themes');
      await page.screenshot({ path: outputPath(`${label}-choose-org-${id}.png`) });
      // Hold data and navigation briefly so the workspace-ready / login-route
      // handoff is observable even on a fast local server.
      await page.route('**/api/application*', async route => {
        if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 120));
        await route.fallback();
      });
      await page.route(url => url.pathname === '/' && url.searchParams.has('_rsc'), async route => {
        await new Promise(resolve => setTimeout(resolve, 250)); await route.continue();
      });
      await page.evaluate(() => {
        window.__signInTransition = { sawLoading: false, flashedLogin: false };
        const record = () => {
          const state = window.__signInTransition;
          if (document.querySelector('#session-heading')?.textContent === 'Opening your workspace…') state.sawLoading = true;
          if (state.sawLoading && document.querySelector('#login-heading')) state.flashedLogin = true;
        };
        window.__signInObserver = new MutationObserver(record);
        window.__signInObserver.observe(document.body, { childList: true, subtree: true });
      });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Switch org, current org: SIT Sandbox', exact: true }).waitFor();
      const transition = await page.evaluate(() => { window.__signInObserver.disconnect(); return window.__signInTransition; });
      assert.deepEqual(transition, { sawLoading: true, flashedLogin: false }, 'Loading stays visible until the signed-in workspace replaces login');
      await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
      assert.deepEqual(destination(page).target, { projectId: null, worktreeId: null, orgId: 'sit' });
      assert(visits.every(visit => visit.context.target.orgId === 'sit'), 'No first visit may run without the selected org');
      await page.reload();
      await page.getByRole('button', { name: 'Switch org, current org: SIT Sandbox', exact: true }).waitFor();
      if (id === 'kf') {
        await page.getByRole('group', { name: 'Today', exact: true }).getByRole('link', { name: 'Build & Setup', exact: true }).click();
        await page.getByRole('tab', { name: 'Build & Setup', exact: true }).waitFor();
        await page.locator('#workspace-panel-toggle').click();
        const previousView = destination(page);
        await page.getByRole('button', { name: `User menu for ${profile.name}`, exact: true }).click();
        await page.getByRole('button', { name: /Switch to Jordan Wright/ }).click();
        await page.getByRole('button', { name: 'Switch org, current org: UAT Sandbox', exact: true }).waitFor();
        await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
        assert.equal(await page.locator('#workspace-panel-toggle').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('#surface-panel-toggle').getAttribute('aria-pressed'), 'false');
        await page.getByRole('button', { name: 'User menu for Jordan Wright', exact: true }).click();
        await page.getByRole('button', { name: /Switch to Karen Flores/ }).click();
        await page.getByRole('button', { name: 'Switch org, current org: SIT Sandbox', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Build & Setup', exact: true }).waitFor();
        assert.deepEqual(destination(page), previousView);
        assert.equal(await page.locator('#workspace-panel-toggle').getAttribute('aria-pressed'), 'true');
      }
      out.checks.push(`${id}: required connected-org choice, global Home, first agent context and reload retain selected org; Back and responsive layout work`);
    } finally { await context.close(); }
  }
  for (const orgId of ['uat', 'sit']) {
    const { page, context } = await prepare();
    try {
      const requested = { version: 1, owner: 'jw', surface: 'build', target: { projectId: null, worktreeId: null, orgId: 'uat' }, canvas: { kind: 'org-resource', title: 'Account · UAT Sandbox', params: { orgId: 'uat', resourceType: 'standard-object', apiName: 'Account' } } };
      await page.goto(origin + '/build?destination=' + encodeURIComponent(JSON.stringify(requested)));
      await page.getByRole('button', { name: /Jordan Wright Platform operations/ }).click();
      assert(await page.getByRole('radio', { name: /UAT Sandbox/ }).isChecked(), 'A valid deep link suggests its captured org');
      await page.getByRole('radio', { name: orgId === 'uat' ? /UAT Sandbox/ : /SIT Sandbox/ }).check();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      if (orgId === 'uat') {
        await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
        assert.deepEqual(destination(page), requested);
      } else {
        await page.getByRole('group', { name: 'Today', exact: true }).waitFor();
        assert.equal(destination(page).surface, null); assert.equal(destination(page).target.orgId, 'sit');
        assert.equal(destination(page).canvas, undefined);
      }
      out.checks.push(`${orgId}: saved link resumes only in its matching org; changing org never retargets the saved canvas`);
    } finally { await context.close(); }
  }
  assert.deepEqual(out.errors, []);
} catch (error) { out.errors.push(error.stack); }
finally { await browser.close(); modules.cleanup(); writeFileSync(outputPath(`${label}-org-sign-in.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1; }
