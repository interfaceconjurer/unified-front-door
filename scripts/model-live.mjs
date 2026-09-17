// Paid acceptance is deliberately excluded from the ordinary release gate.
// Run only against an isolated local production server with AGENT_PROVIDER=anthropic.
import assert from "node:assert/strict";
import { execFileSync, fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium } from "playwright";

if (process.argv.slice(2).join(" ") !== "--allow-live-usd=5" || !process.env.DATABASE_TEST_URL
  || !process.env.ANTHROPIC_API_KEY || process.env.AGENT_PROVIDER !== "anthropic") throw Error("Explicit $5 authorization, test database, and Anthropic configuration are required.");
const origin = process.env.BROWSER_TEST_ORIGIN;
if (!origin || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("An isolated local production origin is required.");
const output = resolve(process.env.MODEL_LIVE_OUTPUT ?? ".release/model-live");
mkdirSync(output, { recursive: true, mode: 0o700 });
const ledgerPath = join(output, "spend-ledger.json"), resultPath = join(output, "result.json"), namespacePath = join(output, "namespaces.json");
// Reserve $2.02 per dispatch: conservatively one million input tokens at $2/M
// plus the 1,024-output bound at $10/M. Actual requests are also <=32 KiB.
// Never clear or reuse a ledger automatically after a failed/uncertain attempt.
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : { allowanceUsd: 5, reservedUsd: 0, attempts: [] };
assert.equal(ledger.allowanceUsd, 5); assert.equal(ledger.attempts.length, 0, "Review the existing spend ledger before any additional paid verification.");
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
save(ledgerPath, ledger);
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const require = createRequire(import.meta.url), { transaction, databasePool } = require("../.worker/lib/db.js");
function sourceHash() {
  const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0"))]
    .filter(file => /^(src\/|scripts\/|db\/|package(?:-lock)?\.json$|.*config\.[^/]+$|Procfile$|\.nvmrc$)/.test(file)).sort();
  const digest = createHash("sha256");
  for (const file of files) { digest.update(file + "\0"); digest.update(existsSync(file) ? readFileSync(file) : "<deleted>"); digest.update("\0"); }
  return digest.digest("hex");
}
const result = { startedAt: new Date().toISOString(), nodeVersion: process.versions.node, sourceSha256: sourceHash(), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
  checks: [], paidDispatches: 0, cleanup: false, stage: "bootstrap", passed: false };
const browser = await chromium.launch();
const context = await browser.newContext({ httpCredentials: { username: process.env.BASIC_AUTH_USER ?? "guest", password: process.env.BASIC_AUTH_PASSWORD }, reducedMotion: "reduce", viewport: { width: 1440, height: 1100 } });
const children = new Set();
let namespace, session, confirmedTarget = false;
const headers = { Origin: origin, "x-ufd-mutation": "1" };
async function post(path, data) {
  const response = await context.request.post(origin + path, { headers, data });
  assert.equal(response.status(), 200, `Verification ${path} status`); return response.json();
}
async function get(path) {
  const response = await context.request.get(origin + path + "?generation=" + encodeURIComponent(session.generation));
  assert.equal(response.status(), 200); return response.json();
}
async function until(read, accept, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { const value = await read(); if (accept(value)) return value; await new Promise(resolve => setTimeout(resolve, 150)); }
  throw Error("Verification observation timed out.");
}
const queryRun = id => transaction(async db => (await db.query("SELECT status,result,error,execution FROM agent_runs WHERE namespace_id=$1 AND id=$2", [namespace, id])).rows[0]);
async function startWorker(runId, mode) {
  if (mode === "model") {
    assert(ledger.attempts.length < 2 && ledger.reservedUsd + 2.02 <= ledger.allowanceUsd);
    ledger.reservedUsd = Math.round((ledger.reservedUsd + 2.02) * 100) / 100;
    ledger.attempts.push({ runId, reservedUsd: 2.02, outcome: "unknown" }); save(ledgerPath, ledger);
  }
  const child = fork(new URL("./model-live-worker.mjs", import.meta.url), [runId, mode], {
    execArgv: ["--conditions=react-server"], env: { ...process.env, MODEL_LIVE_VERIFICATION: "authorized" }, stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  children.add(child);
  let dispatched = false, dispatches = 0, unexpectedDispatch = false;
  child.on("message", message => {
    if (message.dispatchStarted) { dispatched = true; result.paidDispatches++; }
    if (message.unexpectedDispatch) unexpectedDispatch = true;
    if (Number.isSafeInteger(message.dispatches)) dispatches = message.dispatches;
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), 90000);
  const ended = new Promise((resolve, reject) => {
    child.once("error", () => reject(Error("Verification worker failed to start.")));
    child.once("exit", (code, signal) => { children.delete(child); clearTimeout(timer); resolve({ code, signal, dispatches, unexpectedDispatch }); });
  });
  return { ended, dispatched: () => dispatched };
}
try {
  session = (await post("/api/session", { action: "bootstrap" })).session;
  namespace = session.namespaceId; save(namespacePath, [namespace]);
  assert.equal((await transaction(db => db.query("SELECT id FROM demo_namespaces WHERE id=$1", [namespace]))).rowCount, 1);
  confirmedTarget = true;
  session = (await post("/api/session", { action: "select", profileId: "sp", generation: session.generation, commandId: randomUUID() })).session;
  const state = await get("/api/application");
  await post("/api/application", { generation: session.generation, command: { kind: "assessment.start", expectedRevision: state.assessmentRevision, commandId: randomUUID() } });
  const assessment = (await get("/api/agent")).runs.find(run => run.kind === "assessment"); assert(assessment);
  const assessmentWorker = await startWorker(assessment.id, "assessment"); assert.equal((await assessmentWorker.ended).code, 0);
  assert.equal((await get("/api/application")).assessment.status, "complete");
  const page = await context.newPage(); await page.goto(origin + "/");
  const composer = page.getByRole("textbox", { name: "Message the agent", exact: true });
  await composer.waitFor();
  async function submit(text) {
    await composer.fill(text);
    const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/agent") && response.request().method() === "POST" && response.request().postDataJSON()?.command?.kind === "submit");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const response = await responsePromise; assert.equal(response.status(), 200);
    return { receipt: (await response.json()).result, body: response.request().postDataJSON() };
  }
  result.stage = "provider-completion";
  const first = await submit("Using the captured assessment findings, name one finding by its exact title or ID and explain a short proposed plan in three bullets. Clearly identify the evidence basis.");
  assert.equal((await queryRun(first.receipt.runId)).execution.kind, "model");
  assert.deepEqual((await post("/api/agent", first.body)).result, first.receipt);
  const firstWorker = await startWorker(first.receipt.runId, "model"); assert.equal((await firstWorker.ended).code, 0);
  const completed = await queryRun(first.receipt.runId);
  const firstAttempt = (await transaction(db => db.query("SELECT status,input_tokens,output_tokens FROM model_attempts WHERE run_id=$1", [first.receipt.runId]))).rows[0];
  const safeCodes = ["unconfigured", "model_limit", "model_outcome_unknown", "model_failed", "model_refused", "model_incomplete", "model_rate_limited", "model_timeout", "model_invalid_response"];
  result.firstRun = { status: completed.status, errorCode: safeCodes.includes(completed.error?.code) ? completed.error.code : null, attemptStatus: firstAttempt?.status ?? null };
  assert.equal(completed.status, "completed"); assert(completed.result.trim());
  result.policy = completed.execution.settings.policy;
  const evidence = JSON.parse(completed.execution.prompt.messages.at(-1).content).evidence;
  assert(evidence.findings.some(finding => [finding.id, finding.title].some(value => typeof value === "string" && completed.result.toLowerCase().includes(value.toLowerCase()))), "Answer must cite a captured finding title or ID.");
  assert(/\b(demo|captured|supplied|provided)\b/i.test(completed.result) && /\b(assessment|findings|data|evidence)\b/i.test(completed.result), "Answer must identify its captured evidence basis.");
  assert.equal(firstAttempt.status, "succeeded"); assert(firstAttempt.input_tokens > 0 && firstAttempt.output_tokens > 0);
  Object.assign(ledger.attempts[0], { outcome: "succeeded", inputTokens: firstAttempt.input_tokens, outputTokens: firstAttempt.output_tokens,
    usageCostUsd: firstAttempt.input_tokens * 2 / 1000000 + firstAttempt.output_tokens * 10 / 1000000 }); save(ledgerPath, ledger);
  result.completionSha256 = createHash("sha256").update(completed.result).digest("hex");
  result.stage = "persisted-browser-reload";
  await page.locator(`[data-run-id="${first.receipt.runId}"][data-run-status="completed"]`).waitFor({ timeout: 15000 });
  await page.reload();
  await page.locator(`[data-run-id="${first.receipt.runId}"][data-run-status="completed"]`).waitFor();
  assert((await page.getByRole("log", { name: "Conversation" }).innerText()).includes(completed.result));
  result.checks.push("Real Anthropic completion and token usage persist; the production browser restores the same text after reload; duplicate submission returns the same run.");
  result.stage = "live-cancellation";
  const second = await submit("Explain every captured finding and propose a detailed prioritized review plan, using the available response space.");
  const secondWorker = await startWorker(second.receipt.runId, "model");
  await until(async () => secondWorker.dispatched(), Boolean);
  const cancelStarted = Date.now();
  await post("/api/agent", { generation: session.generation, command: { kind: "cancel", runId: second.receipt.runId, requestId: randomUUID() } });
  assert.equal((await secondWorker.ended).code, 0);
  result.cancelToWorkerExitMs = Date.now() - cancelStarted;
  assert(result.cancelToWorkerExitMs < 15000, "Cancellation must interrupt the live worker promptly.");
  const cancelled = await queryRun(second.receipt.runId);
  assert.equal(cancelled.status, "cancelled"); assert(!cancelled.result);
  await page.locator(`[data-run-id="${second.receipt.runId}"][data-run-status="cancelled"]`).waitFor();
  // A terminal run is polled again to prove it cannot dispatch a second request.
  const replay = await startWorker(second.receipt.runId, "terminal");
  const replayResult = await replay.ended; assert.equal(replayResult.code, 0); assert.equal(replayResult.dispatches, 0); assert.equal(replayResult.unexpectedDispatch, false);
  ledger.attempts[1].outcome = "cancelled_remote_cost_unknown"; save(ledgerPath, ledger);
  assert.equal(result.paidDispatches, 2);
  result.checks.push("Cancellation after entering the real transport remains terminal; worker exits; polling the cancelled run makes no additional provider call. Remote work and cost remain unknown.");
  assert.equal(sourceHash(), result.sourceSha256, "Source must remain stable throughout live acceptance.");
  result.stage = "complete"; result.passed = true;
} catch {
  // Preserve safe stage/correlation evidence without raw responses or credentials.
  result.failed = true; process.exitCode = 1;
} finally {
  for (const child of children) child.kill("SIGTERM");
  await until(async () => children.size, size => size === 0, 15000).catch(() => { for (const child of children) child.kill("SIGKILL"); });
  await browser.close();
  if (namespace && confirmedTarget && children.size === 0) {
    try {
      await transaction(async db => {
        await db.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)", [namespace]);
        await db.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [namespace]);
        await db.query("DELETE FROM workspaces WHERE namespace_id=$1", [namespace]);
        await db.query("DELETE FROM demo_namespaces WHERE id=$1", [namespace]);
      });
      result.cleanup = true; save(namespacePath, []);
    } catch { result.cleanup = false; process.exitCode = 1; }
  }
  if (!result.cleanup) { result.passed = false; process.exitCode = 1; }
  await databasePool().end(); save(resultPath, result);
}
console.log(JSON.stringify(result));
