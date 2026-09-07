"use client";

import { GitBranchIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { AgentSessionStatus } from "@/lib/workspace/model";
import styles from "./AgentSessionsRail.module.css";

const STATUS_LABEL: Record<AgentSessionStatus, string> = {
  working: "Working",
  waiting: "Waiting on you",
  idle: "Idle",
};

/**
 * The Code surface's parallelism view: one row per worktree in the active
 * project, each showing its agent session's status and last activity. This is
 * where a super user running several worktrees at once sees all their sessions
 * without leaving the surface. Clicking a row focuses that session — calling
 * `setActiveWorktree` re-points the AgentPanel (keyed by `sessionKey`) to that
 * worktree's thread; only one transcript is live at a time, but every session
 * stays visible and one click away.
 *
 * Progressive disclosure: a project with a single worktree has nothing to
 * parallelize, so this renders null and a simple user never meets session
 * machinery — same rule the toolbar's WorktreeSwitcher already follows.
 */
export function AgentSessionsRail() {
  const { activeProject, activeWorktree, agentSessions, setActiveWorktree } = useWorkspace();

  if (activeProject.worktrees.length < 2) return null;

  return (
    <section className={styles.rail} aria-label="Agent sessions across worktrees">
      <h2 className={styles.heading}>Agent sessions</h2>
      <ul className={styles.list}>
        {activeProject.worktrees.map((worktree) => {
          const session = agentSessions.find((s) => s.worktreeId === worktree.id);
          const status = session?.status ?? "idle";
          const isFocused = worktree.id === activeWorktree.id;

          return (
            <li key={worktree.id}>
              <button
                type="button"
                className={`${styles.row} ${isFocused ? styles.rowFocused : ""}`}
                aria-current={isFocused}
                onClick={() => {
                  if (!isFocused) setActiveWorktree(worktree.id);
                }}
              >
                <span className={`${styles.statusDot} ${styles[status]}`} aria-hidden="true" />
                <span className={styles.rowCopy}>
                  <span className={styles.rowHead}>
                    <GitBranchIcon
                      className={styles.branchIcon}
                      width={13}
                      height={13}
                      aria-hidden="true"
                    />
                    <span className={styles.worktreeLabel}>{worktree.label}</span>
                    <span className={styles.branch}>{worktree.branch}</span>
                  </span>
                  <span className={styles.summary}>
                    {session?.summary ?? "No recent activity."}
                  </span>
                </span>
                <span className={`${styles.statusText} ${styles[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                {isFocused && <span className={styles.focusedTag}>Focused</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
