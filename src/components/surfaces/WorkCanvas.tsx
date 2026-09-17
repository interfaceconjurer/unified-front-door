"use client";

import { CANVAS_FIELD_CHARACTER_LIMIT } from "@/lib/surface-canvas/model";

import { SampleTimestamp } from "@/components/workspace/SampleTimestamp";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { WorkStatusBadge } from "@/components/workspace/RecentWorkList";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { workForCanvas } from "@/lib/workspace/returning-work";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./WorkCanvas.module.css";

export function WorkCanvas({ spec }: { spec: CanvasOf<"work"> }) {
  const work = workForCanvas(spec.params);
  const { projects } = useWorkspace();
  const { updateDraft, persistence } = useSurfaceCanvasActions();
  if (!work || work.projectId !== spec.params.projectId || work.worktreeId !== spec.params.worktreeId) return <div className={styles.canvas}><h1>{spec.title}</h1><p>This work is no longer available.</p></div>;
  const surface = surfaceAppById(work.surfaceId);
  const project = projects.find((item) => item.id === work.projectId);
  const worktree = project?.worktrees.find((item) => item.id === work.worktreeId);
  const save = (fields: Record<string, string>) => updateDraft(work.surfaceId, spec.id, fields);

  return <article className={styles.canvas}>
    <header className={styles.header}>
      <p className={styles.eyebrow}><surface.Icon width={17} height={17} aria-hidden="true" />{work.kind} <span>·</span> {project?.name}</p>
      <h1>{work.title}</h1>
      <p className={styles.summary}>{work.summary}</p>
      <div className={styles.meta}><WorkStatusBadge work={work} /><span>{worktree?.branch}</span><span><SampleTimestamp value={work.updated} /></span></div>
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
