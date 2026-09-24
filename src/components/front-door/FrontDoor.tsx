"use client";

import {
  ChevronRightIcon,
  GitBranchIcon,
  ListCheckIcon,
  PuzzleIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import { useEffect, useId, useRef, useState } from "react";
import { startersForProfile, type StarterId } from "@/lib/agent/starters";
import { canAccessSurface } from "@/lib/demo-profiles";
import type { ReturningWork } from "@/lib/workspace/returning-work";
import type { TodaySnapshot } from "./today-snapshot";
import { surfaceApps } from "./app-catalog";
import { ReturningHome } from "./ReturningHome";
import { DayZeroHome } from "@/components/onboarding/DayZeroHome";
import { SurfaceNav } from "./SurfaceNav";
import { todayRow } from "./today-reveal";
import styles from "./FrontDoor.module.css";

const STARTER_ICONS: Record<StarterId, IconComponent> = {
  project: ListCheckIcon, agent: SparklesIcon, app: PuzzleIcon, pipeline: GitBranchIcon, "existing-project": GitBranchIcon,
};

/** An interactive briefing embedded in the conversation, with no inner scroll. */
export function FrontDoor({ snapshot, active, onStart, onOpenWork }: {
  snapshot: TodaySnapshot;
  active: boolean;
  onStart: (starter: StarterId) => void;
  onOpenWork: (work: ReturningWork) => void;
}) {
  const { profile } = snapshot;
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [inactiveAppearance, setInactiveAppearance] = useState(!active);
  // A reused trailing Today becomes live again without remounting its content.
  if (active && inactiveAppearance) setInactiveAppearance(false);
  const readOnly = !active && inactiveAppearance;
  useEffect(() => {
    const content = contentRef.current, transcript = content?.closest<HTMLElement>('[role="log"]');
    if (active || inactiveAppearance || !content || !transcript) return;
    // Observe the content, excluding responsive fieldset padding. Subdue only
    // outside the viewport, even if the reader interrupts the outgoing scroll.
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      // A fast scroll can deliver visible and offscreen records together.
      // Use the latest position so an earlier visible record cannot hide exit.
      const entry = entries.at(-1);
      if (!cancelled && entry && !entry.isIntersecting) setInactiveAppearance(true);
    }, { root: transcript, threshold: 0 });
    observer.observe(content);
    return () => { cancelled = true; observer.disconnect(); };
  }, [active, inactiveAppearance]);
  const availableSurfaces = profile
    ? surfaceApps.filter((surface) => canAccessSurface(profile, surface.id))
    : [];
  const availableStarters = profile ? startersForProfile(profile) : [];
  const starters = availableStarters.filter(starter => starter.id !== "existing-project")
    .map(starter => ({ ...starter, Icon: STARTER_ICONS[starter.id] }));
  const returning = profile?.workspaceExperience === "established";
  const dayZero = profile?.onboarding === "org-assessment";
  const canUseCode = availableSurfaces.some((surface) => surface.id === "code");

  return (
    <div className={styles.frontDoor} data-read-only={readOnly || undefined} data-retiring={!active && !readOnly || undefined} inert={!active && !readOnly}>
        <fieldset className={styles.content} disabled={readOnly} aria-label={active ? "Today" : "Earlier Today (read only)"}>
          <div ref={contentRef} className={styles.briefing} onFocusCapture={(event) => {
            // Finish the focused card/row's existing reveal, including Sam's
            // opportunity cards. Removing an animation on :focus-within would
            // recreate it (and hide the card) when focus moves elsewhere.
            for (let element: HTMLElement | null = event.target; element && element !== event.currentTarget; element = element.parentElement) {
              element.getAnimations().forEach(animation => {
                if (animation instanceof CSSAnimation && animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish();
              });
            }
          }}>
          {dayZero ? <DayZeroHome snapshot={readOnly ? snapshot.assessment : undefined} profile={snapshot.profile} /> : returning ? <ReturningHome active={!readOnly} snapshot={snapshot} onOpenWork={onOpenWork} /> : <>
          <header className={styles.hero}>
            <p className={styles.welcome} {...todayRow(0)}>
              {profile?.experience === "new" ? "Welcome" : "Welcome back"}, {profile?.firstName}
            </p>
            <h2 {...todayRow(1)}>What will you build first?</h2>
            <p className={styles.intro} {...todayRow(2)}>
              Your tools, your ideas, and an agent to help you bring them to life.
            </p>
          </header>

          <SurfaceNav revealOrder={3} readOnly={readOnly} profile={profile} />

          <section className={styles.starters} aria-labelledby={`${id}-starters`}>
            <div className={styles.sectionHeading} {...todayRow(5)}>
              <h2 id={`${id}-starters`}>A few ways to get started</h2>
              <p>Pick an idea and make it yours.</p>
            </div>
            <ul className={styles.starterGrid}>
              {starters.map((starter, index) => (
                <li key={starter.title} {...todayRow(6 + index)}>
                  <button
                    type="button"
                    className={styles.starterCard}
                    data-today-container
                    data-surface={starter.surfaceId}
                    onClick={() => onStart(starter.id)}
                  >
                    <span className={styles.cardTop}>
                      <span className={styles.starterIcon} aria-hidden="true">
                        <starter.Icon width={22} height={22} />
                      </span>
                      <span className={styles.surfaceLabel}>
                        {availableSurfaces.find((surface) => surface.id === starter.surfaceId)?.label}
                      </span>
                    </span>
                    <strong className={styles.starterTitle}>{starter.title}</strong>
                    <span className={styles.starterDescription}>{starter.description}</span>
                    <span className={styles.starterAction}>
                      Open in {availableSurfaces.find((surface) => surface.id === starter.surfaceId)?.label}
                      <ChevronRightIcon width={15} height={15} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {canUseCode && (
            <div className={styles.existingProject} data-today-container {...todayRow(6 + starters.length)}>
              <GitBranchIcon className={styles.existingIcon} width={20} height={20} aria-hidden="true" />
              <div className={styles.existingCopy}>
                <h2>Have a project already?</h2>
                <p>Start with your codebase and get to know what you can do here.</p>
              </div>
              <button type="button" onClick={() => onStart("existing-project")}>
                Bring your project
                <ChevronRightIcon width={15} height={15} aria-hidden="true" />
              </button>
            </div>
          )}
          </>}
          </div>
        </fieldset>
    </div>
  );
}
