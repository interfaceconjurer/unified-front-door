import { legacyFinding, type AssessmentRun, type FindingSnapshot } from "./model";
export function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []; }
export function date(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
export function parseFinding(value: unknown): FindingSnapshot | null {
  if (!record(value) || !["id", "runId", "sourceFindingId", "orgId", "orgLabel", "title", "summary", "metric", "metricLabel", "effort", "impact", "source", "hypothesis", "validation"].every((key) => typeof value[key] === "string") ||
    !["High", "Medium", "Unknown"].includes(String(value.priority)) || !["Limits", "Automation", "Release readiness", "Unknown"].includes(String(value.category)) ||
    !record(value.provenance) || typeof value.provenance.adapter !== "string" || typeof value.provenance.version !== "string" || !["captured", "legacy-unavailable"].includes(String(value.provenance.evidence)) ||
    !(value.capturedAt === null || date(value.capturedAt)) || !Array.isArray(value.evidence) || !Array.isArray(value.steps)) return null;
  const fields = ["id", "runId", "sourceFindingId", "orgId", "orgLabel", "title", "summary", "metric", "metricLabel", "effort", "impact", "source", "hypothesis", "validation", "priority", "category", "capturedAt"];
  if (strings(value.evidence).length !== value.evidence.length || strings(value.steps).length !== value.steps.length) return null;
  return { ...Object.fromEntries(fields.map((key) => [key, value[key]])), evidence: strings(value.evidence), steps: strings(value.steps),
    provenance: { adapter: value.provenance.adapter, version: value.provenance.version, evidence: value.provenance.evidence } } as unknown as FindingSnapshot;
}
export function parseRun(value: unknown): AssessmentRun | null {
  if (!record(value) || typeof value.id !== "string" || !Array.isArray(value.findings) || !record(value.source) || typeof value.source.adapter !== "string" || typeof value.source.version !== "string" || !(value.startedAt === null || date(value.startedAt)) || !(value.completedAt === null || date(value.completedAt))) return null;
  const findings = value.findings.map(parseFinding);
  if (findings.some((finding) => !finding || finding.runId !== value.id) || new Set(findings.map((finding) => finding?.id)).size !== findings.length) return null;
  return { id: value.id, startedAt: value.startedAt, completedAt: value.completedAt, scopeOrgIds: strings(value.scopeOrgIds), findings: findings as FindingSnapshot[], source: { adapter: value.source.adapter, version: value.source.version } };
}
export { legacyFinding };
