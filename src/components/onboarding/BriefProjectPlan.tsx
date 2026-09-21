"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { SavedProject } from "@/lib/projects/model";
import { projectTemplate } from "@/lib/projects/templates";
import { applicationClient } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";
import { activeRun } from "@/lib/agent/contracts";
import { sameTarget } from "@/lib/workspace/context";
import { useWorkspace } from "@/components/workspace/workspace-context";
import styles from "./onboarding.module.css";

export function BriefProjectPlan({ project }: { project: SavedProject }) {
  const { orgs, target } = useWorkspace();
  useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const agent = applicationClient.agent ?? inactiveAgent;
  const remote = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  const inFlight = useRef(false), [starting, setStarting] = useState(false);
  const working = remote.data.runs.some(run => run.kind === "chat" && sameTarget(run.context.target, target) && activeRun(run.status));
  const unavailable = target.projectId !== project.id || !remote.ready || remote.pending || working || starting;
  const template = projectTemplate(project.projectType);
  async function startPlan() {
    if (inFlight.current || unavailable) return;
    inFlight.current = true; setStarting(true);
    try {
      await agent.command({ kind: "submit", requestId: crypto.randomUUID(), context: { target, surface: "alm" },
        text: "Help me create a plan for this project using its saved type, goal, and context. Propose milestones, concrete tasks, and success criteria. Ask about any important missing requirements before making assumptions." });
    } finally { inFlight.current = false; setStarting(false); }
  }
  return <article className={styles.projectCanvas}>
    <header className={styles.projectHeader}>
      <p className={styles.kicker}>{template.label} · PROJECT</p>
      <h1>{project.name}</h1><p>Your project is ready.</p>
      <div className={styles.projectMeta}><span>Owner · {project.owner}</span><span>{orgs.find(org => org.id === project.targetOrgId)?.label ?? "No target org"}</span></div>
    </header>
    <section className={styles.evidence}><h2>Project goal</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.goal}</p></section>
    {project.context && <section className={styles.evidence}><h2>Project context</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.context}</p></section>}
    {project.repository && <section className={styles.evidence}><h2>Repository reference</h2><p>{project.repository}</p><p className={styles.quiet}>Saved as a reference. Repository synchronization is not connected yet.</p></section>}
    <div className={styles.nextStep}><div><strong>Create a plan for your project</strong><p>{template.guidance} Start with your agent to turn the saved goal and context into milestones and next steps.</p></div></div>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={unavailable} onClick={startPlan}>{starting ? "Starting plan…" : "Start creating a plan"}</button></div>
  </article>;
}
