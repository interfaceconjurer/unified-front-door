"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useSurfaceCanvases } from "@/components/surfaces/surface-canvas-context";
import { useConversationStore } from "@/components/chat/ConversationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { sessionKey as workspaceSessionKey } from "@/lib/workspace/model";
import { ASSESSMENT_ORGS, findingsForScope, projectCreatedReply, workspaceProject, type Finding, type ProjectDraft } from "@/lib/onboarding/assessment";
import type { CanvasSpec } from "@/lib/surface-canvas/model";
import { useAssessment } from "./use-assessment";
import styles from "./onboarding.module.css";

export function useStartImprovementProject() {
  const { store } = useAssessment();
  const { openCanvas } = useSurfaceCanvases("alm");
  const router = useRouter();
  return (findings: Finding[]) => {
    if (!findings.length) return;
    const saved = store.getSnapshot().draft;
    store.saveDraft({
      name: saved?.name ?? "Acme org improvements",
      goal: saved?.goal ?? findings.map((finding) => finding.impact).join(" "),
      targetOrgId: saved?.targetOrgId ?? "sit",
      findingIds: findings.map((finding) => finding.id),
    });
    openCanvas("alm", { kind: "project-creation", title: "New project" });
    router.push("/alm", { scroll: false });
  };
}

export function ProjectCreationCanvas({ spec }: { spec: CanvasSpec }) {
  const headingId = useId();
  const { profile } = useDemoProfile();
  const { state, store } = useAssessment();
  const { createWorkspace } = useWorkspace();
  const conversationStore = useConversationStore();
  const { closeCanvas, openCanvas } = useSurfaceCanvases("alm");
  const router = useRouter();
  const available = findingsForScope(state.scopeOrgIds).filter((finding) =>
    !state.projects.some((project) => project.workItems.some((item) => item.findingId === finding.id)));
  if (!state.draft || state.status !== "complete") return <section className={`${styles.projectCanvas} ${styles.review}`}>
    <h1>Start a new project</h1>
    <p>Choose opportunities from your completed org assessment to start a project.</p>
    <button type="button" className={styles.primary} onClick={() => router.push("/", { scroll: false })}>Choose opportunities</button>
  </section>;
  return <ProjectReview headingId={headingId} draft={state.draft} findings={available}
    onChange={store.saveDraft} onBack={() => router.push("/", { scroll: false })} onCreate={() => createWorkspace(() => {
      const project = store.createProject(profile?.name ?? "Sam Patel", (project) => {
        conversationStore.dispatch(workspaceSessionKey(project.id, "main"), {
          type: "surface", scopeKey: "alm", label: "ALM", reply: projectCreatedReply(project),
        });
      });
      if (!project) return null;
      closeCanvas("alm", spec.id);
      openCanvas("alm", { kind: "improvement-project", title: project.name, params: { projectId: project.id } });
      return workspaceProject(project);
    })} />;
}

function ProjectReview({ headingId, draft, findings, onChange, onBack, onCreate }: {
  headingId: string;
  draft: ProjectDraft; findings: Finding[]; onChange: (draft: ProjectDraft) => void; onBack: () => void; onCreate: () => void;
}) {
  const { profile } = useDemoProfile();
  const selected = findings.filter((finding) => draft.findingIds.includes(finding.id));
  return <section className={`${styles.projectCanvas} ${styles.review}`} aria-labelledby={headingId}>
    <button className={styles.textButton} type="button" onClick={onBack}><ChevronLeftIcon width={15} height={15} aria-hidden="true" />Back to opportunities</button>
    <div className={styles.sectionHead}><div><p className={styles.kicker}>FROM INSIGHT TO ACTION</p><h1 id={headingId} tabIndex={-1}>Start a new project</h1><p>I’ve drafted a starting point. Adjust the scope, then create your project.</p></div></div>
    <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onCreate(); }}>
      <label className={styles.field}>Project name<input required maxLength={100} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
      <label className={styles.field}>What should this project achieve?<textarea required rows={3} maxLength={1500} value={draft.goal} onChange={(event) => onChange({ ...draft, goal: event.target.value })} /></label>
      <div className={styles.formRow}><label className={styles.field}>Start work in<select value={draft.targetOrgId} onChange={(event) => onChange({ ...draft, targetOrgId: event.target.value })}>{ASSESSMENT_ORGS.filter((org) => org.kind === "sandbox" && org.connection === "connected").map((org) => <option key={org.id} value={org.id}>{org.label}</option>)}</select></label><div className={styles.field}>Project owner<strong className={styles.owner}>{profile?.name}</strong></div></div>
      <h3 className={styles.workHeading}>Planned work items <span>{selected.length}</span></h3><p className={styles.quiet}>Each item includes its evidence, implementation steps, and validation criteria.</p>
      <div className={styles.reviewItems}>{findings.map((finding) => <div className={styles.reviewItem} key={finding.id}><label><input type="checkbox" checked={draft.findingIds.includes(finding.id)} onChange={(event) => onChange({ ...draft, findingIds: event.target.checked ? [...draft.findingIds, finding.id] : draft.findingIds.filter((id) => id !== finding.id) })} /><span><strong>{finding.title}</strong><small>{finding.priority} priority · {finding.effort} · {ASSESSMENT_ORGS.find((org) => org.id === finding.orgId)?.label}</small></span></label>{draft.findingIds.includes(finding.id) && <details className={styles.evidence}><summary>Review work item plan</summary><ol>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><strong>Validation:</strong> {finding.validation}</p></details>}</div>)}</div>
      <div className={styles.selectionBar}><div><strong>Ready for a first step</strong><span>Create a project with {selected.length} work items, then review the plan before starting work.</span></div><button className={styles.primary} type="submit" disabled={!selected.length || !draft.name.trim() || !draft.goal.trim()}>Create project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button></div>
    </form>
  </section>;
}
