/**
 * Shared derivations over the workspace domain model (projects → worktrees →
 * agent sessions). Both the ⌘⇧P command palette and the persistent
 * `WorkspacePanel` render from these — the whole point of the panel coexisting
 * with the palette (rather than replacing it) is that they show the same
 * tree and the same triage list, so the derivation has to live in exactly one
 * place. Keep this file free of React; it's pure data shaping.
 */
import type { AgentSession, AgentSessionStatus, Project, Worktree } from "./model";

export const STATUS_LABEL: Record<AgentSessionStatus, string> = {
  working: "Working",
  waiting: "Waiting on you",
  idle: "Idle",
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
  /** Empty for a single-worktree project — progressive disclosure: a project
   *  with nothing to parallelize shows only its header row, no redundant
   *  single child. */
  worktrees: readonly WorktreeRow[];
};

/** Every project with its tree-connected worktrees, unfiltered. Callers that
 *  support search (the palette) re-derive `lastChild` after filtering their
 *  own copy of `worktrees`, since "last visible row" depends on the filter;
 *  the panel, which has no search box, uses this as-is. */
export function buildProjectTree(projects: readonly Project[]): ProjectTreeRow[] {
  return projects.map((project) => {
    const worktrees =
      project.worktrees.length > 1
        ? project.worktrees.map((worktree, index) => ({
            worktree,
            status: project.agentSessions.find((s) => s.worktreeId === worktree.id)?.status ?? "idle",
            lastChild: index === project.worktrees.length - 1,
          }))
        : [];
    return { project, worktrees };
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
