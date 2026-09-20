import { exact, invalid, record, text } from "../application/contracts";
import type { DemoProfile } from "../demo-profiles";
import type { Conversation } from "../chat/conversation";
import type { ImprovementProject } from "../projects/model";
import { parseTarget, type WorkspaceTarget } from "../workspace/context";
import { isSurfaceId, type SurfaceId } from "../workspace/surfaces";
import type { FindingSnapshot } from "../assessment/model";
import type { AgentNavigation } from "./navigation";

export type RunStatus = "pending" | "running" | "streaming" | "completed" | "failed" | "cancelled";
export type RunError = { code: "adapter_failed" | "recovery_exhausted" | "reconciliation_required" | "tool_denied" | "unconfigured" | "model_outcome_unknown" | "model_limit" | "model_busy" | "model_failed" | "model_refused" | "model_incomplete" | "model_rate_limited" | "model_timeout"; message: string; retryable: boolean; effects: "none" | "confirmed" | "unknown"; providerCost?: "unknown" };
export type AgentContext = { target: WorkspaceTarget; surface: SurfaceId | "home" };
export type CapturedContext = AgentContext & {
  profile: DemoProfile; capturedAt: string; threadKey: string; projectName: string; branch: string;
  worktreeLabel: string | null; orgLabel: string | null; hasProjects: boolean;
  assessmentNavigation?: { runId: string; findings: { id: string; title: string }[] };
  improvement: ImprovementProject | null; greeting: string | null;
};
export type RunInput = { kind: "chat"; text: string; context: CapturedContext; destination: SurfaceId | null }
  | { kind: "assessment"; assessmentRunId: string; orgIds: string[]; context: CapturedContext };
export type RunView = {
  id: string; requestId: string; turnId: string | null; conversationId: string | null; retryOf: string | null;
  kind: RunInput["kind"]; status: RunStatus; sequence: number; createdAt: string; updatedAt: string;
  assessmentRunId: string | null;
  execution?: { provider: "demo" | "anthropic"; model?: string; promptVersion?: string; omittedFindings?: number; omittedHistoryMessages?: number };
  context: AgentContext; error: RunError | null; result: string | null; checkpoint: number;
};
export type AgentEvent = { runId: string; requestId: string; turnId: string | null; conversationId: string | null;
  sequence: number; at: string; kind: RunStatus | "effect_started" | "reconciled"; data: { text?: string; step?: number; error?: RunError } };
export type SavedConversation = { id: string; threadKey: string; revision: number; conversation: Conversation };
export type AgentSnapshot = { conversations: SavedConversation[]; runs: RunView[] };
export type AgentCommand = { requestId: string } & (
  | { kind: "visit"; context: AgentContext; workId?: string; refreshToday?: true }
  | { kind: "submit"; context: AgentContext; text: string }
  | { kind: "cancel"; runId: string }
  | { kind: "retry"; runId: string }
);
export type AgentReceipt = { conversationId?: string; runId?: string; turnId?: string; destination?: SurfaceId | null };
/** Current history travels with the acknowledgement, never in durable receipts. */
export type AgentAcknowledgement = AgentReceipt & {
  conversation?: SavedConversation;
};
export type StepOutcome =
  | { kind: "progress"; checkpoint: number; text?: string; delayMs: number }
  | { kind: "complete"; text?: string; findings?: FindingSnapshot[]; navigation?: AgentNavigation }
  | { kind: "failed"; error: RunError }
  | { kind: "tool"; name: string; input: unknown };
export type AgentAdapter = { step(input: RunInput, checkpoint: number, now: string, signal: AbortSignal): Promise<StepOutcome> };
/** Synchronous policy: no provider/network operation is allowed under submit locks. */
export type AgentPolicy = {
  recommend(text: string, context: CapturedContext): SurfaceId | null;
  surfaceReply(context: CapturedContext, first: boolean): string;
  workReply(work: { title: string; summary: string; attention?: boolean }): string;
};
export const AGENT_LIMITS = { conversations: 16, messages: 128, runs: 128, conversationBytes: 512 * 1024, inputBytes: 128 * 1024, responseBytes: 24 * 1024 * 1024, text: 8000 } as const;
export function activeRun(status: RunStatus): boolean { return status === "pending" || status === "running" || status === "streaming"; }
export function parseAgentContext(value: unknown): AgentContext {
  if (!record(value)) invalid(); exact(value, ["target", "surface"]);
  if (!record(value.target)) invalid(); exact(value.target, ["projectId", "worktreeId", "orgId"]);
  const target = parseTarget(value.target);
  if (!target || Object.values(target).some(id => id !== null && id.length > 1000) || value.surface !== "home" && !isSurfaceId(value.surface)) invalid();
  return { target, surface: value.surface as AgentContext["surface"] };
}
export function parseAgentCommand(value: unknown): AgentCommand {
  if (!record(value) || !text(value.requestId, 200)) invalid();
  if (value.kind === "cancel" || value.kind === "retry") {
    exact(value, ["kind", "requestId", "runId"]); if (!text(value.runId, 200)) invalid();
    return value as AgentCommand;
  }
  if (value.kind !== "submit" && value.kind !== "visit") invalid();
  exact(value, ["kind", "requestId", "context", ...(value.kind === "submit" ? ["text"] : ["workId", "refreshToday"])]);
  if (value.kind === "submit" && (!text(value.text, AGENT_LIMITS.text) || !value.text.trim())) invalid("Write a message of up to 8,000 characters.");
  if (value.kind === "visit" && value.workId !== undefined && !text(value.workId, 200)) invalid();
  const context = parseAgentContext(value.context);
  if (value.kind === "visit" && value.refreshToday !== undefined && (value.refreshToday !== true || context.surface !== "home" || context.target.projectId !== null || value.workId !== undefined)) invalid();
  return { ...value, context } as AgentCommand;
}
