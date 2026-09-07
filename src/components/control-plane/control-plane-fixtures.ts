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
