import pg from "pg";
import configuration from "../src/lib/server/database-target.js";
import { readMigrations, runMigrations } from "./migrations.mjs";
const action = process.argv[2];
let client;
let connectionFailed = false;
// Socket blackholes can outlive PostgreSQL timeouts, including during COMMIT.
const deadline = setTimeout(() => {
  console.error("Database command timed out. Its outcome is uncertain; verify status before retrying.");
  process.exit(1);
}, action === "status" ? 20000 : 120000);
try {
  if (!["migrate", "status"].includes(action)) throw new Error("Invalid database action");
  const connectionString = configuration.databaseConfiguration(process.env, true).directUrl;
  const migrations = await readMigrations();
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 35000 });
  // A connected client can fail between queries; pg emits an error event even
  // when no query promise is waiting to reject. Never let it become uncaught.
  client.on("error", () => { connectionFailed = true; });
  await client.connect();
  await runMigrations(client, migrations, action);
  if (connectionFailed) throw new Error("Database connection failed");
  console.log(JSON.stringify({ event: "database.schema", outcome: "current", migrations: migrations.length }));
} catch {
  console.error("Database command was not confirmed. Verify direct connection configuration and immutable migration history; rerun status before retrying an uncertain outcome.");
  process.exitCode = 1;
} finally { await client?.end(); clearTimeout(deadline); }
