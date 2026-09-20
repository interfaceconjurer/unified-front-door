import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AGENT_LIMITS, activeRun, parseAgentCommand, type AgentAcknowledgement, type AgentReceipt, type AgentSnapshot, type SavedConversation, type RunInput, type AgentPolicy } from "../agent/contracts";
import { demoPolicy, projectIntroduction } from "../agent/demo";
import { ApplicationError, conflict, invalid, stableJson, type ApplicationCommand } from "../application/contracts";
import { updateConversation, type Conversation } from "../chat/conversation";
import { assessmentBriefing, captureToday } from "../chat/today-snapshot";
import { RETURNING_WORK, workCanvasInput } from "../workspace/returning-work";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { SURFACES } from "../workspace/surfaces";
import { UNBOUND_TARGET } from "../workspace/context";
import { captureAgentContext } from "./agent-context";
import { cancelAgentRun, createAgentRun, lockAgentWorkspace, runView, type RunRow } from "./agent-runs";
import { hash, requireSession, type OwnedSession } from "./session";
import { assertBytes } from "./quota";
import { captureModelExecution } from "./model-context";
import { modelSettings, ModelProviderError, type ModelSettings } from "./model-provider";
import type { AssessmentState } from "../assessment/state";

async function lockConversation(client: PoolClient, session: OwnedSession, id: string): Promise<SavedConversation> {
  const row = (await client.query("SELECT * FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND id::text=$3 FOR UPDATE", [session.namespaceId, session.profileId, id])).rows[0];
  if (!row) invalid("This conversation is unavailable in the current workspace.");
  return { id: row.id, threadKey: row.thread_key, revision: row.revision, conversation: row.conversation };
}
async function saveConversation(client: PoolClient, session: OwnedSession, row: SavedConversation, conversation: Conversation) {
  if (conversation.messages.length > AGENT_LIMITS.messages) invalid("This conversation has reached its history limit. Existing messages are preserved.");
  assertBytes(conversation, AGENT_LIMITS.conversationBytes, "Conversation history");
  const updated = await client.query("UPDATE agent_conversations SET conversation=$4,revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 RETURNING revision", [session.namespaceId, session.profileId, row.id, conversation]);
  return { ...row, revision: updated.rows[0].revision, conversation };
}
export async function observeAgent(client: PoolClient, token: string | undefined, generation: string): Promise<AgentSnapshot> {
  const session = await requireSession(client, token, generation), scope = [session.namespaceId, session.profileId];
  const conversations = (await client.query("SELECT id,thread_key,revision,conversation FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id", scope)).rows.map(row => ({ id: row.id, threadKey: row.thread_key, revision: row.revision, conversation: row.conversation }));
  const runs = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 ORDER BY created_at,id", scope)).rows.map(row => runView(row));
  const snapshot = { conversations, runs }; assertBytes(snapshot, AGENT_LIMITS.responseBytes, "Agent response"); return snapshot;
}
export async function observeRunEvents(client: PoolClient, token: string | undefined, generation: string, runId: string, after: number) {
  const session = await requireSession(client, token, generation);
  if (!Number.isSafeInteger(after) || after < 0 || runId.length > 200) invalid();
  const scope = [session.namespaceId, session.profileId, runId];
  const run = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND id::text=$3", scope)).rows[0];
  if (!run) invalid("This run is unavailable in the current workspace.");
  return { run: runView(run), events: (await client.query("SELECT event FROM agent_events WHERE namespace_id=$1 AND profile_id=$2 AND run_id::text=$3 AND sequence>$4 ORDER BY sequence LIMIT 128", [...scope, after])).rows.map(row => row.event) };
}
export async function executeAgentCommand(client: PoolClient, token: string | undefined, generation: string, value: unknown, policy: AgentPolicy = demoPolicy, settingsSource: () => ModelSettings | null = modelSettings): Promise<AgentAcknowledgement> {
  const command = parseAgentCommand(value), session = await requireSession(client, token, generation);
  await lockAgentWorkspace(client, session);
  const scope = [session.namespaceId, session.profileId], digest = hash(stableJson(command));
  const receipt = (await client.query("SELECT payload_hash,result FROM agent_receipts WHERE namespace_id=$1 AND profile_id=$2 AND generation=$3 AND request_id=$4", [...scope, generation, command.requestId])).rows[0];
  if (receipt) {
    if (receipt.payload_hash !== digest) conflict("This request ID was already used for different input.");
    // A retry acknowledges the original command without replaying it. Return
    // current history so a lost response cannot restore an obsolete view.
    return command.kind === "visit" ? { ...receipt.result, conversation: await lockConversation(client, session, receipt.result.conversationId) } : receipt.result;
  }
  let result: AgentReceipt;
  let acknowledgedConversation: SavedConversation | undefined;
  if (command.kind === "cancel" || command.kind === "retry") {
    const candidate = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND id::text=$3", [...scope, command.runId])).rows[0] as RunRow | undefined;
    if (!candidate) invalid("This run is unavailable in the current workspace.");
    const conversation = candidate.conversation_id ? await lockConversation(client, session, candidate.conversation_id) : null;
    const run = (await client.query("SELECT * FROM agent_runs WHERE id=$1 FOR UPDATE", [candidate.id])).rows[0] as RunRow;
    if (command.kind === "cancel") {
      await cancelAgentRun(client, run);
      if (run.kind === "assessment" && activeRun(run.status)) await client.query("UPDATE workspaces SET assessment_cursor=jsonb_set(assessment_cursor,'{status}','\"paused\"'),assessment_revision=assessment_revision+1 WHERE namespace_id=$1 AND profile_id=$2", scope);
      result = { runId: run.id };
    } else {
      if (run.status !== "cancelled" && run.status !== "failed" || run.effect_state !== "none" || run.error && !run.error.retryable) conflict("This attempt cannot be retried. An uncertain effect must be reconciled first.");
      // Revalidate current authority, but keep the original execution snapshot.
      await captureAgentContext(client, session, run.input.context);
      const busy = (await client.query("SELECT id FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND status IN ('pending','running','streaming') AND (conversation_id=$3 OR ($3::uuid IS NULL AND kind='assessment'))", [...scope, run.conversation_id])).rows[0];
      if (busy) conflict("An attempt is already active in this conversation or assessment.");
      const retry = await createAgentRun(client, session, command.requestId, run.input, { conversationId: run.conversation_id ?? undefined, turnId: run.turn_id ?? undefined, retryOf: run.id, checkpoint: run.execution.kind === "model" ? 0 : run.checkpoint, execution: run.execution });
      if (conversation) {
        const updated = { ...conversation.conversation, messages: conversation.conversation.messages.map(message => message.role === "agent" && message.turnId === run.turn_id ? { ...message, runId: retry.id, text: "", navigation: undefined } : message) };
        await saveConversation(client, session, conversation, updated);
      } else {
        const row = (await client.query("SELECT assessment_cursor FROM workspaces WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0];
        if (run.input.kind !== "assessment" || row.assessment_cursor.currentRunId !== run.input.assessmentRunId) conflict("A newer assessment has replaced this attempt. Resume the current assessment.");
        await client.query("UPDATE workspaces SET assessment_cursor=jsonb_set(assessment_cursor,'{status}','\"running\"'),assessment_revision=assessment_revision+1 WHERE namespace_id=$1 AND profile_id=$2", scope);
      }
      result = { runId: retry.id, ...(retry.conversation_id ? { conversationId: retry.conversation_id, turnId: retry.turn_id! } : {}) };
    }
  } else {
    // Old visit commands may still be queued after a deployed app moved.
    // Adapt their context only after checking the original request receipt.
    const visitedWork = command.kind === "visit" && command.workId ? RETURNING_WORK.find(work => work.id === command.workId
      && work.projectId === command.context.target.projectId && work.worktreeId === command.context.target.worktreeId) : undefined;
    const requestedContext = visitedWork && command.context.surface !== "home"
      ? { ...command.context, surface: canonicalCanvasSurface(command.context.surface, workCanvasInput(visitedWork)) } : command.context;
    const captured = await captureAgentContext(client, session, requestedContext), { context, workspace, project, projects } = captured;
    let row = (await client.query("SELECT id FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2 AND thread_key=$3", [...scope, context.threadKey])).rows[0];
    if (!row) {
      const count = (await client.query("SELECT count(*)::int AS n FROM agent_conversations WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0].n;
      if (count >= AGENT_LIMITS.conversations) invalid("This demo workspace has reached its conversation limit. Existing history is preserved.");
      row = { id: randomUUID() };
      await client.query("INSERT INTO agent_conversations(namespace_id,profile_id,epoch,id,thread_key,conversation) VALUES($1,$2,$3,$4,$5,$6)", [...scope, session.workspaceEpoch, row.id, context.threadKey, { scopeKey: "home", messages: [] }]);
    }
    const saved = await lockConversation(client, session, row.id);
    const original = saved.conversation, trailing = original.messages.at(-1);
    // Freeze the latest acknowledged business state when this live Today becomes
    // history. Earlier Today entries retain their original bounded snapshots.
    if (trailing?.role === "today") saved.conversation = { ...original, messages: [...original.messages.slice(0, -1),
      { ...trailing, snapshot: { ...trailing.snapshot, assessment: assessmentBriefing(workspace.assessment) } }] };
    saved.conversation = updateConversation(saved.conversation, { type: "org", orgId: context.target.orgId, label: context.orgLabel });
    if (command.kind === "visit") {
      let next: Conversation;
      if (command.workId) {
        const work = RETURNING_WORK.find(work => work.id === command.workId && work.projectId === context.target.projectId && work.worktreeId === context.target.worktreeId && work.surfaceId === context.surface);
        if (!work) invalid("This work destination is unavailable in the captured context.");
        next = saved.conversation.visitKey === `work:${work.id}` ? saved.conversation : {
          ...updateConversation(saved.conversation, { type: "surface", scopeKey: work.surfaceId, label: SURFACES[work.surfaceId].label, reply: policy.workReply(work), force: true }),
          visitKey: `work:${work.id}`,
        };
      } else if (context.surface === "home" && !project) {
        const recent = RETURNING_WORK.filter(work => projects.some(project => project.id === work.projectId) && context.profile.surfaceAccess.includes(work.surfaceId))
          .map(work => { const project = projects.find(project => project.id === work.projectId)!;
            return { ...work, projectName: project.name, branch: project.worktrees.find(tree => tree.id === work.worktreeId)?.branch ?? work.worktreeId }; })
          .sort((a, b) => Number(!!b.attention) - Number(!!a.attention) || b.updated.localeCompare(a.updated));
        next = updateConversation(saved.conversation, { type: "today", force: command.refreshToday, snapshot: captureToday({ capturedAt: context.capturedAt, profile: context.profile, scope: "global", projectName: "All projects", branch: "", hasProjects: context.hasProjects,
          recent, working: projects.reduce((count, project) => count + project.agentSessions.filter(session => session.status === "working").length, 0), assessment: workspace.assessment }) });
      } else if (context.surface === "home") {
        next = updateConversation(saved.conversation, { type: "project", label: context.projectName, reply: projectIntroduction(context) });
      } else next = updateConversation(saved.conversation, { type: "surface", scopeKey: context.surface, label: SURFACES[context.surface].label,
        reply: project && !saved.conversation.messages.some(message => message.role === "agent")
          ? `${projectIntroduction(context)}\n\n${policy.surfaceReply(context, false)}`
          : policy.surfaceReply(context, !saved.conversation.messages.some(message => message.role === "agent")) });
      acknowledgedConversation = next !== original ? await saveConversation(client, session, saved, next) : saved;
      result = { conversationId: saved.id };
    } else {
      if ((await client.query("SELECT id FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND conversation_id=$3 AND status IN ('pending','running','streaming')", [...scope, saved.id])).rowCount) throw new ApplicationError("conflict", "A reply is already in progress. Your message draft is still here.", 409);
      let settings: ModelSettings | null;
      try { settings = settingsSource(); } catch { throw new ApplicationError("unavailable", "The model provider is not configured correctly. Your message has not been submitted.", 503); }
      const input: RunInput = { kind: "chat", text: command.text, context, destination: settings ? null : policy.recommend(command.text, context) }, turnId = randomUUID();
      if (input.destination && !context.profile.surfaceAccess.includes(input.destination)) invalid("The adapter recommended an unavailable surface.");
      let execution;
      try { execution = settings ? await captureModelExecution(client, session, saved.id, saved.conversation, context, workspace.assessment, command.text, settings) : undefined; }
      catch (error) { if (error instanceof ModelProviderError && error.code === "input_limit") invalid("This request exceeds the model input limit. Shorten the message or select a smaller context."); throw error; }
      const run = await createAgentRun(client, session, command.requestId, input, { conversationId: saved.id, turnId, execution });
      const next = updateConversation(saved.conversation, { type: "send", text: command.text, reply: "", ...(input.destination ? { destination: { key: input.destination, label: SURFACES[input.destination].label } } : {}) });
      next.messages = next.messages.map((message, i) => i >= saved.conversation.messages.length && (message.role === "user" || message.role === "agent") ? { ...message, turnId, runId: run.id } : message);
      await saveConversation(client, session, saved, next);
      result = { conversationId: saved.id, turnId, runId: run.id, destination: input.destination };
    }
  }
  await client.query("INSERT INTO agent_receipts(namespace_id,profile_id,generation,request_id,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6)", [...scope, generation, command.requestId, digest, result]);
  // Keep durable receipts small: history is returned once, not copied into
  // every navigation receipt as the conversation grows.
  return acknowledgedConversation ? { ...result, conversation: acknowledgedConversation } : result;
}

/** Existing project commands retain their queue/revision protocol; only workers advance. */
export async function syncAssessmentExecution(client: PoolClient, session: OwnedSession, command: ApplicationCommand, after: AssessmentState): Promise<void> {
  if (!["assessment.start", "assessment.pause", "assessment.rescan"].includes(command.kind)) return;
  const scope = [session.namespaceId, session.profileId];
  const existing = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND kind='assessment' AND status IN ('pending','running','streaming') FOR UPDATE", scope)).rows[0] as RunRow | undefined;
  if (existing && (command.kind === "assessment.pause" || command.kind === "assessment.rescan" || after.status !== "running")) await cancelAgentRun(client, existing);
  if (command.kind === "assessment.pause" || after.status !== "running" || existing && command.kind === "assessment.start") return;
  const previous = (await client.query("SELECT * FROM agent_runs WHERE namespace_id=$1 AND profile_id=$2 AND kind='assessment' AND input->>'assessmentRunId'=$3 ORDER BY created_at DESC,id DESC LIMIT 1", [...scope, after.currentRunId])).rows[0] as RunRow | undefined;
  if (previous?.effect_state === "unknown") conflict("The previous attempt requires reconciliation before it can resume.");
  const { context } = await captureAgentContext(client, session, { target: UNBOUND_TARGET, surface: "home" });
  await createAgentRun(client, session, command.commandId, { kind: "assessment", assessmentRunId: after.currentRunId!, orgIds: [...after.scopeOrgIds], context }, { checkpoint: after.step, retryOf: previous?.id });
}
