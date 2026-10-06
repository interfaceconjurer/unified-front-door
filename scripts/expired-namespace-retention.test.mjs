import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";
import { readMigrations, runMigrations } from "./migrations.mjs";
import { parseRetentionArgs, pruneExpiredNamespaces } from "./expired-namespace-retention.mjs";

if (!process.env.DATABASE_TEST_URL) throw new Error("DATABASE_TEST_URL must explicitly identify an isolated development/test database.");
const client = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL, connectionTimeoutMillis: 5000, query_timeout: 35000 });
const namespaces = [], scopes = [], applicationEvidenceDays = [];
const journal = join(tmpdir(), `ufd-retention-test-namespaces-${process.pid}-${randomUUID()}.json`);
const saveJournal = () => writeFileSync(journal, JSON.stringify({ namespaces, scopes }), { mode: 0o600 });

before(async () => {
  await client.connect();
  await runMigrations(client, await readMigrations(), "status");
});
after(async () => {
  for (const id of namespaces) {
    await client.query("DELETE FROM model_dispatch_slots WHERE run_id IN (SELECT id FROM agent_runs WHERE namespace_id=$1)", [id]);
    await client.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)", [id]);
    await client.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [id]);
    await client.query("DELETE FROM workspaces WHERE namespace_id=$1", [id]);
    await client.query("DELETE FROM demo_namespaces WHERE id=$1", [id]);
  }
  for (const scope of scopes) {
    await client.query("DELETE FROM model_dispatch_slots WHERE scope=$1", [scope]);
    await client.query("DELETE FROM model_call_budgets WHERE scope=$1 OR scope LIKE $2", [scope, `${scope}:namespace:%`]);
  }
  for (const day of applicationEvidenceDays) await client.query("DELETE FROM model_call_budgets WHERE scope='application' AND day=$1", [day]);
  namespaces.length = 0; scopes.length = 0; saveJournal();
  await client.end();
});

async function createNamespace({ ageDays = 31, revoked = false, saved = true } = {}) {
  const namespaceId = randomUUID(), sessionId = randomUUID(), generation = randomUUID();
  namespaces.push(namespaceId); saveJournal();
  await client.query("INSERT INTO demo_namespaces(id) VALUES($1)", [namespaceId]);
  await client.query(`INSERT INTO demo_sessions(id,namespace_id,token_hash,profile_id,generation,expires_at,revoked)
    VALUES($1,$2,$3,'jw',$4,clock_timestamp()-($5*interval '1 day'),$6)`,
  [sessionId, namespaceId, randomUUID(), generation, ageDays, revoked]);
  const workspace = (await client.query("INSERT INTO workspaces(namespace_id,profile_id,assessment_cursor) VALUES($1,'jw','{}') RETURNING epoch", [namespaceId])).rows[0];
  if (saved) {
    await client.query(`INSERT INTO canvas_drafts(namespace_id,profile_id,id,surface_id,canvas,target,fields,revision)
      VALUES($1,'jw','retention-draft','build','{}','{}','{"notes":"Saved draft"}',1)`, [namespaceId]);
    await client.query(`INSERT INTO improvement_projects(namespace_id,profile_id,id,run_id,source_draft_id,create_command_id,revision,record)
      VALUES($1,'jw','retention-project',NULL,'source','create',1,'{"source":"brief","name":"Saved project"}')`, [namespaceId]);
    await client.query(`INSERT INTO agent_conversations(namespace_id,profile_id,epoch,id,thread_key,conversation)
      VALUES($1,'jw',$2,$3,'saved-thread','{"messages":[{"text":"Saved chat"}]}')`, [namespaceId, workspace.epoch, randomUUID()]);
    await client.query("INSERT INTO session_receipts(session_id,command_id,payload_hash,result) VALUES($1,'saved-command','hash','{}')", [sessionId]);
  }
  return { namespaceId, sessionId, generation, epoch: workspace.epoch };
}

async function addSession(scope, ageDays) {
  const id = randomUUID();
  await client.query(`INSERT INTO demo_sessions(id,namespace_id,token_hash,profile_id,generation,expires_at)
    VALUES($1,$2,$3,'jw',$4,clock_timestamp()-($5*interval '1 day'))`,
  [id, scope.namespaceId, randomUUID(), randomUUID(), ageDays]);
  return id;
}

