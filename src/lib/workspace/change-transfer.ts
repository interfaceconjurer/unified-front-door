import { conflict, invalid, type SavedCanvas, type TransferSource } from "../application/contracts";
import { canvasId, canvasTarget, isReadOnlyCanvas, type CanvasSpecInput } from "../surface-canvas/model";

/** A transfer keeps the original org while assigning project/worktree ownership. */
export function transferredCanvas(canvas: CanvasSpecInput, projectId: string, worktreeId: string | null): CanvasSpecInput | null {
  const scope = { projectId, ...(worktreeId ? { worktreeId } : {}) };
  if (isReadOnlyCanvas(canvas)) return null;
  if (canvas.kind === "capability" && canvas.params.scope === "unbound") return { ...canvas, params: { ...canvas.params, ...scope, scope: "project" } };
  if (canvas.kind === "org-resource" && !canvas.params.projectId) return { ...canvas, params: { ...canvas.params, ...scope } };
  return null;
}

/** Preflight the entire selection before any source or destination is changed. */
export function planChangeTransfer(sources: readonly TransferSource[], saved: readonly SavedCanvas[], projectId: string, worktreeId: string | null) {
  const destinations = new Set<string>();
  return sources.map(reference => {
    const source = saved.find(item => item.id === reference.sourceId);
    if (!source || source.revision !== reference.sourceRevision) conflict("A selected change was updated. Review global Changes and select the files again.");
    if (source.target.projectId || source.target.worktreeId) invalid("Only global changes can be transferred into a project.");
    const canvas = transferredCanvas(source.canvas, projectId, worktreeId);
    if (!canvas) invalid("This change cannot be transferred into a project.");
    const fields = Object.fromEntries(Object.entries(source.fields).filter(([key]) => key !== "transferSources"));
    if (!Object.values(fields).some(value => value.trim())) conflict("A selected change is no longer available in global Changes.");
    const id = canvasId(canvas.kind, canvas.params);
    if (destinations.has(id) || saved.some(item => item.id === id)) conflict("This project already has changes for one of these files. Choose another project to preserve its existing changes.");
    destinations.add(id);
    return { source, destination: { id, canvas, surface: source.surface, target: canvasTarget(canvas, source.target), fields, revision: 1 } satisfies SavedCanvas };
  });
}
