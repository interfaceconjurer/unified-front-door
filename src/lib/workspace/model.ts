/**
 * Workspace domain model — the "what you're working on" that follows you across
 * surfaces, orthogonal to the "how you're viewing it" (the surface/lens).
 *
 * Shaped to mirror what real Salesforce sources would return (an sfdx-project.json
 * parse for the project + worktrees, an org list for environments) so the surfaces
 * that read this never have to change when the fixture data source is swapped for
 * the real one. Keep this file free of React and fixtures — it's just the shape.
 */

/** A target org the project can be pointed at. Independently switchable — like
 *  flipping the target org in the pro-code experience — so it re-scopes the
 *  env-aware surfaces (Govern, ALM) without changing your worktree or thread. */
export type EnvironmentKind = "scratch" | "sandbox" | "production";

export type Environment = {
  id: string;
  label: string;
  kind: EnvironmentKind;
};

/** A git worktree: an isolated checkout of the project. The unit of isolation
 *  that lets super users run parallel agents safely (Herdr's model). A simple
 *  project has exactly one; the UI stays simple until a second appears. */
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

export type Project = {
  id: string;
  name: string;
  description: string;
  worktrees: readonly Worktree[];
  environments: readonly Environment[];
  facets: ProjectFacets;
};

/** The agent's thread is bound to a {project, worktree} pair — switching worktree
 *  switches thread. This is the stable key for that session. */
export function sessionKey(projectId: string, worktreeId: string): string {
  return `${projectId}::${worktreeId}`;
}

export function primaryWorktree(project: Project): Worktree {
  return project.worktrees.find((w) => w.isPrimary) ?? project.worktrees[0]!;
}
