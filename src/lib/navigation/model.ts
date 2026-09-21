import { parseCanvasInput, canvasId, canvasTarget, type CanvasSpecInput } from "../surface-canvas/model";
import { workForCanvas } from "../workspace/returning-work";
import { isSurfaceId, type SurfaceId } from "../workspace/surfaces";
import { sameTarget, parseTarget, type WorkspaceTarget } from "../workspace/context";
import { demoProfileById, isDemoProfileId, type DemoProfileId } from "../demo-profiles";
import { RESOURCE_TYPES } from "../org-resources/model";
import { findResource } from "../org-resources/catalog";
import { ORGS } from "../workspace/fixtures";
import { ASSESSMENT_ORGS } from "../onboarding/assessment";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { previewCanvas } from "../preview/model";

export { canvasTarget } from "../surface-canvas/model";

export type Destination = { version: 1; owner: DemoProfileId; surface: SurfaceId | null; target: WorkspaceTarget; canvas?: CanvasSpecInput; canvasTarget?: WorkspaceTarget };
/** Workspace selection and a canvas's saved ownership can differ when browsing
 * globally, or opening a project-wide resource from a selected worktree. */
export function destinationCanvasTarget(destination: Destination): WorkspaceTarget {
  return destination.canvasTarget ?? destination.target;
}
export function canvasDestination(owner: DemoProfileId, surface: SurfaceId, canvas: CanvasSpecInput, captured: WorkspaceTarget, workspace: WorkspaceTarget): Destination {
  const retainWorkspace = captured.projectId !== null && (workspace.projectId === null
    || captured.projectId === workspace.projectId && captured.worktreeId === null && workspace.worktreeId !== null);
  return canonicalDestination({ version: 1, owner, surface, canvas,
    target: retainWorkspace ? workspace : captured,
    ...(retainWorkspace ? { canvasTarget: captured } : {}) });
}
export type DestinationRead = { kind: "absent" } | { kind: "invalid"; reason: string } | { kind: "destination"; value: Destination };
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function canonicalDestination(destination: Destination): Destination {
  const surface = destination.surface && destination.canvas ? canonicalCanvasSurface(destination.surface, destination.canvas) : destination.surface;
  return surface === destination.surface ? destination : { ...destination, surface };
}
export function destinationHref(destination: Destination): string {
  const target = parseTarget(destination.target), canvas = destination.canvas ? parseCanvasInput(destination.canvas) : undefined;
  const captured = destination.canvasTarget === undefined ? undefined : parseTarget(destination.canvasTarget);
  if (!target || canvas === null || captured === null) throw new TypeError("Invalid workspace destination");
  const value = canonicalDestination({ version: 1, owner: destination.owner, surface: destination.surface, target, ...(canvas ? { canvas } : {}), ...(captured ? { canvasTarget: captured } : {}) });
  return `${value.surface ? `/${value.surface}` : "/"}?destination=${encodeURIComponent(JSON.stringify(value))}`;
}
export function readDestination(href: string): DestinationRead {
  try {
    const url = new URL(href, "http://workspace.local"), raw = url.searchParams.get("destination");
    if (raw === null) return { kind: "absent" };
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || typeof value.owner !== "string" || !isDemoProfileId(value.owner) || !(value.surface === null || isSurfaceId(value.surface))) throw new Error();
    const target = parseTarget(value.target), canvas = value.canvas === undefined ? undefined : parseCanvasInput(value.canvas);
    const captured = value.canvasTarget === undefined ? undefined : parseTarget(value.canvasTarget);
    if (!target || canvas === null || url.pathname !== (value.surface ? `/${value.surface}` : "/")) throw new Error();
    // A separate owner allows global browsing or a project-wide resource in
    // the same project. It must never smuggle another worktree into a project.
    if (captured === null || captured && (!canvas || captured.projectId === null
      || target.projectId !== null && (captured.projectId !== target.projectId || captured.worktreeId !== null))) throw new Error();
    const ownedTarget = captured ?? target;
    if (canvas && (!value.surface || canvas.kind === "capability" && canvas.params.surface !== value.surface || !sameTarget(canvasTarget(canvas, ownedTarget), ownedTarget))) throw new Error();
    if (canvas?.kind === "org-assessment" && value.surface !== "govern") throw new Error();
    if (canvas?.kind === "org-resource" && RESOURCE_TYPES[canvas.params.resourceType].surface !== value.surface) throw new Error();
    return { kind: "destination", value: canonicalDestination({ version: 1, owner: value.owner, surface: value.surface, target, ...(canvas ? { canvas } : {}), ...(captured ? { canvasTarget: captured } : {}) }) };
  } catch { return { kind: "invalid", reason: "This workspace link is invalid or uses an unsupported version." }; }
}
export function destinationIdentity(destination: Destination): string {
  destination = canonicalDestination(destination);
  return JSON.stringify([destination.owner, destination.surface, [destination.target.projectId, destination.target.worktreeId, destination.target.orgId], destination.canvas ? canvasId(destination.canvas.kind, destination.canvas.params) : null,
    ...(destination.canvasTarget ? [[destination.canvasTarget.projectId, destination.canvasTarget.worktreeId, destination.canvasTarget.orgId]] : [])]);
}

