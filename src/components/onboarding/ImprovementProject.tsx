"use client";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { CheckIcon, ChevronRightIcon, LayersIcon, SparklesIcon } from "@/components/icons";
import { ASSESSMENT_ORGS } from "@/lib/onboarding/assessment";
import { orgAvailability } from "@/lib/assessment/model";
import type { ImprovementProject, PlannedWorkItem } from "@/lib/projects/model";
import { BriefProjectPlan } from "./BriefProjectPlan";
import { projectTemplate } from "@/lib/projects/templates";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { projectsForProfile, workForProfile } from "@/lib/workspace/demo-workspace";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useAssessment } from "./use-assessment";
import { useSurfaceCanvasActions } from "@/components/surfaces/surface-canvas-context";
import styles from "./onboarding.module.css";

const STATUS_LABEL: Record<PlannedWorkItem["status"], string> = { todo: "To do", "in-progress": "In progress", done: "Complete" };

export function ImprovementProjectCanvas({ spec }: { spec: CanvasOf<"improvement-project"> }) {
  const { state, store } = useAssessment();
  const { profile } = useDemoProfile();
  const { orgs } = useWorkspace();
  const project = state.projects.find((project) => project.id === spec.params?.projectId);
  if (!project) {
    const sample = profile && projectsForProfile(profile.id).find(project => project.id === spec.params.projectId);
    if (!sample) return <div className={styles.projectCanvas}><h2>Project unavailable</h2><p>This project is not saved for the current profile.</p></div>;
    const work = workForProfile(profile!.id).filter(item => item.projectId === sample.id);
    return <article className={styles.projectCanvas}>
      <header className={styles.projectHeader}>
        <p className={styles.kicker}><LayersIcon width={16} height={16} aria-hidden="true" /> ALM · PROJECT</p>
        <h1>{sample.name}</h1><p>{sample.description}</p>
        <div className={styles.projectMeta}><span>Deployment target · {orgs.find(org => org.id === sample.defaultOrgId)?.label ?? "No target org"}</span><span>Sample project</span></div>
      </header>
      <div className={styles.projectStats}><div><strong>{work.length}</strong><span>Work items</span></div><div><strong>{sample.worktrees.filter(tree => !tree.isPrimary).length}</strong><span>Worktrees</span></div><div><strong>{sample.apps.length}</strong><span>Apps</span></div></div>
      <section className={styles.evidence}><h2>Project work</h2>
        {work.length ? <ul>{work.map(item => <li key={item.id}><strong>{item.title}</strong><p>{item.summary}</p></li>)}</ul> : <p>No work items yet.</p>}
      </section>
    </article>;
  }
  if (project.source === "brief") return <BriefProjectPlan project={project} />;
  return <ProjectPlan key={project.id} project={project} onStatusChange={(itemId, status) => store.setWorkItemStatus(project.id, itemId, status)} />;
}

