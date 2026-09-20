import { sameTarget, parseTarget, type WorkspaceTarget } from "../workspace/context";
import { BrowserPersistenceStore, type Decoded } from "../browser-persistence";
import { RESOURCE_TYPES } from "../org-resources/model";
import { canonicalCanvasSurface } from "./routing";
/**
 * Persisted slice of surface-canvas state — per surface, the ordered list of
 * open (launched) canvases and which tab is active. Deliberately a sibling of
 * `workspace/persistence.ts` and modeled on it exactly: an external store
 * (subscribe/getSnapshot/getServerSnapshot) so the provider rehydrates via
 * `useSyncExternalStore` during render instead of an effect — no `setState` in
 * an effect for `react-hooks/set-state-in-effect` to flag, because there's no
 * effect at all. `getServerSnapshot` always returns the fixed empty default, so
 * the server render and the client's first hydration pass agree; React applies
 * the real stored value in its dedicated post-hydration pass, built into
 * `useSyncExternalStore` for this case.
 *
 * Only launched canvases are stored. The pinned "Overview" tab (index 0) is not
 * persisted — the provider synthesizes it — so it can never be closed, dropped,
 * or corrupted here. Everything stored is a plain, serializable `CanvasSpec`.
 */

import type { DemoProfileId } from "@/lib/demo-profiles";
import { RETURNING_WORK, workCanvasInput, workForCanvas, returningWorkById } from "../workspace/returning-work";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  canvasId,
  canvasTarget,
  parseCanvasInput,
  inputFromCanonicalId,
  OVERVIEW_CANVAS_ID,
  type CanvasSpec,
  type CanvasSpecInput,
} from "./model";

/** The surface ids, as data. Typed against `SurfaceId` so adding a surface to
 *  the union without listing it here is a compile error, and kept local (not
 *  imported from the React catalog) so this stays a plain lib module. */
import { SURFACE_IDS } from "../workspace/surfaces";

/** One surface's persisted canvas state: launched canvases in tab order, plus
 *  the active tab id (`OVERVIEW_CANVAS_ID` when the launch pad is focused). */
export type SurfaceCanvasSlice = {
  canvases: CanvasSpec[];
  activeCanvasId: string;
  /** Closing a tab dismisses its view; it doesn't delete an edited draft. */
  closedDrafts?: Record<string, Record<string, string>>;
  /** Captured operation target outlives the open tab and its closed draft. */
  targets?: Record<string, WorkspaceTarget>;
  recovery?: { id: string; title: string; reason: string; original: unknown }[];
};

/** The whole persisted store: one slice per surface. Always fully populated
 *  (see `emptyState`/`parseState`), so consumers can index any `SurfaceId`
 *  without a hole check. */
export type PersistedCanvases = Record<SurfaceId, SurfaceCanvasSlice>;

const STORAGE_KEY = "ufd.surface-canvas.v1";
export const OPEN_CANVAS_LIMIT = 20;

function emptySlice(): SurfaceCanvasSlice {
  return { canvases: [], activeCanvasId: OVERVIEW_CANVAS_ID, closedDrafts: {}, recovery: [], targets: {} };
}

export function emptyState(): PersistedCanvases {
  return Object.fromEntries(SURFACE_IDS.map((id) => [id, emptySlice()])) as PersistedCanvases;
}

/** Fixed default, one shared reference — this is what SSR and the client's first
 *  hydration render both see, so they can't diverge. Never mutated. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keep only string values — enough to not crash on garbage. */
function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

/** A stored canvas is kept only if it's well-formed AND of a currently-known
 *  launchable kind; a spec whose kind has since been removed is silently
 *  dropped rather than rendered as a broken tab. The id is re-derived from
 *  kind+params so a hand-edited/legacy id can't defeat the focus-existing
 *  dedupe rule. */
