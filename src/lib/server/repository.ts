import "server-only";
import type { PoolClient } from "pg";
import type { AssessmentState } from "../assessment/state";
import type { AssessmentRun, FindingSnapshot } from "../assessment/model";
import type { ImprovementProject, PlannedWorkItem } from "../projects/model";
import type { ApplicationSnapshot, SavedCanvas } from "../application/contracts";
import { sessionView, type OwnedSession } from "./session";
import { assessmentCursor } from "../assessment/cursor";
import { assertBytes, DEMO_LIMITS } from "./quota";

export async function readWorkspace(client: PoolClient, session: OwnedSession, lock = false): Promise<ApplicationSnapshot> {
  const scope = [session.namespaceId, session.profileId];
  const workspace = (await client.query(`SELECT assessment_revision,assessment_cursor FROM workspaces WHERE namespace_id=$1 AND profile_id=$2${lock ? " FOR UPDATE" : ""}`, scope)).rows[0];
  if (!workspace) throw new Error("Missing workspace");
  const runs = (await client.query("SELECT record FROM assessment_runs WHERE namespace_id=$1 AND profile_id=$2 ORDER BY record->>'startedAt',id", scope)).rows.map((row) => ({ ...row.record, findings: [] })) as AssessmentRun[];
  const findings = (await client.query("SELECT record FROM assessment_findings WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id", scope)).rows.map((row) => row.record) as FindingSnapshot[];
  for (const run of runs) run.findings = findings.filter((finding) => finding.runId === run.id);
  const projects = (await client.query("SELECT record,revision FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 ORDER BY record->>'createdAt',id", scope)).rows.map((row) => ({ ...row.record, revision: row.revision, workItems: [] })) as ImprovementProject[];
  const items = (await client.query("SELECT project_id,record,status FROM project_work_items WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id", scope)).rows;
  for (const project of projects) project.workItems = items.filter((row) => row.project_id === project.id).map((row) => ({ ...row.record, status: row.status })) as PlannedWorkItem[];
  const draft = (await client.query("SELECT record,revision FROM project_drafts WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0];
  const canvases = (await client.query("SELECT id,surface_id,canvas,target,fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 ORDER BY id", scope)).rows.map((row) => ({ id: row.id, surface: row.surface_id, canvas: row.canvas, target: row.target, fields: row.fields, revision: row.revision })) as SavedCanvas[];
  const imports = (await client.query("SELECT summary,imported_at FROM import_receipts WHERE namespace_id=$1 AND profile_id=$2 ORDER BY imported_at,source_hash LIMIT $3", [...scope, DEMO_LIMITS.imports])).rows.map(row => ({ ...row.summary, importedAt: row.imported_at.toISOString() }));
  const snapshot: ApplicationSnapshot = { session: sessionView(session), assessmentRevision: workspace.assessment_revision, assessment: { ...workspace.assessment_cursor, projects, runs, draft: draft ? { ...draft.record, revision: draft.revision } : null }, canvases, imports };
  assertBytes(snapshot, DEMO_LIMITS.snapshotBytes, "Workspace response");
  return snapshot;
}
export async function insertRun(client: PoolClient, scope: (string | null)[], run: AssessmentRun): Promise<void> {
  const { findings, ...record } = run;
  await client.query("INSERT INTO assessment_runs(namespace_id,profile_id,id,record) VALUES($1,$2,$3,$4)", [...scope, run.id, record]);
  for (const finding of findings) await client.query("INSERT INTO assessment_findings(namespace_id,profile_id,run_id,id,record) VALUES($1,$2,$3,$4,$5)", [...scope, run.id, finding.id, finding]);
}
export async function insertProject(client: PoolClient, scope: (string | null)[], project: ImprovementProject): Promise<void> {
  const { workItems, ...record } = project;
  await client.query("INSERT INTO improvement_projects(namespace_id,profile_id,id,run_id,source_draft_id,create_command_id,revision,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [...scope, project.id, project.runId, project.sourceDraftId, project.createCommandId, project.revision, record]);
  for (const item of workItems) await client.query("INSERT INTO project_work_items(namespace_id,profile_id,project_id,id,run_id,finding_id,status,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [...scope, project.id, item.id, project.runId, item.findingId, item.status, item]);
}
export async function writeAssessment(client: PoolClient, session: OwnedSession, before: AssessmentState, after: AssessmentState, revision: number): Promise<void> {
  const scope = [session.namespaceId, session.profileId];
  for (const run of after.runs) {
    const previous = before.runs.find((item) => item.id === run.id);
    if (!previous) await insertRun(client, scope, run);
    else if (JSON.stringify(previous) !== JSON.stringify(run)) {
      const { findings, ...record } = run;
      await client.query("UPDATE assessment_runs SET record=$4 WHERE namespace_id=$1 AND profile_id=$2 AND id=$3", [...scope, run.id, record]);
      for (const finding of findings) if (!previous.findings.some((item) => item.id === finding.id)) await client.query("INSERT INTO assessment_findings(namespace_id,profile_id,run_id,id,record) VALUES($1,$2,$3,$4,$5)", [...scope, run.id, finding.id, finding]);
    }
  }
  for (const project of after.projects) if (!before.projects.some((item) => item.id === project.id)) await insertProject(client, scope, project);
  if (after.draft) await client.query("INSERT INTO project_drafts(namespace_id,profile_id,id,run_id,revision,record) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(namespace_id,profile_id) DO UPDATE SET id=EXCLUDED.id,run_id=EXCLUDED.run_id,revision=EXCLUDED.revision,record=EXCLUDED.record", [...scope, after.draft.id, after.draft.runId, after.draft.revision, after.draft]);
  else if (before.draft) await client.query("DELETE FROM project_drafts WHERE namespace_id=$1 AND profile_id=$2", scope);
  await client.query("UPDATE workspaces SET assessment_cursor=$3,assessment_revision=$4 WHERE namespace_id=$1 AND profile_id=$2", [...scope, assessmentCursor(after), revision]);
}
