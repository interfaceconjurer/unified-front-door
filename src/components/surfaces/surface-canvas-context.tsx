"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { SurfaceId } from "@/lib/workspace/model";
import { OVERVIEW_CANVAS, type CanvasSpec, type CanvasSpecInput } from "@/lib/surface-canvas/model";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getSurfaceCanvasStore } from "@/lib/surface-canvas/persistence";

type SurfaceCanvasContextValue = {
  /** The full tab list for a surface, overview synthesized at index 0. */
  canvasesFor: (surfaceId: SurfaceId) => readonly CanvasSpec[];
  /** The active tab id for a surface (`OVERVIEW_CANVAS.id` when the launch pad
   *  is focused). */
  activeCanvasIdFor: (surfaceId: SurfaceId) => string;
  openCanvas: (surfaceId: SurfaceId, spec: CanvasSpecInput) => void;
  closeCanvas: (surfaceId: SurfaceId, canvasId: string) => void;
  setActiveCanvas: (surfaceId: SurfaceId, canvasId: string) => void;
  updateDraft: (surfaceId: SurfaceId, canvasId: string, fields: Record<string, string>) => void;
};

const SurfaceCanvasContext = createContext<SurfaceCanvasContextValue | null>(null);

/**
 * Shell-level per-surface canvas ("workstage") state — a peer to the workspace,
 * not owned by any one surface. Holds which tabs are open in each surface and
 * which is active. Mounted in `AppShell` above the router outlet so, like the
 * workspace, it never unmounts: the open-tab set for a surface survives both a
 * route content swap (you leave and re-enter the surface) and — because it's
 * read through the persisted external store — a full reload.
 *
 * State is read via `useSyncExternalStore` rather than `useState`, which is what
 * lets rehydration happen without an effect (nothing for
 * `react-hooks/set-state-in-effect` to catch) and without a hydration mismatch
 * (the server/first-render snapshot is a fixed empty default; the stored value,
 * if any, applies in React's dedicated post-hydration pass). Mirrors
 * `WorkspaceProvider` exactly — see `@/lib/surface-canvas/persistence`.
 */
export function SurfaceCanvasProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useDemoProfile();
  const surfaceCanvasStore = getSurfaceCanvasStore(profile?.id ?? "jw");
  const state = useSyncExternalStore(
    surfaceCanvasStore.subscribe,
    surfaceCanvasStore.getSnapshot,
    surfaceCanvasStore.getServerSnapshot,
  );

  const value = useMemo<SurfaceCanvasContextValue>(
    () => ({
      // The overview is prepended here, not stored, so index 0 is always the
      // pinned launch pad and the persisted list holds only launched canvases.
      canvasesFor: (surfaceId) => [OVERVIEW_CANVAS, ...state[surfaceId].canvases],
      activeCanvasIdFor: (surfaceId) => state[surfaceId].activeCanvasId,
      openCanvas: surfaceCanvasStore.openCanvas,
      closeCanvas: surfaceCanvasStore.closeCanvas,
      setActiveCanvas: surfaceCanvasStore.setActiveCanvas,
      updateDraft: surfaceCanvasStore.updateDraft,
    }),
    [state, surfaceCanvasStore],
  );

  return <SurfaceCanvasContext.Provider value={value}>{children}</SurfaceCanvasContext.Provider>;
}

function useSurfaceCanvasContext(): SurfaceCanvasContextValue {
  const value = useContext(SurfaceCanvasContext);
  if (!value) throw new Error("useSurfaceCanvases must be used within a SurfaceCanvasProvider");
  return value;
}

/**
 * Per-surface view of the canvas store: the surface's full tab list (overview
 * first), its active tab id, and the mutators — the actions still take a
 * `surfaceId` so a caller can drive a surface other than the one it's rendering,
 * matching the store's own shape. The tab strip and launch pad consume this.
 */
export function useSurfaceCanvases(surfaceId: SurfaceId): {
  canvases: readonly CanvasSpec[];
  activeCanvasId: string;
  openCanvas: (surfaceId: SurfaceId, spec: CanvasSpecInput) => void;
  closeCanvas: (surfaceId: SurfaceId, canvasId: string) => void;
  setActiveCanvas: (surfaceId: SurfaceId, canvasId: string) => void;
  updateDraft: (surfaceId: SurfaceId, canvasId: string, fields: Record<string, string>) => void;
} {
  const ctx = useSurfaceCanvasContext();
  return {
    canvases: ctx.canvasesFor(surfaceId),
    activeCanvasId: ctx.activeCanvasIdFor(surfaceId),
    openCanvas: ctx.openCanvas,
    closeCanvas: ctx.closeCanvas,
    setActiveCanvas: ctx.setActiveCanvas,
    updateDraft: ctx.updateDraft,
  };
}
