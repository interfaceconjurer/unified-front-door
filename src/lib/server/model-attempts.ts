import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { RunError } from "../agent/contracts";
import type { RunRow } from "./agent-runs";
import type { ModelExecution } from "./model-context";
import { serializeModelRequest, type ModelSettings } from "./model-provider";

export const modelUnknownError: RunError = { code: "model_outcome_unknown", message: "The model request may have been charged, but its reply could not be confirmed. Retrying starts a new paid attempt.", retryable: true, effects: "none", providerCost: "unknown" };
export const modelLimitError: RunError = { code: "model_limit", message: "The model's daily request allowance is exhausted. Try a new attempt after the UTC day changes.", retryable: true, effects: "none" };
export const modelBusyError: RunError = { code: "model_busy", message: "Both model request slots are reserved. Wait a minute before retrying. This attempt was not sent.", retryable: true, effects: "none" };
export const MODEL_CONCURRENT_CALLS = 2;

/** Global first, namespace second: one lock order across every worker. A cap can
 * only decrease within a UTC day. No refund for uncertain/cancelled dispatches.
 * Scope/day overrides are trusted test seams, never environment or HTTP input. */
export async function reserveModelCalls(client: PoolClient, namespaceId: string, settings: ModelSettings,
  scope = "application", testDay?: string, runId?: string): Promise<string | null | "busy"> {
  if (scope !== "application" && !/^test:[a-f0-9-]{36}$/.test(scope)) throw new Error("Invalid internal budget scope");
  if (testDay !== undefined && (!scope.startsWith("test:") || !/^\d{4}-\d{2}-\d{2}$/.test(testDay))) throw new Error("Invalid internal budget day");
  // Stable across UTC midnight: per-day row locks alone permit two days to
  // reserve overlapping dispatch slots concurrently.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`model-dispatch:${scope}`]);
  const day = testDay ?? (await client.query("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date::text AS day")).rows[0].day;
  const limits = [[scope, settings.globalDailyCalls], [`${scope}:namespace:${namespaceId}`, settings.namespaceDailyCalls]] as const;
  const rows: { scope: string; reserved: number; call_limit: number }[] = [];
  for (const [key, limit] of limits) {
    await client.query("INSERT INTO model_call_budgets(scope,day,call_limit) VALUES($1,$2,$3) ON CONFLICT(scope,day) DO UPDATE SET call_limit=LEAST(model_call_budgets.call_limit,EXCLUDED.call_limit)", [key, day, limit]);
    rows.push((await client.query("SELECT scope,reserved,call_limit FROM model_call_budgets WHERE scope=$1 AND day=$2 FOR UPDATE", [key, day])).rows[0]);
  }
  if (rows.some(row => row.reserved >= row.call_limit)) return null;
  if (runId) {
    await client.query("DELETE FROM model_dispatch_slots WHERE scope=$1 AND expires_at<=clock_timestamp()", [scope]);
    const count = (await client.query("SELECT count(*)::int AS count FROM model_dispatch_slots WHERE scope=$1", [scope])).rows[0].count;
    if (count >= MODEL_CONCURRENT_CALLS) return "busy";
    await client.query("INSERT INTO model_dispatch_slots(scope,run_id,expires_at) VALUES($1,$2,clock_timestamp()+($3*interval '1 millisecond'))", [scope, runId, settings.policy.timeoutMs]);
  }
  for (const row of rows) await client.query("UPDATE model_call_budgets SET reserved=reserved+1 WHERE scope=$1 AND day=$2", [row.scope, day]);
  return day;
}

/** Call only while the current run is fenced and locked. The enclosing commit
 * must return successfully BEFORE the caller makes any network request. */
export async function beginModelAttempt(client: PoolClient, run: RunRow, execution: ModelExecution, current: ModelSettings, scope?: string): Promise<"started" | "existing" | "limit" | "busy"> {
  if ((await client.query("SELECT run_id FROM model_attempts WHERE run_id=$1", [run.id])).rowCount) return "existing";
  const body = serializeModelRequest(execution.prompt, execution.settings.policy);
  const settings = { ...execution.settings, globalDailyCalls: Math.min(execution.settings.globalDailyCalls, current.globalDailyCalls), namespaceDailyCalls: Math.min(execution.settings.namespaceDailyCalls, current.namespaceDailyCalls) };
  const day = await reserveModelCalls(client, run.namespace_id, settings, scope, undefined, run.id);
  if (!day) return "limit";
  if (day === "busy") return "busy";
  await client.query(`INSERT INTO model_attempts(namespace_id,profile_id,run_id,budget_scope,budget_day,status,request_sha256,request_bytes,provider,model,prompt_version)
    VALUES($1,$2,$3,$4,$5,'intent',$6,$7,$8,$9,$10)`, [run.namespace_id, run.profile_id, run.id, scope ?? "application", day,
    createHash("sha256").update(body).digest("hex"), Buffer.byteLength(body), execution.settings.policy.provider, execution.settings.policy.model, execution.settings.policy.promptVersion]);
  return "started";
}
export async function abandonModelAttempt(client: PoolClient, runId: string): Promise<boolean> {
  return (await client.query("UPDATE model_attempts SET status='unknown',error_code='model_outcome_unknown',updated_at=clock_timestamp() WHERE run_id=$1 AND status='intent'", [runId])).rowCount === 1;
}
