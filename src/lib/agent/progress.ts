import type { AgentSnapshot, RunView, SavedConversation } from "./contracts";

/** A run sequence orders both progress reads and full history snapshots. */
function projectReplies(conversations: SavedConversation[], runs: RunView[]): SavedConversation[] {
  const byId = new Map(runs.map(run => [run.id, run]));
  return conversations.map(saved => {
    let changed = false;
    const messages = saved.conversation.messages.map(message => {
      if (message.role !== "agent" || !message.runId) return message;
      const run = byId.get(message.runId);
      // A retry reuses the turn but owns a new run. Never revive its old reply.
      if (!run || run.conversationId !== saved.id || run.turnId !== message.turnId
        || run.result === null || run.result === message.text) return message;
      changed = true;
      return { ...message, text: run.result };
    });
    return changed ? { ...saved, conversation: { ...saved.conversation, messages } } : saved;
  });
}

export function mergeAgentSnapshot(current: AgentSnapshot, incoming: AgentSnapshot): AgentSnapshot {
  const previousRuns = new Map(current.runs.map(run => [run.id, run]));
  const previousConversations = new Map(current.conversations.map(saved => [saved.id, saved]));
  const runs = incoming.runs.map(run => {
    const previous = previousRuns.get(run.id);
    return previous && previous.sequence > run.sequence ? previous : run;
  });
  const conversations = incoming.conversations.map(saved => {
    const previous = previousConversations.get(saved.id);
    return previous && previous.revision > saved.revision ? previous : saved;
  });
  return { runs, conversations: projectReplies(conversations, runs) };
}

export function mergeRunProgress(current: AgentSnapshot, incoming: RunView): AgentSnapshot {
  const previous = current.runs.find(run => run.id === incoming.id);
  if (!previous || previous.sequence >= incoming.sequence || previous.turnId !== incoming.turnId
    || previous.conversationId !== incoming.conversationId || previous.requestId !== incoming.requestId) return current;
  const runs = current.runs.map(run => run.id === incoming.id ? incoming : run);
  return { runs, conversations: projectReplies(current.conversations, runs) };
}
