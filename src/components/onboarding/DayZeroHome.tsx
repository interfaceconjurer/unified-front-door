"use client";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useId, useState, useSyncExternalStore } from "react";
import { applicationClient } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, LayersIcon, ShieldIcon, SparklesIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { liveAssessmentView, type AssessmentBriefing } from "@/lib/chat/today-snapshot";
import type { FindingSnapshot as Finding } from "@/lib/assessment/model";
import type { DraftEdit } from "@/lib/projects/model";
import { SurfaceNav } from "@/components/front-door/SurfaceNav";
import { ASSESSMENT_ACCOUNT, ASSESSMENT_ORGS, ASSESSMENT_STEPS, accessibleScope, type ProjectDraft } from "@/lib/onboarding/assessment";
import { useAssessment } from "./use-assessment";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import type { DemoProfile } from "@/lib/demo-profiles";
import type { RunView } from "@/lib/agent/contracts";
import type { PersistenceControls } from "@/lib/browser-persistence";
import styles from "./onboarding.module.css";

export function DayZeroHome({ snapshot, profile }: { snapshot?: AssessmentBriefing; profile?: DemoProfile }) {
  return snapshot ? <DayZeroView state={snapshot} profile={profile} snapshot /> : <LiveDayZeroHome />;
}

function LiveDayZeroHome() {
  const { profile } = useDemoProfile();
  const { state: liveState, store } = useAssessment();
  const agent = applicationClient.agent ?? inactiveAgent;
  const execution = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  const state = liveAssessmentView(liveState);
  const { openImprovementProject } = useNavigation();
  const run = execution.data.runs.filter(run => run.assessmentRunId === state.currentRunId).at(-1);
  return <DayZeroView state={state} profile={profile ?? undefined} store={store} run={run} openProject={openImprovementProject}
    retryRun={() => { if (run) void agent.command({ kind: "retry", requestId: crypto.randomUUID(), runId: run.id }); }} />;
}

