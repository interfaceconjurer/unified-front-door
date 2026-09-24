import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules();
const { planProject } = modules.load('lib/projects/model');
const { canvasId, canvasTarget } = modules.load('lib/surface-canvas/model');
const { permissionReply } = modules.load('lib/agent/permission-actions');
const { permissionGuidance, SERVICE_REPS } = modules.load('lib/org-resources/permissions');
const { updateConversation } = modules.load('lib/chat/conversation');
const { conversationKey } = modules.load('lib/workspace/context');
const { parseAgentCommand } = modules.load('lib/agent/contracts');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const current = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));
const href = (target, canvas, surface = 'build') => origin + '/' + surface + '?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface, target, canvas }));
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion, colorScheme: reducedMotion === 'reduce' ? 'light' : 'dark', viewport: { width: 1550, height: 1100 } });
    const fixture = await installAssessment(context); cleanups.push(fixture.cleanup);
    const { state } = fixture;
    const finding = fixture.run.findings.find(finding => finding.sourceFindingId === 'case-access');
    const project = planProject({ id: 'draft', revision: 1, name: 'Service team access', goal: finding.impact, targetOrgId: '', findingIds: [finding.id], runId: fixture.run.id }, fixture.run.findings, 'Sam', 'create-permissions-project', '2026-09-23T12:00:00Z', 'permissions-project', ['prod']);
    state.snapshot.assessment.projects = [project];
    const originalProject = structuredClone(project);
    let submissions = 0;
    // Transport fixture uses the shared permission interpreter. Transaction,
    // authorization and replay behavior are covered by agent-database.test.mjs.
    await context.route('**/api/agent*', async route => {
      if (route.request().method() === 'GET') return route.fallback();
      const command = parseAgentCommand(route.request().postDataJSON().command);
      if (!command.context?.canvas) return route.fallback();
      const { canvas, target } = command.context, id = canvasId(canvas.kind, canvas.params);
      let draft = state.snapshot.canvases.find(draft => draft.id === id);
      const key = conversationKey(target);
      let saved = state.agent.conversations.find(saved => saved.threadKey === key);
      if (!saved) { saved = { id: randomUUID(), threadKey: key, revision: 0, conversation: { scopeKey: 'home', messages: [] } }; state.agent.conversations.push(saved); }
      if (command.kind === 'visit') {
        if (saved.conversation.visitKey !== id) saved.conversation = { ...updateConversation(saved.conversation, { type: 'surface', scopeKey: 'build', label: 'Build & Setup', reply: permissionGuidance(draft?.fields), force: true }), visitKey: id };
        saved.revision++;
        return route.fulfill({ json: { result: { conversationId: saved.id, conversation: saved } } });
      }
      assert.equal(command.kind, 'submit'); submissions++;
      assert.equal(command.context.canvasRevision, draft?.revision ?? 0, 'Manual edit must be acknowledged before bulk submission');
      const reply = permissionReply(command.text, draft?.fields ?? {});
      if (reply.patch && Object.keys(reply.patch).length) {
        if (!draft) { draft = { id, canvas, surface: 'build', target: canvasTarget(canvas, target), fields: {}, revision: 0 }; state.snapshot.canvases.push(draft); }
        draft.fields = { ...draft.fields, ...reply.patch }; draft.revision++;
      }
      const runId = randomUUID(), turnId = randomUUID();
      const count = saved.conversation.messages.length;
      saved.conversation = updateConversation(saved.conversation, { type: 'send', text: command.text, reply: reply.text });
      saved.conversation.messages = saved.conversation.messages.map((message, index) => index >= count ? { ...message, runId, turnId } : message); saved.revision++;
      state.agent.runs.push({ id: runId, requestId: command.requestId, turnId, conversationId: saved.id, retryOf: null, kind: 'chat', status: 'completed', sequence: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assessmentRunId: null, execution: { provider: 'demo' }, context: command.context, error: null, result: reply.text, checkpoint: 0 });
      return route.fulfill({ json: { result: { conversationId: saved.id, turnId, runId, destination: null } } });
    });
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const target = { projectId: project.id, worktreeId: null, orgId: 'uat' };
    await page.goto(href(target, { kind: 'improvement-project', title: project.name, params: { projectId: project.id } }, 'alm'));
    await page.getByRole('button', { name: 'Review permissions', exact: true }).click();
    const panel = page.getByRole('article', { name: 'Service Reps permissions', exact: true });
    const checks = panel.getByRole('checkbox');
    await checks.first().waitFor(); assert.equal(await checks.count(), 6);
    assert.deepEqual(current(page).target, target, 'Opening the finding does not switch the connected org');
    assert.equal(current(page).canvas.params.orgId, 'prod', 'The canvas retains the finding source');
    assert.equal(await panel.getByRole('button', { name: /save/i }).count(), 0);
    await page.getByRole('log', { name: 'Conversation' }).getByText(/6 service representatives still have Delete Cases access/).waitFor();
    const permissionId = canvasId(current(page).canvas.kind, current(page).canvas.params);
    assert.equal(state.snapshot.canvases.some(draft => draft.id === permissionId), false);
    await checks.first().uncheck();
    // Send immediately: the composer flushes the manual edit before the agent acts.
    await page.getByRole('textbox', { name: 'Message the agent', exact: true }).fill('Can you update all of these users permissions to standard access?');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByRole('log').getByText(/Removed Delete Cases access from 5 users/).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('article[aria-label="Service Reps permissions"] input[type=checkbox]')].length === 6 && [...document.querySelectorAll('article[aria-label="Service Reps permissions"] input[type=checkbox]')].every(input => !input.checked));
    assert.equal(submissions, 1); assert.deepEqual(state.snapshot.assessment.projects[0], originalProject);
    await page.screenshot({ path: outputPath(`${label}-permissions-${reducedMotion}.png`) });
    const changes = page.getByRole('button', { name: /^Changes, / });
    await changes.click();
    const file = page.getByRole('button', { name: 'Open changed file .orgs/prod/access/Service_Reps.assignments.json', exact: true });
    await file.click(); await checks.first().waitFor();
    assert.deepEqual(current(page).target, target);
    await page.reload(); await checks.first().waitFor();
    for (const user of SERVICE_REPS) assert.equal(await panel.getByRole('checkbox', { name: `Delete Cases for ${user.name}`, exact: true }).isChecked(), false);
    await panel.getByRole('button', { name: 'Undo change for Maya Chen', exact: true }).click();
    assert(await checks.first().isChecked()); assert.equal(await checks.nth(1).isChecked(), false);
    await page.getByRole('button', { name: 'Undo all permission changes', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('article[aria-label="Service Reps permissions"] input[type=checkbox]')].every(input => input.checked));
    out.checks.push(`${reducedMotion}: project work item opens current permissions with chat guidance, preserves connection, autosaves one manual edit before a bulk request, updates only five remaining users, tracks a real assignment diff, survives reload and supports per-user/chat undo without changing project evidence`);

    const global = { projectId: null, worktreeId: null, orgId: 'prod' };
    await page.goto(href(global, { kind: 'capability', title: 'Access & Permissions', params: { scope: 'unbound', surface: 'build', capability: 'access-permissions', orgId: 'prod' } }));
    await page.getByRole('button', { name: 'Open Service Reps', exact: true }).click();
    await checks.first().waitFor(); assert.equal(await changes.count(), 0);
    await checks.nth(1).uncheck();
    await page.getByRole('button', { name: 'Changes, 1 changed file', exact: true }).waitFor();
    await panel.getByRole('status').filter({ hasText: 'Saved to database' }).waitFor();
    const unbound = current(page);
    await page.reload(); await panel.getByRole('button', { name: 'Undo change for Jordan Lee', exact: true }).waitFor();
    await changes.click(); await page.getByRole('button', { name: 'Track in a project', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.goto(href({ ...global, orgId: 'uat' }, { ...unbound.canvas, params: { ...unbound.canvas.params, orgId: 'uat' } }));
    await checks.first().waitFor(); assert(await checks.nth(1).isChecked(), 'Another org has independent access changes');
    await page.goto(href(global, unbound.canvas)); await panel.getByRole('button', { name: 'Undo change for Jordan Lee', exact: true }).waitFor();
    await page.setViewportSize({ width: 760, height: 1050 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: outputPath(`${label}-permissions-narrow-${reducedMotion}.png`) });
    await panel.getByRole('button', { name: 'Undo change for Jordan Lee', exact: true }).click();
    await changes.waitFor({ state: 'detached' });
    out.checks.push(`${reducedMotion}: access browser opens outside a project; edits immediately appear in global Changes with project tracking available; reload, org isolation, narrow layout and undo to zero are preserved`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally { await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup(); writeFileSync(outputPath(`${label}-permissions.json`), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1; }
