import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { testModules } from "./test-modules.mjs";
import { REQUIRED_CHECKS, runVerificationStages, validateVerification } from "./release-contract.mjs";
import targets from "../src/lib/server/database-target.js";
const modules = testModules(); after(modules.cleanup);
const { basicAuth, validateRuntimeConfiguration } = modules.load("lib/server/configuration");
const { checkDatabaseSchema, probeDatabaseSchema, migrationManifest } = modules.load("lib/server/readiness");
const { runTransaction, transaction, databasePool } = modules.load("lib/db");
const diagnostics = modules.load("lib/server/diagnostics");
const { responseError } = modules.load("lib/server/http"), { ApplicationError } = modules.load("lib/application/contracts");
const valid = { NODE_ENV: "production", BASIC_AUTH_PASSWORD: "test-password", APP_ORIGIN: "http://localhost:3000", DATABASE_URL: "postgres://test:fake@localhost:5432/app" };

test("development loopback aliases accept only the actual browser host and configured port; production keeps one exact origin", () => {
  const { assertSameOrigin } = modules.load("lib/server/http");
  const request = (origin, patch = {}) => new Request("http://127.0.0.1:3000/api/session", { method: "POST", headers: { origin, host: new URL(origin).host, "x-ufd-mutation": "1", "sec-fetch-site": "same-origin", ...patch } });
  const dev = { ...valid, NODE_ENV: "development" };
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) assert.doesNotThrow(() => assertSameOrigin(request(origin), dev));
  for (const origin of ["http://127.0.0.1:3001", "https://127.0.0.1:3000", "http://localhost.evil.test:3000", "http://192.168.1.2:3000", "http://127.0.0.1:3000/path"]) assert.throws(() => assertSameOrigin(request(origin), dev), error => error.status === 403);
  for (const patch of [{ host: "elsewhere.test:3000" }, { host: "localhost:3000" }, { "sec-fetch-site": "cross-site" }, { "x-ufd-mutation": "0" }]) assert.throws(() => assertSameOrigin(request("http://127.0.0.1:3000", patch), dev), error => error.status === 403);
  assert.throws(() => assertSameOrigin(request("http://127.0.0.1:3000"), valid), error => error.status === 403);
  assert.throws(() => assertSameOrigin(request("http://127.0.0.1:3000"), { ...dev, APP_ORIGIN: "https://app.example.com" }), error => error.status === 403);
  assert.doesNotThrow(() => assertSameOrigin(request("http://localhost:3000"), valid));
});

