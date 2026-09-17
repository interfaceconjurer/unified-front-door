import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { diagnoseRun } from "./diagnostics";
import { transaction } from "../db";
import { activeRun, type RunError, type AgentAdapter, type StepOutcome, AGENT_LIMITS } from "../agent/contracts";
import { demoAdapter } from "../agent/demo";
import { parseFinding } from "../assessment/codec";
import { ASSESSMENT_STEPS } from "../onboarding/assessment";
import { assessmentBriefing } from "../chat/today-snapshot";
import type { Conversation } from "../chat/conversation";
import { readWorkspace, writeAssessment } from "./repository";
import { assertAssessmentLimits, assertBytes } from "./quota";
import { appendRunEvent, cancelAgentRun, lockAgentWorkspace, updateRunMessage, type RunRow } from "./agent-runs";
import { authorizedTool, demoTools, ToolError, type ToolAuthority, type ToolRegistry } from "./agent-tools";
import { executeModelRun, MODEL_LEASE_MS, type ModelRuntime } from "./model-worker";
import { abandonModelAttempt, modelUnknownError } from "./model-attempts";
import { requireSession, type OwnedSession } from "./session";

export const LEASE_MS = 10000;
export const MAX_RECOVERIES = 3;
export type RunLease = { run: RunRow; fence: number };
const recoveryError: RunError = { code: "recovery_exhausted", message: "This attempt stopped after repeated worker interruptions. You can retry it.", retryable: true, effects: "none" };
const uncertainError: RunError = { code: "reconciliation_required", message: "The tool outcome is uncertain. This attempt needs reconciliation before it can continue.", retryable: false, effects: "unknown" };
const failedError: RunError = { code: "adapter_failed", message: "This attempt could not finish. You can retry it.", retryable: true, effects: "none" };
function authority(run: RunRow): ToolAuthority { return { namespaceId: run.namespace_id, profileId: run.profile_id, epoch: run.epoch, context: run.input.context }; }

