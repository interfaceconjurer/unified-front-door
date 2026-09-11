"use client";

import { useState } from "react";
import { ChevronRightIcon, SparklesIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { RecentWorkList, useOpenWork } from "@/components/workspace/RecentWorkList";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { RETURNING_WORK } from "@/lib/workspace/returning-work";
import { SurfaceNav } from "./SurfaceNav";
import styles from "./ReturningHome.module.css";

export function ReturningHome() {
  const { profile } = useDemoProfile();
  const { projects } = useWorkspace();
  const [projectId, setProjectId] = useState("all");
  const openWork = useOpenWork();
  const attention = RETURNING_WORK.filter((work) => work.attention);
  const recent = RETURNING_WORK.filter((work) => projectId === "all" || work.projectId === projectId);
  const working = projects.flatMap((project) => project.agentSessions).filter((session) => session.status === "working").length;

  return <div className={styles.home}>
    <header className={styles.hero}>
      <p>Welcome back, {profile?.firstName}</p>
      <h1 id="front-door-heading">Pick up where you left off.</h1>
      <div className={styles.summary}><SparklesIcon width={15} height={15} aria-hidden="true" />
        {working} agent working <span aria-hidden="true">·</span> {attention.length} items need your attention
      </div>
    </header>
    <SurfaceNav />
    <section className={styles.attention} aria-labelledby="attention-heading">
      <div className={styles.sectionHeading}><h2 id="attention-heading">Needs your attention <span className={styles.count}>{attention.length}</span></h2></div>
      <div className={styles.attentionGrid}>
        {attention.map((work) => <button key={work.id} type="button" onClick={() => openWork(work)} className={styles.attentionCard} aria-label={`Review ${work.title}`}>
          <span className={styles.attentionLabel}>{work.statusLabel}</span>
          <strong>{work.title}</strong>
          <span className={styles.attentionDescription}>{work.summary}</span>
          <span className={styles.attentionAction}>Review in {work.surfaceId === "alm" ? "ALM" : "Govern & Observe"}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        </button>)}
      </div>
    </section>
    <section aria-labelledby="recent-work-heading">
      <div className={styles.sectionHeading}>
        <h2 id="recent-work-heading">Recent work <span className={styles.count}>{recent.length}</span></h2>
        <label className={styles.filter}>Project
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="all">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
      </div>
      <RecentWorkList items={recent} showProject />
    </section>
  </div>;
}
