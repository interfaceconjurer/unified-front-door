import "server-only";
import type { PoolClient } from "pg";
import type { RunError, StepOutcome } from "../agent/contracts";
import { transaction } from "../db";
import type { RunLease } from "./agent-worker";
import { beginModelAttempt, modelBusyError, modelLimitError, modelUnknownError } from "./model-attempts";
import { completeModel, modelSettings, ModelProviderError, type ModelSettings } from "./model-provider";
import { diagnoseRun } from "./diagnostics";

export const MODEL_LEASE_MS = 30000;
export const MODEL_HEARTBEAT_MS = 5000;
export const MODEL_PROGRESS_MS = 500;
export type ModelRuntime = { settings?: () => ModelSettings | null; complete?: typeof completeModel; budgetScope?: string };
type Boundary = {
  valid(client: PoolClient, lease: RunLease): Promise<unknown>;
  publish(client: PoolClient, lease: RunLease, outcome: StepOutcome): Promise<boolean>;
  progress(client: PoolClient, lease: RunLease, text: string): Promise<boolean>;
};
const unconfigured: RunError = { code: "unconfigured", message: "The model provider is unavailable or disabled. This attempt was not sent.", retryable: true, effects: "none" };
const safeFailure = (error: unknown): RunError => {
  if (!(error instanceof ModelProviderError) || error.code === "aborted" || error.code === "provider_failed") return modelUnknownError;
  const code: RunError["code"] = error.code === "unconfigured" ? "unconfigured"
    : error.code === "refused" ? "model_refused" : error.code === "incomplete" ? "model_incomplete"
    : error.code === "rate_limited" ? "model_rate_limited" : error.code === "timeout" ? "model_timeout" : "model_failed";
  return { code, message: error.message, retryable: true, effects: "none", ...(error.dispatched ? { providerCost: "unknown" } : {}) };
};

/** One durable paid attempt; never replay a transport call after uncertainty.
 * Boundary callbacks preserve the existing session/workspace/run lock order. */
