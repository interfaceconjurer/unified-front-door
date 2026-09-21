import type { CanvasSpecInput } from "../surface-canvas/model";
import { PROJECTS } from "../workspace/fixtures";

/** Sample experiences for this UI prototype; no deployed runtime is implied. */
export function previewCanvas(projectId: string, worktreeId: string, orgId: string | null): Extract<CanvasSpecInput, { kind: "preview" }> | null {
  const project = PROJECTS.find(project => project.id === projectId);
  const worktree = project?.worktrees.find(worktree => worktree.id === worktreeId);
  if (!project || !worktree) return null;
  return { kind: "preview", title: `Preview · ${worktree.label}`, params: { projectId, worktreeId, ...(orgId ? { orgId } : {}) } };
}
