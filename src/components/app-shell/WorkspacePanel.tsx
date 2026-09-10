"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BoxIcon, CloseIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { DeployedApp, Project } from "@/lib/workspace/model";
import {
  activeSessionRows,
  allAppRows,
  APP_STATUS_LABEL,
  buildProjectTree,
  STATUS_LABEL,
} from "@/lib/workspace/selectors";
import styles from "./WorkspacePanel.module.css";

/** The Projects section's own filter — rendered as a segmented control at the
 *  top of that section. Local, ephemeral UI state (not persisted, not shared
 *  with the palette): unlike the project/worktree/org selection, "what am I
 *  looking at right now" resets fine on reload. */
type PanelFilter = "all" | "projects" | "apps";

const FILTER_LABEL: Record<PanelFilter, string> = {
  all: "All",
  projects: "Projects",
  apps: "Apps",
};

/** A project's deployed output, rendered at the SAME hierarchy level as a
 *  worktree — an app is the project's distribution artifact ("dist folder"),
 *  not a peer of the project. Same size and, when `nested`, the same tree
 *  connector as a worktree row; only the glyph differs (a package box instead
 *  of a worktree's status dot) and the trailing slot carries the app's status
 *  word instead of a branch name. The live URL isn't shown here — that lives
 *  in the app's ops canvas. `nested` toggles the tree connector (on under a
 *  project, off in the flat "Apps" list, which has no parent to connect to);
 *  `lastChild` draws the └ corner. `showProject` surfaces the owning project's
 *  name, used only in the flat list where rows aren't under a project header. */
function AppRow({
  project,
  app,
  showProject,
  nested,
  lastChild,
  onSelect,
}: {
  project: Project;
  app: DeployedApp;
  showProject: boolean;
  nested: boolean;
  lastChild: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={
        nested
          ? `${styles.worktreeRow} ${lastChild ? styles.worktreeRowLast : ""}`
          : styles.appRow
      }
      onClick={onSelect}
      aria-label={`${app.label}${showProject ? `, ${project.name}` : ""}, ${app.environment}, ${APP_STATUS_LABEL[app.status]}`}
    >
      <BoxIcon className={styles.appIcon} width={14} height={14} />
      <span className={styles.appCopy}>
        <span className={styles.appLabel}>{app.label}</span>
        {showProject && <span className={styles.appProject}>{project.name}</span>}
      </span>
      <span className={`${styles.appStatus} ${styles[`appStatus-${app.status}`]}`}>
        {APP_STATUS_LABEL[app.status]}
      </span>
    </button>
  );
}

/**
 * The persistent left navigator — an always-on counterpart to the ⌘⇧P command
 * palette, over the SAME derived data (`@/lib/workspace/selectors`) so the
 * two can never disagree about what a project, worktree, or session looks
 * like. Toggled from the top bar; unlike the palette, it never closes itself.
 *
 * Top ("Projects"): every project and its tree-connected worktrees, same
 * idiom as the palette's Projects tab, PLUS each project's deployed apps —
 * a project is the hub for everything it owns: source (worktrees), work in
 * flight (sessions, below), and now outputs (apps). A local All/Projects/Apps
 * filter (not persisted — see `PanelFilter`) governs this section only:
 * "all" nests app rows under their project, "projects" hides them for the
 * plain source tree, "apps" flattens every app across every project into one
 * list (the "what's running right now" view) instead of grouping by project.
 * Picking a project/worktree row re-points workspace context and STAYS on
 * the current surface — this section is ambient wayfinding, not a jump list.
 * An app row is the exception: it jumps to Build & Setup (see `AppRow`'s
 * caller below) since an app isn't a place you navigate context within, it's
 * a deployed thing you go look at.
 *
 * Bottom ("Sessions"): a flat, cross-project triage list — sessions that are
 * `working` or `waiting` only, sorted waiting → working. A project whose only
 * session is idle still shows in the top tree, just not here. Picking a
 * session re-points context AND navigates to the Code surface — unlike the
 * top section, a session is somewhere to jump TO. It's lifted to start around
 * the panel's mid-point rather than pinned to the bottom. Unaffected by the
 * Projects filter above.
 */