test("runtime configuration rejects incomplete credentials, invalid origin and invalid database without leaking values", () => {
  assert.doesNotThrow(() => validateRuntimeConfiguration(valid));
  assert.equal(basicAuth(valid).user, "guest");
  for (const patch of [{ BASIC_AUTH_PASSWORD: "" }, { BASIC_AUTH_PASSWORD: " \t" }, { BASIC_AUTH_USER: "" }, { BASIC_AUTH_USER: "bad:user" }, { BASIC_AUTH_PASSWORD: "secret\nline" }, { APP_ORIGIN: undefined }, { APP_ORIGIN: "https://example.com/path" }, { DATABASE_URL: "postgres://secret@example.com" }]) {
    assert.throws(() => validateRuntimeConfiguration({ ...valid, ...patch }), error => error.status === 503 && !error.message.includes("secret"));
  }
});
test("direct/runtime targets match host, port and database while allowing separate migration role", () => {
  const pair = { DATABASE_URL: "postgres://runtime:one@ep-example-pooler.us-east-1.aws.neon.tech/app?sslmode=require", DATABASE_URL_UNPOOLED: "postgres://migrator:two@ep-example.us-east-1.aws.neon.tech/app?sslmode=require" };
  assert.equal(targets.databaseConfiguration(pair, true).directUrl, pair.DATABASE_URL_UNPOOLED);
  for (const url of ["postgres://migration:two@other.us-east-1.aws.neon.tech/app", "postgres://migration:two@ep-example.us-east-1.aws.neon.tech:5433/app", "postgres://migration:two@ep-example.us-east-1.aws.neon.tech/other", pair.DATABASE_URL]) assert.throws(() => targets.databaseConfiguration({ ...pair, DATABASE_URL_UNPOOLED: url }, true));
  assert.throws(() => targets.databaseConfiguration({ DATABASE_URL: "postgres://x:y@db-pooler.example/app", DATABASE_URL_UNPOOLED: "postgres://x:y@db.example/app" }, true));
  assert.throws(() => targets.databaseConfiguration({ DATABASE_URL: pair.DATABASE_URL }, true));
  for (const query of ["host=other", "port=7777", "database=other", "dbname=other", "service=other", "user=other", "options=-c%20search_path=other", "search_path=other", "schema=other"]) assert.throws(() => targets.databaseTarget(valid.DATABASE_URL + "?" + query));
});
test("readiness rejects unknown, missing and altered migration history and probes required columns read-only", async () => {
  const manifest = await migrationManifest(); assert.equal(manifest.length, 7);
  const calls = [], client = { query: async text => { calls.push(text); return { rows: text.includes("schema_migrations") ? manifest : [] }; } };
  await checkDatabaseSchema(client, manifest); assert.equal(calls[0], "SET TRANSACTION READ ONLY"); assert(calls.some(sql => sql.includes("effect_state") && sql.includes("LIMIT 0")));
  for (const rows of [manifest.slice(1), [...manifest, { name: "999_extra.sql", checksum: "x" }], manifest.map((row, i) => i ? row : { ...row, checksum: "changed" })]) await assert.rejects(checkDatabaseSchema({ query: async () => ({ rows }) }, manifest), /schema version/);
  await assert.rejects(checkDatabaseSchema({ query: async text => { if (text.includes("agent_runs")) throw Error("missing column"); return { rows: text.includes("schema_migrations") ? manifest : [] }; } }, manifest), /missing column/);
});
test("readiness owns and destroys a hung or failed connection; confirmed commit returns a healthy one", async () => {
  const released = [];
  const client = query => Object.assign(new EventEmitter(), { query, release: destroy => released.push(destroy) });
  await assert.rejects(probeDatabaseSchema(client(() => new Promise(() => {})), [], 20), /deadline/);
  assert.deepEqual(released, [true]);
  await assert.rejects(probeDatabaseSchema(client(async () => { throw Error("failure"); }), [], 20));
  assert.deepEqual(released, [true, true]);
  await probeDatabaseSchema(client(async () => ({ rows: [] })), [], 1000);
  assert.deepEqual(released, [true, true, false]);
});
function ownedConnection(hangAt) {
  const client = new EventEmitter(), queries = [], releases = [];
  let released = false, resolveHang;
  client.query = async sql => {
    if (released) throw Error("Connection was destroyed");
    queries.push(sql);
    if (sql === hangAt) await new Promise(resolve => { resolveHang = resolve; });
    return { rows: [] };
  };
  client.release = destroy => { assert.equal(released, false, "Release occurs exactly once"); released = true; releases.push(destroy); };
  return { client, queries, releases, resume: () => resolveHang?.() };
}
test("transaction BEGIN and COMMIT blackholes destroy once without replaying work; a fresh transaction succeeds", async () => {
  for (const step of ["BEGIN", "COMMIT"]) {
    const owned = ownedConnection(step); let calls = 0;
    await assert.rejects(runTransaction(owned.client, async () => { calls++; return "acknowledged"; }, 20), /deadline/);
    assert.deepEqual(owned.releases, [true]); assert.equal(calls, step === "BEGIN" ? 0 : 1);
    assert.equal(owned.queries.filter(sql => sql === "COMMIT").length, step === "COMMIT" ? 1 : 0);
    owned.resume(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(owned.releases, [true]);
  }
  const healthy = ownedConnection(); assert.equal(await runTransaction(healthy.client, async () => "healthy", 1000), "healthy"); assert.deepEqual(healthy.releases, [false]);
});
test("checked-out transport errors between queries are contained and late work cannot use the destroyed connection", async () => {
  const owned = ownedConnection(); let continueWork, entered;
  const ready = new Promise(resolve => { entered = resolve; }), wait = new Promise(resolve => { continueWork = resolve; });
  const operation = runTransaction(owned.client, async client => { entered(); await wait; await client.query("LATE WRITE"); });
  await ready;
  const failure = Object.assign(Error("synthetic-private-error"), { code: "08P01" });
  assert.doesNotThrow(() => owned.client.emit("error", failure));
  await assert.rejects(operation, error => error === failure); assert.deepEqual(owned.releases, [true]);
  continueWork(); await new Promise(resolve => setTimeout(resolve, 0));
  assert(!owned.queries.includes("LATE WRITE")); assert(!owned.queries.includes("COMMIT")); assert.deepEqual(owned.releases, [true]);
});
test("business failure rolls back under the same ownership boundary and keeps the original error", async () => {
  const owned = ownedConnection(), failure = new ApplicationError("conflict", "Changed draft", 409);
  await assert.rejects(runTransaction(owned.client, async () => { throw failure; }, 1000), error => error === failure);
  assert.equal(owned.queries.at(-1), "ROLLBACK"); assert.deepEqual(owned.releases, [true]);
});
test("actual pg pool contains handshake-handoff and between-query FATAL packets and a fresh connection remains usable", async () => {
  const packet = (type, payload) => { const bytes = Buffer.from(payload), size = Buffer.alloc(4); size.writeInt32BE(bytes.length + 4); return Buffer.concat([Buffer.from(type), size, bytes]); };
  const auth = packet("R", Buffer.alloc(4)), ready = packet("Z", "I"), fatal = packet("E", "SFATAL\0C08P01\0Msynthetic-private-driver-marker\0\0");
  let connections = 0;
  const sockets = new Set(), server = createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket));
    const index = ++connections; let startup = true, pending = Buffer.alloc(0), begins = 0;
    socket.on("data", data => {
      pending = Buffer.concat([pending, data]);
      while (pending.length >= (startup ? 4 : 5)) {
        const length = pending.readInt32BE(startup ? 0 : 1), total = length + (startup ? 0 : 1);
        if (pending.length < total) return;
        const message = pending.subarray(0, total); pending = pending.subarray(total);
        if (startup) { startup = false; socket.write(Buffer.concat(index === 1 ? [auth, ready, fatal] : [auth, ready])); continue; }
        if (message[0] === 88) { socket.end(); continue; }
        if (message[0] !== 81) continue;
        const sql = message.subarray(5, -1).toString(); if (sql === "BEGIN") begins++;
        const response = [packet("C", sql.split(" ")[0] + "\0"), ready];
        if (index === 2 && begins === 2 && sql === "BEGIN") response.push(fatal);
        socket.write(Buffer.concat(response));
      }
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const before = { DATABASE_URL: process.env.DATABASE_URL, DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED };
  process.env.DATABASE_URL = `postgres://test:test@127.0.0.1:${server.address().port}/test`;
  delete process.env.DATABASE_URL_UNPOOLED;
  try {
    await assert.rejects(transaction(async () => "never"));
    assert.equal(await transaction(async () => "healthy"), "healthy");
    await assert.rejects(transaction(async () => "never"));
    assert.equal(await transaction(async () => "recovered"), "recovered");
    assert.equal(connections, 3, "Both failed clients were destroyed, while healthy idle reuse remained intact");
  } finally {
    await databasePool().end(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve));
    for (const [name, value] of Object.entries(before)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
test("diagnostics correlate generated requests and hashed commands without payloads, headers, errors or client identifiers", async () => {
  const records = [], old = console.info; console.info = value => records.push(JSON.parse(value));
  try {
    const secret = "postgres://password@private-host/db Cookie=private-cookie prompt=private-text";
    const runId = randomUUID();
    const response = await diagnostics.withRequestDiagnostics("agent.write", async () => {
      diagnostics.correlateCommand(secret); diagnostics.correlateRun(runId);
      diagnostics.diagnoseRun({ id: runId, request_id: secret }, "step_failed", "tool_denied");
      return responseError(new ApplicationError("session_changed", secret, 409));
    });
    assert.equal(response.status, 409);
    const operation = records.find(record => record.event === "http.operation"), error = records.find(record => record.event === "operation.error"), run = records.find(record => record.event === "agent.run");
    assert.equal(operation.requestId, response.headers.get("x-request-id")); assert.equal(error.requestId, operation.requestId); assert.equal(error.code, "session_changed"); assert.equal(operation.runId, runId); assert.equal(operation.commandKey, run.commandKey); assert.match(run.commandKey, /^[a-f0-9]{64}$/);
    assert(!JSON.stringify(records).includes(secret)); assert(!JSON.stringify(records).includes("private-host"));
  } finally { console.info = old; }
});
test("every failed verification stage prevents completion and release evidence", async () => {
  for (let failure = 0; failure < REQUIRED_CHECKS.length; failure++) {
    const seen = []; let completed = false;
    await assert.rejects(runVerificationStages(REQUIRED_CHECKS.map(id => ({ id })), async stage => { seen.push(stage.id); if (stage.id === REQUIRED_CHECKS[failure]) throw Error("intentional test failure"); }, () => { completed = true; }));
    assert.equal(completed, false); assert.equal(seen.length, failure + 1);
  }
});
test("release attestation requires every gate and matches exact source/lock/revision with fresh Node22 proof", () => {
  const expected = { revision: "a".repeat(40), treeSha: "b".repeat(40), lockSha256: "c".repeat(64), sourceSha256: "d".repeat(64) };
  const proof = { version: 1, ...expected, nodeVersion: "22.23.2", buildId: "actual-build", completedAt: new Date().toISOString(), verified: true, releasable: true, checks: [...REQUIRED_CHECKS] };
  assert.equal(validateVerification(proof, expected), proof);
  for (const patch of [{ checks: REQUIRED_CHECKS.slice(1) }, { verified: false }, { releasable: false }, { revision: "f".repeat(40) }, { nodeVersion: "22.99.0" }, { completedAt: "2020-01-01T00:00:00Z" }, { sourceSha256: null }]) assert.throws(() => validateVerification({ ...proof, ...patch }, expected));
});

test("Basic Auth compares Unicode credentials and fails closed on malformed, missing and different credentials", () => {
  const { authorized, authConfiguration } = modules.load("lib/server/http-auth");
  const expected = authConfiguration({ BASIC_AUTH_USER: "démo", BASIC_AUTH_PASSWORD: "päss:word" });
  const header = value => "Basic " + Buffer.from(value).toString("base64");
  assert.equal(authorized(header("démo:päss:word"), expected), true);
  for (const value of [undefined, "Bearer anything", "Basic !!!", header("démo"), header("demo:päss:word"), header("démo:wrong")]) assert.equal(authorized(value, expected), false);
});

test("snapshot retries only a known serialization rollback once and never retries transport, deadlock or command failures", async () => {
  const db = modules.load("lib/db"), { readAgentSnapshot } = modules.load("lib/server/snapshots"), original = db.transaction;
  const budgets = [], records = [], old = console.info; console.info = value => records.push(JSON.parse(value));
  try {
    let calls = 0;
    db.transaction = async (_work, budget) => { budgets.push(budget); if (++calls === 1) throw Object.assign(Error("private marker"), { code: "40001" }); return { conversations: [], runs: [] }; };
    assert.deepEqual(await readAgentSnapshot("private-token", "private-generation"), { conversations: [], runs: [] });
    assert.equal(calls, 2); assert(budgets[1] <= budgets[0] && budgets[0] <= 20000); assert.equal(records[0].event, "database.snapshot_retry");
    for (const code of ["40001", "40P01", "ECONNRESET", "session_changed"]) {
      calls = 0; const failure = Object.assign(Error("private marker"), { code });
      db.transaction = async () => { calls++; throw failure; };
      await assert.rejects(readAgentSnapshot("private-token", "private-generation"), error => error === failure);
      assert.equal(calls, code === "40001" ? 2 : 1);
    }
    assert(!JSON.stringify(records).includes("private"));
  } finally { db.transaction = original; console.info = old; }
});

test("failure diagnostics expose only fixed categories, never raw SQLSTATE, driver details or arbitrary properties", () => {
  const records = [], old = console.info; console.info = value => records.push(JSON.parse(value));
  try {
    for (const code of ["40001", "40P01", "55P03", "57014", "28P01", "53300", "ECONNRESET", "private-code"]) diagnostics.diagnoseError(Object.assign(Error("private-password"), { code, detail: "private-query" }));
    assert.deepEqual(records.map(record => record.category), ["database_serialization", "database_deadlock", "database_lock_unavailable", "database_query_cancelled", "database_authentication", "database_capacity", "database_transport", undefined]);
    assert(!JSON.stringify(records).includes("private"));
  } finally { console.info = old; }
});
