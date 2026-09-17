import "server-only";
import type { PoolClient } from "pg";
import type { AssessmentState } from "../assessment/state";
import { assessmentCursor } from "../assessment/cursor";
import { invalid, type SavedCanvas } from "../application/contracts";

/** Explicit demo ceilings. Client rendering is paged; snapshot reads remain bounded by these byte/count limits. */
export const DEMO_LIMITS = {
  runs: 64, findings: 512, projects: 64, workItems: 512, canvases: 64,
  cursorBytes: 8192, projectDraftBytes: 16384, runBytes: 4096, findingBytes: 8192,
  projectBytes: 8192, workItemBytes: 9216, canvasIdentityBytes: 4096, canvasFieldsBytes: 65536,
  importSourceBytes: 4500000, importRecoveryBytes: 4500000, imports: 16,
  importExportBytes: 9001024,
  receiptBytes: 6 * 1024 * 1024, snapshotBytes: 16 * 1024 * 1024,
} as const;
export function assertBytes(value: unknown, maximum: number, label: string): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximum) invalid(`${label} exceeds this demo's supported size. Nothing was replaced; export the pending data to preserve it.`);
}
function assertCount(actual: number, maximum: number, label: string) { if (actual > maximum) invalid(`${label} exceeds this demo's capacity. Nothing was deleted or replaced.`); }
export function assertAssessmentLimits(state: AssessmentState): void {
  assertCount(state.runs.length, DEMO_LIMITS.runs, "Assessment history");
  assertCount(state.runs.reduce((n, r) => n + r.findings.length, 0), DEMO_LIMITS.findings, "Captured findings");
  assertCount(state.projects.length, DEMO_LIMITS.projects, "Saved projects");
  assertCount(state.projects.reduce((n, p) => n + p.workItems.length, 0), DEMO_LIMITS.workItems, "Project work items");
  assertBytes(assessmentCursor(state), DEMO_LIMITS.cursorBytes, "Assessment scope");
  assertBytes(state.draft, DEMO_LIMITS.projectDraftBytes, "Project draft");
  for (const run of state.runs) { assertBytes({ ...run, findings: undefined }, DEMO_LIMITS.runBytes, "Assessment run"); for (const finding of run.findings) assertBytes(finding, DEMO_LIMITS.findingBytes, "Captured finding"); }
  for (const project of state.projects) { assertBytes({ ...project, workItems: undefined }, DEMO_LIMITS.projectBytes, "Project metadata"); for (const item of project.workItems) assertBytes(item, DEMO_LIMITS.workItemBytes, "Work item evidence"); }
}
export function assertCanvasLimits(canvas: Pick<SavedCanvas, "id" | "canvas" | "target" | "fields">): void {
  assertBytes({ id: canvas.id, canvas: canvas.canvas, target: canvas.target }, DEMO_LIMITS.canvasIdentityBytes, "Draft identity");
  assertBytes(canvas.fields, DEMO_LIMITS.canvasFieldsBytes, "Draft content");
}
export async function lockCanvasQuota(client: PoolClient, scope: (string | null)[]): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([...scope, "canvas-capacity"])]);
}
export async function assertCanvasCount(client: PoolClient, scope: (string | null)[], additions: number): Promise<void> {
  const row = (await client.query("SELECT count(*)::int AS count FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0];
  assertCount(row.count + additions, DEMO_LIMITS.canvases, "Saved drafts");
}