async function addRun(scope, { status = "pending", leaseSeconds = null } = {}) {
  const conversationId = randomUUID(), runId = randomUUID();
  await client.query(`INSERT INTO agent_conversations(namespace_id,profile_id,epoch,id,thread_key,conversation)
    VALUES($1,'jw',$2,$3,$4,'{"messages":[]}'::jsonb)`, [scope.namespaceId, scope.epoch, conversationId, `run-${runId}`]);
  await client.query(`INSERT INTO agent_runs(namespace_id,profile_id,epoch,id,session_id,generation,request_id,turn_id,conversation_id,kind,status,input,lease_until)
    VALUES($1,'jw',$2,$3,$4,$5,$6,$7,$8,'chat',$9,'{"kind":"chat"}'::jsonb,
      CASE WHEN $10::int IS NULL THEN NULL ELSE clock_timestamp()+($10*interval '1 second') END)`,
  [scope.namespaceId, scope.epoch, runId, scope.sessionId, scope.generation, randomUUID(), randomUUID(), conversationId, status, leaseSeconds]);
  return runId;
}

async function exists(table, namespaceId) {
  assert(["demo_namespaces", "demo_sessions", "workspaces", "canvas_drafts", "improvement_projects", "agent_conversations", "agent_runs"].includes(table));
  const column = table === "demo_namespaces" ? "id" : "namespace_id";
  return Number((await client.query(`SELECT count(*) AS count FROM ${table} WHERE ${column}=$1`, [namespaceId])).rows[0].count);
}

test("CLI requires an explicit matching target for apply and validates bounded resume options", () => {
  assert.deepEqual(parseRetentionArgs([]), { apply: false, limit: 25, namespaceId: null, after: null, expectedTarget: null, help: false });
  assert.throws(() => parseRetentionArgs(["--apply"]), /expect-target/);
  assert.throws(() => parseRetentionArgs(["--limit", "0"]), /limit/);
  assert.throws(() => parseRetentionArgs(["--limit", "101"]), /limit/);
  assert.throws(() => parseRetentionArgs(["--namespace", "bad"]), /UUID/);
  const id = randomUUID(), cursor = `2025-01-01T01:02:03.123456Z@${id}`;
  assert.deepEqual(parseRetentionArgs(["--apply", "--expect-target", "localhost:5432/test", "--limit", "2", "--after", cursor]),
    { apply: true, expectedTarget: "localhost:5432/test", limit: 2, namespaceId: null, after: { expiry: "2025-01-01T01:02:03.123456Z", namespaceId: id }, help: false });
  assert.throws(() => parseRetentionArgs(["--namespace", id, "--after", cursor]), /cannot/);
});

test("dry run preserves saved data; apply deletes an expired namespace, exact reservations and run slots once", async () => {
  const scope = await createNamespace({ ageDays: 45 });
  const runId = await addRun(scope, { status: "pending", leaseSeconds: -60 });
  const customScope = `test:${randomUUID()}`; scopes.push(customScope); saveJournal();
  const applicationDay = `${2400 + (Number.parseInt(randomUUID().slice(0, 4), 16) % 500)}-01-01`;
  const insertedEvidence = await client.query("INSERT INTO model_call_budgets(scope,day,reserved,call_limit) VALUES('application',$1,2,5) ON CONFLICT DO NOTHING", [applicationDay]);
  if (insertedEvidence.rowCount) applicationEvidenceDays.push(applicationDay);
  const applicationBefore = (await client.query("SELECT scope,day,reserved,call_limit FROM model_call_budgets WHERE scope='application' AND day=$1", [applicationDay])).rows[0];
  await client.query("INSERT INTO model_call_budgets(scope,day,reserved,call_limit) VALUES($1,CURRENT_DATE,1,5)", [customScope]);
  for (const budgetScope of ["application", customScope]) {
    await client.query("INSERT INTO model_call_budgets(scope,day,reserved,call_limit) VALUES($1,CURRENT_DATE,1,5)", [`${budgetScope}:namespace:${scope.namespaceId}`]);
  }
  // The custom reservation has no attempt: a workspace reset can cascade the
  // attempt while its paid reservation intentionally remains in this table.
  await client.query("INSERT INTO model_dispatch_slots(scope,run_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')", [customScope, runId]);
  const dry = await pruneExpiredNamespaces(client, { namespaceId: scope.namespaceId });
  assert.equal(dry.mode, "dry-run"); assert.equal(dry.eligible, 1); assert.equal(dry.deleted, 0);
  assert.equal(dry.namespaces[0].conversations, 2); assert.equal(dry.namespaces[0].projects, 1);
  assert.equal(dry.namespaces[0].canvas_drafts, 1); assert.equal(dry.namespaces[0].namespace_budgets, 2);
  assert.equal(dry.namespaces[0].dispatch_slots, 1); assert(dry.namespaces[0].ageDaysApprox >= 44);
  assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
  const applied = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
  assert.equal(applied.deleted, 1);
  for (const table of ["demo_namespaces", "demo_sessions", "workspaces", "canvas_drafts", "improvement_projects", "agent_conversations", "agent_runs"])
    assert.equal(await exists(table, scope.namespaceId), 0, table);
  assert.equal((await client.query("SELECT count(*)::int AS count FROM session_receipts WHERE session_id=$1", [scope.sessionId])).rows[0].count, 0);
  assert.equal((await client.query("SELECT count(*)::int AS count FROM model_dispatch_slots WHERE run_id=$1", [runId])).rows[0].count, 0);
  assert.deepEqual((await client.query("SELECT scope,day,reserved,call_limit FROM model_call_budgets WHERE scope='application' AND day=$1", [applicationDay])).rows[0], applicationBefore);
  assert.equal((await client.query("SELECT count(*)::int AS count FROM model_call_budgets WHERE scope=$1", [customScope])).rows[0].count, 1, "global evidence is retained");
  for (const budgetScope of ["application", customScope]) {
    assert.equal((await client.query("SELECT count(*)::int AS count FROM model_call_budgets WHERE scope=$1", [`${budgetScope}:namespace:${scope.namespaceId}`])).rows[0].count, 0);
  }
  const repeated = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
  assert.equal(repeated.scanned, 0); assert.equal(repeated.deleted, 0);
});

