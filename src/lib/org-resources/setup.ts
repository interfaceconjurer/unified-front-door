import type { ResourceType } from "./model";

export const SETUP_AREAS = [
  { id: "object-manager", label: "Data & Objects", title: "Object Manager", description: "Explore objects, fields, relationships, and layouts.", resourceTypes: ["standard-object", "custom-object", "custom-field", "record-type", "page-layout", "validation-rule", "custom-metadata"] },
  { id: "access-permissions", label: "Access & Permissions", title: "Access & Permissions", description: "Review permission sets, profiles, and who can do what.", resourceTypes: ["permission-set", "permission-set-group", "profile", "custom-permission", "role", "queue"] },
  { id: "org-settings", label: "Org Settings & Features", title: "Org Settings & Features", description: "See what’s enabled and explore your org’s configuration.", resourceTypes: ["org-feature", "named-credential", "connected-app"] },
] as const satisfies readonly { id: string; label: string; title: string; description: string; resourceTypes: readonly ResourceType[] }[];

export function setupAreaForId(id: string) { return SETUP_AREAS.find(area => area.id === id); }
export function resourceBelongsToArea(area: (typeof SETUP_AREAS)[number], type: ResourceType) {
  return (area.resourceTypes as readonly ResourceType[]).includes(type);
}
