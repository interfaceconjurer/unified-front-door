"use client";

import { CANVAS_FIELD_CHARACTER_LIMIT } from "@/lib/surface-canvas/model";

import { SampleTimestamp } from "@/components/workspace/SampleTimestamp";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { ChevronRightIcon, EyeIcon } from "@/components/icons";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { WorkStatusBadge } from "@/components/workspace/RecentWorkList";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { workForCanvas } from "@/lib/workspace/returning-work";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { previewCanvas } from "@/lib/preview/model";
import { destinationCanvasTarget } from "@/lib/navigation/model";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./WorkCanvas.module.css";

export function WorkCanvas({ spec }: { spec: CanvasOf<"work"> }) {
  const work = workForCanvas(spec.params);
  const { projects, target, destination } = useWorkspace();
  const { profile } = useDemoProfile();
  const { openCanvasInProject, openCanvas } = useNavigationActions();
  const { updateDraft, persistence } = useSurfaceCanvasActions();
  if (!work || work.projectId !== spec.params.projectId || work.worktreeId !== spec.params.worktreeId) return <div className={styles.canvas}><h1>{spec.title}</h1><p>This work is no longer available.</p></div>;
  const project = projects.find((item) => item.id === work.projectId);
  const worktree = project?.worktrees.find((item) => item.id === work.worktreeId);
  const preview = profile?.surfaceAccess.includes("build") ? previewCanvas(work.projectId, work.worktreeId,
    destination.kind === "available" ? destinationCanvasTarget(destination.destination).orgId : project?.defaultOrgId ?? null) : null;
  const save = (fields: Record<string, string>) => updateDraft(work.surfaceId, spec.id, fields);

  return <article className={styles.canvas}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>{work.kind}</p>
      <h1>{work.title}</h1>
      <p className={styles.summary}>{work.summary}</p>
      <div className={styles.meta}><WorkStatusBadge work={work} /><span><SampleTimestamp value={work.updated} /></span></div>
      {project && worktree && <section className={styles.context} aria-label="Work context">
        <dl className={styles.ownership}>
          <div><dt>Project</dt><dd>{project.name}</dd></div>
          <div><dt>Worktree</dt><dd>{worktree.label}</dd></div>
          <div><dt>Branch</dt><dd className={styles.branch}>{worktree.branch}</dd></div>
        </dl>
        {target.projectId === null && <div className={styles.contextActions}>
          {preview && <button type="button" className={styles.preview} onClick={() => openCanvas("build", preview)}>
            <EyeIcon width={16} height={16} />Preview
          </button>}
          <button type="button" className={styles.openProject}
          aria-label={worktree.isPrimary ? `Open project ${project.name}` : `Open worktree ${worktree.label} in ${project.name}`}
          onClick={() => openCanvasInProject(work.surfaceId, spec)}>
          {worktree.isPrimary ? "Open project" : "Open worktree"}<ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </button></div>}
      </section>}
    </header>
    <dl className={styles.facts}>{work.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.label === "Last deployment" ? <SampleTimestamp value={detail.value} /> : detail.value}</dd></div>)}</dl>
    {work.source !== undefined && <section className={styles.editor}>
      <div className={styles.sectionHeading}><label htmlFor="work-source">{work.sourceLabel}</label><PersistenceStatus store={persistence} hasContent={!!spec.draft} /></div>
      <textarea id="work-source" maxLength={CANVAS_FIELD_CHARACTER_LIMIT} aria-describedby="work-source-limit" className={styles.source} spellCheck={false} value={spec.draft?.source ?? work.source} onChange={(event) => save({ source: event.target.value })} rows={7} />
      <small id="work-source-limit">Maximum 16,000 characters. Longer saved values are preserved.</small>
    </section>}
    <section aria-labelledby="work-activity-heading">
      <div className={styles.sectionHeading}><h2 id="work-activity-heading">Where you left off</h2><span>Recent activity</span></div>
      <ol className={styles.activity}>{work.activity.map((entry) => <li key={entry}>{entry}</li>)}</ol>
    </section>
    <section className={styles.editor}>
      <div className={styles.sectionHeading}><label htmlFor="work-notes">Your notes</label><PersistenceStatus store={persistence} hasContent={!!spec.draft} /></div>
      <textarea id="work-notes" maxLength={CANVAS_FIELD_CHARACTER_LIMIT} aria-describedby="work-notes-limit" value={spec.draft?.notes ?? ""} onChange={(event) => save({ notes: event.target.value })} placeholder="Leave a review note or capture your next step…" rows={3} />
      <small id="work-notes-limit">Maximum 16,000 characters. Longer saved values are preserved.</small>
    </section>
  </article>;
}
