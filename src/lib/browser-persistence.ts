/** Browser persistence is a single-writer demo convenience, not a transaction system. */
export type PersistenceStatus = "saving" | "loading" | "absent" | "saved" | "unsaved" | "unavailable" | "invalid" | "unsupported" | "conflict";

export type PersistenceControls = {
  location?: "server" | "browser";
  pendingLocation?: () => string;
  canKeepLocalChanges?: () => boolean;
  getError?: () => string;
  hasBufferFailure?: () => boolean;
  subscribe: (listener: () => void) => () => void;
  getPersistenceSnapshot: () => PersistenceStatus;
  getServerPersistenceSnapshot: () => PersistenceStatus;
  retryPersistence: () => void;
  keepLocalChanges: () => void;
  useSavedVersion: () => void;
};

export type Decoded<T> = { value: T } | { error: "invalid" | "unsupported" };
const CHANGE_EVENT = "ufd:persistence-change";

export function isStorageRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** v1 keeps existing keys. Raw legacy data is decoded but never rewritten on read. */
function decode<T>(raw: string, parse: (value: unknown) => Decoded<T>, legacyText?: (raw: string) => T | undefined): Decoded<T> {
  const legacy = legacyText?.(raw);
  if (legacy !== undefined) return { value: legacy };
  try {
    const value: unknown = JSON.parse(raw);
    if (isStorageRecord(value) && "__ufd" in value) {
      if (value.__ufd !== 1) return { error: "unsupported" };
      return parse(value.data);
    }
    return parse(value);
  } catch {
    return { error: "invalid" };
  }
}

export class BrowserPersistenceStore<T> implements PersistenceControls {
  private cached: T;
  private baseRaw: string | null | undefined;
  private dirty = false;
  private status: PersistenceStatus = "loading";
  private listeners = new Set<() => void>();
  private eventWindow: Window | undefined;

  constructor(
    private storageKey: string,
    protected initialState: T,
    private parse: (value: unknown) => Decoded<T>,
    private options: { serverState?: T; legacyText?: (raw: string) => T | undefined } = {},
  ) {
    this.cached = initialState;
  }

  getServerSnapshot = (): T => "serverState" in this.options ? this.options.serverState as T : this.initialState;
  getServerPersistenceSnapshot = (): PersistenceStatus => "loading";

  // Snapshot reads may refresh caches, but never publish or write during render.
  getSnapshot = (): T => {
    if (typeof window === "undefined") return this.getServerSnapshot();
    this.refresh();
    return this.cached;
  };
  getPersistenceSnapshot = (): PersistenceStatus => {
    if (typeof window === "undefined") return "loading";
    this.refresh();
    return this.status;
  };

  private read(): { raw: string | null } | undefined {
    try {
      if (typeof window === "undefined") throw new Error("No browser storage");
      return { raw: window.localStorage.getItem(this.storageKey) };
    } catch {
      this.status = "unavailable";
      return undefined;
    }
  }

  private refresh(): void {
    const result = this.read();
    if (!result) return;
    const { raw } = result;
    if (raw === this.baseRaw) {
      this.status = this.dirty ? "unsaved" : raw === null ? "absent" : "saved";
      return;
    }
    const parsed = raw === null ? { value: this.initialState } : decode(raw, this.parse, this.options.legacyText);
    if ("error" in parsed) {
      this.status = parsed.error;
      return; // Keep both the unreadable raw data and any cached local edits.
    }
    if (this.dirty) {
      // An initially failed read establishes no authority over existing data.
      if (this.baseRaw === undefined && raw === null) this.baseRaw = null;
      this.status = raw === this.baseRaw ? "unsaved" : "conflict";
      return;
    }
    if (raw !== this.baseRaw) this.cached = parsed.value;
    this.baseRaw = raw;
    this.status = raw === null ? "absent" : "saved";
  }

  protected update(change: (current: T) => T, force = false): void {
    if (typeof window === "undefined") return;
    this.refresh();
    const next = change(this.cached);
    if (next === this.cached && !force) { this.publish(); return; }
    this.cached = next;
    this.dirty = true;
    this.persist(false);
    this.publish();
  }

  private persist(overwrite: boolean): void {
    const result = this.read();
    if (!result) return;
    const { raw } = result;
    if (!overwrite) {
      const parsed = raw === null ? { value: this.initialState } : decode(raw, this.parse, this.options.legacyText);
      if ("error" in parsed) { this.status = parsed.error; return; }
      if (this.baseRaw === undefined && raw === null) this.baseRaw = null;
      if (raw !== this.baseRaw) { this.status = "conflict"; return; }
    }
    try {
      const nextRaw = this.cached === null ? null : JSON.stringify({ __ufd: 1, data: this.cached });
      if (nextRaw === null) window.localStorage.removeItem(this.storageKey);
      else window.localStorage.setItem(this.storageKey, nextRaw);
      this.baseRaw = nextRaw;
      this.dirty = false;
      this.status = nextRaw === null ? "absent" : "saved";
      window.dispatchEvent?.(new CustomEvent(CHANGE_EVENT, { detail: { key: this.storageKey, source: this } }));
    } catch {
      this.status = "unavailable";
    }
  }

  retryPersistence = (): void => {
    this.refresh();
    if (this.dirty) this.persist(false);
    this.publish();
  };

  /** Explicit user decision: replace the currently stored value with this tab's value. */
  keepLocalChanges = (): void => {
    this.dirty = true;
    this.persist(true);
    this.publish();
  };

  /** Explicit user decision: discard local edits, but only after a valid read. */
  useSavedVersion = (): void => {
    const result = this.read();
    if (result) {
      const parsed = result.raw === null ? { value: this.initialState } : decode(result.raw, this.parse, this.options.legacyText);
      if ("error" in parsed) this.status = parsed.error;
      else {
        this.cached = parsed.value;
        this.baseRaw = result.raw;
        this.dirty = false;
        this.status = result.raw === null ? "absent" : "saved";
      }
    }
    this.publish();
  };

  private publish(): void {
    for (const listener of this.listeners) listener();
  }

  private onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== this.storageKey) return;
    try { if (event.storageArea !== null && event.storageArea !== window.localStorage) return; }
    catch { /* A blocked localStorage getter is handled by refresh. */ }
    this.refresh();
    this.publish();
  };

  private onSameWindow = (event: Event): void => {
    const detail = (event as CustomEvent<{ key: string; source: unknown }>).detail;
    if (detail?.key !== this.storageKey || detail.source === this) return;
    this.refresh();
    this.publish();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.eventWindow && typeof window !== "undefined") {
      this.eventWindow = window;
      window.addEventListener("storage", this.onStorage);
      window.addEventListener(CHANGE_EVENT, this.onSameWindow);
    }
    // Catch events between render and subscribe without notifying during getSnapshot.
    this.refresh();
    listener();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size && this.eventWindow) {
        this.eventWindow.removeEventListener("storage", this.onStorage);
        this.eventWindow.removeEventListener(CHANGE_EVENT, this.onSameWindow);
        this.eventWindow = undefined;
      }
    };
  };
}
