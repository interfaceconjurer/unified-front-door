import { findResource } from "./catalog";
import type { OrgResource, ResourceIdentity } from "./model";

export const OBJECT_FIELD_TYPES = ["Text", "Number", "Checkbox", "Date", "Email"] as const;
export type ObjectField = { label: string; apiName: string; type: (typeof OBJECT_FIELD_TYPES)[number] };

/** Field edits are workspace overlays on the captured Account metadata. */
export function isEditableObject(identity: ResourceIdentity): boolean {
  return identity.resourceType === "standard-object" && identity.apiName === "Account" && !!findResource(identity);
}

export function suggestedFieldApiName(label: string): string {
  const stem = label.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^[^a-zA-Z]+|_+$/g, "").slice(0, 40).replace(/_+$/g, "");
  return stem ? `${stem}__c` : "";
}

export function objectFieldProblem(resource: OrgResource, field: ObjectField, added: readonly ObjectField[]): string | null {
  if (!field.label.trim() || field.label.length > 80) return "Enter a field label of 80 characters or fewer.";
  if (field.apiName.length > 80 || !/^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*__c$/.test(field.apiName)) return "Use an API name starting with a letter, with letters, numbers or single underscores, and ending in __c.";
  if (!(OBJECT_FIELD_TYPES as readonly string[]).includes(field.type)) return "Choose a supported field type.";
  const names = [...(resource.section?.rows.map(row => row[1]) ?? []), ...added.map(item => item.apiName)];
  if (names.some(name => name?.toLowerCase() === field.apiName.toLowerCase())) return "A field with this API name already exists.";
  return null;
}

/** Validate patches and merged saved fields at the command boundary. Empty values remove additions. */
export function parseObjectFields(identity: ResourceIdentity, fields: Record<string, string>): ObjectField[] | null {
  const resource = findResource(identity);
  if (!resource || !isEditableObject(identity)) return null;
  const added: ObjectField[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!/^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*__c$/.test(key) || key.length > 80) return null;
    if (value === "") continue;
    try {
      const field = JSON.parse(value);
      if (!field || typeof field !== "object" || Object.keys(field).sort().join(",") !== "apiName,label,type"
        || typeof field.label !== "string" || typeof field.type !== "string" || field.apiName !== key
        || objectFieldProblem(resource, field, added)) return null;
      added.push(field);
    } catch { return null; }
  }
  return added.sort((a, b) => a.apiName.localeCompare(b.apiName));
}

export function objectFileContent(resource: OrgResource, added: readonly ObjectField[] = []): string {
  return JSON.stringify({ apiName: resource.apiName, label: resource.label,
    fields: [...(resource.section?.rows.map(([label, apiName, type]) => ({ label, apiName, type })) ?? []), ...added],
  }, null, 2) + "\n";
}
