import { demoProfileById, type DemoProfileId } from "../demo-profiles";
import { PROJECTS } from "./fixtures";
import type { Project } from "./model";
import { RETURNING_WORK } from "./returning-work";

// Sample projects grow with the expansion scenario. Saved projects are added
// separately, so changing these fixtures never rewrites user-created data.
const project = (id: string) => PROJECTS.find(item => item.id === id)!;
function projectOnly(id: string, summary: string): Project {
  const source = project(id);
  return { ...source, worktrees: [], apps: [],
    facets: { ...source.facets, apexClasses: 0, lwc: 0 },
    agentSessions: [{ worktreeId: null, status: "idle", summary }] };
}
const builder: Project = {
  ...projectOnly("trailblazer-crm", "The lead-routing assistant is ready. Review its first release before deploying to UAT."),
  description: "A small sales org preparing its first lead-routing automation.",
  facets: { objects: 6, flows: 2, apexClasses: 0, lwc: 0, permissionSets: 2 },
  agentSessions: [{ worktreeId: null, status: "waiting", summary: "Review the lead-routing automation before its first release to UAT." }],
};
const onboarding = projectOnly("customer-onboarding", "Welcome tasks and follow-up reminders are ready to refine.");
const service = projectOnly("service-operations", "Case routing and service response monitoring are ready to continue.");
const crm = project("trailblazer-crm");
const operations: Project = {
  ...crm,
  description: "Sales automation with release approvals and integration access reviews.",
  worktrees: crm.worktrees.filter(tree => tree.id !== "hotfix-9821"),
  facets: { objects: 14, flows: 6, apexClasses: 0, lwc: 0, permissionSets: 5 },
  agentSessions: [
    { worktreeId: "main", status: "waiting", summary: "Review permissions requested for the lead-routing integration before its next release." },
    ...crm.agentSessions.filter(session => session.worktreeId === "lead-routing" || session.worktreeId === "access-review"),
  ],
  apps: [],
};
const storefront = project("acme-storefront");
const projects: Record<DemoProfileId, readonly Project[]> = {
  sp: [],
  kf: [builder, onboarding],
  jw: [operations, { ...storefront, facets: { ...storefront.facets, apexClasses: 0, lwc: 0 } }, onboarding, service],
  am: PROJECTS,
};

export function projectsForProfile(profileId: DemoProfileId): readonly Project[] {
  return projects[profileId];
}

/** One sample-work projection feeds Today, tabs, navigation and agent context. */
export function workForProfile(profileId: DemoProfileId) {
  const profile = demoProfileById(profileId), available = projectsForProfile(profileId);
  return RETURNING_WORK.filter(work => profile.surfaceAccess.includes(work.surfaceId)
    && available.some(project => project.id === work.projectId && (work.worktreeId === null
      ? project.worktrees.length === 0 : project.worktrees.some(tree => tree.id === work.worktreeId))));
}
