import { findResource } from "./catalog";
import type { ResourceIdentity } from "./model";

/** Captured demo assignments. The group grants read/create/edit; Case_Delete is
 * a separate, direct grant. No profile or other group grants Delete to this cohort. */
export const SERVICE_REPS = [
  { id: "maya_chen", name: "Maya Chen", email: "maya.chen@acme.example" },
  { id: "jordan_lee", name: "Jordan Lee", email: "jordan.lee@acme.example" },
  { id: "alex_morgan", name: "Alex Morgan", email: "alex.morgan@acme.example" },
  { id: "priya_shah", name: "Priya Shah", email: "priya.shah@acme.example" },
  { id: "luis_rivera", name: "Luis Rivera", email: "luis.rivera@acme.example" },
  { id: "emma_wilson", name: "Emma Wilson", email: "emma.wilson@acme.example" },
] as const;
export const PERMISSION_SUGGESTIONS = ["Remove Delete Cases access for the remaining users", "Explain where this access comes from", "Undo all permission changes"] as const;
export function isEditablePermissions(identity: ResourceIdentity): boolean {
  return identity.resourceType === "permission-set-group" && identity.apiName === "Service_Reps" && !!findResource(identity);
}
export function validPermissionFields(identity: ResourceIdentity, fields: Record<string, string>): boolean {
  return isEditablePermissions(identity) && Object.entries(fields).every(([key, value]) =>
    SERVICE_REPS.some(user => user.id === key) && ["", "standard"].includes(value));
}
export function permissionUsers(fields: Record<string, string> = {}) {
  return SERVICE_REPS.map(user => ({ ...user, canDelete: fields[user.id] !== "standard", changed: fields[user.id] === "standard" }));
}
/** Assignments are Salesforce records, not PermissionSet metadata. This tracked
 * desired-state file describes the assignment plan; no live org write occurs. */
export function permissionFileContent(fields: Record<string, string> = {}): string {
  return JSON.stringify({ group: "Service_Reps", object: "Case", baselineAccess: ["Read", "Create", "Edit"],
    assignments: permissionUsers(fields).map(user => ({ user: user.email, permissionSets: user.canDelete ? ["Case_Delete"] : [] })),
  }, null, 2) + "\n";
}
export function permissionGuidance(fields: Record<string, string> = {}): string {
  const remaining = permissionUsers(fields).filter(user => user.canDelete).length;
  return remaining ? `${remaining} service representatives still have Delete Cases access through a direct Case Delete permission-set assignment. Their role calls for reading, creating and editing Cases.\n\nTurn off Delete Cases for one user to review the change. Then ask me to remove it for the remaining users. Changes are tracked automatically, and you can undo them at any time.`
    : "Everyone in this group now has standard Case access in your tracked changes: read, create and edit. Review Changes when you’re ready. You can undo individual changes in the canvas or ask me to undo them all.";
}
