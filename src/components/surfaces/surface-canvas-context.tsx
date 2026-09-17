"use client";

import { useWorkspace } from "@/components/workspace/workspace-context";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { createContext, useContext, useMemo, useSyncExternalStore, useCallback } from "react";
import type { SurfaceId } from "@/lib/workspace/model";
import { canvasId, OVERVIEW_CANVAS, type CanvasSpec } from "@/lib/surface-canvas/model";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getActiveCanvasStore } from "@/lib/application/client";

type CanvasStore = ReturnType<typeof getActiveCanvasStore>;
const Context = createContext<{ store: CanvasStore; decision: ReturnType<typeof useWorkspace>["destination"]; updateDraft: CanvasStore["updateDraft"] } | null>(null);

/** Stable store/actions owner. Only selectors below subscribe to draft data. */
export function SurfaceCanvasProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useDemoProfile();
  const { destination: decision } = useWorkspace();
  const store = getActiveCanvasStore(profile?.id ?? "jw");
  const value = useMemo(() => ({ store, decision, updateDraft: (surfaceId: SurfaceId, id: string, fields: Record<string, string>) => {
    const destination = decision.kind === "available" ? decision.destination : null;
    const input = destination?.canvas;
    if (destination?.surface === surfaceId && input && id === canvasId(input.kind, input.params)) {
      if (!store.captureTarget(surfaceId, id, destination.target)) return;
      if (!store.getSnapshot()[surfaceId].canvases.some(item => item.id === id)) store.openCanvas(surfaceId, input);
    }
    store.updateDraft(surfaceId, id, fields);
  } }), [store, decision]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function useOwner() {
  const value = useContext(Context);
  if (!value) throw new Error("Canvas hooks require SurfaceCanvasProvider");
  return value;
}
export function useSurfaceCanvasActions() {
  const { store, updateDraft } = useOwner();
  const { openCanvas, selectCanvas } = useNavigationActions();
  return useMemo(() => ({ persistence: store, openCanvas, closeCanvas: store.closeCanvas, setActiveCanvas: selectCanvas, updateDraft }), [store, openCanvas, selectCanvas, updateDraft]);
}
/** Only the requested surface changes this subscription's data snapshot. */
export function useSurfaceCanvases(surfaceId: SurfaceId) {
  const { store, decision } = useOwner();
  const get = useCallback(() => store.getSnapshot()[surfaceId], [store, surfaceId]);
  const server = useCallback(() => store.getServerSnapshot()[surfaceId], [store, surfaceId]);
  const slice = useSyncExternalStore(store.subscribe, get, server);
  const actions = useSurfaceCanvasActions();
  return useMemo(() => {
    const destination = decision.kind === "available" ? decision.destination : null;
    const input = destination?.canvas;
    const selectedId = input ? canvasId(input.kind, input.params) : "overview";
    const missing = destination?.surface === surfaceId && input && store.canViewCanvas(surfaceId, input) && !slice.canvases.some(item => item.id === selectedId)
      ? [{ ...input, id: selectedId, draft: slice.closedDrafts?.[selectedId] } as CanvasSpec] : [];
    const open = slice.canvases.map(canvas => canvas.kind !== "overview" && !canvas.draft && slice.closedDrafts?.[canvas.id] ? { ...canvas, draft: slice.closedDrafts[canvas.id] } : canvas);
    return { ...actions, recovery: slice.recovery, canvases: [OVERVIEW_CANVAS, ...open, ...missing],
      activeCanvasId: decision.kind === "absent" ? slice.activeCanvasId : destination?.surface === surfaceId ? selectedId : "overview" };
  }, [actions, slice, decision, surfaceId, store]);
}
