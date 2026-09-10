"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRightIcon,
  LinkIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
} from "@/components/icons";
import { surfaceApps, type SurfaceApp } from "./app-catalog";
import styles from "./FrontDoor.module.css";

/**
 * The front door as one harmonized workstage: the agent and the surface
 * launcher, merged. Rather than splitting the screen into an agent pane and a
 * separate app grid, this is a single centered column — a greeting, the
 * surfaces to explore, and one composer that is the agent's entry point.
 *
 * The composer routes by intent: describing an outcome takes you into the
 * surface best suited to carry it. Surface navigation still lives in the top
 * bar's ⌘⇧P palette, so this view deliberately omits a redundant toolkit link.
 */

const SAMPLE_PROMPTS = [
  {
    label: "Build an agent to qualify and route leads",
    prompt: "Help me build an agent that qualifies and routes high-value leads.",
  },
  {
    label: "Diagnose a failed deployment",
    prompt: "Help me understand why this deployment failed and how to recover.",
  },
] as const;

// Same intent heuristic the agent panel uses inside surfaces, kept local so the
// front door can point you at the right room without pulling in the panel.
function recommendSurface(text: string): SurfaceApp {
  const normalized = text.toLowerCase();
  if (/deploy|release|pipeline|work item|lifecycle/.test(normalized)) return surfaceApps[3]!;
  if (/code|apex|lwc|test|debug|source/.test(normalized)) return surfaceApps[1]!;
  if (/security|permission|monitor|observe|health|trust|govern/.test(normalized)) return surfaceApps[2]!;
  return surfaceApps[0]!;
}

export function FrontDoor() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const intent = draft.trim();
    if (!intent) return;
    // Carry the goal into the surface that can act on it. In the full
    // experience the agent would open there already holding this context.
    router.push(recommendSurface(intent).href);
  }

  function seedPrompt(prompt: (typeof SAMPLE_PROMPTS)[number]) {
    setDraft((current) => (current.trim() ? `${current.trim()}\n\n${prompt.prompt}` : prompt.prompt));
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  return (
    <section className={styles.frontDoor} aria-labelledby="front-door-heading">
      <div className={styles.scroll}>
        <div className={styles.hero}>
          <span className={styles.heroMark} aria-hidden="true">
            <SparklesIcon width={24} height={24} />
          </span>
          <h1 id="front-door-heading">What can I help you accomplish?</h1>
        </div>

        <section className={styles.surfaces} aria-labelledby="surfaces-heading">
          <h2 id="surfaces-heading" className={styles.surfacesHeading}>
            Explore surfaces
          </h2>
          <ul className={styles.surfaceList}>
            {surfaceApps.map((surface) => (
              <li key={surface.id}>
                <Link href={surface.href} className={styles.surfaceRow}>
                  <span className={styles.surfaceIcon} aria-hidden="true">
                    <surface.Icon width={20} height={20} />
                  </span>
                  <span className={styles.surfaceCopy}>
                    <strong>{surface.label}</strong>
                    <span>{surface.description}</span>
                  </span>
                  <ChevronRightIcon className={styles.surfaceChevron} width={18} height={18} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.composerDock}>
        <div className={styles.prompts} aria-label="Suggested prompts">
          {SAMPLE_PROMPTS.map((prompt) => (
            <button key={prompt.label} type="button" onClick={() => seedPrompt(prompt)}>
              <SparklesIcon width={15} height={15} aria-hidden="true" />
              {prompt.label}
            </button>
          ))}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className={styles.srOnly} htmlFor="front-door-composer">
            Describe what you want to do
          </label>
          <textarea
            id="front-door-composer"
            ref={composerRef}
            rows={3}
            value={draft}
            placeholder="Describe what you want to do…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className={styles.composerTools}>
            <button type="button">
              <PlusIcon width={16} height={16} aria-hidden="true" />
              Add context
            </button>
            <button type="button">
              <LinkIcon width={16} height={16} aria-hidden="true" />
              Attach
            </button>
            <button
              type="submit"
              className={styles.send}
              disabled={!draft.trim()}
              aria-label="Send message"
            >
              <SendIcon width={18} height={18} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
