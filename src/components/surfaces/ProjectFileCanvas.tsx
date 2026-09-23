"use client";

import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { fileForCanvas } from "@/lib/workspace/project-files";
import { useAssessment } from "@/components/onboarding/use-assessment";
import styles from "./ProjectFileCanvas.module.css";

export function ProjectFileCanvas({ spec }: { spec: CanvasOf<"project-file"> }) {
  const { profile } = useDemoProfile(), { projects } = useWorkspace();
  const { state: assessment } = useAssessment();
  const file = profile ? fileForCanvas(profile.id, spec.params, assessment.projects) : undefined;
  const project = projects.find(project => project.id === spec.params.projectId);
  const branch = project?.worktrees.find(tree => tree.id === spec.params.worktreeId)?.branch;
  if (!file) return <article className={styles.canvas}><h1>File unavailable</h1><p>This file is no longer available in this project.</p></article>;
  return <article className={styles.canvas} aria-label={`${spec.title} file`}>
    <header><p className={styles.context}>{project?.name}{branch && ` · ${branch}`}</p><h1>{spec.title}</h1>
      <p className={styles.path}>{file.path}</p>
      <div className={styles.meta}><span>{file.language}{file.modified && " · Modified"}</span><span>{file.source === "saved-project" ? "Saved project context" : "Sample repository"} · Read only</span></div>
      {file.source === "saved-project" && <div className={styles.export}>
        <p>Reflects your saved project. Add this file under <code>.project/</code> in your repository to version it alongside your code.</p>
        <a href={`data:application/json;charset=utf-8,${encodeURIComponent(file.content)}`} download={file.path.split("/").at(-1)}>Download file</a>
      </div>}
    </header>
    <pre className={styles.source} tabIndex={0} aria-label="File contents"><code>{file.content}</code></pre>
  </article>;
}