export function WorkspacePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree } =
    useWorkspace();
  const [filter, setFilter] = useState<PanelFilter>("all");

  const tree = buildProjectTree(projects);
  const sessions = activeSessionRows(projects);
  const apps = allAppRows(projects);
  const codeHref = surfaceAppById("code").href;
  const buildHref = surfaceAppById("build").href;

  // Placeholder until the ops/observe canvas framework lands: an app row
  // re-points context (so the surface it lands on knows which project it's
  // looking at) and jumps to Build & Setup, the surface the less-technical
  // persona lives in. Once the canvas framework exists this opens the app in
  // an ops/observe canvas instead of just navigating there.
  function openApp(projectId: string) {
    setActiveProject(projectId);
    if (pathname !== buildHref) router.push(buildHref);
  }

  return (
    <aside className={styles.panel} aria-label="Workspace">
      {/* Close affordance only — no panel title, to keep the chrome quiet. */}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close workspace panel"
        >
          <CloseIcon width={18} height={18} />
        </button>
      </header>

      <section className={styles.section} aria-label="Projects">
        <h2 className={styles.heading}>Projects</h2>

        {/* Segmented filter — governs this section only, the Sessions section
            below is untouched. Local state, not persisted (see `PanelFilter`). */}
        <div className={styles.filterBar} role="group" aria-label="Filter projects panel">
          {(Object.keys(FILTER_LABEL) as PanelFilter[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${styles.filterButton} ${filter === mode ? styles.filterButtonActive : ""}`}
              aria-pressed={filter === mode}
              onClick={() => setFilter(mode)}
            >
              {FILTER_LABEL[mode]}
            </button>
          ))}
        </div>

        {filter === "apps" ? (
          // The flat cross-project view: "show me everything running,"
          // ungrouped — the point is a single scannable list, not a tree.
          apps.length === 0 ? (
            <p className={styles.empty}>No deployed apps yet.</p>
          ) : (
            <ul className={styles.appList}>
              {apps.map(({ project, app }) => (
                // Composite key: app ids are only unique WITHIN a project
                // (model.ts convention), so this flat cross-project list needs
                // the project id to guarantee uniqueness — same as sessions below.
                <li key={`${project.id}::${app.id}`}>
                  <AppRow
                    project={project}
                    app={app}
                    showProject
                    nested={false}
                    lastChild={false}
                    onSelect={() => openApp(project.id)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className={styles.tree}>
            {tree.map(({ project, base, children }) => {
              const isProjectCurrent = project.id === activeProject.id;
              const isBaseCurrent = isProjectCurrent && base.worktree.id === activeWorktree.id;
              // Apps are tree-connected children too (in "all"), rendered
              // after the worktrees. When a project has them, the last
              // worktree must NOT cap the connector with a └ corner — the
              // guide has to continue down into the apps, whose own last row
              // draws the corner instead.
              const nestedApps = filter === "all" ? project.apps : [];
              return (
                <li key={project.id}>
                  {/* The project and its primary worktree ("main") are ONE node:
                      the project name as the title, main as the subtitle — not a
                      header with a separate child row. Selecting it lands on main
                      (its subtitle). Pass project.id explicitly, same closure
                      reason as the child rows. main's activity still surfaces in
                      the Active list below; no status dot here. */}
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
                                lastChild && nestedApps.length === 0
                                  ? styles.worktreeRowLast
                                  : ""
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

                  {/* Deployed outputs — hidden in "projects" mode (source
                      tree only), shown nested under their project in "all" as
                      tree-connected children at the same level as worktrees:
                      an app is the project's distribution artifact, a sibling
                      of its branches, not a peer of the project. */}
                  {nestedApps.length > 0 && (
                    <ul className={styles.appList}>
                      {nestedApps.map((app, index) => (
                        <li key={app.id}>
                          <AppRow
                            project={project}
                            app={app}
                            showProject={false}
                            nested
                            lastChild={index === nestedApps.length - 1}
                            onSelect={() => openApp(project.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-label="Sessions">
        <h2 className={styles.heading}>Sessions</h2>
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
