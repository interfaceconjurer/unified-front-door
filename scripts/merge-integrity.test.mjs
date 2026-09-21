import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectMergeIntegrity } from './check-merge-integrity.mjs';

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'ufd-merge-integrity-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'Integration test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Integration test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } }).trim();
  git('init', '-b', 'main'); git('config', 'commit.gpgsign', 'false');
  const commit = (file, value) => { writeFileSync(join(cwd, file), value); git('add', file); git('commit', '-m', file); return git('rev-parse', 'HEAD'); };
  const base = commit('base.txt', 'shared baseline');
  return { cwd, git, commit, base, inspect: (base, head = 'HEAD') => inspectMergeIntegrity({ cwd, base, head }) };
}

test('catches the discarded-main pattern inside a later normal PR merge', t => {
  const { git, commit, base, inspect } = repository(t);
  git('checkout', '-b', 'architecture'); commit('runtime.txt', 'durable runtime');
  git('checkout', 'main'); const incoming = commit('ui.txt', 'approved UI');
  git('checkout', 'architecture'); git('merge', '-s', 'ours', 'main', '-m', 'retain architecture');
  const discarded = git('rev-parse', 'HEAD');
  git('checkout', 'main'); git('merge', '--no-ff', 'architecture', '-m', 'release PR');
  const result = inspect(incoming);
  assert.equal(result.inspectedMerges, 2); assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].merge, discarded); assert.equal(result.findings[0].incomingParent, incoming);
  assert.equal(inspect('HEAD').findings.length, 0, 'existing base history must not block future releases');
  assert.equal(inspect(base).findings.length, 1);
});

test('allows an ordinary content merge that preserves both branches', t => {
  const { git, commit, base, inspect } = repository(t);
  git('checkout', '-b', 'architecture'); commit('runtime.txt', 'runtime');
  git('checkout', 'main'); commit('ui.txt', 'UI');
  git('merge', '--no-ff', 'architecture', '-m', 'combine UI and runtime');
  assert.equal(inspect(base).findings.length, 0);
});

test('ignores identical trees and redundant ancestor parent links', t => {
  const { git, commit, base, inspect } = repository(t);
  const head = commit('runtime.txt', 'runtime'), tree = git('rev-parse', 'HEAD^{tree}');
  const redundant = git('commit-tree', tree, '-p', head, '-p', base, '-m', 'redundant history');
  assert.equal(inspect(base, redundant).findings.length, 0);
  const parallel = git('commit-tree', tree, '-p', base, '-m', 'same contents');
  const identical = git('commit-tree', tree, '-p', head, '-p', parallel, '-m', 'same result');
  assert.equal(inspect(base, identical).findings.length, 0);
});

test('checks every incoming parent of an octopus merge', t => {
  const { git, commit, base, inspect } = repository(t);
  const head = commit('runtime.txt', 'runtime'), tree = git('rev-parse', 'HEAD^{tree}');
  git('checkout', '-b', 'ui', base); const ui = commit('ui.txt', 'UI');
  git('checkout', '-b', 'settings', base); const settings = commit('settings.txt', 'settings');
  const merged = git('commit-tree', tree, '-p', head, '-p', ui, '-p', settings, '-m', 'discard incoming trees');
  assert.deepEqual(inspect(base, merged).findings.map(finding => finding.incomingParent).sort(), [ui, settings].sort());
});

test('allows incoming history with no net content change from the shared base', t => {
  const { git, commit, base, inspect } = repository(t);
  git('checkout', '-b', 'architecture'); commit('runtime.txt', 'runtime');
  git('checkout', 'main'); git('commit', '--allow-empty', '-m', 'metadata-only checkpoint');
  git('checkout', 'architecture'); git('merge', '--no-ff', 'main', '-m', 'absorb checkpoint');
  assert.equal(inspect(base).findings.length, 0);
});

test('refuses missing refs and shallow history instead of reporting success', t => {
  const { cwd, base, inspect } = repository(t);
  assert.throws(() => inspect('missing-ref'), /Cannot resolve/);
  assert.throws(() => inspect(''), /required/);
  writeFileSync(join(cwd, '.git', 'shallow'), base + '\n');
  assert.throws(() => inspect(base), /Full Git history/);
});
