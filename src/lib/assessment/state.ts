import type { AssessmentRun } from "./model";
import type { ImprovementProject, ProjectDraft } from "../projects/model";
export type AssessmentState = {
  schemaVersion: 2; status: "idle" | "running" | "paused" | "complete"; step: number;
  scopeOrgIds: string[]; completedAt: string | null; draft: ProjectDraft | null;
  projects: ImprovementProject[]; runs: AssessmentRun[]; currentRunId: string | null;
};
