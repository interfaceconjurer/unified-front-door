"use client";

import { useCallback, useMemo, useEffect, useLayoutEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FeatureBoundary } from "@/components/interaction/FeatureBoundary";
import { SendIcon, SparklesIcon } from "@/components/icons";
import { isStarterPrompt } from "@/components/front-door/FrontDoor";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import {
  surfaceAppForPath,
  type SurfaceApp,
} from "@/components/front-door/app-catalog";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useAssessment } from "@/components/onboarding/use-assessment";
import { type ReturningWork } from "@/lib/workspace/returning-work";
import { useOpenWork } from "@/components/workspace/RecentWorkList";
import { editComposerDraft, type ComposerDraftState } from "@/lib/chat/composer-drafts";
import { ConversationStore, type Message } from "@/lib/chat/conversation";
import { applicationClient } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";
import { activeRun, type AgentContext } from "@/lib/agent/contracts";
import { nextFrame, scrollToEntry, waitForMotion } from "@/lib/motion";
import { Transcript } from "./Transcript";
import styles from "./AgentPanel.module.css";

const SUGGESTIONS_0 = ["What should I work on first?", "Walk through the project plan", "How will we validate the improvements?"];

const SUGGESTIONS_1 = ["What does the assessment cover?", "How do I create a project?"];

const SUGGESTIONS_2 = ["Summarize the pending approval", "Walk through the release plan", "What should I review first?"];

const SUGGESTIONS_3 = ["Summarize the current changes", "What still needs review?", "Plan the next step"];

const EMPTY_THREAD: Message[] = [];

type Scope = {
  key: string;
  label: string;
  suggestions: readonly string[];
};

const HOME_SCOPE: Scope = {
  key: "home",
  label: "Front Door",
  suggestions: [
    "Help me build an automation",
    "Find why my deployment failed",
    "Review my org’s security posture",
  ],
};

function scopeForSurface(surface: SurfaceApp): Scope {
  return {
    key: surface.id,
    label: surface.label,
    suggestions: surface.capabilities,
  };
}

function scopeForPath(pathname: string): Scope {
  const surface = surfaceAppForPath(pathname);
  return surface ? scopeForSurface(surface) : HOME_SCOPE;
}

