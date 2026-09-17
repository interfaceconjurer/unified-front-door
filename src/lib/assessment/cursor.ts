import type { AssessmentState } from "./state";
export function assessmentCursor(state: AssessmentState) {
  return { schemaVersion: state.schemaVersion, status: state.status, step: state.step, scopeOrgIds: state.scopeOrgIds, completedAt: state.completedAt, currentRunId: state.currentRunId };
}
