"use client";

import { usePathname, useRouter } from "next/navigation";
import { GitBranchIcon, LayersIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { activeSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import styles from "./WorkspacePanel.module.css";

/**
 * The persistent left navigator — an always-on counterpart to the ⌘⇧P command
 * palette, over the SAME derived data (`@/lib/workspace/selectors`) so the
 * two can never disagree about what a project, worktree, or session looks
 * like. Toggled from the top bar; unlike the palette, it never closes itself.
 *
 * Top ("Projects"): every project and its tree-connected worktrees, same
 * idiom as the palette's Projects tab. Picking a row re-points workspace
 * context and STAYS on the current surface — this section is ambient
 * wayfinding, not a jump list.
 *
 * Bottom ("Active"): a flat, cross-project triage list — sessions that are
 * `working` or `waiting` only, sorted waiting → working. A project whose only
 * session is idle still shows in the top tree, just not here. Picking a
 * session re-points context AND navigates to the Code surface — unlike the
 * top section, a session is somewhere to jump TO.
 */
export function WorkspacePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree } =
    useWorkspace();

  const tree = buildProjectTree(projects);
  const sessions = activeSessionRows(projects);
  const codeHref = surfaceAppById("code").href;

  return (
    <aside className={styles.panel} aria-label="Workspace">
      <section className={styles.section} aria-label="Projects">
        <h2 className={styles.heading}>Projects</h2>
        <ul className={styles.tree}>
          {tree.map(({ project, base, children }) => {
            const isProjectCurrent = project.id === activeProject.id;
            const isBaseCurrent = isProjectCurrent && base.worktree.id === activeWorktree.id;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  className={`${styles.row} ${isProjectCurrent ? styles.rowCurrent : ""}`}
                  aria-current={isProjectCurrent}
                  onClick={() => setActiveProject(project.id)}
                >
                  <LayersIcon className={styles.rowIcon} width={16} height={16} />
                  <span className={styles.rowLabel}>{project.name}</span>
                </button>

                {/* The primary worktree ("main") is part of the project — a
                    plain line attached under the header, no tree connector, no
                    status dot (its activity still surfaces in the Active list
                    below). Pass project.id explicitly, same closure reason as
                    the child rows. */}
                <button
                  type="button"
                  className={`${styles.baseRow} ${isBaseCurrent ? styles.rowCurrent : ""}`}
                  aria-current={isBaseCurrent}
                  onClick={() => {
                    setActiveProject(project.id);
                    setActiveWorktree(base.worktree.id, project.id);
                  }}
                >
                  <span className={styles.baseLabel}>{base.worktree.label}</span>
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
                            // Pass project.id explicitly: setActiveProject above
                            // doesn't take effect until the next render, so
                            // setActiveWorktree's own default (the *current*
                            // activeProject) would target the wrong project when
                            // picking a worktree in a project that isn't active
                            // yet — same fix as the palette's worktree row.
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
        <h2 className={styles.heading}>Active</h2>
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
                    // A session is somewhere to jump TO, unlike the top
                    // section — teleport to Code, same contract as the
                    // palette's Sessions tab.
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