function DayZeroView({ state, profile, snapshot = false, store, run, openProject, retryRun }: {
  state: AssessmentBriefing; profile?: DemoProfile; snapshot?: boolean;
  store?: ReturnType<typeof useAssessment>["store"]; run?: RunView;
  openProject?: ReturnType<typeof useNavigation>["openImprovementProject"]; retryRun?: () => void;
}) {
  const id = useId();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState(state.scopeOrgIds);
  const [selected, setSelected] = useState<string[] | null>(null);
  const complete = state.status === "complete";
  const availableScope = accessibleScope(state.scopeOrgIds);
  const needsScope = !availableScope.length || availableScope.length !== state.scopeOrgIds.length;
  const findings = state.findings;
  const selectedIds = selected ?? findings.filter((finding) => finding.priority === "High").map((finding) => finding.id);
  const available = findings.filter((finding) => !state.projects.some((project) => project.findingIds.includes(finding.id)));
  const chosen = available.filter((finding) => selectedIds.includes(finding.id));

  function openScope() {
    setScope(accessibleScope(state.scopeOrgIds));
    setScopeOpen(true);
  }
  function runAgain() {
    const connectedScope = accessibleScope(state.scopeOrgIds);
    if (!connectedScope.length) { openScope(); return; }
    store?.rescan(connectedScope);
  }

  function resumeAssessment() {
    if (!accessibleScope(state.scopeOrgIds).length) { openScope(); return; }
    store?.start();
  }

  function reviewProject() {
    if (!chosen.length) return;
    store?.beginDraft(state.currentRunId!, {
      name: "Acme org improvements",
      goal: chosen.map((finding) => finding.impact).join(" "),
      targetOrgId: "sit",
      findingIds: chosen.map((finding) => finding.id),
    });
    requestAnimationFrame(() => {
      document.getElementById(`${id}-review`)?.scrollIntoView({ block: "start" });
      document.getElementById(`${id}-review`)?.focus({ preventScroll: true });
    });
  }

  return <div className={styles.home}>
    {!snapshot && store && <PersistenceStatus store={store} onlyProblems label="Assessment" />}
    {!snapshot && run && <div role="status" data-assessment-run-id={run.id} data-run-status={run.status}>
      {run.status === "pending" ? "Assessment queued. It will continue when the worker is available." : run.status === "failed" ? "Assessment could not complete." : run.status === "cancelled" ? "Assessment attempt cancelled. Resume when you are ready." : null}
      {run.error && <p>{run.error.message}</p>}
      {run.status === "failed" && run.error?.retryable && <button type="button" onClick={retryRun}>Retry assessment</button>}
    </div>}
    {state.truncated && <p className={styles.quiet}>Showing a bounded briefing of {state.totalFindings} findings and {state.totalProjects} projects. Open ALM for all saved projects.</p>}
    {snapshot && <p className={styles.quiet}>Assessment snapshot · Open Today to continue your assessment.</p>}
    <fieldset className={styles.briefingFields} disabled={!!snapshot}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Welcome, {profile?.firstName} <span>YOUR FIRST DAY</span></p>
      <h2 className={styles.briefingTitle}>A fresh perspective on your org.</h2>
      <p>Your agent is getting to know your Salesforce environment.<br />Let’s turn the opportunities it finds into your first project.</p>
    </header>

    <div className={styles.connection}>
      <span className={styles.orgIcon}><DatabaseIcon width={19} height={19} aria-hidden="true" /></span>
      <div><strong>{ASSESSMENT_ACCOUNT.company} workspace</strong><span>{ASSESSMENT_ACCOUNT.domain}</span></div>
      <span className={styles.demoBadge}>Demo connection</span>
      <button className={styles.textButton} type="button" aria-expanded={scopeOpen} aria-controls={`${id}-scope`} onClick={() => { if (scopeOpen) setScopeOpen(false); else openScope(); }}>
        {state.scopeOrgIds.length} orgs in scope <ChevronRightIcon width={14} height={14} aria-hidden="true" />
      </button>
    </div>
    {scopeOpen && <section className={styles.scope} id={`${id}-scope`} aria-label="Assessment scope">
      <h2>Start with the orgs you can access</h2>
      <p>This demo models the connections available to Sam. A domain login alone does not grant access to every company org.</p>
      <div className={styles.orgList}>{ASSESSMENT_ORGS.map((org) => <label key={org.id}>
        <input type="checkbox" checked={scope.includes(org.id)} disabled={org.connection !== "connected"} onChange={(event) => setScope(event.target.checked ? [...scope, org.id] : scope.filter((id) => id !== org.id))} />
        <span><strong>{org.label}</strong><small>{org.connection === "expired" ? "Connection expired · excluded" : `${org.kind === "production" ? "Production" : "Sandbox"} · read access`}</small></span>
      </label>)}</div>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={!accessibleScope(scope).length} onClick={() => { store?.rescan(scope); setScopeOpen(false); }}>Analyze selected orgs</button>
        <button className={styles.secondary} type="button" onClick={() => setScopeOpen(false)}>Cancel</button>
      </div>
      {!accessibleScope(scope).length && <p role="status">Select at least one connected org.</p>}
    </section>}

    {state.draft ? <ProjectReview persistence={snapshot ? undefined : store} owner={profile?.name ?? "Sam Patel"} headingId={`${id}-review`} draft={state.draft} currentRunId={state.currentRunId} findings={available} onChange={(edit) => store?.editDraft(state.draft!.id, edit)} onBack={() => store?.discardDraft(state.draft!.id)} onCreate={async () => {
      const project = await store?.createProject(profile?.name ?? "Sam Patel", { draftId: state.draft!.id, commandId: `create:${state.draft!.id}`, expectedRevision: state.draft!.revision });
      if (project) openProject?.(project);
    }} /> : <>
      <section className={styles.assessment} aria-labelledby={`${id}-assessment`}>
        <div className={styles.assessmentHead}>
          <span className={styles.agentIcon}><SparklesIcon width={21} height={21} aria-hidden="true" /></span>
          <div><p className={styles.kicker}>YOUR AGENT · ORG ASSESSMENT</p><h2 id={`${id}-assessment`}>{complete ? state.findingsAvailable ? "Your first opportunities are ready." : "Original assessment findings unavailable." : needsScope ? "Choose accessible orgs to continue." : state.status === "paused" ? "Assessment paused. Pick up anytime." : "I’m finding where you can make an impact."}</h2></div>
          <span className={styles.scanStatus} data-complete={complete}>{complete ? <CheckIcon width={14} height={14} aria-hidden="true" /> : needsScope ? null : <span className={styles.statusDot} data-running={state.status === "running"} />}{complete ? "Complete" : needsScope ? "Waiting for scope" : state.status === "paused" ? "Paused" : "Analyzing"}</span>
        </div>
        <p className={styles.assessmentCopy}>{complete
          ? !state.findingsAvailable ? "This older assessment did not save its findings. Run again to capture findings and evidence; your saved projects remain available." : `${findings.length} opportunities across ${state.scopeOrgIds.length} orgs, prioritized by observed impact and effort. Review the evidence and choose what matters to your team.`
          : needsScope ? "The previous org connections are unavailable. Choose connected orgs to continue. Your saved work will stay available." : "I’ll review capacity, automations, and release readiness, then suggest a few practical places to start."}</p>
        {!complete && !needsScope && <>
          <progress className={styles.progress} max={ASSESSMENT_STEPS.length} value={state.step} aria-label="Org assessment progress" />
          <ol className={styles.scanSteps}>{ASSESSMENT_STEPS.map((step, index) => <li key={step.title} data-state={index < state.step ? "done" : index === state.step ? "active" : "pending"}>
            <span>{index < state.step ? <CheckIcon width={13} height={13} aria-hidden="true" /> : index + 1}</span><div><strong>{step.title}</strong>{index === state.step && <small>{step.detail}</small>}</div>
          </li>)}</ol>
          <p className={styles.srOnly} role="status">{state.status === "paused" ? "Assessment paused" : ASSESSMENT_STEPS[state.step]?.title}</p>
        </>}
        <div className={styles.assessmentFoot}>
          <span><ShieldIcon width={14} height={14} aria-hidden="true" /> Read-only assessment <span aria-hidden="true">·</span> Simulated findings</span>
          <button className={styles.textButton} type="button" onClick={complete ? runAgain : needsScope ? openScope : state.status === "paused" ? resumeAssessment : store?.pause}>{complete ? "Run again" : needsScope ? "Choose org scope" : state.status === "paused" ? "Resume assessment" : "Pause"}</button>
        </div>
      </section>

      {complete && state.findingsAvailable && <section className={styles.findings} aria-labelledby={`${id}-opportunities`}>
        <div className={styles.sectionHead}><div><h2 id={`${id}-opportunities`}>A few things worth improving <span>{findings.length}</span></h2><p>Select opportunities to shape your first project.</p></div><span className={styles.quiet}>Prioritized by your agent</span></div>
        {findings.length ? <div className={styles.findingGrid}>{findings.map((finding) => {
          const project = state.projects.find((project) => project.findingIds.includes(finding.id));
          return <FindingCard key={finding.id} finding={finding} selected={selectedIds.includes(finding.id) && !project} onToggle={() => setSelected(selectedIds.includes(finding.id) ? selectedIds.filter((id) => id !== finding.id) : [...selectedIds, finding.id])} projectName={project?.name} onOpenProject={() => { if (project) openProject?.(project); }} />;
        })}</div> : <div className={styles.empty}><CheckIcon width={24} height={24} aria-hidden="true" /><h3>No findings in this demo scope</h3><p>This sample has no flagged issues for the selected orgs. It is not a comprehensive health certification.</p><button className={styles.textButton} type="button" onClick={openScope}>Review org scope</button></div>}
        {!!available.length && <div className={styles.selectionBar}>
          <div><strong>{chosen.length} {chosen.length === 1 ? "opportunity" : "opportunities"} selected</strong><span>Your agent will draft the goal and a plan for each work item.</span></div>
          <button type="button" className={styles.primary} disabled={!chosen.length} onClick={reviewProject}>Shape a project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
        </div>}
      </section>}

      {!!state.projects.length && <section className={styles.savedProjects} aria-labelledby={`${id}-projects`}><h2 id={`${id}-projects`}>Your improvement projects</h2>{state.projects.map((project) => <button type="button" key={project.id} className={styles.projectLink} onClick={() => openProject?.(project)}>
        <LayersIcon width={20} height={20} aria-hidden="true" /><span><strong>{project.name}</strong><small>{project.workItemCount} work items · {project.completedCount} complete</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </button>)}</section>}
    </>}
    </fieldset>
    <div className={styles.explore}><p>You can also explore your workspace while your agent gets to know it.</p>{!snapshot && <SurfaceNav />}</div>
  </div>;
}

