"use client";

import { GitBranchIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import styles from "./WorktreeSwitcher.module.css";

/**
 * The Code surface's lens control: which worktree of the active project you're
 * in. Progressive disclosure — a project with a single worktree renders nothing,
 * so a simple user never meets the concept. Switching here re-binds the agent's
 * session (each worktree is its own isolated thread), mirroring how you move
 * between Herdr worktrees.
 */
export function WorktreeSwitcher() {
  const { activeProject, activeWorktree, setActiveWorktree } = useWorkspace();

  if (activeProject.worktrees.length < 2) return null;

  return (
    <label className={styles.switcher}>
      <GitBranchIcon className={styles.icon} width={16} height={16} aria-hidden="true" />
      <span className={styles.label}>Worktree</span>
      <select
        className={styles.select}
        value={activeWorktree.id}
        onChange={(event) => setActiveWorktree(event.target.value)}
      >
        {activeProject.worktrees.map((worktree) => (
          <option key={worktree.id} value={worktree.id}>
            {worktree.label}
            {worktree.isPrimary ? " (primary)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
