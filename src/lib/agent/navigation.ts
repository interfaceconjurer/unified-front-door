import type { CapturedContext } from "./contracts";
import { destinationHref, resolveDestination, type Destination } from "../navigation/model";
import { sameTarget } from "../workspace/context";
import { SURFACES, type SurfaceId } from "../workspace/surfaces";
import { capabilitiesForSurface } from "../surface-canvas/capabilities";
import type { CanvasSpecInput, CapabilityScope } from "../surface-canvas/model";
import { resourcesForOrg } from "../org-resources/catalog";
import { RESOURCE_TYPES } from "../org-resources/model";
import { RETURNING_WORK, workCanvasInput } from "../workspace/returning-work";

export type NavigationOption = { id: string; label: string; destination: Destination };
export type AgentNavigation = NavigationOption & { toolCallId: string };
export type NavigationCall = { id: string; name: "open_surface" | "open_canvas"; input: { destinationId: string } };

/** Only known destinations in the captured scope are offered to the model.
 * IDs select server-owned objects; tool arguments never supply a URL or target. */
export function navigationOptions(context: CapturedContext): NavigationOption[] {
  const { target, profile } = context;
  const options: NavigationOption[] = [];
  const add = (id: string, label: string, surface: SurfaceId, canvas?: CanvasSpecInput) => {
    if (!profile.surfaceAccess.includes(surface)) return;
    const destination: Destination = { version: 1, owner: profile.id, surface, target: { ...target }, ...(canvas ? { canvas } : {}) };
    if (resolveDestination(destinationHref(destination), profile.id, profile.surfaceAccess, {}).kind === "available") options.push({ id, label, destination });
  };
  const scope: CapabilityScope = target.projectId
    ? { scope: "project", projectId: target.projectId, ...(target.worktreeId ? { worktreeId: target.worktreeId } : {}), ...(target.orgId ? { orgId: target.orgId } : {}) }
    : { scope: "unbound", ...(target.orgId ? { orgId: target.orgId } : {}) };
  for (const surface of profile.surfaceAccess) {
    add(`surface:${surface}`, SURFACES[surface].label, surface);
    for (const capability of capabilitiesForSurface(surface)) add(`capability:${surface}:${capability.id}`, capability.label, surface,
      { kind: "capability", title: capability.label, params: { ...scope, surface, capability: capability.id } });
  }
  if (target.orgId) for (const resource of resourcesForOrg(target.orgId)) {
    const type = RESOURCE_TYPES[resource.resourceType];
    add(`resource:${resource.resourceType}:${resource.apiName}`, `${resource.label} · ${type.label}`, type.surface, {
      kind: "org-resource", title: `${resource.label} · ${context.orgLabel ?? target.orgId}`,
      params: { orgId: target.orgId, resourceType: resource.resourceType, apiName: resource.apiName,
        ...(target.projectId ? { projectId: target.projectId, ...(target.worktreeId ? { worktreeId: target.worktreeId } : {}) } : {}) },
    });
  }
  if (profile.workspaceExperience === "established") for (const work of RETURNING_WORK) {
    if (work.projectId === target.projectId && work.worktreeId === target.worktreeId) add(`work:${work.id}`, work.title, work.surfaceId, workCanvasInput(work));
  }
  if (profile.onboarding && context.assessmentNavigation) {
    const assessment = context.assessmentNavigation;
    add(`assessment:${assessment.runId}`, context.improvement ? "Project source assessment" : "Current org assessment", "govern",
      { kind: "org-assessment", title: "Org assessment", params: { ...scope, runId: assessment.runId } });
    for (const finding of assessment.findings) add(`finding:${finding.id}`, finding.title, "govern",
      { kind: "org-assessment", title: finding.title, params: { ...scope, runId: assessment.runId, findingId: finding.id } });
  }
  if (context.improvement) add(`project:${context.improvement.id}`, context.improvement.name, "alm",
    { kind: "improvement-project", title: context.improvement.name, params: { projectId: context.improvement.id } });
  return options;
}

export function resolveNavigationCall(options: readonly NavigationOption[], call: unknown): AgentNavigation | null {
  if (!call || typeof call !== "object") return null;
  const value = call as Record<string, unknown>, input = value.input;
  if (typeof value.id !== "string" || !/^toolu_[A-Za-z0-9_-]{1,180}$/.test(value.id)
    || !["open_surface", "open_canvas"].includes(String(value.name)) || !input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).length !== 1 || !("destinationId" in input) || typeof input.destinationId !== "string") return null;
  const option = options.find(option => option.id === input.destinationId);
  if (!option || (value.name === "open_canvas") !== !!option.destination.canvas) return null;
  return { ...structuredClone(option), toolCallId: value.id };
}

export function navigationMatchesContext(action: AgentNavigation, context: CapturedContext): boolean {
  return action.destination.owner === context.profile.id && sameTarget(action.destination.target, context.target)
    && navigationOptions(context).some(option => option.id === action.id && destinationHref(option.destination) === destinationHref(action.destination));
}
