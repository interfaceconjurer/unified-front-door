"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BoxIcon,
  GitBranchIcon,
  LayersIcon,
  PlusIcon,
  SparklesIcon,
} from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace, type WorkspacePanelFilter } from "@/components/workspace/workspace-context";
import { useSurfaceCanvases } from "@/components/surfaces/surface-canvas-context";
import type { DeployedApp, Project } from "@/lib/workspace/model";
import {
  allAppRows,
  allSessionRows,
  APP_STATUS_LABEL,
  buildProjectTree,
  STATUS_LABEL,
} from "@/lib/workspace/selectors";
import styles from "./WorkspacePanel.module.css";

const FILTER_LABEL: Record<WorkspacePanelFilter, string> = {
  all: "All",
  projects: "Projects",
  apps: "Apps",
};

/** A project's deployed output, listed under the project at the same indent as
 *  its worktrees — an app is the project's distribution artifact ("dist folder"),
 *  owned by the project. Deliberately NOT tree-connected: the git guide lines
 *  belong to source branches, and running them into the apps would imply an app
 *  is the same kind of node as a branch. Apps instead read as a distinct group —
 *  a package glyph, no connector lines — that happens to sit at the worktree
 *  level. The trailing slot carries the app's status word; the live URL isn't
 *  shown here (that lives in the app's ops canvas). `nested` only adds the deeper
 *  indent used under a project; the flat "Apps" list drops it. `showProject`
 *  surfaces the owning project's name, used only in that flat list where rows
 *  aren't under a project header. */
