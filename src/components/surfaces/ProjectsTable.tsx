"use client";

import { useAssessment } from "@/components/onboarding/use-assessment";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { projectTemplate } from "@/lib/projects/templates";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./ProjectsTable.module.css";

/** ALM summarizes saved projects; their plans live in dedicated canvases. */
export function ProjectsTable() {
  const { state } = useAssessment();
  const { target } = useWorkspace();
  const { openCanvas } = useSurfaceCanvasActions();
  const projects = state.projects.filter(project => !target.projectId || project.id === target.projectId);
  if (!projects.length) return null;

  return <section aria-labelledby="alm-projects-heading">
    <div className={styles.heading}>
      <h2 id="alm-projects-heading">Your projects</h2>
      <span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span>
    </div>
    <div className={styles.frame}>
      <table className={styles.table} aria-labelledby="alm-projects-heading">
        <thead><tr><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Progress</th></tr></thead>
        <tbody>{projects.map(project => <tr key={project.id}>
          <th scope="row"><button type="button" className={styles.project} onClick={() => openCanvas("alm", {
            kind: "improvement-project", title: project.name, params: { projectId: project.id },
          })}>{project.name}</button></th>
          <td>{projectTemplate(project.projectType).label}</td>
          <td>{project.workItems.length
            ? `${project.workItems.filter(item => item.status === "done").length} of ${project.workItems.length} complete`
            : "No work items yet"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
