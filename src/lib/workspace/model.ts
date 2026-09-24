/**
 * Workspace domain model — the "what you're working on" that follows you across
 * surfaces, orthogonal to the "how you're viewing it" (the surface/lens).
 *
 * Shaped to mirror what real Salesforce sources would return (an sfdx-project.json
 * parse for the project + worktrees, `sf org list` for the org registry) so the
 * surfaces that read this never have to change when the fixture data source is
 * swapped for the real one. Keep this file free of React and fixtures.
 */

/** The purpose-built destinations. A surface is a lens on the project, not a
 *  container for it — the same project projects differently into each. */
export type { SurfaceId } from "./surfaces";

/**
 * An authenticated org. Orgs are GLOBAL, not owned by a project — you auth them
 * once (like `sf org list`) and any project can target any of them. A project
 * only carries a default target; the active target is a free, per-project switch.
 */
export type OrgKind = "devhub" | "scratch" | "sandbox" | "production";

export type Org = {
  id: string;
  label: string;
  kind: OrgKind;
  connection: "connected" | "expired";
  /** Scratch orgs only: days until expiry (0 = expired today). */
  expiresInDays?: number;
};

/** A git worktree: an isolated checkout of the project. The unit of isolation
 *  that lets super users run parallel agents safely (Herdr's model). A simple
 *  project can also have no worktrees and work directly at project scope. */
export type Worktree = {
  id: string;
  label: string;
  branch: string;
  isPrimary: boolean;
};

/**
 * What the project contains. Because SFDX structure encodes intent, these counts
 * let each surface project a relevant view and let the agent pre-scope its
 * suggestions (flows present → Build suggests flow work, etc.). Counts are enough
 * for the prototype; the real source would hydrate richer metadata here.
 */
export type ProjectFacets = {
  objects: number;
  flows: number;
  apexClasses: number;
  lwc: number;
  permissionSets: number;
};

/**
 * An agent session's live state, from the "does a human need to look at this
 * right now" angle — working (agent is actively executing), waiting (blocked
 * on human input/approval), idle (nothing in flight; may just be finished and
 * ready for review).
 */
export type AgentSessionStatus = "working" | "waiting" | "idle";

/**
 * A project's agent thread, optionally scoped to a worktree. The pairing
 * `sessionKey(projectId, worktreeId)` uses null for project-only threads. Mocked
 * standing in for a real query against the agent runtime.
 */
export type AgentSession = {
  worktreeId: string | null;
  status: AgentSessionStatus;
  /** Short, human-scannable description of the most recent activity. */
  summary: string;
};

/**
 * A deployed app's live state, from the "is it up" angle — live (serving
 * traffic normally), building (a deploy is in flight), error (serving is
 * broken), paused (intentionally stopped, not an error).
 */
export type AppStatus = "live" | "building" | "error" | "paused";

/**
 * An outward-facing, running output of a project — as opposed to a worktree
 * (source) or an agent session (work in flight), an app is something a real
 * user hits at a URL right now. Standing in for a real deploy/ops query the
 * same way facets/sessions do.
 */
export type DeployedApp = {
  id: string;
  label: string;
  url: string;
  status: AppStatus;
  /** Display label, e.g. "Production". */
  environment: string;
  /** Explicit zoned ISO timestamp; legacy relative labels render as "At capture". */
  lastDeployed: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  worktrees: readonly Worktree[];
  /** Optional deployment destination. Project selection must preserve the
   *  independently selected connection. */
  defaultOrgId: string | null;
  facets: ProjectFacets;
  /** One session per worktree, or one project-level session with a null ID —
   *  than a flat global list, since worktree ids are only unique within a
   *  project ("main" exists in more than one project's fixture). */
  agentSessions: readonly AgentSession[];
  /** The project's deployed outputs — nested here for the same reason sessions
   *  are: an app is owned by the project it came from, not a peer of it.
   *  Standing in for a real deploy query. */
  apps: readonly DeployedApp[];
};

/** The agent's thread is bound to a {project, worktree} pair — switching worktree
 *  switches thread. This is the stable key for that session. */
export function sessionKey(projectId: string, worktreeId: string | null): string {
  return JSON.stringify(["project-session", projectId, worktreeId]);
}

export function primaryWorktree(project: Project): Worktree | null {
  return project.worktrees.find((w) => w.isPrimary) ?? project.worktrees[0] ?? null;
}
