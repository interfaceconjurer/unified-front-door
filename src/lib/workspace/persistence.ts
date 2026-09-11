import type { DemoProfileId } from "@/lib/demo-profiles";

/**
 * Persisted slice of workspace *selection* state — the three records that used
 * to be plain `useState` in the provider (`activeProjectId`, `worktreeByProject`,
 * `orgByProject`). Deliberately narrow: this is "where the user left off," not a
 * data source — agent transcripts and fixtures stay untouched.
 *
 * Modeled as an external store (subscribe/getSnapshot/getServerSnapshot) so the
 * provider can rehydrate via `useSyncExternalStore` during render instead of an
 * effect — there is no `setState` in an effect body for
 * `react-hooks/set-state-in-effect` to flag, because there's no effect at all.
 * `getServerSnapshot` always returns the fixed default: the server (and the
 * client's first hydration pass) knows nothing about `localStorage`, so the
 * snapshot used there must be identical, or hydration diverges. React applies
 * `getSnapshot`'s real value in a second, dedicated pass after hydration
 * completes — built into `useSyncExternalStore` for exactly this case, not a
 * `setState`-in-effect workaround.
 */

export type PersistedSelection = {
  /** `null` = "no selection persisted yet" — the provider falls back to
   *  `projects[0].id`, the same default the old `useState(projects[0]!.id)` had. */
  activeProjectId: string | null;
  worktreeByProject: Record<string, string>;
  orgByProject: Record<string, string>;
  /** Whether the persistent workspace panel (the left navigator, as opposed to
   *  the ephemeral ⌘⇧P palette) is open — tri-state. `null` means "the user
   *  has never explicitly toggled it," which lets the consumer (`AppShell`)
   *  apply a route-dependent default (open on home, closed elsewhere) instead
   *  of a single fixed one; `true`/`false` means the user explicitly set it
   *  via ⌘B, and that choice is honored on every route until changed again.
   *  Starts `null` so the server render and the client's first hydration pass
   *  agree — same reasoning as the rest of this store. */
  panelOpen: boolean | null;
};

const STORAGE_KEY = "ufd.workspace.v1";

const EMPTY_SELECTION: PersistedSelection = {
  activeProjectId: null,
  worktreeByProject: {},
  orgByProject: {},
  panelOpen: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keep only string values — good enough to not crash on garbage; the
 *  provider's existing `?? fallback` reads still sanitize stale/unknown ids. */
function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

/** A corrupt/unparseable/wrong-shape blob is treated as "no saved state," not
 *  an error — this is the only place we deserialize localStorage's contents. */
function parseSelection(raw: string): PersistedSelection {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_SELECTION;
    return {
      activeProjectId: typeof parsed.activeProjectId === "string" ? parsed.activeProjectId : null,
      worktreeByProject: sanitizeStringRecord(parsed.worktreeByProject),
      orgByProject: sanitizeStringRecord(parsed.orgByProject),
      panelOpen: typeof parsed.panelOpen === "boolean" ? parsed.panelOpen : null,
    };
  } catch {
    return EMPTY_SELECTION;
  }
}

class WorkspaceSelectionStore {
  constructor(private storageKey: string, private initialSelection: PersistedSelection) {}

  private listeners = new Set<() => void>();
  // Cache keyed by the raw string we last read/wrote, so `getSnapshot` returns
  // a referentially stable object when nothing has changed (required by
  // `useSyncExternalStore` to avoid re-rendering — or looping — every call).
  private cachedRaw: string | null = null;
  private cached: PersistedSelection | null = null;

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => this.listeners.delete(onStoreChange);
  };

  /** Fixed default, same reference every call — this is what SSR and the
   *  client's first hydration render both see, so they can't diverge. */
  getServerSnapshot = (): PersistedSelection => this.initialSelection;

  getSnapshot = (): PersistedSelection => {
    if (typeof window === "undefined") return this.initialSelection;

    let raw: string | null;
    try {
      raw = window.localStorage.getItem(this.storageKey);
    } catch {
      // Storage disabled/throwing (private mode, etc.) — behave as if empty.
      raw = null;
    }

    if (raw === this.cachedRaw && this.cached) return this.cached;
    this.cachedRaw = raw;
    this.cached = raw === null ? this.initialSelection : parseSelection(raw);
    return this.cached;
  };

  /** Read the current snapshot, apply `update`, and persist the result —
   *  always merges against the latest snapshot (not a value a caller might be
   *  holding from a stale render), the same "always operate on current state"
   *  guarantee the old `setState(current => ...)` updaters gave. */
  private update(update: (current: PersistedSelection) => PersistedSelection): void {
    const next = update(this.getSnapshot());
    this.cached = next;

    if (typeof window !== "undefined") {
      try {
        const raw = JSON.stringify(next);
        window.localStorage.setItem(this.storageKey, raw);
        this.cachedRaw = raw;
      } catch {
        // Quota exceeded / private mode / storage disabled — keep the new
        // value in memory (`this.cached` above) and degrade to in-memory-only
        // persistence rather than crashing or losing the selection mid-session.
      }
    }

    for (const listener of this.listeners) listener();
  }

  setActiveProjectId = (projectId: string): void => {
    this.update((current) => ({ ...current, activeProjectId: projectId }));
  };

  setWorktreeForProject = (projectId: string, worktreeId: string): void => {
    this.update((current) => ({
      ...current,
      worktreeByProject: { ...current.worktreeByProject, [projectId]: worktreeId },
    }));
  };

  setOrgForProject = (projectId: string, orgId: string): void => {
    this.update((current) => ({
      ...current,
      orgByProject: { ...current.orgByProject, [projectId]: orgId },
    }));
  };

  /** Always writes an explicit true/false — there's no toggle method here
   *  because "toggle" needs the *effective* (route-defaulted) open state,
   *  which this store doesn't know; the caller (`useWorkspacePanel`) resolves
   *  that and calls this with the concrete result. */
  setPanelOpen = (panelOpen: boolean): void => {
    this.update((current) => ({ ...current, panelOpen }));
  };
}

const stores = new Map<DemoProfileId, WorkspaceSelectionStore>();

export function getWorkspaceSelectionStore(profileId: DemoProfileId): WorkspaceSelectionStore {
  let store = stores.get(profileId);
  if (!store) {
    const initialSelection: PersistedSelection = profileId === "am"
      ? { activeProjectId: "trailblazer-crm", worktreeByProject: { "trailblazer-crm": "main" }, orgByProject: { "trailblazer-crm": "uat" }, panelOpen: null }
      : EMPTY_SELECTION;
    store = new WorkspaceSelectionStore(profileId === "jw" ? STORAGE_KEY : `${STORAGE_KEY}.${profileId}`, initialSelection);
    stores.set(profileId, store);
  }
  return store;
}
