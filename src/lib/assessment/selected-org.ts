import { ASSESSMENT_STEPS } from "../onboarding/assessment";
import type { AssessmentState } from "./state";

/** Today follows the connection; saved runs and project evidence keep their original scope. */
export function assessmentForOrg(state: AssessmentState, orgId: string | null): AssessmentState {
  const matching = orgId ? state.runs.filter(run => run.scopeOrgIds.includes(orgId)) : [];
  // Imported runs may have no startedAt and sort after newer runs in storage.
  const run = matching.find(run => run.id === state.currentRunId)
    ?? matching.filter(run => run.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0];
  const current = run?.id === state.currentRunId;
  return { ...state, scopeOrgIds: orgId ? [orgId] : [], currentRunId: run?.id ?? null,
    status: run?.completedAt ? "complete" : current ? state.status : "idle",
    step: run?.completedAt ? ASSESSMENT_STEPS.length : current ? state.step : 0,
    completedAt: run?.completedAt ?? null,
    runs: run ? [{ ...run, findings: run.findings.filter(finding => finding.orgId === orgId) }] : [] };
}
