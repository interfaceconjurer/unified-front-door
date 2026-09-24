import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { origin, outputPath, httpCredentials } from './config.mjs';
import { installAssessment } from './assessment-fixtures.mjs';
import { testModules } from '../test-modules.mjs';
const modules = testModules(), { destinationHref } = modules.load('lib/navigation/model');
const { RETURNING_WORK } = modules.load('lib/workspace/returning-work');
const { PROJECTS } = modules.load('lib/workspace/fixtures');
const { SURFACES } = modules.load('lib/workspace/surfaces');
const browser = await chromium.launch(), label = process.argv[2] ?? 'candidate';
const out = { label, checks: [], errors: [] }; let fixture;
try {
  const context = await browser.newContext({ httpCredentials, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  fixture = await installAssessment(context, { profileId: 'am' });
  const page = await context.newPage(); page.on('pageerror', error => out.errors.push(error.message));
  await page.goto(origin + destinationHref({ version: 1, owner: 'am', surface: null, target: { projectId: null, worktreeId: null, orgId: 'uat' } }));
  const today = page.getByRole('group', { name: 'Today', exact: true });
  await today.getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
  assert.equal(await today.getByRole('button', { name: /^Review / }).count(), 5);
  // The build transforms light-dark(); test rendered colors as well as scheme.
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
    if (await toggle.getAttribute('aria-checked') !== String(theme === 'dark')) await toggle.click();
    const card = today.getByRole('button', { name: /^Review / }).first();
    const colors = await card.evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopColor, width: style.borderTopWidth, label: getComputedStyle(element.firstElementChild).color };
    });
    assert.deepEqual(colors, theme === 'dark'
      ? { background: 'rgb(34, 38, 44)', border: 'rgb(98, 82, 56)', width: '1px', label: 'rgb(244, 198, 122)' }
      : { background: 'rgb(255, 253, 248)', border: 'rgb(225, 205, 166)', width: '1px', label: 'rgb(137, 87, 0)' }, `${theme} attention card retains its background, border and status color`);
    await card.screenshot({ path: outputPath(`${label}-attention-card-${theme}.png`) });
    out.checks.push(`${theme}: attention cards retain themed background, border and status color after using the appearance switch`);
  }
  const global = fixture.state.agent.conversations.find(thread => JSON.parse(thread.threadKey)[0] === 'unbound-session');
  const original = structuredClone(global.conversation.messages.find(message => message.role === 'today'));
  for (const id of ['hotfix-tests', 'storefront-health', 'storefront-release']) {
    const work = RETURNING_WORK.find(work => work.id === id), project = PROJECTS.find(project => project.id === work.projectId);
    const review = today.getByRole('button', { name: `Review ${work.title}`, exact: true });
    assert((await review.innerText()).includes(`Review in ${SURFACES[work.surfaceId].label}`));
    await review.click();
    await page.waitForURL(url => url.pathname === '/' + work.surfaceId);
    const selected = JSON.parse(new URL(page.url()).searchParams.get('destination'));
    assert.equal(selected.canvas.params.workId, work.id);
    assert.deepEqual(selected.target, { projectId: null, worktreeId: null, orgId: 'uat' });
    assert.deepEqual(selected.canvasTarget, { projectId: project.id, worktreeId: work.worktreeId, orgId: project.defaultOrgId });
    await page.getByRole('heading', { name: work.title, exact: true }).waitFor();
    await page.getByRole('link', { name: 'Global home', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/');
    await today.getByRole('heading', { name: 'Your work, across projects.', exact: true }).waitFor();
    const earlier = page.getByRole('group', { name: 'Earlier Today (read only)', exact: true }).first();
    assert(await earlier.evaluate(node => node.disabled || !!node.closest('[inert]')), 'Earlier Today immediately prevents interaction');
    await page.waitForFunction(() => document.querySelector('fieldset[aria-label="Earlier Today (read only)"]')?.disabled);
    assert(await earlier.getByRole('button', { name: `Review ${work.title}`, exact: true }).isDisabled());
    assert.deepEqual(global.conversation.messages.find(message => message.id === original.id), original);
    assert.equal(await today.getByRole('button', { name: /^Review / }).count(), 5);
    out.checks.push(`${id}: attention opens matching work without entering its project, retains global org/chat, and leaves original Today unchanged and disabled`);
  }
  assert(fixture.commands.every(command => command.kind === 'visit'));
  assert(fixture.commands.every(command => command.context.target.projectId === null));
  assert.equal(fixture.state.agent.conversations.length, 1);
  // Opening a work canvas registers its empty draft through the existing store.
  // Navigation must not submit a review, edit content, or invoke agent work.
  for (const command of fixture.stats.commands) {
    assert.equal(command.kind, 'canvas.save'); assert.deepEqual(command.fields, {});
    const work = RETURNING_WORK.find(work => work.id === command.canvas.params.workId);
    assert(['hotfix-tests', 'storefront-health', 'storefront-release'].includes(work?.id));
    assert.equal(command.surface, work.surfaceId);
    assert.equal(command.target.projectId, work.projectId); assert.equal(command.target.worktreeId, work.worktreeId);
  }
  assert.deepEqual(out.errors, []);
} finally {
  writeFileSync(outputPath(`${label}-attention-scenarios.json`), JSON.stringify(out, null, 2));
  await browser.close(); fixture?.cleanup(); modules.cleanup();
}
console.log(JSON.stringify(out, null, 2));
