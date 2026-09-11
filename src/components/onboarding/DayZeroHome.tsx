"use client";

import { useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, LayersIcon, ShieldIcon, SparklesIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { SurfaceNav } from "@/components/front-door/SurfaceNav";
import { ASSESSMENT_ACCOUNT, ASSESSMENT_ORGS, ASSESSMENT_STEPS, findingsForScope, type Finding, type ProjectDraft } from "@/lib/onboarding/assessment";
import { useAssessment } from "./use-assessment";
import { useOpenImprovementProject } from "./ImprovementProject";
import styles from "./onboarding.module.css";

export function DayZeroHome() {
  const { profile } = useDemoProfile();
  const { state, store } = useAssessment();
  const openProject = useOpenImprovementProject();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState(state.scopeOrgIds);
  const [selected, setSelected] = useState<string[]>(["api-headroom", "lead-routing"]);
  const complete = state.status === "complete";
  const findings = findingsForScope(state.scopeOrgIds);
  const available = findings.filter((finding) => !state.projects.some((project) => project.workItems.some((item) => item.findingId === finding.id)));
  const chosen = available.filter((finding) => selected.includes(finding.id));

  function reviewProject() {
    if (!chosen.length) return;
    store.saveDraft({
      name: "Acme org improvements",
      goal: chosen.map((finding) => finding.impact).join(" "),
      targetOrgId: "sit",
      findingIds: chosen.map((finding) => finding.id),
    });
    requestAnimationFrame(() => {
      document.getElementById("review-heading")?.scrollIntoView({ block: "start" });
      document.getElementById("review-heading")?.focus({ preventScroll: true });
    });
  }

  return <div className={styles.home}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Welcome, {profile?.firstName} <span>YOUR FIRST DAY</span></p>
      <h1 id="front-door-heading">A fresh perspective on your org.</h1>
      <p>Your agent is getting to know your Salesforce environment.<br />Let’s turn the opportunities it finds into your first project.</p>
    </header>

    <div className={styles.connection}>
      <span className={styles.orgIcon}><DatabaseIcon width={19} height={19} aria-hidden="true" /></span>
      <div><strong>{ASSESSMENT_ACCOUNT.company} workspace</strong><span>{ASSESSMENT_ACCOUNT.domain}</span></div>
      <span className={styles.demoBadge}>Demo connection</span>
      <button className={styles.textButton} type="button" aria-expanded={scopeOpen} aria-controls="assessment-scope" onClick={() => { setScope(state.scopeOrgIds); setScopeOpen(!scopeOpen); }}>
        {state.scopeOrgIds.length} orgs in scope <ChevronRightIcon width={14} height={14} aria-hidden="true" />
      </button>
    </div>
    {scopeOpen && <section className={styles.scope} id="assessment-scope" aria-label="Assessment scope">
      <h2>Start with the orgs you can access</h2>
      <p>This demo models the connections available to Sam. A domain login alone does not grant access to every company org.</p>
      <div className={styles.orgList}>{ASSESSMENT_ORGS.map((org) => <label key={org.id}>
        <input type="checkbox" checked={scope.includes(org.id)} disabled={org.connection !== "connected"} onChange={(event) => setScope(event.target.checked ? [...scope, org.id] : scope.filter((id) => id !== org.id))} />
        <span><strong>{org.label}</strong><small>{org.connection === "expired" ? "Connection expired · excluded" : `${org.kind === "production" ? "Production" : "Sandbox"} · read access`}</small></span>
      </label>)}</div>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={!scope.length} onClick={() => { store.rescan(scope); setScopeOpen(false); }}>Analyze selected orgs</button>
        <button className={styles.secondary} type="button" onClick={() => setScopeOpen(false)}>Cancel</button>
      </div>
      {!scope.length && <p role="status">Select at least one connected org.</p>}
    </section>}

    {state.draft ? <ProjectReview draft={state.draft} findings={available} onChange={store.saveDraft} onBack={() => store.saveDraft(null)} onCreate={() => {
      const project = store.createProject(profile?.name ?? "Sam Patel");
      if (project) openProject(project);
    }} /> : <>
      <section className={styles.assessment} aria-labelledby="assessment-title">
        <div className={styles.assessmentHead}>
          <span className={styles.agentIcon}><SparklesIcon width={21} height={21} aria-hidden="true" /></span>
          <div><p className={styles.kicker}>YOUR AGENT · ORG ASSESSMENT</p><h2 id="assessment-title">{complete ? "Your first opportunities are ready." : state.status === "paused" ? "Assessment paused. Pick up anytime." : "I’m finding where you can make an impact."}</h2></div>
          <span className={styles.scanStatus} data-complete={complete}>{complete ? <CheckIcon width={14} height={14} aria-hidden="true" /> : <span className={styles.statusDot} data-running={state.status === "running"} />}{complete ? "Complete" : state.status === "paused" ? "Paused" : "Analyzing"}</span>
        </div>
        <p className={styles.assessmentCopy}>{complete
          ? `${findings.length} opportunities across ${state.scopeOrgIds.length} orgs, prioritized by observed impact and effort. Review the evidence and choose what matters to your team.`
          : "I’ll review capacity, automations, and release readiness, then suggest a few practical places to start."}</p>
        {!complete && <>
          <progress className={styles.progress} max={ASSESSMENT_STEPS.length} value={state.step} aria-label="Org assessment progress" />
          <ol className={styles.scanSteps}>{ASSESSMENT_STEPS.map((step, index) => <li key={step.title} data-state={index < state.step ? "done" : index === state.step ? "active" : "pending"}>
            <span>{index < state.step ? <CheckIcon width={13} height={13} aria-hidden="true" /> : index + 1}</span><div><strong>{step.title}</strong>{index === state.step && <small>{step.detail}</small>}</div>
          </li>)}</ol>
          <p className={styles.srOnly} role="status">{state.status === "paused" ? "Assessment paused" : ASSESSMENT_STEPS[state.step]?.title}</p>
        </>}
        <div className={styles.assessmentFoot}>
          <span><ShieldIcon width={14} height={14} aria-hidden="true" /> Read-only assessment <span aria-hidden="true">·</span> Simulated findings</span>
          <button className={styles.textButton} type="button" onClick={complete ? () => store.rescan(state.scopeOrgIds) : state.status === "paused" ? store.start : store.pause}>{complete ? "Run again" : state.status === "paused" ? "Resume assessment" : "Pause"}</button>
        </div>
      </section>

      {complete && <section className={styles.findings} aria-labelledby="opportunities-heading">
        <div className={styles.sectionHead}><div><h2 id="opportunities-heading">A few things worth improving <span>{findings.length}</span></h2><p>Select opportunities to shape your first project.</p></div><span className={styles.quiet}>Prioritized by your agent</span></div>
        {findings.length ? <div className={styles.findingGrid}>{findings.map((finding) => {
          const project = state.projects.find((project) => project.workItems.some((item) => item.findingId === finding.id));
          return <FindingCard key={finding.id} finding={finding} selected={selected.includes(finding.id) && !project} onToggle={() => setSelected(selected.includes(finding.id) ? selected.filter((id) => id !== finding.id) : [...selected, finding.id])} projectName={project?.name} onOpenProject={() => { if (project) openProject(project); }} />;
        })}</div> : <div className={styles.empty}><CheckIcon width={24} height={24} aria-hidden="true" /><h3>No findings in this demo scope</h3><p>This sample has no flagged issues for the selected orgs. It is not a comprehensive health certification.</p><button className={styles.textButton} type="button" onClick={() => { setScope(state.scopeOrgIds); setScopeOpen(true); }}>Review org scope</button></div>}
        {!!available.length && <div className={styles.selectionBar}>
          <div><strong>{chosen.length} {chosen.length === 1 ? "opportunity" : "opportunities"} selected</strong><span>Your agent will draft the goal and a plan for each work item.</span></div>
          <button type="button" className={styles.primary} disabled={!chosen.length} onClick={reviewProject}>Shape a project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
        </div>}
      </section>}

      {!!state.projects.length && <section className={styles.savedProjects} aria-labelledby="your-projects-heading"><h2 id="your-projects-heading">Your improvement projects</h2>{state.projects.map((project) => <button type="button" key={project.id} className={styles.projectLink} onClick={() => openProject(project)}>
        <LayersIcon width={20} height={20} aria-hidden="true" /><span><strong>{project.name}</strong><small>{project.workItems.length} work items · {project.workItems.filter((item) => item.status === "done").length} complete</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </button>)}</section>}
    </>}
    <div className={styles.explore}><p>You can also explore your workspace while your agent gets to know it.</p><SurfaceNav /></div>
  </div>;
}

function FindingCard({ finding, selected, onToggle, projectName, onOpenProject }: {
  finding: Finding; selected: boolean; onToggle: () => void; projectName?: string; onOpenProject: () => void;
}) {
  const org = ASSESSMENT_ORGS.find((org) => org.id === finding.orgId);
  return <article className={styles.findingCard} data-selected={selected}>
    <div className={styles.findingTop}><span className={styles.priority} data-priority={finding.priority}>{finding.priority} priority</span><span>{finding.category}</span></div>
    <h3>{finding.title}</h3><p>{finding.summary}</p>
    <div className={styles.metric}><strong>{finding.metric}</strong><span>{finding.metricLabel}<small>{org?.label}</small></span></div>
    <p className={styles.impact}>{finding.impact}</p>
    <details className={styles.evidence}><summary>Evidence & suggested approach</summary><div>
      <ul>{finding.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
      <p className={styles.source}>{finding.source}</p><h4>What to investigate</h4><p>{finding.hypothesis}</p>
      <h4>Suggested plan</h4><ol>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol><h4>Success looks like</h4><p>{finding.validation}</p>
    </div></details>
    <div className={styles.findingFoot}><span>Estimated effort · {finding.effort}</span>{projectName ? <button className={styles.textButton} type="button" onClick={onOpenProject}>In project <ChevronRightIcon width={14} height={14} aria-hidden="true" /><span className={styles.srOnly}>{projectName}</span></button> : <label><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Include ${finding.title}`} />{selected ? "Selected" : "Select"}</label>}</div>
  </article>;
}

function ProjectReview({ draft, findings, onChange, onBack, onCreate }: {
  draft: ProjectDraft; findings: Finding[]; onChange: (draft: ProjectDraft) => void; onBack: () => void; onCreate: () => void;
}) {
  const { profile } = useDemoProfile();
  const selected = findings.filter((finding) => draft.findingIds.includes(finding.id));
  return <section className={styles.review} aria-labelledby="review-heading">
    <button className={styles.textButton} type="button" onClick={onBack}><ChevronLeftIcon width={15} height={15} aria-hidden="true" />Back to opportunities</button>
    <div className={styles.sectionHead}><div><p className={styles.kicker}>FROM INSIGHT TO ACTION</p><h2 id="review-heading" tabIndex={-1}>Make this project yours.</h2><p>I’ve drafted a starting point. Adjust the scope, then create your project.</p></div></div>
    <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onCreate(); }}>
      <label className={styles.field}>Project name<input required maxLength={100} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
      <label className={styles.field}>What should this project achieve?<textarea required rows={3} maxLength={1500} value={draft.goal} onChange={(event) => onChange({ ...draft, goal: event.target.value })} /></label>
      <div className={styles.formRow}><label className={styles.field}>Start work in<select value={draft.targetOrgId} onChange={(event) => onChange({ ...draft, targetOrgId: event.target.value })}>{ASSESSMENT_ORGS.filter((org) => org.kind === "sandbox" && org.connection === "connected").map((org) => <option key={org.id} value={org.id}>{org.label}</option>)}</select></label><div className={styles.field}>Project owner<strong className={styles.owner}>{profile?.name}</strong></div></div>
      <h3 className={styles.workHeading}>Planned work items <span>{selected.length}</span></h3><p className={styles.quiet}>Each item carries its evidence, implementation steps, and validation criteria into ALM.</p>
      <div className={styles.reviewItems}>{findings.map((finding) => <div className={styles.reviewItem} key={finding.id}><label><input type="checkbox" checked={draft.findingIds.includes(finding.id)} onChange={(event) => onChange({ ...draft, findingIds: event.target.checked ? [...draft.findingIds, finding.id] : draft.findingIds.filter((id) => id !== finding.id) })} /><span><strong>{finding.title}</strong><small>{finding.priority} priority · {finding.effort} · {ASSESSMENT_ORGS.find((org) => org.id === finding.orgId)?.label}</small></span></label>{draft.findingIds.includes(finding.id) && <details className={styles.evidence}><summary>Review work item plan</summary><ol>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><strong>Validation:</strong> {finding.validation}</p></details>}</div>)}</div>
      <div className={styles.selectionBar}><div><strong>Ready for a first step</strong><span>Creates a project and {selected.length} work items in this browser. Execution starts with plan review.</span></div><button className={styles.primary} type="submit" disabled={!selected.length || !draft.name.trim() || !draft.goal.trim()}>Create project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button></div>
    </form>
  </section>;
}
