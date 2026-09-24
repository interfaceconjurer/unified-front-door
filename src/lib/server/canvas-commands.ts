import "server-only";
import type { PoolClient } from "pg";
import { demoProfileById } from "../demo-profiles";
import { conflict, invalid, stableJson, type ApplicationCommand, type CommandResult, type SavedCanvas } from "../application/contracts";
import { canvasId, canCopyCanvasToProject } from "../surface-canvas/model";
import { validResourceFields } from "../org-resources/editable";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { ORGS } from "../workspace/fixtures";
import { projectsForProfile, workForProfile } from "../workspace/demo-workspace";
import { ASSESSMENT_ORGS } from "../onboarding/assessment";
import { workForCanvas } from "../workspace/returning-work";
import type { OwnedSession } from "./session";
import { assertCanvasCount, assertCanvasLimits, lockCanvasQuota } from "./quota";

export async function canvasCommand(client: PoolClient, session: OwnedSession, command: Extract<ApplicationCommand, { kind: "canvas.save" | "canvas.copy" }>): Promise<CommandResult> {
  const scope = [session.namespaceId, session.profileId], id = canvasId(command.canvas.kind, command.canvas.params);
  // Keep the original command intact: a retry's receipt hashes its old bytes.
  const surface = canonicalCanvasSurface(command.surface, command.canvas);
  const profile = demoProfileById(session.profileId!);
  if (!profile.surfaceAccess.includes(surface)) invalid("This surface is unavailable for the current demo profile.");
  if (command.canvas.kind === "work") {
    const work = workForCanvas(command.canvas.params);
    if (!work || work.surfaceId !== surface || !workForProfile(profile.id).includes(work)) invalid("The work destination is unavailable.");
  }
  if (command.canvas.kind === "work-item-change") {
    const { projectId, workItemId } = command.canvas.params;
    const owned = (await client.query("SELECT id FROM project_work_items WHERE namespace_id=$1 AND profile_id=$2 AND project_id=$3 AND id=$4", [...scope, projectId, workItemId])).rows[0];
    if (!owned) invalid("This work item is unavailable in this project.");
  }
  const row = (await client.query("SELECT canvas,target,fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [...scope, id])).rows[0];
  if ((row?.revision ?? 0) !== command.expectedRevision) conflict();
  if (row && stableJson(row.target) !== stableJson(command.target)) conflict("This draft already belongs to a different captured scope.");
  if (!row) {
    await lockCanvasQuota(client, scope); await assertCanvasCount(client, scope, 1);
    const target = command.target;
    const fixture = projectsForProfile(profile.id).find((p) => p.id === target.projectId);
    const owned = target.projectId ? (await client.query("SELECT id FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, target.projectId])).rows[0] : null;
    if (target.projectId && !fixture && !owned) invalid("The project is unavailable in this workspace.");
    if (target.worktreeId && !fixture?.worktrees.some((w) => w.id === target.worktreeId)) invalid("The worktree is unavailable in this project.");
    const orgs = profile.onboarding ? ASSESSMENT_ORGS : ORGS;
    if (target.orgId && !orgs.some((org) => org.id === target.orgId && org.connection === "connected")) invalid("The org is unavailable.");
    if (command.canvas.kind === "app") { const appId = command.canvas.params.appId; if (!fixture?.apps.some((app) => app.id === appId)) invalid("The application is unavailable in this project."); }
  }
  let fields = command.kind === "canvas.save" ? { ...row?.fields, ...command.fields } : {};
  if (command.kind === "canvas.copy") {
    if (row) conflict("The target already has a saved draft. Neither draft was replaced.");
    const source = (await client.query("SELECT canvas,fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR SHARE", [...scope, command.sourceId])).rows[0];
    const from = source?.canvas as SavedCanvas["canvas"] | undefined, to = command.canvas;
    if (!source || source.revision !== command.sourceRevision) conflict("The source draft changed. Review it before assigning a copy.");
    if (!from || !canCopyCanvasToProject(from, to)) invalid("Only an unassigned draft can be copied to the same capability or org resource in a project.");
    fields = source.fields;
  }
  if (command.canvas.kind === "org-resource" && !validResourceFields(command.canvas.params, fields)) invalid("The resource changes are not valid.");
  const revision = (row?.revision ?? 0) + 1;
  assertCanvasLimits({ id, canvas: command.canvas, target: command.target, fields });
  if (row) await client.query("UPDATE canvas_drafts SET fields=$4,revision=$5,surface_id=$6 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, id, fields, revision, surface]);
  else {
    const inserted = await client.query("INSERT INTO canvas_drafts(namespace_id,profile_id,id,surface_id,canvas,target,fields,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(namespace_id,profile_id,id) DO NOTHING", [...scope, id, surface, command.canvas, command.target, fields, revision]);
    if (inserted.rowCount !== 1) conflict("This draft was created by another request. Review its saved version before applying your pending fields.");
  }
  return { revision };
}
