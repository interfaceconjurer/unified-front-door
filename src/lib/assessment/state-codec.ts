import type { Decoded } from "../browser-persistence";
import type { AssessmentState } from "./state";
import type { AssessmentRun } from "./model";
import { date, legacyFinding, parseRun, record, strings } from "./codec";
import { parseDraft, parseProject } from "../projects/codec";
import type { ImprovementProject } from "../projects/model";
import { accessibleScope, ASSESSMENT_ORGS, ASSESSMENT_STEPS } from "../onboarding/assessment";

export const INITIAL: AssessmentState = { schemaVersion: 2, status: "idle", step: 0,
  scopeOrgIds: accessibleScope(ASSESSMENT_ORGS.map((org) => org.id)), completedAt: null,
  draft: null, projects: [], runs: [], currentRunId: null };
export function decodeAssessment(value: unknown): Decoded<AssessmentState> {
  if (!record(value) || !["status", "scopeOrgIds", "projects", "draft"].some((key) => key in value)) return { error: "invalid" };
  if ("schemaVersion" in value && value.schemaVersion !== 2) return { error: "unsupported" };
  const legacy = value.schemaVersion === undefined;
  const projects = Array.isArray(value.projects) ? value.projects.map((project) => parseProject(project, legacy)) : [];
  if (projects.some((project) => !project)) return { error: "invalid" };
  const scopeOrgIds = strings(value.scopeOrgIds);
  const status = ["idle", "running", "paused", "complete"].includes(String(value.status)) ? value.status as AssessmentState["status"] : "idle";
  const completedAt = date(value.completedAt) ? value.completedAt : null;
  const runs = legacy ? [] : Array.isArray(value.runs) ? value.runs.map(parseRun) : [];
  if (runs.some((run) => !run)) return { error: "invalid" };
  if (legacy) for (const project of projects) if (project) runs.push({ id: project.runId, startedAt: null, completedAt: null, scopeOrgIds: [...project.scopeOrgIds], findings: project.workItems.map((item) => structuredClone(item.finding)), source: { adapter: "legacy-browser", version: "1" } });
  let currentRunId = typeof value.currentRunId === "string" ? value.currentRunId : null;
  if (legacy && status !== "idle") {
    currentRunId = `legacy-assessment:${completedAt ?? "unfinished"}`;
    const ids = record(value.draft) ? strings(value.draft.findingIds) : [];
    runs.push({ id: currentRunId, startedAt: null, completedAt, scopeOrgIds,
      findings: ids.map((id) => legacyFinding(id, id, "Unknown", currentRunId!)), source: { adapter: "legacy-browser", version: "1" } });
  }
  let draft = value.draft == null ? null : parseDraft(value.draft, currentRunId ?? "unbound", legacy);
  if (legacy && draft) draft = { ...draft, findingIds: draft.findingIds.map((id) => JSON.stringify([draft!.runId, id])) };
  if (value.draft != null && !draft) return { error: "invalid" };
  if (new Set(projects.map((project) => project?.id)).size !== projects.length || new Set(runs.map((run) => run?.id)).size !== runs.length) return { error: "invalid" };
  if (draft && draft.runId !== "unbound" && !runs.some((run) => run?.id === draft.runId)) return { error: "invalid" };
  if (projects.some((project) => !runs.some((run) => run?.id === project?.runId))) return { error: "invalid" };
  if (currentRunId && !runs.some((run) => run?.id === currentRunId)) return { error: "invalid" };
  return { value: { schemaVersion: 2, status, step: status === "complete" ? ASSESSMENT_STEPS.length : typeof value.step === "number" && Number.isInteger(value.step) ? Math.max(0, Math.min(value.step, ASSESSMENT_STEPS.length - 1)) : 0,
    scopeOrgIds, completedAt, draft, projects: projects as ImprovementProject[], runs: runs as AssessmentRun[], currentRunId } };
}
