import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export async function readMigrations(directory = new URL("../db/migrations/", import.meta.url)) {
  const migrations = await Promise.all((await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort().map(async name => {
    const sql = await readFile(new URL(name, directory), "utf8");
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
  if (!migrations.length) throw new Error("Empty migration manifest");
  return migrations;
}
export async function runMigrations(client, migrations, action) {
  if (!["migrate", "status"].includes(action) || !migrations.length) throw new Error("Invalid migration request");
  try {
    await client.query(action === "status" ? "BEGIN READ ONLY" : "BEGIN");
    await client.query("SET LOCAL search_path=public");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    if (action === "migrate") {
      await client.query("SELECT pg_advisory_xact_lock(792631904)");
      await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    }
    const previous = (await client.query("SELECT name,checksum FROM schema_migrations ORDER BY name")).rows;
    if (previous.some((row, index) => row.name !== migrations[index]?.name || row.checksum !== migrations[index]?.checksum)) throw new Error("Migration history mismatch");
    if (action === "status" && previous.length !== migrations.length) throw new Error("Pending migrations");
    for (const migration of migrations.slice(previous.length)) {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)", [migration.name, migration.checksum]);
    }
    await client.query("COMMIT");
    return migrations.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
