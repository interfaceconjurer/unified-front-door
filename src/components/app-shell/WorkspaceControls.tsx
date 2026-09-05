"use client";

import { DatabaseIcon, LayersIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import styles from "./WorkspaceControls.module.css";

/**
 * Shell-level workspace pickers: the active project (the noun that follows you)
 * and the target org (a free, independent switch). Progressive disclosure — the
 * org is a plain label until there's more than one to switch between, and the
 * worktree lives in the Code surface, not here, so a simple user sees just their
 * project.
 */
export function WorkspaceControls() {
  const { projects, activeProject, activeEnvironment, setActiveProject, setActiveEnvironment } =
    useWorkspace();

  const multiEnv = activeProject.environments.length > 1;

  return (
    <div className={styles.controls}>
      <label className={styles.control}>
        <LayersIcon className={styles.icon} width={15} height={15} aria-hidden="true" />
        <span className={styles.srOnly}>Active project</span>
        <select
          className={styles.select}
          value={activeProject.id}
          onChange={(event) => setActiveProject(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {multiEnv ? (
        <label className={`${styles.control} ${styles.envControl} ${styles[activeEnvironment.kind]}`}>
          <DatabaseIcon className={styles.icon} width={15} height={15} aria-hidden="true" />
          <span className={styles.srOnly}>Target org</span>
          <select
            className={styles.select}
            value={activeEnvironment.id}
            onChange={(event) => setActiveEnvironment(event.target.value)}
          >
            {activeProject.environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className={`${styles.control} ${styles.envPill} ${styles[activeEnvironment.kind]}`}>
          <DatabaseIcon className={styles.icon} width={15} height={15} aria-hidden="true" />
          {activeEnvironment.label}
        </span>
      )}
    </div>
  );
}
