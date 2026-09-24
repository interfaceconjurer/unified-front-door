import type { AssessmentState } from "../assessment/state";
import type { DemoProfileId } from "../demo-profiles";
import type { DraftEdit, ImprovementProject, ProjectDraftFields } from "../projects/model";
import { isProjectType, PROJECT_CONTEXT_LIMIT } from "../projects/templates";
import { validResourceFields } from "../org-resources/editable";
import { parseCanvasInput, canvasId, canvasTarget, isReadOnlyCanvas, type CanvasSpecInput } from "../surface-canvas/model";
import { parseTarget, type WorkspaceTarget } from "../workspace/context";
import { SURFACE_IDS, type SurfaceId } from "../workspace/surfaces";

export type SessionView = { namespaceId: string; profileId: DemoProfileId | null; generation: string; expiresAt: string; workspaceEpoch?: string };
export type SavedCanvas = { id: string; surface: SurfaceId; canvas: CanvasSpecInput; target: WorkspaceTarget; fields: Record<string, string>; revision: number };
export type TransferSource = { sourceId: string; sourceRevision: number };
/** assessmentRevision guards user commands; autonomous progress uses run events. */
export type ApplicationSnapshot = { session: SessionView; assessment: AssessmentState; assessmentRevision: number; canvases: SavedCanvas[]; imports: SavedImport[] };
export type ApplicationOperation =
  | { kind: "assessment.start"; orgId?: string }
  | { kind: "assessment.advance" | "assessment.pause" }
  | { kind: "assessment.rescan"; orgIds: string[] }
  | { kind: "draft.begin"; runId: string; fields: ProjectDraftFields }
  | { kind: "draft.edit"; draftId: string; edit: DraftEdit }
  | { kind: "draft.discard"; draftId: string }
  | { kind: "project.createFromBrief"; sourceId: string; sourceRevision: number }
  | { kind: "project.create"; draftId: string; draftRevision: number }
  | { kind: "work.status"; projectId: string; itemId: string; status: "todo" | "in-progress" | "done" }
  | { kind: "canvas.save"; surface: SurfaceId; canvas: CanvasSpecInput; target: WorkspaceTarget; fields: Record<string, string> }
  | { kind: "canvas.copy"; sourceId: string; sourceRevision: number; surface: SurfaceId; canvas: CanvasSpecInput; target: WorkspaceTarget }
  | { kind: "changes.transfer"; projectId: string; sources: TransferSource[] }
  | { kind: "legacy.import"; source: LegacySource };
