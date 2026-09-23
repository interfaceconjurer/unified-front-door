import { workForProfile } from "../workspace/demo-workspace";
import { projectCanvases } from "../surface-canvas/projection";
import type { DemoProfileId } from "../demo-profiles";
import { INITIAL } from "../assessment/state-codec";
import type { DraftEdit, ProjectDraftFields } from "../projects/model";
import { SurfaceCanvasStore, emptyState, type PersistedCanvases } from "../surface-canvas/persistence";
import { preferencesForWorkspace } from "../surface-canvas/workspace-preferences";
import { canvasId, canvasTarget, inputFromCanonicalId, isReadOnlyCanvas, type CanvasSpecInput } from "../surface-canvas/model";
import { canonicalCanvasSurface } from "../surface-canvas/routing";
import { workCanvasInput } from "../workspace/returning-work";
import { WorkspaceSelectionStore } from "../workspace/persistence";
import { conversationKey, UNBOUND_TARGET, type WorkspaceTarget } from "../workspace/context";
import { connectedOrgForProfile, orgsForProfile } from "../workspace/orgs";
import type { SurfaceId } from "../workspace/model";
import { ApplicationError, stableJson, text, type ApplicationSnapshot, type CommandResult, type ImportedSource, type ImportSummary, type LegacySource, type SessionView } from "./contracts";
import { EMPTY_APPLICATION, RemoteWorkspaceStore } from "./remote-store";
import { allocateBuffer } from "./buffer";
import { AgentClient } from "../agent/client";
import type { AgentAcknowledgement, AgentSnapshot, RunView } from "../agent/contracts";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: body === undefined ? {} : { "Content-Type": "application/json", "x-ufd-mutation": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json();
    if (!response.ok) throw new ApplicationError(value.error?.code ?? "unavailable", value.error?.message ?? "Database saving is unavailable.", response.status);
    return value as T;
  } finally { clearTimeout(timer); }
}
export type RecoverableBuffer = { key: string; raw: string; label: string; memoryOnly: boolean; variant?: "disk" };
export type ProfileResetResult = { ok: true } | { ok: false; message: string; retryable: boolean };
type ProfileResetCommand = { action: "reset-profile"; profileId: DemoProfileId; generation: string; commandId: string };
type ClientView = { session: SessionView | null; resolved: boolean; sessionUnavailable: boolean; message: string; legacy: LegacySource | null; summary: ImportSummary | null; recovery: RecoverableBuffer[] | null };
const INITIAL_VIEW: ClientView = { session: null, resolved: false, sessionUnavailable: false, message: "", legacy: null, summary: null, recovery: null };
class ApplicationClient {
  private view = INITIAL_VIEW;
  private listeners = new Set<() => void>();
  private started = false;
  private request = 0;
  private sessionRead: { request: number; promise: Promise<void> } | null = null;
  private changing = false;
  private needsSessionAdoption = false;
  private resettingProfile = false;
  private profileResets = new Map<string, ProfileResetCommand>();
  private archives = new Map<string, RecoverableBuffer>();
  workspace: RemoteWorkspaceStore | null = null;
  canvases: RemoteCanvasStore | null = null;
  private canvasStores = new Map<string, RemoteCanvasStore>();
  selection: WorkspaceSelectionStore | null = null;
  agent: AgentClient | null = null;
  getSnapshot = () => this.view;
  getServerSnapshot = () => INITIAL_VIEW;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Partial<ClientView>) { this.view = { ...this.view, ...value }; for (const listener of this.listeners) listener(); }
  private adopt(session: SessionView | null) {
    if (!this.needsSessionAdoption && stableJson(session) === stableJson(this.view.session)) { this.publish({ resolved: true, sessionUnavailable: false, message: "" }); return; }
    this.needsSessionAdoption = false;
    this.archivePending(); this.workspace?.deactivate();
    for (const store of this.canvasStores.values()) store.dispose();
    this.canvasStores.clear();
    this.agent?.deactivate(); this.workspace = null; this.canvases = null; this.selection = null; this.agent = null;
    if (session?.profileId) {
      let storage: Storage | null = null; try { storage = window.sessionStorage; } catch { /* Queue remains in memory. */ }
      const buffer = allocateBuffer(session, storage);
      this.workspace = new RemoteWorkspaceStore(session, {
        read: (s) => api<ApplicationSnapshot>(`/api/application?generation=${encodeURIComponent(s.generation)}`),
        send: async (s, command) => {
          const result = (await api<{ result: CommandResult }>("/api/application", { generation: s.generation, command })).result;
          // Assessment controls create/change runs outside the agent queue.
          // Observe them immediately instead of waiting for the idle poll.
          if (command.kind.startsWith("assessment.") && this.agent?.session.generation === s.generation) void this.agent.refreshAfterWrite();
          return result;
        },
      }, buffer.key, () => { void this.reconnect(); }, buffer.restoreKey);
      this.canvases = this.canvasStoreFor(UNBOUND_TARGET);
      this.agent = new AgentClient(session, {
        read: () => api<AgentSnapshot>(`/api/agent?generation=${encodeURIComponent(session.generation)}`),
        readRun: (runId, after) => api<{ run: RunView }>(`/api/agent?generation=${encodeURIComponent(session.generation)}&runId=${encodeURIComponent(runId)}&after=${after}`),
        send: async command => (await api<{ result: AgentAcknowledgement }>("/api/agent", { generation: session.generation, command })).result,
      }, () => { if (!this.workspace?.hasPending()) void this.workspace?.load(); }, () => { void this.reconnect(); });
      const selectionKey = `ufd.workspace-preferences.v2.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`;
      this.selection = new WorkspaceSelectionStore(selectionKey, {
        activeProjectId: null, worktreeByProject: {}, orgByProject: {}, panelOpen: null,
        target: { ...UNBOUND_TARGET, orgId: connectedOrgForProfile(session.profileId)?.id ?? null },
      });
      this.workspace.retryPersistence();
    }
    let legacy: LegacySource | null = null;
    if (session?.profileId) try {
      const profileId = session.profileId, assessment = localStorage.getItem(`ufd.org-assessment.v1.${profileId}`), canvases = localStorage.getItem(profileId === "jw" ? "ufd.surface-canvas.v1" : `ufd.surface-canvas.v1.${profileId}`);
      const source = { profileId, assessment, canvases };
      const decisionKey = `ufd.import-decision.v1.${session.namespaceId}.${profileId}`;
      if ((assessment || canvases) && localStorage.getItem(decisionKey) !== stableJson(source)) legacy = source;
    } catch { /* A blocked legacy source is never rewritten or automatically imported. */ }
    this.publish({ session, resolved: true, sessionUnavailable: false, message: "", legacy, summary: null, recovery: null });
  }
  start = () => {
    if (this.started || typeof window === "undefined") return; this.started = true; void this.reconnect();
    window.addEventListener("storage", (event) => { if (event.key === "ufd.session.changed") void this.reconnect(); });
    window.addEventListener("focus", () => { void this.reconnect(); });
    window.setInterval(() => { if (document.visibilityState === "visible" && !this.workspace?.hasPending()) { void this.reconnect(); } }, 5000);
  };
  /** View preferences belong to a conversation/workspace; saved drafts still
   * share the same remote owner and revision stream across those views. */
  canvasStoreFor = (target: WorkspaceTarget): RemoteCanvasStore | null => {
    if (!this.workspace) return null;
    const key = conversationKey(target);
    let store = this.canvasStores.get(key);
    if (!store) {
      store = new RemoteCanvasStore(this.workspace, target);
      this.canvasStores.set(key, store);
    }
    return store;
  };
  reconnect = async () => {
    if (this.resettingProfile || this.changing) return;
    await this.readSession();
  };
  private readSession = (): Promise<void> => {
    // Focus and the five-second poll may coincide, or outpace a slow read.
    // Share that read so polling cannot continually invalidate its response.
    // Account mutations increment request, so their reconciliation starts fresh.
    if (this.sessionRead?.request === this.request) return this.sessionRead.promise;
    const request = ++this.request;
    const promise = this.loadSession(request).finally(() => {
      if (this.sessionRead?.request === request) this.sessionRead = null;
    });
    this.sessionRead = { request, promise };
    return promise;
  };
  private async loadSession(request: number) {
    try {
      let response = await api<{ session: SessionView | null }>("/api/session");
      if (request !== this.request) return;
      if (!response.session) response = await api<{ session: SessionView }>("/api/session", { action: "bootstrap" });
      if (request !== this.request) return;
      const reused = !this.needsSessionAdoption && stableJson(this.view.session) === stableJson(response.session);
      this.adopt(response.session);
      if (reused && this.workspace && (!this.workspace.isReady() || !this.workspace.hasPending())) {
        if (this.workspace.isReady()) await this.workspace.load();
        else await this.workspace.retryPersistence();
      }
    } catch (error) { if (request === this.request) this.publish({
      // An unavailable read cannot confirm either a sign-out or a workspace
      // handoff. Keep an already loaded workspace, but never reveal a stale one
      // after an account change whose outcome is still unknown.
      resolved: this.view.resolved && !this.needsSessionAdoption,
      sessionUnavailable: true, message: error instanceof Error ? error.message : "Database connection is unavailable.",
    }); }
  };
  change = async (action: "select" | "signout" | "reset", profileId?: DemoProfileId, orgId?: string): Promise<boolean> => {
    if (this.resettingProfile || this.changing) return false;
    if (action === "select" && orgId !== undefined && (!profileId || !orgsForProfile(profileId).some(org => org.id === orgId && org.connection === "connected"))) return false;
    if (!this.view.session) { await this.reconnect(); if (!this.view.session) return false; }
    if (this.resettingProfile || this.changing) return false;
    const request = ++this.request, current = this.view.session;
    this.changing = true; this.needsSessionAdoption = true;
    this.workspace?.flushEdits(); this.archivePending(); this.workspace?.deactivate(); this.agent?.deactivate();
    try {
      const response = await api<{ session: SessionView }>("/api/session", { action, generation: current.generation, commandId: crypto.randomUUID(), ...(profileId ? { profileId } : {}) });
      if (request !== this.request) return false;
      this.adopt(response.session);
      if (action === "select" && response.session.profileId === profileId && profileId) {
        const org = connectedOrgForProfile(profileId, orgId ?? this.selection?.getSnapshot().target?.orgId);
        if (org) this.selection?.setTarget({ ...UNBOUND_TARGET, orgId: org.id });
      }
      try { localStorage.setItem("ufd.session.changed", crypto.randomUUID()); } catch { /* Focus/polling also reconcile session changes. */ }
      return true;
    } catch (error) {
      if (request === this.request) {
        await this.readSession();
        this.publish({ message: this.view.session?.generation !== current.generation
          ? "Reconnected to the current demo session. The previous session change may have completed; review the current workspace before requesting another change."
          : error instanceof Error ? error.message : "The session change could not be confirmed." });
      }
      return false;
    } finally { this.changing = false; }
  };
  clearProfile = async (profileId: DemoProfileId, expectedNamespaceId: string | undefined): Promise<ProfileResetResult> => {
    const current = this.view.session;
    if (!current || current.namespaceId !== expectedNamespaceId) return { ok: false, retryable: false, message: "Your demo session changed. Close this dialog and choose Clear data again." };
    if (this.resettingProfile || this.changing) return { ok: false, retryable: true, message: "Another account change is still in progress. Try again when it finishes." };
    const key = `ufd.profile-reset.v1.${current.namespaceId}.${profileId}`;
    let command = this.profileResets.get(key);
    if (!command) {
      let raw: string | null = null;
      try { raw = window.sessionStorage.getItem(key); } catch { /* Retain retry identity in memory when storage is unavailable. */ }
      if (raw !== null) {
        try {
          const saved = JSON.parse(raw);
          if (!saved || typeof saved !== "object" || Array.isArray(saved) || Object.keys(saved).length !== 4 || saved.action !== "reset-profile" || saved.profileId !== profileId || !text(saved.generation) || !text(saved.commandId, 200)) throw new Error();
          command = { action: "reset-profile", profileId, generation: saved.generation, commandId: saved.commandId };
        } catch { return { ok: false, retryable: false, message: "The previous clear request could not be read. No new clear request was sent." }; }
      } else command = { action: "reset-profile", profileId, generation: current.generation, commandId: crypto.randomUUID() };
      this.profileResets.set(key, command);
      try { window.sessionStorage.setItem(key, JSON.stringify(command)); } catch { /* The current tab still retains the exact request. */ }
    }
    const forget = () => {
      this.profileResets.delete(key);
      try { window.sessionStorage.removeItem(key); } catch { /* A retained receipt makes a later replay harmless. */ }
    };
    ++this.request; this.resettingProfile = true;
    // Clearing another profile must not interrupt the selected workspace.
    if (current.profileId === profileId) {
      this.changing = true; this.needsSessionAdoption = true;
      this.workspace?.flushEdits(); this.archivePending(); this.workspace?.deactivate(); this.agent?.deactivate();
    }
    try {
      const response = await api<{ session: SessionView }>("/api/session", command);
      this.adopt(response.session); forget();
      try { localStorage.setItem("ufd.session.changed", crypto.randomUUID()); } catch { /* Focus/polling also reconcile changes. */ }
      return { ok: true };
    } catch (error) {
      const rejected = error instanceof ApplicationError && error.status < 500;
      if (rejected) forget();
      await this.readSession();
      return { ok: false, retryable: !rejected, message: rejected
        ? "Your demo session changed or the request was rejected. Close this dialog and choose Clear data again."
        : "We couldn’t confirm whether the data was cleared. Retry clear to check the same request safely." };
    } finally { this.resettingProfile = false; this.changing = false; }
  };
  previewImport = async () => {
    const { session, legacy } = this.view; if (!session || !legacy) return;
    try {
      const response = await api<{ summary: ImportSummary }>("/api/application", { generation: session.generation, preview: true, command: { kind: "legacy.import", source: legacy, commandId: crypto.randomUUID(), expectedRevision: this.workspace?.getSnapshot().assessmentRevision ?? 0 } });
      if (this.view.session?.generation === session.generation) this.publish({ summary: response.summary, message: "" });
    } catch (error) { if (this.view.session?.generation === session.generation) this.publish({ message: error instanceof Error ? error.message : "The source could not be previewed." }); }
  };
  dismissImport = () => {
    const { session, legacy } = this.view; if (session && legacy) try { localStorage.setItem(`ufd.import-decision.v1.${session.namespaceId}.${session.profileId}`, stableJson(legacy)); } catch { /* Source remains available. */ }
    this.publish({ legacy: null, summary: null });
  };
  importLegacy = async () => {
    const { session, legacy } = this.view; if (!session || !legacy || !this.view.summary || !this.workspace) return;
    const result = await this.workspace.enqueue({ kind: "legacy.import", source: legacy });
    if (result?.imported && this.view.session?.generation === session.generation) { this.dismissImport(); this.publish({ message: "Browser data was imported. Its original browser copy is preserved." }); }
  };
  exportImportedSource = async (sourceHash: string): Promise<ImportedSource | null> => {
    const session = this.view.session; if (!session?.profileId) return null;
    try {
      const result = await api<ImportedSource>(`/api/application/import-source?generation=${encodeURIComponent(session.generation)}&sourceHash=${encodeURIComponent(sourceHash)}`);
      return stableJson(this.view.session) === stableJson(session) ? result : null;
    } catch (error) {
      if (stableJson(this.view.session) === stableJson(session)) this.publish({ message: error instanceof Error ? error.message : "The preserved source is unavailable." });
      return null;
    }
  };
  private archivePending() {
    const workspace = this.workspace; if (!workspace) return;
    if (!workspace.hasPending()) { this.archives.delete(workspace.storageKey); return; }
    const raw = JSON.stringify({ session: workspace.session, commands: workspace.getPending() });
    this.archives.set(workspace.storageKey, { key: workspace.storageKey, raw, label: this.bufferLabel(raw), memoryOnly: true });
  }
  private bufferLabel(raw: string) {
    try { const value = JSON.parse(raw); const current = value.session?.generation === this.view.session?.generation; return `${value.session?.profileId ?? "Unknown profile"} · workspace ${String(value.session?.namespaceId ?? "unknown").slice(0, 8)} · ${current ? "current" : "previous"} session ${String(value.session?.generation ?? "unknown").slice(0, 8)} · ${Array.isArray(value.commands) ? value.commands.length : "unknown"} unconfirmed commands`; }
    catch { return "Unreadable pending-edit buffer · original bytes preserved"; }
  }
  showRecovery = () => {
    this.archivePending(); const buffers = new Map(this.archives);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i); if (!key?.startsWith("ufd.pending.v1.")) continue;
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const memory = buffers.get(key), differs = memory && memory.raw !== raw;
          buffers.set(differs ? `disk:${key}` : key, { key, raw, label: this.bufferLabel(raw), memoryOnly: false, ...(differs ? { variant: "disk" as const } : {}) });
        }
      }
    } catch { this.publish({ message: "Browser storage is unavailable. Export any pending edits held in this tab before closing it." }); }
    this.publish({ recovery: [...buffers.values()] });
  };
  hideRecovery = () => this.publish({ recovery: null });
  discardRecovery = (entry: RecoverableBuffer) => {
    if (entry.key === this.workspace?.storageKey && this.workspace.hasPending()) { this.publish({ message: "Use the saved-version recovery action to discard this active queue safely." }); return; }
    try { if (localStorage.getItem(entry.key) === entry.raw) localStorage.removeItem(entry.key); } catch { /* A memory copy can still be exported. */ }
    this.workspace?.recoverDiscardedBuffer(entry.key, entry.raw);
    if (this.archives.get(entry.key)?.raw === entry.raw) this.archives.delete(entry.key); this.showRecovery();
  };
}
export const applicationClient = new ApplicationClient();