function FindingCard({ finding, selected, onToggle, projectName, onOpenProject }: {
  finding: Finding; selected: boolean; onToggle: () => void; projectName?: string; onOpenProject: () => void;
}) {
  const org = { label: finding.orgLabel };
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

function ProjectReview({ headingId, draft, findings, onChange, onBack, onCreate, persistence, owner, currentRunId }: {
  persistence?: PersistenceControls; owner: string; currentRunId: string | null;
  headingId: string;
  draft: ProjectDraft; findings: Finding[]; onChange: (edit: DraftEdit) => void; onBack: () => void; onCreate: () => void;
}) {
  const selected = findings.filter((finding) => draft.findingIds.includes(finding.id));
  const targetAvailable = ASSESSMENT_ORGS.some((org) => org.id === draft.targetOrgId && org.kind === "sandbox" && org.connection === "connected");
  return <section className={styles.review} aria-labelledby={headingId}>
    <button className={styles.textButton} type="button" onClick={onBack}><ChevronLeftIcon width={15} height={15} aria-hidden="true" />Back to opportunities</button>
    <div className={styles.sectionHead}><div><p className={styles.kicker}>FROM INSIGHT TO ACTION</p><h2 id={headingId} tabIndex={-1}>Make this project yours.</h2><p>I’ve drafted a starting point. Adjust the scope, then create your project.</p></div></div>
    {persistence && <PersistenceStatus store={persistence} label="Project draft" />}
    {draft.runId !== currentRunId && <p>This draft keeps the findings from an earlier assessment. Your newer assessment does not change its plan.</p>}
    {!targetAvailable && <p role="status">The saved work environment is unavailable. Choose a connected sandbox before creating this project.</p>}
    <form onSubmit={(event) => { event.preventDefault(); if (selected.length && targetAvailable) onCreate(); }}>
      <label className={styles.field}>Project name<input required maxLength={100} value={draft.name} onChange={(event) => onChange({ field: "name", value: event.target.value })} /></label>
      <label className={styles.field}>What should this project achieve?<textarea required rows={3} maxLength={1500} value={draft.goal} onChange={(event) => onChange({ field: "goal", value: event.target.value })} /></label>
      <div className={styles.formRow}><label className={styles.field}>Start work in<select value={draft.targetOrgId} onChange={(event) => onChange({ field: "targetOrgId", value: event.target.value })}>{!targetAvailable && <option value={draft.targetOrgId}>{draft.targetOrgId} · unavailable</option>}{ASSESSMENT_ORGS.filter((org) => org.kind === "sandbox" && org.connection === "connected").map((org) => <option key={org.id} value={org.id}>{org.label}</option>)}</select></label><div className={styles.field}>Project owner<strong className={styles.owner}>{owner}</strong></div></div>
      <h3 className={styles.workHeading}>Planned work items <span>{selected.length}</span></h3><p className={styles.quiet}>Each item carries its evidence, implementation steps, and validation criteria into ALM.</p>
      <div className={styles.reviewItems}>{findings.map((finding) => <div className={styles.reviewItem} key={finding.id}><label><input type="checkbox" checked={draft.findingIds.includes(finding.id)} onChange={(event) => onChange({ field: "finding", id: finding.id, included: event.target.checked })} /><span><strong>{finding.title}</strong><small>{finding.priority} priority · {finding.effort} · {finding.orgLabel}</small></span></label>{draft.findingIds.includes(finding.id) && <details className={styles.evidence}><summary>Review work item plan</summary><ol>{finding.steps.map((step) => <li key={step}>{step}</li>)}</ol><p><strong>Validation:</strong> {finding.validation}</p></details>}</div>)}</div>
      <div className={styles.selectionBar}><div><strong>Ready for a first step</strong><span>Saves a project and {selected.length} work items to this demo workspace. Execution starts with plan review.</span></div><button className={styles.primary} type="submit" disabled={!targetAvailable || !selected.length || !draft.name.trim() || !draft.goal.trim()}>Create project <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button></div>
    </form>
  </section>;
}
