process.env.AGENT_PROVIDER = "demo";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { request } from "playwright";
import { createRequire } from "node:module";
import { origin, outputPath, httpCredentials } from "./browser/config.mjs";
if (!process.env.DATABASE_TEST_URL) throw new Error("An explicit disposable test database is required.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const require = createRequire(import.meta.url), { transaction, databasePool } = require("../.worker/lib/db.js");
const api = await request.newContext({ baseURL: origin, httpCredentials });
const headers = { Origin: origin, "x-ufd-mutation": "1" };
const children = new Set(), result = { checks: [], cleanup: false };
let namespace, confirmedTarget = false, session;
async function post(path, body) { const response = await api.post(path, { headers, data: body }); assert.equal(response.status(), 200); return response.json(); }
const command = async input => (await post("/api/agent", { generation: session.generation, command: { requestId: randomUUID(), ...input } })).result;
const run = id => transaction(async db => (await db.query("SELECT status,lease_until,recoveries FROM agent_runs WHERE namespace_id=$1 AND id=$2", [namespace, id])).rows[0]);
async function worker(runId, mode) {
  const child = fork(new URL("./worker-recovery-child.mjs", import.meta.url), [runId, mode], { execArgv: ["--conditions=react-server"], env: process.env, stdio: ["ignore", "inherit", "inherit", "ipc"] });
  children.add(child);
  const ended = new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code, signal) => { children.delete(child); resolve({ code, signal }); }); });
  const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
  try {
    if (mode === "pause") {
      await Promise.race([new Promise(resolve => child.once("message", message => { assert.equal(message.leased, true); resolve(); })), ended.then(() => { throw new Error("Worker exited before acquiring its owned lease"); })]);
      child.kill("SIGKILL"); const exit = await ended; assert.equal(exit.signal, "SIGKILL");
    } else { const exit = await ended; assert.equal(exit.code, 0); }
  } finally { clearTimeout(timer); if (children.has(child)) child.kill("SIGKILL"); }
}
try {
  session = (await post("/api/session", { action: "bootstrap" })).session;
  namespace = session.namespaceId;
  writeFileSync(outputPath("worker-recovery-namespaces.json"), JSON.stringify([namespace]), { mode: 0o600 });
  assert.equal((await transaction(db => db.query("SELECT id FROM demo_namespaces WHERE id=$1", [namespace]))).rowCount, 1, "Browser server and cleanup database must match"); confirmedTarget = true;
  session = (await post("/api/session", { action: "select", profileId: "jw", generation: session.generation, commandId: randomUUID() })).session;
  const context = { surface: "home", target: { projectId: null, worktreeId: null, orgId: null } };
  const first = await command({ kind: "submit", context, text: "Build an automation after a worker restart" });
  await worker(first.runId, "pause");
  const leased = await run(first.runId); assert.equal(leased.status, "running"); assert(leased.lease_until);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, new Date(leased.lease_until).getTime() - Date.now()) + 200));
  await worker(first.runId, "complete");
  const recovered = await run(first.runId); assert.equal(recovered.status, "completed"); assert.equal(recovered.recoveries, 1);
  assert.equal((await transaction(db => db.query("SELECT sequence FROM agent_events WHERE namespace_id=$1 AND run_id=$2 AND event->>'kind'='completed'", [namespace, first.runId]))).rowCount, 1);
  result.checks.push("Owned worker process killed after lease acquisition; new process recovers same durable run exactly once after lease expiry");
  const second = await command({ kind: "submit", context, text: "Cancel this before execution" });
  await command({ kind: "cancel", runId: second.runId }); await worker(second.runId, "complete"); assert.equal((await run(second.runId)).status, "cancelled");
  result.checks.push("Authenticated cancellation remains terminal when a worker process polls the cancelled run");
  const third = await command({ kind: "submit", context, text: "Retry one deterministic failure" });
  await worker(third.runId, "fail"); assert.equal((await run(third.runId)).status, "failed");
  const retry = await command({ kind: "retry", runId: third.runId }); assert.notEqual(retry.runId, third.runId); await worker(retry.runId, "complete"); assert.equal((await run(retry.runId)).status, "completed");
  const observed = await api.get("/api/agent?generation=" + encodeURIComponent(session.generation)); assert.equal(observed.status(), 200);
  const snapshot = await observed.json();
  const users = snapshot.conversations.flatMap(item => item.conversation.messages).filter(message => message.role === "user"); assert.equal(users.length, 3);
  const firstReplies = snapshot.conversations.flatMap(item => item.conversation.messages).filter(message => message.role === "agent" && message.runId === first.runId && message.turnId === first.turnId); assert.equal(firstReplies.length, 1); assert(firstReplies[0].text);
  result.checks.push("Failed attempt retries with a new run identity and preserves the three acknowledged user turns without duplicate submission");
} finally {
  for (const child of children) child.kill("SIGKILL");
  await api.dispose();
  if (namespace && confirmedTarget) {
    await transaction(async db => { await db.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)", [namespace]); await db.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [namespace]); await db.query("DELETE FROM workspaces WHERE namespace_id=$1", [namespace]); await db.query("DELETE FROM demo_namespaces WHERE id=$1", [namespace]); });
    result.cleanup = true; writeFileSync(outputPath("worker-recovery-namespaces.json"), "[]", { mode: 0o600 });
  }
  await databasePool().end();
  writeFileSync(outputPath("worker-recovery.json"), JSON.stringify(result, null, 2));
}
console.log(JSON.stringify(result));
