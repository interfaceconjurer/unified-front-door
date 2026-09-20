import type { WorkspaceTarget } from "../workspace/context";
import { isSurfaceId, type SurfaceId } from "../workspace/surfaces";
import { isResourceType, type ResourceIdentity } from "../org-resources/model";
export const OVERVIEW_CANVAS_ID = "overview";
export const LAUNCHABLE_KINDS = ["app", "capability", "work", "improvement-project", "org-resource", "org-assessment"] as const;
export type LaunchableCanvasKind = (typeof LAUNCHABLE_KINDS)[number];
export type CanvasKind = "overview" | LaunchableCanvasKind;
export type CapabilityScope = { scope: "unbound"; orgId?: string } | { scope: "project"; projectId: string; worktreeId?: string; orgId?: string };
type Inputs = {
  app: { projectId: string; appId: string };
  capability: { surface: SurfaceId; capability: string; section?: string } & CapabilityScope;
  work: { workId: string; projectId: string; worktreeId: string };
  "improvement-project": { projectId: string };
  "org-assessment": { runId?: string; findingId?: string } & CapabilityScope;
  "org-resource": ResourceIdentity & { projectId?: string; worktreeId?: string };
};
export type CanvasSpecInput = { [K in LaunchableCanvasKind]: { kind: K; title: string; params: Inputs[K] } }[LaunchableCanvasKind];
export type CanvasSpec = (CanvasSpecInput & { id: string; draft?: Record<string, string> }) | { id: "overview"; kind: "overview"; title: string; params?: undefined; draft?: undefined };
export type CanvasOf<K extends LaunchableCanvasKind> = Extract<CanvasSpec, { kind: K }>;
export const OVERVIEW_CANVAS: CanvasSpec = { id: OVERVIEW_CANVAS_ID, kind: "overview", title: "Overview" };
export function isLaunchableKind(value: unknown): value is LaunchableCanvasKind { return typeof value === "string" && (LAUNCHABLE_KINDS as readonly string[]).includes(value); }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
/** Validate at storage/command boundaries; presentation fields never enter identity. */
export function parseCanvasInput(value: unknown, legacy = false): CanvasSpecInput | null {
  if (!record(value) || !isLaunchableKind(value.kind) || typeof value.title !== "string" || !record(value.params)) return null;
  const p = value.params, nonempty = (key: string) => typeof p[key] === "string" && !!p[key].trim();
  switch (value.kind) {
    case "org-resource": return nonempty("orgId") && isResourceType(p.resourceType) && nonempty("apiName")
      && (p.projectId === undefined || nonempty("projectId")) && (p.worktreeId === undefined || nonempty("projectId") && nonempty("worktreeId"))
      ? { kind: "org-resource", title: value.title, params: { orgId: p.orgId as string, resourceType: p.resourceType, apiName: p.apiName as string,
        ...(p.projectId === undefined ? {} : { projectId: p.projectId as string }), ...(p.worktreeId === undefined ? {} : { worktreeId: p.worktreeId as string }) } } : null;
    case "app": return nonempty("projectId") && nonempty("appId") ? { kind: "app", title: value.title, params: { projectId: p.projectId as string, appId: p.appId as string } } : null;
    case "work": return ["workId", "projectId", "worktreeId"].every(nonempty) ? { kind: "work", title: value.title, params: { workId: p.workId as string, projectId: p.projectId as string, worktreeId: p.worktreeId as string } } : null;
    case "improvement-project": return nonempty("projectId") ? { kind: "improvement-project", title: value.title, params: { projectId: p.projectId as string } } : null;
    case "org-assessment":
    case "capability": {
      const scope = (p.scope === "unbound" || legacy && p.scope === undefined) && (p.orgId === undefined || nonempty("orgId")) ? { scope: "unbound" as const, ...(p.orgId === undefined ? {} : { orgId: p.orgId as string }) }
        : p.scope === "project" && nonempty("projectId") && (p.worktreeId === undefined || nonempty("worktreeId")) && (p.orgId === undefined || nonempty("orgId"))
          ? { scope: "project" as const, projectId: p.projectId as string, ...(p.worktreeId === undefined ? {} : { worktreeId: p.worktreeId as string }), ...(p.orgId === undefined ? {} : { orgId: p.orgId as string }) } : null;
      if (value.kind === "org-assessment") return scope && (p.runId === undefined || nonempty("runId"))
        && (p.findingId === undefined || nonempty("runId") && nonempty("findingId"))
        ? { kind: "org-assessment", title: value.title, params: { ...scope,
          ...(p.runId === undefined ? {} : { runId: p.runId as string }), ...(p.findingId === undefined ? {} : { findingId: p.findingId as string }) } } : null;
      return scope && isSurfaceId(p.surface) && nonempty("capability") && (p.section === undefined || nonempty("section")) ? { kind: "capability", title: value.title, params: { ...scope, surface: p.surface, capability: p.capability as string, ...(p.section === undefined ? {} : { section: p.section as string }) } } : null;
    }
  }
}
export function canvasId(kind: LaunchableCanvasKind, params: Record<string, string | undefined>): string {
  const input = parseCanvasInput({ kind, params, title: "" });
  if (!input) throw new TypeError(`Invalid ${kind} canvas identity`);
  return `canvas:v2:${JSON.stringify([kind, Object.entries(input.params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)])}`;
}
/** Canonical IDs are self-describing, allowing closed drafts to migrate safely. */
export function inputFromCanonicalId(id: string): CanvasSpecInput | null {
  if (!id.startsWith("canvas:v2:")) return null;
  try {
    const [kind, pairs] = JSON.parse(id.slice(10));
    if (!Array.isArray(pairs) || pairs.some((pair: unknown) => !Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || typeof pair[1] !== "string") || new Set(pairs.map((pair: string[]) => pair[0])).size !== pairs.length) return null;
    const params = Object.fromEntries(pairs), input = parseCanvasInput({ kind, params, title: "Recovered draft" }, true);
    if (!input) return null;
    const canonical = canvasId(input.kind, input.params);
    if (canonical === id) return input;
    // The only formerly valid canonical identity change is the explicit scope
    // on global capability drafts. Never infer a project from current selection.
    if (input.kind === "capability" && params.scope === undefined) {
      const oldParams = Object.fromEntries(Object.entries(input.params).filter(([key]) => key !== "scope"));
      if (`canvas:v2:${JSON.stringify([kind, Object.entries(oldParams).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)])}` === id) return input;
    }
    return null;
  } catch { return null; }
}

