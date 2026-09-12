"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SendIcon, SparklesIcon } from "@/components/icons";
import { FrontDoor, isStarterPrompt } from "@/components/front-door/FrontDoor";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import {
  surfaceAppForPath,
  surfaceApps,
  type SurfaceApp,
} from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface, type DemoProfile } from "@/lib/demo-profiles";
import { useAssessment } from "@/components/onboarding/use-assessment";
import { ASSESSMENT_FINDINGS, findingsForScope } from "@/lib/onboarding/assessment";
import styles from "./AgentPanel.module.css";

type Message =
  | { id: number; role: "agent" | "user"; text: string }
  | { id: number; role: "context"; text: string };

// The one agent, described by wherever the workspace is currently pointed. The
// front door is the high-level scope; each surface narrows it. Everything the
// panel renders — heading, context chip, suggested prompts, composer — reads off
// this so moving between surfaces visibly re-points the same agent.
type Scope = {
  key: string;
  label: string;
  heading: string;
  intro: string;
  greeting: string;
  suggestions: readonly string[];
};

const HOME_SCOPE: Scope = {
  key: "home",
  label: "Front Door",
  heading: "What do you want to accomplish?",
  intro: "Start with an outcome. I’ll help you find the right app and carry the work there.",
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
    // Deliberately surface-agnostic: the surface itself owns the domain title
    // and the primary messaging (see SurfaceProjection's <h1>). The agent is a
    // constant companion that follows you across surfaces, so its heading must
    // not restate the surface's name or compete with it for prominence. Which
    // surface it's pointed at is carried, quietly, by the scope chip below.
    heading: "How can I help?",
    intro:
      "The same agent, wherever you go — your project and context come with you as you move between surfaces.",
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

// The greeting that seeds a brand-new thread. Fixed id so it's stable across a
// session; appended messages take ids from the running counter (>= 1).
function seedThread(scope: Scope): Message[] {
  return [{ id: 0, role: "agent", text: scope.greeting }];
}

/**
 * The persistent, agent-forward left panel — the same agent on the front door
 * and inside every surface, and it never unmounts across navigation.
 *
 * Its thread is bound to the active {project, worktree} session: switching
 * worktree (or project) swaps to that session's own thread, the way parallel
 * Herdr worktrees each carry their own agent. Moving between *surfaces* within a
 * session keeps the thread and just drops a context marker. Workspace context
 * remains in the status bar, while the front door occupies the agent's stream.
 *
 * Interaction is a wireframe: sending appends the message and a scope-aware
 * canned reply. A message sent from the front door opens a matching surface.
 */
export function AgentPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useDemoProfile();
  const baseScope = scopeForPath(pathname);
  const isHome = baseScope.key === HOME_SCOPE.key;
  const returning = profile?.workspaceExperience === "established";
  const dayZero = profile?.onboarding === "org-assessment";

  const { activeProject, activeWorktree, activeOrg, sessionKey, hasProjects } = useWorkspace();
  const { state: assessment } = useAssessment();
  const improvement = profile?.onboarding ? assessment.projects.find((project) => project.id === activeProject.id) : undefined;
  const returningSession = profile?.workspaceExperience === "established"
    ? activeProject.agentSessions.find((session) => session.worktreeId === activeWorktree.id)
    : undefined;
  const scope: Scope = improvement ? {
    ...baseScope,
    heading: "Let’s put the plan to work.",
    intro: "Your assessment, evidence, and next steps stay with this project.",
    greeting: `“${improvement.name}” has ${improvement.workItems.length} planned work items. Each includes the source finding, implementation steps, and acceptance criteria. Start by reviewing a plan and confirming the baseline in a sandbox.`,
    suggestions: ["What should I work on first?", "Walk through the project plan", "How will we validate the improvements?"],
  } : profile?.onboarding ? {
    ...baseScope,
    heading: "Let’s find your first improvement.",
    intro: "Your org assessment is the starting point for a practical plan.",
    greeting: assessment.status === "complete" ? `Your demo assessment found ${findingsForScope(assessment.scopeOrgIds).length} opportunities. Return home to review the evidence and turn selected findings into a project.` : "Your demo assessment is underway. It reviews the selected accessible orgs for capacity, process friction, and release readiness. You can follow its progress on the home screen.",
    suggestions: ["What does the assessment cover?", "How do I create a project?"],
  } : returningSession ? {
    ...baseScope,
    heading: "Let’s pick it up.",
    intro: "Your agent session follows the project and branch you’re working in.",
    greeting: returningSession.summary,
    suggestions: returningSession.status === "waiting"
      ? ["Summarize the pending approval", "Walk through the release plan", "What should I review first?"]
      : ["Summarize the current changes", "What still needs review?", "Plan the next step"],
  } : baseScope;
  const showWorktree = activeProject.worktrees.length > 1;

  const [draft, setDraft] = useState("");
  // Home and surfaces share this store and the same composer. A session is
  // seeded when first used, so visiting home doesn't capture a stale greeting.
  const [sessions, setSessions] = useState<Record<string, Message[]>>({});
  const nextId = useRef(1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const thread = sessions[sessionKey] ?? seedThread(scope);

  // Preserve existing home-composer deep links as well as the shared id.
  useEffect(() => {
    if (isHome && ["#agent-composer", "#front-door-composer"].includes(window.location.hash)) {
      composerRef.current?.focus();
    }
  }, [isHome]);

  // Two transitions to handle, both guarded on refs so they fire on change only:
  // Switching project/worktree selects its own thread. Surface changes within
  // a session add a coalesced context marker; home doesn't append to the thread.
  const prevSession = useRef(sessionKey);
  const prevScope = useRef(scope.key);
  useEffect(() => {
    const sessionChanged = prevSession.current !== sessionKey;
    const scopeChanged = prevScope.current !== scope.key;
    prevSession.current = sessionKey;
    prevScope.current = scope.key;

    if (sessionChanged || isHome) return;
    if (scopeChanged) {
      setSessions((current) => {
        const existing = current[sessionKey];
        if (!existing) return current;
        const marker: Message = {
          id: nextId.current++,
          role: "context",
          text: `Now referencing ${scope.label}`,
        };
        const last = existing[existing.length - 1];
        const next =
          last?.role === "context"
            ? [...existing.slice(0, -1), marker]
            : [...existing, marker];
        return { ...current, [sessionKey]: next };
      });
    }
  }, [sessionKey, scope.key, scope.label, isHome]);

  // Keep the newest content in view as the active thread grows.
  useEffect(() => {
    const el = window.matchMedia("(max-width: 900px)").matches ? conversationRef.current : transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessions, sessionKey, isHome]);

  function seedPrompt(prompt: string) {
    setDraft((current) => current.trim() && !isStarterPrompt(current) ? `${current.trim()}\n\n${prompt}` : prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    if (!profile) return;
    const destination = isHome ? recommendApp(value, profile) : null;

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
      : isHome
      ? `I’d start this in ${destination!.label}. I’ll carry your goal and the context we establish here into that workspace.`
      : !hasProjects
        ? `This is a wireframe response scoped to ${scope.label}. In the full experience I’d help you establish the project context as we begin.`
        : `This is a wireframe response scoped to ${scope.label}, working in ${activeProject.name}${
            showWorktree ? ` · ${activeWorktree.label}` : ""
          } against ${activeOrg.label}. In the full experience I’d act on this using ${scope.label}’s tools while keeping that context.`;

    setSessions((current) => {
      const existing = current[sessionKey] ?? (isHome ? [] : seedThread(scope));
      return {
        ...current,
        [sessionKey]: [
          ...existing,
          { id: nextId.current++, role: "user", text: value },
          { id: nextId.current++, role: "agent", text: reply },
        ],
      };
    });
    setDraft("");
    if (destination) router.push(destination.href);
  }

  return (
    <section className={styles.agent} data-view={isHome ? "home" : "surface"} aria-label="Agent">
      <div className={styles.streamStage}>
        <div className={styles.homeStream} aria-hidden={!isHome} inert={!isHome}>
          <FrontDoor onSeedPrompt={seedPrompt} />
        </div>

        <div className={styles.conversationStream} ref={conversationRef} aria-hidden={isHome} inert={isHome}>
          <header className={styles.heading}>
            <span className={styles.avatar} aria-hidden="true">
              <SparklesIcon width={21} height={21} />
            </span>
            <div className={styles.headingText}>
              <p className={styles.kicker}>Agent</p>
              <h2 id="agent-heading">{scope.heading}</h2>
              <p className={styles.intro}>{scope.intro}</p>
            </div>
          </header>

          <div className={styles.transcript} ref={transcriptRef} role="log" aria-live={isHome ? "off" : "polite"}>
            {thread.map((message) =>
              message.role === "context" ? (
                <div key={message.id} className={styles.contextMarker}>
                  <span>{message.text}</span>
                </div>
              ) : (
                <div key={message.id} className={`${styles.message} ${styles[message.role]}`}>
                  <div className={styles.bubble}>{message.text}</div>
                </div>
              ),
            )}
          </div>

          <div className={styles.suggestions} aria-label="Suggested prompts">
            {scope.suggestions.map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)}>{prompt}</button>
            ))}
          </div>
          <p className={styles.prototypeNote}>The prototype is not connected to a model yet.</p>
        </div>
      </div>

      {/* This form is never keyed, swapped, or faded. Its bounds follow the
          panel's width, retaining the textarea node, selection, and draft. */}
      <div className={styles.composerDock}>
        <div className={styles.conversationHeading} aria-hidden={!isHome}>
          <span>{returning ? "What would you like to work on?" : "Or start with a conversation"}</span>
        </div>
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
