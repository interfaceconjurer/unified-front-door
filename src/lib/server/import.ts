import "server-only";
import type { PoolClient } from "pg";
import { ApplicationError, conflict, invalid, stableJson, type ApplicationSnapshot, type ImportedSource, type ImportSummary, type LegacySource } from "../application/contracts";
import { decodeLegacy } from "../application/legacy";
import { hash, type OwnedSession } from "./session";
import { writeAssessment } from "./repository";
import { assertAssessmentLimits, assertBytes, assertCanvasCount, assertCanvasLimits, DEMO_LIMITS } from "./quota";

export async function readImportedSource(client: PoolClient, session: OwnedSession, sourceHash: string): Promise<ImportedSource> {
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) invalid("The import reference is invalid.");
  const row = (await client.query("SELECT sources.source,sources.recovery,receipts.summary,receipts.imported_at FROM legacy_import_sources sources JOIN import_receipts receipts USING(namespace_id,profile_id,source_hash) WHERE sources.namespace_id=$1 AND sources.profile_id=$2 AND sources.source_hash=$3", [session.namespaceId, session.profileId, sourceHash])).rows[0];
  if (!row) throw new ApplicationError("invalid", "This imported source is unavailable in the current workspace.", 404);
  const result: ImportedSource = { summary: { ...row.summary, importedAt: row.imported_at.toISOString() }, source: row.source, recovery: row.recovery };
  assertBytes(result, DEMO_LIMITS.importExportBytes, "Imported source export");
  return result;
}

export function importPreview(session: OwnedSession, source: LegacySource): ImportSummary {
  if (source.profileId !== session.profileId) invalid("Choose the browser source's profile before importing. No records were assigned.");
  const parsed = decodeLegacy(source);
  assertBytes(source, DEMO_LIMITS.importSourceBytes, "Browser import source");
  assertBytes(parsed.recovery, DEMO_LIMITS.importRecoveryBytes, "Browser recovery records");
  assertAssessmentLimits(parsed.assessment);
  for (const canvas of parsed.canvases) assertCanvasLimits(canvas);
  return { projects: parsed.assessment.projects.length, runs: parsed.assessment.runs.length, drafts: parsed.canvases.length + Number(!!parsed.assessment.draft), recovery: parsed.recovery.length, sourceHash: hash(stableJson(source)) };
}
export async function importLegacy(client: PoolClient, session: OwnedSession, before: ApplicationSnapshot, source: LegacySource, expectedRevision: number): Promise<ImportSummary> {
  const summary = importPreview(session, source), scope = [session.namespaceId, session.profileId];
  const previous = (await client.query("SELECT summary FROM import_receipts WHERE namespace_id=$1 AND profile_id=$2 AND source_hash=$3", [...scope, summary.sourceHash])).rows[0];
  if (previous) return previous.summary;
  if (before.assessmentRevision !== expectedRevision) conflict();
  const count = (await client.query("SELECT count(*)::int AS count FROM import_receipts WHERE namespace_id=$1 AND profile_id=$2", scope)).rows[0].count;
  if (count >= DEMO_LIMITS.imports) invalid("This demo has reached its explicit import limit. The source remains preserved in this browser.");
  const imported = decodeLegacy(source), current = before.assessment;
  for (const run of imported.assessment.runs) {
    const existing = current.runs.find((r) => r.id === run.id);
    if (existing && stableJson(existing) !== stableJson(run)) conflict("A historical run ID already contains different data. The browser source was kept.");
  }
  for (const project of imported.assessment.projects) {
    const existing = current.projects.find((p) => p.id === project.id);
    if (existing && stableJson(existing) !== stableJson(project)) conflict("A project ID already contains different data. The browser source was kept.");
  }
  for (const canvas of imported.canvases) {
    const existing = before.canvases.find((c) => c.id === canvas.id);
    if (existing && (stableJson(existing.fields) !== stableJson(canvas.fields) || stableJson(existing.target) !== stableJson(canvas.target))) conflict("A saved draft already contains different data or scope. Neither copy was replaced.");
  }
  if (imported.assessment.draft && current.draft && stableJson(current.draft) !== stableJson(imported.assessment.draft)) conflict("A different project draft is already saved. Neither copy was replaced.");
  const after = { ...(current.status === "idle" ? imported.assessment : current),
    runs: [...current.runs, ...imported.assessment.runs.filter((r) => !current.runs.some((saved) => saved.id === r.id))],
    projects: [...current.projects, ...imported.assessment.projects.filter((p) => !current.projects.some((saved) => saved.id === p.id))],
    draft: current.draft ?? imported.assessment.draft };
  assertAssessmentLimits(after);
  await assertCanvasCount(client, scope, imported.canvases.filter((canvas) => !before.canvases.some((c) => c.id === canvas.id)).length);
  await writeAssessment(client, session, current, after, before.assessmentRevision + 1);
  for (const canvas of imported.canvases) if (!before.canvases.some((saved) => saved.id === canvas.id)) {
    await client.query("INSERT INTO canvas_drafts(namespace_id,profile_id,id,surface_id,canvas,target,fields,revision,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8)", [...scope, canvas.id, canvas.surface, canvas.canvas, canvas.target, canvas.fields, { adapter: "legacy-browser", sourceHash: summary.sourceHash }]);
  }
  await client.query("INSERT INTO import_receipts(namespace_id,profile_id,source_hash,summary) VALUES($1,$2,$3,$4)", [...scope, summary.sourceHash, summary]);
  await client.query("INSERT INTO legacy_import_sources(namespace_id,profile_id,source_hash,source,recovery) VALUES($1,$2,$3,$4,$5)", [...scope, summary.sourceHash, source, JSON.stringify(imported.recovery)]);
  return summary;
}
