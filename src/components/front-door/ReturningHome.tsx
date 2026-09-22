"use client";

import { ChevronRightIcon, SparklesIcon } from "@/components/icons";
import { useId } from "react";
import { RecentWorkList } from "@/components/workspace/RecentWorkList";
import type { ReturningWork } from "@/lib/workspace/returning-work";
import { SURFACES } from "@/lib/workspace/surfaces";
import type { TodaySnapshot } from "./today-snapshot";
import { SurfaceNav } from "./SurfaceNav";
import { todayRow } from "./today-reveal";
import styles from "./ReturningHome.module.css";

export function ReturningHome({ snapshot, onOpenWork, active }: {
  snapshot: TodaySnapshot; active: boolean;
  onOpenWork: (work: ReturningWork) => void;
}) {
  const id = useId();
  const { profile, recent, working } = snapshot;
  const attention = recent.filter((work) => work.attention);
  const surfacesOrder = 5 + Math.max(1, attention.length);

  return <div className={styles.home}>
    {snapshot.truncated && <p>Showing a brief summary of {snapshot.totalRecent} recent work items. Open a work item for its full details.</p>}
    <header className={styles.hero}>
      <p {...todayRow(0)}>Welcome back, {profile?.firstName}</p>
      <h2 {...todayRow(1)}>Your work, across projects.</h2>
      <div className={styles.context} {...todayRow(2)}>{recent.some(work => work.worktreeId !== null) ? "All projects and worktrees" : "All projects"}</div>
      <div className={styles.summary} {...todayRow(3)}><SparklesIcon width={15} height={15} aria-hidden="true" />
        {working} {working === 1 ? "agent" : "agents"} working <span aria-hidden="true">·</span> {attention.length} {attention.length === 1 ? "item needs" : "items need"} your attention
      </div>
    </header>
    <section className={styles.attention} aria-labelledby={`${id}-attention`}>
      <div className={styles.sectionHeading} {...todayRow(4)}><h2 id={`${id}-attention`}>Needs your attention <span className={styles.count}>{attention.length}</span></h2></div>
      {attention.length ? <div className={styles.attentionGrid}>
        {attention.map((work, index) => <button key={work.id} {...todayRow(5 + index)} type="button" onClick={() => onOpenWork(work)} className={styles.attentionCard} data-today-container aria-label={`Review ${work.title}`}>
          <span className={styles.attentionLabel}>{work.statusLabel}</span>
          <strong>{work.title}</strong>
          <span className={styles.workContext}>{[work.projectName ?? work.projectId, work.branch ?? work.worktreeId].filter(Boolean).join(" · ")}</span>
          <span className={styles.attentionDescription}>{work.summary}</span>
          <span className={styles.attentionAction}>Review in {SURFACES[work.surfaceId].label}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        </button>)}
      </div> : <p className={styles.empty} data-today-container {...todayRow(5)}>Nothing needs your attention here.</p>}
    </section>
    <SurfaceNav revealOrder={surfacesOrder} readOnly={!active} profile={profile} />
    <section aria-labelledby={`${id}-recent`}>
      <div className={styles.sectionHeading} {...todayRow(surfacesOrder + 2)}>
        <h2 id={`${id}-recent`}>Recent work <span className={styles.count}>{recent.length}</span></h2>
      </div>
      {recent.length ? <RecentWorkList items={[...recent].sort((a, b) => b.updated.localeCompare(a.updated))} onOpenWork={onOpenWork} showProject revealFrom={surfacesOrder + 3} /> : <p className={styles.empty} data-today-container {...todayRow(surfacesOrder + 3)}>No recent work yet.</p>}
    </section>
  </div>;
}
