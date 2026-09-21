import type { FindingSnapshot } from "../assessment/model";
import type { Project } from "../workspace/model";
import { isProjectType, type ProjectIntent } from "./templates";
export type PlannedWorkItem = {
  id: string; findingId: string; title: string; priority: "High" | "Medium" | "Unknown";
  status: "todo" | "in-progress" | "done"; finding: FindingSnapshot;
};
export type SavedProject = ProjectIntent & {
  id: string; name: string; goal: string; owner: string; targetOrgId: string | null;
  scopeOrgIds: string[]; createdAt: string; workItems: PlannedWorkItem[];
  runId: string | null; source?: "brief"; repository?: string; sourceDraftId: string; createCommandId: string; revision: number;
};
/** Compatibility name for existing assessment APIs. Both paths share one saved project record. */
export type ImprovementProject = SavedProject;
export type ProjectDraftFields = ProjectIntent & { name: string; goal: string; targetOrgId: string; findingIds: string[] };
export type ProjectDraft = ProjectDraftFields & { id: string; runId: string; revision: number };
export type DraftEdit = { field: "name" | "goal" | "targetOrgId" | "projectType" | "context"; value: string } | { field: "finding"; id: string; included: boolean };
export function editProjectDraft(draft: ProjectDraft, edit: DraftEdit): ProjectDraft {
  if (edit.field === "finding" ? typeof edit.id !== "string" || typeof edit.included !== "boolean" : !["name", "goal", "targetOrgId", "projectType", "context"].includes(edit.field) || typeof edit.value !== "string") return draft;
  if (edit.field === "projectType" && !isProjectType(edit.value)) return draft;
  return { ...draft, revision: draft.revision + 1, ...(edit.field === "finding"
    ? { findingIds: edit.included ? [...new Set([...draft.findingIds, edit.id])] : draft.findingIds.filter((id) => id !== edit.id) }
    : { [edit.field]: edit.value }) };
}
export function planProject(draft: ProjectDraft, findings: readonly FindingSnapshot[], owner: string, commandId: string, now: string, id: string, scopeOrgIds: readonly string[]): ImprovementProject | null {
  const selected = findings.filter((finding) => draft.findingIds.includes(finding.id) && finding.runId === draft.runId);
  if (!draft.name.trim() || !draft.goal.trim() || !selected.length || selected.length !== new Set(draft.findingIds).size) return null;
  return { id, name: draft.name.trim(), goal: draft.goal.trim(), owner, targetOrgId: draft.targetOrgId,
    projectType: draft.projectType ?? "standard", ...(draft.context !== undefined ? { context: draft.context } : {}),
    scopeOrgIds: [...scopeOrgIds], createdAt: now,
    runId: draft.runId, sourceDraftId: draft.id, createCommandId: commandId, revision: 1,
    workItems: selected.map((finding, index) => ({ id: `${id}:WI-${index + 1}`, findingId: finding.id, title: finding.title,
      priority: finding.priority, status: "todo", finding: structuredClone(finding) })) };
}
export function changeWorkItemStatus(project: ImprovementProject, itemId: string, status: PlannedWorkItem["status"]): ImprovementProject {
  if (!["todo", "in-progress", "done"].includes(status) || !project.workItems.some((item) => item.id === itemId && item.status !== status)) return project;
  return { ...project, revision: project.revision + 1, workItems: project.workItems.map((item) => item.id === itemId ? { ...item, status } : item) };
}
export function workspaceProject(project: ImprovementProject): Project {
  return { id: project.id, name: project.name, description: project.goal, defaultOrgId: project.targetOrgId,
    worktrees: [], facets: { objects: 0, flows: 0, apexClasses: 0, lwc: 0, permissionSets: 0 }, agentSessions: [], apps: [] };
}
