import type { SurfaceId } from "@/lib/workspace/model";

export type DemoProfileId = "jw" | "kf" | "am" | "sp";

export type DemoProfile = {
  id: DemoProfileId;
  name: string;
  firstName: string;
  initials: string;
  role: string;
  experience: "returning" | "new";
  workspaceExperience: "established" | "empty";
  onboarding?: "org-assessment";
  surfaceAccess: readonly SurfaceId[];
};

export const DEMO_PROFILES: readonly DemoProfile[] = [
  {
    id: "sp",
    name: "Sam Patel",
    firstName: "Sam",
    initials: "SP",
    role: "Platform Administrator",
    experience: "new",
    workspaceExperience: "empty",
    onboarding: "org-assessment",
    surfaceAccess: ["build", "alm"],
  },
  {
    id: "kf",
    name: "Karen Flores",
    firstName: "Karen",
    initials: "KF",
    role: "Platform Builder",
    experience: "returning",
    workspaceExperience: "established",
    surfaceAccess: ["build", "alm"],
  },
  {
    id: "jw",
    name: "Jordan Wright",
    firstName: "Jordan",
    initials: "JW",
    role: "Platform Administrator",
    experience: "returning",
    workspaceExperience: "established",
    surfaceAccess: ["build", "alm", "govern"],
  },
  {
    id: "am",
    name: "Alex Morgan",
    firstName: "Alex",
    initials: "AM",
    role: "Developer",
    experience: "returning",
    workspaceExperience: "established",
    surfaceAccess: ["build", "code", "govern", "alm"],
  },
];

/** Presentation framing, separate from profile identities in saved history. */
export const PROFILE_SCENARIOS: Record<DemoProfileId, { label: string; phase: string; description: string }> = {
  sp: { label: "Day zero", phase: "Build + ALM", description: "Assess an existing org and turn its first opportunity into a project." },
  kf: { label: "Platform builder", phase: "Build + ALM", description: "A small org with an assistant in progress and a release ready for review." },
  jw: { label: "Platform operations", phase: "+ Govern & Observe", description: "Bring access reviews and org oversight into the same workspace." },
  am: { label: "Returning developer", phase: "+ Code", description: "The full workspace: build, release, govern, and develop across projects." },
};

export function demoProfileById(id: DemoProfileId): DemoProfile {
  const profile = DEMO_PROFILES.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown demo profile: ${id}`);
  return profile;
}

export function isDemoProfileId(value: string | null): value is DemoProfileId {
  return DEMO_PROFILES.some((profile) => profile.id === value);
}

export function canAccessSurface(profile: DemoProfile, surfaceId: SurfaceId): boolean {
  return profile.surfaceAccess.includes(surfaceId);
}
