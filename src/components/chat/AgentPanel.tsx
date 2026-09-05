"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, SendIcon, SparklesIcon } from "@/components/icons";
import {
  surfaceAppForPath,
  surfaceApps,
  type SurfaceApp,
} from "@/components/front-door/app-catalog";
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

/**
 * The persistent, agent-forward left panel — the same agent on the front door
 * and inside every surface. It never unmounts across navigation, so its thread
 * carries with you; crossing into a surface drops a context marker into the
 * transcript and re-points the header, making the hand-off visible rather than
 * swapping in a different, smaller agent.
 *
 * Interaction is a wireframe: sending appends the message and a scope-aware
 * canned reply. On the front door it also recommends a surface to jump into.
 */
export function AgentPanel() {
  const pathname = usePathname();
  const scope = scopeForPath(pathname);
  const isHome = scope.key === HOME_SCOPE.key;

  const [draft, setDraft] = useState("");
  // Seeded from whatever scope we mount into, so a deep link opens in-context.
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 1, role: "agent", text: scope.greeting },
  ]);
  const [recommendation, setRecommendation] = useState<SurfaceApp | null>(null);
  const nextId = useRef(2);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // When the scope changes (a surface hand-off), drop a slim marker into the
  // thread so the change is legible — but the header chip and intro carry the
  // scoped messaging, so we don't re-greet. Coalesce: if the last entry is
  // already a marker (you navigated again without saying anything), replace it
  // rather than stacking, so clicking through surfaces doesn't flood the thread.
  // Guarded on a ref so it fires on change only, not first mount.
  const prevScope = useRef(scope.key);
  useEffect(() => {
    if (prevScope.current === scope.key) return;
    prevScope.current = scope.key;
    setRecommendation(null);
    setMessages((current) => {
      const marker: Message = {
        id: nextId.current++,
        role: "context",
        text: `Now referencing ${scope.label}`,
      };
      const last = current[current.length - 1];
      return last?.role === "context"
        ? [...current.slice(0, -1), marker]
        : [...current, marker];
    });
  }, [scope.key, scope.label]);

  // Keep the newest content in view as the thread grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, recommendation]);

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    const reply = isHome
      ? `I’d start this in ${recommendApp(value).label}. I’ll carry your goal and the context we establish here into that workspace.`
      : `This is a wireframe response scoped to ${scope.label}. In the full experience I’d act on this using ${scope.label}’s tools while keeping the context you brought in.`;

    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: value },
      { id: nextId.current++, role: "agent", text: reply },
    ]);
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
        {/* Keyed by scope so it remounts and replays its pulse on every hand-off. */}
        <span key={scope.key} className={styles.scopeChip} aria-live="polite">
          <span className={styles.scopeDot} aria-hidden="true" />
          {scope.label}
        </span>
      </div>

      <div className={styles.transcript} role="log" aria-live="polite">
        {messages.map((message) =>
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