/** Router completion is presentation. Only the latest requested destination may commit. */
export class NavigationController {
  private pending: string | null = null;
  private currentHref: string | null = null;
  private currentDestination: Destination | null = null;
  private superseded = new Set<string>();
  private intentRevision = 0;
  constructor(private readonly apply: (destination: Destination, source: "navigation" | "restore" | "capture") => boolean | void, private readonly push: (href: string, replace: boolean) => void) {}
  /** Async work may follow a recommendation only while this navigation intent survives. */
  captureIntent(): () => boolean { const revision = this.intentRevision; return () => this.intentRevision === revision; }
  navigate(destination: Destination, replace = false, source: "navigation" | "restore" = "navigation"): void {
    destination = canonicalDestination(destination);
    const href = destinationHref(destination);
    if (source === "navigation" || href !== this.currentHref) this.intentRevision++;
    if (source === "navigation" && this.currentDestination) this.apply(this.currentDestination, "capture");
    if (this.apply(destination, source) === false) return;
    this.currentDestination = destination;
    if (this.pending && this.pending !== href) this.superseded.add(this.pending);
    this.superseded.delete(href);
    this.pending = this.currentHref = href;
    this.push(href, replace);
  }
  restore(rawHref: string, history = false): boolean {
    const decoded = readDestination(rawHref);
    const href = decoded.kind === "destination" ? destinationHref(decoded.value) : rawHref;
    if (history) {
      this.intentRevision++;
      if (this.pending && this.pending !== href) this.superseded.add(this.pending);
      this.pending = null; this.currentHref = href; this.superseded.delete(href);
    }
    if (!history && (this.superseded.has(href) || this.pending && this.pending !== href)) {
      // Repair both route and URL if an older asynchronous router request arrives.
      if (this.currentHref) this.push(this.currentHref, true);
      return false;
    }
    if (decoded.kind !== "destination") return false;
    if (!history && href !== this.currentHref) this.intentRevision++;
    if (this.apply(decoded.value, "restore") === false) return false;
    this.pending = null; this.currentHref = href; this.currentDestination = decoded.value;
    // A compatibility alias must update Next's actual route as well as the
    // decoded destination; otherwise the old surface can remain mounted.
    if (new URL(rawHref, "http://workspace.local").pathname !== new URL(href, "http://workspace.local").pathname) this.push(href, true);
    return true;
  }
}

export type DestinationDecision = { kind: "absent" } | { kind: "unavailable"; reason: string } | { kind: "available"; destination: Destination };
/** One validation decision feeds workspace, canvas and controller projections. */
export function resolveDestination(href: string, owner: DemoProfileId, access: readonly SurfaceId[], targets: Partial<Record<SurfaceId, { targets?: Record<string, WorkspaceTarget> }>>): DestinationDecision {
  const decoded = readDestination(href);
  if (decoded.kind === "absent") {
    const path = new URL(href, "http://workspace.local").pathname.slice(1);
    return isSurfaceId(path) && !access.includes(path) ? { kind: "unavailable", reason: "This surface is unavailable for your demo profile." } : decoded;
  }
  if (decoded.kind === "invalid") return { kind: "unavailable", reason: decoded.reason };
  const destination = decoded.value;
  if (destination.owner !== owner) return { kind: "unavailable", reason: "This link belongs to another demo profile. Choose a destination in your current workspace." };
  if (destination.surface && !access.includes(destination.surface)) return { kind: "unavailable", reason: "This surface is unavailable for your demo profile." };
  if (destination.canvas?.kind === "preview") {
    const { projectId, worktreeId, orgId } = destination.canvas.params;
    if (demoProfileById(owner).workspaceExperience !== "established" || !previewCanvas(projectId, worktreeId, orgId ?? null)
      || orgId && !ORGS.some(org => org.id === orgId && org.connection === "connected"))
      return { kind: "unavailable", reason: "This preview is unavailable for the selected project, worktree, or org." };
  }
  if (destination.canvas?.kind === "work" && workForCanvas(destination.canvas.params)?.surfaceId !== destination.surface) return { kind: "unavailable", reason: "This work destination is unavailable or does not match its project and surface." };
  if (destination.canvas?.kind === "org-assessment" && !demoProfileById(owner).onboarding) return { kind: "unavailable", reason: "Org assessment is unavailable for this demo profile." };
  if (destination.canvas?.kind === "org-resource") {
    const orgs = demoProfileById(owner).onboarding ? ASSESSMENT_ORGS : ORGS;
    if (!orgs.some(org => org.id === destinationCanvasTarget(destination).orgId && org.connection === "connected") || !findResource(destination.canvas.params)) return { kind: "unavailable", reason: "This resource is unavailable in the connected org." };
  }
  const captured = destination.surface && destination.canvas ? targets[destination.surface]?.targets?.[canvasId(destination.canvas.kind, destination.canvas.params)] : undefined;
  if (captured && !sameTarget(captured, destinationCanvasTarget(destination))) return { kind: "unavailable", reason: "This link requests a different target from the saved draft. Open the saved tab to keep its captured scope." };
  return { kind: "available", destination };
}

/** A login continuation is a validated internal destination, never a router URL supplied verbatim. */
export function normalizeDestinationHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const decoded = readDestination(value);
  return decoded.kind === "destination" ? destinationHref(decoded.value) : null;
}

/** A newly saved plan supplies its own target before React projects the new record. */
export function improvementProjectDestination(
  owner: DemoProfileId,
  project: Pick<import("../projects/model").ImprovementProject, "id" | "name" | "targetOrgId">,
  captured?: WorkspaceTarget,
): Destination {
  const canvas: CanvasSpecInput = { kind: "improvement-project", title: project.name, params: { projectId: project.id } };
  const target = captured ?? { projectId: project.id, worktreeId: null, orgId: project.targetOrgId };
  if (!parseTarget(target) || !sameTarget(canvasTarget(canvas, target), target)) throw new TypeError("Invalid saved project destination");
  return { version: 1, owner, surface: "alm", canvas, target };
}
