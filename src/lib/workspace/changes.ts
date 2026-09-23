import type { SavedCanvas } from "../application/contracts";
import { demoProfileById, type DemoProfileId } from "../demo-profiles";
import type { SavedProject } from "../projects/model";
import { isReadOnlyCanvas, type CanvasSpecInput } from "../surface-canvas/model";
import { workForCanvas } from "./returning-work";
import { projectsForProfile, workForProfile } from "./demo-workspace";
import { primaryWorktree, type SurfaceId } from "./model";
import type { WorkspaceTarget } from "./context";
import { projectFiles, projectFileCanvas, workFilePath } from "./project-files";
import { findResource } from "../org-resources/catalog";
import { objectFileContent, parseObjectFields } from "../org-resources/object-fields";

export type FileChange = {
  id: string; path: string; status: "A" | "M" | "D";
  additions: number; deletions: number; surface: SurfaceId; canvas: CanvasSpecInput;
  source: "project" | "sample" | "draft"; draft?: SavedCanvas;
};

/** Exact line counts against the supplied base, including final-newline changes.
 * Trim shared edges before LCS so ordinary edits need little work or memory. */
export function lineChanges(before: string, after: string) {
  if (before === after) return { additions: 0, deletions: 0 };
  const a = before.match(/[^\n]*\n|[^\n]+$/g) ?? [], b = after.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  let previous = new Uint32Array(endB - start + 1), current = new Uint32Array(previous.length);
  for (let i = start; i < endA; i++) {
    for (let j = start; j < endB; j++) current[j - start + 1] = a[i] === b[j]
      ? previous[j - start]! + 1 : Math.max(previous[j - start + 1]!, current[j - start]!);
    [previous, current] = [current, previous]; current.fill(0);
  }
  const common = previous[endB - start]!;
  return { additions: endB - start - common, deletions: endA - start - common };
}

const segment = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-");
const json = (fields: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n";

/** Workspace changes are derived from saved context and editable drafts.
 * Sample files compare with their modeled primary branch; these are not Git reads. */
export function workspaceChanges(profileId: DemoProfileId, target: WorkspaceTarget, savedProjects: readonly SavedProject[], drafts: readonly SavedCanvas[]): FileChange[] {
  const changes = new Map<string, FileChange>();
  const profile = demoProfileById(profileId);
  const project = savedProjects.find(project => project.id === target.projectId)
    ?? projectsForProfile(profileId).find(project => project.id === target.projectId);
  if (target.projectId && !project) return [];
  const files = projectFiles(profileId, target, savedProjects);
  const sample = projectsForProfile(profileId).find(project => project.id === target.projectId);
  const base = sample ? projectFiles(profileId, { ...target, worktreeId: primaryWorktree(sample)?.id ?? null }) : [];
  for (const file of files) {
    if (file.source !== "saved-project" && !file.modified) continue;
    const before = file.source === "saved-project" ? undefined : base.find(item => item.path === file.path);
    const counts = lineChanges(file.baseContent ?? before?.content ?? "", file.content);
    if (!counts.additions && !counts.deletions) continue;
    changes.set(file.path, { id: file.path, path: file.path, status: before ? "M" : "A", ...counts,
      surface: file.surfaceId, canvas: projectFileCanvas(file, target), source: file.source === "saved-project" ? "project" : "sample" });
  }
  for (const draft of drafts) {
    // Global browsing can display project canvases, but its changes stay unassigned.
    if (draft.target.projectId !== target.projectId || draft.target.worktreeId !== target.worktreeId
      || isReadOnlyCanvas(draft.canvas) || !profile.surfaceAccess.includes(draft.surface)) continue;
    const canvas = draft.canvas;
    if (canvas.kind === "org-resource") {
      const resource = findResource(canvas.params), fields = parseObjectFields(canvas.params, draft.fields);
      if (!resource || !fields?.length) continue;
      const path = `.orgs/${segment(canvas.params.orgId)}/objects/${segment(canvas.params.apiName)}.object.json`;
      changes.set(draft.id, { id: draft.id, path, status: "M", ...lineChanges(objectFileContent(resource), objectFileContent(resource, fields)), surface: draft.surface, canvas, source: "draft", draft });
    } else if (canvas.kind === "work") {
      const work = workForCanvas(canvas.params);
      if (!work || !workForProfile(profileId).some(item => item.id === work.id)) continue;
      if (work.source !== undefined && draft.fields.source !== undefined) {
        const path = workFilePath(work), file = files.find(file => file.path === path);
        if (file) {
          const before = base.some(item => item.path === path) ? work.source : "";
          const counts = lineChanges(before, draft.fields.source);
          changes.delete(path);
          if (counts.additions || counts.deletions) changes.set(path, { id: path, path, status: base.some(item => item.path === path) ? "M" : "A", ...counts, surface: draft.surface, canvas, source: "draft" });
        }
      }
      if (draft.fields.notes?.trim()) {
        const path = `.drafts/${segment(work.id)}/notes.md`;
        changes.set(draft.id + ":notes", { id: draft.id + ":notes", path, status: "A", ...lineChanges("", draft.fields.notes), surface: draft.surface, canvas, source: "draft" });
      }
    } else if (canvas.kind === "capability" && Object.entries(draft.fields).some(([key, value]) => key !== "transferSources" && value.trim())) {
      const path = `.drafts/${segment(draft.target.orgId ?? "workspace")}/${draft.surface}/${segment(canvas.params.capability)}${canvas.params.section ? `-${segment(canvas.params.section)}` : ""}.json`;
      changes.set(draft.id, { id: draft.id, path, status: "A", ...lineChanges("", json(Object.fromEntries(Object.entries(draft.fields).filter(([key]) => key !== "transferSources")))), surface: draft.surface, canvas, source: "draft", draft });
    }
  }
  return [...changes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