test("latest session expiry controls eligibility, including revoked and unexpired sessions", async () => {
  const young = await createNamespace({ ageDays: 29 });
  const revokedYoung = await createNamespace({ ageDays: 5, revoked: true });
  const mixed = await createNamespace({ ageDays: 50 }); await addSession(mixed, 10);
  for (const scope of [young, revokedYoung, mixed]) {
    const report = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
    assert.equal(report.deleted, 0); assert.equal(report.namespaces[0].outcome, "too_recent");
    assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
  }
});

test("the locked final check keeps PostgreSQL microseconds and elapsed hours across DST", async () => {
  const scope = await createNamespace({ ageDays: 40, saved: false });
  // This pair occupies one JS Date millisecond. A driver-side Date comparison
  // would see equality and could delete too early.
  const boundary = (await client.query(`SELECT to_char(
    (date_trunc('milliseconds',clock_timestamp())-interval '720 hours'+interval '0.0005 seconds') AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cutoff`)).rows[0];
  await client.query("UPDATE demo_sessions SET expires_at=$2::timestamptz+interval '0.0002 seconds' WHERE namespace_id=$1", [scope.namespaceId, boundary.cutoff]);
  const roundedExpiry = (await client.query("SELECT expires_at FROM demo_sessions WHERE namespace_id=$1", [scope.namespaceId])).rows[0].expires_at;
  assert.equal(new Date(boundary.cutoff).getTime(), roundedExpiry.getTime());
  const frozenClock = { query(sql, values) {
    if (sql.startsWith("SELECT to_char((clock_timestamp()")) return Promise.resolve({ rows: [{ cutoff: boundary.cutoff }] });
    return client.query(sql, values);
  } };
  const report = await pruneExpiredNamespaces(frozenClock, { apply: true, namespaceId: scope.namespaceId });
  assert.equal(report.deleted, 0); assert.equal(report.namespaces[0].outcome, "too_recent");
  assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
  await client.query("SET TIME ZONE 'America/New_York'");
  try {
    const row = (await client.query(`SELECT extract(epoch FROM
      ('2026-03-15 12:00-04'::timestamptz-interval '30 days')-
      ('2026-03-15 12:00-04'::timestamptz-interval '720 hours')) AS seconds`)).rows[0];
    assert.equal(Math.abs(Number(row.seconds)), 3600);
  } finally { await client.query("SET TIME ZONE 'UTC'"); }
});

