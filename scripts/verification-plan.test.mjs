import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { BROWSER_SUITES, browserSuites } from './browser/suites.mjs';
import { BROWSER_SHARDS, PR_GROUPS, verificationPlan } from './verification-plan.mjs';
import { REQUIRED_CHECKS, validateVerification } from './release-contract.mjs';

test('PR jobs retain every release check and run every registered browser suite exactly once', () => {
    // Check the actual workflow matrix too, so dropping a job cannot silently
    // leave the plan covered only on paper.
    const workflow = readFileSync(new URL('../.github/workflows/deploy-heroku.yml', import.meta.url), 'utf8');
    const groups = JSON.parse(workflow.match(/group: (\["checks"[^\n]+\])/)[1]);
    assert.deepEqual(groups, PR_GROUPS);
    const plans = groups.map(verificationPlan);
    assert.deepEqual([...new Set(plans.flatMap(plan => plan.checks))].sort(), [...REQUIRED_CHECKS].sort());
    const suites = plans.filter(plan => plan.shard).flatMap(plan => browserSuites(plan.shard));
    assert.equal(suites.length, new Set(suites).size, 'No repeated suites across shards');
    assert.deepEqual([...suites].sort(), [...BROWSER_SUITES].sort());
    for (const suite of suites) assert(existsSync(new URL(`./browser/${suite}.mjs`, import.meta.url)));
    for (let i = 1; i <= BROWSER_SHARDS; i++) assert(browserSuites(`${i}/${BROWSER_SHARDS}`).length > 0);
});

test('full verification retains the complete contract; partial or invalid selections cannot authorize deployment', () => {
    assert.deepEqual(verificationPlan(), { checks: [...REQUIRED_CHECKS], partial: false });
    for (const group of PR_GROUPS) {
        const plan = verificationPlan(group);
        assert.equal(plan.partial, true);
        assert.equal(plan.checks[0], 'locked-install');
        if (plan.checks.includes('browser-regressions')) assert(plan.shard);
        assert.throws(() => validateVerification({ version: 1, verified: true, releasable: false, checks: plan.checks }, {}), /Complete current release verification/);
    }
    for (const group of ['', 'browser-0', 'browser-5', 'all', 'database,performance']) assert.throws(() => verificationPlan(group));
    for (const shard of ['', '0/4', '5/4', '1/0', '1/37', '1.5/4', '1/4extra']) assert.throws(() => browserSuites(shard));
    assert.deepEqual(browserSuites(), BROWSER_SUITES);
});
