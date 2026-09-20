import type { SurfaceId } from "../workspace/surfaces";

export const RESOURCE_TYPES = {
  "standard-object": { label: "Standard object", plural: "Standard objects", group: "Data", surface: "build" },
  "custom-object": { label: "Custom object", plural: "Custom objects", group: "Data", surface: "build" },
  "custom-field": { label: "Custom field", plural: "Custom fields", group: "Data", surface: "build" },
  flow: { label: "Flow", plural: "Flows", group: "Automation", surface: "build" },
  "validation-rule": { label: "Validation rule", plural: "Validation rules", group: "Automation", surface: "build" },
  "permission-set": { label: "Permission set", plural: "Permission sets", group: "Access", surface: "build" },
  "permission-set-group": { label: "Permission set group", plural: "Permission set groups", group: "Access", surface: "build" },
  "custom-permission": { label: "Custom permission", plural: "Custom permissions", group: "Access", surface: "build" },
  profile: { label: "Profile", plural: "Profiles", group: "Access", surface: "build" },
  role: { label: "Role", plural: "Roles", group: "Access", surface: "build" },
  queue: { label: "Queue", plural: "Queues", group: "Access", surface: "build" },
  "record-type": { label: "Record type", plural: "Record types", group: "Data", surface: "build" },
  "page-layout": { label: "Page layout", plural: "Page layouts", group: "Interface", surface: "build" },
  "lightning-page": { label: "Lightning page", plural: "Lightning pages", group: "Interface", surface: "build" },
  "custom-metadata": { label: "Custom metadata type", plural: "Custom metadata types", group: "Data", surface: "build" },
  "custom-label": { label: "Custom label", plural: "Custom labels", group: "Interface", surface: "build" },
  "static-resource": { label: "Static resource", plural: "Static resources", group: "Interface", surface: "build" },
  "named-credential": { label: "Named credential", plural: "Named credentials", group: "Integration", surface: "build" },
  "connected-app": { label: "Connected app", plural: "Connected apps", group: "Integration", surface: "build" },
  "apex-class": { label: "Apex class", plural: "Apex classes", group: "Code", surface: "code" },
  "apex-trigger": { label: "Apex trigger", plural: "Apex triggers", group: "Code", surface: "code" },
  "lightning-component": { label: "Lightning web component", plural: "Lightning web components", group: "Code", surface: "code" },
  "sharing-rule": { label: "Sharing rule", plural: "Sharing rules", group: "Access", surface: "govern" },
  report: { label: "Report", plural: "Reports", group: "Analytics", surface: "govern" },
  dashboard: { label: "Dashboard", plural: "Dashboards", group: "Analytics", surface: "govern" },
} as const satisfies Record<string, { label: string; plural: string; group: string; surface: SurfaceId }>;

export type ResourceType = keyof typeof RESOURCE_TYPES;
export type ResourceReference = { resourceType: ResourceType; apiName: string };
export type ResourceIdentity = ResourceReference & { orgId: string };
export type OrgResource = ResourceIdentity & {
  label: string;
  summary: string;
  status: string;
  facts: readonly { label: string; value: string }[];
  section?: { title: string; columns: readonly string[]; rows: readonly (readonly string[])[] };
  code?: string;
  related: readonly ResourceReference[];
};

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && Object.hasOwn(RESOURCE_TYPES, value);
}
export function resourceKey(resource: ResourceReference): string {
  return JSON.stringify([resource.resourceType, resource.apiName]);
}
export function searchResources(resources: readonly OrgResource[], query: string, type: ResourceType | "all" = "all"): OrgResource[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return resources.filter(resource => {
    if (type !== "all" && resource.resourceType !== type) return false;
    const kind = RESOURCE_TYPES[resource.resourceType];
    const text = [resource.label, resource.apiName, resource.summary, kind.label, kind.plural, kind.group].join(" ").toLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => a.label.localeCompare(b.label) || a.resourceType.localeCompare(b.resourceType));
}
