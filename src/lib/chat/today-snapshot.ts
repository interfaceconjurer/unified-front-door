import type { DemoProfile } from "../demo-profiles";
import { currentFindings, type FindingSnapshot } from "../assessment/model";
import type { AssessmentState } from "../assessment/state";
import type { ProjectDraft } from "../projects/model";
import type { ReturningWork } from "../workspace/returning-work";
import { assessmentForOrg } from "../assessment/selected-org";
export const BRIEFING_LIMITS = { findings: 20, projects: 12, workReferences: 100, text: 2000, entries: 12, recent: 12 } as const;
export type ProjectSummary = { id: string; name: string; runId: string | null; targetOrgId: string | null; findingIds: string[]; workItemCount: number; completedCount: number };
export type AssessmentBriefing = Pick<AssessmentState, "status" | "step" | "completedAt" | "currentRunId"> & {
  scopeOrgIds: string[]; draft: ProjectDraft | null; findings: FindingSnapshot[]; projects: ProjectSummary[];
  totalFindings: number; totalProjects: number; findingsAvailable: boolean; truncated: boolean;
};
function limiter() {
  let truncated = false;
  return { text(value: string, length: number = BRIEFING_LIMITS.text) { if (value.length > length) truncated = true; return value.slice(0, length); },
    list<T>(value: readonly T[], length: number): readonly T[] { if (value.length > length) truncated = true; return value.slice(0, length); },
    get truncated() { return truncated; } };
}
function boundedFinding(finding: FindingSnapshot, bound: ReturnType<typeof limiter>): FindingSnapshot {
  // Select bounded display fields before allocating; stable identity keys are never shortened.
  return { id: finding.id, runId: finding.runId, sourceFindingId: finding.sourceFindingId, orgId: finding.orgId,
    orgLabel: bound.text(finding.orgLabel), capturedAt: finding.capturedAt, category: finding.category, priority: finding.priority,
    title: bound.text(finding.title), summary: bound.text(finding.summary), metric: bound.text(finding.metric), metricLabel: bound.text(finding.metricLabel),
    effort: bound.text(finding.effort), impact: bound.text(finding.impact), source: bound.text(finding.source), hypothesis: bound.text(finding.hypothesis), validation: bound.text(finding.validation),
    evidence: bound.list(finding.evidence, BRIEFING_LIMITS.entries).map((text) => bound.text(text)), steps: bound.list(finding.steps, BRIEFING_LIMITS.entries).map((text) => bound.text(text)),
    provenance: { adapter: bound.text(finding.provenance.adapter), version: bound.text(finding.provenance.version), evidence: finding.provenance.evidence } };
}
/** Live controls use complete current data; history-only limits never hide actionable work. */
export function liveAssessmentView(state: AssessmentState): AssessmentBriefing {
  const findings = currentFindings(state);
  return { status: state.status, step: state.step, completedAt: state.completedAt, currentRunId: state.currentRunId,
    scopeOrgIds: state.scopeOrgIds, draft: state.draft, findings,
    projects: state.projects.map((project) => ({ id: project.id, name: project.name, runId: project.runId, targetOrgId: project.targetOrgId,
      findingIds: project.workItems.map((item) => item.findingId), workItemCount: project.workItems.length,
      completedCount: project.workItems.filter((item) => item.status === "done").length })),
    totalFindings: findings.length, totalProjects: state.projects.length, findingsAvailable: state.runs.find((run) => run.id === state.currentRunId)?.source.adapter !== "legacy-browser", truncated: false };
}

const cache = new WeakMap<AssessmentState, AssessmentBriefing>();
/** Bounded display arrays/text; full identity keys retained. No accumulated run/project payload copies. */
export function assessmentBriefing(state: AssessmentState): AssessmentBriefing {
  const previous = cache.get(state); if (previous) return previous;
  const bound = limiter();
  const findings = currentFindings(state);
  const draft = state.draft;
  const result: AssessmentBriefing = {
    status: state.status, step: state.step, completedAt: state.completedAt, currentRunId: state.currentRunId,
    scopeOrgIds: [...bound.list(state.scopeOrgIds, BRIEFING_LIMITS.entries)],
    draft: draft ? { id: draft.id, runId: draft.runId, revision: draft.revision, targetOrgId: draft.targetOrgId,
      name: bound.text(draft.name, 100), goal: bound.text(draft.goal, 1500), findingIds: [...bound.list(draft.findingIds, BRIEFING_LIMITS.workReferences)] } : null,
    findings: bound.list(findings, BRIEFING_LIMITS.findings).map((finding) => boundedFinding(finding, bound)),
    projects: bound.list(state.projects.slice(-BRIEFING_LIMITS.projects), BRIEFING_LIMITS.projects).map((project) => ({ id: project.id, name: bound.text(project.name, 100), runId: project.runId, targetOrgId: project.targetOrgId,
      findingIds: bound.list(project.workItems, BRIEFING_LIMITS.workReferences).map((item) => item.findingId), workItemCount: project.workItems.length,
      completedCount: project.workItems.filter((item) => item.status === "done").length })),
    totalFindings: findings.length, totalProjects: state.projects.length, findingsAvailable: state.runs.find((run) => run.id === state.currentRunId)?.source.adapter !== "legacy-browser", truncated: false,
  };
  result.truncated = bound.truncated || state.projects.length > BRIEFING_LIMITS.projects;
  cache.set(state, result); return result;
}
export type TodaySnapshot = { capturedAt: string; profile: DemoProfile; projectName: string; branch: string; scope?: "global";
  hasProjects: boolean; recent: readonly ReturningWork[]; totalRecent: number; truncated: boolean; working: number; assessment: AssessmentBriefing };
export function captureToday(input: Omit<TodaySnapshot, "assessment" | "totalRecent" | "truncated"> & { assessment: AssessmentState; orgId?: string | null }): TodaySnapshot {
  const bound = limiter(), profile = input.profile;
  const result = { capturedAt: input.capturedAt, hasProjects: input.hasProjects, working: input.working,
    ...(input.scope ? { scope: input.scope } : {}),
    profile: { ...profile, name: bound.text(profile.name, 100), firstName: bound.text(profile.firstName, 100), initials: bound.text(profile.initials, 10), role: bound.text(profile.role, 100), surfaceAccess: [...profile.surfaceAccess] },
    projectName: bound.text(input.projectName, 100), branch: bound.text(input.branch, 200),
    recent: bound.list(input.recent, BRIEFING_LIMITS.recent).map((work) => ({ id: work.id, projectId: work.projectId, worktreeId: work.worktreeId, surfaceId: work.surfaceId,
      ...(work.projectName ? { projectName: bound.text(work.projectName, 100) } : {}), ...(work.branch ? { branch: bound.text(work.branch, 200) } : {}),
      title: bound.text(work.title), summary: bound.text(work.summary), updated: bound.text(work.updated), status: work.status, statusLabel: bound.text(work.statusLabel), kind: bound.text(work.kind), attention: work.attention,
      details: [], activity: [] })), totalRecent: input.recent.length, assessment: assessmentBriefing(!profile.onboarding || input.orgId === undefined ? input.assessment : assessmentForOrg(input.assessment, input.orgId)), truncated: false };
  result.truncated = bound.truncated; return result;
}
