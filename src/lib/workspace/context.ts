import { sessionKey, type Org, type Project, type Worktree } from "./model";

/** Requested identity is retained even when its resource is unavailable. */
export type WorkspaceTarget = { projectId: string | null; worktreeId: string | null; orgId: string | null };
export type WorkspaceResolution = {
  status: "loading" | "empty" | "planning" | "ready" | "unavailable";
  target: WorkspaceTarget;
  project: Project | null;
  worktree: Worktree | null;
  org: Org | null;
  reason: string | null;
  sessionKey: string;
};
export const UNBOUND_TARGET: WorkspaceTarget = { projectId: null, worktreeId: null, orgId: null };
export function sameTarget(a: WorkspaceTarget, b: WorkspaceTarget): boolean {
  return a.projectId === b.projectId && a.worktreeId === b.worktreeId && a.orgId === b.orgId;
}
export function resolveWorkspace(target: WorkspaceTarget, projects: readonly Project[], orgs: readonly Org[], loaded = true): WorkspaceResolution {
  const project = projects.find((item) => item.id === target.projectId) ?? null;
  const worktree = project?.worktrees.find((item) => item.id === target.worktreeId) ?? null;
  const requestedOrg = orgs.find((item) => item.id === target.orgId);
  const org = requestedOrg?.connection === "connected" ? requestedOrg : null;
  const reason = !loaded ? null
    : target.projectId && !project ? `Project ${target.projectId} is unavailable.`
    : target.worktreeId && !worktree ? `Worktree ${target.worktreeId} is unavailable.`
    : target.orgId && !org ? `Org ${target.orgId} is ${requestedOrg?.connection === "expired" ? "expired" : "unavailable"}.`
    : project?.worktrees.length && !org ? "Choose a connected org to continue." : null;
  return {
    target, project, worktree, org, reason,
    status: !loaded ? "loading" : reason ? "unavailable" : !project ? "empty" : !project.worktrees.length ? "planning" : "ready",
    sessionKey: project || target.projectId ? sessionKey(target.projectId!, target.worktreeId) : JSON.stringify(["unbound-session", target.orgId]),
  };
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function parseTarget(value: unknown): WorkspaceTarget | null {
  if (!record(value) || !["projectId", "worktreeId", "orgId"].every((key) => value[key] === null || typeof value[key] === "string" && !!value[key].trim())) return null;
  if (value.projectId === null && value.worktreeId !== null) return null;
  return { projectId: value.projectId as string | null, worktreeId: value.worktreeId as string | null, orgId: value.orgId as string | null };
}
