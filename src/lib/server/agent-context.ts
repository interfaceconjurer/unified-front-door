import "server-only";
import { assessmentForOrg } from "../assessment/selected-org";
import type { PoolClient } from "pg";
import { canvasId, canvasTarget, canvasVisibleInWorkspace } from "../surface-canvas/model";
import type { AgentContext, CapturedContext } from "../agent/contracts";
import { invalid } from "../application/contracts";
import { demoProfileById } from "../demo-profiles";
import { ASSESSMENT_ORGS, workspaceProject } from "../onboarding/assessment";
import { ORGS } from "../workspace/fixtures";
import { projectsForProfile } from "../workspace/demo-workspace";
import { resolveWorkspace } from "../workspace/context";
import { readWorkspace } from "./repository";
import type { OwnedSession } from "./session";
import { projectBriefForContext } from "../projects/brief-context";

/** Only authenticated server records/fixtures contribute execution context. */
export async function captureAgentContext(client: PoolClient, session: OwnedSession, input: AgentContext) {
  if (input.target.projectId) await client.query("SELECT id FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR SHARE", [session.namespaceId, session.profileId, input.target.projectId]);
  const workspace = await readWorkspace(client, session), profile = demoProfileById(session.profileId!);
  const projects = [...(projectsForProfile(profile.id)), ...workspace.assessment.projects.map(workspaceProject)];
  const orgs = profile.onboarding ? ASSESSMENT_ORGS : ORGS;
  const resolved = resolveWorkspace(input.target, projects, orgs);
  if (resolved.status === "unavailable" || input.surface !== "home" && !profile.surfaceAccess.includes(input.surface)) invalid("The selected context is unavailable for this demo profile.");
  let permissions: CapturedContext["permissions"];
  if (input.canvas) {
    const target = canvasTarget(input.canvas, input.target);
    if (!canvasVisibleInWorkspace(input.canvas, input.target) || resolveWorkspace(target, projects, orgs).status === "unavailable") invalid("The permissions canvas is unavailable in this workspace.");
    const saved = workspace.canvases.find(draft => draft.id === canvasId(input.canvas!.kind, input.canvas!.params));
    permissions = { fields: saved?.fields ?? {}, revision: saved?.revision ?? 0 };
  }
  const { project, worktree, org } = resolved;
  const improvement = workspace.assessment.projects.find(p => p.id === project?.id) ?? null;
  const returningSession = project?.agentSessions.find(s => s.worktreeId === (worktree?.id ?? null));
  const selectedAssessment = assessmentForOrg(workspace.assessment, input.target.orgId);
  const assessmentRun = profile.onboarding ? workspace.assessment.runs.find(run => run.id === (improvement ? improvement.runId : selectedAssessment.currentRunId)) : undefined;
  const context: CapturedContext = {
    ...input, ...(permissions ? { permissions } : {}), profile, capturedAt: new Date().toISOString(), threadKey: resolved.sessionKey,
    projectName: project?.name ?? "No project selected", branch: worktree?.branch ?? (improvement ? "Planning" : ""),
    worktreeLabel: (project?.worktrees.length ?? 0) > 1 ? worktree?.label ?? null : null,
    orgLabel: org?.label ?? null, hasProjects: projects.length > 0, improvement,
    projectBrief: projectBriefForContext(workspace, input.target, input.surface),
    ...(assessmentRun ? { assessmentNavigation: { runId: assessmentRun.id,
      findings: assessmentRun.findings.filter(finding => improvement ? improvement.workItems.some(item => item.findingId === finding.id) : !input.target.orgId || finding.orgId === input.target.orgId)
        .slice(0, 32).map(finding => ({ id: finding.id, title: `${finding.title} · ${finding.orgLabel}` })) } } : {}),
    greeting: improvement?.source === "brief" ? `“${improvement.name}” is ready. Goal: ${improvement.goal}` : improvement ? `“${improvement.name}” has ${improvement.workItems.length} planned work items. Each includes the source finding, implementation steps, and acceptance criteria. Start by reviewing a plan, then develop and review changes in your project before deployment.`
      : profile.onboarding ? selectedAssessment.status === "complete" ? `Your demo assessment found ${selectedAssessment.runs[0]?.findings.length ?? 0} opportunities. Return home to review the evidence and turn selected findings into a project.` : selectedAssessment.status === "idle" ? "Run an assessment of the connected org from Today to discover opportunities." : "Your demo assessment reviews the selected org for capacity, process friction, and release readiness. You can follow its progress on Today."
      : returningSession?.summary ?? null,
  };
  return { context, workspace, project, worktree, projects };
}
