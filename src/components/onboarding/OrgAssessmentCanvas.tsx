"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useSurfaceCanvases } from "@/components/surfaces/surface-canvas-context";
import { ASSESSMENT_ORGS, findingsForScope, type Finding } from "@/lib/onboarding/assessment";
import type { CanvasSpec } from "@/lib/surface-canvas/model";
import { useAssessment } from "./use-assessment";
import { useStartImprovementProject } from "./ProjectCreationCanvas";
import { useOpenImprovementProject } from "./ImprovementProject";
import styles from "./onboarding.module.css";

export function useOpenAssessmentCanvas() {
  const router = useRouter();
  const { openCanvas } = useSurfaceCanvases("govern");
  return (finding?: Finding) => {
    openCanvas("govern", { kind: "org-assessment", title: finding?.title ?? "Org assessment",
      params: finding ? { findingId: finding.id } : undefined });
    router.push("/govern", { scroll: false });
  };
}

export function OrgAssessmentCanvas({ spec }: { spec: CanvasSpec }) {
  const { state, store } = useAssessment();
  const [scope, setScope] = useState(state.scopeOrgIds);
  const router = useRouter();
  const openFinding = useOpenAssessmentCanvas();
  const startProject = useStartImprovementProject();
  const openProject = useOpenImprovementProject();
  const findings = findingsForScope(state.scopeOrgIds);
  const finding = findings.find((entry) => entry.id === spec.params?.findingId);
  const project = finding && state.projects.find((project) => project.workItems.some((item) => item.findingId === finding.id));

  return <article className={styles.projectCanvas}>
    <button type="button" className={styles.textButton} onClick={() => router.push("/", { scroll: false })}>
      <ChevronLeftIcon width={15} height={15} aria-hidden="true" />Back to Today
    </button>
    {spec.params?.findingId ? finding ? <>
      <header className={styles.projectHeader}><p className={styles.kicker}>ORG ASSESSMENT · {finding.category}</p>
        <h1>{finding.title}</h1><p>{finding.summary}</p>
        <p className={styles.quiet}>{ASSESSMENT_ORGS.find((org) => org.id === finding.orgId)?.label} · {finding.priority} priority · {finding.effort}</p>
      </header>
      <div className={styles.metric}><strong>{finding.metric}</strong><span>{finding.metricLabel}</span></div>
      <section><h2>Evidence</h2><ul>{finding.evidence.map((entry) => <li key={entry}>{entry}</li>)}</ul><p className={styles.source}>{finding.source}</p></section>
      <section><h2>What to investigate</h2><p>{finding.hypothesis}</p></section>
      <section><h2>Suggested plan</h2><ol className={styles.planSteps}>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <div className={styles.validation}><h2>Success looks like</h2><p>{finding.validation}</p></div>
      <button type="button" className={styles.primary} onClick={() => project ? openProject(project) : startProject([finding])}>
        {project ? "Open project" : "Start a new project"}<ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </button>
    </> : <><h1>Opportunity unavailable</h1><p>This opportunity is outside your current assessment scope.</p></> : <>
      <header className={styles.projectHeader}><p className={styles.kicker}>GOVERN & OBSERVE</p><h1>Org assessment</h1><p>Choose the connected orgs to assess and review the opportunities your agent finds.</p></header>
      <section className={styles.scope} aria-label="Assessment scope">
        <h2>Assessment scope</h2>
        <div className={styles.orgList}>{ASSESSMENT_ORGS.map((org) => <label key={org.id}>
          <input type="checkbox" checked={scope.includes(org.id)} disabled={org.connection !== "connected"}
            onChange={(event) => setScope(event.target.checked ? [...scope, org.id] : scope.filter((id) => id !== org.id))} />
          <span><strong>{org.label}</strong><small>{org.connection === "expired" ? "Connection expired · excluded" : `${org.kind === "production" ? "Production" : "Sandbox"} · read access`}</small></span>
        </label>)}</div>
        <div className={styles.actions}><button className={styles.primary} type="button" disabled={!scope.length} onClick={() => store.rescan(scope)}>Analyze selected orgs</button>
          {state.status === "running" && <button className={styles.secondary} type="button" onClick={store.pause}>Pause assessment</button>}
          {state.status === "paused" && <button className={styles.secondary} type="button" onClick={store.start}>Resume assessment</button>}
        </div>
        <p role="status">{state.status === "complete" ? "Assessment complete" : state.status === "paused" ? "Assessment paused" : "Assessment in progress"}</p>
      </section>
      {state.status === "complete" && <section className={styles.savedProjects}><h2>Opportunities</h2>
        {findings.length ? findings.map((item) => <button type="button" key={item.id} className={styles.projectLink} onClick={() => openFinding(item)}>
          <span><strong>{item.title}</strong><small>{item.priority} priority · {item.effort}</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </button>) : <p>No findings in the selected demo scope.</p>}
      </section>}
    </>}
  </article>;
}
