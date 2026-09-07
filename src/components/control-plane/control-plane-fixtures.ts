export type FlowNodeId = "start" | "get-lead" | "high-value" | "assign-queue";

export type FlowNode = {
  id: FlowNodeId;
  label: string;
  detail: string;
  kind: "trigger" | "lookup" | "decision" | "action";
};

export const AUTOMATION_PLAN = {
  title: "Route High-Value Leads",
  summary:
    "When a Lead is created, check Annual Revenue. If it is at least $250,000, assign Enterprise Queue; otherwise keep the current owner.",
  steps: [
    "Trigger when a Lead is created",
    "Check Annual Revenue",
    "Assign high-value Leads to Enterprise Queue",
  ],
} as const;

export type ResumeFixture = {
  id: string;
  kind: "attention" | "recent";
  title: string;
  owner: string;
  context: string;
  status: string;
  updatedAt: string;
  workId: string;
  conversationId: string;
  canvasId?: string;
  resumeRef?: string;
  resumeState: "exact" | "chat" | "stale" | "external";
};

export const RESUME_FIXTURES: readonly ResumeFixture[] = [
  {
    id: "attention-lead-agent",
    kind: "attention",
    title: "Lead Qualification Agent",
    owner: "Agent Studio",
    context: "Trailblazer CRM · UAT",
    status: "Waiting on a routing-action decision",
    updatedAt: "2026-09-07T15:30:00Z",
    workId: "work-lead-qualification",
    conversationId: "conversation-lead-routing",
    canvasId: "canvas-agent-lead-qualification",
    resumeRef: "resume_agent_7f3c",
    resumeState: "exact",
  },
  {
    id: "recent-flow",
    kind: "recent",
    title: "Route High-Value Leads",
    owner: "Flow Builder",
    context: "Acme Storefront · SIT",
    status: "Sample Draft · ready for review",
    updatedAt: "2026-09-06T19:12:00Z",
    workId: "work-route-high-value-leads",
    conversationId: "conversation-flow-review",
    canvasId: "canvas-flow-route-high-value",
    resumeRef: "resume_flow_b82a",
    resumeState: "exact",
  },
  {
    id: "recent-release",
    kind: "recent",
    title: "Release validation recovery",
    owner: "ALM",
    context: "Trailblazer CRM · UAT",
    status: "Validation failed",
    updatedAt: "2026-09-05T12:04:00Z",
    workId: "work-release-recovery",
    conversationId: "conversation-release-recovery",
    resumeRef: "resume_release_stale",
    resumeState: "stale",
  },
];

export const RETURNING_PROJECTS = [
  { id: "trailblazer", name: "Trailblazer CRM", detail: "UAT · 2 active work items" },
  { id: "acme", name: "Acme Storefront", detail: "SIT · Flow draft ready" },
  { id: "field-service", name: "Field Service", detail: "Production · no blockers" },
] as const;

export const FLOW_ARTIFACT = {
  id: "route-high-value-leads",
  name: "Route High-Value Leads",
  type: "Flow",
  status: "Draft",
  nodes: [
    { id: "start", label: "Start", detail: "Lead is created", kind: "trigger" },
    { id: "get-lead", label: "Get Lead", detail: "Read Annual Revenue", kind: "lookup" },
    {
      id: "high-value",
      label: "High value?",
      detail: "AnnualRevenue >= $250,000",
      kind: "decision",
    },
    {
      id: "assign-queue",
      label: "Assign Enterprise Queue",
      detail: "Update Lead owner",
      kind: "action",
    },
  ] satisfies readonly FlowNode[],
  preview: {
    record: "Edge Communications",
    annualRevenue: "$420,000",
    path: "Yes",
    outcome: "Enterprise Queue",
  },
} as const;
