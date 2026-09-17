import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { REQUIRED_CHECKS, runVerificationStages } from "./release-contract.mjs";
import { freePort, startProduction, waitForServer } from "./production-process.mjs";
import configuration from "../src/lib/server/database-target.js";

const output = resolve(".release");
await mkdir(output, { recursive: true });
await Promise.all(["verification.json", "source.tgz", "failure.json"].map(name => rm(join(output, name), { force: true })));
const args = process.argv.slice(2), workingTree = args.length === 1 && args[0] === "--working-tree";
const revision = args.length === 2 && args[0] === "--revision" ? args[1] : null;
let server, activeChild, cancelled = false, failedStage = "preflight";
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  cancelled = true;
  if (activeChild) { try { process.kill(-activeChild.pid, "SIGKILL"); } catch { /* It may have exited between stages. */ } }
  void server?.stop();
});
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const hash = value => createHash("sha256").update(value).digest("hex");
async function sourceFingerprint() {
  const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))].sort();
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file + "\0");
    try { digest.update(await readFile(file)); } catch (error) { if (error.code !== "ENOENT") throw error; digest.update("<deleted>"); }
    digest.update("\0");
  }
  return digest.digest("hex");
}
let env;
function run(command, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    if (cancelled) { reject(new Error("Verification cancelled")); return; }
    const child = spawn(command, args, { env, stdio: "inherit", detached: true });
    activeChild = child;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, "SIGKILL"); } catch { /* The child may already have exited. */ } }, timeoutMs);
    child.once("error", () => { activeChild = null; clearTimeout(timer); reject(new Error("Verification command failed to start")); });
    child.once("exit", (code, signal) => { activeChild = null; clearTimeout(timer); if (code === 0 && !signal && !timedOut && !cancelled) resolve(); else reject(new Error("Verification command failed")); });
  });
}
try {
  if (process.versions.node !== "22.23.2") throw new Error("Use the exact Node version in .nvmrc");
  if (!workingTree && (!revision || !/^[a-f0-9]{40}$/.test(revision))) throw new Error("Use --revision FULL_SHA or --working-tree");
  const head = git("rev-parse", "HEAD"), treeSha = git("rev-parse", "HEAD^{tree}");
  if (!workingTree && (head !== revision || git("status", "--porcelain", "--untracked-files=all"))) throw new Error("Release verification requires a clean checkout of the requested exact revision");
  if (!process.env.DATABASE_TEST_URL) throw new Error("An explicit disposable DATABASE_TEST_URL is required");
  const parsed = new URL(process.env.DATABASE_TEST_URL);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Test database URL must use PostgreSQL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (!local && !process.env.DATABASE_TEST_URL_UNPOOLED) throw new Error("The same remote test database needs its direct URL");
  const direct = new URL(configuration.databaseConfiguration({ DATABASE_URL: process.env.DATABASE_TEST_URL, DATABASE_URL_UNPOOLED: process.env.DATABASE_TEST_URL_UNPOOLED }, true).directUrl);
  const before = await sourceFingerprint(), lockSha256 = hash(await readFile("package-lock.json"));
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  env = { ...process.env, AGENT_PROVIDER: "demo", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: process.env.DATABASE_TEST_URL, DATABASE_URL_UNPOOLED: direct.href, DATABASE_TEST_URL: process.env.DATABASE_TEST_URL, DATABASE_TEST_URL_UNPOOLED: direct.href, APP_ORIGIN: origin, BROWSER_TEST_ORIGIN: origin, BROWSER_TEST_OUTPUT: output, BASIC_AUTH_USER: "guest", BASIC_AUTH_PASSWORD: randomUUID() };
  // Install/build commands need development dependencies even with NODE_ENV=production.
  env.NPM_CONFIG_INCLUDE = "dev";
  const node = (args, timeout) => run(process.execPath, args, timeout);
  const stages = [
    { id: "locked-install", work: () => run("npm", ["ci", "--include=dev", "--no-audit"]) },
    { id: "dependency-audit", work: () => run("npm", ["audit", "--include=dev", "--audit-level=moderate"]) },
    { id: "pure-tests", work: async () => {
      const suites = (await readdir("scripts")).filter(name => name.endsWith(".test.mjs") && !["database.test.mjs", "agent-database.test.mjs", "model-database.test.mjs"].includes(name)).sort();
      const server = ["agent.test.mjs", "operations.test.mjs", "model-provider.test.mjs", "model-context.test.mjs", "model-worker.test.mjs"];
      await node(["--test", "--test-concurrency=1", ...suites.filter(name => !server.includes(name)).map(name => `scripts/${name}`)]);
      await node(["--conditions=react-server", "--test", "--test-concurrency=1", ...suites.filter(name => server.includes(name)).map(name => `scripts/${name}`)]);
    } },
    { id: "lint", work: () => run("npm", ["run", "lint"]) },
    { id: "typecheck", work: async () => { await node(["node_modules/next/dist/bin/next", "typegen"]); await node(["node_modules/typescript/bin/tsc", "--noEmit"]); } },
    { id: "production-build", work: () => run("npm", ["run", "build"]) },
    { id: "database-migrations", work: async () => { await node(["scripts/database.mjs", "migrate"], 130000); await node(["scripts/database.mjs", "status"], 25000); } },
    { id: "database-tests", work: () => node(["--conditions=react-server", "--test", "scripts/database.test.mjs"]) },
    { id: "agent-database-tests", work: () => node(["--conditions=react-server", "--test", "--test-concurrency=1", "scripts/agent-database.test.mjs", "scripts/model-database.test.mjs"]) },
    { id: "runtime-smoke", work: async () => {
      server = startProduction(port, env, join(output, "production-server.log"));
      await waitForServer(origin, server); await node(["scripts/runtime-smoke.mjs"]);
      await node(["node_modules/playwright/cli.js", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"]);
    } },
    { id: "browser-regressions", work: () => node(["scripts/browser/run.mjs", "release"], 1200000) },
    { id: "browser-database", work: async () => { for (let repeat = 1; repeat <= 2; repeat++) await node(["--conditions=react-server", "scripts/browser/neon-client.mjs", `release-${repeat}`]); } },
    { id: "worker-recovery", work: () => node(["--conditions=react-server", "scripts/worker-recovery.mjs"]) },
    { id: "browser-performance", work: () => node(["scripts/browser/performance.mjs", "release"], 1800000) },
  ];
  if (JSON.stringify(stages.map(stage => stage.id)) !== JSON.stringify(REQUIRED_CHECKS)) throw new Error("Release stage definition is incomplete");
  await runVerificationStages(stages, async stage => { if (cancelled) throw new Error("Verification cancelled"); failedStage = stage.id; console.log(`Verification: ${stage.id}`); await stage.work(); }, async checks => {
    failedStage = "source-integrity";
    if (cancelled || await sourceFingerprint() !== before || git("rev-parse", "HEAD") !== head) throw new Error("Source changed during verification");
    if (!workingTree && git("status", "--porcelain", "--untracked-files=all")) throw new Error("Checkout changed during verification");
    let sourceSha256 = null;
    if (!workingTree) { execFileSync("git", ["archive", "--format=tar.gz", "-o", join(output, "source.tgz"), revision]); sourceSha256 = hash(await readFile(join(output, "source.tgz"))); }
    const result = { version: 1, revision: head, treeSha, sourceTreeSha256: before, lockSha256, sourceSha256, nodeVersion: process.versions.node, verified: true, releasable: !workingTree, completedAt: new Date().toISOString(), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(), checks };
    await writeFile(join(output, "verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(workingTree ? "Working-tree verification passed. This is not a release attestation." : `Release verified at ${revision}.`);
  });
} catch {
  await writeFile(join(output, "failure.json"), JSON.stringify({ stage: failedStage, verified: false, at: new Date().toISOString() }), { mode: 0o600 });
  console.error(`Verification failed at ${failedStage}; no release attestation was produced.`);
  process.exitCode = 1;
} finally { await server?.stop(); }