test("a live lease blocks cleanup while stale pending work can be removed", async () => {
  const leased = await createNamespace({ ageDays: 40 }), stale = await createNamespace({ ageDays: 40 });
  await addRun(leased, { status: "running", leaseSeconds: 3600 });
  await addRun(stale, { status: "pending", leaseSeconds: -60 });
  const blocked = await pruneExpiredNamespaces(client, { apply: true, namespaceId: leased.namespaceId });
  assert.equal(blocked.namespaces[0].outcome, "live_lease"); assert.equal(await exists("demo_namespaces", leased.namespaceId), 1);
  const applied = await pruneExpiredNamespaces(client, { apply: true, namespaceId: stale.namespaceId });
  assert.equal(applied.deleted, 1); assert.equal(await exists("agent_runs", stale.namespaceId), 0);
});

test("session and run row locks each block deletion without waiting or partial cleanup", async () => {
  for (const kind of ["session", "run"]) {
    const scope = await createNamespace({ ageDays: 40 }), runId = await addRun(scope);
    const blocker = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL, connectionTimeoutMillis: 5000 });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      if (kind === "session") await blocker.query("SELECT id FROM demo_sessions WHERE id=$1 FOR UPDATE", [scope.sessionId]);
      else await blocker.query("SELECT id FROM agent_runs WHERE id=$1 FOR UPDATE", [runId]);
      const report = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
      assert.equal(report.deleted, 0); assert.equal(report.namespaces[0].outcome, `${kind}_locked`);
      assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end();
    }
    assert.equal((await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId })).deleted, 1);
  }
});

test("a concurrent session extension is seen after its lock releases", async () => {
  const scope = await createNamespace({ ageDays: 45, saved: false });
  const renewer = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL, connectionTimeoutMillis: 5000 });
  await renewer.connect();
  try {
    await renewer.query("BEGIN");
    await renewer.query("UPDATE demo_sessions SET expires_at=clock_timestamp()+interval '1 hour' WHERE id=$1", [scope.sessionId]);
    const first = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
    assert.equal(first.namespaces[0].outcome, "session_locked");
    assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
    await renewer.query("COMMIT");
  } finally { await renewer.query("ROLLBACK").catch(() => {}); await renewer.end(); }
  const second = await pruneExpiredNamespaces(client, { apply: true, namespaceId: scope.namespaceId });
  assert.equal(second.namespaces[0].outcome, "too_recent");
  assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
});

test("resume cursor advances past a full blocked first page", async () => {
  const blocked = [];
  for (const ageDays of [405, 404, 403, 402]) {
    const scope = await createNamespace({ ageDays, saved: false }); await addRun(scope, { status: "running", leaseSeconds: 3600 });
    blocked.push(scope);
  }
  const reachable = await createNamespace({ ageDays: 401, saved: false });
  const first = await pruneExpiredNamespaces(client, { apply: true, limit: 1 });
  assert.equal(first.scanLimit, 4); assert.equal(first.scanned, 4); assert.equal(first.blocked, 4);
  assert.equal(first.scanCapped, true); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
  const resumed = await pruneExpiredNamespaces(client, { apply: true, limit: 1, after: parseRetentionArgs(["--after", first.nextCursor]).after });
  assert.equal(resumed.deleted, 1); assert.equal(resumed.namespaces[0].namespaceId, reachable.namespaceId);
  assert.equal(await exists("demo_namespaces", reachable.namespaceId), 0);
  for (const scope of blocked) assert.equal(await exists("demo_namespaces", scope.namespaceId), 1);
});

test("confirmed per-namespace progress survives a later failure and rerun is idempotent", async () => {
  const first = await createNamespace({ ageDays: 505, saved: false }), second = await createNamespace({ ageDays: 504, saved: false });
  const progress = []; let begins = 0;
  const failing = { query(...args) { if (args[0] === "BEGIN" && ++begins === 2) throw new Error("injected second-candidate failure"); return client.query(...args); } };
  await assert.rejects(pruneExpiredNamespaces(failing, { apply: true, limit: 2 }, entry => progress.push(entry)), /injected/);
  assert.equal(progress[0].namespaceId, first.namespaceId); assert.equal(progress[0].outcome, "deleted");
  assert.equal(await exists("demo_namespaces", first.namespaceId), 0);
  assert.equal(await exists("demo_namespaces", second.namespaceId), 1);
  const retry = await pruneExpiredNamespaces(client, { apply: true, namespaceId: second.namespaceId });
  assert.equal(retry.deleted, 1); assert.equal(await exists("demo_namespaces", second.namespaceId), 0);
});
