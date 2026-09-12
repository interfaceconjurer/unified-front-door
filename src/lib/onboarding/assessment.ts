import type { Org, Project } from "../workspace/model";

// This is an explicit demo adapter. A real adapter must discover orgs through
// granted connections and permissions; a My Domain login is not blanket access.
export const ASSESSMENT_ACCOUNT = {
  company: "Acme",
  domain: "acme.my.salesforce.com",
};

export const ASSESSMENT_ORGS: readonly Org[] = [
  { id: "prod", label: "Acme Production", kind: "production", connection: "connected" },
  { id: "uat", label: "UAT Sandbox", kind: "sandbox", connection: "connected" },
  { id: "sit", label: "SIT Sandbox", kind: "sandbox", connection: "connected" },
  { id: "scratch-hotfix", label: "Hotfix Scratch", kind: "scratch", connection: "expired", expiresInDays: 0 },
];

export const ASSESSMENT_STEPS = [
  { title: "Discover accessible orgs", detail: "Check connections and the scope available to your account." },
  { title: "Review usage and limits", detail: "Compare API, storage, and async usage with available capacity." },
  { title: "Trace process friction", detail: "Look for failed automations and repeated manual steps." },
  { title: "Check release readiness", detail: "Review metadata differences and validation results." },
  { title: "Prioritize opportunities", detail: "Connect the evidence to practical improvements and a plan." },
] as const;

export type Finding = {
  id: string;
  orgId: string;
  category: "Limits" | "Automation" | "Release readiness";
  priority: "High" | "Medium";
  title: string;
  summary: string;
  metric: string;
  metricLabel: string;
  effort: string;
  impact: string;
  evidence: readonly string[];
  source: string;
  hypothesis: string;
  steps: readonly string[];
  validation: string;
};

export const ASSESSMENT_FINDINGS: readonly Finding[] = [
  {
    id: "api-headroom", orgId: "prod", category: "Limits", priority: "High",
    title: "Give your integrations more API headroom",
    summary: "API usage is close to its daily allocation. Frequent polling is a good place to investigate.",
    metric: "87%", metricLabel: "daily API allocation used", effort: "2–3 days",
    impact: "Reduce unnecessary requests and leave room for peak demand.",
    evidence: ["87,000 of 100,000 requests used in the sample 24-hour window.", "The ERP sync accounts for 61% of observed requests.", "Account polling repeats every 60 seconds, including periods without changes."],
    source: "Demo Limits snapshot · API usage breakdown · integration schedule",
    hypothesis: "Polling may be consuming capacity without adding useful updates. Confirm the traffic pattern before changing the integration.",
    steps: ["Baseline request volume by integration and confirm the busiest hours with the ERP owner.", "Prototype incremental sync or event-driven updates in a sandbox; add backoff and retry handling.", "Load-test the change, compare request counts, and prepare a staged rollout with a rollback plan."],
    validation: "Demonstrate lower request volume under the same workload, with no missed or duplicate updates and a tested rollback.",
  },
  {
    id: "lead-routing", orgId: "prod", category: "Automation", priority: "High",
    title: "Keep new leads moving to the right team",
    summary: "Repeated routing failures leave leads in a queue for someone to assign by hand.",
    metric: "34", metricLabel: "failed routing runs in 7 days", effort: "1–2 days",
    impact: "Reduce manual triage and give every incoming lead an owner.",
    evidence: ["34 of 1,240 Lead Assignment flow interviews failed in the sample week.", "29 failures reference a missing territory-to-queue mapping.", "Failed leads remain in the intake queue until an administrator intervenes."],
    source: "Demo flow error history · Lead Assignment metadata · queue mappings",
    hypothesis: "Missing mappings appear to explain most failures. Review the remaining five separately; they may have a different cause.",
    steps: ["Reproduce a failed routing interview in a sandbox and audit territory-to-queue mappings.", "Add the missing mappings and a fallback owner; cover the fault path with actionable notifications.", "Test normal, unmapped, and bulk lead intake, then review the release plan with the sales operations owner."],
    validation: "All routing scenarios assign an owner; the fault path is observable and bulk intake passes without new errors.",
  },
  {
    id: "storage-growth", orgId: "prod", category: "Limits", priority: "Medium",
    title: "Make room before data storage gets tight",
    summary: "Integration logs are the largest growing object. A retention policy could recover capacity.",
    metric: "78%", metricLabel: "data storage used", effort: "2–4 days",
    impact: "Create a sustainable retention process and reduce storage pressure.",
    evidence: ["7.8 GB of the sample 10 GB allocation is in use.", "Integration_Log__c accounts for 3.1 GB of stored data.", "68% of log records are older than 180 days; no retention job is configured."],
    source: "Demo storage usage snapshot · object counts · retention configuration",
    hypothesis: "Older logs may be candidates for archiving. Their age alone does not establish that they are safe to delete.",
    steps: ["Confirm audit, legal, and support retention needs with the data owner.", "Design a searchable archive and verify export completeness and restore behavior in a sandbox.", "Propose a scheduled retention job with a dry run, monitoring, and explicit approval before any production deletion."],
    validation: "The owner approves the retention policy, archive reconciliation passes, and sampled records can be restored.",
  },
  {
    id: "release-drift", orgId: "uat", category: "Release readiness", priority: "Medium",
    title: "Catch missing dependencies before release day",
    summary: "A UAT validation is blocked by metadata dependencies that are absent from the release manifest.",
    metric: "3", metricLabel: "missing release dependencies", effort: "1–2 days",
    impact: "Make validation more predictable and reduce release rework.",
    evidence: ["The sample UAT validation has three unresolved metadata references.", "Two custom fields and one permission set are absent from the candidate manifest.", "The release checklist has no dependency check before validation."],
    source: "Demo UAT validation report · candidate manifest · metadata references",
    hypothesis: "The manifest may be incomplete. Check whether the missing dependencies are intended for this release before adding them.",
    steps: ["Trace each unresolved reference and confirm the intended release scope with its owner.", "Update the manifest and add a repeatable dependency check in SIT.", "Run validation in UAT and document the promotion and rollback steps for review."],
    validation: "UAT validation succeeds with the reviewed manifest, and the dependency check catches a deliberately omitted component.",
  },
];

export function accessibleScope(ids: readonly string[]): string[] {
  return ASSESSMENT_ORGS.filter((org) => org.connection === "connected" && ids.includes(org.id)).map((org) => org.id);
}

export function findingsForScope(ids: readonly string[]): Finding[] {
  const scope = accessibleScope(ids);
  return ASSESSMENT_FINDINGS.filter((finding) => scope.includes(finding.orgId));
}

export type PlannedWorkItem = {
  id: string;
  findingId: string;
  title: string;
  priority: Finding["priority"];
  status: "todo" | "in-progress" | "done";
};

export type ImprovementProject = {
  id: string;
  name: string;
  goal: string;
  owner: string;
  targetOrgId: string;
  scopeOrgIds: string[];
  createdAt: string;
  workItems: PlannedWorkItem[];
};

export type ProjectDraft = {
  name: string;
  goal: string;
  targetOrgId: string;
  findingIds: string[];
};

export function workspaceProject(project: ImprovementProject): Project {
  return {
    id: project.id, name: project.name, description: project.goal,
    defaultOrgId: project.targetOrgId,
    worktrees: [{ id: "main", label: "Project plan", branch: "main", isPrimary: true }],
    facets: { objects: 0, flows: 0, apexClasses: 0, lwc: 0, permissionSets: 0 },
    agentSessions: [], apps: [],
  };
}
