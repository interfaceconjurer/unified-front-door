import type { DemoProfileId } from "../demo-profiles";
import {
  accessibleScope, ASSESSMENT_ORGS, ASSESSMENT_STEPS, findingsForScope,
  type ImprovementProject, type PlannedWorkItem, type ProjectDraft,
} from "./assessment";

export type AssessmentState = {
  status: "idle" | "running" | "paused" | "complete";
  step: number;
  scopeOrgIds: string[];
  completedAt: string | null;
  draft: ProjectDraft | null;
  projects: ImprovementProject[];
};

const INITIAL: AssessmentState = {
  status: "idle", step: 0,
  scopeOrgIds: accessibleScope(ASSESSMENT_ORGS.map((org) => org.id)),
  completedAt: null, draft: null, projects: [],
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
function validTarget(value: unknown): value is string {
  return ASSESSMENT_ORGS.some((org) => org.id === value && org.kind === "sandbox" && org.connection === "connected");
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** Persist only serializable demo work, and treat malformed browser data as empty. */
export function parseAssessment(raw: string | null): AssessmentState {
  if (!raw) return INITIAL;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return INITIAL;
    const scopeOrgIds = accessibleScope(strings(value.scopeOrgIds));
    if (!scopeOrgIds.length) return INITIAL;
    const projects: ImprovementProject[] = [];
    if (Array.isArray(value.projects)) for (const candidate of value.projects) {
      if (!record(candidate) || typeof candidate.id !== "string" || !candidate.id.startsWith("org-improvement-") ||
          typeof candidate.name !== "string" || !candidate.name.trim() || typeof candidate.goal !== "string" ||
          typeof candidate.owner !== "string" || !validTarget(candidate.targetOrgId) || !validDate(candidate.createdAt) ||
          !Array.isArray(candidate.workItems) || projects.some((project) => project.id === candidate.id)) continue;
      const projectScope = accessibleScope(strings(candidate.scopeOrgIds));
      const findings = findingsForScope(projectScope);
      const workItems: PlannedWorkItem[] = [];
      for (const item of candidate.workItems) {
        if (!record(item) || typeof item.id !== "string" || typeof item.title !== "string" ||
            (item.status !== "todo" && item.status !== "in-progress" && item.status !== "done")) continue;
        const finding = findings.find((entry) => entry.id === item.findingId);
        if (!finding || workItems.some((entry) => entry.findingId === finding.id) ||
            projects.some((project) => project.workItems.some((entry) => entry.findingId === finding.id))) continue;
        workItems.push({ id: item.id, title: item.title, findingId: finding.id, priority: finding.priority, status: item.status });
      }
      if (workItems.length) projects.push({
        id: candidate.id, name: candidate.name, goal: candidate.goal, owner: candidate.owner,
        targetOrgId: candidate.targetOrgId, scopeOrgIds: projectScope, createdAt: candidate.createdAt, workItems,
      });
    }
    const status = ["idle", "running", "paused", "complete"].includes(String(value.status))
      ? value.status as AssessmentState["status"] : "idle";
    const step = status === "complete" ? ASSESSMENT_STEPS.length
      : typeof value.step === "number" && Number.isInteger(value.step)
        ? Math.max(0, Math.min(value.step, ASSESSMENT_STEPS.length - 1)) : 0;
    let draft: ProjectDraft | null = null;
    if (status === "complete" && record(value.draft) && typeof value.draft.name === "string" &&
        typeof value.draft.goal === "string" && validTarget(value.draft.targetOrgId)) {
      const selected = strings(value.draft.findingIds);
      draft = {
        name: value.draft.name, goal: value.draft.goal, targetOrgId: value.draft.targetOrgId,
        findingIds: findingsForScope(scopeOrgIds).filter((finding) => selected.includes(finding.id) &&
          !projects.some((project) => project.workItems.some((item) => item.findingId === finding.id))).map((finding) => finding.id),
      };
    }
    return { status, step, scopeOrgIds, completedAt: validDate(value.completedAt) ? value.completedAt : null, draft, projects };
  } catch {
    return INITIAL;
  }
}

export class AssessmentStore {
  private storageKey: string;
  private listeners = new Set<() => void>();
  private cached: AssessmentState = INITIAL;
  private raw: string | null | undefined;
  private memoryOnly = false;

  constructor(profileId: string) {
    this.storageKey = `ufd.org-assessment.v1.${profileId}`;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getServerSnapshot = (): AssessmentState => INITIAL;
  getSnapshot = (): AssessmentState => {
    if (typeof window === "undefined" || this.memoryOnly) return this.cached;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw !== this.raw) {
        this.raw = raw;
        this.cached = parseAssessment(raw);
      }
    } catch { this.memoryOnly = true; }
    return this.cached;
  };
  private update(next: AssessmentState) {
    this.cached = next;
    this.raw = JSON.stringify(next);
    if (typeof window !== "undefined" && !this.memoryOnly) {
      try { window.localStorage.setItem(this.storageKey, this.raw); }
      catch { this.memoryOnly = true; }
    }
    for (const listener of this.listeners) listener();
  }
  start = () => {
    const state = this.getSnapshot();
    if (state.status === "idle" || state.status === "paused") this.update({ ...state, status: "running" });
  };
  advance = () => {
    const state = this.getSnapshot();
    if (state.status !== "running") return;
    const step = state.step + 1;
    const complete = step >= ASSESSMENT_STEPS.length;
    this.update({ ...state, step, status: complete ? "complete" : "running", completedAt: complete ? new Date().toISOString() : null });
  };
  pause = () => {
    const state = this.getSnapshot();
    if (state.status === "running") this.update({ ...state, status: "paused" });
  };
  rescan = (orgIds: string[]) => {
    const scopeOrgIds = accessibleScope(orgIds);
    if (!scopeOrgIds.length) return;
    this.update({ ...this.getSnapshot(), status: "running", step: 0, scopeOrgIds, completedAt: null, draft: null });
  };
  saveDraft = (draft: ProjectDraft | null) => {
    this.update({ ...this.getSnapshot(), draft });
  };
  createProject = (owner: string): ImprovementProject | null => {
    const state = this.getSnapshot();
    const draft = state.draft;
    if (state.status !== "complete" || !draft || !draft.name.trim() || !draft.goal.trim() || !validTarget(draft.targetOrgId)) return null;
    const findings = findingsForScope(state.scopeOrgIds).filter((finding) => draft.findingIds.includes(finding.id) &&
      !state.projects.some((project) => project.workItems.some((item) => item.findingId === finding.id)));
    if (!findings.length) return null;
    const project: ImprovementProject = {
      id: `org-improvement-${crypto.randomUUID()}`, name: draft.name.trim(), goal: draft.goal.trim(),
      owner, targetOrgId: draft.targetOrgId, scopeOrgIds: [...state.scopeOrgIds], createdAt: new Date().toISOString(),
      workItems: findings.map((finding, index) => ({ id: `WI-${index + 1}`, findingId: finding.id, title: finding.title, priority: finding.priority, status: "todo" })),
    };
    this.update({ ...state, draft: null, projects: [...state.projects, project] });
    return project;
  };
  setWorkItemStatus = (projectId: string, itemId: string, status: PlannedWorkItem["status"]) => {
    const state = this.getSnapshot();
    this.update({ ...state, projects: state.projects.map((project) => project.id !== projectId ? project : {
      ...project, workItems: project.workItems.map((item) => item.id === itemId ? { ...item, status } : item),
    }) });
  };
}

const stores = new Map<DemoProfileId, AssessmentStore>();
export function getAssessmentStore(profileId: DemoProfileId): AssessmentStore {
  let store = stores.get(profileId);
  if (!store) { store = new AssessmentStore(profileId); stores.set(profileId, store); }
  return store;
}