function AppRow({
  project,
  app,
  showProject,
  nested,
  onSelect,
}: {
  project: Project;
  app: DeployedApp;
  showProject: boolean;
  nested: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={nested ? `${styles.appRow} ${styles.appNested}` : styles.appRow}
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
 * filter (ephemeral WorkspaceProvider state) governs this section only:
 * "all" nests app rows under their project, "projects" hides them for the
 * plain source tree, "apps" flattens every app across every project into one
 * list (the "what's running right now" view) instead of grouping by project.
 * Picking a project/worktree row re-points workspace context and STAYS on
 * the current surface — this section is ambient wayfinding, not a jump list.
 * An app row is the exception: it jumps to ALM (see `AppRow`'s
 * caller below) since an app isn't a place you navigate context within, it's
 * a deployed thing you go look at.
 *
 * Bottom ("Sessions"): a flat, cross-project list of EVERY agent session,
 * sorted waiting → working → idle — the same set the ⌘⇧P palette's Sessions
 * tab shows, over the same `allSessionRows` derivation, so the two never
 * disagree on the count. Waiting/working float to the top as the triage
 * priority, with idle sessions listed below rather than hidden. Picking a
 * session re-points context AND navigates to the Code surface — unlike the
 * top section, a session is somewhere to jump TO. It's lifted to start around
 * the panel's mid-point rather than pinned to the bottom. Unaffected by the
 * Projects filter above.
 */
export function WorkspacePanel({ onClose }: { onClose: () => void }) {
  const { navigateSurface, selectProject, openProjectCreation } = useNavigation();
  const pathname = usePathname();
  const { profile } = useDemoProfile();
  const { openCanvas } = useSurfaceCanvases("alm");
  const { projects, activeProject, activeWorktree, hasProjects,
    panelFilter: filter, setPanelFilter: setFilter, projectPanelRequest } =
    useWorkspace();
  const activeProjectRow = useRef<HTMLButtonElement>(null);
  const projectsFilter = useRef<HTMLButtonElement>(null);
  const projectsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!projectPanelRequest) return;
    // Wait for the open panel to lose `inert`. Consume only this reveal request;
    // later context changes must not steal focus from the user's next action.
    const frame = requestAnimationFrame(() => {
      const row = activeProjectRow.current ?? projectsFilter.current ?? projectsHeading.current;
      const section = row?.closest("section");
      if (!row || !section || row.closest("[inert]")) return;
      row.focus({ preventScroll: true });
      // Reveal vertically inside Projects without scrolling the whole shell.
      const bounds = row.getBoundingClientRect(), viewport = section.getBoundingClientRect();
      if (bounds.top < viewport.top) section.scrollTop += bounds.top - viewport.top;
      else if (bounds.bottom > viewport.bottom) section.scrollTop += bounds.bottom - viewport.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [projectPanelRequest]);

  const tree = buildProjectTree(projects);
  const sessions = allSessionRows(projects);
  const apps = allAppRows(projects);

  function startProject() {
    onClose();
    openProjectCreation();
  }

  function startConversation() {
    onClose();
    if (pathname === "/") {
      requestAnimationFrame(() => document.getElementById("agent-composer")?.focus());
    } else {
      navigateSurface(null);
      requestAnimationFrame(() => document.getElementById("agent-composer")?.focus());
    }
  }

  if (!profile) return null;

  if (!hasProjects) {
    return (
      <aside className={styles.panel} aria-label="Workspace">

        <section className={styles.section} aria-label="Projects">
          <h2 ref={projectsHeading} tabIndex={-1} className={styles.heading}>Projects</h2>
          <div className={styles.guidedEmpty}>
            <button type="button" className={styles.emptyAction} onClick={startProject}>
              <PlusIcon width={15} height={15} aria-hidden="true" />
              Start your first project
            </button>
          </div>
        </section>

        <section className={styles.section} aria-label="Sessions">
          <h2 className={styles.heading}>Sessions</h2>
          <div className={styles.guidedEmpty}>
            <button type="button" className={styles.emptyAction} onClick={startConversation}>
              <SparklesIcon width={15} height={15} aria-hidden="true" />
              Start a conversation
            </button>
          </div>
        </section>
      </aside>
    );
  }

  // Deployed app operations live in ALM.
  function openApp(project: Project, app: DeployedApp) {
    openCanvas("alm", {
      kind: "app",
      title: app.label,
      params: { projectId: project.id, appId: app.id },
    });
  }

  return (
    <aside className={styles.panel} aria-label="Workspace">

      <section className={styles.section} aria-label="Projects">
        <h2 ref={projectsHeading} tabIndex={-1} className={styles.heading}>Projects</h2>

        {/* Segmented filter — governs this section only, the Sessions section
            below is untouched. Overview project links request Projects here. */}
        <div className={styles.filterBar} role="group" aria-label="Filter projects panel">
          {(Object.keys(FILTER_LABEL) as WorkspacePanelFilter[]).map((mode) => (
            <button
              key={mode}
              ref={mode === "projects" ? projectsFilter : undefined}
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
                    onSelect={() => openApp(project, app)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className={styles.tree}>
            {tree.map(({ project, base, children }) => {
              const isProjectCurrent = project.id === activeProject?.id;
              const isBaseCurrent = isProjectCurrent && base?.worktree.id === activeWorktree?.id;
              // Apps render as a separate, un-connected group after the
              // worktrees (in "all" only), so the source tree closes normally
              // with its own └ corner on the last branch.
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
                    ref={isProjectCurrent ? activeProjectRow : undefined}
                    className={`${styles.row} ${isProjectCurrent ? styles.rowCurrent : ""}`}
                    aria-current={isBaseCurrent}
                    onClick={() => {
                      selectProject(project.id, base?.worktree.id);
                    }}
                  >
                    <LayersIcon className={styles.rowIcon} width={16} height={16} />
                    <span className={styles.rowCopy}>
                      <span className={styles.rowLabel}>{project.name}</span>
                      <span className={styles.rowBranch}>{(base?.worktree.label ?? "Planning project")}</span>
                    </span>
                  </button>

                  {children.length > 0 && (
                    <ul className={styles.worktreeList}>
                      {children.map(({ worktree, status, lastChild }) => {
                        const isCurrent = isProjectCurrent && worktree.id === activeWorktree?.id;
                        return (
                          <li key={worktree.id}>
                            <button
                              type="button"
                              className={`${styles.worktreeRow} ${
                                lastChild ? styles.worktreeRowLast : ""
                              } ${isCurrent ? styles.rowCurrent : ""}`}
                              aria-current={isCurrent}
                              onClick={() => {
                                selectProject(project.id, worktree.id);
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

                  {/* Deployed outputs — hidden in "projects" mode (source tree
                      only), shown under their project in "all" as a distinct,
                      un-connected group at the worktree indent: an app is the
                      project's distribution artifact, owned by it but not a
                      source branch, so it gets no git guide line. */}
                  {nestedApps.length > 0 && (
                    <ul className={styles.appList}>
                      {nestedApps.map((app) => (
                        <li key={app.id}>
                          <AppRow
                            project={project}
                            app={app}
                            showProject={false}
                            nested
                            onSelect={() => openApp(project, app)}
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
          <p className={styles.empty}>No agent sessions yet.</p>
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map(({ project, worktree, session }) => {
              const isCurrent = project.id === activeProject?.id && worktree.id === activeWorktree?.id;
              return (
                <li key={`${project.id}::${worktree.id}`}>
                  <button
                    type="button"
                    className={`${styles.sessionRow} ${isCurrent ? styles.rowCurrent : ""}`}
                    aria-current={isCurrent}
                    onClick={() => {
                      selectProject(project.id, worktree.id);
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
