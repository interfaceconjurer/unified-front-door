"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  primaryWorktree,
  sessionKey,
  type AgentSession,
  type Org,
  type Project,
  type SurfaceId,
  type Worktree,
} from "@/lib/workspace/model";
import { ORGS, PROJECTS } from "@/lib/workspace/fixtures";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getWorkspaceSelectionStore } from "@/lib/workspace/persistence";
import { WorkspaceTransition } from "@/lib/workspace/transition";
import { useAssessmentRunner } from "@/components/onboarding/use-assessment";
import { ASSESSMENT_ORGS, workspaceProject } from "@/lib/onboarding/assessment";

export type WorkspacePanelFilter = "all" | "projects" | "apps";

type WorkspaceContextValue = {
  hasProjects: boolean;
  projects: readonly Project[];
  orgs: readonly Org[];
  activeProject: Project;
  activeWorktree: Worktree;
  /** The connected org selected for this project, or for the initial assessment. */
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
  /** Load a workspace after its content dissolves. A routed selection also
   *  waits for that surface to mount before revealing the incoming state. */
  switchWorkspace: (projectId: string, worktreeId?: string, afterSelection?: () => void, destination?: SurfaceId) => void;
  /** Create the project and its initial canvas only after the outgoing content
   *  dissolves, then select its primary worktree before revealing the new chat. */
  createWorkspace: (create: () => Project | null) => void;
  workspaceSwitching: boolean;
  panelFilter: WorkspacePanelFilter;
  setPanelFilter: (filter: WorkspacePanelFilter) => void;
  projectPanelRequest: number;
  openProjectPanel: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const CONNECTED_ASSESSMENT_ORGS = ASSESSMENT_ORGS.filter((org) => org.connection === "connected");

const EMPTY_PROJECT: Project = {
  id: "org-assessment", name: "Org assessment", description: "Discover your first project.",
  defaultOrgId: "prod", worktrees: [{ id: "main", label: "Planning", branch: "main", isPrimary: true }],
  facets: { objects: 0, flows: 0, apexClasses: 0, lwc: 0, permissionSets: 0 },
  agentSessions: [], apps: [],
};

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
  const { profile } = useDemoProfile();
  const [panelFilter, setPanelFilter] = useState<WorkspacePanelFilter>("all");
  const [projectPanelRequest, setProjectPanelRequest] = useState(0);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceTransition] = useState(() => new WorkspaceTransition(setWorkspaceSwitching));
  useEffect(() => () => workspaceTransition.cancel(), [workspaceTransition]);
  const assessment = useAssessmentRunner();
  const dayZero = profile?.onboarding === "org-assessment";
  const projects = useMemo(() => dayZero ? assessment.projects.map(workspaceProject) : PROJECTS, [dayZero, assessment.projects]);
  const orgs = dayZero ? CONNECTED_ASSESSMENT_ORGS : ORGS;
  const hasProjects = dayZero ? projects.length > 0 : profile?.workspaceExperience === "established";
  const workspaceSelectionStore = getWorkspaceSelectionStore(profile?.id ?? "jw");
  const selection = useSyncExternalStore(
    workspaceSelectionStore.subscribe,
    workspaceSelectionStore.getSnapshot,
    workspaceSelectionStore.getServerSnapshot,
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const activeProjectId = selection.activeProjectId ?? projects[0]?.id;
    // Existing surface contracts require a project context. Before creation,
    // provide a neutral planning context; it is never listed as a real project.
    const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? EMPTY_PROJECT;

    const worktreeId = selection.worktreeByProject[activeProject.id];
    const activeWorktree =
      activeProject.worktrees.find((w) => w.id === worktreeId) ?? primaryWorktree(activeProject);

    const orgId = selection.orgByProject[activeProject.id] ?? activeProject.defaultOrgId;
    const activeOrg = orgs.find((o) => o.id === orgId && o.connection === "connected")
      ?? orgs.find((o) => o.connection === "connected")!;

    return {
      hasProjects,
      projects,
      orgs,
      activeProject,
      activeWorktree,
      activeOrg,
      panelFilter,
      setPanelFilter,
      projectPanelRequest,
      openProjectPanel: () => {
        workspaceSelectionStore.setPanelOpen(true);
        setPanelFilter("projects");
        setProjectPanelRequest((request) => request + 1);
      },
      agentSessions: activeProject.agentSessions,
      sessionKey: sessionKey(activeProject.id, activeWorktree.id),
      setActiveProject: workspaceSelectionStore.setActiveProjectId,
      workspaceSwitching,
      createWorkspace: (create) => {
        workspaceTransition.request(() => {
          const project = create();
          if (project) workspaceSelectionStore.selectWorkspace(project.id, primaryWorktree(project).id);
        });
      },
      switchWorkspace: (projectId, worktreeId, afterSelection, destination) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) return;
        const treeId = worktreeId ?? selection.worktreeByProject[projectId] ?? primaryWorktree(project).id;
        if (!project.worktrees.some((tree) => tree.id === treeId)) return;
        if (projectId === activeProject.id && treeId === activeWorktree.id && !workspaceTransition.active) {
          afterSelection?.();
          return;
        }
        workspaceTransition.request(() => {
          workspaceSelectionStore.selectWorkspace(projectId, treeId);
          afterSelection?.();
        }, destination ? () => !!document.querySelector(`[data-workspace-content="surface"][data-surface-id="${destination}"]`) : undefined);
      },
      setActiveWorktree: (id, projectId) =>
        workspaceSelectionStore.setWorktreeForProject(projectId ?? activeProject.id, id),
      setActiveOrg: (id) => {
        if (orgs.some((org) => org.id === id && org.connection === "connected")) {
          workspaceSelectionStore.setOrgForProject(activeProject.id, id);
        }
      },
    };
  }, [projects, orgs, hasProjects, selection, workspaceSelectionStore, workspaceTransition, workspaceSwitching, panelFilter, projectPanelRequest]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return value;
}

/**
 * The persisted workspace-panel open flag, split out from `useWorkspace()`
 * because `AppShell` — the component that mounts `<WorkspaceProvider>` — needs
 * it too, and a component can't consume a context it's the one providing.
 * Subscribes to the same store directly via `useSyncExternalStore`, so it's
 * SSR-safe (fixed closed default on the server and first hydration pass) the
 * same way the provider's own selection read is.
 *
 * The persisted value is tri-state (`boolean | null`, see `PersistedSelection`):
 * `null` means the user has never explicitly toggled the panel, so this hook
 * resolves a route-dependent default — open on the home route (that's where
 * you browse projects/apps/sessions), closed elsewhere — via `isHome`. Once
 * the user explicitly toggles (⌘B or the close button), the stored value
 * becomes `true`/`false` and that choice wins on every route, home included,
 * until they toggle again. This is what "defaults open on home without
 * breaking the persisted toggle" comes down to: default only fills the gap
 * left by "unset," it never overrides an explicit choice.
 */
export function useWorkspacePanel(isHome: boolean): {
  panelOpen: boolean;
  togglePanel: () => void;
} {
  const { profile } = useDemoProfile();
  const workspaceSelectionStore = getWorkspaceSelectionStore(profile?.id ?? "jw");
  const selection = useSyncExternalStore(
    workspaceSelectionStore.subscribe,
    workspaceSelectionStore.getSnapshot,
    workspaceSelectionStore.getServerSnapshot,
  );
  const panelOpen = selection.panelOpen ?? isHome;
  return {
    panelOpen,
    togglePanel: () => workspaceSelectionStore.setPanelOpen(!panelOpen),
  };
}
