import { INITIAL } from "../assessment/state-codec";
import { demoProfileById } from "../demo-profiles";
import type { PersistenceControls, PersistenceStatus } from "../browser-persistence";
import { applyAssessmentCommand } from "./assessment-commands";
import { aggregateKey, ApplicationError, parseCommand, record, stableJson, type ApplicationCommand, type ApplicationOperation, type ApplicationSnapshot, type CommandResult, type SessionView } from "./contracts";
import { canvasId } from "../surface-canvas/model";
import { canonicalCanvasSurface } from "../surface-canvas/routing";

export type RemoteTransport = { read: (session: SessionView) => Promise<ApplicationSnapshot>; send: (session: SessionView, command: ApplicationCommand) => Promise<CommandResult> };
export const EMPTY_APPLICATION: ApplicationSnapshot = { session: { namespaceId: "", profileId: null, generation: "", expiresAt: "" }, assessment: INITIAL, assessmentRevision: 0, canvases: [], imports: [] };

/** One generation and browser tab owns this queue. It can never be rebound to another session. */
export class RemoteWorkspaceStore implements PersistenceControls {
  readonly location = "server" as const;
  private saved = EMPTY_APPLICATION;
  private projected = EMPTY_APPLICATION;
  private pending: ApplicationCommand[] = [];
  private listeners = new Set<() => void>();
  private status: PersistenceStatus = "loading";
  private error = "";
  private sending = false;
  private active = true;
  private request = 0;
  private blocked = false;
  private bufferInvalid = false;
  private bufferAvailable = true;
  private restoredSource: { key: string; raw: string } | null = null;
  private malformedSource: { key: string; raw: string } | null = null;
  private completions = new Map<string, (result: CommandResult | null) => void>();
  private results = new Map<string, Promise<CommandResult | null>>();
  private immutable = new Set<string>();
  private encodedCommands = new WeakMap<ApplicationCommand, string>();
  private encodedSession: string;
  private editTimer: ReturnType<typeof setTimeout> | undefined;
  private editStarted = 0;
  constructor(readonly session: SessionView, private transport: RemoteTransport, readonly storageKey: string, private sessionChanged: () => void, restoreKey?: string) {
    this.encodedSession = JSON.stringify(session);
    if (typeof window === "undefined") return;
    window.addEventListener?.("pagehide", this.flushEdits);
    window.addEventListener?.("focusout", this.flushEdits);
    let raw: string | null, key = storageKey;
    try {
      raw = window.localStorage.getItem(storageKey);
      if (raw === null && restoreKey) { key = restoreKey; raw = window.localStorage.getItem(key); if (raw !== null) this.restoredSource = { key, raw }; }
    } catch { this.bufferAvailable = false; return; }
    if (raw !== null) {
      try {
        const value: unknown = JSON.parse(raw);
        if (!record(value) || stableJson(value.session) !== stableJson(session) || !Array.isArray(value.commands)) throw new Error("Invalid pending edits");
        this.pending = value.commands.map(parseCommand);
        for (const command of this.pending) this.immutable.add(command.commandId);
      } catch { this.malformedSource = { key, raw }; this.bufferInvalid = true; this.status = "invalid"; }
    }
  }
  getSnapshot = () => this.projected;
  getServerSnapshot = () => EMPTY_APPLICATION;
  getPersistenceSnapshot = () => this.status;
  getServerPersistenceSnapshot = (): PersistenceStatus => "loading";
  getError = () => this.error;
  isReady = () => this.saved !== EMPTY_APPLICATION;
  hasPending = () => this.pending.length > 0;
  getPending = (): readonly ApplicationCommand[] => this.pending;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  deactivate() {
    this.active = false; this.request++; clearTimeout(this.editTimer); this.editTimer = undefined;
    if (typeof window !== "undefined") { window.removeEventListener?.("pagehide", this.flushEdits); window.removeEventListener?.("focusout", this.flushEdits); }
    for (const complete of this.completions.values()) complete(null); this.completions.clear(); this.results.clear();
  }
  private complete(commandId: string, result: CommandResult | null) {
    this.completions.get(commandId)?.(result); this.completions.delete(commandId); this.results.delete(commandId);
  }
  private publish() { for (const listener of this.listeners) listener(); }
  private persist() {
    if (this.bufferInvalid || typeof window === "undefined") return;
    try {
      if (this.pending.length) window.localStorage.setItem(this.storageKey, `{"session":${this.encodedSession},"commands":[${this.pending.map(command => {
        let encoded = this.encodedCommands.get(command);
        if (!encoded) { encoded = JSON.stringify(command); this.encodedCommands.set(command, encoded); }
        return encoded;
      }).join(",")}]}`);
      else {
        window.localStorage.removeItem(this.storageKey);
        if (this.restoredSource && window.localStorage.getItem(this.restoredSource.key) === this.restoredSource.raw) window.localStorage.removeItem(this.restoredSource.key);
        this.restoredSource = null;
      }
      this.bufferAvailable = true;
    } catch { this.bufferAvailable = false; }
  }
  private project() {
    let next = this.saved;
    for (const command of this.pending) {
      if (command.kind === "draft.edit" || command.kind === "work.status") {
        try { next = { ...next, assessment: applyAssessmentCommand(next.assessment, command, { id: () => command.commandId, now: "", owner: demoProfileById(this.session.profileId!).name }) }; } catch { /* Preserve command for review if its original record disappeared. */ }
      }
      if (command.kind === "canvas.save") {
        const id = canvasId(command.canvas.kind, command.canvas.params), existing = next.canvases.find((c) => c.id === id);
        if (existing && stableJson(existing.target) !== stableJson(command.target)) continue;
        const canvas = { id, canvas: command.canvas, surface: canonicalCanvasSurface(command.surface, command.canvas), target: command.target, fields: { ...existing?.fields, ...command.fields }, revision: existing?.revision ?? 0 };
        next = { ...next, canvases: [...next.canvases.filter((c) => c.id !== id), canvas] };
      }
    }
    this.projected = next;
  }
  private currentRevision(operation: ApplicationOperation): number {
    if (operation.kind === "work.status") return this.saved.assessment.projects.find((p) => p.id === operation.projectId)?.revision ?? 0;
    if (operation.kind === "canvas.save" || operation.kind === "canvas.copy") return this.saved.canvases.find((c) => c.id === canvasId(operation.canvas.kind, operation.canvas.params))?.revision ?? 0;
    return this.saved.assessmentRevision;
  }
  private failure(error: unknown) {
    this.error = error instanceof ApplicationError ? error.message : "Database saving is unavailable. Retry keeps the original command identity.";
    this.status = error instanceof ApplicationError && error.code === "conflict" ? "conflict" : "unavailable";
    this.blocked = true;
    if (error instanceof ApplicationError && ["session_changed", "unauthorized"].includes(error.code)) this.sessionChanged();
    this.publish();
  }
  async load(acknowledgedId?: string, acknowledgedResult?: CommandResult): Promise<boolean> {
    if (!this.active) return false;
    const request = ++this.request;
    try {
      const saved = await this.transport.read(this.session);
      if (!this.active || request !== this.request || stableJson(saved.session) !== stableJson(this.session)) return false;
      this.saved = saved;
      if (acknowledgedId && this.pending[0]?.commandId === acknowledgedId) {
        const head = this.pending.shift()!;
        this.immutable.delete(head.commandId);
        if (acknowledgedResult?.revision === head.expectedRevision) {
          // The confirmed no-op did not consume its predicted revision. Only
          // unsent commands behind this head lose that one contribution.
          const key = aggregateKey(head);
          this.pending = this.pending.map(command => aggregateKey(command) === key && command.expectedRevision > head.expectedRevision
            ? { ...command, expectedRevision: command.expectedRevision - 1 } : command);
        }
        this.persist();
      }
      this.project();
      if (!this.blocked) this.status = this.bufferInvalid ? "invalid" : this.pending.length ? "unsaved" : "saved";
      this.publish(); return true;
    } catch (error) { if (this.active && request === this.request) this.failure(error); return false; }
  }
  /** Every edit is buffered synchronously; only transport dispatch is coalesced. */
  enqueueEdit = (operation: Extract<ApplicationOperation, { kind: "canvas.save" | "draft.edit" }>) => this.enqueue(operation, crypto.randomUUID(), true);
  flushEdits = () => { clearTimeout(this.editTimer); this.editTimer = undefined; this.editStarted = 0; void this.drain(); };
  private scheduleEdits() {
    const now = Date.now();
    this.editStarted ||= now;
    clearTimeout(this.editTimer);
    this.editTimer = setTimeout(this.flushEdits, Math.max(0, Math.min(200, 1000 - (now - this.editStarted))));
  }
  enqueue(operation: ApplicationOperation, commandId = crypto.randomUUID(), deferredEdit = false): Promise<CommandResult | null> {
    if (!this.active || !this.isReady() || this.bufferInvalid) return Promise.resolve(null);
    const same = this.pending.find((c) => c.commandId === commandId);
    if (same) { void this.drain(); return Promise.resolve(null); }
    const tail = this.pending.at(-1);
    const merge = deferredEdit && tail && !this.immutable.has(tail.commandId) && (
      operation.kind === "canvas.save" && tail.kind === "canvas.save" && aggregateKey(operation) === aggregateKey(tail) && stableJson(operation.target) === stableJson(tail.target)
      || operation.kind === "draft.edit" && tail.kind === "draft.edit" && operation.draftId === tail.draftId && operation.edit.field === tail.edit.field
        && (operation.edit.field !== "finding" || tail.edit.field === "finding" && operation.edit.id === tail.edit.id));
    const key = aggregateKey(operation), expectedRevision = merge ? tail.expectedRevision : this.currentRevision(operation) + this.pending.filter((c) => aggregateKey(c) === key).length;
    if (merge) commandId = tail.commandId;
    const fields = merge && tail.kind === "canvas.save" && operation.kind === "canvas.save" ? { fields: { ...tail.fields, ...operation.fields } } : {};
    const command = structuredClone(parseCommand({ ...operation, ...fields, commandId, expectedRevision }));
    if (merge) this.pending[this.pending.length - 1] = command;
    else this.pending.push(command);
    this.persist(); this.project();
    if (!this.blocked) this.status = "unsaved";
    this.publish();
    let result = this.results.get(commandId);
    if (!result) {
      result = new Promise<CommandResult | null>(resolve => this.completions.set(commandId, resolve));
      this.results.set(commandId, result);
    }
    if (deferredEdit) this.scheduleEdits(); else this.flushEdits();
    return result;
  }
  private async drain() {
    if (!this.active || this.sending || this.blocked || this.bufferInvalid || !this.pending.length) return;
    this.sending = true;
    while (this.active && this.pending.length && !this.blocked) {
      if (this.editTimer && !this.immutable.has(this.pending[0]!.commandId)) break;
      const command = this.pending[0]!; this.status = "saving"; this.publish();
      this.immutable.add(command.commandId);
      try {
        const result = await this.transport.send(this.session, command);
        if (!this.active) break;
        // Retain the exact command until both its commit and a fresh projection are available.
        if (!await this.load(command.commandId, result)) { this.complete(command.commandId, null); break; }
        this.status = this.pending.length ? "unsaved" : "saved";
        this.complete(command.commandId, result); this.publish();
      } catch (error) {
        if (this.active) { this.failure(error); if (error instanceof ApplicationError && error.code === "conflict") await this.load(); this.complete(command.commandId, null); }
      }
    }
    this.sending = false;
  }
  retryPersistence = () => { if (!this.active || this.bufferInvalid) return; this.blocked = false; this.error = ""; this.persist(); void this.load().then((ok) => { if (ok) void this.drain(); }); };
  recoverDiscardedBuffer = (key: string, raw: string) => {
    if (!this.active || this.malformedSource?.key !== key || this.malformedSource.raw !== raw) return;
    try { if (window.localStorage.getItem(key) !== null) return; } catch { return; }
    this.malformedSource = null; this.restoredSource = null; this.bufferInvalid = false;
    this.blocked = false; this.error = ""; this.status = "loading"; this.publish(); void this.load();
  };
  keepLocalChanges = () => {
    if (!this.active || this.status !== "conflict" || !this.canKeepLocalChanges()) return;
    const revisions = new Map<string, number>();
    this.immutable.clear();
    this.pending = this.pending.map(command => {
      const key = aggregateKey(command), expectedRevision = revisions.get(key) ?? this.currentRevision(command), commandId = crypto.randomUUID();
      revisions.set(key, expectedRevision + 1);
      const complete = this.completions.get(command.commandId), result = this.results.get(command.commandId);
      if (complete) this.completions.set(commandId, complete);
      if (result) this.results.set(commandId, result);
      this.completions.delete(command.commandId); this.results.delete(command.commandId);
      return { ...command, expectedRevision, commandId };
    });
    this.persist(); this.blocked = false; this.error = ""; this.project(); this.publish(); void this.drain();
  };
  useSavedVersion = () => {
    if (!this.active || this.bufferInvalid) return;
    const discarded = new Set(this.pending.map((command) => command.commandId));
    // The user chose these exact edits. Later input must receive a new identity
    // while the saved-version read is in flight, even if its field matches.
    for (const id of discarded) this.immutable.add(id);
    void this.load().then((ok) => {
      if (!ok) return;
      this.pending = this.pending.filter((command) => !discarded.has(command.commandId));
      for (const id of discarded) { this.complete(id, null); this.immutable.delete(id); }
      this.blocked = this.pending.length > 0;
      this.error = this.blocked ? "New edits were made while the saved version loaded. Review them before applying their fields." : "";
      this.persist(); this.project(); this.status = this.blocked ? "conflict" : "saved"; this.publish();
    });
  };
  pendingLocation = () => this.bufferAvailable ? "Pending edits are buffered in this browser." : "Pending edits are only in this tab; browser storage is unavailable.";
  hasBufferFailure = () => this.pending.length > 0 && !this.bufferAvailable;
  canKeepLocalChanges = () => this.pending.length > 0 && this.pending.every((command) => {
    if (command.kind === "canvas.save") { const saved = this.saved.canvases.find((c) => c.id === canvasId(command.canvas.kind, command.canvas.params)); return !saved || stableJson(saved.target) === stableJson(command.target); }
    if (command.kind === "draft.edit") return this.saved.assessment.draft?.id === command.draftId;
    if (command.kind === "work.status") return !!this.saved.assessment.projects.find((p) => p.id === command.projectId)?.workItems.some((i) => i.id === command.itemId);
    return false;
  });
  reviewPending = () => this.pending.map((command) => {
    if (command.kind === "canvas.save") return { title: command.canvas.title, saved: this.saved.canvases.find((c) => c.id === canvasId(command.canvas.kind, command.canvas.params))?.fields ?? {}, pending: command.fields };
    if (command.kind === "draft.edit") return { title: "Project draft", saved: this.saved.assessment.draft, pending: command.edit };
    if (command.kind === "work.status") return { title: "Work item status", saved: this.saved.assessment.projects.find((p) => p.id === command.projectId)?.workItems.find((i) => i.id === command.itemId)?.status, pending: command.status };
    return { title: command.kind, saved: "Review the current workspace", pending: command };
  });
}
