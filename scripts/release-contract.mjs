export const REQUIRED_CHECKS = Object.freeze([
  "locked-install", "dependency-audit", "pure-tests", "lint", "typecheck", "production-build",
  "database-migrations", "database-tests", "agent-database-tests", "runtime-smoke",
  "browser-regressions", "browser-database", "worker-recovery", "browser-performance",
]);
export function validateVerification(value, expected) {
  const sha = /^[a-f0-9]{40}$/, hash = /^[a-f0-9]{64}$/;
  if (!value || value.version !== 1 || value.verified !== true || value.releasable !== true
    || !sha.test(value.revision) || !sha.test(value.treeSha)
    || !hash.test(value.lockSha256) || !hash.test(value.sourceSha256)
    || value.nodeVersion !== "22.23.2" || typeof value.buildId !== "string" || !value.buildId.trim()
    || !Number.isFinite(Date.parse(value.completedAt)) || Date.parse(value.completedAt) > Date.now() + 60000
    || Date.now() - Date.parse(value.completedAt) > 86400000
    || JSON.stringify(value.checks) !== JSON.stringify(REQUIRED_CHECKS)) throw new Error("Complete current release verification is required.");
  for (const key of ["revision", "treeSha", "lockSha256", "sourceSha256"]) {
    if (typeof expected[key] !== "string" || value[key] !== expected[key]) throw new Error("Release verification does not match this source artifact.");
  }
  return value;
}

// Used by the runner and negative tests: no completion callback runs after any
// failed stage, including a command that terminates via signal instead of exit.
export async function runVerificationStages(stages, run, complete) {
  const checks = [];
  for (const stage of stages) {
    await run(stage);
    checks.push(stage.id);
  }
  return complete(checks);
}
