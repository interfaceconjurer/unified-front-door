"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import type { SurfaceId } from "@/lib/workspace/model";
import { OVERVIEW_CANVAS_ID } from "@/lib/surface-canvas/model";
import { CanvasContent } from "./canvas-registry";
import { useSurfaceCanvases } from "./surface-canvas-context";
import styles from "./SurfaceCanvasHost.module.css";

/** DOM ids that wire each tab to the shared panel for `aria-controls` /
 *  `aria-labelledby`. Scoped by surface so two surface panes (were they ever
 *  mounted together) couldn't collide. */
function tabDomId(surfaceId: SurfaceId, canvasId: string): string {
  return `surface-canvas-tab-${surfaceId}-${canvasId}`;
}
function panelDomId(surfaceId: SurfaceId): string {
  return `surface-canvas-panel-${surfaceId}`;
}

/**
 * The surface pane's tab framework — the "workstage" for one surface. Renders a
 * tablist above a single canvas panel: tab 0 is the pinned, non-closable
 * Overview (the surface's own projection body, `children`, which carries the
 * per-surface launch region), and every launched canvas is a closable tab after
 * it.
 *
 * Lives inside the surface pane (mounted by `AppShell`), but its state comes
 * from the shell-level `SurfaceCanvasProvider` above the router outlet, so the
 * open-tab set survives leaving and re-entering the surface and a full reload.
 * Switching surface (route) re-mounts this host for that surface's own set.
 *
 * A11y follows the tabs pattern: `role=tablist/tab/tabpanel`, `aria-selected`,
 * and roving tabindex — only the active tab is in the Tab order; Arrow/Home/End
 * move focus and selection together, and Delete/Backspace closes the focused
 * tab when it's closable.
 */
