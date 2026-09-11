"use client";

import { ChevronRightIcon, GitBranchIcon, SparklesIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { RecentWorkList, useOpenWork } from "@/components/workspace/RecentWorkList";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { RETURNING_WORK } from "@/lib/workspace/returning-work";
import { SurfaceNav } from "./SurfaceNav";
import styles from "./ReturningHome.module.css";

export function ReturningHome() {
  const { profile } = useDemoProfile();
  const { activeProject, activeWorktree, agentSessions } = useWorkspace();
  const openWork = useOpenWork();
  const recent = RETURNING_WORK.filter((work) => work.projectId === activeProject.id && work.worktreeId === activeWorktree.id);
  const attention = recent.filter((work) => work.attention);
  const working = agentSessions.filter((session) => session.worktreeId === activeWorktree.id && session.status === "working").length;

  return <div className={styles.home}>
    <header className={styles.hero}>
      <p>Welcome back, {profile?.firstName}</p>
      <h1 id="front-door-heading">Pick up where you left off.</h1>
      <div className={styles.context} role="group" aria-label="Current project and worktree">
        <span>{activeProject.name}</span>
        <span className={styles.branch}><GitBranchIcon width={14} height={14} aria-hidden="true" />{activeWorktree.branch}</span>
      </div>
      <div className={styles.summary} role="status"><SparklesIcon width={15} height={15} aria-hidden="true" />
        {working} {working === 1 ? "agent" : "agents"} working <span aria-hidden="true">·</span> {attention.length} {attention.length === 1 ? "item needs" : "items need"} your attention
      </div>
    </header>
    <SurfaceNav />
    <section className={styles.attention} aria-labelledby="attention-heading">
      <div className={styles.sectionHeading}><h2 id="attention-heading">Needs your attention <span className={styles.count}>{attention.length}</span></h2></div>
      {attention.length ? <div className={styles.attentionGrid}>
        {attention.map((work) => <button key={work.id} type="button" onClick={() => openWork(work)} className={styles.attentionCard} aria-label={`Review ${work.title}`}>
          <span className={styles.attentionLabel}>{work.statusLabel}</span>
          <strong>{work.title}</strong>
          <span className={styles.attentionDescription}>{work.summary}</span>
          <span className={styles.attentionAction}>Review in {work.surfaceId === "alm" ? "ALM" : "Govern & Observe"}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        </button>)}
      </div> : <p className={styles.empty}>Nothing needs your attention here.</p>}
    </section>
    <section aria-labelledby="recent-work-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-work-heading">Recent work <span className={styles.count}>{recent.length}</span></h2>
      </div>
      {recent.length ? <RecentWorkList items={recent} /> : <p className={styles.empty}>No recent work in this worktree yet.</p>}
    </section>
  </div>;
}
