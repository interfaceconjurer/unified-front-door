import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';

const modules = testModules(), { planProject } = modules.load('lib/projects/model');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }, cleanups = [];
const destination = page => JSON.parse(new URL(page.url()).searchParams.get('destination'));

try {
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ httpCredentials, reducedMotion: motion,
      colorScheme: motion === 'reduce' ? 'light' : 'dark', viewport: { width: 1500, height: 1100 } });
    const fixture = await installAssessment(context); cleanups.push(fixture.cleanup);
    const project = planProject({ id: 'draft', revision: 1, name: 'Acme improvements', goal: 'Improve the workspace',
      targetOrgId: 'sit', findingIds: fixture.run.findings.filter(finding => finding.sourceFindingId !== "case-access").map(finding => finding.id), runId: fixture.run.id },
    fixture.run.findings, 'Sam', 'create-project', '2026-09-23T12:00:00Z', 'project-change-test', ['prod', 'uat']);
    fixture.state.snapshot.assessment.projects = [project];
    const original = structuredClone(project);
    const target = { projectId: project.id, worktreeId: null, orgId: 'uat' };
    const canvas = { kind: 'improvement-project', title: project.name, params: { projectId: project.id } };
    const href = (target, canvas, surface = 'alm') => origin + '/' + surface + '?destination=' + encodeURIComponent(JSON.stringify({ version: 1, owner: 'sp', surface, target, canvas }));
    const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
    const panel = page.getByRole('tabpanel');
    await page.goto(href(target, canvas));
    async function openItem(item) {
      const region = panel.getByRole('region', { name: `Work item: ${item.title}`, exact: true });
      await region.waitFor();
      const collapsed = region.getByRole('button', { expanded: false });
      if (await collapsed.count()) await collapsed.click();
      await region.getByRole('button', { name: 'Make a change in Build & Setup', exact: true }).click();
      await panel.getByRole('heading', { name: item.title, exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/build');
      assert.equal(destination(page).canvas.kind, 'work-item-change');
      assert.equal(destination(page).canvas.params.workItemId, item.id);
    }
    const source = page.getByRole('textbox', { name: 'Proposed changes', exact: true });
    for (const [index, item] of project.workItems.entries()) {
      await openItem(item);
      assert.deepEqual(destination(page).target, target, 'Opening a change keeps the project and connected org, not the deployment target');
      assert.deepEqual(destination(page).canvasTarget ?? destination(page).target, target, 'A new change captures the current connection rather than the optional deployment target');
      assert.equal(await page.getByRole('textbox', { name: 'Change summary', exact: true }).inputValue(), item.title);
      assert.equal(await source.inputValue(), '', 'Each work item starts with its own draft');
      if (index === 0) {
        await page.getByRole('textbox', { name: 'Change summary', exact: true }).fill('Use incremental synchronization');
        await page.getByRole('textbox', { name: 'File path (optional)', exact: true }).fill('config/integration.json');
      }
      await page.getByText('Work item plan & acceptance criteria', { exact: true }).click();
      await panel.getByText(item.finding.validation, { exact: true }).waitFor();
      const text = JSON.stringify({ change: index + 1, enabled: true }, null, 2);
      const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/application')
        && response.request().postDataJSON().command.fields?.source === text);
      await source.fill(text); await saved;
      await panel.getByText('Saved to database', { exact: true }).waitFor();
      if (index === 0) await page.screenshot({ path: outputPath(`${label}-work-item-change-${motion}.png`) });
      await page.getByRole('button', { name: 'Back to project', exact: true }).click();
      await panel.getByRole('heading', { name: project.name, exact: true }).waitFor();
    }
    assert.equal(fixture.state.snapshot.canvases.filter(record => record.canvas.kind === 'work-item-change').length, project.workItems.length);
    assert.deepEqual(fixture.state.snapshot.assessment.projects[0], original, 'Editing does not change work status or source findings');
    assert(fixture.commands.every(command => command.kind === 'visit'), 'Opening/editing canvases does not submit agent work or run assessment commands');
    out.checks.push(`${motion}: every work item opens an independent editable Build canvas with its plan, preserves project/org, saves changes, and returns to ALM without altering work status or source evidence`);

    const first = project.workItems[0], savedText = JSON.stringify({ change: 1, enabled: true }, null, 2);
    await openItem(first); assert.equal(await source.inputValue(), savedText);
    assert.equal(await page.getByRole('tab', { name: first.title, exact: true }).count(), 1, 'Reopening reuses the existing tab');
    await page.reload(); await panel.getByRole('heading', { name: first.title, exact: true }).waitFor();
    assert.equal(await source.inputValue(), savedText);
    assert.equal(await page.getByRole('textbox', { name: 'Change summary', exact: true }).inputValue(), 'Use incremental synchronization');
    assert.equal(await page.getByRole('textbox', { name: 'File path (optional)', exact: true }).inputValue(), 'config/integration.json');
    await page.getByRole('button', { name: `Close ${first.title}`, exact: true }).click();
    await page.goto(href(target, canvas));
    await openItem(first); assert.equal(await source.inputValue(), savedText, 'Closing and reopening retains the saved draft');
    await page.setViewportSize({ width: 760, height: 1050 });
    await source.scrollIntoViewIfNeeded();
    assert(await source.evaluate(node => node.getBoundingClientRect().right <= innerWidth), 'Change editor fits the narrow layout');
    await page.screenshot({ path: outputPath(`${label}-work-item-change-narrow-${motion}.png`) });
    out.checks.push(`${motion}: saved change survives repeat entry, reload and close/reopen; editor fits a narrow viewport`);

    await page.goto(href({ ...target, projectId: null, orgId: 'prod' }));
    await panel.getByRole('table', { name: 'Your projects', exact: true }).getByRole('button', { name: project.name, exact: true }).click();
    await openItem(first); assert.equal(await source.inputValue(), savedText);
    assert.deepEqual(destination(page).target, { ...target, projectId: null, orgId: 'prod' });
    assert.equal(destination(page).canvasTarget.projectId, project.id);
    assert.equal(destination(page).canvasTarget.orgId, 'uat', 'Saved draft ownership is stable when inspecting from another connection');
    await page.getByRole('button', { name: 'Back to project', exact: true }).click();
    await panel.getByRole('heading', { name: project.name, exact: true }).waitFor();
    assert.deepEqual(destination(page).target, { ...target, projectId: null, orgId: 'prod' });
    const invalid = { kind: 'work-item-change', title: 'Invalid work item', params: { projectId: project.id, workItemId: 'missing' } };
    await page.goto(href(target, invalid, 'build'));
    await page.getByRole('alert').getByText('Destination unavailable', { exact: true }).waitFor();
    assert.equal(await source.count(), 0, 'Unavailable work items cannot be edited');
    out.checks.push(`${motion}: global inspection retains connection and captured draft ownership; missing work-item links cannot open an editor`);
    await context.close();
  }
} catch (error) { out.errors.push(error.stack); }
finally {
  await browser.close(); cleanups.forEach(cleanup => cleanup()); modules.cleanup();
  writeFileSync(outputPath(`${label}-work-item-changes.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); if (out.errors.length) process.exitCode = 1;
}
