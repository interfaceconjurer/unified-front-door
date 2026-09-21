"use client";

import type { SavedProject } from "@/lib/projects/model";
import { projectTemplate } from "@/lib/projects/templates";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import styles from "./onboarding.module.css";

export function BriefProjectPlan({ project }: { project: SavedProject }) {
  const { orgs } = useWorkspace();
  const { navigateSurface } = useNavigation();
  const template = projectTemplate(project.projectType);
  return <article className={styles.projectCanvas}>
    <header className={styles.projectHeader}>
      <p className={styles.kicker}>{template.label} · PROJECT</p>
      <h1>{project.name}</h1><p>Your project is ready.</p>
      <div className={styles.projectMeta}><span>Owner · {project.owner}</span><span>{orgs.find(org => org.id === project.targetOrgId)?.label ?? "No target org"}</span></div>
    </header>
    <section className={styles.evidence}><h2>Project goal</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.goal}</p></section>
    {project.context && <section className={styles.evidence}><h2>Project context</h2><p style={{ whiteSpace: "pre-wrap" }}>{project.context}</p></section>}
    {project.repository && <section className={styles.evidence}><h2>Repository reference</h2><p>{project.repository}</p><p className={styles.quiet}>Saved as a reference. Repository synchronization is not connected yet.</p></section>}
    <div className={styles.nextStep}><div><strong>Plan your first step</strong><p>{template.guidance} Your agent has the saved project goal and context.</p></div></div>
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => navigateSurface(null)}>Continue with the agent</button></div>
  </article>;
}
