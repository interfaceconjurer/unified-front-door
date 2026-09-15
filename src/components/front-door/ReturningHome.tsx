"use client";

import { ChevronRightIcon, GitBranchIcon, SparklesIcon } from "@/components/icons";
import { useId } from "react";
import { RecentWorkList } from "@/components/workspace/RecentWorkList";
import type { ReturningWork } from "@/lib/workspace/returning-work";
import type { TodaySnapshot } from "./today-snapshot";
import { surfaceAppById, type SurfaceApp } from "./app-catalog";
import { SurfaceNav } from "./SurfaceNav";
import styles from "./ReturningHome.module.css";

export function ReturningHome({ snapshot, readOnly = false, onOpenWork, onExplore }: {
  snapshot: TodaySnapshot;
  readOnly?: boolean;
  onOpenWork: (work: ReturningWork) => void;
  onExplore: (surface: SurfaceApp) => void;
}) {
  const id = useId();
  const { profile, projectName, branch, recent, working } = snapshot;
  const attention = recent.filter((work) => work.attention);

  return <div className={styles.home}>
    <header className={styles.hero} data-front-door-row="1">
      <p>Welcome back, {profile?.firstName}</p>
      <h2>Pick up where you left off.</h2>
      <div className={styles.context} role="group" aria-label="Current project and worktree">
        <span>{projectName}</span>
        <span className={styles.branch}><GitBranchIcon width={14} height={14} aria-hidden="true" />{branch}</span>
      </div>
      <div className={styles.summary}><SparklesIcon width={15} height={15} aria-hidden="true" />
        {working} {working === 1 ? "agent" : "agents"} working <span aria-hidden="true">·</span> {attention.length} {attention.length === 1 ? "item needs" : "items need"} your attention
      </div>
    </header>
    <SurfaceNav onExplore={onExplore} revealOrder={2} readOnly={readOnly} />
    <section className={styles.attention} data-front-door-row="3" aria-labelledby={`${id}-attention`}>
      <div className={styles.sectionHeading}><h2 id={`${id}-attention`}>Needs your attention <span className={styles.count}>{attention.length}</span></h2></div>
      {attention.length ? <div className={styles.attentionGrid}>
        {attention.map((work) => <button key={work.id} type="button" onClick={() => onOpenWork(work)} className={styles.attentionCard} aria-label={`Review ${work.title}`}>
          <span className={styles.attentionLabel}>{work.statusLabel}</span>
          <strong>{work.title}</strong>
          <span className={styles.attentionDescription}>{work.summary}</span>
          <span className={styles.attentionAction} data-today-action>Review in {surfaceAppById(work.surfaceId).label}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        </button>)}
      </div> : <p className={styles.empty}>Nothing needs your attention here.</p>}
    </section>
    <section data-front-door-row="4" aria-labelledby={`${id}-recent`}>
      <div className={styles.sectionHeading}>
        <h2 id={`${id}-recent`}>Recent work <span className={styles.count}>{recent.length}</span></h2>
      </div>
      {recent.length ? <RecentWorkList items={recent} onOpenWork={onOpenWork} /> : <p className={styles.empty}>No recent work in this worktree yet.</p>}
    </section>
  </div>;
}