// Frozen aliases from the old release. Never resolve a legacy name through today's catalog.
const LEGACY_CAPABILITIES: Record<string, string> = {
  "Start an SFDX project": "sfdx-project", "Build a React app": "react-app", "Write Apex": "apex",
  "Query your data": "query", "Create & run tests": "tests", "Create an agent": "agent", "Your toolkit": "toolkit",
  "Model your data": "data-model", "Build an automation": "automation", "Build an experience": "experience",
  "Review security": "security", "Monitor platform health": "health", "Define a policy": "policies", "Observe agent activity": "agent-activity",
  "Plan your work": "work", "Set up a pipeline": "pipeline", "Validate a change": "validation", "Prepare a release": "release",
};
function legacyInput(value: unknown, surfaceId: SurfaceId): CanvasSpecInput | null {
  if (!isRecord(value)) return null;
  const params = isRecord(value.params) ? { ...value.params } : {};
  if (value.kind === "capability") {
    params.surface ??= surfaceId;
    params.capability ??= typeof params.name === "string" ? LEGACY_CAPABILITIES[params.name] : undefined;
  }
  return parseCanvasInput({ ...value, params }, true);
}
function legacyClosedInput(id: string, surfaceId: SurfaceId): CanvasSpecInput | null {
  const canonical = inputFromCanonicalId(id); if (canonical) return canonical;
  const colon = id.indexOf(":"); if (colon < 0) return null;
  const kind = id.slice(0, colon), pairs = id.slice(colon + 1).split("&"), params: Record<string, string> = {};
  for (const pair of pairs) {
    const parts = pair.split("=");
    if (parts.length !== 2 || !parts[0] || !parts[1] || Object.hasOwn(params, parts[0])) return null;
    params[parts[0]] = parts[1];
  }
  const allowed = kind === "app" ? ["projectId", "appId"] : kind === "work" ? ["workId", "projectId", "worktreeId"]
    : kind === "improvement-project" ? ["projectId"] : ["surface", "capability", "section", "name"];
  if (Object.keys(params).some((key) => !allowed.includes(key))) return null;
  // '&' separators were not escaped. Multiple fields cannot prove their original boundaries.
  // Preserve those ID-only records for explicit recovery rather than assigning the wrong target.
  if (pairs.length > 1) return null;
  return legacyInput({ kind, title: "Recovered draft", params }, surfaceId);
}
function parseSlice(value: unknown, surfaceId: SurfaceId): SurfaceCanvasSlice {
  if (!isRecord(value)) return emptySlice();
  const canvases: CanvasSpec[] = [], aliases = new Map<string, string[]>();
  const recovery: NonNullable<SurfaceCanvasSlice["recovery"]> = Array.isArray(value.recovery)
    ? value.recovery.filter((entry) => isRecord(entry) && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.reason === "string") as NonNullable<SurfaceCanvasSlice["recovery"]> : [];
  const preserve = (title: string, reason: string, original: unknown) => recovery.push({ id: `recovery-${recovery.length}`, title, reason, original });
  if (Array.isArray(value.canvases)) for (const entry of value.canvases) {
    const input = legacyInput(entry, surfaceId);
    if (!input || (input.kind === "org-assessment" && surfaceId !== "govern") || (input.kind === "capability" && input.params.surface !== surfaceId) || (input.kind === "org-resource" && RESOURCE_TYPES[input.params.resourceType].surface !== surfaceId) || (input.kind === "work" && returningWorkById(input.params.workId) && workForCanvas(input.params)?.surfaceId !== canonicalCanvasSurface(surfaceId, input))) { preserve("Legacy canvas", "Its target could not be reconstructed.", entry); continue; }
    const id = canvasId(input.kind, input.params), original = entry as Record<string, unknown>;
    if (typeof original.id === "string") aliases.set(original.id, [...(aliases.get(original.id) ?? []), id]);
    const draft = original.draft === undefined ? undefined : sanitizeStringRecord(original.draft);
    if (canvases.some((canvas) => canvas.id === id)) { preserve(input.title, "Multiple older tabs resolve to this target; their content is preserved separately.", entry); continue; }
    canvases.push({ ...input, id, draft });
  }
  const closedDrafts: Record<string, Record<string, string>> = {};
  if (isRecord(value.closedDrafts)) for (const [oldId, draft] of Object.entries(value.closedDrafts)) {
    const candidates = aliases.get(oldId);
    const input = legacyClosedInput(oldId, surfaceId);
    const id = candidates?.length === 1 ? candidates[0] : !candidates?.length && input ? canvasId(input.kind, input.params) : undefined;
    if (!id || Object.hasOwn(closedDrafts, id)) { preserve("Closed legacy draft", "The old key has ambiguous identity. Copy or export its content before choosing a new target.", { id: oldId, draft }); continue; }
    const open = canvases.find((canvas) => canvas.id === id);
    if (open?.draft && JSON.stringify(open.draft) !== JSON.stringify(sanitizeStringRecord(draft))) {
      preserve(open.title, "An older closed draft differs from the open draft. Both versions are preserved.", { id: oldId, draft }); continue;
    }
    closedDrafts[id] = sanitizeStringRecord(draft);
  }
  const oldActive = typeof value.activeCanvasId === "string" ? value.activeCanvasId : OVERVIEW_CANVAS_ID;
  const candidates = aliases.get(oldActive);
  const activeCanvasId = candidates?.length === 1 ? candidates[0]! : canvases.some((canvas) => canvas.id === oldActive) ? oldActive : OVERVIEW_CANVAS_ID;
  const targets: Record<string, WorkspaceTarget> = {};
  if (isRecord(value.targets)) for (const [oldId, target] of Object.entries(value.targets)) {
    const candidates = aliases.get(oldId), input = inputFromCanonicalId(oldId);
    const id = candidates?.length === 1 ? candidates[0]! : input ? canvasId(input.kind, input.params) : oldId;
    targets[id] = parseTarget(target)!;
  }
  return { canvases, activeCanvasId, closedDrafts, recovery, targets };
}
export function parseState(parsed: unknown): Decoded<PersistedCanvases> {
  if (!isRecord(parsed) || !SURFACE_IDS.some((id) => id in parsed)) return { error: "invalid" };
  if ("schemaVersion" in parsed && parsed.schemaVersion !== 2) return { error: "unsupported" };
  // A malformed explicit target cannot be replaced by a newly inferred one.
  for (const id of SURFACE_IDS) {
    const slice = parsed[id];
    if (!isRecord(slice) || slice.targets === undefined) continue;
    if (!isRecord(slice.targets)) return { error: "invalid" };
    for (const [canvasKey, value] of Object.entries(slice.targets)) {
      const target = parseTarget(value), input = inputFromCanonicalId(canvasKey);
      if (!target || !input || !sameTarget(canvasTarget(input, target), target)) return { error: "invalid" };
    }
  }
  return { value: migrateCanvasSurfaces(Object.fromEntries(SURFACE_IDS.map((id) => [id, parseSlice(parsed[id], id)])) as PersistedCanvases) };
}

