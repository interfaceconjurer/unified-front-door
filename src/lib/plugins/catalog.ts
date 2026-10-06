import { BrowserPersistenceStore, type Decoded } from "../browser-persistence";
import { capabilitiesForSurface } from "../surface-canvas/capabilities";
import type { CanvasSpecInput } from "../surface-canvas/model";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { RESOURCE_TYPES } from "../org-resources/model";
import { SURFACES, SURFACE_IDS, isSurfaceId, type SurfaceId } from "../workspace/surfaces";

/**
 * Plugins package a team's capabilities. The four first-party plugins keep the
 * former surface ids, so saved canvas identities, links, access rules and the
 * server's `surface_id` column remain valid without a data migration.
 */
export type PluginId = SurfaceId;
export type AlmStage = "planning" | "building" | "testing" | "releasing" | "observing";
export const ALM_STAGES: readonly AlmStage[] = ["planning", "building", "testing", "releasing", "observing"];
export const ALM_STAGE_LABEL: Record<AlmStage, string> = { planning: "Planning", building: "Building", testing: "Testing", releasing: "Releasing", observing: "Observing" };

export type Plugin = { id: PluginId; name: string; publisher: string; version: string; description: string };
export const PLUGIN_IDS: readonly PluginId[] = SURFACE_IDS;
export const PLUGINS: Record<PluginId, Plugin> = {
  build: { id: "build", name: SURFACES.build.label, publisher: "Salesforce Platform", version: "1.0.0", description: "Configure data, automation, agents, and experiences." },
  code: { id: "code", name: SURFACES.code.label, publisher: "Salesforce Developer Experience", version: "1.0.0", description: "Develop, test, debug, and extend the platform." },
  govern: { id: "govern", name: SURFACES.govern.label, publisher: "Salesforce Trust", version: "1.0.0", description: "Secure, monitor, and understand platform health." },
  alm: { id: "alm", name: SURFACES.alm.label, publisher: "Salesforce DevOps", version: "1.0.0", description: "Plan, validate, release, and operate change." },
};
export const isPluginId = isSurfaceId;

/** ALM stage tags. Identity stays (plugin, capability). */
const STAGES: Record<PluginId, Record<string, readonly AlmStage[]>> = {
  build: { overview: ["building"], "object-manager": ["building", "observing"], "access-permissions": ["building", "observing"], "org-settings": ["building", "observing"],
    "data-model": ["planning", "building"], automation: ["building"], agent: ["building"], experience: ["building"] },
  code: { overview: ["building"], "sfdx-project": ["planning", "building"], "react-app": ["building"], apex: ["building"], query: ["building", "observing"],
    tests: ["testing"], agent: ["building"], toolkit: ["building"] },
  govern: { overview: ["observing"], security: ["observing"], health: ["observing"], policies: ["planning", "releasing"], "agent-activity": ["observing"] },
  alm: { overview: ["planning"], project: ["planning"], work: ["planning"], pipeline: ["releasing"], validation: ["testing", "releasing"], release: ["releasing"] },
};

export type CatalogCapability = { plugin: PluginId; capability: string; name: string; description: string; stages: readonly AlmStage[]; group?: "toolkit" | "setup" };
export function overviewName(plugin: PluginId): string { return `${PLUGINS[plugin].name} overview`; }

/** Installed plugins' capabilities in plugin order, each plugin's overview first. */
export function capabilityCatalog(installed: readonly PluginId[]): CatalogCapability[] {
  return PLUGIN_IDS.filter(plugin => installed.includes(plugin)).flatMap(plugin => [
    { plugin, capability: "overview", name: overviewName(plugin), description: `Start from ${PLUGINS[plugin].name}: its tools, starters, and recent work.`, stages: STAGES[plugin].overview! },
    ...capabilitiesForSurface(plugin).map(capability => ({ plugin, capability: capability.id, name: capability.label, description: capability.description,
      stages: STAGES[plugin][capability.id] ?? [], ...(capability.group ? { group: capability.group } : {}) })),
  ]);
}

/** A view's owning plugin: explicit in its identity where available, else the
 * surface it already routes through (including existing compatibility aliases). */
export function pluginForCanvas(route: PluginId, canvas: CanvasSpecInput): PluginId {
  if (canvas.kind === "capability") return canvas.params.surface;
  if (canvas.kind === "org-resource") return RESOURCE_TYPES[canvas.params.resourceType].surface;
  if (canvas.kind === "improvement-project") return "alm";
  return canonicalCanvasSurface(route, canvas);
}

const VIEW_CAPABILITY: Record<Exclude<CanvasSpecInput["kind"], "capability">, string> = {
  "org-resource": "Browse org resources",
  "org-assessment": "Assess your org",
  "work-item-change": "Change a work item",
  preview: "Preview project",
  "project-file": "Browse project files",
  work: "Continue work",
  app: "Deployed app",
  "improvement-project": "Project plan",
};
/** Capability name shown in a view header; `undefined` is the plugin overview. */
export function viewCapability(plugin: PluginId, canvas: CanvasSpecInput | undefined): string {
  if (!canvas) return overviewName(plugin);
  if (canvas.kind !== "capability") return VIEW_CAPABILITY[canvas.kind];
  return capabilitiesForSurface(canvas.params.surface).find(item => item.id === canvas.params.capability)?.label ?? canvas.title;
}

/** Simulated per-profile install state. Access bounds it; drafts are untouched. */
type InstallState = { uninstalled: PluginId[] };
function parseInstall(value: unknown): Decoded<InstallState> {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray((value as InstallState).uninstalled)) return { error: "invalid" };
  return { value: { uninstalled: (value as InstallState).uninstalled.filter(isPluginId) } };
}
export class PluginInstallStore extends BrowserPersistenceStore<InstallState> {
  constructor(storageKey: string, private access: readonly PluginId[]) { super(storageKey, { uninstalled: [] }, parseInstall); }
  /** Stable per snapshot for `useSyncExternalStore`. */
  private last?: { state: InstallState; installed: PluginId[] };
  installed = (): PluginId[] => {
    const state = this.getSnapshot();
    if (this.last?.state !== state) this.last = { state, installed: PLUGIN_IDS.filter(id => this.access.includes(id) && !state.uninstalled.includes(id)) };
    return this.last.installed;
  };
  install = (id: PluginId): boolean => {
    if (!this.access.includes(id)) return false;
    this.update(current => current.uninstalled.includes(id) ? { uninstalled: current.uninstalled.filter(item => item !== id) } : current);
    return true;
  };
  uninstall = (id: PluginId): void => {
    this.update(current => current.uninstalled.includes(id) ? current : { uninstalled: [...current.uninstalled, id] });
  };
}
