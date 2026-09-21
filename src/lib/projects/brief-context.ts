import type { ApplicationSnapshot } from "../application/contracts";
import type { WorkspaceTarget } from "../workspace/context";
import { projectTemplate, type ProjectType } from "./templates";

export type ProjectBriefContext = {
  id: string; revision: number; source: "assessment-draft" | "planning-brief";
  name: string; projectType: ProjectType; goal: string; context: string; repository?: string;
};

/** Only the saved brief in the current planning context is sent to the agent. */
export function projectBriefForContext(workspace: Pick<ApplicationSnapshot, "assessment" | "canvases">, target: WorkspaceTarget, surface: string): ProjectBriefContext | undefined {
  if (surface !== "alm") return;
  const draft = workspace.assessment.draft;
  if (!target.projectId && draft && draft.targetOrgId === target.orgId) return {
    id: draft.id, revision: draft.revision, source: "assessment-draft", name: draft.name,
    projectType: projectTemplate(draft.projectType).id, goal: draft.goal, context: draft.context ?? "",
  };
  const saved = workspace.canvases.find(item => item.canvas.kind === "capability" && item.canvas.params.capability === "project"
    && item.surface === "alm" && item.target.projectId === target.projectId && item.target.worktreeId === target.worktreeId && item.target.orgId === target.orgId);
  if (!saved) return;
  return { id: saved.id, revision: saved.revision, source: "planning-brief", name: saved.fields.name ?? "",
    projectType: projectTemplate(saved.fields.projectType).id, goal: saved.fields.goal ?? "", context: saved.fields.context ?? "",
    ...(saved.fields.repository ? { repository: saved.fields.repository } : {}),
  };
}
