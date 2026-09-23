import { REQUIRED_CHECKS } from './release-contract.mjs';

export const BROWSER_SHARDS = 4;
export const PR_GROUPS = Object.freeze(['checks', 'database', ...Array.from({ length: BROWSER_SHARDS }, (_, i) => `browser-${i + 1}`), 'performance']);

// Every group calls the same stage implementations as a full release. Runtime
// groups build their own server and own a disposable database on separate runners.
// No partial run may create deployable evidence.
export function verificationPlan(group) {
    if (group === undefined) return { checks: [...REQUIRED_CHECKS], partial: false };
    if (!PR_GROUPS.includes(group)) throw new Error('Unknown verification group.');
    if (group === 'checks') return { checks: REQUIRED_CHECKS.slice(0, 5), partial: true };
    const checks = ['locked-install', 'production-build', 'database-migrations'];
    if (group === 'database') checks.push('database-tests', 'agent-database-tests');
    checks.push('runtime-smoke');
    if (group === 'database') checks.push('browser-database', 'worker-recovery');
    else if (group === 'performance') checks.push('browser-performance');
    else checks.push('browser-regressions');
    return { checks, partial: true, ...(group.startsWith('browser-') ? { shard: `${group.slice(8)}/${BROWSER_SHARDS}` } : {}) };
}
