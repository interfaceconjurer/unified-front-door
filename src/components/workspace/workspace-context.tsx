"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import {
  primaryWorktree,
  sessionKey,
  type AgentSession,
  type Org,
  type Project,
  type Worktree,
} from "@/lib/workspace/model";
import { ORGS, PROJECTS } from "@/lib/workspace/fixtures";
import { workspaceSelectionStore } from "@/lib/workspace/persistence";

type WorkspaceContextValue = {
  projects: readonly Project[];
  orgs: readonly Org[];
  activeProject: Project;
  activeWorktree: Worktree;
  /** The org the active project currently targets — a free, independent switch. */
  activeOrg: Org;
  /** The active project's agent sessions, one per worktree — the seam consumers
   *  (e.g. the Code surface's sessions rail) read instead of the fixture. */
  agentSessions: readonly AgentSession[];
  /** Stable key for the current agent thread: {project, worktree}. */
  sessionKey: string;
  setActiveProject: (projectId: string) => void;
  /** Targets `activeProject` by default. Pass `projectId` to set a worktree on
   *  a project other than the active one (e.g. jumping into a project from a
   *  global list) — without it, `setActiveProject` + `setActiveWorktree` back
   *  to back would still write onto the OLD active project, since this value
   *  is a closure over the render that produced it and can't see a project
   *  switch made earlier in the same synchronous call. */
  setActiveWorktree: (worktreeId: string, projectId?: string) => void;
  setActiveOrg: (orgId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Shell-level workspace context — a peer to the agent, not owned by any surface.
 * Holds which project you're in, which worktree (per project), and which org that
 * project targets (per project). Because it lives above the router outlet and
 * never unmounts, the project follows you as you move between surfaces.
 *
 * Fixture-backed for now; the provider is the seam. Surfaces read `useWorkspace()`
 * and never touch the concrete data source, so swapping fixtures for real sfdx /
 * org queries is invisible to them.
 *
 * The three selections (active project, per-project worktree, per-project org)
 * persist to `localStorage` so a reload resumes where you left off — see
 * `@/lib/workspace/persistence`. They're read here via `useSyncExternalStore`
 * rather than `useState`, which is what lets rehydration happen without an
 * effect (nothing for `react-hooks/set-state-in-effect` to catch) and without a
 * hydration mismatch (the server/first-render snapshot is a fixed default; the
 * stored value, if any, applies in React's dedicated post-hydration pass).
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const projects = PROJECTS;
  const orgs = ORGS;
  const selection = useSyncExternalStore(
    workspaceSelectionStore.subscribe,
    workspaceSelectionStore.getSnapshot,
    workspaceSelectionStore.getServerSnapshot,
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const activeProjectId = selection.activeProjectId ?? projects[0]!.id;
    const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0]!;

    const worktreeId = selection.worktreeByProject[activeProject.id];
    const activeWorktree =
      activeProject.worktrees.find((w) => w.id === worktreeId) ?? primaryWorktree(activeProject);

    const orgId = selection.orgByProject[activeProject.id] ?? activeProject.defaultOrgId;
    const activeOrg = orgs.find((o) => o.id === orgId) ?? orgs[0]!;

    return {
      projects,
      orgs,
      activeProject,
      activeWorktree,
      activeOrg,
      agentSessions: activeProject.agentSessions,
      sessionKey: sessionKey(activeProject.id, activeWorktree.id),
      setActiveProject: workspaceSelectionStore.setActiveProjectId,
      setActiveWorktree: (id, projectId) =>
        workspaceSelectionStore.setWorktreeForProject(projectId ?? activeProject.id, id),
      setActiveOrg: (id) => workspaceSelectionStore.setOrgForProject(activeProject.id, id),
    };
  }, [projects, orgs, selection]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return value;
}
