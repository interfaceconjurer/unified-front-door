/**
 * Shared derivations over the workspace domain model (projects → worktrees →
 * agent sessions). Both the ⌘⇧P command palette and the persistent
 * `WorkspacePanel` render from these — the whole point of the panel coexisting
 * with the palette (rather than replacing it) is that they show the same
 * tree and the same triage list, so the derivation has to live in exactly one
 * place. Keep this file free of React; it's pure data shaping.
 */
import { primaryWorktree } from "./model";
import type { AgentSession, AgentSessionStatus, AppStatus, DeployedApp, Project, Worktree } from "./model";

export const STATUS_LABEL: Record<AgentSessionStatus, string> = {
  working: "Working",
  waiting: "Waiting on you",
  idle: "Idle",
};

/** Same idiom as `STATUS_LABEL` for agent sessions — the one place the
 *  app-status→copy mapping lives, so the panel's nested and flat app rows
 *  agree on the same four words. */
export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  live: "Live",
  building: "Building",
  error: "Error",
  paused: "Paused",
};

// Waiting-on-you is the triage priority, then actively-working, then idle.
export const STATUS_RANK: Record<AgentSessionStatus, number> = { waiting: 0, working: 1, idle: 2 };

export type WorktreeRow = {
  worktree: Worktree;
  /** Resolved from that worktree's agent session; `idle` if it has none. */
  status: AgentSessionStatus;
  /** The last worktree under its project — the tree draws a └ corner (stops
   *  here) rather than a ├ tee (continues to the next sibling) for this row. */
  lastChild: boolean;
};

export type ProjectTreeRow = {
  project: Project;
  /** The primary worktree ("main") — the project's base branch. Rendered
   *  attached to the project header (no tree connector), part of the project's
   *  own identity rather than a sibling leaf. Always present. */
  base: WorktreeRow;
  /** The non-primary worktrees — the parallel agent workspaces branched off the
   *  base. These are the tree-connected children. Empty for a project that only
   *  has its primary worktree (nothing to parallelize). */
  children: readonly WorktreeRow[];
};

/** Every project split into its base (primary) worktree and its tree-connected
 *  children, unfiltered. Callers that support search (the palette) re-derive
 *  `children[].lastChild` after filtering their own copy, since "last visible
 *  row" depends on the filter; the panel, which has no search box, uses this
 *  as-is. `base.lastChild` is unused (the base draws no connector). */
export function buildProjectTree(projects: readonly Project[]): ProjectTreeRow[] {
  return projects.map((project) => {
    const primary = primaryWorktree(project);
    const statusOf = (worktree: Worktree): AgentSessionStatus =>
      project.agentSessions.find((s) => s.worktreeId === worktree.id)?.status ?? "idle";
    const children = project.worktrees.filter((w) => w.id !== primary.id);
    return {
      project,
      base: { worktree: primary, status: statusOf(primary), lastChild: true },
      children: children.map((worktree, index) => ({
        worktree,
        status: statusOf(worktree),
        lastChild: index === children.length - 1,
      })),
    };
  });
}

export type SessionRow = {
  project: Project;
  worktree: Worktree;
  session: AgentSession;
};

/** Every agent session across every project, flattened for global triage and
 *  sorted waiting → working → idle. Sort is stable (JS's Array#sort has
 *  guaranteed stable ordering), so ties fall back to project-then-worktree
 *  fixture order. */
export function allSessionRows(projects: readonly Project[]): SessionRow[] {
  const rows: SessionRow[] = [];
  for (const project of projects) {
    for (const session of project.agentSessions) {
      const worktree = project.worktrees.find((w) => w.id === session.worktreeId);
      if (!worktree) continue; // defensive: fixtures always pair a session with a worktree
      rows.push({ project, worktree, session });
    }
  }
  return rows.sort((a, b) => STATUS_RANK[a.session.status] - STATUS_RANK[b.session.status]);
}

/** The triage subset: sessions a human might act on right now (working or
 *  waiting), idle dropped entirely. This is what the `WorkspacePanel`'s
 *  bottom section shows — a project whose only session is idle is absent
 *  from this list, though it still appears in `buildProjectTree`'s top tree. */
export function activeSessionRows(projects: readonly Project[]): SessionRow[] {
  return allSessionRows(projects).filter((row) => row.session.status !== "idle");
}

export type AppRow = {
  project: Project;
  app: DeployedApp;
};

/** Every deployed app across every project, flattened for the panel's "Apps"
 *  filter — the cross-project "show me everything running" view. Preserves
 *  fixture order (project order, then each project's own app order); unlike
 *  `allSessionRows` there's no triage rank here, since app status isn't a
 *  human-action queue the way session status is. */
export function allAppRows(projects: readonly Project[]): AppRow[] {
  const rows: AppRow[] = [];
  for (const project of projects) {
    for (const app of project.apps) {
      rows.push({ project, app });
    }
  }
  return rows;
}