function ProjectPlan({ project, onStatusChange }: { project: ImprovementProject; onStatusChange: (itemId: string, status: PlannedWorkItem["status"]) => void }) {
  const { store } = useAssessment();
  const { openCanvas } = useSurfaceCanvasActions();
  const [expanded, setExpanded] = useState<string | null>(project.workItems[0]?.id ?? null);
  const completed = project.workItems.filter((item) => item.status === "done").length;
  const next = project.workItems.find((item) => item.status !== "done");
  const target = orgAvailability(project.targetOrgId ?? "", ASSESSMENT_ORGS);
  return <article className={styles.projectCanvas}>
    <header className={styles.projectHeader}><p className={styles.kicker}><LayersIcon width={16} height={16} aria-hidden="true" /> ALM · IMPROVEMENT PROJECT</p><h1>{project.name}</h1><p>{project.goal}</p><div className={styles.projectMeta}><span>Owner · {project.owner}</span><span>Deployment target · {project.targetOrgId ? target.label : "Choose later"}</span><span>Type · {projectTemplate(project.projectType).label}</span><span>Created from org assessment</span>{project.targetOrgId && !target.available && <span>{target.reason} · saved plan preserved</span>}</div></header>
    <div className={styles.projectStats}><div><strong>{project.workItems.length}</strong><span>Planned work items</span></div><div><strong>{completed}/{project.workItems.length}</strong><span>Complete</span></div><div><strong>{project.workItems.filter((item) => item.priority === "High").length}</strong><span>High priority</span></div></div>
    {project.context && <section className={styles.evidence} aria-label="Project context"><h2>Project context</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.context}</p></section>}
    {next ? <div className={styles.nextStep}><SparklesIcon width={21} height={21} aria-hidden="true" /><div><strong>Your next step</strong><p>Review the evidence and plan for “{next.title}”, then develop and review the changes in your project.</p></div><button type="button" className={styles.secondary} onClick={() => { setExpanded(next.id); document.getElementById(`work-${next.id}`)?.scrollIntoView({ block: "nearest" }); }}>Review plan</button></div> : <p className={styles.success} role="status"><CheckIcon width={18} height={18} aria-hidden="true" />All work items are marked complete.</p>}
    <section aria-labelledby="project-work-items-heading"><div className={styles.sectionHead}><div><h2 id="project-work-items-heading">Work items & plans</h2><p>Develop and review changes in version control, validate, then deploy to an explicitly chosen org.</p></div></div>
      <div className={styles.workItems}>{project.workItems.map((item, index) => {
        const finding = item.finding;
        const open = expanded === item.id;
        return <section key={item.id} id={`work-${item.id}`} className={styles.workItem} aria-label={`Work item: ${item.title}`}>
          <button type="button" className={styles.workItemHeader} aria-expanded={open} aria-controls={`plan-${item.id}`} onClick={() => setExpanded(open ? null : item.id)}><span className={styles.itemNumber}>WI-{index + 1}</span><span><strong>{item.title}</strong><small>{item.priority} priority · {finding.effort}</small></span><span className={styles.itemStatus} data-status={item.status}>{STATUS_LABEL[item.status]}</span><ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
          {open && <div id={`plan-${item.id}`} className={styles.plan}>
            <button type="button" className={styles.secondary} onClick={() => openCanvas("build", finding.sourceFindingId === "case-access" ? {
              kind: "org-resource", title: "Service Reps", params: { orgId: finding.orgId, resourceType: "permission-set-group", apiName: "Service_Reps", projectId: project.id },
            } : {
              kind: "work-item-change", title: item.title, params: { projectId: project.id, workItemId: item.id },
            })}>{finding.sourceFindingId === "case-access" ? "Review permissions" : "Make a change in Build & Setup"} <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
            {finding.provenance.evidence === "legacy-unavailable" && <p role="status">Original assessment evidence was not saved by this older prototype. Your work item and status are preserved.</p>}
            <h3>Why this work matters</h3><p>{finding.impact}</p><p className={styles.quiet}>Observed in {finding.orgLabel}. Project work does not change the source org. Deploy only when the changes are ready.</p>
            <details className={styles.evidence}><summary>Assessment evidence</summary><ul>{finding.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><p className={styles.source}>{finding.source}</p><p>{finding.hypothesis}</p></details>
            <h3>Implementation plan</h3><ol className={styles.planSteps}>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <div className={styles.validation}><h3>Acceptance criteria</h3><p>{finding.validation}</p></div>
            <div className={styles.planFooter}><label>Status<select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value as PlannedWorkItem["status"])}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span>{item.status === "done" ? "Marked complete by you" : "Update as you work through the plan"}</span></div>
          </div>}
        </section>;
      })}</div>
    </section>
    <p className={styles.localNote}>Demo project · <PersistenceStatus store={store} />. Status changes track your work; they do not run changes or deploy to an org.</p>
  </article>;
}
