import pg from "pg";
import { writeSync } from "node:fs";
import configuration from "../src/lib/server/database-target.js";
import { readMigrations, runMigrations } from "./migrations.mjs";
import { parseRetentionArgs, pruneExpiredNamespaces } from "./expired-namespace-retention.mjs";

const help = `Delete saved demo namespaces only after every session has been expired for 30 days.
Usage: npm run db:prune-expired -- [--dry-run | --apply --expect-target TARGET] [--limit 1..100] [--namespace UUID | --after CURSOR]

Dry-run is the default. --apply explicitly commits eligible deletions and requires
the exact targetKey printed by a dry run as --expect-target.
Run this operator command daily after reviewing its dry-run report. This repository
does not schedule hosted deletion; retention remains inactive there until an
operator configures a protected daily invocation and verifies its dry run.
If hasMore is true, repeat with the report's nextCursor as --after until complete.`;

let client;
let connectionFailed = false;
let failureStage = "options";
try {
  const options = parseRetentionArgs(process.argv.slice(2));
  if (options.help) console.log(help);
  else {
    failureStage = "database_target";
    const connectionString = configuration.databaseConfiguration(process.env, true).directUrl;
    const target = configuration.databaseTarget(connectionString);
    const targetIdentity = { host: target.host, port: target.port, database: target.database };
    const targetKey = `${target.host}:${target.port}/${encodeURIComponent(target.database)}`;
    failureStage = "target_confirmation";
    if (options.apply && options.expectedTarget !== targetKey) throw new Error("Target confirmation mismatch");
    failureStage = "schema_status";
    const migrations = await readMigrations();
    client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 35000 });
    client.on("error", () => { connectionFailed = true; });
    failureStage = "connection";
    await client.connect();
    failureStage = "schema_status";
    await runMigrations(client, migrations, "status");
    failureStage = "retention_unconfirmed";
    const report = await pruneExpiredNamespaces(client, options, entry => {
      writeSync(1, `${JSON.stringify({ ...entry, target: targetIdentity, targetKey })}\n`);
    });
    if (connectionFailed) throw new Error("Database connection failed");
    writeSync(1, `${JSON.stringify({ ...report, target: targetIdentity, targetKey })}\n`);
  }
} catch {
  console.error(JSON.stringify({ event: "demo.retention", outcome: "unconfirmed", reason: failureStage,
    message: failureStage === "retention_unconfirmed" ? "Verify database state before retrying an uncertain apply." : "Resolve the reported stage before retrying." }));
  process.exitCode = 1;
} finally {
  await client?.end();
}
