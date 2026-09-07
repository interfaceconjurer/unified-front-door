"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { activeSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import styles from "./WorkspacePanel.module.css";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal workspace drawer over the stable agent/surface proportions. */
export function WorkspacePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree } =
    useWorkspace();

  const tree = buildProjectTree(projects);
  const sessions = activeSessionRows(projects);
  const codeHref = surfaceAppById("code").href;

  useEffect(() => closeRef.current?.focus(), []);

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-drawer-title"
      onKeyDown={trapFocus}
    >
      <div className={styles.drawerHeader}>
        <h2 id="workspace-drawer-title">Workspace</h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close workspace panel">
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      <section className={styles.section} aria-label="Projects">
        <h3 className={styles.heading}>Projects</h3>
        <ul className={styles.tree}>
          {tree.map(({ project, base, children }) => {
            const isProjectCurrent = project.id === activeProject.id;
            const isBaseCurrent = isProjectCurrent && base.worktree.id === activeWorktree.id;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  className={`${styles.row} ${isBaseCurrent ? styles.rowCurrent : ""}`}
                  aria-current={isBaseCurrent}
                  onClick={() => {
                    setActiveProject(project.id);
                    setActiveWorktree(base.worktree.id, project.id);
                  }}
                >
                  <LayersIcon className={styles.rowIcon} width={16} height={16} />
                  <span className={styles.rowCopy}>
                    <span className={styles.rowLabel}>{project.name}</span>
                    <span className={styles.rowBranch}>{base.worktree.label}</span>
                  </span>
                </button>

                {children.length > 0 && (
                  <ul className={styles.worktreeList}>
                    {children.map(({ worktree, status, lastChild }) => {
                      const isCurrent = isProjectCurrent && worktree.id === activeWorktree.id;
                      return (
                        <li key={worktree.id}>
                          <button
                            type="button"
                            className={`${styles.worktreeRow} ${
                              lastChild ? styles.worktreeRowLast : ""
                            } ${isCurrent ? styles.rowCurrent : ""}`}
                            aria-current={isCurrent}
                            onClick={() => {
                              setActiveProject(project.id);
                              setActiveWorktree(worktree.id, project.id);
                            }}
                          >
                            <StatusDot status={status} />
                            <span className={styles.worktreeLabel}>{worktree.label}</span>
                            <span className={styles.worktreeBranch}>{worktree.branch}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-label="Active sessions">
        <h3 className={styles.heading}>Active</h3>
        {sessions.length === 0 ? (
          <p className={styles.empty}>No agent needs you right now.</p>
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map(({ project, worktree, session }) => {
              const isCurrent = project.id === activeProject.id && worktree.id === activeWorktree.id;
              return (
                <li key={`${project.id}::${worktree.id}`}>
                  <button
                    type="button"
                    className={`${styles.sessionRow} ${isCurrent ? styles.rowCurrent : ""}`}
                    aria-current={isCurrent}
                    onClick={() => {
                      setActiveProject(project.id);
                      setActiveWorktree(worktree.id, project.id);
                      if (pathname !== codeHref) router.push(codeHref);
                    }}
                  >
                    <StatusDot status={session.status} className={styles.sessionDot} />
                    <span className={styles.sessionCopy}>
                      <span className={styles.sessionHead}>
                        <GitBranchIcon className={styles.branchIcon} width={12} height={12} />
                        <span className={styles.worktreeLabel}>{worktree.label}</span>
                        <span className={styles.sessionProject}>{project.name}</span>
                      </span>
                      <span className={styles.sessionSummary}>{session.summary}</span>
                    </span>
                    <span className={`${styles.sessionStatus} ${styles[session.status]}`}>
                      {STATUS_LABEL[session.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
