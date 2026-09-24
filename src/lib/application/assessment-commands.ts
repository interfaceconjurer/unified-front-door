import type { AssessmentState } from "../assessment/state";
import { captureFindings, type AssessmentRun } from "../assessment/model";
import { changeWorkItemStatus, editProjectDraft, planProject } from "../projects/model";
import { ASSESSMENT_ORGS, ASSESSMENT_STEPS, accessibleScope, findingsForScope } from "../onboarding/assessment";
import { conflict, invalid, type ApplicationCommand } from "./contracts";

/** Domain transitions shared by the authoritative server and the local pending-edit projection. */
export function applyAssessmentCommand(state: AssessmentState, command: ApplicationCommand, context: { id: () => string; now: string; owner: string }): AssessmentState {
  const newRun = (scopeOrgIds: string[]): AssessmentRun => ({ id: `assessment-${context.id()}`, startedAt: context.now, completedAt: null, scopeOrgIds, findings: [], source: { adapter: "demo-org-assessment", version: "1" } });
  switch (command.kind) {
    case "assessment.start": {
      if (command.orgId && state.status !== "idle" && !state.scopeOrgIds.includes(command.orgId)) conflict("An assessment for another org is already selected.");
      if (state.status === "paused") return accessibleScope(state.scopeOrgIds).length ? { ...state, status: "running" } : state;
      if (state.status !== "idle") return state;
      const scopeOrgIds = accessibleScope(command.orgId ? [command.orgId] : []); if (!scopeOrgIds.length) invalid("Choose a connected org to assess.");
      const run = newRun(scopeOrgIds);
      return { ...state, scopeOrgIds, status: "running", currentRunId: run.id, runs: [...state.runs, run] };
    }
    case "assessment.advance": {
      if (state.status !== "running") return state;
      if (!accessibleScope(state.scopeOrgIds).length) return { ...state, status: "paused" };
      const step = state.step + 1, complete = step >= ASSESSMENT_STEPS.length, completedAt = complete ? context.now : null;
      return { ...state, step, status: complete ? "complete" : "running", completedAt,
        runs: complete ? state.runs.map((run) => run.id === state.currentRunId ? { ...run, completedAt, source: { adapter: "demo-org-assessment", version: "1" }, findings: captureFindings(run.id, findingsForScope(run.scopeOrgIds), ASSESSMENT_ORGS, context.now) } : run) : state.runs };
    }
    case "assessment.pause": return state.status === "running" ? { ...state, status: "paused" } : state;
    case "assessment.rescan": {
      const scopeOrgIds = accessibleScope(command.orgIds); if (command.orgIds.length !== 1 || scopeOrgIds.length !== 1) invalid("Choose one connected org to assess.");
      const run = newRun(scopeOrgIds); return { ...state, status: "running", step: 0, scopeOrgIds, completedAt: null, currentRunId: run.id, runs: [...state.runs, run] };
    }
    case "draft.begin": {
      const run = state.runs.find((r) => r.id === command.runId); if (state.draft) conflict("Finish or discard the current project draft first.");
      if (!run?.completedAt || !command.fields.findingIds.every((id) => run.findings.some((f) => f.id === id))) invalid("The selected findings do not belong to this completed run.");
      return { ...state, draft: { ...command.fields, id: `draft-${context.id()}`, runId: run.id, revision: 1 } };
    }
    case "draft.edit": {
      if (state.draft?.id !== command.draftId) conflict("The project draft changed.");
      if (command.edit.field === "finding" && !state.runs.find((r) => r.id === state.draft?.runId)?.findings.some((f) => f.id === (command.edit as { id: string }).id)) invalid();
      return { ...state, draft: editProjectDraft(state.draft, command.edit) };
    }
    case "draft.discard": if (state.draft?.id !== command.draftId) conflict("The project draft changed."); return { ...state, draft: null };
    case "project.create": {
      const draft = state.draft, run = state.runs.find((r) => r.id === draft?.runId);
      if (!draft || draft.id !== command.draftId || draft.revision !== command.draftRevision) conflict("The project draft changed. Review the latest fields.");
      if (!run?.completedAt || draft.targetOrgId && !ASSESSMENT_ORGS.some((org) => org.id === draft.targetOrgId && org.connection === "connected")) invalid("The deployment target or source run is unavailable.");
      const findings = run.findings.filter((f) => !state.projects.some((p) => p.runId === run.id && p.workItems.some((i) => i.findingId === f.id)));
      const project = planProject(draft, findings, context.owner, command.commandId, context.now, `org-improvement-${context.id()}`, run.scopeOrgIds);
      if (!project) conflict("Selected findings are already allocated or the project is incomplete.");
      return { ...state, draft: null, projects: [...state.projects, project] };
    }
    case "work.status": {
      const project = state.projects.find((p) => p.id === command.projectId);
      if (!project?.workItems.some((item) => item.id === command.itemId)) invalid("This work item is unavailable in your workspace.");
      return { ...state, projects: state.projects.map((p) => p.id === command.projectId ? changeWorkItemStatus(p, command.itemId, command.status) : p) };
    }
    default: invalid("This is not an assessment command.");
  }
}
