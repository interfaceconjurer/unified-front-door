import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { demoProfileById } from "../demo-profiles";
import { applyAssessmentCommand } from "../application/assessment-commands";
import { aggregateKey, conflict, invalid, parseCommand, stableJson, type ApplicationCommand, type CommandResult, type SavedCanvas } from "../application/contracts";
import { canvasId } from "../surface-canvas/model";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { ORGS } from "../workspace/fixtures";
import { projectsForProfile, workForProfile } from "../workspace/demo-workspace";
import { ASSESSMENT_ORGS, accessibleScope } from "../onboarding/assessment";
import { workForCanvas } from "../workspace/returning-work";
import { hash, requireSession, type OwnedSession } from "./session";
import { readWorkspace, writeAssessment } from "./repository";
import { importLegacy } from "./import";
import { assertAssessmentLimits, assertBytes, assertCanvasCount, assertCanvasLimits, DEMO_LIMITS, lockCanvasQuota } from "./quota";
import { syncAssessmentExecution } from "./agent";
import { briefSourceId, projectFromBrief } from "../projects/from-brief";

async function lockKey(client: PoolClient, value: string): Promise<void> { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [value]); }
async function canvasCommand(client: PoolClient, session: OwnedSession, command: Extract<ApplicationCommand, { kind: "canvas.save" | "canvas.copy" }>): Promise<CommandResult> {
  const scope = [session.namespaceId, session.profileId], id = canvasId(command.canvas.kind, command.canvas.params);
  // Keep the original command intact: a retry's receipt hashes its old bytes.
  const surface = canonicalCanvasSurface(command.surface, command.canvas);
  const profile = demoProfileById(session.profileId!);
  if (!profile.surfaceAccess.includes(surface)) invalid("This surface is unavailable for the current demo profile.");
  if (command.canvas.kind === "work") {
    const work = workForCanvas(command.canvas.params);
    if (!work || work.surfaceId !== surface || !workForProfile(profile.id).includes(work)) invalid("The work destination is unavailable.");
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
    if (from?.kind !== "capability" || from.params.scope !== "unbound" || to.kind !== "capability" || to.params.scope !== "project"
      || from.params.capability !== to.params.capability || from.params.section !== to.params.section || from.params.surface !== to.params.surface) invalid("Only an unbound capability draft can be assigned to the same capability in a project.");
    fields = source.fields;
  }
  const revision = (row?.revision ?? 0) + 1;
  assertCanvasLimits({ id, canvas: command.canvas, target: command.target, fields });
  if (row) await client.query("UPDATE canvas_drafts SET fields=$4,revision=$5,surface_id=$6 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, id, fields, revision, surface]);
  else {
    const inserted = await client.query("INSERT INTO canvas_drafts(namespace_id,profile_id,id,surface_id,canvas,target,fields,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(namespace_id,profile_id,id) DO NOTHING", [...scope, id, surface, command.canvas, command.target, fields, revision]);
    if (inserted.rowCount !== 1) conflict("This draft was created by another request. Review its saved version before applying your pending fields.");
  }
  return { revision };
}
export async function executeCommand(client: PoolClient, token: string | undefined, generation: string, input: unknown): Promise<CommandResult> {
  const command = parseCommand(input), session = await requireSession(client, token, generation), scope = [session.namespaceId, session.profileId];
  if (command.kind === "assessment.advance") invalid("Assessment progress is owned by the worker.");
  const digest = hash(stableJson(command));
  await lockKey(client, stableJson([...scope, generation, command.commandId]));
  const previous = (await client.query("SELECT payload_hash,result FROM command_receipts WHERE namespace_id=$1 AND profile_id=$2 AND generation=$3 AND command_id=$4", [...scope, generation, command.commandId])).rows[0];
  if (previous) { if (previous.payload_hash !== digest) conflict("This command ID was already used for different input."); return previous.result; }
  await lockKey(client, stableJson([...scope, aggregateKey(command)]));
  let result: CommandResult;
  if (command.kind === "canvas.save" || command.kind === "canvas.copy") result = await canvasCommand(client, session, command);
  else if (command.kind === "work.status") {
    const row = (await client.query("SELECT record,revision FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [...scope, command.projectId])).rows[0];
    if (!row) invalid("The project is unavailable in your workspace.");
    if (row.revision !== command.expectedRevision) conflict();
    const updated = await client.query("UPDATE project_work_items SET status=$5 WHERE namespace_id=$1 AND profile_id=$2 AND project_id=$3 AND id=$4", [...scope, command.projectId, command.itemId, command.status]);
    if (updated.rowCount !== 1) invalid("The work item is unavailable in this project.");
    await client.query("UPDATE improvement_projects SET revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, command.projectId]);
    result = { revision: row.revision + 1 };
  } else {
    if (command.kind === "legacy.import") await lockCanvasQuota(client, scope);
    const before = await readWorkspace(client, session, true);
    if (command.kind === "project.createFromBrief") {
      const existing = before.assessment.projects.find(project => project.sourceDraftId === briefSourceId(command.sourceId, command.sourceRevision));
      if (existing) result = { revision: before.assessmentRevision, project: existing };
      else {
        if (before.assessmentRevision !== command.expectedRevision) conflict();
        const row = (await client.query("SELECT id,surface_id,canvas,target,fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [...scope, command.sourceId])).rows[0];
        if (!row) invalid("Save the project brief before creating a project.");
        const profile = demoProfileById(session.profileId!);
        const orgs = profile.onboarding ? ASSESSMENT_ORGS : ORGS;
        if (row.target.orgId && !orgs.some(org => org.id === row.target.orgId && org.connection === "connected")) invalid("The brief’s target org is unavailable.");
        const project = projectFromBrief({ ...row, surface: row.surface_id }, command.sourceRevision, profile.name, command.commandId, new Date().toISOString(), `project-${randomUUID()}`);
        const after = { ...before.assessment, projects: [...before.assessment.projects, project] };
        assertAssessmentLimits(after);
        const revision = before.assessmentRevision + 1;
        await writeAssessment(client, session, before.assessment, after, revision);
        // Reset atomically; the immutable source revision identifies retries.
        await client.query("UPDATE canvas_drafts SET fields='{}'::jsonb,revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, command.sourceId]);
        result = { revision, project };
      }
    } else if (command.kind === "legacy.import") {
      // Import receipts precede revision validation: a repeat source cannot overwrite later edits.
      const imported = await importLegacy(client, session, before, command.source, command.expectedRevision);
      const row = (await client.query("SELECT assessment_revision FROM workspaces WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0];
      result = { revision: row.assessment_revision, imported };
    } else {
      if (before.assessmentRevision !== command.expectedRevision && !(command.kind === "assessment.start" && before.assessment.status === "running")) conflict();
      if (!demoProfileById(session.profileId!).onboarding) invalid("This demo profile does not run org assessments.");
      let after = applyAssessmentCommand(before.assessment, command, { id: randomUUID, now: new Date().toISOString(), owner: demoProfileById(session.profileId!).name });
      if (command.kind === "assessment.start" && after.status === "running" && (!after.scopeOrgIds.length || accessibleScope(after.scopeOrgIds).length !== after.scopeOrgIds.length)) after = { ...after, status: "paused" };
      assertAssessmentLimits(after);
      const changed = after !== before.assessment;
      const revision = before.assessmentRevision + Number(changed);
      if (changed) await writeAssessment(client, session, before.assessment, after, revision);
      // Joining an existing run is a no-op command, but may attach a legacy job.
      await syncAssessmentExecution(client, session, command, after);
      result = { revision, ...(command.kind === "project.create" ? { project: after.projects.find((p) => p.createCommandId === command.commandId) } : {}) };
    }
  }
  assertBytes(result, DEMO_LIMITS.receiptBytes, "Command result");
  await client.query("INSERT INTO command_receipts(namespace_id,profile_id,generation,command_id,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6)", [...scope, generation, command.commandId, digest, result]);
  return result;
}
