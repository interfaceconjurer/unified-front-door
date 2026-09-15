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
import { RETURNING_WORK, workCanvasInput } from "@/lib/workspace/returning-work";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  canvasId,
  parseCanvasId,
  isLaunchableKind,
  OVERVIEW_CANVAS_ID,
  type CanvasSpec,
  type CanvasSpecInput,
} from "./model";

/** The surface ids, as data. Typed against `SurfaceId` so adding a surface to
 *  the union without listing it here is a compile error, and kept local (not
 *  imported from the React catalog) so this stays a plain lib module. */
const SURFACE_IDS: readonly SurfaceId[] = ["build", "code", "govern", "alm"];

/** One surface's persisted canvas state: launched canvases in tab order, plus
 *  the active tab id (`OVERVIEW_CANVAS_ID` when the launch pad is focused). */
export type SurfaceCanvasSlice = {
  canvases: CanvasSpec[];
  activeCanvasId: string;
  /** Closing a tab dismisses its view; it doesn't delete an edited draft. */
  closedDrafts?: Record<string, Record<string, string>>;
};

/** The whole persisted store: one slice per surface. Always fully populated
 *  (see `emptyState`/`parseState`), so consumers can index any `SurfaceId`
 *  without a hole check. */
export type PersistedCanvases = Record<SurfaceId, SurfaceCanvasSlice>;

const STORAGE_KEY = "ufd.surface-canvas.v1";

function emptySlice(): SurfaceCanvasSlice {
  return { canvases: [], activeCanvasId: OVERVIEW_CANVAS_ID };
}

function emptyState(): PersistedCanvases {
  return Object.fromEntries(SURFACE_IDS.map((id) => [id, emptySlice()])) as PersistedCanvases;
}

/** Fixed default, one shared reference — this is what SSR and the client's first
 *  hydration render both see, so they can't diverge. Never mutated. */
const EMPTY_STATE: PersistedCanvases = emptyState();

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
function parseCanvas(value: unknown): CanvasSpec | null {
  if (!isRecord(value)) return null;
  if (!isLaunchableKind(value.kind)) return null;
  if (typeof value.title !== "string") return null;
  const params = value.params === undefined ? undefined : sanitizeStringRecord(value.params);
  const draft = value.draft === undefined ? undefined : sanitizeStringRecord(value.draft);
  return { kind: value.kind, title: value.title, params, draft, id: canvasId(value.kind, params) };
}

function parseSlice(value: unknown): SurfaceCanvasSlice {
  if (!isRecord(value)) return emptySlice();
  const canvases = Array.isArray(value.canvases)
    ? value.canvases.map(parseCanvas).filter((c): c is CanvasSpec => c !== null)
    : [];
  // The active id must point at a tab that actually exists after sanitization;
  // anything else (including a dropped canvas) falls back to the overview.
  const activeCanvasId =
    typeof value.activeCanvasId === "string" &&
    (value.activeCanvasId === OVERVIEW_CANVAS_ID ||
      canvases.some((c) => c.id === value.activeCanvasId))
      ? value.activeCanvasId
      : OVERVIEW_CANVAS_ID;
  const closedDrafts = isRecord(value.closedDrafts)
    ? Object.fromEntries(Object.entries(value.closedDrafts)
        .filter(([, draft]) => isRecord(draft))
        .map(([id, draft]) => [id, sanitizeStringRecord(draft)]))
    : undefined;
  return { canvases, activeCanvasId, closedDrafts };
}

/** Keep owned canvas kinds on their surface, including tabs from older builds. */
function canvasSurface(surfaceId: SurfaceId, kind: string, id: string): SurfaceId {
  if (["app", "improvement-project", "project-creation"].includes(kind)) return "alm";
  if (kind === "org-assessment") return "govern";
  if (kind === "work") {
    const work = RETURNING_WORK.find((work) => {
      const input = workCanvasInput(work);
      return canvasId(input.kind, input.params) === id;
    });
    if (work) return work.surfaceId;
  }
  return surfaceId;
}

function migrateSurfaces(saved: PersistedCanvases): PersistedCanvases {
  const result = emptyState();
  for (const source of SURFACE_IDS) {
    for (const canvas of saved[source].canvases) {
      const target = result[canvasSurface(source, canvas.kind, canvas.id)];
      const existing = target.canvases.find((entry) => entry.id === canvas.id);
      if (existing) existing.draft = { ...existing.draft, ...canvas.draft };
      else target.canvases.push({ ...canvas });
      if (saved[source].activeCanvasId === canvas.id) target.activeCanvasId = canvas.id;
    }
    for (const [id, draft] of Object.entries(saved[source].closedDrafts ?? {})) {
      const parsed = parseCanvasId(id);
      const target = result[parsed ? canvasSurface(source, parsed.kind, id) : source];
      target.closedDrafts = { ...target.closedDrafts, [id]: { ...target.closedDrafts?.[id], ...draft } };
    }
  }
  // Prefer an existing selection in the destination over an incoming tab.
  for (const surface of SURFACE_IDS) {
    const active = saved[surface].activeCanvasId;
    if (result[surface].canvases.some((canvas) => canvas.id === active)) result[surface].activeCanvasId = active;
  }
  return result;
}

