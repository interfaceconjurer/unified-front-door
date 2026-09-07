"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronRightIcon,
  GitBranchIcon,
  LayersIcon,
  SendIcon,
  SparklesIcon,
} from "@/components/icons";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import { AUTOMATION_PLAN } from "@/components/control-plane/control-plane-fixtures";
import { artifactIsOpen } from "@/components/control-plane/control-plane-model";
import {
  surfaceAppForPath,
  surfaceApps,
  type SurfaceApp,
} from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import styles from "./AgentPanel.module.css";

type Message =
  | { id: number; role: "agent" | "user"; text: string }
  | { id: number; role: "context"; text: string };

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
    heading: "How can I help?",
    intro:
      "I’ll coordinate the work and explain what’s happening; the surface beside me owns the artifact.",
    greeting: `Now working in ${surface.label}. ${surface.workspaceDescription}`,
    suggestions: surface.capabilities.map((capability) => capability),
  };
}

function scopeForPath(pathname: string): Scope {
  const surface = surfaceAppForPath(pathname);
  return surface ? scopeForSurface(surface) : HOME_SCOPE;
}

function recommendApp(text: string): SurfaceApp {
  const normalized = text.toLowerCase();
  if (/deploy|release|pipeline|work item|lifecycle/.test(normalized)) return surfaceApps[3]!;
  if (/code|apex|lwc|test|debug|source/.test(normalized)) return surfaceApps[1]!;
  if (/security|permission|monitor|observe|health|trust|govern/.test(normalized)) {
    return surfaceApps[2]!;
  }
  return surfaceApps[0]!;
}

function seedThread(greeting: string): Message[] {
  return [{ id: 0, role: "agent", text: greeting }];
}