/** Move view preferences, never canvas identity or captured scope. If both old
 * and current surfaces contain edits, the current version wins and the full
 * older version remains available in recovery instead of being overwritten. */
export function migrateCanvasSurfaces(state: PersistedCanvases): PersistedCanvases {
  let next = state;
  const without = <T,>(map: Record<string, T> | undefined, id: string) => Object.fromEntries(Object.entries(map ?? {}).filter(([key]) => key !== id));
  const equalFields = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
  for (const from of SURFACE_IDS) {
    const original = state[from];
    const ids = new Set([...original.canvases.map(canvas => canvas.id), ...Object.keys(original.closedDrafts ?? {}), ...Object.keys(original.targets ?? {})]);
    for (const id of ids) {
      const incoming = original.canvases.find(canvas => canvas.id === id), input = incoming ?? inputFromCanonicalId(id);
      if (!input || input.kind === "overview") continue;
      const to = canonicalCanvasSurface(from, input);
      if (to === from) continue;
      if (next === state) next = { ...state };
      const source = next[from], destination = next[to], existing = destination.canvases.find(canvas => canvas.id === id);
      const fields = incoming?.draft ?? original.closedDrafts?.[id], savedFields = existing?.draft ?? destination.closedDrafts?.[id];
      const target = original.targets?.[id], savedTarget = destination.targets?.[id];
      const conflict = fields && savedFields && !equalFields(fields, savedFields) || target && savedTarget && !sameTarget(target, savedTarget);
      const recovery = conflict ? [...(destination.recovery ?? []), {
        id: `surface-move-${from}-${id}`, title: input.title,
        reason: "An older surface contains a different draft or target. Its complete version is preserved here.",
        original: { id, surface: from, canvas: incoming, closedDraft: original.closedDrafts?.[id], target, active: original.activeCanvasId === id },
      }] : destination.recovery;
      // Keep the newer target/fields together on a target conflict.
      const targetConflict = target && savedTarget && !sameTarget(target, savedTarget);
      const draft = savedFields ?? (targetConflict ? undefined : fields);
      const canvases = existing ? destination.canvases.map(canvas => canvas.id === id && canvas.kind !== "overview" && draft ? { ...canvas, draft } : canvas)
        : incoming && incoming.kind !== "overview" && !targetConflict ? [...destination.canvases, { ...incoming, ...(draft ? { draft } : {}) }] : destination.canvases;
      const isOpen = canvases.some(canvas => canvas.id === id);
      next[to] = { ...destination, canvases, recovery,
        activeCanvasId: original.activeCanvasId === id && isOpen && destination.activeCanvasId === OVERVIEW_CANVAS_ID ? id : destination.activeCanvasId,
        closedDrafts: isOpen ? without(destination.closedDrafts, id) : draft ? { ...destination.closedDrafts, [id]: draft } : destination.closedDrafts,
        targets: !savedTarget && target ? { ...destination.targets, [id]: target } : destination.targets,
      };
      next[from] = { ...source, canvases: source.canvases.filter(canvas => canvas.id !== id),
        activeCanvasId: source.activeCanvasId === id ? OVERVIEW_CANVAS_ID : source.activeCanvasId,
        closedDrafts: without(source.closedDrafts, id), targets: without(source.targets, id) };
    }
  }
  return next;
}

