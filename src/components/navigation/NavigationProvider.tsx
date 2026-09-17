"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { applicationClient, getActiveSelectionStore as getWorkspaceSelectionStore } from "@/lib/application/client";
import { getActiveCanvasStore as getSurfaceCanvasStore } from "@/lib/application/client";
import { canvasId, type CanvasSpecInput, type CapabilityScope } from "@/lib/surface-canvas/model";
import { NavigationController, canvasTarget, destinationHref, readDestination, resolveDestination, improvementProjectDestination, type Destination } from "@/lib/navigation/model";
import { UNBOUND_TARGET, type WorkspaceTarget } from "@/lib/workspace/context";
import { primaryWorktree } from "@/lib/workspace/model";
import { isSurfaceId, type SurfaceId } from "@/lib/workspace/surfaces";

type PlanDestination = Pick<import("@/lib/projects/model").ImprovementProject, "id" | "name" | "targetOrgId">;

type Navigation = {
  problem: string | null;
  captureIntent: () => () => boolean;
  navigateSurface: (surface: SurfaceId | null, view?: "restore" | "overview") => void;
  openImprovementProject: (project: PlanDestination) => void;
  openCanvas: (surface: SurfaceId, input: CanvasSpecInput) => void;
  selectCanvas: (surface: SurfaceId, id: string) => void;
  selectProject: (projectId: string, worktreeId?: string, surface?: SurfaceId | null) => void;
  selectOrg: (orgId: string) => void;
  copyToSelectedScope: (surface: SurfaceId, id: string, input: CanvasSpecInput) => Promise<boolean>;
  capabilityScope: CapabilityScope;
  hrefForSurface: (surface: SurfaceId | null) => string;
};
const Context = createContext<Navigation | null>(null);
type NavigationActions = Omit<Navigation, "problem" | "capabilityScope" | "hrefForSurface">;
const ActionsContext = createContext<NavigationActions | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const { profile } = useDemoProfile();
  const workspace = useWorkspace();
  const [problem, setProblem] = useState<string | null>(null);
  const owner = profile!.id;
  const selection = getWorkspaceSelectionStore(owner), canvases = getSurfaceCanvasStore(owner);
  const controller = useMemo(() => new NavigationController((destination, source) => {
    applicationClient.workspace?.flushEdits();
    const decision = resolveDestination(destinationHref(destination), owner, profile?.surfaceAccess ?? [], canvases.getSnapshot());
    if (decision.kind === "unavailable") { setProblem(decision.reason); return false; }
    if (source !== "capture" && destination.surface && destination.canvas
      && !(source === "restore" ? canvases.canViewCanvas(destination.surface, destination.canvas) : canvases.canOpenCanvas(destination.surface, destination.canvas))) {
      setProblem("This surface already has 20 open tabs. Close a tab before opening another. Its saved draft will be preserved."); return false;
    }
    const id = destination.canvas ? canvasId(destination.canvas.kind, destination.canvas.params) : null;
    setProblem(null);
    if (source === "restore") return;
    if (destination.surface && id) canvases.captureTarget(destination.surface, id, destination.target);
    if (source === "capture") return;
    selection.setTarget(destination.target);
    if (destination.surface) {
      if (destination.canvas) canvases.openCanvas(destination.surface, destination.canvas);
      else canvases.setActiveCanvas(destination.surface, "overview");
    }
  }, (href, replace) => replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })), [owner, selection, canvases, router, profile]);

  function targetForCanvas(surface: SurfaceId, input: CanvasSpecInput): WorkspaceTarget {
    const captured = canvases.getSnapshot()[surface].targets?.[canvasId(input.kind, input.params)];
    if (captured) return captured;
    const project = input.kind === "capability" ? null : workspace.projects.find((item) => item.id === input.params.projectId);
    const remembered = project ? selection.getSnapshot().orgByProject[project.id] : undefined;
    return canvasTarget(input, { projectId: null, worktreeId: null, orgId: input.kind === "improvement-project" ? project?.defaultOrgId ?? null : remembered ?? project?.defaultOrgId ?? null });
  }
  function currentDestination(surface: SurfaceId | null): Destination {
    const state = canvases.getSnapshot(), slice = surface ? state[surface] : null;
    const canvas = slice?.canvases.find((item) => item.id === slice.activeCanvasId);
    const target = workspace.target;
    return { version: 1, owner, surface, target: canvas && canvas.kind !== "overview" ? targetForCanvas(surface!, canvas) : target,
      ...(canvas && canvas.kind !== "overview" ? { canvas: { kind: canvas.kind, title: canvas.title, params: canvas.params } as CanvasSpecInput } : {}) };
  }
  const restore = useRef<(href: string, history?: boolean) => void>(() => {});
  useEffect(() => {
    restore.current = (href, history = false) => {
      const decoded = readDestination(href);
      if (decoded.kind === "invalid") { controller.restore(href, history); setProblem(decoded.reason); return; }
      if (decoded.kind === "destination") { controller.restore(href, history); return; }
      const route = new URL(href, window.location.origin).pathname.slice(1);
      const surface = isSurfaceId(route) ? route : null;
      controller.navigate(currentDestination(surface), true, "restore");
    };
  });
  useEffect(() => { restore.current(`${pathname}${search.size ? `?${search.toString()}` : ""}`); }, [pathname, search, controller]);
  useEffect(() => {
    const pop = () => restore.current(`${window.location.pathname}${window.location.search}`, true);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  const activeSurface = isSurfaceId(pathname.slice(1)) ? pathname.slice(1) as SurfaceId : null;
  const capabilityScope: CapabilityScope = workspace.target.projectId ? { scope: "project", projectId: workspace.target.projectId,
    ...(workspace.target.worktreeId ? { worktreeId: workspace.target.worktreeId } : {}), ...(workspace.target.orgId ? { orgId: workspace.target.orgId } : {}) } : { scope: "unbound" };
  const openCanvas = (surface: SurfaceId, input: CanvasSpecInput) => {
    controller.navigate({ version: 1, owner, surface, canvas: input, target: targetForCanvas(surface, input) });
  };
  const openImprovementProject = (project: PlanDestination) => {
    const destination = improvementProjectDestination(owner, project);
    const id = canvasId(destination.canvas!.kind, destination.canvas!.params);
    const captured = canvases.getSnapshot().alm.targets?.[id];
    controller.navigate(improvementProjectDestination(owner, project, captured));
  };
  const selectProject = (projectId: string, worktreeId?: string, surface: SurfaceId | null = activeSurface) => {
    const project = workspace.projects.find((item) => item.id === projectId);
    if (profile?.onboarding && project) { openImprovementProject({ id: project.id, name: project.name, targetOrgId: project.defaultOrgId }); return; }
    const stored = selection.getSnapshot();
    const target: WorkspaceTarget = { projectId, worktreeId: worktreeId ?? (project ? primaryWorktree(project)?.id ?? null : null), orgId: stored.orgByProject[projectId] ?? project?.defaultOrgId ?? null };
    controller.navigate({ version: 1, owner, surface, target });
  };
  const visibleProblem = workspace.destination.kind === "unavailable" ? workspace.destination.reason : problem;
  const value: Navigation = {
    problem: visibleProblem,
    captureIntent: () => controller.captureIntent(),
    navigateSurface: (surface, view = "restore") => controller.navigate(view === "overview" ? { version: 1, owner, surface, target: workspace.target } : currentDestination(surface)),
    hrefForSurface: (surface) => destinationHref(currentDestination(surface)),
    openCanvas, openImprovementProject, selectProject, capabilityScope,
    selectCanvas: (surface, id) => {
      const canvas = canvases.getSnapshot()[surface].canvases.find((item) => item.id === id);
      if (canvas && canvas.kind !== "overview") openCanvas(surface, canvas);
      else if (id === "overview") controller.navigate({ version: 1, owner, surface, target: workspace.target });
    },
    selectOrg: (orgId) => {
      if (workspace.orgs.some((org) => org.id === orgId && org.connection === "connected")) {
        // Choosing context leaves any captured draft intact and opens Overview.
        controller.navigate({ version: 1, owner, surface: activeSurface, target: { ...workspace.target, orgId } });
      }
    },
    copyToSelectedScope: async (surface, id, input) => {
      if (!canvases.canOpenCanvas(surface, input)) {
        setProblem("This surface already has 20 open tabs. Close a tab before copying this draft. Your original draft is preserved."); return false;
      }
      if (!await canvases.copyDraft(surface, id, input)) {
        setProblem("The draft could not be copied. A saved draft may already exist for this target, or edits may still be pending. Review saved changes before trying again."); return false;
      }
      openCanvas(surface, input);
      return true;
    },
  };
  const currentActions = useRef(value);
  useLayoutEffect(() => { currentActions.current = value; });
  const actions = useMemo<NavigationActions>(() => ({
    captureIntent: () => currentActions.current.captureIntent(),
    navigateSurface: (...args) => currentActions.current.navigateSurface(...args),
    openImprovementProject: (...args) => currentActions.current.openImprovementProject(...args),
    openCanvas: (...args) => currentActions.current.openCanvas(...args),
    selectCanvas: (...args) => currentActions.current.selectCanvas(...args),
    selectProject: (...args) => currentActions.current.selectProject(...args),
    selectOrg: (...args) => currentActions.current.selectOrg(...args),
    copyToSelectedScope: (...args) => currentActions.current.copyToSelectedScope(...args),
  }), []);
  return <ActionsContext.Provider value={actions}><Context.Provider value={value}>
    {visibleProblem && <aside role="alert"><strong>Destination unavailable</strong><p>{visibleProblem}</p><button type="button" onClick={() => controller.navigate({ version: 1, owner, surface: null, target: UNBOUND_TARGET })}>Open my workspace</button></aside>}
    {workspace.context.status === "unavailable" && !visibleProblem && <aside role="status"><strong>Workspace unavailable</strong><p>{workspace.context.reason} Your saved work is preserved. Select a project or connected org to continue.</p></aside>}
    {children}
  </Context.Provider></ActionsContext.Provider>;
}
export function useNavigation(): Navigation {
  const context = useContext(Context);
  if (!context) throw new Error("useNavigation must be used within NavigationProvider");
  return context;
}
export function useNavigationActions(): NavigationActions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("useNavigationActions requires NavigationProvider");
  return value;
}