/** Persistent conversational control plane; durable Flow state renders in Build. */
export function AgentPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const scope = scopeForPath(pathname);
  const isHome = scope.key === HOME_SCOPE.key;
  const { state, mode, artifact, dispatch } = useControlPlane();
  const { activeProject, activeWorktree, activeOrg, sessionKey } = useWorkspace();
  const showWorktree = activeProject.worktrees.length > 1;
  const buildJourneyVisible = pathname === "/build" && artifactIsOpen(state.phase);

  const [draft, setDraft] = useState("");
  const [sessions, setSessions] = useState<Record<string, Message[]>>(() => ({
    [sessionKey]: seedThread(scope.greeting),
  }));
  const [recommendation, setRecommendation] = useState<SurfaceApp | null>(null);
  const nextId = useRef(1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const prevSession = useRef(sessionKey);
  const prevScope = useRef(scope.key);
  const thread = sessions[sessionKey] ?? seedThread(scope.greeting);

  useEffect(() => {
    const sessionChanged = prevSession.current !== sessionKey;
    const scopeChanged = prevScope.current !== scope.key;
    prevSession.current = sessionKey;
    prevScope.current = scope.key;

    if (sessionChanged) {
      setRecommendation(null);
      return;
    }
    if (scopeChanged) {
      setRecommendation(null);
      setSessions((current) => {
        const existing = current[sessionKey] ?? seedThread(scope.greeting);
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
  }, [sessionKey, scope.key, scope.label, scope.greeting]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [sessions, sessionKey, recommendation, state.phase]);

  function appendMessages(messages: Omit<Message, "id">[]) {
    setSessions((current) => {
      const existing = current[sessionKey] ?? seedThread(scope.greeting);
      return {
        ...current,
        [sessionKey]: [
          ...existing,
          ...messages.map((message) => ({ ...message, id: nextId.current++ })),
        ],
      };
    });
  }

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    if (
      isHome &&
      state.phase === "orient" &&
      /build.*automation|automation/.test(value.toLowerCase())
    ) {
      appendMessages([{ role: "user", text: value }]);
      setRecommendation(null);
      dispatch({ type: "START_AUTOMATION" });
      setDraft("");
      return;
    }

    const reply = isHome
      ? `I’d start this in ${recommendApp(value).label}. I’ll carry your goal and context into that workspace.`
      : buildJourneyVisible
        ? `I’m referencing ${artifact.name}. Build remains the source of truth for the draft and its preview.`
        : `This prototype is scoped to ${scope.label}, working in ${activeProject.name}${
            showWorktree ? ` · ${activeWorktree.label}` : ""
          } against ${activeOrg.label}.`;

    appendMessages([
      { role: "user", text: value },
      { role: "agent", text: reply },
    ]);
    if (isHome) setRecommendation(recommendApp(value));
    setDraft("");
  }

  if (mode === "focus") {
    return (
      <section className={`${styles.agent} ${styles.agentDock}`} aria-label="Agent">
        <button
          type="button"
          className={styles.dockButton}
          onClick={() => dispatch({ type: "EXIT_FOCUS" })}
          aria-label={
            state.phase === "preview-complete"
              ? "Preview passed. Restore agent"
              : "Restore agent"
          }
        >
          <span className={styles.dockAvatar} aria-hidden="true">
            {state.phase === "preview-complete" ? (
              <CheckIcon width={18} height={18} />
            ) : (
              <SparklesIcon width={18} height={18} />
            )}
          </span>
          <span className={styles.dockLabel}>Agent</span>
          <ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  const heading = state.phase === "proposal" && isHome ? "Let’s shape the automation" : scope.heading;
  const intro =
    state.phase === "proposal" && isHome
      ? "I’ve turned your outcome into a concrete starting plan. Review it before Build owns the draft."
      : scope.intro;
  const hideGenericSuggestions = state.phase === "proposal" || buildJourneyVisible;

  return (
    <section className={styles.agent} aria-label="Agent" aria-labelledby="agent-heading">
      <div className={styles.heading}>
        <span className={styles.avatar} aria-hidden="true">
          <SparklesIcon width={21} height={21} />
        </span>
        <div className={`${styles.headingText} ${isHome ? "" : styles.headingCompact}`}>
          <p className={styles.kicker}>Agent · control plane</p>
          {isHome ? (
            <h1 id="agent-heading">{heading}</h1>
          ) : (
            <h2 id="agent-heading">{heading}</h2>
          )}
          <p className={styles.intro}>{intro}</p>
        </div>

        <div className={styles.contextBar} aria-label="Agent context">
          <span key={scope.key} className={styles.scopeChip}>
            <span className={styles.scopeDot} aria-hidden="true" />
            {scope.label}
          </span>
          <span className={styles.contextChip}>
            <LayersIcon width={13} height={13} aria-hidden="true" />
            {activeProject.name}
          </span>
          {showWorktree && (
            <span className={styles.contextChip}>
              <GitBranchIcon width={13} height={13} aria-hidden="true" />
              {activeWorktree.label}
            </span>
          )}
        </div>
      </div>

      <div className={styles.transcript} ref={transcriptRef} role="log" aria-live="polite">
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

        {state.phase === "proposal" && isHome && (
          <article className={styles.planCard} aria-labelledby="automation-plan-title">
            <p className={styles.cardEyebrow}>Proposed plan</p>
            <h2 id="automation-plan-title">{AUTOMATION_PLAN.title}</h2>
            <p>{AUTOMATION_PLAN.summary}</p>
            <ul>
              {AUTOMATION_PLAN.steps.map((step) => (
                <li key={step}>
                  <CheckIcon width={15} height={15} aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ul>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => {
                  dispatch({ type: "OPEN_ARTIFACT" });
                  router.push("/build");
                }}
              >
                Open in Build
                <ChevronRightIcon width={16} height={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => dispatch({ type: "DISMISS_PROPOSAL" })}
              >
                Not now
              </button>
            </div>
          </article>
        )}

        {buildJourneyVisible && state.phase === "artifact-open" && (
          <article className={styles.referenceCard} aria-labelledby="agent-reference-heading">
            <p className={styles.cardEyebrow}>Opened in Build</p>
            <h3 id="agent-reference-heading" tabIndex={-1}>
              Flow · {artifact.name}
            </h3>
            <p>Build owns this draft. I’ll stay alongside it and point to the decisions we discuss.</p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => dispatch({ type: "REFERENCE_DECISION" })}
            >
              Show the routing decision
              <ChevronRightIcon width={16} height={16} aria-hidden="true" />
            </button>
          </article>
        )}

        {buildJourneyVisible && state.phase === "node-referenced" && (
          <article className={styles.referenceCard} aria-labelledby="agent-reference-heading">
            <p className={styles.cardEyebrow}>Referencing in {artifact.name}</p>
            <h3 id="agent-reference-heading" tabIndex={-1}>
              Decision · High value?
            </h3>
            <p>
              The Yes path assigns Enterprise Queue. The No path preserves the current owner.
            </p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => dispatch({ type: "ENTER_FOCUS" })}
            >
              Enter focus
            </button>
          </article>
        )}

        {buildJourneyVisible && state.phase === "ready" && (
          <article className={styles.completionCard} aria-labelledby="agent-completion-heading">
            <p className={styles.cardEyebrow}>Preview complete</p>
            <h3 id="agent-completion-heading" tabIndex={-1}>
              Route confirmed
            </h3>
            <p>
              Edge Communications followed the Yes path to Enterprise Queue. The Flow remains a
              draft in Build.
            </p>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => dispatch({ type: "RUN_AGAIN" })}
              >
                Run again
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => document.getElementById("flow-artifact-heading")?.focus()}
              >
                Keep working in Build
              </button>
            </div>
          </article>
        )}

        {recommendation && (
          <Link className={styles.recommendation} href={recommendation.href}>
            <span>
              <strong>Open {recommendation.label}</strong>
              <small>{recommendation.description}</small>
            </span>
            <ChevronRightIcon width={19} height={19} />
          </Link>
        )}
      </div>

      <div className={styles.promptArea}>
        {!hideGenericSuggestions && (
          <div className={styles.suggestions} aria-label="Suggested prompts">
            {scope.suggestions.map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className={styles.srOnly} htmlFor="agent-composer">
            Message the agent
          </label>
          <textarea
            id="agent-composer"
            rows={2}
            value={draft}
            placeholder={isHome ? "Describe what you want to build, change, or understand…" : `Ask about ${scope.label}…`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Send message">
            <SendIcon width={19} height={19} />
          </button>
        </form>
        <p className={styles.composerHint}>Prototype journey · no model or org actions are connected.</p>
      </div>
    </section>
  );
}
