"use client";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useState } from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { CheckIcon, ChevronRightIcon, LayersIcon, SparklesIcon } from "@/components/icons";
import { ASSESSMENT_ORGS } from "@/lib/onboarding/assessment";
import { orgAvailability } from "@/lib/assessment/model";
import type { ImprovementProject, PlannedWorkItem } from "@/lib/projects/model";
import { projectTemplate } from "@/lib/projects/templates";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useAssessment } from "./use-assessment";
import styles from "./onboarding.module.css";

export function useOpenImprovementProject() {
  return useNavigation().openImprovementProject;
}

const STATUS_LABEL: Record<PlannedWorkItem["status"], string> = { todo: "To do", "in-progress": "In progress", done: "Complete" };

export function ImprovementProjectCanvas({ spec }: { spec: CanvasOf<"improvement-project"> }) {
  const { state, store } = useAssessment();
  const project = state.projects.find((project) => project.id === spec.params?.projectId);
  if (!project) return <div className={styles.projectCanvas}><h2>Project unavailable</h2><p>This project is not saved for the current profile.</p></div>;
  return <ProjectPlan key={project.id} project={project} onStatusChange={(itemId, status) => store.setWorkItemStatus(project.id, itemId, status)} />;
}

function ProjectPlan({ project, onStatusChange }: { project: ImprovementProject; onStatusChange: (itemId: string, status: PlannedWorkItem["status"]) => void }) {
  const { store } = useAssessment();
  const [expanded, setExpanded] = useState<string | null>(project.workItems[0]?.id ?? null);
  const completed = project.workItems.filter((item) => item.status === "done").length;
  const next = project.workItems.find((item) => item.status !== "done");
  const target = orgAvailability(project.targetOrgId, ASSESSMENT_ORGS);
  return <article className={styles.projectCanvas}>
    <header className={styles.projectHeader}><p className={styles.kicker}><LayersIcon width={16} height={16} aria-hidden="true" /> ALM · IMPROVEMENT PROJECT</p><h1>{project.name}</h1><p>{project.goal}</p><div className={styles.projectMeta}><span>Owner · {project.owner}</span><span>Work environment · {target?.label}</span><span>Type · {projectTemplate(project.projectType).label}</span><span>Created from org assessment</span>{!target.available && <span>{target.reason} · saved plan preserved</span>}</div></header>
    <div className={styles.projectStats}><div><strong>{project.workItems.length}</strong><span>Planned work items</span></div><div><strong>{completed}/{project.workItems.length}</strong><span>Complete</span></div><div><strong>{project.workItems.filter((item) => item.priority === "High").length}</strong><span>High priority</span></div></div>
    {project.context && <section className={styles.evidence} aria-label="Project context"><h2>Project context</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.context}</p></section>}
    {next ? <div className={styles.nextStep}><SparklesIcon width={21} height={21} aria-hidden="true" /><div><strong>Your next step</strong><p>Review the evidence and plan for “{next.title}”, then begin with a sandbox baseline.</p></div><button type="button" className={styles.secondary} onClick={() => { setExpanded(next.id); document.getElementById(`work-${next.id}`)?.scrollIntoView({ block: "nearest" }); }}>Review plan</button></div> : <p className={styles.success} role="status"><CheckIcon width={18} height={18} aria-hidden="true" />All work items are marked complete.</p>}
    <section aria-labelledby="project-work-items-heading"><div className={styles.sectionHead}><div><h2 id="project-work-items-heading">Work items & plans</h2><p>Review, implement in a sandbox, validate, then prepare the release.</p></div></div>
      <div className={styles.workItems}>{project.workItems.map((item, index) => {
        const finding = item.finding;
        const open = expanded === item.id;
        return <section key={item.id} id={`work-${item.id}`} className={styles.workItem}>
          <button type="button" className={styles.workItemHeader} aria-expanded={open} aria-controls={`plan-${item.id}`} onClick={() => setExpanded(open ? null : item.id)}><span className={styles.itemNumber}>WI-{index + 1}</span><span><strong>{item.title}</strong><small>{item.priority} priority · {finding.effort}</small></span><span className={styles.itemStatus} data-status={item.status}>{STATUS_LABEL[item.status]}</span><ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
          {open && <div id={`plan-${item.id}`} className={styles.plan}>
            {finding.provenance.evidence === "legacy-unavailable" && <p role="status">Original assessment evidence was not saved by this older prototype. Your work item and status are preserved.</p>}
            <h3>Why this work matters</h3><p>{finding.impact}</p><p className={styles.quiet}>Observed in {finding.orgLabel}. Investigate and validate in {target?.label}.</p>
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

export function ImprovementProjectsOverview() {
  const { state, store } = useAssessment();
  const { target } = useWorkspace();
  const openProject = useOpenImprovementProject();
  const { navigateGlobalHome, openProjectCreation } = useNavigation();
  if (target.projectId) {
    const project = state.projects.find(project => project.id === target.projectId);
    return project ? <ProjectPlan key={project.id} project={project} onStatusChange={(id, status) => store.setWorkItemStatus(project.id, id, status)} />
      : <section className={styles.projectCanvas}><h2>Project unavailable</h2><p>This project is not saved for the current profile.</p></section>;
  }
  return <section className={styles.projectCanvas} aria-labelledby="improvement-projects-heading"><p className={styles.kicker}>APPLICATION LIFECYCLE MANAGEMENT</p><h1 id="improvement-projects-heading">Turn opportunities into progress.</h1><p>Your org assessment connects each improvement to a project, work items, and a plan.</p><div className={styles.savedProjects}>{state.projects.map((project) => <button className={styles.projectLink} key={project.id} type="button" onClick={() => openProject(project)}><LayersIcon width={20} height={20} aria-hidden="true" /><span><strong>{project.name}</strong><small>{project.workItems.length} work items · {project.workItems.filter((item) => item.status === "done").length} complete</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>)}</div><div className={styles.actions}><button type="button" className={styles.primary} onClick={openProjectCreation}>Start a project</button><button type="button" className={styles.secondary} onClick={navigateGlobalHome}>Return to org assessment</button></div></section>;
}
