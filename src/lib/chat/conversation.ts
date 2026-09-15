import type { TodaySnapshot } from "../../components/front-door/today-snapshot";
import type { PlanningState } from "./planning";

export type Message =
  | { id: number; role: "agent" | "user" | "context"; text: string }
  | { id: number; role: "today"; snapshot: TodaySnapshot };

export type Conversation = { scopeKey: string; messages: Message[]; planning?: PlanningState };

type Presentation = {
  sessionKey: string;
  scopeKey: string;
  revision: number;
  afterId: number;
  phase: "layout" | "scrolling" | "revealing";
};

export type ConversationEvent =
  | { type: "today"; snapshot: TodaySnapshot }
  | { type: "surface"; scopeKey: string; label: string; reply: string; force?: boolean }
  | { type: "send"; text: string; reply: string; planning?: PlanningState; destination?: { key: string; label: string } };

/** Routes change the context of a thread; only project/worktree selects a thread. */
export function updateConversation(current: Conversation | undefined, event: ConversationEvent): Conversation {
  const thread = current ?? { scopeKey: "home", messages: [] };
  let id = (thread.messages.at(-1)?.id ?? 0) + 1;
  if (event.type === "today") {
    // Repeated Home clicks focus the current briefing without filling history.
    if (thread.scopeKey === "home" && thread.messages.at(-1)?.role === "today") return thread;
    return { ...thread, scopeKey: "home", messages: [...thread.messages, { id, role: "today", snapshot: event.snapshot }] };
  }
  if (event.type === "surface") {
    if (!event.force && thread.scopeKey === event.scopeKey && thread.messages.length) return thread;
    return { ...thread, scopeKey: event.scopeKey, messages: [
      ...thread.messages,
      { id: id++, role: "context", text: event.label },
      { id, role: "agent", text: event.reply },
    ] };
  }
  const messages: Message[] = [...thread.messages, { id: id++, role: "user", text: event.text }];
  if (event.destination && event.destination.key !== thread.scopeKey) {
    messages.push({ id: id++, role: "context", text: event.destination.label });
  }
  messages.push({ id, role: "agent", text: event.reply });
  return { ...thread, scopeKey: event.destination?.key ?? thread.scopeKey, messages,
    ...(event.planning ? { planning: event.planning } : {}),
  };
}

/** Shared by the agent and creation workflows, with independent workspace
 * histories and drafts. Each new project starts its own conversation. */
export class ConversationStore {
  private listeners = new Set<() => void>();
  private state: {
    sessions: Record<string, Conversation>;
    drafts: Record<string, string>;
    scrollRevision: number;
    presentation: Presentation | null;
    streamingReply: { sessionKey: string; messageId: number } | null;
  } = {
    sessions: {}, drafts: {}, scrollRevision: 0, presentation: null, streamingReply: null,
  };

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  setDraft(sessionKey: string, value: string | ((current: string) => string)) {
    const previous = this.state.drafts[sessionKey] ?? "";
    const next = typeof value === "function" ? value(previous) : value;
    if (previous === next) return;
    this.state = { ...this.state, drafts: { ...this.state.drafts, [sessionKey]: next } };
    this.listeners.forEach((listener) => listener());
  }

  dispatch(sessionKey: string, event: ConversationEvent, { deferReveal = false } = {}) {
    const previous = this.state.sessions[sessionKey];
    const next = updateConversation(previous, event);
    // Route arrival must not restart a sequence already queued by its link.
    if (next === previous && event.type === "surface") {
      const streaming = this.state.streamingReply;
      if (streaming && streaming.sessionKey !== sessionKey) {
        this.completeReply(streaming.sessionKey, streaming.messageId);
      }
      return;
    }
    const revision = this.state.scrollRevision + 1;
    const last = next.messages.at(-1);
    this.state = {
      ...this.state,
      sessions: { ...this.state.sessions, [sessionKey]: next },
      scrollRevision: revision,
      streamingReply: last?.role === "agent" ? { sessionKey, messageId: last.id } : null,
      presentation: deferReveal ? {
        sessionKey, scopeKey: next.scopeKey, revision, phase: "layout",
        afterId: this.state.presentation?.sessionKey === sessionKey && this.state.presentation.phase !== "revealing"
          ? this.state.presentation.afterId : previous?.messages.at(-1)?.id ?? 0,
      } : null,
    };
    this.listeners.forEach((listener) => listener());
  }

  advancePresentation(revision: number, phase: Presentation["phase"] | "complete") {
    if (this.state.presentation?.revision !== revision) return;
    this.state = { ...this.state, presentation: phase === "complete" ? null : { ...this.state.presentation, phase } };
    this.listeners.forEach((listener) => listener());
  }

  completeReply(sessionKey: string, messageId: number) {
    const streaming = this.state.streamingReply;
    if (streaming?.sessionKey !== sessionKey || streaming.messageId !== messageId) return;
    this.state = { ...this.state, streamingReply: null };
    this.listeners.forEach((listener) => listener());
  }

  recordAssessment(sessionKey: string, assessment: TodaySnapshot["assessment"]) {
    const conversation = this.state.sessions[sessionKey];
    const last = conversation?.messages.at(-1);
    if (!conversation || last?.role !== "today" || last.snapshot.assessment === assessment) return;
    this.state = { ...this.state, sessions: { ...this.state.sessions, [sessionKey]: {
      ...conversation, messages: [
        ...conversation.messages.slice(0, -1),
        { ...last, snapshot: { ...last.snapshot, assessment } },
      ],
    } } };
    this.listeners.forEach((listener) => listener());
  }
}
