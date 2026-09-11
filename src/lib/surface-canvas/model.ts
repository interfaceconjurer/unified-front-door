/**
 * Surface-canvas domain model — the "what tabs are open in this surface" that,
 * like the workspace selection, follows you across route content swaps and
 * survives a reload. Orthogonal to the workspace (project/org) it renders inside.
 *
 * A canvas is stored as a SERIALIZABLE spec — a `kind` discriminator plus a
 * title and optional string params — never a React node, so the whole open-tab
 * set round-trips through `localStorage`. Content is resolved from a
 * kind→component registry at render time (see `canvas-registry.tsx`), which is
 * what keeps this file free of React and lets the persisted state stay plain
 * data. Keep this file free of React and fixtures, same as `workspace/model.ts`.
 */

/**
 * The kinds a canvas can be. `"overview"` is special: it's the pinned overview
 * tab every surface always has at index 0, synthesized by the provider rather
 * than stored (so it can't be closed, reordered, or corrupted in persistence).
 * The rest are the launchable kinds any affordance can `openCanvas` — the
 * overview's launch region opens `capability` (and, on Build, `app`); the
 * workspace panel's app rows also open `app`.
 */
export type CanvasKind = "overview" | "app" | "capability" | "work";

/** The reserved id/kind of the pinned overview tab. Never persisted; the
 *  provider prepends it to every surface's list at index 0. */
export const OVERVIEW_CANVAS_ID = "overview";

/** Openable (persistable) kinds. Excludes `"overview"`, which is not launchable
 *  — it always exists. Drives both the registry's exhaustiveness and the
 *  parser's "drop specs of an unknown kind" sanitization. */
export const LAUNCHABLE_KINDS = ["app", "capability", "work"] as const;

export type LaunchableCanvasKind = (typeof LAUNCHABLE_KINDS)[number];

/**
 * What a launch affordance hands to `openCanvas` — everything but the id,
 * which the store derives so that opening the "same" canvas twice (same kind +
 * params) resolves to the same tab instead of a duplicate.
 */
export type CanvasSpecInput = {
  kind: LaunchableCanvasKind;
  title: string;
  /** Optional, string-only so the whole spec stays trivially serializable. Two
   *  inputs with the same kind and params are the same canvas (see `canvasId`). */
  params?: Record<string, string>;
};

/**
 * A canvas as it appears in a surface's tab list. A launched canvas always
 * carries a `LaunchableCanvasKind`; only the synthetic `OVERVIEW_CANVAS` uses
 * the `"overview"` kind, so `kind` widens to the full `CanvasKind` here even
 * though `openCanvas` (and thus everything persisted) only ever produces the
 * launchable subset.
 */
export type CanvasSpec = {
  id: string;
  kind: CanvasKind;
  title: string;
  params?: Record<string, string>;
  /** Editable values are separate from params, so editing keeps the same tab. */
  draft?: Record<string, string>;
};

/** The synthetic overview spec — its `title` is what the tab reads. Not stored;
 *  built on the fly by the provider so index 0 is always this exact shape. */
export const OVERVIEW_CANVAS: CanvasSpec = {
  id: OVERVIEW_CANVAS_ID,
  kind: "overview",
  title: "Overview",
};

/**
 * Deterministic id for a spec, derived from kind + params so that "open X" is
 * idempotent: the same kind and params always map to the same id, which is how
 * `openCanvas` focuses an existing tab instead of duplicating it. Params are
 * sorted so key order in the caller's object can't produce two ids for one
 * logical canvas.
 */
export function canvasId(kind: LaunchableCanvasKind, params?: Record<string, string>): string {
  const entries = Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return kind;
  const suffix = entries.map(([key, value]) => `${key}=${value}`).join("&");
  return `${kind}:${suffix}`;
}

/** Type guard used by the parser: is this a launchable (persistable) kind? The
 *  overview kind is deliberately excluded — it's never read from storage. */
export function isLaunchableKind(value: unknown): value is LaunchableCanvasKind {
  return typeof value === "string" && (LAUNCHABLE_KINDS as readonly string[]).includes(value);
}
