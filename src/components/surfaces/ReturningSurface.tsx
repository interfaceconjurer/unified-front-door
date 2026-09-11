"use client";

import { surfaceAppById } from "@/components/front-door/app-catalog";
import { ChevronRightIcon, BoxIcon } from "@/components/icons";
import { RecentWorkList, useOpenWork } from "@/components/workspace/RecentWorkList";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { RETURNING_WORK } from "@/lib/workspace/returning-work";
import { APP_STATUS_LABEL } from "@/lib/workspace/selectors";
import type { SurfaceId } from "@/lib/workspace/model";
import { useSurfaceCanvases } from "./surface-canvas-context";
import { SurfaceLauncher } from "./SurfaceLauncher";
import styles from "./ReturningSurface.module.css";

const COPY: Record<SurfaceId, { heading: string; description: string; workHeading: string }> = {
  code: { heading: "Back to your code.", description: "Resume your changes, check on your agents, or open another tool.", workHeading: "Continue working" },
  build: { heading: "Keep your ideas moving.", description: "Pick up your agents and experiences, and see what’s running.", workHeading: "Your builds" },
  govern: { heading: "Keep your workspace in view.", description: "Follow up on access reviews and revisit the signals you’re watching.", workHeading: "Reviews & monitors" },
  alm: { heading: "Move your next change forward.", description: "Review what’s waiting on you and pick up your release plans.", workHeading: "Releases in progress" },
};

export function ReturningSurface({ surfaceId, toolbar, children }: {
  surfaceId: SurfaceId;
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  const { projects, orgs, activeProject, activeOrg, setActiveProject, setActiveOrg } = useWorkspace();
  const { openCanvas } = useSurfaceCanvases(surfaceId);
  const openWork = useOpenWork();
  const work = RETURNING_WORK.filter((item) => item.projectId === activeProject.id && item.surfaceId === surfaceId);
  const attention = work.filter((item) => item.attention).length;
  const copy = COPY[surfaceId];

  return <div className={styles.surface}>
    <header className={styles.header}>
      <p className={styles.eyebrow}><surface.Icon width={17} height={17} aria-hidden="true" />{surface.label}</p>
      <h1 id="surface-heading">{copy.heading}</h1>
      <p className={styles.description}>{copy.description}</p>
      <div className={styles.context}>
        <label>Project
          <select value={activeProject.id} onChange={(event) => setActiveProject(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        {toolbar}
      </div>
    </header>

    <section aria-labelledby="surface-work-heading">
      <div className={styles.sectionHeading}><h2 id="surface-work-heading">{copy.workHeading}</h2>
        <span>{attention ? `${attention} needs your attention` : `${work.length} recent ${work.length === 1 ? "item" : "items"}`}</span>
      </div>
      {work.length ? <RecentWorkList items={work} /> : <p className={styles.empty}>Your work in this surface will appear here. Start something new below.</p>}
    </section>

    {children}

    {surfaceId === "govern" && <section aria-labelledby="environments-heading">
      <div className={styles.sectionHeading}><h2 id="environments-heading">Connected environments</h2><span>Select a target org</span></div>
      <ul className={styles.environments}>{orgs.map((org) => <li key={org.id}>
        <button type="button" aria-pressed={org.id === activeOrg.id} onClick={() => setActiveOrg(org.id)}>
          <span className={styles.connection} data-connection={org.connection} aria-hidden="true" />
          <span><strong>{org.label}</strong><small>{org.kind}{org.expiresInDays !== undefined && ` · ${org.expiresInDays === 0 ? "Expired" : `Expires in ${org.expiresInDays} days`}`}</small></span>
          <span className={styles.orgState}>{org.id === activeOrg.id ? "Target org" : org.connection === "expired" ? "Expired" : "Connected"}</span>
        </button>
      </li>)}</ul>
    </section>}

    {surfaceId === "alm" && work[0] && <section aria-labelledby="release-progress-heading">
      <div className={styles.sectionHeading}><h2 id="release-progress-heading">Release progress</h2><span>{work[0].statusLabel}</span></div>
      <button type="button" className={styles.release} onClick={() => openWork(work[0]!)} aria-label={`Open release progress for ${work[0].title}`}>
        <span className={styles.releaseTitle}>{work[0].title}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        <span className={styles.stages}>{["Prepare", "Validate", "Review", "Deploy"].map((stage, index) => {
          const current = work[0]!.attention ? 2 : 0;
          return <span className={styles.stage} key={stage} data-state={index < current ? "done" : index === current ? "current" : "next"}>
            <span className={styles.stageNumber}>{index < current ? "✓" : index + 1}</span>
            <strong>{stage}</strong><small>{index < current ? "Complete" : index === current ? "In progress" : "Up next"}</small>
          </span>;
        })}</span>
        <span className={styles.releaseHint}>{work[0].attention ? "Your review is the next step before deployment to UAT." : "Continue defining the scope before validation in SIT."}</span>
      </button>
    </section>}

    {surfaceId === "build" && activeProject.apps.length > 0 && <section aria-labelledby="deployed-heading">
      <div className={styles.sectionHeading}><h2 id="deployed-heading">Deployed apps</h2><span>{activeProject.apps.length} apps</span></div>
      <ul className={styles.apps}>{activeProject.apps.map((app) => <li key={app.id}>
        <button type="button" onClick={() => openCanvas(surfaceId, { kind: "app", title: app.label, params: { projectId: activeProject.id, appId: app.id } })} aria-label={`Open ${app.label}`}>
          <BoxIcon width={18} height={18} aria-hidden="true" />
          <span><strong>{app.label}</strong><small>{app.environment} · {APP_STATUS_LABEL[app.status]} · {app.lastDeployed}</small></span>
          <ChevronRightIcon width={15} height={15} aria-hidden="true" />
        </button>
      </li>)}</ul>
    </section>}

    <details className={styles.newWork}>
      <summary>Start something new <span>Browse tools & starters</span></summary>
      <div className={styles.launcher}><SurfaceLauncher surfaceId={surfaceId} /></div>
    </details>
  </div>;
}
