"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  primaryWorktree,
  sessionKey,
  type Environment,
  type Project,
  type Worktree,
} from "@/lib/workspace/model";
import { PROJECTS } from "@/lib/workspace/fixtures";

type WorkspaceContextValue = {
  projects: readonly Project[];
  activeProject: Project;
  activeWorktree: Worktree;
  activeEnvironment: Environment;
  /** Stable key for the current agent thread: {project, worktree}. */
  sessionKey: string;
  setActiveProject: (projectId: string) => void;
  setActiveWorktree: (worktreeId: string) => void;
  setActiveEnvironment: (environmentId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Shell-level workspace context — a peer to the agent, not owned by any surface.
 * Holds which project you're in, which worktree (per project), and which
 * environment (per project). Because it lives above the router outlet and never
 * unmounts, the project follows you as you move between surfaces.
 *
 * Fixture-backed for now; the provider is the seam. Surfaces read `useWorkspace()`
 * and never touch the concrete data source, so swapping fixtures for real sfdx /
 * org queries is invisible to them.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const projects = PROJECTS;
  const [activeProjectId, setActiveProjectId] = useState(projects[0]!.id);
  // Selections are kept per-project so switching away and back restores them.
  const [worktreeByProject, setWorktreeByProject] = useState<Record<string, string>>({});
  const [environmentByProject, setEnvironmentByProject] = useState<Record<string, string>>({});

  const value = useMemo<WorkspaceContextValue>(() => {
    const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0]!;

    const worktreeId = worktreeByProject[activeProject.id];
    const activeWorktree =
      activeProject.worktrees.find((w) => w.id === worktreeId) ?? primaryWorktree(activeProject);

    const environmentId = environmentByProject[activeProject.id];
    const activeEnvironment =
      activeProject.environments.find((e) => e.id === environmentId) ??
      activeProject.environments[0]!;

    return {
      projects,
      activeProject,
      activeWorktree,
      activeEnvironment,
      sessionKey: sessionKey(activeProject.id, activeWorktree.id),
      setActiveProject: setActiveProjectId,
      setActiveWorktree: (id) =>
        setWorktreeByProject((current) => ({ ...current, [activeProject.id]: id })),
      setActiveEnvironment: (id) =>
        setEnvironmentByProject((current) => ({ ...current, [activeProject.id]: id })),
    };
  }, [projects, activeProjectId, worktreeByProject, environmentByProject]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return value;
}