export async function executeModelRun(lease: RunLease, boundary: Boundary, signal?: AbortSignal, runtime: ModelRuntime = {}): Promise<void> {
  const execution = lease.run.execution;
  if (execution.kind !== "model") throw new Error("Expected a model execution snapshot");
  const settings = runtime.settings ?? modelSettings;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  let heartbeat: ReturnType<typeof setTimeout> | undefined, renewal: Promise<void> | undefined, stopped = false;
  let progressTimer: ReturnType<typeof setTimeout> | undefined, progressWrite: Promise<void> | undefined;
  let latestText = "", publishedText = "";
  let dispatched = false, timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; abort(); }, execution.settings.policy.timeoutMs);
  const interruption = () => timedOut ? safeFailure(new ModelProviderError("timeout", dispatched)) : modelUnknownError;
  const fail = async (error: RunError, finalText?: string) => transaction(async client => {
    if (!await boundary.valid(client, lease)) return;
    // The provider can stop between periodic writes. Commit its final validated
    // text with the failure, so a rejected terminal event cannot clip that tail.
    // Interrupted or uncertain writes do not start another progress publication.
    if (!controller.signal.aborted && finalText && finalText !== publishedText
      && !await boundary.progress(client, lease, finalText)) return;
    await client.query("UPDATE model_attempts SET status=$2,error_code=$3,updated_at=clock_timestamp() WHERE run_id=$1 AND status='intent'", [lease.run.id, error.providerCost === "unknown" ? "unknown" : "failed", error.code]);
    if (!await boundary.publish(client, lease, { kind: "failed", error })) throw new Error("The lease changed before model failure could be published");
  });
  // Publish the first actual text immediately, then coalesce provider deltas.
  // At most one write is in flight and at most one begins per 500ms. Model
  // progress retains the existing lease; it never becomes a reclaimable step.
  const publishProgress = () => {
    if (stopped || controller.signal.aborted || progressWrite || progressTimer || latestText === publishedText) return;
    const text = latestText;
    progressTimer = setTimeout(() => { progressTimer = undefined; publishProgress(); }, MODEL_PROGRESS_MS);
    progressWrite = transaction(client => boundary.progress(client, lease, text))
      .then(accepted => { if (accepted) publishedText = text; else abort(); })
      .catch(() => { abort(); })
      .finally(() => { progressWrite = undefined; publishProgress(); });
  };
  const onText = (text: string) => {
    if (stopped || controller.signal.aborted) return;
    latestText = text; publishProgress();
  };
  const schedule = () => { if (!stopped) heartbeat = setTimeout(() => {
    renewal = (async () => {
      try {
        if (!settings()) { abort(); return; }
        const renewed = await transaction(async client => {
          if (!await boundary.valid(client, lease)) return false;
          await client.query("UPDATE agent_runs SET lease_until=clock_timestamp()+($2*interval '1 millisecond') WHERE id=$1", [lease.run.id, MODEL_LEASE_MS]);
          return true;
        });
        if (!renewed) abort();
      } catch { abort(); }
      if (!controller.signal.aborted) schedule();
    })();
  }, MODEL_HEARTBEAT_MS); };
  try {
    let current: ModelSettings | null;
    try { current = settings(); } catch { current = null; }
    if (!current) { await fail(unconfigured); return; }
    if (controller.signal.aborted) return;
    // An uncertain commit rejects this await. No network dispatch occurs, and
    // a subsequent reclaim sees the intent and requires an explicit new run.
    const begun = await transaction(async client => {
      if (!await boundary.valid(client, lease)) return "stale";
      const result = await beginModelAttempt(client, lease.run, execution, current!, runtime.budgetScope);
      if (result === "limit") await boundary.publish(client, lease, { kind: "failed", error: modelLimitError });
      if (result === "busy") await boundary.publish(client, lease, { kind: "failed", error: modelBusyError });
      return result;
    });
    if (begun !== "started") { if (begun === "existing") await fail(modelUnknownError); return; }
    if (controller.signal.aborted) { await fail(interruption()); return; }
    schedule();
    const interrupted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new ModelProviderError("aborted", dispatched)), { once: true }));
    dispatched = true;
    const result = await Promise.race([(runtime.complete ?? completeModel)(execution.prompt, execution.settings.policy, controller.signal, { onText }), interrupted]);
    stopped = true; clearTimeout(heartbeat); clearTimeout(progressTimer); await renewal; await progressWrite;
    if (controller.signal.aborted) { await fail(interruption()); return; }
    await transaction(async client => {
      if (!await boundary.valid(client, lease)) return;
      if (!await boundary.publish(client, lease, { kind: "complete", text: result.text })) return;
      await client.query(`UPDATE model_attempts SET status='succeeded',message_id=$2,request_id=$3,input_tokens=$4,output_tokens=$5,updated_at=clock_timestamp()
        WHERE run_id=$1 AND status='intent'`, [lease.run.id, result.messageId, result.requestId ?? null, result.usage.inputTokens, result.usage.outputTokens]);
      // A validated response establishes that this local dispatch has ended.
      await client.query("DELETE FROM model_dispatch_slots WHERE scope=$1 AND run_id=$2", [runtime.budgetScope ?? "application", lease.run.id]);
    });
  } catch (error) {
    stopped = true; const finalText = latestText; clearTimeout(progressTimer); await progressWrite;
    const detail = timedOut ? safeFailure(new ModelProviderError("timeout", dispatched)) : dispatched ? safeFailure(error) : modelUnknownError;
    diagnoseRun(lease.run, "step_failed", detail.code);
    // If publication cannot commit, durable intent remains for safe reclaim.
    await fail(detail, dispatched && !controller.signal.aborted ? finalText : undefined);
  } finally {
    stopped = true; clearTimeout(heartbeat); clearTimeout(progressTimer); clearTimeout(deadline); abort();
    signal?.removeEventListener("abort", abort); await renewal; await progressWrite;
    diagnoseRun(lease.run, "step_finished");
  }
}
