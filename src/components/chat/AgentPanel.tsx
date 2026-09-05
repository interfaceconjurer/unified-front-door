"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRightIcon,
  DatabaseIcon,
  GitBranchIcon,
  LayersIcon,
  SendIcon,
  SparklesIcon,
} from "@/components/icons";
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
    heading: `How can I help in ${surface.label}?`,
    intro: `I’ve carried your context into ${surface.label}. Ask me about the work here — I’m the same agent, now scoped to this surface.`,
    greeting: `Now working in ${surface.label}. ${surface.workspaceDescription}`,
    suggestions: surface.capabilities.map((c) => c),
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
  if (/security|permission|monitor|observe|health|trust|govern/.test(normalized)) return surfaceApps[2]!;
  return surfaceApps[0]!;
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
 * session keeps the thread and just drops a context marker. The context bar
 * reflects project / worktree / org, revealed progressively so a simple user
 * with one worktree and one org sees almost none of it.
 *
 * Interaction is a wireframe: sending appends the message and a scope-aware
 * canned reply. On the front door it also recommends a surface to jump into.
 */
export function AgentPanel() {
  const pathname = usePathname();
  const scope = scopeForPath(pathname);
  const isHome = scope.key === HOME_SCOPE.key;

  const { activeProject, activeWorktree, activeEnvironment, sessionKey } = useWorkspace();
  const showWorktree = activeProject.worktrees.length > 1;
  const showEnvironment = activeProject.environments.length > 1;

  const [draft, setDraft] = useState("");
  // One thread per {project, worktree} session, seeded from the mount scope.
  const [sessions, setSessions] = useState<Record<string, Message[]>>(() => ({
    [sessionKey]: seedThread(scope),
  }));
  const [recommendation, setRecommendation] = useState<SurfaceApp | null>(null);
  const nextId = useRef(1);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const thread = sessions[sessionKey] ?? seedThread(scope);

  // Two transitions to handle, both guarded on refs so they fire on change only:
  // switching session (project/worktree) swaps threads — nothing appended, just
  // clear transient UI; moving between surfaces within a session drops a slim,
  // coalesced context marker (the header carries the scoped messaging, so we
  // don't re-greet, and consecutive markers replace rather than stack).
  const prevSession = useRef(sessionKey);
  const prevScope = useRef(scope.key);
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
        const existing = current[sessionKey] ?? [{ id: 0, role: "agent", text: scope.greeting }];
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

  // Keep the newest content in view as the active thread grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessions, sessionKey, recommendation]);

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    const reply = isHome
      ? `I’d start this in ${recommendApp(value).label}. I’ll carry your goal and the context we establish here into that workspace.`
      : `This is a wireframe response scoped to ${scope.label}, working in ${activeProject.name}${
          showWorktree ? ` · ${activeWorktree.label}` : ""
        } against ${activeEnvironment.label}. In the full experience I’d act on this using ${scope.label}’s tools while keeping that context.`;

    setSessions((current) => {
      const existing = current[sessionKey] ?? seedThread(scope);
      return {
        ...current,
        [sessionKey]: [
          ...existing,
          { id: nextId.current++, role: "user", text: value },
          { id: nextId.current++, role: "agent", text: reply },
        ],
      };
    });
    if (isHome) setRecommendation(recommendApp(value));
    setDraft("");
  }

  return (
    <section className={styles.agent} aria-label="Agent" aria-labelledby="agent-heading">
      <div className={styles.heading}>
        <span className={styles.avatar} aria-hidden="true">
          <SparklesIcon width={21} height={21} />
        </span>
        <div className={styles.headingText}>
          <p className={styles.kicker}>Agent</p>
          <h1 id="agent-heading">{scope.heading}</h1>
          <p className={styles.intro}>{scope.intro}</p>
        </div>

        {/* Context bar: what the agent is pointed at. The surface chip is keyed by
            scope so it remounts and replays its pulse on every hand-off; project,
            worktree, and org appear only when they carry meaning. */}
        <div className={styles.contextBar} aria-live="polite">
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
          {showEnvironment && (
            <span className={styles.contextChip}>
              <DatabaseIcon width={13} height={13} aria-hidden="true" />
              {activeEnvironment.label}
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
        <div className={styles.suggestions} aria-label="Suggested prompts">
          {scope.suggestions.map((prompt) => (
            <button key={prompt} type="button" onClick={() => send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

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
            placeholder={
              isHome
                ? "Describe what you want to build, change, or understand…"
                : `Ask about ${scope.label}…`
            }
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
        <p className={styles.composerHint}>
          The prototype routes by intent; it is not connected to a model yet.
        </p>
      </div>
    </section>
  );
}