function surfaceForId(surface: SurfaceId, id: string): SurfaceId {
  const input = inputFromCanonicalId(id);
  return input ? canonicalCanvasSurface(surface, input) : surface;
}

export class SurfaceCanvasStore extends BrowserPersistenceStore<PersistedCanvases> {
  constructor(storageKey: string, initialState: PersistedCanvases = emptyState()) {
    super(storageKey, migrateCanvasSurfaces(initialState), parseState);
  }

  reset = (): void => {
    this.update(() => this.initialState, true);
  };

  private updateSlice(
    surfaceId: SurfaceId,
    update: (slice: SurfaceCanvasSlice) => SurfaceCanvasSlice,
  ): void {
    this.update((current) => ({ ...current, [surfaceId]: update(current[surfaceId]) }));
  }

  /** Open a canvas from a launch-pad affordance. Idempotent by kind+params: if
   *  a matching tab already exists it's focused rather than duplicated;
   *  otherwise the new canvas is appended and activated. */
  canOpenCanvas = (surfaceId: SurfaceId, input: CanvasSpecInput): boolean => {
    surfaceId = canonicalCanvasSurface(surfaceId, input);
    const slice = this.getSnapshot()[surfaceId], id = canvasId(input.kind, input.params);
    return slice.canvases.some(canvas => canvas.id === id) || slice.canvases.length < OPEN_CANVAS_LIMIT;
  };
  /** A closed, previously captured draft may still own this tab's current URL. */
  canViewCanvas = (surfaceId: SurfaceId, input: CanvasSpecInput): boolean => {
    surfaceId = canonicalCanvasSurface(surfaceId, input);
    const slice = this.getSnapshot()[surfaceId], id = canvasId(input.kind, input.params);
    return this.canOpenCanvas(surfaceId, input) || Object.hasOwn(slice.targets ?? {}, id) || Object.hasOwn(slice.closedDrafts ?? {}, id);
  };
  openCanvas = (surfaceId: SurfaceId, input: CanvasSpecInput): boolean => {
    const valid = parseCanvasInput(input);
    if (valid) surfaceId = canonicalCanvasSurface(surfaceId, valid);
    if (!valid || (valid.kind === "org-assessment" && surfaceId !== "govern") || (valid.kind === "capability" && valid.params.surface !== surfaceId) || (valid.kind === "org-resource" && RESOURCE_TYPES[valid.params.resourceType].surface !== surfaceId) || (valid.kind === "work" && returningWorkById(valid.params.workId) && workForCanvas(valid.params)?.surfaceId !== surfaceId)) throw new TypeError("Invalid canvas input");
    if (!this.canOpenCanvas(surfaceId, valid)) return false;
    const id = canvasId(valid.kind, valid.params);
    this.updateSlice(surfaceId, (slice) => {
      const existing = slice.canvases.find((c) => c.id === id);
      return {
        ...slice,
        canvases: existing ? slice.canvases.map((canvas) => canvas.id === id && canvas.kind !== "overview" && !canvas.draft
          ? { ...canvas, draft: slice.closedDrafts?.[id] } : canvas) : [...slice.canvases, { ...valid, id, draft: slice.closedDrafts?.[id] }],
        activeCanvasId: id,
        closedDrafts: Object.fromEntries(Object.entries(slice.closedDrafts ?? {}).filter(([closedId]) => closedId !== id)),
      };
    });
    return true;
  };

  captureTarget = (surfaceId: SurfaceId, id: string, target: WorkspaceTarget): boolean => {
    surfaceId = surfaceForId(surfaceId, id);
    const input = inputFromCanonicalId(id), valid = parseTarget(target);
    if (!input || !valid || !sameTarget(canvasTarget(input, valid), valid)) return false;
    const previous = this.getSnapshot()[surfaceId].targets?.[id];
    if (previous) return sameTarget(previous, valid);
    this.updateSlice(surfaceId, (slice) => ({ ...slice, targets: { ...slice.targets, [id]: valid } }));
    return true;
  };

