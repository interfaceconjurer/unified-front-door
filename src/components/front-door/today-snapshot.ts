import type { DemoProfile } from "@/lib/demo-profiles";
import type { AssessmentState } from "@/lib/onboarding/persistence";
import type { ReturningWork } from "@/lib/workspace/returning-work";

/** Data captured with a briefing, independent of subsequent workspace changes. */
export type TodaySnapshot = {
  capturedAt: string;
  profile: DemoProfile;
  projectName: string;
  branch: string;
  hasProjects: boolean;
  recent: readonly ReturningWork[];
  working: number;
  assessment: AssessmentState;
};
