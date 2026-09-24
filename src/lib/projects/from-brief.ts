import { conflict, invalid, type SavedCanvas } from "../application/contracts";
import { isProjectType } from "./templates";
import type { SavedProject } from "./model";

export const briefSourceId = (id: string, revision: number) => JSON.stringify(["brief", id, revision]);

/** Creates a Studio project from acknowledged fields; never provisions a repo. */
export function projectFromBrief(saved: SavedCanvas, revision: number, owner: string, commandId: string, now: string, id: string): SavedProject {
  if (saved.revision !== revision) conflict("The project brief changed. Review the saved version before creating your project.");
  if (saved.surface !== "alm" || saved.canvas.kind !== "capability" || saved.canvas.params.capability !== "project") invalid("Choose a saved project brief.");
  const { name = "", goal = "", projectType = "standard", context = "", repository = "" } = saved.fields;
  if (!name.trim() || !goal.trim()) invalid("Give the project a name and a goal.");
  if (!isProjectType(projectType)) invalid("Choose a supported project type.");
  if (repository.trim()) {
    try { const url = new URL(repository.trim()); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); }
    catch { invalid("Use an HTTPS repository URL without credentials, or leave it blank."); }
  }
  return { id, name: name.trim(), goal: goal.trim(), projectType, context, owner,
    targetOrgId: null, scopeOrgIds: saved.target.orgId ? [saved.target.orgId] : [],
    createdAt: now, revision: 1, source: "brief", runId: null,
    sourceDraftId: briefSourceId(saved.id, revision), createCommandId: commandId,
    ...(repository.trim() ? { repository: repository.trim() } : {}), workItems: [],
  };
}
