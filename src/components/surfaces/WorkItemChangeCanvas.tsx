"use client";

import { useId } from "react";
import { GridIcon } from "@/components/icons";
import { useAssessment } from "@/components/onboarding/use-assessment";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { CANVAS_FIELD_CHARACTER_LIMIT, type CanvasOf } from "@/lib/surface-canvas/model";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import { CapabilityHeader } from "./CapabilityHeader";
import styles from "./WorkItemChangeCanvas.module.css";

export function WorkItemChangeCanvas({ spec }: { spec: CanvasOf<"work-item-change"> }) {
  const formId = useId();
  const { state } = useAssessment();
  const { openCanvas, updateDraft, persistence } = useSurfaceCanvasActions();
  const project = state.projects.find(project => project.id === spec.params.projectId);
  const item = project?.workItems.find(item => item.id === spec.params.workItemId);
  if (!project || !item) return <section><h1>Work item unavailable</h1><p>This work item is no longer saved in your project.</p></section>;
  const draft = spec.draft ?? {};
  const update = (field: string, value: string) => updateDraft("build", spec.id, { [field]: value });

  return <article>
    <button type="button" className={styles.back} onClick={() => openCanvas("alm", {
      kind: "improvement-project", title: project.name, params: { projectId: project.id },
    })}>Back to project</button>
    <CapabilityHeader title={item.title} description={`Build & Setup · ${project.name}`} Icon={GridIcon} />
    <p className={styles.goal}>{item.finding.impact}</p>
    <section aria-labelledby={`${formId}-draft`} className={styles.draft}>
      <div className={styles.heading}><h2 id={`${formId}-draft`}>Your change</h2><PersistenceStatus store={persistence} hasContent={Object.values(draft).some(value => value.trim())} /></div>
      <p className={styles.hint}>Prepare a change for this work item. Your draft saves in the project as you edit.</p>
      <label htmlFor={`${formId}-summary`}>Change summary</label>
      <input id={`${formId}-summary`} value={draft.summary ?? item.title} maxLength={CANVAS_FIELD_CHARACTER_LIMIT} onChange={event => update("summary", event.target.value)} />
      <label htmlFor={`${formId}-path`}>File path (optional)</label>
      <input id={`${formId}-path`} value={draft.path ?? ""} placeholder="For example, force-app/main/default/flows/Lead_Assignment.flow-meta.xml" maxLength={CANVAS_FIELD_CHARACTER_LIMIT} onChange={event => update("path", event.target.value)} />
      <label htmlFor={`${formId}-source`}>Proposed changes</label>
      <textarea id={`${formId}-source`} className={styles.source} value={draft.source ?? ""} rows={12} placeholder="Edit the configuration or source you want to change…" maxLength={CANVAS_FIELD_CHARACTER_LIMIT} spellCheck={false} onChange={event => update("source", event.target.value)} />
      <p className={styles.hint}>This saves a project draft. Applying it to repository files and deploying to an org are separate steps.</p>
    </section>
    <details className={styles.plan}>
      <summary>Work item plan &amp; acceptance criteria</summary>
      <h3>Implementation plan</h3><ol>{item.finding.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <h3>Acceptance criteria</h3><p>{item.finding.validation}</p>
      <h3>Source evidence</h3><p>Observed in {item.finding.orgLabel}.</p><ul>{item.finding.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}</ul>
    </details>
  </article>;
}
