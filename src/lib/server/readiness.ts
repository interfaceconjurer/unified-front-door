import "server-only";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { databasePool, withOwnedDatabaseClient, type OwnedDatabaseClient } from "../db";
import { validateRuntimeConfiguration } from "./configuration";

export type MigrationRecord = { name: string; checksum: string };
export async function migrationManifest(directory = join(process.cwd(), "db/migrations")): Promise<MigrationRecord[]> {
  const names = (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error("Migration manifest is empty");
  return Promise.all(names.map(async name => ({ name, checksum: createHash("sha256").update(await readFile(join(directory, name))).digest("hex") })));
}

// Projection probes detect missing tables and required columns without reading demo data.
const projections = [
  "SELECT id,created_at FROM demo_namespaces LIMIT 0",
  "SELECT id,namespace_id,token_hash,profile_id,generation,expires_at,revoked FROM demo_sessions LIMIT 0",
  "SELECT namespace_id,profile_id,assessment_revision,assessment_cursor,epoch FROM workspaces LIMIT 0",
  "SELECT namespace_id,profile_id,id,record FROM assessment_runs LIMIT 0",
  "SELECT namespace_id,profile_id,run_id,id,record FROM assessment_findings LIMIT 0",
  "SELECT namespace_id,profile_id,id,run_id,revision,record FROM project_drafts LIMIT 0",
  "SELECT namespace_id,profile_id,id,run_id,source_draft_id,create_command_id,revision,record FROM improvement_projects LIMIT 0",
  "SELECT namespace_id,profile_id,project_id,id,run_id,finding_id,status,record FROM project_work_items LIMIT 0",
  "SELECT namespace_id,profile_id,id,surface_id,canvas,target,fields,revision,provenance FROM canvas_drafts LIMIT 0",
  "SELECT namespace_id,profile_id,generation,command_id,payload_hash,result,created_at FROM command_receipts LIMIT 0",
  "SELECT namespace_id,profile_id,source_hash,summary,imported_at FROM import_receipts LIMIT 0",
  "SELECT namespace_id,profile_id,source_hash,source,recovery FROM legacy_import_sources LIMIT 0",
  "SELECT session_id,command_id,payload_hash,result FROM session_receipts LIMIT 0",
  "SELECT namespace_id,profile_id,epoch,id,thread_key,revision,conversation FROM agent_conversations LIMIT 0",
  "SELECT namespace_id,profile_id,epoch,id,session_id,generation,request_id,turn_id,conversation_id,retry_of,kind,status,input,execution,assessment_run_id,checkpoint,result,error,sequence,fence,recoveries,ready_at,lease_until,effect_id,effect_tool,effect_input,effect_state,created_at,updated_at FROM agent_runs LIMIT 0",
  "SELECT namespace_id,profile_id,run_id,sequence,event FROM agent_events LIMIT 0",
  "SELECT namespace_id,profile_id,generation,request_id,payload_hash,result FROM agent_receipts LIMIT 0",
  "SELECT scope,day,reserved,call_limit FROM model_call_budgets LIMIT 0",
  "SELECT scope,run_id,expires_at FROM model_dispatch_slots LIMIT 0",
  "SELECT namespace_id,profile_id,run_id,budget_scope,budget_day,status,request_sha256,request_bytes,provider,model,prompt_version,message_id,request_id,input_tokens,output_tokens,error_code,created_at,updated_at FROM model_attempts LIMIT 0",
];

export async function checkDatabaseSchema(client: Pick<PoolClient, "query">, expected: MigrationRecord[]): Promise<void> {
  await client.query("SET TRANSACTION READ ONLY");
  const actual = (await client.query("SELECT name,checksum FROM schema_migrations ORDER BY name")).rows as MigrationRecord[];
  if (actual.length !== expected.length || actual.some((row, index) => row.name !== expected[index]?.name || row.checksum !== expected[index]?.checksum)) throw new Error("Database schema version is unavailable");
  for (const projection of projections) await client.query(projection);
}

export async function assertReadiness(): Promise<void> {
  validateRuntimeConfiguration();
  const manifest = await migrationManifest();
  await probeDatabaseSchema(await databasePool().connect(), manifest);
}

/** Readiness owns its connection so timeout destroys it rather than poisoning
 * the application's pool with a query that never receives a network response. */
export async function probeDatabaseSchema(client: OwnedDatabaseClient, manifest: MigrationRecord[], timeoutMs = 10000): Promise<void> {
  await withOwnedDatabaseClient(client, async () => {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL search_path=public");
    await client.query("SET LOCAL statement_timeout='5s'");
    await checkDatabaseSchema(client, manifest);
    await client.query("COMMIT");
  }, timeoutMs);
}
