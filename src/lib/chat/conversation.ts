import type { TodaySnapshot } from "../../components/front-door/today-snapshot";

export type Message =
  | { id: number; role: "agent" | "user" | "context"; text: string }
  | { id: number; role: "today"; snapshot: TodaySnapshot };

export type Conversation = { scopeKey: string; messages: Message[] };

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
  | { type: "send"; text: string; reply: string; destination?: { key: string; label: string } };

/** Routes change the context of a thread; only project/worktree selects a thread. */
export function updateConversation(current: Conversation | undefined, event: ConversationEvent): Conversation {
  const thread = current ?? { scopeKey: "home", messages: [] };
  let id = (thread.messages.at(-1)?.id ?? 0) + 1;
  if (event.type === "today") {
    // Repeated Home clicks focus the current briefing without filling history.
    if (thread.scopeKey === "home" && thread.messages.at(-1)?.role === "today") return thread;
    return { scopeKey: "home", messages: [...thread.messages, { id, role: "today", snapshot: event.snapshot }] };
  }
  if (event.type === "surface") {
    if (!event.force && thread.scopeKey === event.scopeKey && thread.messages.length) return thread;
    return { scopeKey: event.scopeKey, messages: [
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
  return { scopeKey: event.destination?.key ?? thread.scopeKey, messages };
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
