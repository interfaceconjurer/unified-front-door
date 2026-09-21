import { canvasTarget, canvasVisibleInWorkspace, inputFromCanonicalId } from "./model";
import { emptyState, type PersistedCanvases } from "./persistence";
import { SURFACE_IDS } from "../workspace/surfaces";
import { UNBOUND_TARGET, type WorkspaceTarget } from "../workspace/context";

/** Split the old shared tab strip once, without changing any canvas ownership.
 * Old preferences cannot tell us which project tabs were explicitly opened from
 * Home, so only org/global tabs migrate there. Project work remains available
 * from Today and can be opened into Home's independent tab strip explicitly. */
export function preferencesForWorkspace(legacy: PersistedCanvases, workspace: WorkspaceTarget): PersistedCanvases {
  const result = emptyState();
  for (const surface of SURFACE_IDS) {
    const slice = legacy[surface];
    const belongs = (id: string) => {
      const input = inputFromCanonicalId(id);
      if (!input) return false;
      const captured = slice.targets?.[id] ?? canvasTarget(input, UNBOUND_TARGET);
      return workspace.projectId === null ? captured.projectId === null : canvasVisibleInWorkspace(input, workspace, captured);
    };
    const canvases = slice.canvases.filter(canvas => belongs(canvas.id));
    result[surface] = { ...slice, canvases,
      activeCanvasId: canvases.some(canvas => canvas.id === slice.activeCanvasId) ? slice.activeCanvasId : "overview",
      closedDrafts: Object.fromEntries(Object.entries(slice.closedDrafts ?? {}).filter(([id]) => belongs(id))),
      targets: Object.fromEntries(Object.entries(slice.targets ?? {}).filter(([id]) => belongs(id))),
    };
  }
  return result;
}