/** Total order: session -> workspace -> conversation -> run. All are re-read. */
async function lockOwnedRun(client: PoolClient, candidate: RunRow): Promise<{ run: RunRow; session: OwnedSession; authorized: boolean } | null> {
  const s = (await client.query("SELECT *,expires_at>clock_timestamp() AS alive FROM demo_sessions WHERE id=$1 FOR SHARE", [candidate.session_id])).rows[0];
  if (!s) return null;
  const w = (await client.query("SELECT epoch FROM workspaces WHERE namespace_id=$1 AND profile_id=$2 FOR UPDATE", [candidate.namespace_id, candidate.profile_id])).rows[0];
  if (!w || w.epoch !== candidate.epoch) return null;
  if (candidate.conversation_id) await client.query("SELECT id FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [candidate.namespace_id, candidate.profile_id, candidate.conversation_id]);
  else await client.query("SELECT id FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id FOR UPDATE", [candidate.namespace_id, candidate.profile_id]);
  const run = (await client.query("SELECT * FROM agent_runs WHERE id=$1 FOR UPDATE SKIP LOCKED", [candidate.id])).rows[0] as RunRow | undefined;
  if (!run || run.epoch !== candidate.epoch || run.session_id !== candidate.session_id || run.generation !== candidate.generation) return null;
  const alive = (await client.query("SELECT expires_at>clock_timestamp() AS alive FROM demo_sessions WHERE id=$1", [s.id])).rows[0].alive;
  const authorized = s.namespace_id === run.namespace_id && s.profile_id === run.profile_id && s.generation === run.generation && !s.revoked && alive;
  return { run, authorized, session: { id: s.id, namespaceId: run.namespace_id, profileId: run.profile_id as OwnedSession["profileId"], generation: run.generation, workspaceEpoch: run.epoch, expiresAt: s.expires_at.toISOString() } };
}
async function markFailed(client: PoolClient, run: RunRow, error: RunError) {
  if (run.effect_state === "unknown") error = uncertainError;
  await client.query("UPDATE agent_runs SET status='failed',error=$2,fence=fence+1,lease_until=NULL WHERE id=$1", [run.id, error]);
  await appendRunEvent(client, run, "failed", { error });
  if (run.kind === "assessment") await client.query("UPDATE workspaces SET assessment_cursor=jsonb_set(assessment_cursor,'{status}','\"paused\"') WHERE namespace_id=$1 AND profile_id=$2 AND assessment_cursor->>'currentRunId'=$3", [run.namespace_id, run.profile_id, run.input.kind === "assessment" ? run.input.assessmentRunId : ""]);
}
/** runId only narrows candidates for isolated tests; every production guard remains. */
export async function claimRun(client: PoolClient, runId?: string): Promise<RunLease | null> {
  const candidate = (await client.query(`SELECT * FROM agent_runs WHERE status IN ('pending','running','streaming') AND ready_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ${runId ? "AND id::text=$1" : ""} ORDER BY ready_at,created_at LIMIT 1`, runId ? [runId] : [])).rows[0] as RunRow | undefined;
  if (!candidate) return null;
  const owned = await lockOwnedRun(client, candidate); if (!owned) return null;
  const { run } = owned;
  if (!activeRun(run.status)) return null;
  if (!owned.authorized) { await cancelAgentRun(client, run, "The submitting demo session is no longer active."); return null; }
  const timing = (await client.query("SELECT ready_at<=clock_timestamp() AS ready,lease_until IS NULL OR lease_until<=clock_timestamp() AS available FROM agent_runs WHERE id=$1", [run.id])).rows[0];
  if (!timing.ready || !timing.available) return null;
  if (run.execution.kind === "model" && (await client.query("SELECT run_id FROM model_attempts WHERE run_id=$1", [run.id])).rowCount) { await abandonModelAttempt(client, run.id); await markFailed(client, run, modelUnknownError); return null; }
  if (run.effect_state === "unknown") { await markFailed(client, run, uncertainError); return null; }
  if (run.lease_until && run.recoveries >= MAX_RECOVERIES) { await markFailed(client, run, recoveryError); return null; }
  const claimed = (await client.query("UPDATE agent_runs SET fence=fence+1,recoveries=recoveries+CASE WHEN lease_until IS NULL THEN 0 ELSE 1 END,lease_until=clock_timestamp()+($2*interval '1 millisecond'),status=CASE WHEN status='pending' THEN 'running' ELSE status END WHERE id=$1 RETURNING *", [run.id, run.execution.kind === "model" ? MODEL_LEASE_MS : LEASE_MS])).rows[0] as RunRow;
  if (run.status === "pending") await appendRunEvent(client, claimed, "running");
  return { run: claimed, fence: claimed.fence };
}
async function validLease(client: PoolClient, lease: RunLease) {
  const owned = await lockOwnedRun(client, lease.run);
  if (!owned || !owned.authorized || owned.run.fence !== lease.fence || !activeRun(owned.run.status)) return null;
  // Check the actual wall clock after all potentially delayed lock acquisition.
  const valid = (await client.query("SELECT r.lease_until>clock_timestamp() AND s.expires_at>clock_timestamp() AS valid FROM agent_runs r JOIN demo_sessions s ON s.id=r.session_id WHERE r.id=$1", [owned.run.id])).rows[0]?.valid;
  return valid ? owned : null;
}
async function refreshLiveBriefings(client: PoolClient, session: OwnedSession) {
  const workspace = await readWorkspace(client, session), briefing = assessmentBriefing(workspace.assessment);
  const rows = (await client.query("SELECT id,conversation FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id FOR UPDATE", [session.namespaceId, session.profileId])).rows;
  for (const row of rows) {
    const conversation = row.conversation as Conversation, last = conversation.messages.at(-1);
    if (last?.role !== "today") continue;
    const next = { ...conversation, messages: [...conversation.messages.slice(0, -1), { ...last, snapshot: { ...last.snapshot, assessment: briefing } }] };
    assertBytes(next, AGENT_LIMITS.conversationBytes, "Conversation history");
    await client.query("UPDATE agent_conversations SET conversation=$4,revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [session.namespaceId, session.profileId, row.id, next]);
  }
}
export async function applyStep(client: PoolClient, lease: RunLease, outcome: StepOutcome): Promise<boolean> {
  const owned = await validLease(client, lease); if (!owned) return false;
  const { run, session } = owned;
  if (outcome.kind === "tool") throw new Error("Tool dispatch must pass the durable effect boundary");
  if (outcome.kind === "failed") { await markFailed(client, run, run.effect_state === "unknown" ? uncertainError : outcome.error); return true; }
  if (outcome.text !== undefined && (typeof outcome.text !== "string" || outcome.text.length > 32000)) { await markFailed(client, run, failedError); return true; }
  if (outcome.kind === "progress" && (!Number.isSafeInteger(outcome.checkpoint) || outcome.checkpoint !== run.checkpoint + 1 || outcome.checkpoint > 64 || !Number.isFinite(outcome.delayMs) || outcome.delayMs < 0 || outcome.delayMs > 60000)) { await markFailed(client, run, failedError); return true; }
  if (run.kind === "assessment" && run.input.kind === "assessment") {
    const before = await readWorkspace(client, session);
    if (before.assessment.status !== "running" || before.assessment.currentRunId !== run.input.assessmentRunId) { await cancelAgentRun(client, run); return false; }
    const completedAt = outcome.kind === "complete" ? new Date().toISOString() : null;
    const findings = outcome.kind === "complete" ? outcome.findings?.map(parseFinding) : [];
    const assessmentRunId = run.input.assessmentRunId;
    const orgIds = run.input.orgIds;
    if (outcome.kind === "complete" && (!findings || findings.some(f => !f || f.runId !== assessmentRunId || !orgIds.includes(f.orgId)))) { await markFailed(client, run, failedError); return true; }
    const after = { ...before.assessment, status: outcome.kind === "complete" ? "complete" as const : "running" as const, step: outcome.kind === "complete" ? ASSESSMENT_STEPS.length : outcome.checkpoint, completedAt,
      runs: before.assessment.runs.map(r => r.id === before.assessment.currentRunId && completedAt ? { ...r, completedAt, findings: findings as NonNullable<typeof findings>[number][] as typeof r.findings } : r) };
    // Worker events track progress; only user commands advance the conflict token.
    assertAssessmentLimits(after); await writeAssessment(client, session, before.assessment, after, before.assessmentRevision);
    await refreshLiveBriefings(client, session);
  } else await updateRunMessage(client, run, outcome.text ?? "");
  const status = outcome.kind === "complete" ? "completed" : "streaming";
  const published = await client.query(`UPDATE agent_runs r SET status=$2,checkpoint=$3,result=$4,error=NULL,lease_until=NULL,ready_at=clock_timestamp()+($5*interval '1 millisecond')
    WHERE r.id=$1 AND r.fence=$6 AND r.status IN ('pending','running','streaming') AND r.lease_until>clock_timestamp()
    AND EXISTS(SELECT 1 FROM demo_sessions s WHERE s.id=r.session_id AND s.namespace_id=r.namespace_id AND s.profile_id=r.profile_id AND s.generation=r.generation AND NOT s.revoked AND s.expires_at>clock_timestamp())
    AND EXISTS(SELECT 1 FROM workspaces w WHERE w.namespace_id=r.namespace_id AND w.profile_id=r.profile_id AND w.epoch=r.epoch)`,
  [run.id, status, outcome.kind === "progress" ? outcome.checkpoint : run.checkpoint, outcome.text ?? null, outcome.kind === "progress" ? outcome.delayMs : 0, lease.fence]);
  if (published.rowCount !== 1) throw new Error("The lease changed before publication");
  await appendRunEvent(client, run, status, { ...(outcome.text !== undefined ? { text: outcome.text } : {}), ...(outcome.kind === "progress" ? { step: outcome.checkpoint } : {}) });
  return true;
}

/** A model stream owns one paid dispatch and one continuous lease. Partial
 * text is durable and fenced exactly like completion, without releasing that
 * lease or advancing the demo adapter's resumable checkpoint. */
export async function publishModelProgress(client: PoolClient, lease: RunLease, text: string): Promise<boolean> {
  const owned = await validLease(client, lease); if (!owned) return false;
  const { run } = owned;
  if (run.execution.kind !== "model" || run.kind !== "chat" || !text || text.length > 32000
    || !text.startsWith(run.result ?? "")) throw new Error("Invalid model progress");
  if (run.result === text) return true;
  await updateRunMessage(client, run, text);
  const published = await client.query(`UPDATE agent_runs r SET status='streaming',result=$2
    WHERE r.id=$1 AND r.fence=$3 AND r.status IN ('running','streaming') AND r.lease_until>clock_timestamp()
    AND EXISTS(SELECT 1 FROM demo_sessions s WHERE s.id=r.session_id AND s.namespace_id=r.namespace_id AND s.profile_id=r.profile_id AND s.generation=r.generation AND NOT s.revoked AND s.expires_at>clock_timestamp())
    AND EXISTS(SELECT 1 FROM workspaces w WHERE w.namespace_id=r.namespace_id AND w.profile_id=r.profile_id AND w.epoch=r.epoch)`, [run.id, text, lease.fence]);
  if (published.rowCount !== 1) throw new Error("The lease changed before model progress could be published");
  await appendRunEvent(client, run, "streaming", { text });
  return true;
}

async function beginEffect(client: PoolClient, lease: RunLease, tool: string, input: unknown): Promise<string | null> {
  const owned = await validLease(client, lease); if (!owned || owned.run.effect_state !== "none") return null;
  const id = randomUUID();
  assertBytes(input, AGENT_LIMITS.inputBytes, "Tool input");
  await client.query("UPDATE agent_runs SET effect_id=$2,effect_tool=$3,effect_input=$4,effect_state='unknown' WHERE id=$1", [owned.run.id, id, tool, input]);
  await appendRunEvent(client, owned.run, "effect_started"); return id;
}
/** Server-injected registries/adapters only. Public commands cannot choose them. */
export async function workerTick(options: { runId?: string; adapter?: AgentAdapter; tools?: ToolRegistry; signal?: AbortSignal; model?: ModelRuntime } = {}): Promise<boolean> {
  const lease = await transaction(client => claimRun(client, options.runId)); if (!lease) return false;
  diagnoseRun(lease.run, "claimed");
  if (lease.run.execution.kind === "model") { await executeModelRun(lease, { valid: validLease, publish: applyStep, progress: publishModelProgress }, options.signal, options.model); return true; }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), LEASE_MS - 2000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    if (controller.signal.aborted) throw new Error("Worker interrupted");
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("Step timed out")), { once: true }));
    let outcome = await Promise.race([(options.adapter ?? demoAdapter).step(lease.run.input, lease.run.checkpoint, new Date().toISOString(), controller.signal), aborted]);
    if (outcome.kind === "tool") {
      const tool = authorizedTool(options.tools ?? demoTools, outcome.name, outcome.input, authority(lease.run));
      if (lease.run.kind === "assessment" && tool.effect === "write") throw new ToolError({ code: "tool_denied", message: "Assessments permit read-only tools. This write was not dispatched.", retryable: false, effects: "none" });
      const call = outcome;
      const effectId = tool.effect === "write" ? await transaction(client => beginEffect(client, lease, call.name, call.input))
        : await transaction(async client => await validLease(client, lease) ? randomUUID() : null);
      if (!effectId) return true;
      outcome = await Promise.race([tool.execute(outcome.input, authority(lease.run), effectId, controller.signal), aborted]);
      if (tool.effect === "write") {
        // A returned result establishes certainty only in the same fenced commit.
        await transaction(async client => {
          const owned = await validLease(client, lease); if (!owned) return;
          if (outcome.kind !== "complete") { await markFailed(client, owned.run, uncertainError); return; }
          if (!await applyStep(client, lease, outcome)) throw new Error("The lease expired before the result could be committed");
          await client.query("UPDATE agent_runs SET effect_state='confirmed' WHERE id=$1 AND status='completed' AND fence=$2", [lease.run.id, lease.fence]);
        });
        return true;
      }
    }
    await transaction(client => applyStep(client, lease, outcome));
  } catch (error) {
    diagnoseRun(lease.run, "step_failed", error instanceof ToolError ? error.detail.code : "adapter_failed");
    await transaction(client => applyStep(client, lease, { kind: "failed", error: error instanceof ToolError ? error.detail : failedError }));
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); diagnoseRun(lease.run, "step_finished"); }
  return true;
}

