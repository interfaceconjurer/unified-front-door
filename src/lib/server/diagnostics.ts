import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { ApplicationError } from "../application/contracts";

type Operation = "session.read" | "session.write" | "application.read" | "application.write" | "application.import-source" | "agent.read" | "agent.write" | "readiness";
type RequestContext = { requestId: string; commandKey?: string; runId?: string };
const context = new AsyncLocalStorage<RequestContext>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const errorCodes = new Set(["invalid", "unauthorized", "conflict", "unavailable", "not_found", "session_changed", "adapter_failed", "recovery_exhausted", "reconciliation_required", "tool_denied", "unconfigured", "model_outcome_unknown", "model_limit", "model_busy", "model_failed", "model_refused", "model_incomplete", "model_rate_limited", "model_timeout"]);
function code(error: unknown): string { return error instanceof ApplicationError && errorCodes.has(error.code) ? error.code : "unavailable"; }
function failureCategory(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  switch (error.code) {
    case "40001": return "database_serialization";
    case "40P01": return "database_deadlock";
    case "55P03": return "database_lock_unavailable";
    case "57014": return "database_query_cancelled";
    case "28P01": return "database_authentication";
    case "53300": return "database_capacity";
    case "08000": case "08003": case "08006": case "08P01": case "57P01": case "ECONNRESET": case "ECONNREFUSED": case "ETIMEDOUT": return "database_transport";
    default: return undefined;
  }
}
function emit(record: Record<string, string | number | boolean | undefined>): void { console.info(JSON.stringify({ at: new Date().toISOString(), ...record })); }

export function correlateCommand(value: unknown): void {
  const current = context.getStore();
  if (current && typeof value === "string") current.commandKey = createHash("sha256").update(value).digest("hex");
}
export function correlateRun(value: unknown): void {
  const current = context.getStore();
  if (current && typeof value === "string" && uuid.test(value)) current.runId = value;
}
export async function withRequestDiagnostics(operation: Operation, work: () => Promise<Response>): Promise<Response> {
  const current: RequestContext = { requestId: randomUUID() }, started = performance.now();
  return context.run(current, async () => {
    let status = 503;
    try {
      const response = await work(); status = response.status;
      response.headers.set("X-Request-ID", current.requestId);
      return response;
    } finally { emit({ event: "http.operation", operation, ...current, status, durationMs: Math.round(performance.now() - started) }); }
  });
}
export function diagnoseError(error: unknown): void {
  emit({ event: "operation.error", requestId: context.getStore()?.requestId, code: code(error), category: failureCategory(error) });
}
export function diagnoseSnapshotRetry(): void { emit({ event: "database.snapshot_retry", requestId: context.getStore()?.requestId, category: "database_serialization", attempt: 1 }); }
export function diagnoseRun(run: { id: string; request_id: string }, event: "claimed" | "step_finished" | "step_failed", errorCode?: string): void {
  emit({ event: "agent.run", runId: uuid.test(run.id) ? run.id : undefined, commandKey: createHash("sha256").update(run.request_id).digest("hex"), outcome: event, code: errorCode && errorCodes.has(errorCode) ? errorCode : undefined });
}
export function diagnoseWorker(event: "started" | "stopped" | "unavailable"): void { emit({ event: "worker.lifecycle", outcome: event }); }
export function diagnoseWorkerWake(outcome: "available" | "unavailable"): void { emit({ event: "worker.wake", outcome }); }