export type ApplicationCommand = ApplicationOperation & { commandId: string; expectedRevision: number };
export type CommandResult = { revision: number; project?: ImprovementProject; imported?: ImportSummary };
export type LegacySource = { profileId: DemoProfileId; assessment: string | null; canvases: string | null };
export type ImportSummary = { projects: number; runs: number; drafts: number; recovery: number; sourceHash: string };
export type SavedImport = ImportSummary & { importedAt: string };
export type ImportedSource = { summary: SavedImport; source: LegacySource; recovery: unknown[] };
export class ApplicationError extends Error {
  constructor(public code: "invalid" | "conflict" | "session_changed" | "unauthorized" | "unavailable", message: string, public status = 400) { super(message); }
}
export function invalid(message = "The command is not valid."): never { throw new ApplicationError("invalid", message); }
export function conflict(message = "The saved version changed. Review it before retrying."): never { throw new ApplicationError("conflict", message, 409); }
export function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
export function text(v: unknown, max = 1000): v is string { return typeof v === "string" && v.length > 0 && v.length <= max; }
export function revision(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number) >= 0; }
export function profileId(v: unknown): v is DemoProfileId { return ["jw", "kf", "am", "sp"].includes(v as string); }
export function exact(v: Record<string, unknown>, keys: string[]) { if (Object.keys(v).some((k) => !keys.includes(k))) invalid(); }
function stringList(v: unknown): v is string[] { return Array.isArray(v) && v.length <= 1000 && v.every((s) => text(s)); }
function fields(v: unknown): v is Record<string, string> {
  return record(v) && Object.keys(v).length <= 100 && Object.entries(v).every(([k, s]) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(k) && !["constructor", "prototype", "__proto__"].includes(k) && typeof s === "string" && s.length <= 200000);
}
export function parseTransferSources(value: unknown): TransferSource[] | null {
  return Array.isArray(value) && value.length > 0 && value.length <= 64
    && value.every(item => record(item) && Object.keys(item).sort().join(",") === "sourceId,sourceRevision" && text(item.sourceId, 5000) && revision(item.sourceRevision) && item.sourceRevision > 0)
    && new Set(value.map(item => item.sourceId)).size === value.length ? value : null;
}
export function briefTransferSources(value: string | undefined): TransferSource[] {
  if (!value) return [];
  try { const sources = parseTransferSources(JSON.parse(value)); if (sources) return sources; } catch { /* Invalid saved selection. */ }
  return invalid("Review the changes selected for this project before creating it.");
}
export function parseCommand(value: unknown): ApplicationCommand {
  if (!record(value) || !text(value.commandId, 200) || !revision(value.expectedRevision) || !text(value.kind)) invalid();
  const common = ["kind", "commandId", "expectedRevision"];
  switch (value.kind) {
    case "assessment.start": exact(value, [...common, "orgId"]); if (value.orgId !== undefined && !text(value.orgId)) invalid(); break;
    case "assessment.advance": case "assessment.pause": exact(value, common); break;
    case "assessment.rescan": exact(value, [...common, "orgIds"]); if (!stringList(value.orgIds)) invalid(); break;
    case "draft.begin": {
      exact(value, [...common, "runId", "fields"]);
      const f = value.fields;
      if (!text(value.runId) || !record(f)) invalid();
      exact(f, ["name", "goal", "targetOrgId", "findingIds", "projectType", "context"]);
      if (!text(f.name, 1000) || !text(f.goal, 50000) || typeof f.targetOrgId !== "string" || f.targetOrgId.length > 1000 || !stringList(f.findingIds)) invalid();
      if (f.projectType !== undefined && !isProjectType(f.projectType) || f.context !== undefined && (typeof f.context !== "string" || f.context.length > PROJECT_CONTEXT_LIMIT)) invalid();
      break;
    }
    case "draft.edit": {
      exact(value, [...common, "draftId", "edit"]); const e = value.edit;
      if (!text(value.draftId) || !record(e)) invalid();
      if (e.field === "finding") { exact(e, ["field", "id", "included"]); if (!text(e.id) || typeof e.included !== "boolean") invalid(); }
      else { exact(e, ["field", "value"]); if (!["name", "goal", "targetOrgId", "projectType", "context"].includes(e.field as string) || typeof e.value !== "string" || e.value.length > 50000) invalid();
        if (e.field === "projectType" && !isProjectType(e.value) || e.field === "context" && e.value.length > PROJECT_CONTEXT_LIMIT) invalid(); }
      break;
    }
    case "draft.discard": exact(value, [...common, "draftId"]); if (!text(value.draftId)) invalid(); break;
    case "project.createFromBrief": exact(value, [...common, "sourceId", "sourceRevision"]); if (!text(value.sourceId, 5000) || !revision(value.sourceRevision) || value.sourceRevision === 0) invalid(); break;
    case "changes.transfer": exact(value, [...common, "projectId", "sources"]); if (!text(value.projectId) || !parseTransferSources(value.sources) || value.expectedRevision !== 0) invalid(); break;
    case "project.create": exact(value, [...common, "draftId", "draftRevision"]); if (!text(value.draftId) || !revision(value.draftRevision) || value.draftRevision === 0) invalid(); break;
    case "work.status": exact(value, [...common, "projectId", "itemId", "status"]); if (!text(value.projectId) || !text(value.itemId) || !["todo", "in-progress", "done"].includes(value.status as string)) invalid(); break;
    case "canvas.save": case "canvas.copy": {
      exact(value, [...common, "surface", "canvas", "target", ...(value.kind === "canvas.save" ? ["fields"] : ["sourceId", "sourceRevision"])]);
      const canvas = parseCanvasInput(value.canvas), target = parseTarget(value.target);
      if (!canvas || isReadOnlyCanvas(canvas) || !target || !SURFACE_IDS.includes(value.surface as SurfaceId) || (canvas.kind === "capability" && canvas.params.surface !== value.surface)
        || (canvas.kind === "work-item-change" && value.surface !== "build")
        || stableJson(canvasTarget(canvas, target)) !== stableJson(target)) invalid();
      if (value.kind === "canvas.save" ? !fields(value.fields) : !text(value.sourceId, 5000) || !revision(value.sourceRevision) || value.sourceRevision === 0) invalid();
      if (canvas.kind === "org-resource" && (value.surface !== "build" || value.kind === "canvas.save" && !validResourceFields(canvas.params, value.fields as Record<string, string>))) invalid("The resource changes are not valid.");
      if (value.kind === "canvas.save" && canvas.kind === "capability" && canvas.params.capability === "project") briefTransferSources((value.fields as Record<string, string>).transferSources);
      // Whitelist runtime canvas data at the server boundary, just as at the URL boundary.
      return { ...value, canvas, target } as ApplicationCommand;
    }
    case "legacy.import": {
      exact(value, [...common, "source"]); const s = value.source;
      if (!record(s)) invalid(); exact(s, ["profileId", "assessment", "canvases"]);
      if (!profileId(s.profileId) || ![s.assessment, s.canvases].every((v) => v === null || text(v, 2000000))) invalid(); break;
    }
    default: invalid();
  }
  return value as ApplicationCommand;
}
export function aggregateKey(operation: ApplicationOperation): string {
  if (operation.kind === "changes.transfer") return `changes:${operation.projectId}`;
  if (operation.kind === "work.status") return `project:${operation.projectId}`;
  if (operation.kind === "canvas.save" || operation.kind === "canvas.copy") return `canvas:${canvasId(operation.canvas.kind, operation.canvas.params)}`;
  return "assessment";
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
