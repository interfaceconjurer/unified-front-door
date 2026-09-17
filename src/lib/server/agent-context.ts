import "server-only";
import type { PoolClient } from "pg";
import type { AgentContext, CapturedContext } from "../agent/contracts";
import { invalid } from "../application/contracts";
import { demoProfileById } from "../demo-profiles";
import { ASSESSMENT_ORGS, workspaceProject } from "../onboarding/assessment";
import { ORGS, PROJECTS } from "../workspace/fixtures";
import { resolveWorkspace } from "../workspace/context";
import { readWorkspace } from "./repository";
import type { OwnedSession } from "./session";

/** Only authenticated server records/fixtures contribute execution context. */
export async function captureAgentContext(client: PoolClient, session: OwnedSession, input: AgentContext) {
  if (input.target.projectId) await client.query("SELECT id FROM improvement_projects WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR SHARE", [session.namespaceId, session.profileId, input.target.projectId]);
  const workspace = await readWorkspace(client, session), profile = demoProfileById(session.profileId!);
  const projects = profile.onboarding ? workspace.assessment.projects.map(workspaceProject) : profile.workspaceExperience === "established" ? PROJECTS : [];
  const orgs = profile.onboarding ? ASSESSMENT_ORGS : ORGS;
  const resolved = resolveWorkspace(input.target, projects, orgs);
  if (resolved.status === "unavailable" || input.surface !== "home" && !profile.surfaceAccess.includes(input.surface)) invalid("The selected context is unavailable for this demo profile.");
  const { project, worktree, org } = resolved;
  const improvement = workspace.assessment.projects.find(p => p.id === project?.id) ?? null;
  const returningSession = project?.agentSessions.find(s => s.worktreeId === worktree?.id);
  const context: CapturedContext = {
    ...input, profile, capturedAt: new Date().toISOString(), threadKey: resolved.sessionKey,
    projectName: project?.name ?? "No project selected", branch: worktree?.branch ?? (project ? "Planning" : "No project selected"),
    worktreeLabel: (project?.worktrees.length ?? 0) > 1 ? worktree?.label ?? null : null,
    orgLabel: org?.label ?? null, hasProjects: projects.length > 0, improvement,
    greeting: improvement ? `“${improvement.name}” has ${improvement.workItems.length} planned work items. Each includes the source finding, implementation steps, and acceptance criteria. Start by reviewing a plan and confirming the baseline in a sandbox.`
      : profile.onboarding ? workspace.assessment.status === "complete" ? `Your demo assessment found ${workspace.assessment.runs.find(r => r.id === workspace.assessment.currentRunId)?.findings.length ?? 0} opportunities. Return home to review the evidence and turn selected findings into a project.` : "Your demo assessment is underway. It reviews the selected accessible orgs for capacity, process friction, and release readiness. You can follow its progress on the home screen."
      : returningSession?.summary ?? null,
  };
  return { context, workspace, project, worktree };
}
