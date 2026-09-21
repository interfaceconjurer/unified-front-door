import "server-only";
import type { PoolClient } from "pg";
import type { CapturedContext } from "../agent/contracts";
import type { AssessmentState } from "../assessment/state";
import type { Conversation } from "../chat/conversation";
import type { OwnedSession } from "./session";
import { ModelProviderError, serializeModelRequest, type ModelPrompt, type ModelSettings } from "./model-provider";
import { navigationOptions } from "../agent/navigation";
import { hasExplicitNavigationIntent } from "../agent/navigation-intent";
import { projectTemplate } from "../projects/templates";

export type ModelExecution = {
  kind: "model"; version: 1; settings: ModelSettings; prompt: ModelPrompt;
  provenance: { capturedAt: string; findingIds: string[]; history: { messageId: number; runId: string; role: "user" | "assistant" }[];
    totalFindings: number; omittedFindings: number; omittedHistoryMessages: number; dataSource: "demo-workspace" };
};
export type RunExecution = { kind: "demo"; version: 1 } | ModelExecution;
type History = { messageId: number; runId: string; role: "user" | "assistant"; content: string };

/** A pure snapshot projection. History arrives only after owned completed-run
 * filtering; neither UI Today blobs nor pending/failed placeholders are sent. */
export function modelExecution(context: CapturedContext, assessment: AssessmentState, text: string, history: History[], settings: ModelSettings): ModelExecution {
  const navigation = settings.policy.promptVersion === "workspace-navigator-v2"
    || settings.policy.promptVersion === "workspace-planner-v3" && hasExplicitNavigationIntent(text) ? navigationOptions(context) : undefined;
  const completed = assessment.runs.find(run => run.id === (context.improvement?.runId ?? assessment.currentRunId) && run.completedAt);
  // An owned project can intentionally investigate production evidence in a
  // sandbox. Its work items define evidence scope; target org is the execution
  // destination. Standalone assessment scope follows the selected org.
  const findings = context.improvement ? context.improvement.workItems.map(item => item.finding)
    : (completed?.findings ?? []).filter(finding => !context.target.orgId || finding.orgId === context.target.orgId);
  const included = [...findings];
  const prior = history.slice(-12);
  // Keep entire user/assistant pairs; never start with a detached old reply.
  while (prior[0]?.role === "assistant") prior.shift();
  for (;;) {
    const provenance: ModelExecution["provenance"] = { capturedAt: context.capturedAt, findingIds: included.map(finding => finding.id),
      history: prior.map(({ messageId, runId, role }) => ({ messageId, runId, role })), totalFindings: findings.length,
      omittedFindings: findings.length - included.length, omittedHistoryMessages: history.length - prior.length, dataSource: "demo-workspace" };
    const evidence = { provenance, workspace: { target: context.target, surface: context.surface, projectName: context.projectName, branch: context.branch, orgLabel: context.orgLabel },
      project: context.improvement ? { id: context.improvement.id, revision: context.improvement.revision, name: context.improvement.name, targetOrgId: context.improvement.targetOrgId,
        sourceRunId: context.improvement.runId, sourceOrgIds: [...new Set(findings.map(finding => finding.orgId))],
        goal: context.improvement.goal, projectType: projectTemplate(context.improvement.projectType).id, context: context.improvement.context ?? "",
        workItems: context.improvement.workItems.filter(item => included.some(finding => finding.id === item.findingId)).map(({ id, findingId, status }) => ({ id, findingId, status })) } : null,
      ...(context.projectBrief ? { projectBrief: context.projectBrief } : {}),
      assessment: completed ? { id: completed.id, completedAt: completed.completedAt, source: completed.source } : null, findings: included };
    const prompt: ModelPrompt = { ...(navigation ? { navigation } : {}), messages: [...prior.map(({ role, content }) => ({ role, content })),
      { role: "user", content: JSON.stringify({ evidence, request: text }) }] };
    try { serializeModelRequest(prompt, settings.policy); return structuredClone({ kind: "model", version: 1, settings, prompt, provenance }); }
    catch (error) {
      if (!(error instanceof ModelProviderError) || error.code !== "input_limit") throw error;
      // Explicit omissions preserve recent history and whole findings. The user
      // request is never silently clipped; reject if even it cannot fit.
      if (prior.length) { prior.splice(0, 2); continue; }
      if (included.length) { included.pop(); continue; }
      throw error;
    }
  }
}

export async function captureModelExecution(client: PoolClient, session: OwnedSession, conversationId: string, conversation: Conversation,
  context: CapturedContext, assessment: AssessmentState, text: string, settings: ModelSettings): Promise<ModelExecution> {
  const rows = (await client.query("SELECT id,turn_id FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND conversation_id=$3 AND status='completed' AND epoch=$4 AND input->'context'->'target'=$5::jsonb", [session.namespaceId, session.profileId, conversationId, session.workspaceEpoch, JSON.stringify(context.target)])).rows;
  const completed = new Map(rows.map(row => [row.id as string, row.turn_id as string]));
  const history: History[] = [];
  for (let i = 0; i < conversation.messages.length; i++) {
    const user = conversation.messages[i];
    if (!user || user.role !== "user" || !user.turnId) continue;
    const turnId = user.turnId;
    const reply = conversation.messages.slice(i + 1).find(message => message.role === "agent" && message.turnId === turnId);
    if (!reply || reply.role !== "agent" || !reply.runId || completed.get(reply.runId) !== user.turnId || !reply.text.trim()) continue;
    history.push({ messageId: user.id, runId: reply.runId, role: "user", content: user.text },
      { messageId: reply.id, runId: reply.runId, role: "assistant", content: reply.text });
  }
  return modelExecution(context, assessment, text, history, settings);
}