  copyDraft = (surfaceId: SurfaceId, sourceId: string, input: CanvasSpecInput): boolean => {
    const valid = parseCanvasInput(input);
    if (!valid || valid.kind !== "capability" || valid.params.surface !== surfaceId) return false;
    if (!this.canOpenCanvas(surfaceId, valid)) return false;
    const id = canvasId(valid.kind, valid.params), slice = this.getSnapshot()[surfaceId];
    const open = slice.canvases.find((canvas) => canvas.id === sourceId);
    const recovered = inputFromCanonicalId(sourceId);
    const source = open ?? (recovered && Object.hasOwn(slice.closedDrafts ?? {}, sourceId) ? { ...recovered, draft: slice.closedDrafts?.[sourceId] } : null);
    if (!source || source.kind !== "capability" || source.params.scope !== "unbound" || valid.params.scope !== "project"
      || source.params.capability !== valid.params.capability || source.params.section !== valid.params.section
      || slice.canvases.some((canvas) => canvas.id === id) || Object.hasOwn(slice.closedDrafts ?? {}, id)) return false;
    this.updateSlice(surfaceId, (current) => ({ ...current, canvases: [...current.canvases, { ...valid, id, draft: { ...(source.draft ?? slice.closedDrafts?.[sourceId]) } }], activeCanvasId: id }));
    return true;
  };

  updateDraft = (surfaceId: SurfaceId, id: string, fields: Record<string, string>): void => {
    surfaceId = surfaceForId(surfaceId, id);
    this.updateSlice(surfaceId, (slice) => {
      if (!slice.canvases.some((canvas) => canvas.id === id && canvas.kind !== "overview")) return slice;
      return {
        ...slice,
        canvases: slice.canvases.map((canvas) => canvas.id === id && canvas.kind !== "overview"
          ? { ...canvas, draft: { ...(canvas.draft ?? slice.closedDrafts?.[id]), ...fields } } : canvas),
        closedDrafts: Object.fromEntries(Object.entries(slice.closedDrafts ?? {}).filter(([closedId]) => closedId !== id)),
      };
    });
  };

  /** Close a launched canvas. The pinned overview is not closable, so a request
   *  to close it is a no-op. When the closed tab was active, focus falls to a
   *  sensible neighbor — the tab that slid into its slot (the next one), else
   *  the previous one, else the overview. */
  closeCanvas = (surfaceId: SurfaceId, id: string): void => {
    surfaceId = surfaceForId(surfaceId, id);
    if (id === OVERVIEW_CANVAS_ID) return;
    this.updateSlice(surfaceId, (slice) => {
      const index = slice.canvases.findIndex((c) => c.id === id);
      if (index === -1) return slice;

      const draft = slice.canvases[index]?.draft;
      const canvases = slice.canvases.filter((c) => c.id !== id);
      let activeCanvasId = slice.activeCanvasId;
      if (activeCanvasId === id) {
        const neighbor = canvases[index] ?? canvases[index - 1];
        activeCanvasId = neighbor?.id ?? OVERVIEW_CANVAS_ID;
      }
      return {
        ...slice,
        canvases,
        activeCanvasId,
        closedDrafts: draft ? { ...slice.closedDrafts, [id]: draft } : slice.closedDrafts,
      };
    });
  };

  /** Focus a tab. Ignores ids that don't exist (guards against a stale click
   *  racing a close), except the always-present overview. */
  setActiveCanvas = (surfaceId: SurfaceId, id: string): void => {
    surfaceId = surfaceForId(surfaceId, id);
    this.updateSlice(surfaceId, (slice) => {
      if (id !== OVERVIEW_CANVAS_ID && !slice.canvases.some((c) => c.id === id)) return slice;
      return { ...slice, activeCanvasId: id };
    });
  };
}

/** Profile stores keep a newcomer's workspace separate from the returning demo. */
const stores = new Map<DemoProfileId, SurfaceCanvasStore>();

export function getSurfaceCanvasStore(profileId: DemoProfileId): SurfaceCanvasStore {
  let store = stores.get(profileId);
  if (!store) {
    const initialState = emptyState();
    if (profileId === "am") {
      for (const work of RETURNING_WORK) {
        const input = workCanvasInput(work);
        initialState[work.surfaceId].canvases.push({ ...input, id: canvasId(input.kind, input.params) });
      }
    }
    // Preserve Jordan's existing drafts at the original storage key.
    store = new SurfaceCanvasStore(profileId === "jw" ? STORAGE_KEY : `${STORAGE_KEY}.${profileId}`, initialState);
    stores.set(profileId, store);
  }
  return store;
}
