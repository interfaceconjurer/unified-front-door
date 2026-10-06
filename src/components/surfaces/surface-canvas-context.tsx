"use client";

import { useWorkspace } from "@/components/workspace/workspace-context";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { SurfaceId } from "@/lib/workspace/model";
import { canvasId, canvasVisibleInWorkspace, OVERVIEW_CANVAS, type CanvasSpec } from "@/lib/surface-canvas/model";
import { overviewPlugin, overviewViewId, workbenchViews } from "@/lib/surface-canvas/persistence";
import { SURFACE_IDS } from "@/lib/workspace/surfaces";
import { overviewName } from "@/lib/plugins/catalog";
import { usePlugins } from "@/components/plugins/use-plugins";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getActiveCanvasStore } from "@/lib/application/client";
import { destinationCanvasTarget } from "@/lib/navigation/model";

type CanvasStore = ReturnType<typeof getActiveCanvasStore>;
const Context = createContext<{ store: CanvasStore; decision: ReturnType<typeof useWorkspace>["destination"]; updateDraft: CanvasStore["updateDraft"] } | null>(null);

/** Stable store/actions owner. Only selectors below subscribe to draft data. */
export function SurfaceCanvasProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useDemoProfile();
  const { destination: decision, target } = useWorkspace();
  const store = getActiveCanvasStore(profile?.id ?? "jw", target);
  const value = useMemo(() => ({ store, decision, updateDraft: (surfaceId: SurfaceId, id: string, fields: Record<string, string>) => {
    const destination = decision.kind === "available" ? decision.destination : null;
    const input = destination?.canvas;
    if (destination?.surface === surfaceId && input && id === canvasId(input.kind, input.params)) {
      if (!store.captureTarget(surfaceId, id, destinationCanvasTarget(destination))) return;
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
  return useMemo(() => ({ persistence: store, openCanvas, closeCanvas: store.closeCanvas, closeView: store.closeView, setActiveCanvas: selectCanvas, updateDraft }), [store, openCanvas, selectCanvas, updateDraft]);
}
export type WorkbenchView = { id: string; plugin: SurfaceId; canvas: CanvasSpec };
/** Every opened view across plugins, in workbench order, limited to the current
 *  workspace scope. The URL's destination is always present and active; a plugin
 *  route without a canvas opens that plugin's overview view. */
export function useWorkbench() {
  const { store, decision } = useOwner();
  const { target } = useWorkspace();
  const { installed } = usePlugins();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return useMemo(() => {
    const destination = decision.kind === "available" ? decision.destination : null;
    const order = workbenchViews(state);
    const input = destination?.canvas;
    const selected = destination?.surface ? input ? canvasId(input.kind, input.params) : overviewViewId(destination.surface) : null;
    const ids = selected && !order.views.includes(selected) && (!input || store.canViewCanvas(destination!.surface!, input)) ? [...order.views, selected] : order.views;
    const views: WorkbenchView[] = [];
    for (const id of ids) {
      const plugin = overviewPlugin(id);
      if (plugin) { if (installed.includes(plugin)) views.push({ id, plugin, canvas: { ...OVERVIEW_CANVAS, title: overviewName(plugin) } }); continue; }
      const owner = SURFACE_IDS.find(surface => state[surface].canvases.some(canvas => canvas.id === id)) ?? (id === selected && destination?.surface ? destination.surface : null);
      if (!owner) continue;
      const slice = state[owner];
      const open = slice.canvases.find(canvas => canvas.id === id);
      const canvas = open ? (open.kind !== "overview" && !open.draft && slice.closedDrafts?.[id] ? { ...open, draft: slice.closedDrafts[id] } : open)
        : { ...input!, id, draft: slice.closedDrafts?.[id] } as CanvasSpec;
      if (!installed.includes(owner) || !canvasVisibleInWorkspace(canvas, target, slice.targets?.[id])) continue;
      views.push({ id, plugin: owner, canvas });
    }
    const active = decision.kind === "absent" ? order.active : selected;
    return { views, activeId: views.some(view => view.id === active) ? active : null,
      recovery: SURFACE_IDS.flatMap(surface => state[surface].recovery ?? []) };
  }, [state, decision, store, target, installed]);
}