/** A corrupt/unparseable/wrong-shape blob is treated as "no saved state." The
 *  result always has an entry for every surface, so consumers never index a
 *  hole. This is the only place we deserialize this store's localStorage. */
function parseState(raw: string): PersistedCanvases {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_STATE;
    return migrateSurfaces(Object.fromEntries(
      SURFACE_IDS.map((id) => [id, parseSlice(parsed[id])]),
    ) as PersistedCanvases);
  } catch {
    return EMPTY_STATE;
  }
}

class SurfaceCanvasStore {
  constructor(private storageKey: string, private initialState: PersistedCanvases) {}

  private listeners = new Set<() => void>();
  // Cache keyed by the raw string last read/written, so `getSnapshot` returns a
  // referentially stable object when nothing changed — required by
  // `useSyncExternalStore` to avoid re-rendering (or looping) every call.
  private cachedRaw: string | null = null;
  private cached: PersistedCanvases | null = null;

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => this.listeners.delete(onStoreChange);
  };

  /** Fixed default, same reference every call — SSR and first hydration both
   *  see this, so they can't diverge. */
  getServerSnapshot = (): PersistedCanvases => this.initialState;

  getSnapshot = (): PersistedCanvases => {
    if (typeof window === "undefined") return this.initialState;

    let raw: string | null;
    try {
      raw = window.localStorage.getItem(this.storageKey);
    } catch {
      // Storage disabled/throwing (private mode, etc.) — behave as if empty.
      raw = null;
    }

    if (raw === this.cachedRaw && this.cached) return this.cached;
    this.cachedRaw = raw;
    this.cached = raw === null ? this.initialState : parseState(raw);
    return this.cached;
  };

  /** Read the current snapshot, apply `update`, persist the result. Always
   *  merges against the latest snapshot (not a value a caller holds from a
   *  stale render) — the same "always operate on current state" guarantee a
   *  functional `setState` updater gives. */
  private update(update: (current: PersistedCanvases) => PersistedCanvases): void {
    const next = update(this.getSnapshot());
    this.cached = next;

    if (typeof window !== "undefined") {
      try {
        const raw = JSON.stringify(next);
        window.localStorage.setItem(this.storageKey, raw);
        this.cachedRaw = raw;
      } catch {
        // Quota exceeded / private mode / storage disabled — keep the new value
        // in memory and degrade to in-memory-only rather than crash or lose the
        // open tabs mid-session.
      }
    }

    for (const listener of this.listeners) listener();
  }

  reset = (): void => {
    this.update(() => this.initialState);
  };

  /** Older tool tabs had no owner. Assign them once to the current project,
   * preserving drafts and selection instead of sharing them across projects. */
  adoptUnscopedCanvases = (projectId: string): void => {
    if (!SURFACE_IDS.some((id) => this.getSnapshot()[id].canvases.some((canvas) => !canvas.params?.projectId))) return;
    this.update((current) => Object.fromEntries(SURFACE_IDS.map((surfaceId) => {
      const slice = current[surfaceId];
      let activeCanvasId = slice.activeCanvasId;
      const owned = new Map<string, CanvasSpec>();
      for (const canvas of slice.canvases) {
        const params = canvas.params?.projectId ? canvas.params : { ...canvas.params, projectId };
        const id = canvasId(canvas.kind as CanvasSpecInput["kind"], params);
        if (activeCanvasId === canvas.id) activeCanvasId = id;
        const existing = owned.get(id);
        owned.set(id, { ...canvas, params, id,
          draft: existing ? { ...existing.draft, ...canvas.draft } : canvas.draft });
      }
      return [surfaceId, { ...slice, canvases: [...owned.values()], activeCanvasId }];
    })) as PersistedCanvases);
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
  openCanvas = (surfaceId: SurfaceId, input: CanvasSpecInput): void => {
    const id = canvasId(input.kind, input.params);
    this.updateSlice(canvasSurface(surfaceId, input.kind, id), (slice) => {
      const existing = slice.canvases.some((c) => c.id === id);
      return {
        ...slice,
        canvases: existing ? slice.canvases : [...slice.canvases, { ...input, id, draft: slice.closedDrafts?.[id] }],
        activeCanvasId: id,
      };
    });
  };

  updateDraft = (surfaceId: SurfaceId, id: string, fields: Record<string, string>): void => {
    this.updateSlice(surfaceId, (slice) => ({
      ...slice,
      canvases: slice.canvases.map((canvas) => canvas.id === id
        ? { ...canvas, draft: { ...canvas.draft, ...fields } }
        : canvas),
    }));
  };

  /** Close a launched canvas. The pinned overview is not closable, so a request
   *  to close it is a no-op. When the closed tab was active, focus falls to a
   *  sensible neighbor — the tab that slid into its slot (the next one), else
   *  the previous one, else the overview. */
  closeCanvas = (surfaceId: SurfaceId, id: string): void => {
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
