import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Flags unchanged-result merges, not arbitrary semantic regressions. Read-only. */
export function inspectMergeIntegrity({ base, head, cwd = process.cwd() }) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git('rev-parse', '--is-shallow-repository') === 'true') throw new Error('Full Git history is required; fetch with depth 0 before checking integration.');
  const commit = ref => {
    if (!ref) throw new Error('Both --base and --head are required.');
    try { return git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`); }
    catch { throw new Error(`Cannot resolve commit ${ref}; fetch the exact base and head before checking integration.`); }
  };
  const baseId = commit(base), headId = commit(head);
  const merges = git('rev-list', '--merges', headId, `^${baseId}`).split('\n').filter(Boolean);
  const findings = [];
  for (const merge of merges) {
    const parents = git('show', '-s', '--format=%P', merge).split(' ');
    const retainedTree = git('rev-parse', `${parents[0]}^{tree}`);
    if (git('rev-parse', `${merge}^{tree}`) !== retainedTree) continue;
    for (const incoming of parents.slice(1)) {
      const incomingTree = git('rev-parse', `${incoming}^{tree}`);
      if (incomingTree === retainedTree) continue;
      // Ignore redundant parent links; no new incoming history was absorbed.
      const shared = git('merge-base', parents[0], incoming);
      if (shared === incoming || git('rev-parse', `${shared}^{tree}`) === incomingTree) continue;
      findings.push({ merge, retainedParent: parents[0], incomingParent: incoming });
    }
  }
  return { base: baseId, head: headId, inspectedMerges: merges.length, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--base' || args[2] !== '--head') throw new Error('Usage: node scripts/check-merge-integrity.mjs --base BASE --head HEAD');
    const result = inspectMergeIntegrity({ base: args[1], head: args[3] });
    if (result.findings.length) {
      for (const finding of result.findings) console.error(`Merge ${finding.merge} kept the exact tree of ${finding.retainedParent} while absorbing changed history from ${finding.incomingParent}.`);
      console.error('Integration blocked: inspect incoming features and tests. Adapt them through a content merge; retaining their commits in history does not preserve their behavior. This also flags intentional unchanged-result merges and requires resolving the integration explicitly.');
      process.exitCode = 1;
    } else console.log(`Merge integrity passed: ${result.inspectedMerges} new merge(s) inspected.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