/** Trusted service hook, intentionally absent from HTTP. Unknown effects are never replayed. */
export async function reconcileEffect(token: string | undefined, generation: string, runId: string, registry: ToolRegistry): Promise<boolean> {
  const captured = await transaction(async client => {
    const session = await requireSession(client, token, generation); await lockAgentWorkspace(client, session);
    const run = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND id::text=$3", [session.namespaceId, session.profileId, runId])).rows[0] as RunRow | undefined;
    if (!run || run.effect_state !== "unknown" || !run.effect_id || !["failed", "cancelled"].includes(run.status)) return null;
    return run;
  });
  if (!captured?.effect_tool) return false;
  const tool = authorizedTool(registry, captured.effect_tool, captured.effect_input, authority(captured));
  if (!tool.reconcile) return false;
  const result = await tool.reconcile(captured.effect_id!, authority(captured));
  if (!result || result.kind !== "complete") return false;
  return transaction(async client => {
    const session = await requireSession(client, token, generation); await lockAgentWorkspace(client, session);
    if (captured.conversation_id) await client.query("SELECT id FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [session.namespaceId, session.profileId, captured.conversation_id]);
    const run = (await client.query("SELECT * FROM agent_runs WHERE id=$1 AND epoch=$2 AND effect_state='unknown' AND status IN ('failed','cancelled') FOR UPDATE", [runId, session.workspaceEpoch])).rows[0] as RunRow | undefined;
    if (!run || run.fence !== captured.fence || run.effect_id !== captured.effect_id) return false;
    await updateRunMessage(client, run, result.text ?? "The tool outcome was reconciled.");
    await client.query("UPDATE agent_runs SET effect_state='confirmed',status='completed',result=$2,error=NULL WHERE id=$1", [run.id, result.text ?? null]);
    await appendRunEvent(client, run, "reconciled", { text: result.text }); return true;
  });
}
