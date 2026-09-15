"use client";

import { useId, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldIcon,
  SparklesIcon,
} from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import type { AssessmentState } from "@/lib/onboarding/persistence";
import type { SurfaceApp } from "@/components/front-door/app-catalog";
import { SurfaceNav } from "@/components/front-door/SurfaceNav";
import {
  ASSESSMENT_ACCOUNT,
  ASSESSMENT_ORGS,
  ASSESSMENT_STEPS,
  findingsForScope,
  type Finding,
} from "@/lib/onboarding/assessment";
import { useAssessment } from "./use-assessment";
import { useOpenImprovementProject } from "./ImprovementProject";
import { useStartImprovementProject } from "./ProjectCreationCanvas";
import { useOpenAssessmentCanvas } from "./OrgAssessmentCanvas";
import styles from "./onboarding.module.css";

export function DayZeroHome({
  snapshot,
  onExplore,
}: {
  snapshot?: AssessmentState;
  onExplore?: (surface: SurfaceApp) => void;
}) {
  const id = useId();
  const { profile } = useDemoProfile();
  const { state: liveState, store } = useAssessment();
  const state = snapshot ?? liveState;
  const openProject = useOpenImprovementProject();
  const openAssessment = useOpenAssessmentCanvas();
  const startProject = useStartImprovementProject();
  const [selected, setSelected] = useState<string[]>(
    state.draft?.findingIds ?? ["api-headroom", "lead-routing"],
  );
  const complete = state.status === "complete";
  const findings = findingsForScope(state.scopeOrgIds);
  const available = findings.filter(
    (finding) =>
      !state.projects.some((project) =>
        project.workItems.some((item) => item.findingId === finding.id),
      ),
  );
  const chosen = available.filter((finding) => selected.includes(finding.id));

  return (
    <div className={styles.home}>
      <div className={styles.briefingFields}>
        <header className={styles.hero} data-front-door-row="1">
          <p className={styles.eyebrow}>
            Welcome, {profile?.firstName} <span>YOUR FIRST DAY</span>
          </p>
          <h2 className={styles.briefingTitle}>
            A fresh perspective on your org.
          </h2>
          <p>
            Your agent is getting to know your Salesforce environment.
            <br />
            Let’s turn the opportunities it finds into your first project.
          </p>
        </header>

        <div className={styles.connection} data-front-door-row="2">
          <span className={styles.orgIcon}>
            <DatabaseIcon width={19} height={19} aria-hidden="true" />
          </span>
          <div>
            <strong>{ASSESSMENT_ACCOUNT.company} workspace</strong>
            <span>{ASSESSMENT_ACCOUNT.domain}</span>
          </div>
          <span className={styles.demoBadge}>Demo connection</span>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => openAssessment()}
          >
            {state.scopeOrgIds.length} orgs in scope{" "}
            <ChevronRightIcon
              data-today-action
              width={14}
              height={14}
              aria-hidden="true"
            />
          </button>
        </div>
        <section
          className={styles.assessment}
          data-front-door-row="4"
          aria-labelledby={`${id}-assessment`}
        >
          <div className={styles.assessmentHead}>
            <span className={styles.agentIcon}>
              <SparklesIcon width={21} height={21} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.kicker}>YOUR AGENT · ORG ASSESSMENT</p>
              <h2 id={`${id}-assessment`}>
                {complete
                  ? "Your first opportunities are ready."
                  : state.status === "paused"
                    ? "Assessment paused. Pick up anytime."
                    : "I’m finding where you can make an impact."}
              </h2>
            </div>
            <span className={styles.scanStatus} data-complete={complete}>
              {complete ? (
                <CheckIcon width={14} height={14} aria-hidden="true" />
              ) : (
                <span
                  className={styles.statusDot}
                  data-running={state.status === "running"}
                />
              )}
              {complete
                ? "Complete"
                : state.status === "paused"
                  ? "Paused"
                  : "Analyzing"}
            </span>
          </div>
          <p className={styles.assessmentCopy}>
            {complete
              ? `${findings.length} opportunities across ${state.scopeOrgIds.length} orgs, prioritized by observed impact and effort. Review the evidence and choose what matters to your team.`
              : "I’ll review capacity, automations, and release readiness, then suggest a few practical places to start."}
          </p>
          {!complete && (
            <>
              <progress
                className={styles.progress}
                data-today-action
                max={ASSESSMENT_STEPS.length}
                value={state.step}
                aria-label="Org assessment progress"
              />
              <ol className={styles.scanSteps}>
                {ASSESSMENT_STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    data-state={
                      index < state.step
                        ? "done"
                        : index === state.step
                          ? "active"
                          : "pending"
                    }
                  >
                    <span>
                      {index < state.step ? (
                        <CheckIcon width={13} height={13} aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      {index === state.step && <small>{step.detail}</small>}
                    </div>
                  </li>
                ))}
              </ol>
              <p className={styles.srOnly} role="status">
                {state.status === "paused"
                  ? "Assessment paused"
                  : ASSESSMENT_STEPS[state.step]?.title}
              </p>
            </>
          )}
          <div className={styles.assessmentFoot}>
            <span>
              <ShieldIcon width={14} height={14} aria-hidden="true" /> Read-only
              assessment <span aria-hidden="true">·</span> Simulated findings
            </span>
            <button
              className={styles.textButton}
              data-today-action
              type="button"
              onClick={
                complete
                  ? () => openAssessment()
                  : state.status === "paused"
                    ? store.start
                    : store.pause
              }
            >
              {complete
                ? "Review assessment"
                : state.status === "paused"
                  ? "Resume assessment"
                  : "Pause"}
            </button>
          </div>
        </section>

        {complete && (
          <section
            className={styles.findings}
            data-front-door-row="5"
            aria-labelledby={`${id}-opportunities`}
          >
            <div className={styles.sectionHead}>
              <div>
                <h2 id={`${id}-opportunities`}>
                  A few things worth improving <span>{findings.length}</span>
                </h2>
                <p>Select opportunities to start a new project in ALM.</p>
              </div>
              <span className={styles.quiet}>Prioritized by your agent</span>
            </div>
            {findings.length ? (
              <div className={styles.findingGrid}>
                {findings.map((finding) => {
                  const project = state.projects.find((project) =>
                    project.workItems.some(
                      (item) => item.findingId === finding.id,
                    ),
                  );
                  return (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      selected={selected.includes(finding.id) && !project}
                      onToggle={() =>
                        setSelected(
                          selected.includes(finding.id)
                            ? selected.filter((id) => id !== finding.id)
                            : [...selected, finding.id],
                        )
                      }
                      onReview={() => openAssessment(finding)}
                      projectName={project?.name}
                      onOpenProject={() => {
                        if (project) openProject(project);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <CheckIcon width={24} height={24} aria-hidden="true" />
                <h3>No findings in this demo scope</h3>
                <p>
                  This sample has no flagged issues for the selected orgs. It is
                  not a comprehensive health certification.
                </p>
                <button
                  className={styles.textButton}
                  data-today-action
                  type="button"
                  onClick={() => openAssessment()}
                >
                  Review org scope
                </button>
              </div>
            )}
            {!!available.length && (
              <div className={styles.selectionBar}>
                <div>
                  <strong>
                    {chosen.length}{" "}
                    {chosen.length === 1 ? "opportunity" : "opportunities"}{" "}
                    selected
                  </strong>
                  <span>
                    Your agent will draft the goal and a plan for each work
                    item.
                  </span>
                </div>
                <button
                  type="button"
                  data-today-action
                  className={styles.primary}
                  disabled={!chosen.length}
                  onClick={() => startProject(chosen)}
                >
                  {state.draft
                    ? "Continue project draft"
                    : "Start a new project"}{" "}
                  <ChevronRightIcon width={16} height={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        )}

        {!!state.projects.length && (
          <section
            className={styles.savedProjects}
            data-front-door-row="6"
            aria-labelledby={`${id}-projects`}
          >
            <h2 id={`${id}-projects`}>Your improvement projects</h2>
            {state.projects.map((project) => (
              <button
                type="button"
                key={project.id}
                className={styles.projectLink}
                onClick={() => openProject(project)}
              >
                <LayersIcon width={20} height={20} aria-hidden="true" />
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {project.workItems.length} work items ·{" "}
                    {
                      project.workItems.filter((item) => item.status === "done")
                        .length
                    }{" "}
                    complete
                  </small>
                </span>
                <ChevronRightIcon
                  data-today-action
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
              </button>
            ))}
          </section>
        )}
      </div>
      <div className={styles.explore} data-front-door-row="7">
        <p>
          You can also explore your workspace while your agent gets to know it.
        </p>
        <SurfaceNav onExplore={onExplore} readOnly={!!snapshot} />
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  selected,
  onToggle,
  onReview,
  projectName,
  onOpenProject,
}: {
  finding: Finding;
  selected: boolean;
  onToggle: () => void;
  onReview: () => void;
  projectName?: string;
  onOpenProject: () => void;
}) {
  const org = ASSESSMENT_ORGS.find((org) => org.id === finding.orgId);
  return (
    <article className={styles.findingCard} data-selected={selected}>
      <div className={styles.findingTop}>
        <span className={styles.priority} data-priority={finding.priority}>
          {finding.priority} priority
        </span>
        <span>{finding.category}</span>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.summary}</p>
      <div className={styles.metric}>
        <strong>{finding.metric}</strong>
        <span>
          {finding.metricLabel}
          <small>{org?.label}</small>
        </span>
      </div>
      <p className={styles.impact}>{finding.impact}</p>
      <button
        type="button"
        data-today-action
        className={styles.textButton}
        onClick={onReview}
      >
        Evidence & suggested approach{" "}
        <ChevronRightIcon width={14} height={14} aria-hidden="true" />
      </button>
      <div className={styles.findingFoot}>
        <span>Estimated effort · {finding.effort}</span>
        {projectName ? (
          <button
            className={styles.textButton}
            type="button"
            onClick={onOpenProject}
          >
            In project{" "}
            <ChevronRightIcon
              data-today-action
              width={14}
              height={14}
              aria-hidden="true"
            />
            <span className={styles.srOnly}>{projectName}</span>
          </button>
        ) : (
          <label data-today-action>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Include ${finding.title}`}
            />
            {selected ? "Selected" : "Select"}
          </label>
        )}
      </div>
    </article>
  );
}
