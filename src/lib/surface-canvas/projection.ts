import type { SavedCanvas } from "../application/contracts";
import type { PersistedCanvases } from "./persistence";
import { SURFACE_IDS } from "../workspace/surfaces";
import { sameTarget } from "../workspace/context";
import { canonicalCanvasSurface } from "./routing";

function sameFields(a: Record<string, string> | undefined, b: Record<string, string> | undefined) {
  return a === b || !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
}
/** Reuse unaffected surfaces and drafts; persistence-status ticks need no clone. */
export function projectCanvases(previous: PersistedCanvases, preferences: PersistedCanvases, saved: readonly SavedCanvas[]): PersistedCanvases {
  let next = previous;
  for (const surface of SURFACE_IDS) {
    const prefs = preferences[surface], before = previous[surface];
    const records = saved.filter(canvas => canonicalCanvasSurface(canvas.surface, canvas.canvas) === surface);
    const targets = { ...prefs.targets }, closedDrafts = { ...prefs.closedDrafts };
    for (const canvas of records) {
      const oldTarget = before.targets?.[canvas.id];
      targets[canvas.id] = oldTarget && sameTarget(oldTarget, canvas.target) ? oldTarget : canvas.target;
      if (!prefs.canvases.some(item => item.id === canvas.id)) closedDrafts[canvas.id] = sameFields(before.closedDrafts?.[canvas.id], canvas.fields) ? before.closedDrafts![canvas.id]! : canvas.fields;
    }
    const canvases = prefs.canvases.map(canvas => {
      if (canvas.kind === "overview") return canvas;
      const record = records.find(item => item.id === canvas.id), old = before.canvases.find(item => item.id === canvas.id);
      const fields = record?.fields ?? canvas.draft;
      if (old && old.title === canvas.title && old.kind === canvas.kind && sameFields(old.draft, fields)) return old;
      return record ? { ...canvas, draft: fields } : canvas;
    });
    const sameMap = <T,>(a: Record<string, T> | undefined, b: Record<string, T>) => Object.keys(a ?? {}).length === Object.keys(b).length && Object.keys(b).every(key => a?.[key] === b[key]);
    if (before.activeCanvasId === prefs.activeCanvasId && before.recovery === prefs.recovery
      && canvases.length === before.canvases.length && canvases.every((canvas, i) => canvas === before.canvases[i])
      && sameMap(before.targets, targets) && sameMap(before.closedDrafts, closedDrafts)) continue;
    if (next === previous) next = { ...previous };
    next[surface] = { ...prefs, canvases, targets, closedDrafts };
  }
  return next;
}
