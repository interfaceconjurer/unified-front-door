"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { applicationClient, getActiveSelectionStore as getWorkspaceSelectionStore } from "@/lib/application/client";
import { getActiveCanvasStore as getSurfaceCanvasStore } from "@/lib/application/client";
import { canvasId, canvasVisibleInWorkspace, type CanvasSpecInput, type CapabilityScope } from "@/lib/surface-canvas/model";
import { NavigationController, canvasTarget, canvasDestination, destinationCanvasTarget, destinationHref, readDestination, resolveDestination, improvementProjectDestination, type Destination } from "@/lib/navigation/model";
import { conversationKey, homeTarget, sameTarget, UNBOUND_TARGET, type WorkspaceTarget } from "@/lib/workspace/context";
import { RESOURCE_TYPES, type OrgResource } from "@/lib/org-resources/model";
import { primaryWorktree, sessionKey } from "@/lib/workspace/model";
import { RETURNING_WORK, workCanvasInput } from "@/lib/workspace/returning-work";
import { isSurfaceId, type SurfaceId } from "@/lib/workspace/surfaces";
import { projectCreationCanvas } from "@/lib/projects/creation";
import { canonicalCanvasSurface } from "@/lib/surface-canvas/routing";

type PlanDestination = Pick<import("@/lib/projects/model").ImprovementProject, "id" | "name" | "targetOrgId">;

