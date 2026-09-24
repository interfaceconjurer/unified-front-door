import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { demoProfileById } from "../demo-profiles";
import { applyAssessmentCommand } from "../application/assessment-commands";
import { aggregateKey, briefTransferSources, conflict, invalid, parseCommand, stableJson, type CommandResult, type TransferSource } from "../application/contracts";
import { canvasId, inputFromCanonicalId } from "../surface-canvas/model";
import { validResourceFields } from "../org-resources/editable";
import { ORGS } from "../workspace/fixtures";
import { projectsForProfile } from "../workspace/demo-workspace";
import { ASSESSMENT_ORGS, accessibleScope } from "../onboarding/assessment";
import { hash, requireSession, type OwnedSession } from "./session";
import { readWorkspace, writeAssessment } from "./repository";
import { importLegacy } from "./import";
import { assertAssessmentLimits, assertBytes, assertCanvasCount, assertCanvasLimits, DEMO_LIMITS, lockCanvasQuota } from "./quota";
import { canvasCommand } from "./canvas-commands";
import { syncAssessmentExecution } from "./agent";
import { briefSourceId, projectFromBrief } from "../projects/from-brief";
import { planChangeTransfer, transferredCanvas } from "../workspace/change-transfer";
import { primaryWorktree } from "../workspace/model";

async function lockKey(client: PoolClient, value: string): Promise<void> { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [value]); }
async function transferChanges(client: PoolClient, session: OwnedSession, sources: TransferSource[], projectId: string, worktreeId: string | null) {
  const scope = [session.namespaceId, session.profileId], profile = demoProfileById(session.profileId!);
  const ids = sources.flatMap(source => {
    const from = inputFromCanonicalId(source.sourceId), to = from && transferredCanvas(from, projectId, worktreeId);
    if (!to) invalid("This change cannot be transferred into a project.");
    return [source.sourceId, canvasId(to.kind, to.params)];
  });
  // Use the same locks as ordinary draft saves, with a stable order for batches.
  for (const id of [...new Set(ids)].sort()) await lockKey(client, stableJson([...scope, `canvas:${id}`]));
  const rows = (await client.query("SELECT id,surface_id,canvas,target,fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 AND id=ANY($3::text[]) ORDER BY id FOR UPDATE", [...scope, ids])).rows;
  const plan = planChangeTransfer(sources, rows.map(row => ({ ...row, surface: row.surface_id })), projectId, worktreeId);
  const orgs = profile.onboarding ? ASSESSMENT_ORGS : ORGS;
  for (const { destination } of plan) {
    if (!profile.surfaceAccess.includes(destination.surface) || destination.target.orgId && !orgs.some(org => org.id === destination.target.orgId && org.connection === "connected")) invalid("The change's org or surface is unavailable.");
    if (destination.canvas.kind === "org-resource" && !validResourceFields(destination.canvas.params, destination.fields)) invalid("The resource changes are not valid.");
    assertCanvasLimits(destination);
  }
  await lockCanvasQuota(client, scope); await assertCanvasCount(client, scope, plan.length);
  for (const { destination } of plan) {
    const inserted = await client.query("INSERT INTO canvas_drafts(namespace_id,profile_id,id,surface_id,canvas,target,fields,revision) VALUES($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT(namespace_id,profile_id,id) DO NOTHING", [...scope, destination.id, destination.surface, destination.canvas, destination.target, destination.fields]);
    if (inserted.rowCount !== 1) conflict("A destination file changed. Nothing was transferred; review the project before retrying.");
  }
  // Empty revisioned source records prevent stale tabs from restoring transferred fields.
  await client.query("UPDATE canvas_drafts SET fields='{}'::jsonb,revision=revision+1 WHERE namespace_id=$1 AND profile_id=$2 AND id=ANY($3::text[])", [...scope, sources.map(source => source.sourceId)]);
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
  else if (command.kind === "changes.transfer") {
    const fixture = projectsForProfile(session.profileId!).find(project => project.id === command.projectId);
    const owned = fixture ? null : (await client.query("SELECT id FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, command.projectId])).rows[0];
    if (!fixture && !owned) invalid("The project is unavailable in this workspace.");
    await transferChanges(client, session, command.sources, command.projectId, fixture ? primaryWorktree(fixture)?.id ?? null : null);
    result = { revision: 0 };
  }
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
        const transfers = briefTransferSources(row.fields.transferSources);
        if (transfers.some(source => source.sourceId === command.sourceId)) invalid("The creation brief cannot transfer itself.");
        const after = { ...before.assessment, projects: [...before.assessment.projects, project] };
        assertAssessmentLimits(after);
        const revision = before.assessmentRevision + 1;
        await writeAssessment(client, session, before.assessment, after, revision);
        if (transfers.length) await transferChanges(client, session, transfers, project.id, null);
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
