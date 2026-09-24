"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { ProjectBriefCanvas } from "./ProjectBriefCanvas";
import type { FindingSnapshot } from "@/lib/assessment/model";
import type { DraftEdit, ProjectDraft } from "@/lib/projects/model";
import { projectDraftView } from "@/lib/projects/creation";
import { ASSESSMENT_ORGS } from "@/lib/onboarding/assessment";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useAssessment } from "./use-assessment";
import { ProjectIntentFields } from "./ProjectIntentFields";
import { CapabilityHeader } from "@/components/surfaces/CapabilityHeader";
import { capabilityForCanvas } from "@/components/surfaces/surface-capabilities";
import capabilityStyles from "@/components/surfaces/CapabilityDraftCanvas.module.css";
import styles from "./onboarding.module.css";

export function ProjectCreationCanvas({ spec }: { spec: CanvasOf<"capability"> }) {
  const { profile } = useDemoProfile();
  return profile?.onboarding ? <ImprovementProjectCreation spec={spec} />
    : <ProjectBriefCanvas spec={spec} />;
}

function ImprovementProjectCreation({ spec }: { spec: CanvasOf<"capability"> }) {
  const { state, store } = useAssessment();
  const { profile } = useDemoProfile();
  const { openImprovementProject, navigateGlobalHome, captureIntent } = useNavigation();
  const persistence = useSyncExternalStore(store.subscribe, store.getPersistenceSnapshot, store.getServerPersistenceSnapshot);
  const { draft, run, findings, sourceAvailable } = projectDraftView(state);
  const [creating, setCreating] = useState(false);
  const queuedCreate = useSyncExternalStore(store.subscribe, () => !!draft && store.isCreatingProject(draft.id), () => false);
  const inFlight = useRef(false);
  async function createProject() {
    if (!draft || !sourceAvailable || inFlight.current || store.isCreatingProject(draft.id) || persistence !== "saved") return;
    const current = captureIntent();
    inFlight.current = true; setCreating(true);
    try {
      const project = await store.createProject(profile?.name ?? "Sam Patel", { draftId: draft.id, commandId: `create:${draft.id}`, expectedRevision: draft.revision });
      if (project && current()) openImprovementProject(project);
    } finally { inFlight.current = false; setCreating(false); }
  }
  if (!draft) return <ProjectBriefCanvas spec={spec} />;
  return <ProjectReview draft={draft} findings={findings} owner={profile?.name ?? "Sam Patel"}
    earlier={draft.runId !== state.currentRunId} sourceAvailable={sourceAvailable} creating={creating || queuedCreate} busy={creating || queuedCreate || persistence !== "saved"}
    persistence={<PersistenceStatus store={store} label="Project draft" />}
    onChange={edit => { if (!inFlight.current && !store.isCreatingProject(draft.id)) store.editDraft(draft.id, edit); }} onBack={navigateGlobalHome} onDiscard={() => { if (!inFlight.current && !store.isCreatingProject(draft.id)) store.discardDraft(draft.id); }} onCreate={createProject}
    sourceDate={run?.completedAt ?? null} />;
}

