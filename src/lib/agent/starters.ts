import type { DemoProfile } from "../demo-profiles";
import { capabilityForCanvas } from "../surface-canvas/capabilities";
import type { CanvasSpecInput, CapabilityScope } from "../surface-canvas/model";
import type { SurfaceId } from "../workspace/surfaces";

export const STARTER_PROMPTS = [
  "Help me start my first project. Walk me through defining its goal, creating and prioritizing work items, and choosing the first task to work on.",
  "Help me build an agent that qualifies and routes leads. Walk me through defining its instructions, connecting data, and trying it out.",
  "Help me build a React app for browsing and searching Salesforce accounts. Walk me through the app structure, connecting Salesforce data, and adding tests.",
  "Help me set up my first release pipeline. Walk me through connecting a repository, validating changes in a sandbox, and adding a production approval step.",
] as const;
export const EXISTING_PROJECT_PROMPT = "Help me get started with an existing Salesforce source project. Walk me through connecting my repository and a development org, then exploring the codebase.";
const EXPERIENCE_PROMPT = "Help me build an app experience for browsing and searching Salesforce accounts. Walk me through the pages, connecting Salesforce data, and checking how it works.";

export type StarterId = "project" | "agent" | "app" | "pipeline" | "existing-project";
export type Starter = {
  id: StarterId;
  title: string;
  description: string;
  surfaceId: SurfaceId;
  capabilityId: string;
  prompt: string;
};

const STARTERS: readonly Starter[] = [
  {
    id: "project", title: "Start your first project",
    description: "Define your goal and outline the work to get started.",
    surfaceId: "alm", capabilityId: "project", prompt: STARTER_PROMPTS[0],
  },
  {
    id: "agent", title: "Build your first agent",
    description: "Give an agent a job to do, connect your data, and try it out.",
    surfaceId: "build", capabilityId: "agent", prompt: STARTER_PROMPTS[1],
  },
  {
    id: "app", title: "Build a React app",
    description: "Create a custom app with React, connected to your Salesforce data.",
    surfaceId: "code", capabilityId: "react-app", prompt: STARTER_PROMPTS[2],
  },
  {
    id: "pipeline", title: "Set up a release pipeline",
    description: "Explore how to take your first change from a sandbox to production.",
    surfaceId: "alm", capabilityId: "pipeline", prompt: STARTER_PROMPTS[3],
  },
  {
    id: "existing-project", title: "Bring your project",
    description: "Start with your codebase and get to know what you can do here.",
    surfaceId: "code", capabilityId: "sfdx-project", prompt: EXISTING_PROJECT_PROMPT,
  },
];

/** The card and its launch share the same permission-aware, truthful destination. */
export function startersForProfile(profile: DemoProfile): readonly Starter[] {
  return STARTERS.flatMap(starter => {
    if (profile.surfaceAccess.includes(starter.surfaceId)) return [starter];
    if (starter.id === "app" && profile.surfaceAccess.includes("build")) return [{
      ...starter, title: "Build an app experience", surfaceId: "build" as const, capabilityId: "experience",
      description: "Put together pages and apps connected to your Salesforce data.", prompt: EXPERIENCE_PROMPT,
    }];
    return [];
  });
}

export function starterLaunch(id: StarterId, profile: DemoProfile, scope: CapabilityScope): { starter: Starter; canvas: CanvasSpecInput } | null {
  const starter = startersForProfile(profile).find(starter => starter.id === id);
  const capability = starter && capabilityForCanvas(starter.surfaceId, starter.capabilityId);
  if (!starter || !capability) return null;
  return { starter, canvas: { kind: "capability", title: capability.label,
    params: { surface: starter.surfaceId, capability: capability.id, ...scope } } };
}

export function isStarterPrompt(value: string): boolean {
  return STARTER_PROMPTS.some(prompt => prompt === value) || value === EXISTING_PROJECT_PROMPT || value === EXPERIENCE_PROMPT;
}
