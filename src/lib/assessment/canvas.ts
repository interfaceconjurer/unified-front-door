import type { CanvasOf, CanvasSpecInput, CapabilityScope } from "../surface-canvas/model";
import type { AssessmentState } from "./state";

export function assessmentCanvas(scope: CapabilityScope, runId?: string | null, finding?: { id: string; title: string }): CanvasSpecInput {
  const captured: CapabilityScope = scope.scope === "project"
    ? { scope: "project", projectId: scope.projectId, ...(scope.worktreeId ? { worktreeId: scope.worktreeId } : {}), ...(scope.orgId ? { orgId: scope.orgId } : {}) }
    : { scope: "unbound", ...(scope.orgId ? { orgId: scope.orgId } : {}) };
  return { kind: "org-assessment", title: finding?.title ?? "Org assessment", params: {
    ...captured, ...(runId ? { runId } : {}), ...(finding ? { findingId: finding.id } : {}),
  } };
}

/** An explicit run never falls forward to newer evidence after a rescan. */
export function assessmentCanvasView(params: CanvasOf<"org-assessment">["params"], state: AssessmentState) {
  const runId = params.runId ?? state.currentRunId;
  const run = state.runs.find(run => run.id === runId) ?? null;
  if (runId && !run) return { kind: "unavailable" as const, reason: "This assessment run is no longer available in your workspace." };
  const finding = params.findingId ? run?.findings.find(finding => finding.id === params.findingId && finding.runId === run.id) : null;
  if (params.findingId && !finding) return { kind: "unavailable" as const, reason: "This finding was not captured in this assessment run." };
  const current = run ? run.id === state.currentRunId : !state.currentRunId;
  return { kind: "available" as const, run, finding: finding ?? null, current,
    status: run?.completedAt ? "complete" : current ? state.status : "incomplete",
    scopeOrgIds: run?.scopeOrgIds ?? state.scopeOrgIds };
}