/** One transcript per project/worktree, shared by Today and every surface. */
export function AgentPanel({ homeRequest, waitForLayout, layoutKey }: {
  homeRequest: number;
  waitForLayout: (signal: AbortSignal) => Promise<void>;
  layoutKey: string;
}) {
  const pathname = usePathname();
  const { navigateSurface, captureIntent } = useNavigationActions();
  const { profile } = useDemoProfile();
  const baseScope = scopeForPath(pathname);
  const isHome = baseScope.key === HOME_SCOPE.key;
  const returning = profile?.workspaceExperience === "established";
  const dayZero = profile?.onboarding === "org-assessment";

  const { activeProject, activeWorktree, sessionKey, target, projects } = useWorkspace();
  const { state: assessment } = useAssessment();
  const improvement = profile?.onboarding ? assessment.projects.find((project) => project.id === activeProject?.id) : undefined;
  const returningSession = profile?.workspaceExperience === "established"
    ? activeProject?.agentSessions.find((session) => session.worktreeId === activeWorktree?.id)
    : undefined;
  const scope: Scope = improvement ? {
    ...baseScope,
    suggestions: SUGGESTIONS_0,
  } : profile?.onboarding ? {
    ...baseScope,
    suggestions: SUGGESTIONS_1,
  } : returningSession ? {
    ...baseScope,
    suggestions: returningSession.status === "waiting"
      ? SUGGESTIONS_2
      : SUGGESTIONS_3,
  } : baseScope;
  useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const agent = applicationClient.agent ?? inactiveAgent;
  const remote = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  const capturedContext = useMemo<AgentContext>(() => ({ target, surface: baseScope.key as AgentContext["surface"] }), [target, baseScope.key]);
  useEffect(() => { agent.start(); }, [agent]);
  useEffect(() => { agent.setThread(sessionKey); }, [agent, sessionKey]);

  const [draftState, setDraftState] = useState<ComposerDraftState>({ drafts: {}, problem: "" });
  const { drafts, problem: composerProblem } = draftState;
  useEffect(() => {
    let previous = agent.getSnapshot().acknowledged;
    return agent.subscribe(() => {
      const acknowledged = agent.getSnapshot().acknowledged;
      if (acknowledged === previous) return;
      previous = acknowledged;
      const command = acknowledged?.command;
      if (command?.kind !== "submit") return;
      const { projectId, worktreeId, orgId } = command.context.target;
      const key = projectId ? JSON.stringify(["project-session", projectId, worktreeId]) : JSON.stringify(["unbound-session", orgId]);
      setDraftState(current => current.drafts[key]?.trim() === command.text ? editComposerDraft(current, key, "") : current);
    });
  }, [agent]);
  const draft = drafts[sessionKey] ?? "";
  const setDraft = useCallback((value: string | ((current: string) => string)) => {
    setDraftState(current => {
      const text = typeof value === "function" ? value(current.drafts[sessionKey] ?? "") : value;
      return editComposerDraft(current, sessionKey, text);
    });
  }, [sessionKey]);
  const [conversationStore] = useState(() => new ConversationStore());
  const { sessions, scrollRevision, presentation } = useSyncExternalStore(conversationStore.subscribe, conversationStore.getSnapshot, conversationStore.getSnapshot);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerSelections = useRef(new Map<string, { start: number; end: number; direction: "forward" | "backward" | "none" }>());
  useLayoutEffect(() => {
    const node = composerRef.current, saved = composerSelections.current.get(sessionKey);
    if (node && saved) node.setSelectionRange(saved.start, saved.end, saved.direction);
  }, [sessionKey]);
  const sequence = useRef<AbortController | null>(null);
  const followingReply = useRef<{ key: string; following: boolean; pausedAt: number | null }>({ key: "", following: true, pausedAt: null });
  const openWork = useOpenWork();
  const thread = sessions[sessionKey]?.messages ?? EMPTY_THREAD;
  const [historyEnds, setHistoryEnds] = useState<Record<string, number | null>>({});
  const selectedEnd = historyEnds[sessionKey];
  const endIndex = selectedEnd == null ? thread.length : Math.max(1, thread.findIndex(message => message.id === selectedEnd) + 1);
  const startIndex = Math.max(0, endIndex - 40);
  const visibleThread = useMemo(() => thread.slice(startIndex, endIndex), [thread, startIndex, endIndex]);
  function showPage(end: number | null) {
    interruptScroll();
    setHistoryEnds(current => ({ ...current, [sessionKey]: end }));
  }


  useEffect(() => {
    for (const saved of remote.data.conversations) conversationStore.adopt(saved.threadKey, saved.conversation, saved.threadKey === sessionKey);
  }, [remote.data.conversations, conversationStore, sessionKey]);

  const visit = useEffectEvent(() => {
    if (!profile || !remote.ready) return;
    void agent.command({ kind: "visit", requestId: crypto.randomUUID(), context: capturedContext });
  });
  useEffect(() => { visit(); }, [agent, remote.ready, sessionKey, scope.key, homeRequest]);

  useEffect(() => {
    if (isHome && ["#agent-composer", "#front-door-composer"].includes(window.location.hash)) composerRef.current?.focus();
  }, [isHome]);

  // The shell owns the layout animations. The transcript waits on their real
  // completion, scrolls on its own timeline, then reveals the pending entries.
  // A new navigation cancels this sequence, so an old completion cannot pull
  // the chat back to a destination the user has already left.
  useEffect(() => {
    const pending = conversationStore.getSnapshot().presentation;
    // Submitted work keeps its captured scope even when newer navigation wins.
    // Reveal its history in the current thread using the current layout timeline.
    if (!pending || pending.sessionKey !== sessionKey) return;
    const controller = new AbortController();
    const { signal } = controller;
    sequence.current = controller;
    async function present() {
      await waitForLayout(signal);
      const container = transcriptRef.current;
      if (!container) return;
      container.style.setProperty("--transcript-height", `${container.clientHeight}px`);
      const messages = conversationStore.getSnapshot().sessions[sessionKey]?.messages ?? [];
      const last = messages.at(-1);
      const previous = messages.at(-2);
      const anchor = last?.role === "agent" && (previous?.role === "user" || previous?.role === "context") ? previous : last;
      const entry = container.querySelector<HTMLElement>(`[data-message-id="${anchor?.id}"]`);
      conversationStore.advancePresentation(pending!.revision, "scrolling");
      await nextFrame(signal);
      if (entry) await scrollToEntry(container, entry, signal);
      conversationStore.advancePresentation(pending!.revision, "revealing");
      await waitForMotion(() => Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"))
        .filter((element) => Number(element.dataset.messageId) > pending!.afterId)
        .flatMap((element) => element.getAnimations()), signal);
      conversationStore.advancePresentation(pending!.revision, "complete");
    }
    void present().catch((error) => {
      if (!signal.aborted) {
        conversationStore.advancePresentation(pending.revision, "complete");
        console.error("Could not complete the conversation transition", error);
      }
    });
    return () => { controller.abort(); };
  }, [scrollRevision, sessionKey, scope.key, layoutKey, waitForLayout, conversationStore]);

  // Measurement only: resizing must never snap to the incoming message.
  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      container.style.setProperty("--transcript-height", `${container.clientHeight}px`);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Grow the current reply into view without replaying the turn transition.
  // Once the reader scrolls away, incoming text must not pull them back.
  const followReply = useEffectEvent(() => {
    const container = transcriptRef.current, last = visibleThread.at(-1);
    if (!container || selectedEnd != null || last?.role !== "agent" || !last.runId) return;
    const key = `${sessionKey}:${last.runId}`;
    const run = remote.data.runs.find(run => run.id === last.runId);
    if (!run || !activeRun(run.status) && followingReply.current.key !== key) return;
    if (followingReply.current.key !== key) followingReply.current = { key, following: true, pausedAt: null };
    if (!followingReply.current.following || presentation && presentation.phase !== "revealing") return;
    const bubble = container.querySelector<HTMLElement>(`[data-message-id="${last.id}"] .${styles.bubble}`);
    if (!bubble) return;
    const overflow = bubble.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom + 12;
    if (overflow > 0) container.scrollTop += overflow;
  });
  useLayoutEffect(() => { followReply(); }, [visibleThread, selectedEnd, sessionKey, presentation, remote.data.runs]);
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const observer = new ResizeObserver(() => followReply());
    observer.observe(thread);
    return () => observer.disconnect();
  }, []);

  function trackReplyScroll() {
    const container = transcriptRef.current, last = visibleThread.at(-1);
    if (!container || last?.role !== "agent") return;
    const bubble = container.querySelector<HTMLElement>(`[data-message-id="${last.id}"] .${styles.bubble}`);
    // A queued event from our last automatic scroll can arrive after a wheel
    // or pointer interruption. Only a subsequent position change can resume.
    const pausedAt = followingReply.current.pausedAt;
    if (pausedAt !== null && Math.abs(container.scrollTop - pausedAt) < 1) return;
    if (bubble) {
      const atReply = Math.abs(bubble.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom) < 48;
      const returningToEnd = pausedAt === null || container.scrollTop > pausedAt;
      followingReply.current.following = atReply && returningToEnd;
      followingReply.current.pausedAt = followingReply.current.following ? null : container.scrollTop;
    }
  }

  function interruptScroll() {
    followingReply.current.following = false;
    followingReply.current.pausedAt = transcriptRef.current?.scrollTop ?? null;
    const pending = conversationStore.getSnapshot().presentation;
    if (pending?.phase !== "scrolling") return;
    sequence.current?.abort();
    conversationStore.advancePresentation(pending.revision, "complete");
  }

  const resumeWork = useCallback((work: ReturningWork) => {
    const project = projects.find(project => project.id === work.projectId);
    void agent.command({ kind: "visit", requestId: crypto.randomUUID(), workId: work.id,
      context: { surface: work.surfaceId, target: { projectId: work.projectId, worktreeId: work.worktreeId, orgId: project?.defaultOrgId ?? null } } });
    openWork(work);
  }, [projects, agent, openWork]);

  const seedPrompt = useCallback((prompt: string) => {
    setDraft((current) => current.trim() && !isStarterPrompt(current) ? `${current.trim()}\n\n${prompt}` : prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [setDraft]);

  const sendText = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || !profile || remote.pending || !remote.ready) return;
    const navigationIsCurrent = captureIntent();
    const receipt = await agent.command({ kind: "submit", requestId: crypto.randomUUID(), context: capturedContext, text: value });
    if (!receipt) return;
    if (receipt.destination && navigationIsCurrent()) navigateSurface(receipt.destination, "overview");
  }, [profile, remote.pending, remote.ready, captureIntent, agent, capturedContext, navigateSurface]);
  const issueCommand = useCallback((command: Parameters<typeof agent.command>[0]) => { void agent.command(command); }, [agent]);
  function send() { void sendText(draft); }

  return (
    <section className={styles.agent} data-view={isHome ? "home" : "surface"} data-motion={presentation?.phase ?? "idle"} aria-label="Agent">
      <header className={styles.heading}>
        <span className={styles.avatar} aria-hidden="true"><SparklesIcon width={18} height={18} /></span>
        <h1>Agent</h1>
        <span className={styles.scopeChip}>{isHome ? "Today" : scope.label}</span>
      </header>
      <div className={styles.transcript} ref={transcriptRef} role="log" aria-label="Conversation" aria-live="polite"
        onScroll={trackReplyScroll}
        onWheel={interruptScroll}
        onTouchStart={interruptScroll}
        onPointerDown={interruptScroll}
        onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) interruptScroll(); }}>
        <FeatureBoundary label="Conversation" resetKey={sessionKey}>
        {!remote.ready && !remote.error && <p role="status">Loading conversation…</p>}
        {thread.length > 40 && <nav aria-label="Conversation history">
          <button type="button" disabled={startIndex === 0} onClick={() => showPage(thread[startIndex - 1]!.id)}>Older messages</button>
          <span role="status">Messages {startIndex + 1}–{endIndex} of {thread.length}</span>
          <button type="button" disabled={endIndex === thread.length} onClick={() => showPage(endIndex + 40 >= thread.length ? null : thread[endIndex + 39]!.id)}>Newer messages</button>
          {endIndex < thread.length && <button type="button" onClick={() => showPage(null)}>Latest messages</button>}
        </nav>}
        <div className={styles.thread} ref={threadRef}>
          <Transcript messages={visibleThread} startIndex={startIndex} total={thread.length} sessionKey={sessionKey} isHome={isHome}
            presentation={presentation} runs={remote.data.runs} suggestions={scope.suggestions} seedPrompt={seedPrompt}
            resumeWork={resumeWork} send={sendText} command={issueCommand} />
        </div></FeatureBoundary>
      </div>

      {/* This form is never keyed, swapped, or faded. Its bounds follow the
          panel's width, retaining the textarea node, selection, and draft. */}
      <div className={styles.composerDock}>
        {composerProblem && <p role="status">{composerProblem}</p>}
        {remote.error && <div role="status" className={styles.requestError}>{remote.error}
          {remote.recovery !== null ? <>
            <button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([remote.recovery!], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = "agent-request-recovery.txt"; link.click(); URL.revokeObjectURL(url); }}>Export saved request</button>
            <button type="button" onClick={agent.discardRecovery}>Discard unreadable request</button>
          </> : <button type="button" onClick={agent.retry}>{remote.pending ? "Retry request" : "Reconnect agent"}</button>}
        </div>}
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); send(); }}>
          <label className={styles.srOnly} htmlFor="agent-composer">Message the agent</label>
          <textarea
            id="agent-composer"
            ref={composerRef}
            rows={2}
            maxLength={8000}
            value={draft}
            placeholder={isHome
              ? dayZero ? "Ask about an opportunity, explore a plan, or start something new…"
                : returning ? "Ask about your work, plan a change, or start something new…"
                : "Describe an idea, ask a question, or tell me what you want to build…"
              : `Ask about ${scope.label}…`}
            aria-describedby="agent-composer-hint"
            onSelect={(event) => { const node = event.currentTarget; composerSelections.current.set(sessionKey, { start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection }); }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className={styles.composerTools}>
            <span className={styles.agentLabel}><SparklesIcon width={16} height={16} aria-hidden="true" />Agent</span>
            <span id="agent-composer-hint" className={styles.composerHint}>Enter to send · Shift + Enter for a new line</span>
            <button className={styles.send} type="submit" disabled={!draft.trim() || !remote.ready || remote.pending} aria-label="Send message"><SendIcon width={18} height={18} aria-hidden="true" /></button>
          </div>
        </form>
      </div>
    </section>
  );
}
