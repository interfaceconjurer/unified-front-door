/**
 * The canvas id / scope-key scheme.
 *
 * A project isn't a registered canvas — it's opened on demand as its own tab,
 * with a namespaced id (`project:<projectId>`) so it can't collide with a nav
 * canvas. That same string is stored as the canvas's project scope key. This
 * module is the one place that constructs and parses the scheme.
 */
const PROJECT_PREFIX = "project:";

/** The whole-workspace scope — the agent session not tied to any one project. */
export const GLOBAL_SCOPE = "global";

/** A project canvas / scope id: the prefix followed by a project id. */
export type ProjectScopeKey = `${typeof PROJECT_PREFIX}${string}`;

/** A work surface's agent + top-bar scope: either the whole workspace
 *  ({@link GLOBAL_SCOPE}) or one project (a {@link ProjectScopeKey}). Project
 *  canvases and resource builders both carry the project form; anything else is
 *  global. Keeping the two shapes in one type is what lets the scattered call
 *  sites drop their bare `"global"` string literals. */
export type ScopeKey = typeof GLOBAL_SCOPE | ProjectScopeKey;

/** The canvas (and chat-scope) id for a project tab, from a project id. */
export function projectCanvasId(projectId: string): ProjectScopeKey {
  return `${PROJECT_PREFIX}${projectId}`;
}

/** The project id carried inside a project canvas/scope id. Expects a value
 *  produced by {@link projectCanvasId}. */
export function projectIdFromCanvasId(canvasId: ProjectScopeKey): string {
  return canvasId.slice(PROJECT_PREFIX.length);
}