class RemoteCanvasStore {
  readonly location = "server" as const;
  private prefs: SurfaceCanvasStore;
  private snapshot: PersistedCanvases;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private stopPrefs: () => void;
  constructor(private remote: RemoteWorkspaceStore, workspace: WorkspaceTarget) {
    const initial = emptyState(), session = remote.session;
    for (const work of workForProfile(session.profileId!)) { const input = workCanvasInput(work); initial[work.surfaceId].canvases.push({ ...input, id: canvasId(input.kind, input.params) }); }
    const owner = `${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}`;
    const legacy = new SurfaceCanvasStore(`ufd.canvas-preferences.v2.${owner}`, initial).getSnapshot();
    this.prefs = new SurfaceCanvasStore(`ufd.canvas-preferences.v3.${owner}.${conversationKey(workspace)}`, preferencesForWorkspace(legacy, workspace));
    this.snapshot = this.prefs.getSnapshot();
    this.unsubscribe = remote.subscribe(this.refresh); this.stopPrefs = this.prefs.subscribe(this.refresh); this.refresh();
  }
  dispose = () => { this.unsubscribe(); this.stopPrefs(); };
  private refresh = () => {
    this.snapshot = projectCanvases(this.snapshot, this.prefs.getSnapshot(), this.remote.getSnapshot().canvases);
    for (const listener of this.listeners) listener();
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.prefs.getServerSnapshot();
  getPersistenceSnapshot = () => this.remote.getPersistenceSnapshot();
  getServerPersistenceSnapshot = () => this.remote.getServerPersistenceSnapshot();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  retryPersistence = () => this.remote.retryPersistence();
  keepLocalChanges = () => this.remote.keepLocalChanges();
  useSavedVersion = () => this.remote.useSavedVersion();
  pendingLocation = () => this.remote.pendingLocation();
  canKeepLocalChanges = () => this.remote.canKeepLocalChanges();
  getError = () => this.remote.getError();
  hasBufferFailure = () => this.remote.hasBufferFailure();
  openCanvas = (surface: SurfaceId, input: CanvasSpecInput) => this.prefs.openCanvas(surface, input);
  canOpenCanvas = (surface: SurfaceId, input: CanvasSpecInput) => this.prefs.canOpenCanvas(surface, input);
  canViewCanvas = (surface: SurfaceId, input: CanvasSpecInput) => {
    surface = canonicalCanvasSurface(surface, input);
    const slice = this.snapshot[surface], id = canvasId(input.kind, input.params);
    return this.canOpenCanvas(surface, input) || Object.hasOwn(slice.targets ?? {}, id) || Object.hasOwn(slice.closedDrafts ?? {}, id);
  };
  closeCanvas = (surface: SurfaceId, id: string) => this.prefs.closeCanvas(surface, id);
  setActiveCanvas = (surface: SurfaceId, id: string) => this.prefs.setActiveCanvas(surface, id);
  captureTarget = (surface: SurfaceId, id: string, target: WorkspaceTarget): boolean => {
    const canvas = inputFromCanonicalId(id);
    if (canvas) surface = canonicalCanvasSurface(surface, canvas);
    const previous = this.snapshot[surface].targets?.[id]; if (previous && stableJson(previous) !== stableJson(target)) return false;
    if (!this.prefs.captureTarget(surface, id, target)) return false;
    // Browsing metadata persists only tab/target preferences. Editable object
    // overlays start saving on an explicit field addition, never on opening.
    if (canvas && canvas.kind !== "org-resource" && !isReadOnlyCanvas(canvas) && !this.remote.getSnapshot().canvases.some((c) => c.id === id)) void this.remote.enqueue({ kind: "canvas.save", canvas, surface, target, fields: {} });
    return true;
  };
  updateDraft = (surface: SurfaceId, id: string, fields: Record<string, string>) => {
    const input = inputFromCanonicalId(id);
    if (input) surface = canonicalCanvasSurface(surface, input);
    const canvas = this.snapshot[surface].canvases.find((c) => c.id === id) ?? inputFromCanonicalId(id);
    if (!canvas || canvas.kind === "overview" || isReadOnlyCanvas(canvas)) return;
    const target = this.snapshot[surface].targets?.[id] ?? canvasTarget(canvas, { projectId: null, worktreeId: null, orgId: null });
    void this.remote.enqueueEdit({ kind: "canvas.save", canvas, surface, target, fields });
  };
  copyDraft = async (surface: SurfaceId, sourceId: string, canvas: CanvasSpecInput): Promise<boolean> => {
    if (isReadOnlyCanvas(canvas) || !this.canOpenCanvas(surface, canvas)) return false;
    const source = this.remote.getSnapshot().canvases.find((c) => c.id === sourceId);
    if (!source || this.remote.hasPending()) return false;
    const target = canvasTarget(canvas, { projectId: null, worktreeId: null, orgId: null });
    return !!await this.remote.enqueue({ kind: "canvas.copy", sourceId, sourceRevision: source.revision, canvas, surface, target });
  };
}
const emptyCanvasStore = new SurfaceCanvasStore("ufd.anonymous.preferences");
const emptySelection = new WorkspaceSelectionStore("ufd.anonymous.workspace");
export function getActiveCanvasStore(profile?: DemoProfileId, workspace: WorkspaceTarget = UNBOUND_TARGET) { return profile && applicationClient.getSnapshot().session?.profileId !== profile ? emptyCanvasStore : applicationClient.canvasStoreFor(workspace) ?? emptyCanvasStore; }
export function getActiveSelectionStore(profile?: DemoProfileId) { return profile && applicationClient.getSnapshot().session?.profileId !== profile ? emptySelection : applicationClient.selection ?? emptySelection; }

const noopSubscribe = () => () => {};
function assessmentAdapter(workspace: RemoteWorkspaceStore | null) { return {
  location: "server" as const,
  subscribe: (listener: () => void) => workspace?.subscribe(listener) ?? noopSubscribe(),
  getSnapshot: () => workspace?.getSnapshot().assessment ?? INITIAL,
  getServerSnapshot: () => INITIAL,
  getPersistenceSnapshot: () => workspace?.getPersistenceSnapshot() ?? "loading" as const,
  getServerPersistenceSnapshot: () => "loading" as const,
  retryPersistence: () => workspace?.retryPersistence(),
  keepLocalChanges: () => workspace?.keepLocalChanges(),
  useSavedVersion: () => workspace?.useSavedVersion(),
  pendingLocation: () => workspace?.pendingLocation() ?? "",
  canKeepLocalChanges: () => workspace?.canKeepLocalChanges() ?? false,
  getError: () => workspace?.getError() ?? "",
  hasBufferFailure: () => workspace?.hasBufferFailure() ?? false,
  start: () => { void workspace?.enqueue({ kind: "assessment.start" }); },
  advance: () => { if (!workspace?.hasPending()) void workspace?.enqueue({ kind: "assessment.advance" }); },
  pause: () => { void workspace?.enqueue({ kind: "assessment.pause" }); },
  rescan: (orgIds: string[]) => { void workspace?.enqueue({ kind: "assessment.rescan", orgIds }); },
  isBeginningDraft: () => workspace?.getPending().some(command => command.kind === "draft.begin") ?? false,
  isCreatingProject: (draftId: string) => workspace?.getPending().some(command => command.kind === "project.create" && command.draftId === draftId) ?? false,
  isCreatingFromBrief: (sourceId: string) => workspace?.getPending().some(command => command.kind === "project.createFromBrief" && command.sourceId === sourceId) ?? false,
  createFromBrief: async (sourceId: string) => {
    if (!workspace || workspace.getPersistenceSnapshot() !== "saved") return null;
    const source = workspace.getSnapshot().canvases.find(canvas => canvas.id === sourceId);
    if (!source?.revision) return null;
    return (await workspace.enqueue({ kind: "project.createFromBrief", sourceId, sourceRevision: source.revision }))?.project ?? null;
  },
  beginDraft: async (runId: string, fields: ProjectDraftFields) => {
    const result = await workspace?.enqueue({ kind: "draft.begin", runId, fields });
    return result ? workspace?.getSnapshot().assessment.draft ?? null : null;
  },
  editDraft: (draftId: string, edit: DraftEdit) => { void workspace?.enqueueEdit({ kind: "draft.edit", draftId, edit }); },
  discardDraft: (draftId: string) => { void workspace?.enqueue({ kind: "draft.discard", draftId }); },
  createProject: async (_owner: string, command: { draftId: string; commandId: string; expectedRevision: number }) => (await workspace?.enqueue({ kind: "project.create", draftId: command.draftId, draftRevision: command.expectedRevision }, command.commandId))?.project ?? null,
  setWorkItemStatus: (projectId: string, itemId: string, status: "todo" | "in-progress" | "done") => { void workspace?.enqueue({ kind: "work.status", projectId, itemId, status }); },
}; }
const emptyAssessment = assessmentAdapter(null);
const assessmentAdapters = new WeakMap<RemoteWorkspaceStore, ReturnType<typeof assessmentAdapter>>();
export function getActiveAssessmentStore() { const workspace = applicationClient.workspace; if (!workspace) return emptyAssessment; let store = assessmentAdapters.get(workspace); if (!store) { store = assessmentAdapter(workspace); assessmentAdapters.set(workspace, store); } return store; }

export function getApplicationSnapshot() { return applicationClient.workspace?.getSnapshot() ?? EMPTY_APPLICATION; }
