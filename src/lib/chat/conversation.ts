import type { TodaySnapshot } from "./today-snapshot";
import type { AgentNavigation } from "../agent/navigation";

export type Message =
  | { id: number; role: "agent" | "user" | "context"; text: string; turnId?: string; runId?: string; navigation?: AgentNavigation }
  | { id: number; role: "today"; snapshot: TodaySnapshot };

export type Conversation = { scopeKey: string; messages: Message[]; visitKey?: string; targetOrgId?: string | null };

type Presentation = {
  sessionKey: string;
  scopeKey: string;
  revision: number;
  afterId: number;
  phase: "layout" | "scrolling" | "revealing";
};

export type ConversationEvent =
  | { type: "today"; snapshot: TodaySnapshot; force?: boolean }
  | { type: "project"; label: string; reply: string }
  | { type: "org"; orgId: string | null; label: string | null }
  | { type: "surface"; scopeKey: string; label: string; reply: string; force?: boolean }
  | { type: "send"; text: string; reply: string; destination?: { key: string; label: string } };

/** Routes change the context of a thread; only project/worktree selects a thread. */
export function updateConversation(current: Conversation | undefined, event: ConversationEvent): Conversation {
  const thread = current ?? { scopeKey: "home", messages: [] };
  let id = (thread.messages.at(-1)?.id ?? 0) + 1;
  const target = thread.targetOrgId === undefined ? {} : { targetOrgId: thread.targetOrgId };
  if (event.type === "org") {
    if (thread.targetOrgId === event.orgId) return thread;
    const messages = thread.targetOrgId === undefined && event.orgId === null ? thread.messages
      : [...thread.messages, { id, role: "context" as const, text: event.orgId ? `Target org · ${event.label ?? event.orgId}` : "Target org cleared" }];
    return { ...thread, targetOrgId: event.orgId, messages };
  }
  if (event.type === "today") {
    // A Today card remains current until something else is printed after it.
    // Older queued Home visits may carry force, but must not duplicate it.
    const last = thread.messages.at(-1);
    if (last?.role === "today") return thread.scopeKey === "home" ? thread : { ...thread, scopeKey: "home" };
    return { ...target, scopeKey: "home", messages: [...thread.messages, { id, role: "today", snapshot: event.snapshot }] };
  }
  if (event.type === "project") {
    // Existing conversations resume verbatim, including their last surface.
    // Legacy Today and target-org markers do not replace the introduction.
    if (thread.messages.some(message => message.role === "agent" || message.role === "user")) return thread;
    return { ...target, scopeKey: "home", messages: [...thread.messages,
      { id: id++, role: "context", text: event.label }, { id, role: "agent", text: event.reply }] };
  }
  if (event.type === "surface") {
    if (!event.force && thread.scopeKey === event.scopeKey && thread.messages.length) return thread;
    return { ...target, scopeKey: event.scopeKey, messages: [
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
  return { ...target, scopeKey: event.destination?.key ?? thread.scopeKey, messages };
}

/** Owned by the mounted agent. Navigation and assessment subscriptions write
 * here, while React reads a stable snapshot of the selected session. */
export class ConversationStore {
  private listeners = new Set<() => void>();
  private state: { sessions: Record<string, Conversation>; scrollRevision: number; presentation: Presentation | null } = {
    sessions: {}, scrollRevision: 0, presentation: null,
  };

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Authoritative history replacement; presentation state stays browser-owned. */
  adopt(sessionKey: string, next: Conversation, deferReveal = false) {
    const previous = this.state.sessions[sessionKey];
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const appended = (next.messages.at(-1)?.id ?? 0) > (previous?.messages.at(-1)?.id ?? 0);
    const revision = this.state.scrollRevision + (appended ? 1 : 0);
    this.state = { ...this.state, sessions: { ...this.state.sessions, [sessionKey]: next }, scrollRevision: revision,
      presentation: appended && deferReveal && previous?.messages.length ? { sessionKey, scopeKey: next.scopeKey, revision, afterId: previous.messages.at(-1)!.id, phase: "layout" } : this.state.presentation };
    this.listeners.forEach(listener => listener());
  }

  dispatch(sessionKey: string, event: ConversationEvent, { deferReveal = false } = {}) {
    const previous = this.state.sessions[sessionKey];
    const next = updateConversation(previous, event);
    // Route arrival must not restart a sequence already queued by its link.
    if (next === previous && event.type === "surface") return;
    const revision = this.state.scrollRevision + 1;
    this.state = {
      sessions: { ...this.state.sessions, [sessionKey]: next },
      scrollRevision: revision,
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