function ProjectReview({ draft, findings, owner, earlier, sourceAvailable, creating, busy, persistence, onChange, onBack, onDiscard, onCreate, sourceDate }: {
  draft: ProjectDraft; findings: FindingSnapshot[]; owner: string; earlier: boolean; sourceAvailable: boolean; creating: boolean; busy: boolean;
  persistence: React.ReactNode; onChange: (edit: DraftEdit) => void; onBack: () => void; onDiscard: () => void; onCreate: () => void; sourceDate: string | null;
}) {
  const id = useId();
  const selected = findings.filter(finding => draft.findingIds.includes(finding.id));
  const targetAvailable = !draft.targetOrgId || ASSESSMENT_ORGS.some(org => org.id === draft.targetOrgId && org.connection === "connected");
  const capability = capabilityForCanvas("alm", "project")!;
  return <section className={styles.projectCanvas} aria-label="Project creation" data-project-draft-id={draft.id} data-project-source-run={draft.runId}>
    <button className={`${styles.textButton} ${styles.projectBack}`} type="button" onClick={onBack}><ChevronLeftIcon width={15} height={15} aria-hidden="true" />Back to Today</button>
    <CapabilityHeader title={capability.label} description={capability.description} Icon={capability.Icon} />
    <aside className={capabilityStyles.connectionNote} aria-label="Project source"><div>
      <strong>From insight to action</strong><p>Your selected org assessment opportunities provide the starting point for this project.</p>
      {sourceDate && <p>Source assessment completed <time dateTime={sourceDate}>{new Date(sourceDate).toLocaleString()}</time></p>}
      {earlier && <p>This draft keeps the findings from an earlier assessment. Your newer assessment does not change its plan.</p>}
    </div></aside>
    {!sourceAvailable && <p role="status">Some source findings are unavailable or already assigned. Your draft is preserved; review the source assessment before creating a project.</p>}
    {!targetAvailable && <p role="status">The saved deployment target is unavailable. Choose a connected org or leave the target unset.</p>}
    <form className={capabilityStyles.draft} aria-label="Start a project draft" onSubmit={event => { event.preventDefault(); if (!busy && sourceAvailable && selected.length && targetAvailable) onCreate(); }}>
      <div className={capabilityStyles.draftHeading}><h2>Your starting point</h2>{persistence}</div>
      <fieldset className={styles.briefingFields} disabled={creating} aria-busy={creating}>
      <label className={styles.field} htmlFor={`${id}-name`}>Project name<input id={`${id}-name`} required maxLength={100} value={draft.name} onChange={event => onChange({ field: "name", value: event.target.value })} /></label>
      <ProjectIntentFields value={draft} goalLimit={1500} onChange={(field, value) => onChange({ field, value })} />
      <div className={styles.formRow}><label className={styles.field}>Deployment target (optional)<select aria-label="Deployment target (optional)" value={draft.targetOrgId} onChange={event => onChange({ field: "targetOrgId", value: event.target.value })}><option value="">Choose later</option>{!targetAvailable && <option value={draft.targetOrgId}>{draft.targetOrgId} · unavailable</option>}{ASSESSMENT_ORGS.filter(org => org.connection === "connected").map(org => <option key={org.id} value={org.id}>{org.label}</option>)}</select></label><div className={styles.field}>Project owner<strong className={styles.owner}>{owner}</strong></div></div>
      <p className={styles.quiet}>Develop and review changes in your project with version control. A deployment target is where you deploy those changes; selecting it does not change your connected org or deploy anything.</p>
      <h3 className={styles.workHeading}>Planned work items <span>{selected.length}</span></h3><p className={styles.quiet}>Each item retains its captured evidence, implementation steps, and validation criteria.</p>
      <div className={styles.reviewItems}>{findings.map(finding => <div className={styles.reviewItem} key={finding.id}><label><input type="checkbox" checked={draft.findingIds.includes(finding.id)} onChange={event => onChange({ field: "finding", id: finding.id, included: event.target.checked })} /><span><strong>{finding.title}</strong><small>{finding.priority} priority · {finding.effort} · {finding.orgLabel}</small></span></label>{draft.findingIds.includes(finding.id) && <details className={styles.evidence}><summary>Review work item plan</summary><ul>{finding.evidence.map((evidence, index) => <li key={index}>{evidence}</li>)}</ul><ol>{finding.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><p><strong>Validation:</strong> {finding.validation}</p></details>}</div>)}</div>
      <div className={styles.selectionBar}><div><strong>Ready for a first step</strong><span>Saves a project and {selected.length} work items to this demo workspace. No repository or org is provisioned.</span></div><button className={styles.primary} type="submit" disabled={busy || !sourceAvailable || !targetAvailable || !selected.length || !draft.name.trim() || !draft.goal.trim()}>Create project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button></div>
      <button type="button" className={styles.textButton} disabled={busy} onClick={onDiscard}>Discard draft</button>
      </fieldset>
    </form>
  </section>;
}