export function canvasTarget(input: CanvasSpecInput, fallback: WorkspaceTarget): WorkspaceTarget {
  if (input.kind === "org-resource") return { projectId: input.params.projectId ?? null, worktreeId: input.params.worktreeId ?? null, orgId: input.params.orgId };
  if (input.kind === "capability" || input.kind === "org-assessment") return input.params.scope === "unbound" ? { projectId: null, worktreeId: null, orgId: input.params.orgId ?? null }
    : { projectId: input.params.projectId, worktreeId: input.params.worktreeId ?? null, orgId: input.params.orgId ?? null };
  return { projectId: input.params.projectId, worktreeId: input.kind === "work" ? input.params.worktreeId : null, orgId: fallback.orgId };
}
/** Global browsing includes every project; a project only exposes its own tabs. */
export function canvasVisibleInProject(canvas: CanvasSpec, projectId: string | null, captured?: WorkspaceTarget): boolean {
  if (!projectId || canvas.kind === "overview") return true;
  const target = captured ?? canvasTarget(canvas, { projectId: null, worktreeId: null, orgId: null });
  return target.projectId === projectId;
}
/** Current editors accept bounded fields; older persisted content is not truncated. */
export const CANVAS_FIELD_CHARACTER_LIMIT = 16000;

/** Evidence canvases persist tab identity, never a second editable copy of the evidence. */
export function isReadOnlyCanvas(canvas: CanvasSpecInput): boolean { return canvas.kind === "org-resource" || canvas.kind === "org-assessment"; }