type Navigation = {
  problem: string | null;
  captureIntent: () => () => boolean;
  navigateSurface: (surface: SurfaceId | null, view?: "restore" | "overview") => void;
  navigateGlobalHome: () => void;
  globalHomeHref: string;
  openResource: (resource: OrgResource) => void;
  openAgentDestination: (destination: Destination) => void;
  openImprovementProject: (project: PlanDestination) => void;
  openProjectCreation: () => void;
  openCanvas: (surface: SurfaceId, input: CanvasSpecInput) => void;
  openCanvasInProject: (surface: SurfaceId, input: CanvasSpecInput) => void;
  selectCanvas: (surface: SurfaceId, id: string) => void;
  selectProject: (projectId: string, worktreeId?: string, surface?: SurfaceId | null) => void;
  selectOrg: (orgId: string) => void;
  copyToSelectedScope: (surface: SurfaceId, id: string, input: CanvasSpecInput) => Promise<boolean>;
  capabilityScope: CapabilityScope;
  hrefForSurface: (surface: SurfaceId | null) => string;
};
const Context = createContext<Navigation | null>(null);
type NavigationActions = Omit<Navigation, "problem" | "capabilityScope" | "hrefForSurface" | "globalHomeHref">;
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
    selection.rememberDestination(destination);
    if (destination.surface && id) canvases.captureTarget(destination.surface, id, destinationCanvasTarget(destination));
    if (source === "capture") return;
    selection.setTarget(destination.target);
    if (destination.surface) {
      if (destination.canvas) canvases.openCanvas(destination.surface, destination.canvas);
      else canvases.setActiveCanvas(destination.surface, "overview");
    }
  }, (href, replace) => {
    const from = readDestination(window.location.href), to = readDestination(href);
    // Dissolve between conversations and across Home's full-width boundary.
    // Org changes and ordinary browsing within a conversation stay continuous.
    const changedContext = from.kind === "destination" && to.kind === "destination" && (
      conversationKey(from.value.target) !== conversationKey(to.value.target)
      || (from.value.surface === null) !== (to.value.surface === null)
    );
    const changedCanvas = from.kind === "destination" && to.kind === "destination"
      && from.value.surface !== null && from.value.surface === to.value.surface
      && (from.value.canvas ? canvasId(from.value.canvas.kind, from.value.canvas.params) : "overview")
        !== (to.value.canvas ? canvasId(to.value.canvas.kind, to.value.canvas.params) : "overview");
    const options = { scroll: false, transitionTypes: changedContext ? ["workspace-context"] : changedCanvas ? ["canvas-change"] : [] };
    if (replace) router.replace(href, options);
    else router.push(href, options);
  }), [owner, selection, canvases, router, profile]);

  function targetForCanvas(surface: SurfaceId, input: CanvasSpecInput): WorkspaceTarget {
    surface = canonicalCanvasSurface(surface, input);
    const captured = canvases.getSnapshot()[surface].targets?.[canvasId(input.kind, input.params)];
    if (captured) return captured;
    const project = input.kind === "capability" || input.kind === "org-resource" || input.kind === "org-assessment" ? null : workspace.projects.find((item) => item.id === input.params.projectId);
    const remembered = project ? selection.getSnapshot().orgByProject[project.id] : undefined;
    return canvasTarget(input, { projectId: null, worktreeId: null, orgId: input.kind === "improvement-project" ? project?.defaultOrgId ?? null : remembered ?? project?.defaultOrgId ?? null });
  }
  function currentDestination(surface: SurfaceId | null): Destination {
    const state = canvases.getSnapshot(), slice = surface ? state[surface] : null;
    const canvas = slice?.canvases.find((item) => item.id === slice.activeCanvasId);
    const target = workspace.target;
    // Surface switching keeps the current scope, including when a project-wide
    // resource is open. Another worktree's last active tab stays hidden.
    if (surface && canvas && canvas.kind !== "overview") {
      const captured = targetForCanvas(surface, canvas);
      if (sameTarget(captured, target) || target.projectId === null && captured.projectId !== null
        || target.projectId !== null && captured.projectId === target.projectId && captured.worktreeId === null)
        return canvasDestination(owner, surface, canvas, captured, target);
    }
    return { version: 1, owner, surface, target };
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
    ...(workspace.target.worktreeId ? { worktreeId: workspace.target.worktreeId } : {}), ...(workspace.target.orgId ? { orgId: workspace.target.orgId } : {}) } : { scope: "unbound", ...(workspace.target.orgId ? { orgId: workspace.target.orgId } : {}) };
  const openCanvas = (surface: SurfaceId, input: CanvasSpecInput) => {
    const captured = targetForCanvas(surface, input);
    if (!canvasVisibleInWorkspace(input, workspace.target, captured)) {
      setProblem("Select this canvas’s project or worktree in the navigator or sidebar to open it here."); return;
    }
    controller.navigate(canvasDestination(owner, surface, input, captured, workspace.target));
  };
  const openCanvasInProject = (surface: SurfaceId, input: CanvasSpecInput) => {
    const captured = targetForCanvas(surface, input);
    // Explicit entry from global browsing. Keep this exact canvas and its saved
    // target, rather than restoring the project's previously visited canvas.
    if (workspace.target.projectId !== null || captured.projectId === null) return;
    controller.navigate({ version: 1, owner, surface: canonicalCanvasSurface(surface, input), target: captured, canvas: input });
  };
  const openImprovementProject = (project: PlanDestination) => {
    // Explicit project entry (including the onboarding “Open project” action).
    const previous = selection.destinationFor(owner, project.id, null);
    if (previous) { controller.navigate(previous); return; }
    const destination = improvementProjectDestination(owner, project);
    const id = canvasId(destination.canvas!.kind, destination.canvas!.params);
    const captured = canvases.getSnapshot().alm.targets?.[id];
    controller.navigate(improvementProjectDestination(owner, project, captured));
  };
  const selectProject = (projectId: string, worktreeId?: string, surface?: SurfaceId | null) => {
    const project = workspace.projects.find((item) => item.id === projectId);
    const stored = selection.getSnapshot();
    const target: WorkspaceTarget = { projectId, worktreeId: worktreeId ?? stored.worktreeByProject[projectId] ?? (project ? primaryWorktree(project)?.id ?? null : null), orgId: stored.orgByProject[projectId] ?? project?.defaultOrgId ?? null };
    const previous = selection.destinationFor(owner, projectId, target.worktreeId);
    if (previous && (surface === undefined || previous.surface === surface)) { controller.navigate(previous); return; }
    if (surface === undefined && project && applicationClient.workspace?.getSnapshot().assessment.projects.some(saved => saved.id === project.id)) { openImprovementProject({ id: project.id, name: project.name, targetOrgId: project.defaultOrgId }); return; }
    const conversation = applicationClient.agent?.getSnapshot().data.conversations.find(saved => saved.threadKey === sessionKey(projectId, target.worktreeId))?.conversation;
    const lastWork = RETURNING_WORK.filter(work => work.projectId === projectId && work.worktreeId === target.worktreeId)
      .sort((a, b) => b.updated.localeCompare(a.updated))[0];
    const lastSurface = conversation && isSurfaceId(conversation.scopeKey) ? conversation.scopeKey : lastWork?.surfaceId ?? null;
    const canvas = !conversation && lastWork && (surface === undefined || surface === lastWork.surfaceId) ? workCanvasInput(lastWork) : undefined;
    controller.navigate({ version: 1, owner, surface: surface === undefined ? lastSurface : surface,
      target: canvas && lastWork ? targetForCanvas(lastWork.surfaceId, canvas) : target, ...(canvas ? { canvas } : {}) });
  };
  const visibleProblem = workspace.destination.kind === "unavailable" ? workspace.destination.reason : problem;
  const globalHome: Destination = { version: 1, owner, surface: null, target: homeTarget(workspace.target) };
  const navigateGlobalHome = () => {
    const agent = applicationClient.agent;
    const thread = agent?.getSnapshot().data.conversations.find(saved => saved.threadKey === conversationKey(globalHome.target))?.conversation;
    // Already at the live Today: no route, history entry, animation or write.
    if (pathname === "/" && !workspace.target.projectId && thread?.scopeKey === "home" && thread.messages.at(-1)?.role === "today") return;
    controller.navigate(globalHome);
    // The conversation reuses a trailing Today and appends one only after
    // other global chat content. The agent queue owns retries of this visit.
    void agent?.command({ kind: "visit", requestId: crypto.randomUUID(), context: { target: globalHome.target, surface: "home" } });
  };
  const value: Navigation = {
    problem: visibleProblem,
    captureIntent: () => controller.captureIntent(),
    navigateSurface: (surface, view = "restore") => surface === null ? navigateGlobalHome() : controller.navigate(view === "overview" ? { version: 1, owner, surface, target: workspace.target } : currentDestination(surface)),
    navigateGlobalHome,
    globalHomeHref: destinationHref(globalHome),
    openAgentDestination: (destination) => {
      if (destination.owner !== owner || destination.target.projectId !== workspace.target.projectId
        || destination.target.worktreeId !== workspace.target.worktreeId) {
        setProblem("Return to the original project and worktree to open this destination."); return;
      }
      controller.navigate(destination);
    },
    openResource: (resource) => openCanvas(RESOURCE_TYPES[resource.resourceType].surface, {
      kind: "org-resource", title: `${resource.label} · ${workspace.orgs.find(org => org.id === resource.orgId)?.label ?? resource.orgId}`,
      params: { orgId: resource.orgId, resourceType: resource.resourceType, apiName: resource.apiName,
        ...(workspace.target.projectId ? { projectId: workspace.target.projectId, ...(workspace.target.worktreeId ? { worktreeId: workspace.target.worktreeId } : {}) } : {}) },
    }),
    hrefForSurface: (surface) => destinationHref(surface === null ? globalHome : currentDestination(surface)),
    openCanvas, openCanvasInProject, openImprovementProject, openProjectCreation: () => openCanvas("alm", projectCreationCanvas(capabilityScope)), selectProject, capabilityScope,
    selectCanvas: (surface, id) => {
      const slice = canvases.getSnapshot()[surface];
      const canvas = slice.canvases.find((item) => item.id === id);
      if (canvas && !canvasVisibleInWorkspace(canvas, workspace.target, slice.targets?.[id])) return;
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
    openAgentDestination: (...args) => currentActions.current.openAgentDestination(...args),
    navigateSurface: (...args) => currentActions.current.navigateSurface(...args),
    navigateGlobalHome: () => currentActions.current.navigateGlobalHome(),
    openResource: (...args) => currentActions.current.openResource(...args),
    openImprovementProject: (...args) => currentActions.current.openImprovementProject(...args),
    openProjectCreation: () => currentActions.current.openProjectCreation(),
    openCanvas: (...args) => currentActions.current.openCanvas(...args),
    openCanvasInProject: (...args) => currentActions.current.openCanvasInProject(...args),
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
