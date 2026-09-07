export type ConversationId = string;
export type WorkId = string;
export type CanvasId = string;
export type CapabilityInstanceId = string;

export type ConversationState =
  | "fresh"
  | "discussing"
  | "planning"
  | "work-ready"
  | "continuing";

export type LayoutPreset = "canvas-roomy" | "balanced" | "chat-roomy";

export type PresentationState =
  | { mode: "chat-only" }
  | { mode: "split"; activeCanvasId: CanvasId; layout: LayoutPreset }
  | { mode: "focus"; activeCanvasId: CanvasId; previousLayout: LayoutPreset };

export type CanvasLifecycle =
  | "preparing"
  | "ready"
  | "active"
  | "closed"
  | "action-pending"
  | "result-acknowledged"
  | "error"
  | "external";

export type CapabilityManifest = {
  version: "1";
  capabilityId: string;
  label: string;
  ownerLabel: string;
  launchModes: ("embedded" | "full-page" | "external")[];
  directUrl: string;
  acceptedContext: ("project" | "org" | "worktree" | "artifact")[];
  requiredContext: ("project" | "org" | "worktree" | "artifact")[];
  preferredLayout: LayoutPreset;
  actions: {
    id: string;
    label: string;
    confirmation: "none" | "review" | "required";
  }[];
};

export type CapabilityLaunch = {
  capabilityId: string;
  instanceId: CapabilityInstanceId;
  conversationId: ConversationId;
  workId: WorkId;
  context: {
    projectRef?: string;
    orgRef?: string;
    worktreeRef?: string;
    artifactRef?: string;
    contextRevision: string;
  };
  resumeRef?: string;
  correlationId: string;
};

export type CapabilityReady = {
  instanceId: CapabilityInstanceId;
  title: string;
  canonicalUrl: string;
  resumeRef?: string;
  ownerLabel: string;
  artifactRevision?: string;
};

export type CapabilityResult = {
  actionId: string;
  correlationId: string;
  status: "accepted" | "succeeded" | "failed" | "cancelled";
  userSummary: string;
  resumeRef?: string;
  artifactRevision?: string;
};

export type CanvasRecord = {
  id: CanvasId;
  capabilityId: string;
  instanceId: CapabilityInstanceId;
  title: string;
  ownerLabel: string;
  truthState: string;
  lifecycle: CanvasLifecycle;
  revision?: string;
  resumeRef?: string;
  canonicalUrl: string;
};
