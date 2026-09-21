import type { AssessmentState } from "../assessment/state";
import type { CanvasSpecInput, CapabilityScope } from "../surface-canvas/model";

export function projectCreationCanvas(scope: CapabilityScope): CanvasSpecInput {
  return { kind: "capability", title: "Start a project", params: { ...scope, surface: "alm", capability: "project" } };
}

/** Project review owns its source run; Today is free to show the latest assessment. */
export function projectDraftView(state: AssessmentState) {
  const draft = state.draft;
  const run = state.runs.find(run => run.id === draft?.runId) ?? null;
  const findings = run?.findings.filter(finding => !state.projects.some(project => project.workItems.some(item => item.findingId === finding.id))) ?? [];
  return { draft, run, findings, sourceAvailable: !!run?.completedAt && !!draft && draft.findingIds.every(id => findings.some(finding => finding.id === id)) };
}
