import { BrowserPersistenceStore, type Decoded } from "../browser-persistence";
import { parseTarget, type WorkspaceTarget } from "./context";
import type { DemoProfileId } from "@/lib/demo-profiles";
import { destinationHref, readDestination, type Destination } from "../navigation/model";
import { sessionKey } from "./model";

/**
 * Persisted workspace selection and last destination per project/worktree.
 * Deliberately narrow: this is "where the user left off," not a
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
  /** `null` is the global workspace. */
  activeProjectId: string | null;
  worktreeByProject: Record<string, string>;
  orgByProject: Record<string, string>;
  /** Unset legacy preferences and fresh workspaces both start closed. */
  panelOpen: boolean | null;
  /** Latest accepted view, including global browsing, for profile re-entry. */
  lastDestination?: string;
  /** Manual surface-panel visibility; navigation to a surface reveals it. */
  surfacePanelOpen?: boolean;
  /** Explicit target, including deliberate unbound, supersedes legacy preferences. */
  target?: WorkspaceTarget;
  /** Last view per project/worktree. Contains navigation only, never draft content. */
  destinationsBySession?: Record<string, string>;
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

/** Legacy selection payloads are sanitized; unrelated shapes are protected. */
function parseSelection(parsed: unknown): Decoded<PersistedSelection> {
  if (!isRecord(parsed) || !["activeProjectId", "worktreeByProject", "orgByProject", "panelOpen"].some((key) => key in parsed)) return { error: "invalid" };
  const target = parsed.target === undefined ? undefined : parseTarget(parsed.target);
  if (target === null) return { error: "invalid" };
  return { value: {
    ...(target ? { target } : {}),
    activeProjectId: typeof parsed.activeProjectId === "string" ? parsed.activeProjectId : null,
    worktreeByProject: sanitizeStringRecord(parsed.worktreeByProject),
    orgByProject: sanitizeStringRecord(parsed.orgByProject),
    ...(parsed.destinationsBySession === undefined ? {} : { destinationsBySession: sanitizeStringRecord(parsed.destinationsBySession) }),
    panelOpen: typeof parsed.panelOpen === "boolean" ? parsed.panelOpen : null,
    ...(typeof parsed.lastDestination === "string" ? { lastDestination: parsed.lastDestination } : {}),
    ...(typeof parsed.surfacePanelOpen === "boolean" ? { surfacePanelOpen: parsed.surfacePanelOpen } : {}),
  } };
}

export class WorkspaceSelectionStore extends BrowserPersistenceStore<PersistedSelection> {
  constructor(storageKey: string, initialSelection: PersistedSelection = EMPTY_SELECTION) {
    super(storageKey, initialSelection, parseSelection);
  }

  reset = (): void => {
    this.update(() => this.initialState, true);
  };

  setTarget = (target: WorkspaceTarget): void => {
    this.update((current) => ({ ...current, target, activeProjectId: target.projectId,
      worktreeByProject: target.projectId && target.worktreeId ? { ...current.worktreeByProject, [target.projectId]: target.worktreeId } : current.worktreeByProject,
      orgByProject: target.projectId && target.orgId ? { ...current.orgByProject, [target.projectId]: target.orgId } : current.orgByProject,
    }));
  };

  rememberDestination = (destination: Destination): void => {
    const { projectId, worktreeId } = destination.target;
    const href = destinationHref(destination);
    this.update(current => {
      if (!projectId) return current.lastDestination === href ? current : { ...current, lastDestination: href };
      const key = sessionKey(projectId, worktreeId);
      if (current.lastDestination === href && current.destinationsBySession?.[key] === href) return current;
      const entries = Object.entries(current.destinationsBySession ?? {}).filter(([id]) => id !== key);
      return { ...current, lastDestination: href, destinationsBySession: Object.fromEntries([...entries.slice(-99), [key, href]]) };
    });
  };

  destinationFor = (owner: DemoProfileId, projectId: string, worktreeId: string | null): Destination | null => {
    const href = this.getSnapshot().destinationsBySession?.[sessionKey(projectId, worktreeId)];
    if (!href) return null;
    const decoded = readDestination(href);
    return decoded.kind === "destination" && decoded.value.owner === owner
      && decoded.value.target.projectId === projectId && decoded.value.target.worktreeId === worktreeId ? decoded.value : null;
  };

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

  setPanelOpen = (panelOpen: boolean): void => {
    this.update((current) => ({ ...current, panelOpen }));
  };

  setSurfacePanelOpen = (surfacePanelOpen: boolean): void => {
    this.update(current => current.surfacePanelOpen === surfacePanelOpen ? current : { ...current, surfacePanelOpen });
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
