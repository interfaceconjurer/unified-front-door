"use client";

import { SampleTimestamp } from "@/components/workspace/SampleTimestamp";

import { useNavigation } from "@/components/navigation/NavigationProvider";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { ChevronRightIcon, BoxIcon } from "@/components/icons";
import { RecentWorkList, useOpenWork } from "@/components/workspace/RecentWorkList";
import { useWorkspace, useWorkspacePanel } from "@/components/workspace/workspace-context";
import { RETURNING_WORK } from "@/lib/workspace/returning-work";
import { APP_STATUS_LABEL } from "@/lib/workspace/selectors";
import type { SurfaceId } from "@/lib/workspace/model";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import { SurfaceLauncher } from "./SurfaceLauncher";
import { BuildSetupAreas } from "./BuildSetupAreas";
import styles from "./ReturningSurface.module.css";

const COPY: Record<SurfaceId, { heading: string; description: string; workHeading: string }> = {
  code: { heading: "Back to your code.", description: "Resume your changes or open another tool.", workHeading: "Continue working" },
  build: { heading: "Keep your ideas moving.", description: "Pick up your agents, automations, and experiences.", workHeading: "Your builds" },
  govern: { heading: "Keep your workspace in view.", description: "Follow up on access reviews and revisit the signals you’re watching.", workHeading: "Reviews & monitors" },
  alm: { heading: "Move your next change forward.", description: "Review your releases, manage deployed apps, and plan what’s next.", workHeading: "Apps & releases" },
};

export function ReturningSurface({ surfaceId, children }: {
  surfaceId: SurfaceId;
  children?: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  const { orgs, activeProject, activeOrg, activeWorktree, openProjectPanel } = useWorkspace();
  const { panelOpen } = useWorkspacePanel();
  const { selectOrg } = useNavigation();
  const { openCanvas } = useSurfaceCanvasActions();
  const openWork = useOpenWork();
  const work = RETURNING_WORK.filter((item) => item.projectId === activeProject?.id
    && item.worktreeId === activeWorktree?.id && item.surfaceId === surfaceId);
  const attention = work.filter((item) => item.attention).length;
  const copy = COPY[surfaceId];
  const release = work.find((item) => item.kind === "Release plan");

  return <div className={styles.surface}>
    <header className={styles.header}>
      <p className={styles.identity}>
        <span className={styles.identityIcon}><surface.Icon width={26} height={26} aria-hidden="true" /></span>
        {surface.label}
      </p>
      <h1 id="surface-heading">{copy.heading}</h1>
      <p className={styles.description}>{copy.description}</p>
      {surfaceId !== "code" && <div className={styles.context}>
        <span>Project</span>
        <button type="button" className={styles.projectLink} onClick={openProjectPanel}
          aria-label={activeProject ? `${activeProject.name}, show in projects panel` : "Browse projects"}
          aria-controls="workspace-panel" aria-expanded={panelOpen}>
          {activeProject?.name ?? "Browse projects"}
        </button>
      </div>}
    </header>

    {children}

    {surfaceId === "build" && <BuildSetupAreas />}

    <section aria-labelledby="surface-work-heading">
      <div className={styles.sectionHeading}><h2 id="surface-work-heading">{copy.workHeading}</h2>
        <span>{attention ? `${attention} needs your attention` : `${work.length} recent ${work.length === 1 ? "item" : "items"}`}</span>
      </div>
      {work.length ? <RecentWorkList items={work} /> : <p className={styles.empty}>Your work in this surface will appear here. Start something new below.</p>}
    </section>

    {surfaceId === "govern" && <section aria-labelledby="environments-heading">
      <div className={styles.sectionHeading}><h2 id="environments-heading">Connected environments</h2><span>Select a target org</span></div>
      <ul className={styles.environments}>{orgs.map((org) => <li key={org.id}>
        <button type="button" aria-pressed={org.id === activeOrg?.id} onClick={() => selectOrg(org.id)}>
          <span className={styles.connection} data-connection={org.connection} aria-hidden="true" />
          <span><strong>{org.label}</strong><small>{org.kind}{org.expiresInDays !== undefined && ` · ${org.expiresInDays === 0 ? "Expired" : `At capture: ${org.expiresInDays} days remaining`}`}</small></span>
          <span className={styles.orgState}>{org.id === activeOrg?.id ? "Target org" : org.connection === "expired" ? "Expired" : "Connected"}</span>
        </button>
      </li>)}</ul>
    </section>}

    {surfaceId === "alm" && release && <section aria-labelledby="release-progress-heading">
      <div className={styles.sectionHeading}><h2 id="release-progress-heading">Release progress</h2><span>{release.statusLabel}</span></div>
      <button type="button" className={styles.release} onClick={() => openWork(release)} aria-label={`Open release progress for ${release.title}`}>
        <span className={styles.releaseTitle}>{release.title}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
        <span className={styles.stages}>{["Prepare", "Validate", "Review", "Deploy"].map((stage, index) => {
          const current = release.attention ? 2 : 0;
          return <span className={styles.stage} key={stage} data-state={index < current ? "done" : index === current ? "current" : "next"}>
            <span className={styles.stageNumber}>{index < current ? "✓" : index + 1}</span>
            <strong>{stage}</strong><small>{index < current ? "Complete" : index === current ? "In progress" : "Up next"}</small>
          </span>;
        })}</span>
        <span className={styles.releaseHint}>{release.attention ? "Your review is the next step before deployment to UAT." : "Continue defining the scope before validation in SIT."}</span>
      </button>
    </section>}

    {surfaceId === "alm" && !!activeProject && activeProject.apps.length > 0 && <section aria-labelledby="deployed-heading">
      <div className={styles.sectionHeading}><h2 id="deployed-heading">Deployed apps</h2><span>{activeProject?.apps.length} apps</span></div>
      <ul className={styles.apps}>{activeProject?.apps.map((app) => <li key={app.id}>
        <button type="button" onClick={() => openCanvas(surfaceId, { kind: "app", title: app.label, params: { projectId: activeProject?.id, appId: app.id } })} aria-label={`Open ${app.label}`}>
          <BoxIcon width={18} height={18} aria-hidden="true" />
          <span><strong>{app.label}</strong><small>{app.environment} · {APP_STATUS_LABEL[app.status]} · <SampleTimestamp value={app.lastDeployed} /></small></span>
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
