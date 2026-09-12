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
    id: "jw",
    name: "Jordan Wright",
    firstName: "Jordan",
    initials: "JW",
    role: "Developer",
    experience: "new",
    workspaceExperience: "empty",
    surfaceAccess: ["build", "code", "govern", "alm"],
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
  {
    id: "kf",
    name: "Karen Flores",
    firstName: "Karen",
    initials: "KF",
    role: "Platform Builder",
    experience: "new",
    workspaceExperience: "empty",
    surfaceAccess: ["build", "alm"],
  },
];

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
