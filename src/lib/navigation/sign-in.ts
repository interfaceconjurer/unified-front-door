import { demoProfileById, type DemoProfileId } from "../demo-profiles";
import { destinationHref, normalizeDestinationHref, readDestination } from "./model";

/** Preserve a matching explicit destination; never retarget a saved canvas
 * when the user chooses a different account or org at sign-in. */
export function signInDestination(profileId: DemoProfileId, orgId: string, returnTo: unknown, lastDestination?: string): string {
  // An explicit link wins. Otherwise resume only this profile's current epoch;
  // fresh/reset epochs have no remembered destination and land on global Today.
  const href = normalizeDestinationHref(returnTo ?? lastDestination);
  const decoded = href ? readDestination(href) : null;
  if (decoded?.kind === "destination" && decoded.value.owner === profileId
    && (!decoded.value.surface || demoProfileById(profileId).surfaceAccess.includes(decoded.value.surface))) {
    if (decoded.value.target.orgId === orgId) return href!;
    if (!decoded.value.target.orgId && !decoded.value.canvas)
      return destinationHref({ ...decoded.value, target: { ...decoded.value.target, orgId } });
  }
  return destinationHref({ version: 1, owner: profileId, surface: null, target: { projectId: null, worktreeId: null, orgId } });
}
