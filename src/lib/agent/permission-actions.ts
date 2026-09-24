import { permissionGuidance, permissionUsers } from "../org-resources/permissions";

/** A bounded demo action interpreter. Only explicit cohort-wide requests can
 * change assignments. Questions, exceptions and unsupported access levels do not. */
export function permissionReply(text: string, fields: Record<string, string>): { text: string; patch?: Record<string, string> } {
  const request = text.trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.,]+$/g, "")
    .replace(/^(?:please\s+)?(?:(?:can|could|would|will) you\s+)?(?:please\s+)?/, "");
  const users = permissionUsers(fields);
  const all = /\b(all|everyone|everybody|remaining|rest|each)\b/.test(request);
  const qualified = /\b(if|unless|except|excluding|but|don't|not yet|never|another|sales|admins|administrators|org|sandbox|explain|why|what|how|also)\b/.test(request);
  let canDelete: boolean | undefined;
  if (all && !qualified) {
    if (/^(undo|revert|restore)\b/.test(request) && /\b(changes|original|permissions|access)\b/.test(request)) canDelete = true;
    else if (/^(remove|revoke|disable|turn off)\b/.test(request) && /\b(delete|deletion)\b/.test(request)
      && !/\b(read|create|edit|other|admin|profile)\b/.test(request)) canDelete = false;
    else if (/^(set|update|change|give|make)\b/.test(request) && /\b(to|with)\s+(standard(?: case)? access|least[ -]privilege(?: access)?|read[, ]+create[, ]+and[ ,]+edit(?: cases)?)(?:\s+permissions)?$/.test(request)) canDelete = false;
    else if (/^do the same\b/.test(request) && users.some(user => user.changed)) canDelete = false;
    else if (/^(allow|enable|grant|restore|give)\b/.test(request) && /\bdelete cases\b/.test(request)
      && !/\b(read|create|edit|other|admin|profile)\b/.test(request)) canDelete = true;
  }
  if (canDelete !== undefined) {
    const changed = users.filter(user => user.canDelete !== canDelete);
    return { patch: Object.fromEntries(changed.map(user => [user.id, canDelete ? "" : "standard"])),
      text: changed.length ? `${canDelete ? "Restored" : "Removed"} Delete Cases access ${canDelete ? "for" : "from"} ${changed.length} ${changed.length === 1 ? "user" : "users"} in Service Reps. ${users.length - changed.length ? `${users.length - changed.length} already had that access, so I left them unchanged. ` : ""}Read, Create and Edit are unchanged.\n\n${canDelete ? "The assignment plan now matches the captured org access." : "The assignment changes are tracked automatically. You can undo any row in the canvas."} The connected org has not been changed.`
        : `All ${users.length} Service Reps users already have ${canDelete ? "Delete Cases" : "standard Case"} access in this workspace. No changes were needed.` };
  }
  if (/\b(source|where|why|explain)\b/.test(request)) return { text: "Service Reps provides Read, Create and Edit on Cases. The extra Delete permission comes from a separate Case Delete permission set assigned directly to each user. The captured Minimum Access profiles and other grants do not provide Delete.\n\nThe service role policy does not require deletion, so removing that direct assignment preserves their everyday work. An approved exception should be reviewed separately." };
  return { text: `${permissionGuidance(fields)}\n\nFor a bulk change, say “Remove Delete Cases access for all these users” or “Update all users to standard access.” This canvas supports changing the extra Delete Cases assignment; other permissions and exceptions need a separate review.` };
}
