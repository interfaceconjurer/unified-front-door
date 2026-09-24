import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { install, session, assessment, profile, target } from './fixtures.mjs';

const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] };
const sources = [
  ['legacy assessment', 'ufd.org-assessment.v1.sp', JSON.stringify(assessment)],
  ['legacy canvas', 'ufd.surface-canvas.v1.sp', JSON.stringify({ preserved: 'Older draft text' })],
  ['unreadable legacy assessment', 'ufd.org-assessment.v1.sp', '{original incomplete bytes'],
];
try {
  for (const [name, key, source] of sources) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    try {
      const { state } = await install(context, { drafts: 0, messages: 1 });
      const current = { ...session, profileId: 'sp' }, commands = [];
      state.snapshot.session = current;
      const conversation = state.agent.conversations[0];
      conversation.conversation.scopeKey = 'home';
      conversation.conversation.messages[0].snapshot.profile = { ...profile, id: 'sp', name: 'Sam Patel', firstName: 'Sam', initials: 'SP', onboarding: 'org-assessment', surfaceAccess: ['build', 'alm'] };
      await context.addInitScript(({ key, source }) => localStorage.setItem(key, source), { key, source });
      await context.route('**/api/session', route => route.fulfill({ json: { session: current } }));
      await context.route('**/api/application*', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: state.snapshot });
        const command = route.request().postDataJSON().command;
        commands.push(command.kind);
        assert(['assessment.start', 'assessment.pause'].includes(command.kind), 'No automatic import or unrelated mutation');
        const saved = state.snapshot.assessment;
        if (command.kind === 'assessment.start' && saved.status !== 'running') {
          saved.status = 'running'; saved.currentRunId = 'assessment-startup'; saved.scopeOrgIds = ['prod'];
          if (!saved.runs.length) saved.runs.push({ id: saved.currentRunId, scopeOrgIds: ['prod'], startedAt: '2026-09-17T12:00:00Z', completedAt: null, findings: [], source: { adapter: 'demo-org-assessment', version: '1' } });
          state.snapshot.assessmentRevision++;
          state.agent.runs = [{ id: 'assessment-startup-execution', requestId: command.commandId, turnId: null, conversationId: null, retryOf: null,
            kind: 'assessment', status: 'running', sequence: state.snapshot.assessmentRevision, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z',
            assessmentRunId: saved.currentRunId, context: { target, surface: 'home' }, error: null, result: null, checkpoint: 0 }];
        } else if (command.kind === 'assessment.pause') {
          saved.status = 'paused'; state.snapshot.assessmentRevision++;
          state.agent.runs[0].status = 'cancelled'; state.agent.runs[0].sequence++;
        }
        return route.fulfill({ json: { result: { revision: state.snapshot.assessmentRevision } } });
      });
      const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
      await page.goto(origin + '/?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface: null, target: { projectId: null, worktreeId: null, orgId: 'prod' } })));
      await page.locator('[data-assessment-run-id="assessment-startup-execution"]').waitFor({ state: 'attached' });
      assert(commands.includes('assessment.start'), `${name}: automatic assessment must start`);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), source);
      assert.deepEqual(state.snapshot.imports, []);
      out.checks.push(`${name}: starts automatically without importing or changing original browser data`);

      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Resume assessment', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: 'Resume assessment', exact: true }).waitFor();
      assert.equal(state.snapshot.assessment.status, 'paused');
      await page.getByRole('button', { name: 'Resume assessment', exact: true }).click();
      await page.locator('[data-run-status="running"]').waitFor({ state: 'attached' });

      state.snapshot.assessment.status = 'complete'; state.snapshot.assessment.step = 5; state.snapshot.assessment.runs[0].completedAt = '2026-09-17T12:05:00Z';
      state.agent.runs[0].status = 'completed'; state.agent.runs[0].sequence++;
      await page.getByRole('button', { name: 'Run again', exact: true }).waitFor();
      const count = commands.length;
      await page.reload();
      await page.getByRole('button', { name: 'Run again', exact: true }).waitFor();
      assert.equal(commands.length, count, 'Completed assessments must not restart on reload');
      assert.equal(await page.getByText('Analyzing', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), source);
      out.checks.push(`${name}: pause survives reload, explicit resume works, and completed state stays complete`);
    } finally { await context.close(); }
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); writeFileSync(outputPath(`${label}-assessment-startup.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
