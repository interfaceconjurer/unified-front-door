import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations, readMigrations } from "./migrations.mjs";
const migrations = [{ name: "001_first.sql", checksum: "one", sql: "CREATE TABLE first(id integer)" }, { name: "002_second.sql", checksum: "two", sql: "ALTER TABLE first ADD COLUMN name text" }];
function database(rows = [], failOn = null) {
  const queries = [];
  return { queries, query: async (sql, values) => { queries.push({ sql, values }); if (sql === failOn) throw Error("Injected database failure"); return { rows: sql.includes("SELECT name,checksum") ? rows : [] }; } };
}
test("migration uses serialized bounded transaction and records each successful change before committing", async () => {
  const db = database(); assert.equal(await runMigrations(db, migrations, "migrate"), 2);
  const queries = db.queries.map(value => value.sql);
  assert.equal(queries[0], "BEGIN"); assert.equal(queries.at(-1), "COMMIT");
  assert.equal(queries[1], "SET LOCAL search_path=public");
  assert(queries.indexOf("SET LOCAL lock_timeout='5s'") < queries.indexOf("SELECT pg_advisory_xact_lock(792631904)"));
  assert(queries.indexOf("SELECT pg_advisory_xact_lock(792631904)") < queries.indexOf(migrations[0].sql));
  assert.deepEqual(db.queries.filter(query => query.sql.startsWith("INSERT INTO schema_migrations")).map(query => query.values), [["001_first.sql", "one"], ["002_second.sql", "two"]]);
});
test("migration failure rolls back prior DDL/receipts without commit; retry skips only acknowledged history", async () => {
  const failed = database([], migrations[1].sql);
  await assert.rejects(runMigrations(failed, migrations, "migrate"), /Injected/);
  assert.equal(failed.queries.at(-1).sql, "ROLLBACK"); assert(!failed.queries.some(query => query.sql === "COMMIT"));
  const retried = database([migrations[0]]); await runMigrations(retried, migrations, "migrate");
  assert(!retried.queries.some(query => query.sql === migrations[0].sql)); assert(retried.queries.some(query => query.sql === migrations[1].sql));
});
test("changed/unknown/out-of-order history refuses application DDL; status is read-only and rejects pending migrations", async () => {
  for (const rows of [[{ ...migrations[0], checksum: "tampered" }], [migrations[1]], [...migrations, { name: "999_future.sql", checksum: "future" }]]) {
    const db = database(rows); await assert.rejects(runMigrations(db, migrations, "migrate"), /history mismatch/);
    assert(!db.queries.some(query => migrations.some(migration => query.sql === migration.sql))); assert.equal(db.queries.at(-1).sql, "ROLLBACK");
  }
  const pending = database([migrations[0]]); await assert.rejects(runMigrations(pending, migrations, "status"), /Pending/);
  assert.equal(pending.queries[0].sql, "BEGIN READ ONLY"); assert(!pending.queries.some(query => /^(CREATE|INSERT|ALTER)/.test(query.sql)));
  const current = database(migrations); await runMigrations(current, migrations, "status"); assert.equal(current.queries.at(-1).sql, "COMMIT");
});
test("uncertain commit is failure until subsequent read-only status confirms immutable history", async () => {
  const uncertain = database([], "COMMIT"); await assert.rejects(runMigrations(uncertain, migrations, "migrate"), /Injected/);
  assert.equal(uncertain.queries.at(-1).sql, "ROLLBACK");
  const status = database(migrations); assert.equal(await runMigrations(status, migrations, "status"), 2);
  const files = await readMigrations(); assert.equal(files.length, 7); assert(files.every(file => /^[a-f0-9]{64}$/.test(file.checksum)));
});
