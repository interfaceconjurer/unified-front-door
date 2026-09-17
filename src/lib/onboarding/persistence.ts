import { INITIAL, decodeAssessment } from "../assessment/state-codec";
export { INITIAL, decodeAssessment } from "../assessment/state-codec";
import { BrowserPersistenceStore } from "../browser-persistence";
import { captureFindings, type AssessmentRun } from "../assessment/model";
import { changeWorkItemStatus, editProjectDraft, planProject, type DraftEdit, type ImprovementProject, type PlannedWorkItem, type ProjectDraftFields } from "../projects/model";
import { accessibleScope, ASSESSMENT_ORGS, ASSESSMENT_STEPS, findingsForScope } from "./assessment";

/** Legacy browser adapter retained for migration regression fixtures. Active application writes use server commands. */
import type { AssessmentState } from "../assessment/state";
export { currentFindings } from "../assessment/model";
export type { AssessmentState } from "../assessment/state";
export function parseAssessment(raw: string | null): AssessmentState {
  if (!raw) return INITIAL;
  try { const decoded = decodeAssessment(JSON.parse(raw)); return "value" in decoded ? decoded.value : INITIAL; } catch { return INITIAL; }
}
function newRun(scopeOrgIds: string[]): AssessmentRun {
  return { id: `assessment-${crypto.randomUUID()}`, startedAt: new Date().toISOString(), completedAt: null, scopeOrgIds: [...scopeOrgIds], findings: [], source: { adapter: "demo-org-assessment", version: "1" } };
}
function validTarget(id: string) { return ASSESSMENT_ORGS.some((org) => org.id === id && org.kind === "sandbox" && org.connection === "connected"); }
export class AssessmentStore extends BrowserPersistenceStore<AssessmentState> {
  constructor(profileId: string) { super(`ufd.org-assessment.v1.${profileId}`, INITIAL, decodeAssessment); }
  reset = () => { this.update(() => INITIAL, true); };
  start = () => { this.update((state) => {
    if (state.status === "paused") return accessibleScope(state.scopeOrgIds).length ? { ...state, status: "running" } : state;
    if (state.status !== "idle") return state;
    const scopeOrgIds = accessibleScope(state.scopeOrgIds);
    if (!scopeOrgIds.length) return state;
    const run = newRun(scopeOrgIds);
    return { ...state, scopeOrgIds, status: "running", currentRunId: run.id, runs: [...state.runs, run] };
  }); };
  advance = () => { this.update((state) => {
    if (state.status !== "running") return state;
    if (!accessibleScope(state.scopeOrgIds).length) return { ...state, status: "paused" };
    const step = state.step + 1, complete = step >= ASSESSMENT_STEPS.length;
    const completedAt = complete ? new Date().toISOString() : null;
    return { ...state, step, status: complete ? "complete" : "running", completedAt,
      runs: complete ? state.runs.map((run) => run.id !== state.currentRunId ? run : { ...run, completedAt, source: { adapter: "demo-org-assessment", version: "1" },
        findings: captureFindings(run.id, findingsForScope(run.scopeOrgIds), ASSESSMENT_ORGS, completedAt!) }) : state.runs };
  }); };
  pause = () => { this.update((state) => state.status === "running" ? { ...state, status: "paused" } : state); };
  rescan = (orgIds: string[]) => { const scopeOrgIds = accessibleScope(orgIds); if (!scopeOrgIds.length) return;
    this.update((state) => { const run = newRun(scopeOrgIds); return { ...state, status: "running", step: 0, scopeOrgIds, completedAt: null, currentRunId: run.id, runs: [...state.runs, run] }; }); };
  /** Begin against the observed run. A stale click cannot replace an existing draft. */
  beginDraft = (runId: string, fields: ProjectDraftFields) => { this.update((state) => {
    const run = state.runs.find((run) => run.id === runId);
    if (state.draft || !run?.completedAt) return state;
    return { ...state, draft: { ...fields, findingIds: [...fields.findingIds], id: `draft-${crypto.randomUUID()}`, runId, revision: 1 } };
  }); };
  editDraft = (draftId: string, edit: DraftEdit) => { this.update((state) => state.draft?.id === draftId ? { ...state, draft: editProjectDraft(state.draft, edit) } : state); };
  discardDraft = (draftId: string) => { this.update((state) => state.draft?.id === draftId ? { ...state, draft: null } : state); };
  createProject = (owner: string, command: { draftId: string; commandId: string; expectedRevision: number }): ImprovementProject | null => {
    let created: ImprovementProject | null = null;
    this.update((state) => {
      if (!command || typeof command.commandId !== "string" || !command.commandId.trim() || typeof command.draftId !== "string" || !command.draftId.trim() || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 1) return state;
      const previous = state.projects.find((project) => project.createCommandId === command.commandId);
      if (previous) { created = previous.sourceDraftId === command.draftId ? previous : null; return state; }
      const draft = state.draft;
      const run = state.runs.find((run) => run.id === draft?.runId);
      if (!draft || !run?.completedAt || (command.draftId !== draft.id || command.expectedRevision !== draft.revision) || !validTarget(draft.targetOrgId)) return state;
      // A finding can be planned again in another run; one run's result is allocated once.
      const findings = run.findings.filter((finding) => !state.projects.some((project) => project.runId === draft.runId && project.workItems.some((item) => item.findingId === finding.id)));
      created = planProject(draft, findings, owner, command.commandId, new Date().toISOString(), `org-improvement-${crypto.randomUUID()}`, run.scopeOrgIds);
      return created ? { ...state, draft: null, projects: [...state.projects, created] } : state;
    }); return created;
  };
  setWorkItemStatus = (projectId: string, itemId: string, status: PlannedWorkItem["status"]) => { this.update((state) => ({ ...state,
    projects: state.projects.map((project) => project.id === projectId ? changeWorkItemStatus(project, itemId, status) : project) })); };
}
