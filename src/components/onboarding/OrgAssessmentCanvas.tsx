"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { assessmentCanvas, assessmentCanvasView } from "@/lib/assessment/canvas";
import { applicationClient } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";
import { orgAvailability, type FindingSnapshot } from "@/lib/assessment/model";
import { accessibleScope, ASSESSMENT_ORGS, ASSESSMENT_STEPS } from "@/lib/onboarding/assessment";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useStartImprovementProject } from "./use-start-improvement-project";
import { useAssessment } from "./use-assessment";
import styles from "./OrgAssessmentCanvas.module.css";

export function OrgAssessmentCanvas({ spec }: { spec: CanvasOf<"org-assessment"> }) {
  const { state, store } = useAssessment();
  const { startProject, pending: startingProject } = useStartImprovementProject();
  const { profile } = useDemoProfile();
  const { openCanvas, navigateGlobalHome } = useNavigation();
  const agent = applicationClient.agent ?? inactiveAgent;
  const execution = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  const view = assessmentCanvasView(spec.params, state);
  if (!profile?.onboarding || view.kind === "unavailable") return <article className={styles.canvas}>
    <h2>Assessment unavailable</h2><p>{view.kind === "unavailable" ? view.reason : "Org assessment is unavailable for this profile."}</p>
    <button type="button" onClick={navigateGlobalHome}>Back to Today</button>
  </article>;
  const { run, finding, current, scopeOrgIds, status } = view;
  const attempt = current && run ? execution.data.runs.filter(attempt => attempt.assessmentRunId === run.id).at(-1) : undefined;
  const interrupted = attempt?.status === "failed" || attempt?.status === "cancelled";
  const openRun = (runId?: string | null, finding?: FindingSnapshot) => openCanvas("govern", assessmentCanvas(spec.params, runId, finding));
  return <article className={styles.canvas} aria-label="Org assessment canvas" data-assessment-view-run={run?.id}>
    <div className={styles.toolbar}>
      <button type="button" onClick={navigateGlobalHome}><ChevronLeftIcon width={14} height={14} aria-hidden="true" />Back to Today</button>
      {!current && state.currentRunId && <button type="button" onClick={() => openRun(state.currentRunId)}>View latest assessment<ChevronRightIcon width={14} height={14} aria-hidden="true" /></button>}
      {finding && <button type="button" onClick={() => openRun(run!.id)}>All findings from this assessment</button>}
    </div>
    <header className={styles.header}>
      <span className={styles.icon}><ShieldIcon width={24} height={24} aria-hidden="true" /></span>
      <div><p className={styles.eyebrow}>GOVERN & OBSERVE · ORG ASSESSMENT</p><h2>{finding?.title ?? "Org assessment"}</h2>
        <p>{run?.startedAt ? <>Started <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleString()}</time></> : "Choose connected orgs to begin."}</p></div>
      <span className={styles.status}>{attempt?.status === "failed" ? "Could not complete" : attempt?.status === "cancelled" ? "Cancelled" : attempt?.status === "pending" ? "Queued" : status === "complete" ? "Complete" : status === "incomplete" ? "Earlier incomplete run" : status === "running" ? "Analyzing" : status === "paused" ? "Paused" : "Ready to start"}</span>
    </header>
    <p className={styles.quiet}>Read-only assessment · Simulated findings. Source orgs and captured evidence remain attached to this run.</p>
    {!current && <p className={styles.notice}>You are viewing an earlier assessment. New scans do not replace its evidence.</p>}
    <PersistenceStatus store={store} onlyProblems label="Assessment" />
    {attempt && (interrupted || attempt.status === "pending") && <div role="status" data-assessment-run-id={attempt.id} data-run-status={attempt.status}>
      <p>{attempt.status === "pending" ? "Assessment queued. It will continue when the worker is available." : attempt.status === "failed" ? "Assessment could not complete." : "Assessment attempt cancelled. Resume when you are ready."}</p>
      {attempt.error && <p>{attempt.error.message}</p>}
      {attempt.status === "failed" && attempt.error?.retryable && <button type="button" onClick={() => {
        if (store.getSnapshot().currentRunId === run?.id) void agent.command({ kind: "retry", requestId: crypto.randomUUID(), runId: attempt.id });
      }}>Retry assessment</button>}
    </div>}
    {current && status !== "complete" && attempt?.status !== "failed" && <section className={styles.section} aria-label="Assessment progress">
      <h3>{ASSESSMENT_STEPS[state.step]?.title ?? "Ready to assess"}</h3>
      <progress max={ASSESSMENT_STEPS.length} value={state.step} aria-label="Org assessment progress" />
      <div className={styles.toolbar}>{status === "running"
        ? <button type="button" onClick={() => { if (store.getSnapshot().currentRunId === run?.id) store.pause(); }}>Pause assessment</button>
        : <button type="button" disabled={!accessibleScope(state.scopeOrgIds).length} onClick={() => { if (store.getSnapshot().currentRunId === (run?.id ?? null)) store.start(); }}>{status === "paused" ? "Resume assessment" : "Start assessment"}</button>}</div>
    </section>}
    {finding ? <><FindingEvidence finding={finding} />{run?.completedAt && !state.projects.some(project => project.workItems.some(item => item.findingId === finding.id)) && <button type="button" className={styles.primary} disabled={startingProject} onClick={() => { void startProject([finding]); }}>{startingProject ? "Preparing project draft…" : "Shape a project from this finding"}</button>}</> : run && <section className={styles.section} aria-label="Assessment findings">
      <h3>Findings <span>{run.findings.length}</span></h3>
      {run.findings.length ? <div className={styles.findings}>{run.findings.map(item => <button type="button" key={item.id} onClick={() => openRun(run.id, item)}>
        <span><strong>{item.title}</strong><small>{item.orgLabel} · {item.priority} priority · {item.metric} {item.metricLabel}</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </button>)}</div> : <p>{status === "complete" ? "No findings were saved for this assessment." : "Findings will be available when this assessment completes."}</p>}
    </section>}
    <section className={styles.section} aria-label="Captured assessment scope">
      <h3>{run ? "Orgs in this assessment" : "Assessment scope"}</h3>
      <ul className={styles.scope}>{scopeOrgIds.map(id => { const org = orgAvailability(id, ASSESSMENT_ORGS); return <li key={id}><strong>{org.label}</strong><span>{org.available ? "Read access" : org.reason}</span></li>; })}</ul>
    </section>
    <ScopeEditor key={run?.id ?? "initial"} initialScope={scopeOrgIds} onAnalyze={store.rescan} />
  </article>;
}

