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
const { PROJECTS, ORGS } = modules.load('lib/workspace/fixtures');
const { RETURNING_WORK } = modules.load('lib/workspace/returning-work');
const { workCanvasInput } = modules.load('lib/workspace/returning-work');
const { canvasId } = modules.load('lib/surface-canvas/model');
const { emptyState } = modules.load('lib/surface-canvas/persistence');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const key = target => JSON.stringify(target.projectId ? ['project-session', target.projectId, target.worktreeId] : ['unbound-session', null]);
const recent = RETURNING_WORK.map(work => {
  const project = PROJECTS.find(project => project.id === work.projectId);
  return { ...work, projectName: project.name, branch: project.worktrees.find(tree => tree.id === work.worktreeId).branch };
});
const today = captureToday({ capturedAt: '2026-09-18T14:00:00Z', profile: demoProfileById('am'), scope: 'global', projectName: 'All projects', branch: '', hasProjects: true, recent, working: 1, assessment });
async function selectProject(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
  const option = name === 'Trailblazer CRM' ? dialog.getByRole('option').filter({ has: page.getByText(name, { exact: true }) }) : dialog.getByRole('option').filter({ hasText: name });
  await option.getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
}
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const readingPosition = node => {
  const top = node.getBoundingClientRect().top;
  const anchor = [...node.querySelectorAll('[data-message-id]')].find(entry => entry.getBoundingClientRect().bottom > top + 1);
  return { id: anchor?.dataset.messageId, offset: anchor?.getBoundingClientRect().top - top };
};
async function checkContextMotion(page, motion, before) {
  if (motion === 'no-preference') {
    await page.waitForFunction(count => window.__contextMotion.length > count, before);
    const frames = await page.evaluate(count => window.__contextMotion.slice(count), before);
    assert(frames.some(frame => frame.name === 'workspace-blur-out' && frame.pseudo?.includes('agent-conversation') && frame.filters.includes('blur(24px)')), 'Outgoing conversation must blur out');
    assert(frames.some(frame => frame.name === 'workspace-blur-in' && frame.pseudo?.includes('agent-conversation')), 'Incoming conversation must dissolve in');
  } else assert.equal(await page.evaluate(() => window.__contextMotion.length), before, 'Reduced motion must skip the dissolve');
  assert(await page.getByRole('textbox', { name: 'Message the agent', exact: true }).evaluate(node => node === window.__originalComposer && getComputedStyle(node).filter === 'none'), 'The composer stays mounted and sharp');
}
try {
  for (const motion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, colorScheme: 'dark', viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      window.__contextMotion = [];
      const seen = new WeakSet();
      const capture = () => {
        for (const animation of document.getAnimations()) {
          if (!animation.animationName?.startsWith('workspace-blur-') || seen.has(animation)) continue;
          seen.add(animation);
          window.__contextMotion.push({ name: animation.animationName, pseudo: animation.effect.pseudoElement, filters: animation.effect.getKeyframes().map(frame => frame.filter) });
        }
        requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
    });
    const { state } = await install(context, { drafts: 0, messages: 0 });
    const current = { ...session, profileId: 'am' };
    // This scenario starts with project files previously opened explicitly in
    // Home. Global tabs no longer inherit the project's open-tab preferences.
    const globalPrefs = emptyState();
    for (const work of RETURNING_WORK) {
      const canvas = workCanvasInput(work);
      globalPrefs[work.surfaceId].canvases.push({ ...canvas, id: canvasId(canvas.kind, canvas.params) });
    }
    await context.addInitScript(({ key, prefs }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(prefs));
    }, { key: `ufd.canvas-preferences.v3.${current.namespaceId}.${current.profileId}.${current.workspaceEpoch}.${key({})}`, prefs: globalPrefs });
    state.snapshot.session = current;
    const projectKey = key({ projectId: 'trailblazer-crm', worktreeId: 'main' });
    state.agent.conversations = [{ id: 'crm-thread', threadKey: projectKey, revision: 1, conversation: { scopeKey: 'code', messages: [
      { id: 1, role: 'today', snapshot: { ...today, scope: undefined } },
      ...Array.from({ length: 42 }, (_, i) => ({ id: i + 2, role: i % 2 ? 'agent' : 'user', text: `Project history ${i + 2}. ` + 'Keep the context of this line of work. '.repeat(8) })),
    ] } }, { id: 'earlier-prod-thread', threadKey: JSON.stringify(['unbound-session', 'prod']), revision: 1, conversation: { scopeKey: 'build', messages: [
      { id: 1, role: 'user', text: 'Earlier Production discussion is preserved.' },
    ] } }];
    await context.route('**/api/session', route => route.fulfill({ json: { session: current } }));
    const commands = [];
    await context.route('**/api/agent*', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: state.agent });
      const command = route.request().postDataJSON().command;
      commands.push(command);
      assert.equal(command.kind, 'visit', 'Navigation checks must not submit model work');
      const threadKey = key(command.context.target);
      let saved = state.agent.conversations.find(saved => saved.threadKey === threadKey);
      if (!saved) { saved = { id: `thread-${state.agent.conversations.length}`, threadKey, revision: 0, conversation: { scopeKey: 'home', messages: [] } }; state.agent.conversations.push(saved); }
      const orgId = command.context.target.orgId;
      const withOrg = command.refreshToday && saved.conversation.messages.at(-1)?.role === 'today'
        ? { ...saved.conversation, targetOrgId: orgId }
        : updateConversation(saved.conversation, { type: 'org', orgId, label: ORGS.find(org => org.id === orgId)?.label ?? null });
      const next = updateConversation(withOrg, command.context.surface === 'home'
        ? command.context.target.projectId ? { type: 'project', label: 'Project', reply: 'Ready for the next step.' } : { type: 'today', snapshot: today, force: command.refreshToday }
        : { type: 'surface', scopeKey: command.context.surface, label: command.context.surface, reply: `Continue your work in ${command.context.surface}.` });
      if (next !== saved.conversation) { saved.conversation = next; saved.revision++; }
      return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
    });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const emptyHome = { version: 1, owner: 'am', surface: null, target: { projectId: null, worktreeId: null, orgId: null } };
    await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify(emptyHome)));
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    assert.equal(await page.getByRole('button', { name: /Switch project, current/ }).count(), 0);
    await page.getByRole('button', { name: 'Review Lead routing → UAT', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Review Integration user access', exact: true }).waitFor();
    assert((await page.getByRole('article', { name: 'Today briefing' }).innerText()).includes('Acme Storefront'));
    const homeButton = page.getByRole('link', { name: 'Global home', exact: true });
    assert.equal(await homeButton.getAttribute('aria-current'), 'location');
    const initialHistory = await page.evaluate(() => history.length), initialCommands = commands.length;
    const initialMotion = await page.evaluate(() => window.__contextMotion.length);
    await homeButton.click(); await homeButton.click();
    assert.equal(commands.length, initialCommands, 'Already on Today must not send a visit');
    assert.equal(await page.evaluate(() => history.length), initialHistory, 'Already on Today must not push history');
    assert.equal(await page.evaluate(() => window.__contextMotion.length), initialMotion, 'Already on Today must not animate');
    const initialToday = structuredClone(state.agent.conversations.find(saved => saved.threadKey === key({})).conversation.messages.at(-1));
    await selectProject(page, 'Trailblazer CRM');
    await page.waitForURL(url => url.pathname === '/code');
    await homeButton.click();
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    assert.equal(destination(page).target.orgId, 'uat', 'Home retains the org selected in the project');
    assert.deepEqual(state.agent.conversations.find(saved => saved.threadKey === key({})).conversation.messages.at(-1), initialToday, 'The first project return must reuse Today even when it brings back a newly selected org');
    assert.equal(await page.getByRole('article', { name: 'Today briefing' }).count(), 1);
    out.checks.push(`${motion}: first return from a project carries its org without duplicating the existing Today`);
    const earlierChat = page.getByRole('complementary', { name: 'Earlier org conversations' });
    await earlierChat.getByText('Earlier conversation · Production', { exact: true }).click();
    await earlierChat.getByText('Earlier Production discussion is preserved.', { exact: true }).waitFor();
    assert.equal(await earlierChat.locator('[data-message-id]').count(), 0, 'Archived IDs must not collide with global scroll anchors');
    await earlierChat.getByText('Earlier conversation · Production', { exact: true }).click();
    await page.screenshot({ path: outputPath(`${label}-global-today-${motion}.png`) });
    out.checks.push(`${motion}: bare Home is global, with attention and recent work across projects and branches`);

    const globalComposer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await globalComposer.evaluate(node => { window.__originalComposer = node; });
    await globalComposer.fill('Keep this global draft across orgs');
    const globalThread = state.agent.conversations.find(saved => saved.threadKey === key({}));
    const firstToday = globalThread.conversation.messages.find(message => message.role === 'today');
    const todayCount = () => globalThread.conversation.messages.filter(message => message.role === 'today').length;
    const firstBriefing = page.locator(`[data-message-id="${firstToday.id}"]`);
    const firstText = await firstBriefing.innerText();
    await firstBriefing.getByRole('group', { name: 'Today', exact: true }).evaluate(node => { window.__originalToday = node; });
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    const beforeResource = await page.evaluate(() => window.__contextMotion.length);
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    let orgDialog = page.getByRole('dialog');
    await orgDialog.getByRole('tab', { name: 'Resources', exact: true }).click();
    await orgDialog.getByLabel('Resource org', { exact: true }).selectOption('prod');
    await orgDialog.getByLabel('Resource type', { exact: true }).selectOption('standard-object');
    await orgDialog.getByRole('combobox', { name: 'Search resources…', exact: true }).fill('Account');
    await orgDialog.getByRole('option').filter({ hasText: 'Standard object · Account' }).getByRole('button').click();
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.equal(await homeButton.getAttribute('aria-current'), 'location', 'Home stays selected during global surface browsing');
    await page.getByText('Target org · Production', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    assert.equal(await page.evaluate(() => window.__contextMotion.length), beforeResource, 'Opening a surface from Today must keep the continuous conversation sharp');
    const historicalToday = page.locator(`[data-message-id="${firstToday.id}"]`);
    const readOnlyToday = historicalToday.getByRole('group', { name: 'Earlier Today (read only)', exact: true });
    await readOnlyToday.waitFor();
    assert.equal(await historicalToday.innerText(), firstText, 'All original headings, cards, surface tiles and recent rows stay recognizable');
    assert(await readOnlyToday.evaluate(node => node === window.__originalToday), 'Today keeps the same mounted layout when it becomes history');
    assert.equal(await historicalToday.locator('button:enabled, a[href], input:enabled, select:enabled').count(), 0, 'Historical controls must be disabled');
    assert((await historicalToday.locator('button:disabled').count()) > 10, 'Retain the actual attention cards and recent work rows');
    assert(await readOnlyToday.evaluate(node => [...node.querySelectorAll('*')].every(element => {
      const style = getComputedStyle(element);
      const container = element.hasAttribute('data-today-container');
      return style.backgroundColor === (container ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0)') && style.backgroundImage === 'none' && style.boxShadow === 'none'
        && ['Top', 'Right', 'Bottom', 'Left'].every(side => style[`border${side}Width`] === '0px' || style[`border${side}Color`] === (container ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0)'));
    })), 'Inactive Today keeps its text and geometry with barely visible container fills and outlines');
    assert.equal(await globalComposer.inputValue(), 'Keep this global draft across orgs');
    assert.equal(state.agent.conversations.filter(saved => saved.threadKey === key({})).length, 1);
    assert.equal(state.agent.conversations.find(saved => saved.id === 'earlier-prod-thread').conversation.messages[0].text, 'Earlier Production discussion is preserved.');
    await historicalToday.scrollIntoViewIfNeeded();
    await page.screenshot({ path: outputPath(`${label}-today-history-${motion}.png`) });
    const beforeFile = commands.length;
    const projectHistory = structuredClone(state.agent.conversations.find(saved => saved.threadKey === projectKey));
    await page.getByRole('tab', { name: 'Lead routing assistant', exact: true }).click();
    await page.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
    assert.deepEqual(destination(page).target, { projectId: null, worktreeId: null, orgId: 'prod' });
    assert.deepEqual(destination(page).canvasTarget, { projectId: 'trailblazer-crm', worktreeId: 'lead-routing', orgId: 'uat' });
    assert.equal(await homeButton.getAttribute('aria-current'), 'location');
    assert.equal(await page.getByRole('button', { name: /Switch project, current/ }).count(), 0);
    assert.equal(await globalComposer.inputValue(), 'Keep this global draft across orgs');
    assert((await page.locator('[role="tabpanel"]').innerText()).includes('Trailblazer CRM'), 'The canvas still identifies its owning project');
    const globalNotes = page.getByRole('textbox', { name: 'Your notes', exact: true });
    await globalNotes.fill('Saved from the global workspace');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tabpanel"]')].some(panel => panel.textContent.includes('Saved to database')));
    const savedGlobalCanvas = state.snapshot.canvases.find(canvas => canvas.canvas.params.workId === 'lead-routing-agent');
    assert.equal(savedGlobalCanvas.fields.notes, 'Saved from the global workspace');
    assert.deepEqual(savedGlobalCanvas.target, destination(page).canvasTarget, 'Global edits preserve the original file ownership');
    assert(commands.slice(beforeFile).every(command => command.context.target.projectId === null));
    assert.deepEqual(state.agent.conversations.find(saved => saved.threadKey === projectKey), projectHistory);
    await page.getByRole('tab', { name: 'Account · Production', exact: true }).click();
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    out.checks.push(`${motion}: resource-to-project-owned tab keeps global org, chat and Home selected; owning project remains visible and edits save to that canvas`);
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    orgDialog = page.getByRole('dialog');
    await orgDialog.getByRole('tab', { name: 'Orgs', exact: true }).click();
    const beforeOrg = await page.evaluate(() => window.__contextMotion.length);
    await orgDialog.getByRole('option').filter({ hasText: 'UAT Sandbox' }).getByRole('button').click();
    await page.waitForFunction(() => {
      const messages = [...document.querySelectorAll('[data-kind="context"]')];
      return messages.at(-1)?.textContent.startsWith('Target org · UAT Sandbox');
    });
    assert.equal(await globalComposer.inputValue(), 'Keep this global draft across orgs');
    assert.equal(await page.evaluate(() => window.__contextMotion.length), beforeOrg, 'Org changes stay in the same continuous chat without a dissolve');
    assert.equal(globalThread.conversation.messages.some(message => message.id === firstToday.id && message.role === 'today'), true);
    await page.getByRole('link', { name: 'Platform Studio home', exact: true }).click();
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition') && document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    assert.equal(await page.evaluate(() => window.__contextMotion.length), beforeOrg, 'Platform Studio returns to Today within global context without blurring chat');
    assert.deepEqual(destination(page).target, { projectId: null, worktreeId: null, orgId: 'uat' });
    assert.equal(await globalComposer.inputValue(), 'Keep this global draft across orgs');
    assert.equal(await page.locator('fieldset:not(:disabled)').getByRole('navigation', { name: 'Explore surfaces', exact: true }).count(), 1);
    assert.equal(todayCount(), 2, 'Returning from a surface appends exactly one Today');
    assert.equal(await page.locator('#surface-panel').getAttribute('inert'), '', 'Home closes the surface');
    assert.equal(await historicalToday.locator('button:enabled, a[href]').count(), 0);
    const geometry = await readOnlyToday.evaluate(node => {
      const rows = root => [...root.querySelectorAll('[data-today-row]')].map(row => ({ order: row.dataset.todayRow, width: row.offsetWidth, height: row.offsetHeight }));
      // Compare in one frame while the surrounding panel can still be resizing.
      return { history: rows(node), live: rows(document.querySelector('fieldset[aria-label="Today"]')) };
    });
    assert.deepEqual(geometry.history, geometry.live, 'At the same width, read-only Today retains the exact row/card geometry');
    assert(await readOnlyToday.evaluate(node => node.getAnimations({ subtree: true }).every(animation => !(animation instanceof CSSAnimation))), 'Historical rows never replay entrance animations');
    await page.screenshot({ path: outputPath(`${label}-org-continuity-${motion}.png`) });
    out.checks.push(`${motion}: continuous org browsing; disabled Today preserves mounted content and geometry without replaying reveal; Home retains org and draft`);

    const beforeProject = await page.evaluate(() => window.__contextMotion.length);
    await selectProject(page, 'Trailblazer CRM');
    await page.waitForURL(url => url.pathname === '/code');
    assert.equal(await homeButton.getAttribute('aria-current'), null, 'Home is not selected in a project');
    await checkContextMotion(page, motion, beforeProject);
    await page.locator('[data-message-id="43"]').waitFor();
    assert.equal(await page.getByRole('article', { name: 'Today briefing' }).count(), 0, 'Legacy Today must not render inside project history');
    const beforeSameSurface = await page.evaluate(() => window.__contextMotion.length);
    await selectProject(page, 'hotfix/W-9821');
    await page.waitForURL(url => url.pathname === '/code' && JSON.parse(url.searchParams.get('destination')).target.worktreeId === 'hotfix-9821');
    await checkContextMotion(page, motion, beforeSameSurface);
    await selectProject(page, 'Trailblazer CRM');
    await page.waitForURL(url => url.pathname === '/code' && JSON.parse(url.searchParams.get('destination')).target.worktreeId === 'main');
    const composer = page.getByRole('textbox', { name: 'Message the agent', exact: true });
    await composer.fill('Keep this project draft');
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Resources', exact: true }).click();
    await dialog.getByLabel('Resource type', { exact: true }).selectOption('standard-object');
    await dialog.getByRole('combobox', { name: 'Search resources…', exact: true }).fill('Account');
    await dialog.getByRole('option').filter({ hasText: 'Standard object · Account' }).getByRole('button').click();
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    await page.getByText('Continue your work in build.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Acme Storefront', exact: true }).count(), 0, 'Other projects must be absent from project tabs');
    assert.equal(await page.getByRole('tab', { name: 'Account · Production', exact: true }).count(), 0, 'Global resources must be absent from project tabs');
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    const savedDestination = destination(page), savedThread = structuredClone(state.agent.conversations.find(saved => saved.threadKey === projectKey));
    const transcript = page.getByRole('log', { name: 'Conversation', exact: true });
    let savedPosition;
    if (motion === 'reduce') {
      await transcript.evaluate(node => { const entry = node.querySelector('[data-message-id="35"]'); node.scrollTop += entry.getBoundingClientRect().top - node.getBoundingClientRect().top + 25; });
      await page.waitForTimeout(150); // The reading-position preference is debounced.
      savedPosition = await transcript.evaluate(readingPosition);
    }
    const beforeReturn = todayCount();
    const beforeProjectHome = await page.evaluate(() => window.__contextMotion.length);
    const trailingToday = structuredClone(globalThread.conversation.messages.at(-1));
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    await page.locator(`[data-message-id="${trailingToday.id}"] fieldset[aria-label="Today"]`).waitFor();
    await checkContextMotion(page, motion, beforeProjectHome);
    assert.equal(todayCount(), beforeReturn, 'Project activity must not duplicate a trailing global Today');
    assert.deepEqual(globalThread.conversation.messages.at(-1), trailingToday, 'Reuse the same Today identity, content and timestamp');
    out.checks.push(`${motion}: Home reuses trailing Today after project activity; global surface or org content still earns a new Today`);
    assert.equal(destination(page).target.orgId, savedDestination.target.orgId, 'Leaving a project retains its org');
    await selectProject(page, 'Trailblazer CRM');
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.deepEqual(destination(page), savedDestination);
    assert.equal(await composer.inputValue(), 'Keep this project draft');
    if (savedPosition) {
      const restored = await transcript.evaluate(readingPosition);
      assert.equal(restored.id, savedPosition.id); assert(Math.abs(restored.offset - savedPosition.offset) < 3, 'Project reading position should resume');
    }
    assert.deepEqual(state.agent.conversations.find(saved => saved.threadKey === projectKey), savedThread, 'Resuming must not append a greeting or briefing');
    assert.equal(await page.getByRole('article', { name: 'Today briefing' }).count(), 0);
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/');
    await page.reload();
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    await composer.evaluate(node => { window.__originalComposer = node; });
    await selectProject(page, 'Trailblazer CRM');
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.deepEqual(destination(page), savedDestination, 'Remembered project canvas must survive reload');
    await page.screenshot({ path: outputPath(`${label}-project-resumed-${motion}.png`) });
    out.checks.push(`${motion}: project resumes exact canvas, branch, org and transcript; draft survives Home; destination survives reload`);
    const beforeBranch = await page.evaluate(() => window.__contextMotion.length);
    await selectProject(page, 'feature/lead-routing');
    await page.waitForURL(url => url.pathname === '/alm');
    await checkContextMotion(page, motion, beforeBranch);
    assert.equal(destination(page).target.worktreeId, 'lead-routing');
    await selectProject(page, 'Trailblazer CRM');
    await page.getByRole('article', { name: 'Account resource', exact: true }).waitFor();
    assert.deepEqual(destination(page), savedDestination, 'Another branch must not overwrite main’s last canvas');
    await page.goBack();
    await page.waitForURL(url => url.pathname === '/alm');
    assert.equal(destination(page).target.worktreeId, 'lead-routing');
    out.checks.push(`${motion}: independent branch resumption and browser Back retain context`);
    out.checks.push(`${motion}: entering/leaving projects and worktrees dissolves; global surface-to-Today and org-only changes keep chat sharp`);

    // Keep a project builder draft, then browse cross-project operations in
    // global ALM and confirm project scope isolates tabs on return.
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    const surfaces = page.getByRole('dialog');
    await surfaces.getByRole('tab', { name: 'Surfaces', exact: true }).click();
    await surfaces.getByRole('option').filter({ has: page.getByText('Build & Setup', { exact: true }) }).getByRole('button').click();
    await page.getByRole('tab', { name: 'Lead routing assistant', exact: true }).click();
    assert.equal(destination(page).target.projectId, 'trailblazer-crm');
    assert.equal(await page.getByRole('tab', { name: 'Acme Storefront', exact: true }).count(), 0);
    const notes = page.getByRole('textbox', { name: 'Your notes', exact: true });
    await notes.fill('Keep this lead-routing draft');
    await homeButton.click();
    await page.locator('fieldset:not(:disabled)').getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
    const beforeAlm = await page.evaluate(() => window.__contextMotion.length);
    await page.locator('fieldset:not(:disabled)').getByRole('navigation', { name: 'Explore surfaces', exact: true }).getByRole('link', { name: 'ALM', exact: true }).click();
    await page.getByRole('tab', { name: 'Acme Storefront', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Lead routing → UAT', exact: true }).waitFor();
    await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition') && document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    assert.equal(await page.evaluate(() => window.__contextMotion.length), beforeAlm, 'Opening ALM from Today must scroll and append content without a workspace blur');
    out.checks.push(`${motion}: Today-to-surface navigation keeps the continuous chat sharp while the surface opens`);
    assert.equal(destination(page).target.projectId, null, 'Global surface may display tabs across projects');
    await page.getByRole('tab', { name: 'Acme Storefront', exact: true }).click();
    await page.getByRole('heading', { name: 'Acme Storefront', exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    assert.equal(destination(page).canvasTarget.projectId, 'acme-storefront');
    assert.equal(await page.getByRole('tab', { name: 'Lead routing → UAT', exact: true }).count(), 1);
    assert.equal(await homeButton.getAttribute('aria-current'), 'location');
    const globalApp = destination(page);
    await page.reload();
    await page.getByRole('heading', { name: 'Acme Storefront', exact: true }).waitFor();
    assert.deepEqual(destination(page), globalApp, 'Reload retains the global view and separate canvas ownership');
    await page.getByRole('tab', { name: 'Lead routing → UAT', exact: true }).click();
    await page.getByRole('heading', { name: 'Lead routing → UAT', exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    await page.goBack();
    await page.getByRole('heading', { name: 'Acme Storefront', exact: true }).waitFor();
    assert.deepEqual(destination(page), globalApp);
    await page.goForward();
    await page.getByRole('heading', { name: 'Lead routing → UAT', exact: true }).waitFor();
    assert.equal(destination(page).target.projectId, null);
    await selectProject(page, 'feature/lead-routing');
    await page.getByRole('heading', { name: 'Lead routing assistant', exact: true }).waitFor();
    assert.equal(await notes.inputValue(), 'Keep this lead-routing draft');
    await page.getByRole('button', { name: 'Close Lead routing assistant', exact: true }).click();
    await page.getByRole('tab', { name: 'Lead routing assistant', exact: true }).waitFor({ state: 'detached' });
    assert.equal(destination(page).target.projectId, 'trailblazer-crm', 'Closing an active tab must choose a neighbor in the same project');
    await page.screenshot({ path: outputPath(`${label}-scoped-tabs-${motion}.png`) });
    out.checks.push(`${motion}: Home selection/no-op/fresh briefing; isolated project tabs, global cross-project browsing, retained draft, and scoped close neighbor`);
    await context.close();
  }
} catch (error) {
  out.errors.push(error.stack);
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: outputPath(`${label}-global-home-failure.png`) }).catch(() => {});
} finally {
  await browser.close(); modules.cleanup();
  writeFileSync(outputPath(`${label}-global-home.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
