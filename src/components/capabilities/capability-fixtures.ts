import type {
  CapabilityLaunch,
  CapabilityManifest,
  CapabilityReady,
  CanvasRecord,
} from "./capability-model";

export const AGENT_STUDIO_MANIFEST: CapabilityManifest = {
  version: "1",
  capabilityId: "agent-studio.agent",
  label: "Agent Studio",
  ownerLabel: "Agent Studio",
  launchModes: ["embedded", "full-page"],
  directUrl: "/build/agent-studio",
  acceptedContext: ["project", "org", "worktree", "artifact"],
  requiredContext: ["artifact"],
  preferredLayout: "canvas-roomy",
  actions: [
    { id: "agent.connect-action", label: "Connect acknowledged action", confirmation: "review" },
  ],
};

export const FLOW_MANIFEST: CapabilityManifest = {
  version: "1",
  capabilityId: "build.flow",
  label: "Flow Builder",
  ownerLabel: "Build & Setup",
  launchModes: ["embedded", "full-page"],
  directUrl: "/build",
  acceptedContext: ["project", "org", "worktree", "artifact"],
  requiredContext: ["project", "org", "artifact"],
  preferredLayout: "canvas-roomy",
  actions: [
    { id: "flow.show-sample-outcome", label: "Show sample outcome", confirmation: "none" },
  ],
};

export const ALM_EXTERNAL_MANIFEST: CapabilityManifest = {
  version: "1",
  capabilityId: "alm.release",
  label: "Release Management",
  ownerLabel: "ALM",
  launchModes: ["external"],
  directUrl: "/alm",
  acceptedContext: ["project", "org", "worktree", "artifact"],
  requiredContext: ["project", "org"],
  preferredLayout: "balanced",
  actions: [],
};

export const CAPABILITY_MANIFESTS = [
  AGENT_STUDIO_MANIFEST,
  FLOW_MANIFEST,
  ALM_EXTERNAL_MANIFEST,
] as const;

export const AGENT_CANVAS: CanvasRecord = {
  id: "canvas-agent-lead-qualification",
  capabilityId: AGENT_STUDIO_MANIFEST.capabilityId,
  instanceId: "instance-agent-lead-qualification",
  title: "Lead Qualification Agent",
  ownerLabel: AGENT_STUDIO_MANIFEST.ownerLabel,
  truthState: "Sample Draft",
  lifecycle: "ready",
  revision: "rev 3",
  resumeRef: "resume_agent_7f3c",
  canonicalUrl: AGENT_STUDIO_MANIFEST.directUrl,
};

export const FLOW_CANVAS: CanvasRecord = {
  id: "canvas-flow-route-high-value",
  capabilityId: FLOW_MANIFEST.capabilityId,
  instanceId: "instance-flow-route-high-value",
  title: "Route High-Value Leads",
  ownerLabel: FLOW_MANIFEST.ownerLabel,
  truthState: "Sample Draft",
  lifecycle: "ready",
  revision: "rev 2",
  resumeRef: "resume_flow_b82a",
  canonicalUrl: FLOW_MANIFEST.directUrl,
};

export const AGENT_LAUNCH: CapabilityLaunch = {
  capabilityId: AGENT_STUDIO_MANIFEST.capabilityId,
  instanceId: AGENT_CANVAS.instanceId,
  conversationId: "conversation-lead-routing",
  workId: "work-lead-qualification",
  context: {
    artifactRef: "lead-qualification-agent",
    contextRevision: "ctx-1",
  },
  correlationId: "corr-agent-ready-01",
};

export const AGENT_READY: CapabilityReady = {
  instanceId: AGENT_CANVAS.instanceId,
  title: AGENT_CANVAS.title,
  canonicalUrl: AGENT_CANVAS.canonicalUrl,
  resumeRef: AGENT_CANVAS.resumeRef,
  ownerLabel: AGENT_CANVAS.ownerLabel,
  artifactRevision: AGENT_CANVAS.revision,
};

export const FLOW_LAUNCH: CapabilityLaunch = {
  capabilityId: FLOW_MANIFEST.capabilityId,
  instanceId: FLOW_CANVAS.instanceId,
  conversationId: AGENT_LAUNCH.conversationId,
  workId: AGENT_LAUNCH.workId,
  context: {
    projectRef: "trailblazer-crm",
    orgRef: "uat",
    artifactRef: "route-high-value-leads",
    contextRevision: "ctx-2",
  },
  correlationId: "corr-flow-sample-01",
};

export const FLOW_READY: CapabilityReady = {
  instanceId: FLOW_CANVAS.instanceId,
  title: FLOW_CANVAS.title,
  canonicalUrl: FLOW_CANVAS.canonicalUrl,
  resumeRef: FLOW_CANVAS.resumeRef,
  ownerLabel: FLOW_CANVAS.ownerLabel,
  artifactRevision: FLOW_CANVAS.revision,
};
