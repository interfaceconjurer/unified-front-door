"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { selectedSnapshot } from "@/lib/selected-snapshot";
import { readDestination, resolveDestination, type DestinationDecision } from "@/lib/navigation/model";
import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { primaryWorktree, type AgentSession, type Org, type Project, type Worktree } from "@/lib/workspace/model";
import { homeTarget, resolveWorkspace, UNBOUND_TARGET, type WorkspaceResolution, type WorkspaceTarget } from "@/lib/workspace/context";
import { PROJECTS } from "@/lib/workspace/fixtures";
import { orgsForProfile } from "@/lib/workspace/orgs";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getActiveCanvasStore as getSurfaceCanvasStore } from "@/lib/application/client";
import { getActiveSelectionStore as getWorkspaceSelectionStore } from "@/lib/application/client";
import { useAssessmentRunner } from "@/components/onboarding/use-assessment";
import { workspaceProject } from "@/lib/onboarding/assessment";

export type WorkspacePanelFilter = "all" | "projects" | "apps";

type WorkspaceContextValue = {
  hasProjects: boolean;
  projects: readonly Project[];
  orgs: readonly Org[];
  activeProject: Project | null;
  activeWorktree: Worktree | null;
  activeOrg: Org | null;
  agentSessions: readonly AgentSession[];
  sessionKey: string;
  context: WorkspaceResolution;
  target: WorkspaceTarget;
  destination: DestinationDecision;
  panelFilter: WorkspacePanelFilter;
  setPanelFilter: (filter: WorkspacePanelFilter) => void;
  projectPanelRequest: number;
  openProjectPanel: () => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Workspace projection and ephemeral panel UI. NavigationController owns selection. */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile, resolved } = useDemoProfile();
  const [panelFilter, setPanelFilter] = useState<WorkspacePanelFilter>("all");
  const [projectPanelRequest, setProjectPanelRequest] = useState(0);
  const assessment = useAssessmentRunner();
  const pathname = usePathname(), search = useSearchParams();
  const route = `${pathname}?${search.toString()}`;
  const projects = useMemo(() => [...(profile?.workspaceExperience === "established" ? PROJECTS : []), ...assessment.projects.map(workspaceProject)], [assessment.projects, profile?.workspaceExperience]);
  const orgs = orgsForProfile(profile?.id ?? "jw");
  const store = getWorkspaceSelectionStore(profile?.id ?? "jw");
  const selection = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const decoded = readDestination(route);
  const canvasStore = getSurfaceCanvasStore(profile?.id ?? "jw", decoded.kind === "destination" ? decoded.value.target
    : pathname === "/" ? UNBOUND_TARGET : selection.target ?? UNBOUND_TARGET);
  const destinationReader = useMemo(() => {
    const select = (canvases: ReturnType<typeof canvasStore.getSnapshot>) => resolveDestination(route, profile?.id ?? "jw", profile?.surfaceAccess ?? [], canvases);
    const equal = (a: DestinationDecision, b: DestinationDecision) => JSON.stringify(a) === JSON.stringify(b);
    return { get: selectedSnapshot(canvasStore.getSnapshot, select, equal), server: selectedSnapshot(canvasStore.getServerSnapshot, select, equal) };
  }, [canvasStore, route, profile]);
  const destination = useSyncExternalStore(canvasStore.subscribe, destinationReader.get, destinationReader.server);
  const value = useMemo<WorkspaceContextValue>(() => {
    // A missing old preference may use that project's declared default. A saved
    // unknown identity remains unknown. No project or org is fabricated.
    const project = projects.find((item) => item.id === selection.activeProjectId);
    const restored = selection.target ?? {
      projectId: selection.activeProjectId,
      worktreeId: selection.activeProjectId ? selection.worktreeByProject[selection.activeProjectId] ?? (project ? primaryWorktree(project)?.id ?? null : null) : null,
      orgId: selection.activeProjectId ? selection.orgByProject[selection.activeProjectId] ?? project?.defaultOrgId ?? null : null,
    };
    const target = destination.kind === "absent" ? pathname === "/" ? homeTarget(restored) : restored : destination.kind === "available" ? destination.destination.target : UNBOUND_TARGET;
    const context = resolveWorkspace(target, projects, orgs, resolved);
    if (destination.kind === "unavailable") { context.status = "unavailable"; context.reason = destination.reason; }
    return { projects, orgs, hasProjects: projects.length > 0, context, target, destination,
      panelFilter, setPanelFilter, projectPanelRequest,
      openProjectPanel: () => {
        store.setPanelOpen(true);
        setPanelFilter("projects");
        setProjectPanelRequest((request) => request + 1);
      },
      activeProject: context.project, activeWorktree: context.worktree, activeOrg: context.org,
      agentSessions: context.project?.agentSessions ?? [], sessionKey: context.sessionKey };
  }, [projects, orgs, selection, resolved, destination, pathname, store, panelFilter, projectPanelRequest]);
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
 * Fresh profiles start closed regardless of their seeded projects. Once the
 * user toggles the panel, that preference survives routes and profile changes.
 */
export function useWorkspacePanel(): {
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
  const panelOpen = selection.panelOpen ?? false;
  return {
    panelOpen,
    togglePanel: () => workspaceSelectionStore.setPanelOpen(!panelOpen),
  };
}
