import { ApplicationError, stableJson, type SessionView } from "../application/contracts";
import { activeRun, parseAgentCommand, type AgentCommand, type AgentReceipt, type AgentSnapshot, type RunView } from "./contracts";
import { mergeAgentSnapshot, mergeRunProgress } from "./progress";

export const EMPTY_AGENT: AgentSnapshot = { conversations: [], runs: [] };
const INITIAL: { data: AgentSnapshot; ready: boolean; error: string; pending: boolean; recovery: string | null; acknowledged: { command: AgentCommand; receipt: AgentReceipt } | null } = { data: EMPTY_AGENT, ready: false, error: "", pending: false, recovery: null, acknowledged: null };
export const inactiveAgent = { getSnapshot: () => INITIAL, getServerSnapshot: () => INITIAL, subscribe: (listener: () => void) => { void listener; return () => {}; }, start: () => {}, setThread: (threadKey: string) => { void threadKey; }, command: async (command: AgentCommand): Promise<AgentReceipt | null> => { void command; return null; }, retry: () => {}, discardRecovery: () => {} };
type Transport = { read(): Promise<AgentSnapshot>; readRun?(runId: string, after: number): Promise<{ run: RunView }>; send(command: AgentCommand): Promise<AgentReceipt> };
type Pending = { command: AgentCommand; resolve?: (receipt: AgentReceipt | null) => void };
/** A captured session owns requests; selection changes never rewrite queued input. */
export class AgentClient {
  private view = INITIAL;
  private listeners = new Set<() => void>();
  private active = true;
  private sending = false;
  private blocked = false;
  private queue: Pending[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private reading = false;
  private threadKey: string | null = null;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private readingProgress = false;
  private lastFullRead = 0;
  private lastProgressRead = 0;
  private lastProgressRun: string | null = null;
  private storageReadable = true;
  private readFailed = false;
  private key: string;
  constructor(readonly session: SessionView, private transport: Transport, private businessChanged: () => void, private sessionChanged: () => void) {
    this.key = `ufd.agent-pending.v1.${session.namespaceId}.${session.profileId}.${session.workspaceEpoch}.${session.generation}`;
    if (typeof window === "undefined") return;
    let raw: string | null;
    try { raw = window.sessionStorage.getItem(this.key); }
    catch { this.storageReadable = false; this.view = { ...this.view, error: "Browser request recovery is unavailable. Unconfirmed requests stay in this tab until acknowledged." }; return; }
    try {
      if (raw) {
        const saved = JSON.parse(raw);
        if (stableJson(saved.session) !== stableJson(session) || !Array.isArray(saved.commands) || saved.commands.length > 32) throw new Error("Invalid requests");
        this.queue = saved.commands.map((command: unknown) => ({ command: parseAgentCommand(command) }));
        this.blocked = this.queue.length > 0;
        this.view = { ...this.view, pending: this.blocked, error: this.blocked ? "A previous request needs confirmation. Retry keeps its original message and context." : "" };
      }
    } catch { this.blocked = true; this.view = { ...this.view, recovery: raw, error: "The saved agent request could not be read. Export its original bytes before discarding it to resume messaging." }; }
  }
  getSnapshot = () => this.view;
  getServerSnapshot = () => INITIAL;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Partial<typeof INITIAL>) { this.view = { ...this.view, ...value }; this.listeners.forEach(listener => listener()); }
  private persist() {
    // An unread old buffer must never be overwritten by this memory-only queue.
    if (!this.storageReadable || typeof window === "undefined") return;
    try {
      if (this.queue.length) window.sessionStorage.setItem(this.key, JSON.stringify({ session: this.session, commands: this.queue.map(p => p.command) }));
      else window.sessionStorage.removeItem(this.key);
    } catch { this.publish({ error: "This unconfirmed request is held in this tab. Keep the tab open until it is confirmed." }); }
  }
  start = () => {
    if (this.timer || !this.active) return;
    void this.refresh(); this.timer = setInterval(() => {
      const run = this.selectedRun();
      const progressHealthy = run?.id === this.lastProgressRun && Date.now() - this.lastProgressRead < 2500;
      if (!progressHealthy || Date.now() - this.lastFullRead >= 5000) void this.refresh();
    }, 1000);
  };
  setThread = (threadKey: string) => {
    if (this.threadKey === threadKey) return;
    this.threadKey = threadKey;
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.progressTimer = null;
    this.scheduleProgress();
  };
  private selectedRun() {
    if (!this.transport.readRun || !this.threadKey) return undefined;
    const conversation = this.view.data.conversations.find(saved => saved.threadKey === this.threadKey);
    return conversation && this.view.data.runs.find(run => run.kind === "chat" && run.conversationId === conversation.id && activeRun(run.status));
  }
  private scheduleProgress(delay = 0) {
    if (!this.active || this.progressTimer || this.readingProgress || !this.selectedRun()) return;
    this.progressTimer = setTimeout(() => { this.progressTimer = null; void this.readProgress(); }, delay);
  }
  private async readProgress() {
    const run = this.selectedRun();
    if (!this.active || !run || !this.transport.readRun || this.readingProgress) return;
    this.readingProgress = true;
    try {
      const result = await this.transport.readRun(run.id, run.sequence);
      if (!this.active || result.run.id !== run.id) return;
      this.lastProgressRead = Date.now(); this.lastProgressRun = run.id;
      const data = mergeRunProgress(this.view.data, result.run);
      if (data !== this.view.data) this.publish({ data });
      if (!activeRun(result.run.status)) void this.refresh();
    } catch (error) {
      if (this.active) {
        this.lastProgressRun = null; this.readFailed = true;
        this.publish({ error: error instanceof Error ? error.message : "Agent progress is unavailable." });
        if (error instanceof ApplicationError && ["session_changed", "unauthorized"].includes(error.code)) this.sessionChanged();
      }
    } finally {
      this.readingProgress = false;
      this.scheduleProgress(500);
    }
  }
  deactivate() {
    this.active = false; if (this.timer) clearInterval(this.timer); this.timer = null;
    if (this.progressTimer) clearTimeout(this.progressTimer); this.progressTimer = null;
    for (const pending of this.queue) pending.resolve?.(null);
  }
  refresh = async () => {
    if (!this.active || this.reading) return; this.reading = true;
    try {
      const incoming = await this.transport.read(); if (!this.active) return;
      const data = mergeAgentSnapshot(this.view.data, incoming);
      this.lastFullRead = Date.now();
      const before = this.view.data.runs.filter(r => r.kind === "assessment").map(r => [r.id, r.sequence]);
      const after = data.runs.filter(r => r.kind === "assessment").map(r => [r.id, r.sequence]);
      const changed = stableJson(before) !== stableJson(after);
      this.publish({ ready: true, data: stableJson(data) === stableJson(this.view.data) ? this.view.data : data, ...(this.readFailed && !this.blocked ? { error: "" } : {}) });
      this.readFailed = false;
      if (changed) this.businessChanged();
    } catch (error) {
      if (this.active) { this.readFailed = true; this.publish({ error: error instanceof Error ? error.message : "Agent history is unavailable." }); if (error instanceof ApplicationError && ["session_changed", "unauthorized"].includes(error.code)) this.sessionChanged(); }
    } finally { this.reading = false; this.scheduleProgress(); }
  };
  command(command: AgentCommand): Promise<AgentReceipt | null> {
    if (!this.active || !this.view.ready || this.blocked) return Promise.resolve(null);
    if (command.kind === "visit" && this.queue.some(item => item.command.kind === "visit" && stableJson(item.command.context) === stableJson(command.context) && item.command.workId === command.workId)) return Promise.resolve(null);
    const result = new Promise<AgentReceipt | null>(resolve => this.queue.push({ command, resolve }));
    this.persist(); this.publish({ pending: true }); void this.drain(); return result;
  }
  retry = () => { if (!this.active || !this.queue.length) { void this.refresh(); return; } this.blocked = false; this.publish({ error: "" }); void this.drain(); };
  discardRecovery = () => {
    const raw = this.view.recovery; if (!this.active || raw === null) return;
    try {
      if (window.sessionStorage.getItem(this.key) !== raw) { this.publish({ error: "The saved request changed. Reload to review its current bytes before discarding it." }); return; }
      window.sessionStorage.removeItem(this.key);
      this.blocked = false; this.publish({ recovery: null, error: "" });
    } catch { this.publish({ error: "Browser storage is still unavailable. Export the preserved request before closing this tab." }); }
  };
  private async drain() {
    if (this.sending || this.blocked || !this.active) return; this.sending = true;
    try {
      while (this.queue.length && this.active) {
        const pending = this.queue[0]!;
        try {
          const receipt = await this.transport.send(pending.command); if (!this.active) return;
          this.queue.shift(); this.persist(); this.publish({ pending: this.queue.length > 0, error: "", acknowledged: { command: pending.command, receipt } });
          await this.refresh(); pending.resolve?.(this.active ? receipt : null);
        } catch (error) {
          if (!this.active) return;
          const rejected = error instanceof ApplicationError && ["conflict", "invalid"].includes(error.code);
          if (rejected) { this.queue.shift(); this.persist(); }
          this.blocked = !rejected; this.publish({ pending: this.queue.length > 0, error: error instanceof Error ? error.message : "The request could not be confirmed. Retry keeps its identity." });
          pending.resolve?.(null); pending.resolve = undefined;
          if (error instanceof ApplicationError && ["session_changed", "unauthorized"].includes(error.code)) this.sessionChanged();
          if (!rejected) break;
        }
      }
    } finally { this.sending = false; }
  }
}
