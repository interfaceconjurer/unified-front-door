/**
 * The canvas id scheme.
 *
 * A project isn't a registered canvas — it's opened on demand as its own tab,
 * with a namespaced id (`project:<projectId>`) so it can't collide with a nav
 * canvas. That same string is the chat panel's scope key for the project. This
 * module is the one place that knows the scheme, so the write side (opening a
 * project) and the read sides (the shell's rail rule, the chat's scope key)
 * can't drift apart.
 */
const PROJECT_PREFIX = "project:";

/** The canvas (and chat-scope) id for a project tab, from a project id. */
export function projectCanvasId(projectId: string): string {
  return `${PROJECT_PREFIX}${projectId}`;
}

/** Whether a canvas id names a project tab (vs. a nav or blank canvas). */
export function isProjectCanvasId(canvasId: string): boolean {
  return canvasId.startsWith(PROJECT_PREFIX);
}

/** The project id carried inside a project canvas id. Assumes the id is a
 *  project canvas id (guard with {@link isProjectCanvasId} first). */
export function projectIdFromCanvasId(canvasId: string): string {
  return canvasId.slice(PROJECT_PREFIX.length);
}