function ScopeEditor({ initialScope, onAnalyze }: { initialScope: readonly string[]; onAnalyze: (orgIds: string[]) => void }) {
  const [scope, setScope] = useState(() => accessibleScope(initialScope));
  const id = useId();
  return <section className={styles.section} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Start a new assessment</h3>
    <p>Choose the connected orgs to include. Earlier findings and saved projects stay available.</p>
    <fieldset className={styles.orgs}><legend>Org scope</legend>{ASSESSMENT_ORGS.map(org => <label key={org.id}>
      <input type="checkbox" checked={scope.includes(org.id)} disabled={org.connection !== "connected"} onChange={event => setScope(current => event.target.checked ? [...current, org.id] : current.filter(id => id !== org.id))} />
      <span><strong>{org.label}</strong><small>{org.connection === "connected" ? `${org.kind === "production" ? "Production" : "Sandbox"} · read access` : "Connection expired · excluded"}</small></span>
    </label>)}</fieldset>
    <button type="button" className={styles.primary} disabled={!accessibleScope(scope).length} onClick={() => onAnalyze(scope)}>Analyze selected orgs</button>
  </section>;
}

function FindingEvidence({ finding }: { finding: FindingSnapshot }) {
  return <section className={styles.section} aria-label="Finding evidence" data-finding-id={finding.id}>
    <p>{finding.summary}</p>
    <dl className={styles.facts}><div><dt>Source org</dt><dd>{finding.orgLabel}</dd></div><div><dt>Observed signal</dt><dd>{finding.metric} {finding.metricLabel}</dd></div><div><dt>Priority / effort</dt><dd>{finding.priority} / {finding.effort}</dd></div></dl>
    <h3>Evidence</h3>{finding.provenance.evidence === "legacy-unavailable" ? <p>Original evidence was not saved with this older assessment.</p> : <ul>{finding.evidence.map((evidence, index) => <li key={index}>{evidence}</li>)}</ul>}
    <p className={styles.quiet}>{finding.source}{finding.capturedAt && <> · Captured <time dateTime={finding.capturedAt}>{new Date(finding.capturedAt).toLocaleString()}</time></>}</p>
    <h3>What to investigate</h3><p>{finding.hypothesis}</p>
    <h3>Suggested plan</h3><ol>{finding.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    <h3>Success looks like</h3><p>{finding.validation}</p>
  </section>;
}
