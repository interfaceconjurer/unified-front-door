import { date, legacyFinding, parseFinding, record, strings } from "../assessment/codec";
import type { ImprovementProject, PlannedWorkItem, ProjectDraft } from "./model";
import { isProjectType } from "./templates";
const intent = (value: Record<string, unknown>) => ({
  ...(isProjectType(value.projectType) ? { projectType: value.projectType } : {}),
  ...(typeof value.context === "string" ? { context: value.context } : {}),
});
export function parseProject(value: unknown, legacy: boolean): ImprovementProject | null {
  if (!record(value) || !["id", "name", "goal", "owner", "targetOrgId"].every((key) => typeof value[key] === "string") || !date(value.createdAt) || !Array.isArray(value.workItems)) return null;
  const runId = typeof value.runId === "string" ? value.runId : `legacy-project:${value.id}`;
  const items: PlannedWorkItem[] = [];
  for (const item of value.workItems) {
    if (!record(item) || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.findingId !== "string" || !["todo", "in-progress", "done"].includes(String(item.status))) return null;
    const priority = item.priority === "High" ? "High" : item.priority === "Medium" ? "Medium" : "Unknown";
    const finding = legacy ? legacyFinding(item.findingId, item.title, priority, runId) : parseFinding(item.finding);
    if (!finding || finding.runId !== runId || (!legacy && finding.id !== item.findingId)) return null;
    items.push({ id: item.id, title: item.title, findingId: finding.id, priority, status: item.status as PlannedWorkItem["status"], finding });
  }
  if (new Set(items.map((item) => item.id)).size !== items.length || new Set(items.map((item) => item.findingId)).size !== items.length) return null;
  if (!legacy && (typeof value.sourceDraftId !== "string" || typeof value.createCommandId !== "string" || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1)) return null;
  return { ...intent(value), id: value.id as string, name: value.name as string, goal: value.goal as string, owner: value.owner as string,
    targetOrgId: value.targetOrgId as string, scopeOrgIds: strings(value.scopeOrgIds), createdAt: value.createdAt,
    workItems: items, runId, sourceDraftId: typeof value.sourceDraftId === "string" ? value.sourceDraftId : `legacy-draft:${value.id}`,
    createCommandId: typeof value.createCommandId === "string" ? value.createCommandId : `legacy-create:${value.id}`,
    revision: typeof value.revision === "number" ? value.revision : 1 };
}
export function parseDraft(value: unknown, runId: string, legacy: boolean): ProjectDraft | null {
  if (!record(value) || !["name", "goal", "targetOrgId"].every((key) => typeof value[key] === "string") || !Array.isArray(value.findingIds)) return null;
  if (!legacy && (typeof value.id !== "string" || typeof value.runId !== "string" || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1)) return null;
  return { ...intent(value), id: typeof value.id === "string" ? value.id : `legacy-draft:${runId}`, runId: typeof value.runId === "string" ? value.runId : runId,
    revision: typeof value.revision === "number" ? value.revision : 1,
    name: value.name as string, goal: value.goal as string, targetOrgId: value.targetOrgId as string, findingIds: strings(value.findingIds) };
}
