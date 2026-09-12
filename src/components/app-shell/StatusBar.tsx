"use client";

import { DatabaseIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import orgStyles from "@/components/workspace/OrgKind.module.css";
import styles from "./StatusBar.module.css";

/** Project and target org stay adjacent; both open their command-palette tab. */
export function StatusBar({ onOpenProjects, onOpenOrgs }: {
  onOpenProjects: () => void;
  onOpenOrgs: () => void;
}) {
  const { activeProject, activeWorktree, activeOrg, hasProjects } = useWorkspace();
  const showWorktree = hasProjects && activeProject.worktrees.length > 1;

  return (
    <footer className={styles.bar}>
      <div className={styles.cluster}>
        <button
          type="button"
          className={styles.chip}
          title={hasProjects ? activeProject.name : "Choose a project"}
          aria-label={hasProjects ? `Switch project, current project: ${activeProject.name}` : "Choose a project"}
          aria-haspopup="dialog"
          onClick={onOpenProjects}
        >
          <LayersIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
          <span className={styles.chipLabel}>{hasProjects ? activeProject.name : "No project selected"}</span>
        </button>

        <button
          type="button"
          className={`${styles.chip} ${styles.orgChip} ${orgStyles[activeOrg.kind]}`}
          title={activeOrg.label}
          aria-label={`Switch org, current org: ${activeOrg.label}`}
          aria-haspopup="dialog"
          onClick={onOpenOrgs}
        >
          <span className={styles.orgDot} aria-hidden="true" />
          <DatabaseIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
          <span className={styles.chipLabel}>{activeOrg.label}</span>
        </button>

        {showWorktree && (
          <span className={`${styles.chip} ${styles.static}`} title="Worktree (switch in Code)">
            <GitBranchIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeWorktree.label}</span>
          </span>
        )}
      </div>
    </footer>
  );
}
