import type { AgentNavigation } from "../agent/navigation";
import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AGENT_LIMITS, activeRun, type AgentEvent, type RunInput, type RunStatus, type RunView, type RunError } from "../agent/contracts";
import { invalid } from "../application/contracts";
import type { Conversation } from "../chat/conversation";
import type { OwnedSession } from "./session";
import { assertBytes } from "./quota";
import type { RunExecution } from "./model-context";
import { abandonModelAttempt, modelUnknownError } from "./model-attempts";

export type RunRow = {
  namespace_id: string; profile_id: string; epoch: string; id: string; session_id: string; generation: string;
  request_id: string; turn_id: string | null; conversation_id: string | null; retry_of: string | null;
  execution: RunExecution;
  kind: RunInput["kind"]; input: RunInput; status: RunStatus; checkpoint: number; result: string | null; error: RunError | null;
  sequence: number; fence: number; recoveries: number; ready_at: Date; lease_until: Date | null;
  effect_id: string | null; effect_tool: string | null; effect_input: unknown; effect_state: "none" | "unknown" | "confirmed"; created_at: Date; updated_at: Date;
};
export function runView(row: RunRow): RunView {
  return { id: row.id, requestId: row.request_id, turnId: row.turn_id, conversationId: row.conversation_id, retryOf: row.retry_of,
    kind: row.kind, status: row.status, checkpoint: row.checkpoint, sequence: row.sequence, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    execution: row.execution.kind === "model" ? { provider: "anthropic", model: row.execution.settings.policy.model, promptVersion: row.execution.settings.policy.promptVersion, omittedFindings: row.execution.provenance.omittedFindings, omittedHistoryMessages: row.execution.provenance.omittedHistoryMessages } : { provider: "demo" },
    assessmentRunId: row.input.kind === "assessment" ? row.input.assessmentRunId : null,
    context: { target: row.input.context.target, surface: row.input.context.surface }, error: row.error, result: row.result };
}
export async function lockAgentWorkspace(client: PoolClient, session: OwnedSession): Promise<void> {
  const row = (await client.query("SELECT epoch FROM workspaces WHERE namespace_id=$1 AND profile_id=$2 FOR UPDATE", [session.namespaceId, session.profileId])).rows[0];
  if (!row || row.epoch !== session.workspaceEpoch) invalid("This workspace changed.");
}
export async function appendRunEvent(client: PoolClient, run: RunRow, kind: AgentEvent["kind"], data: AgentEvent["data"] = {}) {
  const row = (await client.query("UPDATE agent_runs SET sequence=sequence+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING sequence,updated_at", [run.id])).rows[0];
  const event: AgentEvent = { runId: run.id, requestId: run.request_id, turnId: run.turn_id, conversationId: run.conversation_id, sequence: row.sequence, at: row.updated_at.toISOString(), kind, data };
  await client.query("INSERT INTO agent_events(namespace_id,profile_id,run_id,sequence,event) VALUES($1,$2,$3,$4,$5)", [run.namespace_id, run.profile_id, run.id, event.sequence, event]);
  return event;
}
export async function createAgentRun(client: PoolClient, session: OwnedSession, requestId: string, input: RunInput, options: { conversationId?: string; turnId?: string; retryOf?: string; checkpoint?: number; execution?: RunExecution } = {}): Promise<RunRow> {
  const count = (await client.query("SELECT count(*)::int AS n FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2", [session.namespaceId, session.profileId])).rows[0].n;
  if (count >= AGENT_LIMITS.runs) invalid("This demo workspace has reached its run history limit. Existing history is preserved.");
  assertBytes(input, AGENT_LIMITS.inputBytes, "Captured agent context");
  assertBytes(options.execution ?? {}, AGENT_LIMITS.inputBytes, "Captured model request");
  const row = (await client.query(`INSERT INTO agent_runs(namespace_id,profile_id,epoch,id,session_id,generation,request_id,turn_id,conversation_id,retry_of,kind,status,input,checkpoint,execution)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14) RETURNING *`,
  [session.namespaceId, session.profileId, session.workspaceEpoch, randomUUID(), session.id, session.generation, requestId, options.turnId ?? null, options.conversationId ?? null, options.retryOf ?? null, input.kind, input, options.checkpoint ?? 0, options.execution ?? { kind: "demo", version: 1 }])).rows[0] as RunRow;
  await appendRunEvent(client, row, "pending"); return row;
}
export async function updateRunMessage(client: PoolClient, run: RunRow, text: string, navigation?: AgentNavigation): Promise<void> {
  if (!run.conversation_id) return;
  const scope = [run.namespace_id, run.profile_id, run.conversation_id];
  const row = (await client.query("SELECT conversation FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", scope)).rows[0];
  if (!row) return;
  const conversation = row.conversation as Conversation;
  const updated: Conversation = { ...conversation, messages: conversation.messages.map(message => message.role === "agent" && message.turnId === run.turn_id ? { ...message, text, runId: run.id, navigation } : message) };
  assertBytes(updated, AGENT_LIMITS.conversationBytes, "Conversation history");
  await client.query("UPDATE agent_conversations SET conversation=$4,revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, updated]);
}
/** Caller holds session -> workspace -> conversation -> run locks. */
export async function cancelAgentRun(client: PoolClient, run: RunRow, message = "This attempt was cancelled."): Promise<void> {
  if (!activeRun(run.status)) return;
  const modelUnknown = run.execution.kind === "model" && await abandonModelAttempt(client, run.id);
  const error: RunError | null = modelUnknown ? modelUnknownError : run.effect_state === "unknown" ? { code: "reconciliation_required", message: "The attempt was cancelled, but its tool outcome is uncertain and needs reconciliation.", retryable: false, effects: "unknown" } : null;
  await client.query("UPDATE agent_runs SET status='cancelled',fence=fence+1,lease_until=NULL,error=$2 WHERE id=$1", [run.id, error]);
  await appendRunEvent(client, run, "cancelled", { text: message, ...(error ? { error } : {}) });
}
/** Session update lock excludes every worker/command before workspace locks. */
export async function cancelSessionRuns(client: PoolClient, session: OwnedSession): Promise<void> {
  if (!session.profileId) return;
  await lockAgentWorkspace(client, session);
  const rows = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND generation=$3 AND status IN ('pending','running','streaming') ORDER BY id", [session.namespaceId, session.profileId, session.generation])).rows as RunRow[];
  for (const run of rows) {
    if (run.conversation_id) await client.query("SELECT id FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [run.namespace_id, run.profile_id, run.conversation_id]);
    await client.query("SELECT id FROM agent_runs WHERE id=$1 FOR UPDATE", [run.id]);
    await cancelAgentRun(client, run, "The demo session changed. Resume in the original workspace to continue.");
  }
  if (rows.some(r => r.kind === "assessment")) await client.query("UPDATE workspaces SET assessment_cursor=jsonb_set(assessment_cursor,'{status}','\"paused\"'),assessment_revision=assessment_revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND assessment_cursor->>'status'='running'", [session.namespaceId, session.profileId]);
}