export function SurfaceCanvasHost({
  surfaceId,
  children,
}: {
  surfaceId: SurfaceId;
  children: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  const SurfaceIcon = surface.Icon;
  const { profile } = useDemoProfile();
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree } = useWorkspace();
  const stored = useSurfaceCanvases(surfaceId);
  const emptyWorkspace = profile?.workspaceExperience === "empty";
  // Hide project-backed canvases from profiles with an empty workspace.
  const canvases = emptyWorkspace
    ? stored.canvases.filter((canvas) => canvas.kind !== "app" && canvas.kind !== "work")
    : stored.canvases;
  const activeCanvasId = canvases.some((canvas) => canvas.id === stored.activeCanvasId)
    ? stored.activeCanvasId
    : OVERVIEW_CANVAS_ID;
  const { closeCanvas, setActiveCanvas } = stored;
  // Imperative focus targets for roving-tabindex keyboard nav. Focusing a tab
  // whose tabindex is still -1 (before the store-driven re-render flips it to 0)
  // is fine — programmatic focus ignores tabindex.
  const tabRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const tabListRef = useRef<HTMLDivElement>(null);

  // Reveal a newly opened canvas without scrolling the content or letting it
  // hide behind the pinned surface tab.
  useEffect(() => {
    const list = tabListRef.current;
    const tab = tabRefs.current.get(activeCanvasId)?.parentElement;
    if (!list || !tab) return;
    if (activeCanvasId === OVERVIEW_CANVAS_ID) {
      list.scrollLeft = 0;
      return;
    }
    const pinned = tabRefs.current.get(OVERVIEW_CANVAS_ID)?.parentElement;
    const viewport = list.getBoundingClientRect();
    const bounds = tab.getBoundingClientRect();
    const leftEdge = viewport.left + (pinned?.getBoundingClientRect().width ?? 0) + 8;
    if (bounds.left < leftEdge) list.scrollLeft -= leftEdge - bounds.left;
    else if (bounds.right > viewport.right) list.scrollLeft += bounds.right - viewport.right + 8;
  }, [activeCanvasId]);

  // `activeCanvasId` is guaranteed by the store/parser to be either the overview
  // or a live launched tab, so the lookup normally hits; the `?? canvases[0]!`
  // (overview is always index 0) is defensive-only, for the theoretical window
  // where a stale render's id no longer resolves. `activeIndex` anchors the
  // Arrow/Home/End roving-tabindex math to that resolved tab.
  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0]!;
  const activeIndex = canvases.findIndex((c) => c.id === activeCanvas.id);
  const canvasProjectId = activeCanvas.params?.projectId;
  const canvasWorktreeId = activeCanvas.params?.worktreeId;

  // Returning to a surface restores the selected work tab and its agent context.
  useEffect(() => {
    if (!canvasProjectId || !projects.some((project) => project.id === canvasProjectId)) return;
    if (activeProject.id !== canvasProjectId) setActiveProject(canvasProjectId);
    if (canvasWorktreeId && (activeProject.id !== canvasProjectId || activeWorktree.id !== canvasWorktreeId)) {
      setActiveWorktree(canvasWorktreeId, canvasProjectId);
    }
  }, [canvasProjectId, canvasWorktreeId, activeProject.id, activeWorktree.id, projects, setActiveProject, setActiveWorktree]);


  function selectTab(canvasId: string): void {
    const canvas = canvases.find((candidate) => candidate.id === canvasId);
    if (canvas?.params?.projectId && projects.some((project) => project.id === canvas.params?.projectId)) {
      setActiveProject(canvas.params.projectId);
      if (canvas.params.worktreeId) setActiveWorktree(canvas.params.worktreeId, canvas.params.projectId);
    }
    setActiveCanvas(surfaceId, canvasId);
  }

  function dismissTab(canvasId: string): void {
    const index = canvases.findIndex((canvas) => canvas.id === canvasId);
    const neighborId = canvases[index + 1]?.id ?? canvases[index - 1]?.id;
    closeCanvas(surfaceId, canvasId);
    if (canvasId === activeCanvasId && neighborId) selectTab(neighborId);
  }

  function focusTab(canvasId: string): void {
    selectTab(canvasId);
    tabRefs.current.get(canvasId)?.focus();
  }

  function onTabsKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const last = canvases.length - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      // Wrap around so the strip is a ring, matching the tabs APG pattern.
      const nextIndex = (activeIndex + delta + canvases.length) % canvases.length;
      focusTab(canvases[nextIndex]!.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(canvases[0]!.id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(canvases[last]!.id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      // Close the focused tab when it isn't the pinned overview. The store moves
      // the active id to a sensible neighbor (the tab that slides into the closed
      // slot, else the previous one, else the overview); we mirror that choice
      // here and re-focus it so keyboard-close keeps roving-tabindex continuity
      // instead of dropping focus to <body>. The neighbor still exists in the
      // current DOM — only the closed tab unmounts — and programmatic focus
      // ignores its (still -1) tabindex until the store-driven re-render flips it.
      if (activeCanvas.id === OVERVIEW_CANVAS_ID) return;
      event.preventDefault();
      const neighborId = canvases[activeIndex + 1]?.id ?? canvases[activeIndex - 1]!.id;
      dismissTab(activeCanvas.id);
      tabRefs.current.get(neighborId)?.focus();
    }
  }

  return (
    <div className={styles.host}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={`${surface.label} canvases`}
        aria-orientation="horizontal"
        className={styles.tabs}
        onKeyDown={onTabsKeyDown}
      >
        {canvases.map((canvas) => {
          // Derive selection from the *resolved* `activeCanvas`, not the raw
          // `activeCanvasId`, so tab selection, roving tabindex, and the rendered
          // panel can never disagree even if a stale id failed to resolve.
          const isActive = canvas.id === activeCanvas.id;
          const isOverview = canvas.id === OVERVIEW_CANVAS_ID;
          const closable = !isOverview;
          return (
            // role=presentation keeps the tab itself a direct semantic child of
            // the tablist while letting the close button ride alongside it.
            <span
              key={canvas.id}
              role="presentation"
              className={`${styles.tabWrap} ${isOverview ? styles.tabWrapSurface : ""}`}
            >
              <button
                type="button"
                role="tab"
                id={tabDomId(surfaceId, canvas.id)}
                aria-selected={isActive}
                aria-controls={panelDomId(surfaceId)}
                tabIndex={isActive ? 0 : -1}
                ref={(node) => {
                  tabRefs.current.set(canvas.id, node);
                }}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => selectTab(canvas.id)}
              >
                {isOverview ? (
                  // The pinned first tab IS the surface: its own icon + name,
                  // always present and non-closable, so which surface you're in
                  // stays visible no matter which canvas is active. Its text
                  // (the surface label) is the tab's accessible name; clicking it
                  // returns to the surface overview.
                  <>
                    <SurfaceIcon
                      width={15}
                      height={15}
                      aria-hidden="true"
                      className={styles.surfaceTabIcon}
                    />
                    {surface.label}
                  </>
                ) : (
                  canvas.title
                )}
              </button>
              {closable && (
                <button
                  type="button"
                  // Not in the roving order (Tab reaches only the active tab);
                  // reachable by mouse and via Delete/Backspace on the tab.
                  tabIndex={-1}
                  aria-label={`Close ${canvas.title}`}
                  className={styles.close}
                  onClick={() => dismissTab(canvas.id)}
                >
                  <CloseIcon width={13} height={13} aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelDomId(surfaceId)}
        aria-labelledby={tabDomId(surfaceId, activeCanvas.id)}
        tabIndex={0}
        className={styles.panel}
      >
        {activeCanvas.id === OVERVIEW_CANVAS_ID ? (
          children
        ) : (
          <CanvasContent key={activeCanvas.id} spec={activeCanvas} />
        )}
      </div>
    </div>
  );
}
