"use client";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useId, useState, useSyncExternalStore } from "react";
import { applicationClient } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";
import { CheckIcon, ChevronRightIcon, DatabaseIcon, LayersIcon, ShieldIcon, SparklesIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { liveAssessmentView, type AssessmentBriefing } from "@/lib/chat/today-snapshot";
import { assessmentForOrg } from "@/lib/assessment/selected-org";
import type { FindingSnapshot as Finding } from "@/lib/assessment/model";
import { SurfaceNav } from "@/components/front-door/SurfaceNav";
import { ASSESSMENT_ACCOUNT, ASSESSMENT_ORGS, ASSESSMENT_STEPS, accessibleScope } from "@/lib/onboarding/assessment";
import { assessmentCanvas } from "@/lib/assessment/canvas";
import { useStartImprovementProject } from "./use-start-improvement-project";
import { useAssessment } from "./use-assessment";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import type { DemoProfile } from "@/lib/demo-profiles";
import type { RunView } from "@/lib/agent/contracts";
import styles from "./onboarding.module.css";

export function DayZeroHome({ snapshot, profile }: { snapshot?: AssessmentBriefing; profile?: DemoProfile }) {
  return snapshot ? <DayZeroView state={snapshot} profile={profile} snapshot /> : <LiveDayZeroHome />;
}

function LiveDayZeroHome() {
  const { profile } = useDemoProfile();
  const { state: liveState, store } = useAssessment();
  const agent = applicationClient.agent ?? inactiveAgent;
  const execution = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  const { startProject, pending: startingProject } = useStartImprovementProject();
  const { openImprovementProject, openProjectCreation, openCanvas, capabilityScope } = useNavigation();
  const state = liveAssessmentView(assessmentForOrg(liveState, capabilityScope.orgId ?? null));
  const blockedByOtherRun = liveState.status === "running" && liveState.currentRunId !== state.currentRunId;
  const run = execution.data.runs.filter(run => run.assessmentRunId === state.currentRunId).at(-1);
  return <DayZeroView key={capabilityScope.orgId ?? "unbound"} state={state} profile={profile ?? undefined} store={store} blockedByOtherRun={blockedByOtherRun} run={run} openProject={openImprovementProject} startProject={startProject} startingProject={startingProject} continueProject={openProjectCreation}
    openAssessment={finding => openCanvas("build", assessmentCanvas(capabilityScope, finding?.runId ?? state.currentRunId, finding))}
    retryRun={() => { if (run) void agent.command({ kind: "retry", requestId: crypto.randomUUID(), runId: run.id }); }} />;
}

function DayZeroView({ state, profile, snapshot = false, store, run, openProject, retryRun, openAssessment, startProject, startingProject, continueProject, blockedByOtherRun }: {
  state: AssessmentBriefing; profile?: DemoProfile; snapshot?: boolean; blockedByOtherRun?: boolean;
  store?: ReturnType<typeof useAssessment>["store"]; run?: RunView;
  startProject?: (findings: Finding[]) => Promise<void>; startingProject?: boolean; continueProject?: () => void;
  openAssessment?: (finding?: Finding) => void;
  openProject?: ReturnType<typeof useNavigation>["openImprovementProject"]; retryRun?: () => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string[] | null>(null);
  const complete = state.status === "complete";
  const idle = state.status === "idle";
  const availableScope = accessibleScope(state.scopeOrgIds);
  const needsScope = !availableScope.length || availableScope.length !== state.scopeOrgIds.length;
  const orgLabel = ASSESSMENT_ORGS.find(org => org.id === state.scopeOrgIds[0])?.label ?? "Selected org";
  const findings = state.findings;
  const selectedIds = selected ?? findings.filter((finding) => finding.priority === "High").map((finding) => finding.id);
  const available = findings.filter((finding) => !state.projects.some((project) => project.findingIds.includes(finding.id)));
  const visibleFindings = snapshot ? findings : available;
  const chosen = available.filter((finding) => selectedIds.includes(finding.id));

  function openScope() {
    openAssessment?.();
  }
  function runAgain() {
    const connectedScope = accessibleScope(state.scopeOrgIds);
    if (!connectedScope.length) { openScope(); return; }
    store?.rescan(connectedScope);
  }

  function resumeAssessment() {
    if (!accessibleScope(state.scopeOrgIds).length) { openScope(); return; }
    if (state.status === "idle") store?.rescan(availableScope);
    else store?.start();
  }



  return <div className={styles.home}>
    {!snapshot && store && <PersistenceStatus store={store} onlyProblems label="Assessment" />}
    {!snapshot && run && <div role="status" data-assessment-run-id={run.id} data-run-status={run.status}>
      {run.status === "pending" ? "Assessment queued. It will continue when the worker is available." : run.status === "failed" ? "Assessment could not complete." : run.status === "cancelled" ? "Assessment attempt cancelled. Resume when you are ready." : null}
      {run.error && <p>{run.error.message}</p>}
      {run.status === "failed" && run.error?.retryable && <button type="button" onClick={retryRun}>Retry assessment</button>}
    </div>}
    {state.truncated && <p className={styles.quiet}>Showing a bounded briefing of {state.totalFindings} findings and {state.totalProjects} projects. Open ALM for all saved projects.</p>}
    <fieldset className={styles.briefingFields} disabled={!!snapshot}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Welcome, {profile?.firstName} <span>YOUR FIRST DAY</span></p>
      <h2 className={styles.briefingTitle}>A fresh perspective on your org.</h2>
      <p>Your agent is getting to know your Salesforce environment.<br />Let’s turn the opportunities it finds into your first project.</p>
    </header>

    <div className={styles.connection} data-today-container>
      <span className={styles.orgIcon}><DatabaseIcon width={19} height={19} aria-hidden="true" /></span>
      <div><strong>{ASSESSMENT_ACCOUNT.company} workspace</strong><span>{ASSESSMENT_ACCOUNT.domain}</span></div>
      <span className={styles.demoBadge}>Demo connection</span>
      <button className={styles.textButton} type="button" onClick={openScope}>
        {orgLabel} <ChevronRightIcon width={14} height={14} aria-hidden="true" />
      </button>
    </div>

      <section className={styles.assessment} data-today-container aria-labelledby={`${id}-assessment`}>
        <div className={styles.assessmentHead}>
          <span className={styles.agentIcon}><SparklesIcon width={21} height={21} aria-hidden="true" /></span>
          <div><p className={styles.kicker}>YOUR AGENT · ORG ASSESSMENT</p><h2 id={`${id}-assessment`}>{complete ? state.findingsAvailable ? "Your first opportunities are ready." : "Original assessment findings unavailable." : needsScope ? "Choose a connected org to continue." : idle ? "Your org assessment is ready to start." : state.status === "paused" ? "Assessment paused. Pick up anytime." : "I’m finding where you can make an impact."}</h2></div>
          <span className={styles.scanStatus} data-complete={complete}>{complete ? <CheckIcon width={14} height={14} aria-hidden="true" /> : needsScope ? null : <span className={styles.statusDot} data-running={state.status === "running"} />}{complete ? "Complete" : needsScope ? "Waiting for scope" : idle ? "Ready to start" : state.status === "paused" ? "Paused" : "Analyzing"}</span>
        </div>
        <p className={styles.assessmentCopy}>{complete
          ? !state.findingsAvailable ? "This older assessment did not save its findings. Run again to capture findings and evidence; your saved projects remain available." : `${visibleFindings.length} ${visibleFindings.length === 1 ? "opportunity" : "opportunities"} in ${orgLabel}, prioritized by observed impact and effort. Review the evidence and choose what matters to your team.`
          : needsScope ? "Choose a connected org in the org selector to begin. Your saved work will stay available." : "I’ll review capacity, automations, and release readiness, then suggest a few practical places to start."}</p>
        {!complete && !needsScope && <>
          <progress className={styles.progress} max={ASSESSMENT_STEPS.length} value={state.step} aria-label="Org assessment progress" />
          <ol className={styles.scanSteps}>{ASSESSMENT_STEPS.map((step, index) => <li key={step.title} data-state={index < state.step ? "done" : index === state.step ? "active" : "pending"}>
            <span>{index < state.step ? <CheckIcon width={13} height={13} aria-hidden="true" /> : index + 1}</span><div><strong>{step.title}</strong>{index === state.step && <small>{step.detail}</small>}</div>
          </li>)}</ol>
          <p className={styles.srOnly} role="status">{idle ? "Assessment ready to start" : state.status === "paused" ? "Assessment paused" : ASSESSMENT_STEPS[state.step]?.title}</p>
        </>}
        <div className={styles.assessmentFoot}>
          <span><ShieldIcon width={14} height={14} aria-hidden="true" /> Read-only assessment <span aria-hidden="true">·</span> Simulated findings</span>
          <button className={styles.textButton} type="button" disabled={blockedByOtherRun} onClick={complete ? runAgain : needsScope ? openScope : idle || state.status === "paused" ? resumeAssessment : store?.pause}>{complete ? "Run again" : needsScope ? "Choose org scope" : idle ? "Run assessment" : state.status === "paused" ? "Resume assessment" : "Pause"}</button>
        </div>
        {blockedByOtherRun && <p className={styles.quiet}>An assessment is running for another org. Let it finish before starting this one.</p>}
      </section>

      {complete && state.findingsAvailable && <section className={styles.findings} aria-labelledby={`${id}-opportunities`}>
        <div className={styles.sectionHead}><div><h2 id={`${id}-opportunities`}>A few things worth improving <span>{visibleFindings.length}</span></h2><p>Select opportunities to shape your first project.</p></div><span className={styles.quiet}>Prioritized by your agent</span></div>
        {visibleFindings.length ? <div className={styles.findingGrid}>{visibleFindings.map((finding) => {
          const project = state.projects.find((project) => project.findingIds.includes(finding.id));
          return <FindingCard key={finding.id} finding={finding} readOnly={snapshot} selected={selectedIds.includes(finding.id) && !project} onToggle={() => setSelected(selectedIds.includes(finding.id) ? selectedIds.filter((id) => id !== finding.id) : [...selectedIds, finding.id])} projectName={project?.name} onOpenProject={() => { if (project) openProject?.(project); }} onOpenEvidence={() => openAssessment?.(finding)} />;
        })}</div> : <div className={styles.empty} data-today-container><CheckIcon width={24} height={24} aria-hidden="true" /><h3>{findings.length ? "All opportunities are in projects" : "No findings in this demo scope"}</h3><p>{findings.length ? "Follow their progress in your improvement projects below. The assessment keeps the original evidence." : "This sample has no flagged issues for the selected org. It is not a comprehensive health certification."}</p><button className={styles.textButton} type="button" onClick={openScope}>Review org scope</button></div>}
        {!!available.length && <div className={styles.selectionBar} data-today-container>
          <div><strong>{chosen.length} {chosen.length === 1 ? "opportunity" : "opportunities"} selected</strong><span>Your agent will draft the goal and a plan for each work item.</span></div>
          <button type="button" className={styles.primary} disabled={!chosen.length || startingProject} onClick={() => { void startProject?.(chosen); }}>{startingProject ? "Preparing project draft…" : "Shape a project"} <ChevronRightIcon width={16} height={16} aria-hidden="true" /></button>
        </div>}
      </section>}

      {state.draft && !startingProject && <section className={styles.scope} data-today-container aria-label="Project draft">
        <h2>{state.draft.name}</h2><p>{state.draft.goal}</p>
        <button type="button" className={styles.primary} onClick={continueProject}>Continue project draft</button>
      </section>}

      {!!state.projects.length && <section className={styles.savedProjects} aria-labelledby={`${id}-projects`}><h2 id={`${id}-projects`}>Your improvement projects</h2>{state.projects.map((project) => <button type="button" key={project.id} className={styles.projectLink} data-today-container onClick={() => openProject?.(project)}>
        <LayersIcon width={20} height={20} aria-hidden="true" /><span><strong>{project.name}</strong><small>{project.workItemCount} work items · {project.completedCount} complete</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </button>)}</section>}
    </fieldset>
    <div className={styles.explore}><p>You can also explore your workspace while your agent gets to know it.</p><SurfaceNav readOnly={snapshot} profile={profile} /></div>
  </div>;
}

function FindingCard({ finding, selected, onToggle, projectName, onOpenProject, onOpenEvidence, readOnly }: {
  finding: Finding; readOnly: boolean; selected: boolean; onToggle: () => void; projectName?: string; onOpenProject: () => void; onOpenEvidence: () => void;
}) {
  const org = { label: finding.orgLabel };
  return <article className={styles.findingCard} data-today-container data-selected={selected}>
    <div className={styles.findingTop}><span className={styles.priority} data-priority={finding.priority}>{finding.priority} priority</span><span>{finding.category}</span></div>
    <h3>{finding.title}</h3><p>{finding.summary}</p>
    <div className={styles.metric}><strong>{finding.metric}</strong><span>{finding.metricLabel}<small>{org?.label}</small></span></div>
    <p className={styles.impact}>{finding.impact}</p>
    <button className={styles.textButton} type="button" disabled={readOnly} onClick={onOpenEvidence}>Evidence & suggested approach <ChevronRightIcon width={14} height={14} aria-hidden="true" /></button>
    <div className={styles.findingFoot}><span>Estimated effort · {finding.effort}</span>{projectName ? <button className={styles.textButton} type="button" onClick={onOpenProject}>In project <ChevronRightIcon width={14} height={14} aria-hidden="true" /><span className={styles.srOnly}>{projectName}</span></button> : <label><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Include ${finding.title}`} />{selected ? "Selected" : "Select"}</label>}</div>
  </article>;
}
