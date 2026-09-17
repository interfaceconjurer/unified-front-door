import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session } from './fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules(), { updateConversation } = modules.load('lib/chat/conversation');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const position = node => {
  const top = node.getBoundingClientRect().top;
  const anchor = [...node.querySelectorAll('[data-message-id]')].find(entry => entry.getBoundingClientRect().bottom > top + 1);
  return { id: anchor?.dataset.messageId, offset: anchor?.getBoundingClientRect().top - top, scrollTop: node.scrollTop };
};
try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion, viewport: { width: 1440, height: 1000 } });
    const { state } = await install(context, { drafts: 0, messages: 81 });
    const conversation = state.agent.conversations[0], today = conversation.conversation.messages.at(-1).snapshot;
    conversation.conversation.scopeKey = 'home';
    let disconnected = false;
    await context.route('**/api/session', route => route.fulfill(disconnected
      ? { status: 503, json: { error: { code: 'unavailable', message: 'Internal database details should stay out of the interface.' } } }
      : { json: { session } }));
    await context.route('**/api/agent*', route => {
      if (disconnected) return route.fulfill({ status: 503, json: { error: { code: 'unavailable', message: 'Internal database details should stay out of the interface.' } } });
      if (route.request().method() === 'GET') return route.fulfill({ json: state.agent });
      const command = route.request().postDataJSON().command;
      assert.equal(command.kind, 'visit', 'This test must not submit paid model work');
      conversation.conversation = updateConversation(conversation.conversation, command.context.surface === 'home'
        ? { type: 'today', snapshot: today }
        : { type: 'surface', scopeKey: command.context.surface, label: 'Build', reply: 'What would you like to build?' });
      conversation.revision++;
      return route.fulfill({ json: { result: { conversationId: conversation.id } } });
    });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    await page.goto(origin + '/');
    const transcript = page.getByRole('log', { name: 'Conversation' });
    await page.locator('[data-message-id="81"]').waitFor();
    await page.waitForFunction(() => {
      const log = document.querySelector('[aria-label="Conversation"]'), entry = log?.querySelector('[data-message-id="81"]');
      return entry && Math.abs(entry.getBoundingClientRect().top - log.getBoundingClientRect().top - 20) < 3;
    });
    assert((await transcript.evaluate(position)).scrollTop > 0);
    out.checks.push(`${motion}: first load opens at the latest turn, not the start of history`);

    for (const [anchorId, older] of [[55, false], [20, true]]) {
      if (older) await page.getByRole('button', { name: 'Older messages', exact: true }).click();
      await page.locator(`[data-message-id="${anchorId}"]`).waitFor();
      await transcript.evaluate((node, id) => { const anchor = node.querySelector(`[data-message-id="${id}"]`); node.scrollTop += anchor.getBoundingClientRect().top - node.getBoundingClientRect().top + 35; }, anchorId);
      await page.waitForTimeout(180);
      const before = await transcript.evaluate(position);
      await page.reload();
      await page.locator(`[data-message-id="${anchorId}"]`).waitFor();
      await page.waitForTimeout(180);
      const after = await transcript.evaluate(position);
      assert.equal(after.id, before.id); assert(Math.abs(after.offset - before.offset) < 3, JSON.stringify({ before, after }));
    }
    out.checks.push(`${motion}: reload restores the exact message anchor, including an older history page`);
    await page.getByRole('button', { name: 'Latest messages', exact: true }).click();
    await page.locator('[data-message-id="81"]').waitFor();
    await page.getByRole('navigation', { name: 'Explore surfaces', exact: true }).getByRole('link', { name: 'Build & Setup', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/build');
    await page.getByText('What would you like to build?', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Agent"]')?.dataset.motion === 'idle');
    assert.equal(await page.locator('[data-pending]').count(), 0);
    const contextTop = await page.locator('[data-kind="context"]').last().evaluate(node => node.getBoundingClientRect().top);
    const logTop = await transcript.evaluate(node => node.getBoundingClientRect().top);
    assert(Math.abs(contextTop - logTop - 20) < 3, `Surface context offset ${contextTop - logTop}`);
    assert.equal(await page.getByRole('navigation', { name: 'Explore surfaces', exact: true }).count(), 0);
    out.checks.push(`${motion}: Today becomes history, the new surface context scrolls into place, and content reveals`);

    disconnected = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(1200);
    assert.equal(await page.getByText('Internal database details should stay out of the interface.', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Reconnect (agent|to database)|Retry request/ }).count(), 0);
    await page.screenshot({ path: outputPath(`${label}-quiet-chat-${motion}.png`) });
    disconnected = false;
    out.checks.push(`${motion}: background connection failures do not render diagnostic banners`);
    await context.close();
  }
  // A persisted navigation request must recover without a user-facing retry prompt.
  const context = await browser.newContext({ httpCredentials });
  await install(context, { drafts: 0, messages: 1 });
  await context.addInitScript(session => {
    const command = { kind: 'visit', requestId: 'restored-visit', context: { target: { projectId: null, worktreeId: null, orgId: null }, surface: 'home' } };
    sessionStorage.setItem(`ufd.agent-pending.v1.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}.${session.generation}`, JSON.stringify({ session, commands: [command] }));
  }, session);
  const page = await context.newPage();
  const retried = page.waitForRequest(request => request.url().includes('/api/agent') && request.method() === 'POST' && request.postDataJSON().command.requestId === 'restored-visit');
  await page.goto(origin + '/'); await retried;
  assert.equal(await page.getByText(/A previous request needs confirmation/).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Retry message', exact: true }).count(), 0);
  out.checks.push('Restored background visits retry silently with their original request identity');
  await context.close();
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); modules.cleanup();
  writeFileSync(outputPath(`${label}-session-chat.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
