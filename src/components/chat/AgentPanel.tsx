"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SendIcon, SparklesIcon } from "@/components/icons";
import { FrontDoor, isStarterPrompt } from "@/components/front-door/FrontDoor";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import {
  surfaceAppById,
  surfaceAppForPath,
  surfaceApps,
  type SurfaceApp,
} from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface, type DemoProfile } from "@/lib/demo-profiles";
import { useAssessment } from "@/components/onboarding/use-assessment";
import { ASSESSMENT_FINDINGS, findingsForScope } from "@/lib/onboarding/assessment";
import { RETURNING_WORK, type ReturningWork } from "@/lib/workspace/returning-work";
import { useOpenWork } from "@/components/workspace/RecentWorkList";
import { ConversationStore, type ConversationEvent } from "@/lib/chat/conversation";
import { nextFrame, scrollToEntry, waitForMotion } from "@/lib/motion";
import styles from "./AgentPanel.module.css";

type Scope = {
  key: string;
  label: string;
  greeting: string;
  suggestions: readonly string[];
};

const HOME_SCOPE: Scope = {
  key: "home",
  label: "Front Door",
  greeting:
    "Tell me what you’re trying to accomplish. I’ll help you start here, then take you to the right app when the work needs a dedicated workspace.",
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
    greeting: `Now working in ${surface.label}. ${surface.workspaceDescription}`,
    suggestions: surface.capabilities.map((c) => c),
  };
}

function scopeForPath(pathname: string): Scope {
  const surface = surfaceAppForPath(pathname);
  return surface ? scopeForSurface(surface) : HOME_SCOPE;
}

function recommendApp(text: string, profile: DemoProfile): SurfaceApp {
  const normalized = text.toLowerCase();
  const preferredId = /deploy|release|pipeline|work item|lifecycle/.test(normalized)
    ? "alm"
    : /code|react|apex|lwc|test|debug|source/.test(normalized)
      ? "code"
      : /security|permission|monitor|observe|health|trust|govern/.test(normalized)
        ? "govern"
        : "build";
  const available = surfaceApps.filter((surface) => canAccessSurface(profile, surface.id));
  return available.find((surface) => surface.id === preferredId) ?? available[0]!;
}

const SURFACE_QUESTIONS: Record<SurfaceApp["id"], string> = {
  build: "What would you like to build or set up? I can help with your data, automations, agents, or app experiences.",
  code: "What would you like to work on in Code? We can write or review code, build a query, or investigate a failing test.",
  alm: "What would you like to move forward in ALM? We can plan work, review a release, or investigate a deployment.",
  govern: "What would you like to review in Govern & Observe? I can help with access, platform health, or policy controls.",
};

