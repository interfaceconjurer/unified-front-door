"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  SendIcon,
  SparklesIcon,
} from "@/components/icons";
import { surfaceApps, type SurfaceApp } from "./app-catalog";
import styles from "./FrontDoor.module.css";

type Message = {
  id: number;
  role: "agent" | "user";
  text: string;
};

const suggestedPrompts = [
  "Help me build an automation",
  "Find why my deployment failed",
  "Review my org’s security posture",
];

function recommendApp(text: string): SurfaceApp {
  const normalized = text.toLowerCase();

  if (/deploy|release|pipeline|work item|lifecycle/.test(normalized)) {
    return surfaceApps[3]!;
  }
  if (/code|apex|lwc|test|debug|source/.test(normalized)) {
    return surfaceApps[1]!;
  }
  if (/security|permission|monitor|observe|health|trust|govern/.test(normalized)) {
    return surfaceApps[2]!;
  }
  return surfaceApps[0]!;
}

export function FrontDoor() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "agent",
      text: "Tell me what you’re trying to accomplish. I’ll help you start here, then take you to the right app when the work needs a dedicated workspace.",
    },
  ]);
  const [recommendation, setRecommendation] = useState<SurfaceApp | null>(null);

  function send(text = draft) {
    const value = text.trim();
    if (!value) return;

    const app = recommendApp(value);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: value },
      {
        id: Date.now() + 1,
        role: "agent",
        text: `I’d start this in ${app.label}. I’ll carry your goal and the context we establish here into that workspace.`,
      },
    ]);
    setRecommendation(app);
    setDraft("");
  }

  return (
    <div className={styles.page}>
      <div className={styles.doorway}>
        <section
          id="front-door-agent"
          className={styles.agent}
          aria-labelledby="agent-heading"
        >
          <div className={styles.agentHeading}>
            <span className={styles.agentAvatar} aria-hidden="true">
              <SparklesIcon width={21} height={21} />
            </span>
            <div>
              <p className={styles.kicker}>Agent</p>
              <h1 id="agent-heading">What do you want to accomplish?</h1>
              <p>
                Start with an outcome. I’ll help you find the right app and carry
                the work there.
              </p>
            </div>
          </div>

          <div className={styles.transcript} role="log" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${styles[message.role]}`}
              >
                <div className={styles.bubble}>{message.text}</div>
              </div>
            ))}

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
              {suggestedPrompts.map((prompt) => (
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
              <label className={styles.srOnly} htmlFor="front-door-composer">
                Message the agent
              </label>
              <textarea
                id="front-door-composer"
                rows={2}
                value={draft}
                placeholder="Describe what you want to build, change, or understand…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <SendIcon width={19} height={19} />
              </button>
            </form>
            <p className={styles.composerHint}>
              The prototype routes by intent; it is not connected to a model yet.
            </p>
          </div>
        </section>

        <section className={styles.launcher} aria-labelledby="apps-heading">
          <div className={styles.launcherHeading}>
            <div>
              <h2 id="apps-heading">Your building surfaces</h2>
              <p>Go directly to a dedicated workspace.</p>
            </div>
            <span className={styles.appCount}>4 apps</span>
          </div>

          <ul className={styles.appGrid}>
            {surfaceApps.map((surface) => (
              <li key={surface.id}>
                <Link href={surface.href} className={styles.appLink}>
                  <span className={styles.appIcon} aria-hidden="true">
                    <surface.Icon width={22} height={22} />
                  </span>
                  <span className={styles.appCopy}>
                    <strong>{surface.label}</strong>
                    <span>{surface.description}</span>
                  </span>
                  <ChevronRightIcon
                    className={styles.chevron}
                    width={18}
                    height={18}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.launcherNote}>
            <strong>One front door, distinct rooms.</strong>
            <span>
              Each app can evolve around its own users and jobs while the top bar
              keeps the whole platform connected.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