/** One transcript per project/worktree, shared by Today and every surface. */
export function AgentPanel({ homeRequest, waitForLayout, layoutKey }: {
  homeRequest: number;
  waitForLayout: (signal: AbortSignal) => Promise<void>;
  layoutKey: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useDemoProfile();
  const baseScope = scopeForPath(pathname);
  const isHome = baseScope.key === HOME_SCOPE.key;
  const returning = profile?.workspaceExperience === "established";
  const dayZero = profile?.onboarding === "org-assessment";

  const { activeProject, activeWorktree, activeOrg, agentSessions, sessionKey, hasProjects } = useWorkspace();
  const { state: assessment } = useAssessment();
  const improvement = profile?.onboarding ? assessment.projects.find((project) => project.id === activeProject.id) : undefined;
  const returningSession = profile?.workspaceExperience === "established"
    ? activeProject.agentSessions.find((session) => session.worktreeId === activeWorktree.id)
    : undefined;
  const scope: Scope = improvement ? {
    ...baseScope,
    greeting: `“${improvement.name}” has ${improvement.workItems.length} planned work items. Each includes the source finding, implementation steps, and acceptance criteria. Start by reviewing a plan and confirming the baseline in a sandbox.`,
    suggestions: ["What should I work on first?", "Walk through the project plan", "How will we validate the improvements?"],
  } : profile?.onboarding ? {
    ...baseScope,
    greeting: assessment.status === "complete" ? `Your demo assessment found ${findingsForScope(assessment.scopeOrgIds).length} opportunities. Return home to review the evidence and turn selected findings into a project.` : "Your demo assessment is underway. It reviews the selected accessible orgs for capacity, process friction, and release readiness. You can follow its progress on the home screen.",
    suggestions: ["What does the assessment cover?", "How do I create a project?"],
  } : returningSession ? {
    ...baseScope,
    greeting: returningSession.summary,
    suggestions: returningSession.status === "waiting"
      ? ["Summarize the pending approval", "Walk through the release plan", "What should I review first?"]
      : ["Summarize the current changes", "What still needs review?", "Plan the next step"],
  } : baseScope;
  const showWorktree = activeProject.worktrees.length > 1;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[sessionKey] ?? "";
  function setDraft(value: string | ((current: string) => string)) {
    setDrafts((current) => ({ ...current, [sessionKey]: typeof value === "function" ? value(current[sessionKey] ?? "") : value }));
  }
  const [conversationStore] = useState(() => new ConversationStore());
  const { sessions, scrollRevision, presentation } = useSyncExternalStore(conversationStore.subscribe, conversationStore.getSnapshot, conversationStore.getSnapshot);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sequence = useRef<AbortController | null>(null);
  const openWork = useOpenWork();
  const thread = sessions[sessionKey]?.messages ?? [];

  function applyEvent(event: ConversationEvent) {
    conversationStore.dispatch(sessionKey, event, { deferReveal: !!sessions[sessionKey]?.messages.length });
  }

  // Route changes are external navigation events. Read the latest workspace
  // data at that moment, without appending a briefing on every data update.
  const visit = useEffectEvent(() => {
    if (!profile) return;
    if (isHome) {
      applyEvent({ type: "today", snapshot: {
        capturedAt: new Date().toISOString(), profile,
        projectName: activeProject.name, branch: activeWorktree.branch, hasProjects,
        recent: RETURNING_WORK.filter((work) => work.projectId === activeProject.id && work.worktreeId === activeWorktree.id),
        working: agentSessions.filter((session) => session.worktreeId === activeWorktree.id && session.status === "working").length,
        assessment,
      } });
    } else {
      const question = SURFACE_QUESTIONS[baseScope.key as SurfaceApp["id"]];
      applyEvent({ type: "surface", scopeKey: scope.key, label: scope.label,
        reply: !sessions[sessionKey]?.messages.some((message) => message.role === "agent") && (returningSession || profile.onboarding)
          ? `${scope.greeting}\n\n${question}` : question,
      });
    }
  });
  useEffect(() => { visit(); }, [sessionKey, scope.key, homeRequest]);

  // The current assessment remains interactive. Its last visible state is
  // retained when that Today entry becomes history; old cards never rescan.
  const recordAssessment = useEffectEvent(() => {
    if (!isHome || !dayZero) return;
    conversationStore.recordAssessment(sessionKey, assessment);
  });
  useEffect(() => { recordAssessment(); }, [assessment, isHome, sessionKey]);

  useEffect(() => {
    if (isHome && ["#agent-composer", "#front-door-composer"].includes(window.location.hash)) composerRef.current?.focus();
  }, [isHome]);

  // The shell owns the layout animations. The transcript waits on their real
  // completion, scrolls on its own timeline, then reveals the pending entries.
  // A new navigation cancels this sequence, so an old completion cannot pull
  // the chat back to a destination the user has already left.
  useEffect(() => {
    const pending = conversationStore.getSnapshot().presentation;
    if (!pending || pending.sessionKey !== sessionKey || pending.scopeKey !== scope.key) return;
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

  function interruptScroll() {
    const pending = conversationStore.getSnapshot().presentation;
    if (pending?.phase !== "scrolling") return;
    sequence.current?.abort();
    conversationStore.advancePresentation(pending.revision, "complete");
  }

  function explore(surface: SurfaceApp) {
    applyEvent({ type: "surface", scopeKey: surface.id, label: surface.label, reply: SURFACE_QUESTIONS[surface.id], force: true });
  }

  function resumeWork(work: ReturningWork) {
    const surface = surfaceAppById(work.surfaceId);
    applyEvent({ type: "surface", scopeKey: surface.id, label: surface.label, force: true,
      reply: `I’ve opened “${work.title}”. ${work.summary} ${work.attention ? "Let’s review what needs your decision." : "What would you like to do next?"}`,
    });
    openWork(work);
  }

  function seedPrompt(prompt: string) {
    setDraft((current) => current.trim() && !isStarterPrompt(current) ? `${current.trim()}\n\n${prompt}` : prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    if (!profile) return;
    const destination = isHome || isStarterPrompt(value) ? recommendApp(value, profile) : null;

    const projectFindings = improvement?.workItems.flatMap((item) => {
      const finding = ASSESSMENT_FINDINGS.find((finding) => finding.id === item.findingId);
      return finding ? [{ item, finding }] : [];
    }) ?? [];
    const first = projectFindings.find(({ item }) => item.status !== "done");
    const reply = improvement
      ? /validat|success|test|acceptance/i.test(value)
        ? projectFindings.map(({ finding }) => `${finding.title}: ${finding.validation}`).join("\n\n")
        : /plan|steps/i.test(value)
          ? projectFindings.map(({ finding }) => `${finding.title}\n${finding.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`).join("\n\n")
          : first ? `Start with “${first.item.title}” (${first.item.priority.toLowerCase()} priority). ${first.finding.steps[0]} Open its work item plan to review the remaining steps. This demo tracks the plan; it does not execute org changes.`
            : "All work items are marked complete. Review the acceptance criteria and the sandbox validation evidence before planning a release."
      : profile.onboarding
        ? /project/i.test(value) ? "Return to the home assessment, select the opportunities you want to address, and choose Shape a project. Review its goal, sandbox, and work item plans, then choose Create project."
          : "The demo assessment reviews usage and limits, automation failures, and release readiness for your selected orgs. Each finding includes sample evidence and an approach to investigate. Review the scope and findings on the home screen."
      : destination
      ? `I’d start this in ${destination!.label}. I’ll carry your goal and the context we establish here into that workspace.`
      : !hasProjects
        ? `This is a wireframe response scoped to ${scope.label}. In the full experience I’d help you establish the project context as we begin.`
        : `This is a wireframe response scoped to ${scope.label}, working in ${activeProject.name}${
            showWorktree ? ` · ${activeWorktree.label}` : ""
          } against ${activeOrg.label}. In the full experience I’d act on this using ${scope.label}’s tools while keeping that context.`;

    applyEvent({ type: "send", text: value, reply,
      destination: destination ? { key: destination.id, label: destination.label } : undefined,
    });
    setDraft("");
    if (destination) router.push(destination.href, { scroll: false });
  }

  return (
    <section className={styles.agent} data-view={isHome ? "home" : "surface"} data-motion={presentation?.phase ?? "idle"} aria-label="Agent">
      <header className={styles.heading}>
        <span className={styles.avatar} aria-hidden="true"><SparklesIcon width={18} height={18} /></span>
        <h1>Agent</h1>
        <span className={styles.scopeChip}>{isHome ? "Today" : scope.label}</span>
      </header>
      <div className={styles.transcript} ref={transcriptRef} role="log" aria-label="Conversation" aria-live="polite"
        onWheel={interruptScroll}
        onTouchStart={interruptScroll}
        onPointerDown={interruptScroll}
        onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) interruptScroll(); }}>
        <div className={styles.thread} ref={threadRef}>
          {thread.map((message, index) => {
            const pending = presentation?.sessionKey === sessionKey && presentation.phase !== "revealing" && message.id > presentation.afterId;
            return <div aria-hidden={pending || undefined} inert={pending} data-pending={pending || undefined} key={`${sessionKey}:${message.id}`} className={styles.entry} data-message-id={message.id} data-kind={message.role}>
            {message.role === "today" ? <article className={styles.todaySection} aria-label="Today briefing">
              <header className={styles.todayHeader}>
                <span><SparklesIcon width={15} height={15} aria-hidden="true" /><strong>Today</strong></span>
                <time dateTime={message.snapshot.capturedAt} title={new Date(message.snapshot.capturedAt).toLocaleString()}>
                  {new Date(message.snapshot.capturedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}{new Date(message.snapshot.capturedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </time>
              </header>
              <FrontDoor snapshot={message.snapshot} active={isHome && index === thread.length - 1} onSeedPrompt={seedPrompt} onExplore={explore} onOpenWork={resumeWork} />
            </article> : message.role === "context" ? <div className={styles.contextMarker}><span>{message.text}</span></div>
              : <div className={`${styles.message} ${styles[message.role]}`}><div className={styles.bubble}>{message.text}</div></div>}
            {index === thread.length - 1 && message.role !== "today" && <>
              <div className={styles.suggestions} aria-label="Suggested prompts">
                {scope.suggestions.map((prompt) => <button key={prompt} type="button" onClick={() => send(prompt)}>{prompt}</button>)}
              </div>
              <p className={styles.prototypeNote}>The prototype is not connected to a model yet.</p>
            </>}
          </div>})}
        </div>
      </div>

      {/* This form is never keyed, swapped, or faded. Its bounds follow the
          panel's width, retaining the textarea node, selection, and draft. */}
      <div className={styles.composerDock}>
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); send(); }}>
          <label className={styles.srOnly} htmlFor="agent-composer">Message the agent</label>
          <textarea
            id="agent-composer"
            ref={composerRef}
            rows={2}
            value={draft}
            placeholder={isHome
              ? dayZero ? "Ask about an opportunity, explore a plan, or start something new…"
                : returning ? "Ask about your work, plan a change, or start something new…"
                : "Describe an idea, ask a question, or tell me what you want to build…"
              : `Ask about ${scope.label}…`}
            aria-describedby="agent-composer-hint"
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
            <button className={styles.send} type="submit" disabled={!draft.trim()} aria-label="Send message"><SendIcon width={18} height={18} aria-hidden="true" /></button>
          </div>
        </form>
      </div>
    </section>
  );
}
