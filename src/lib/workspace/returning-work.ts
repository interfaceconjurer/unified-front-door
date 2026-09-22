import type { CanvasSpecInput } from "@/lib/surface-canvas/model";
import type { SurfaceId } from "./model";

export type WorkStatus = "working" | "review" | "ready" | "saved" | "live";
export type ReturningWork = {
  id: string;
  title: string;
  surfaceId: SurfaceId;
  projectId: string;
  worktreeId: string | null;
  /** Display context captured for an aggregate Home briefing. */
  projectName?: string;
  branch?: string;
  kind: string;
  summary: string;
  updated: string;
  status: WorkStatus;
  statusLabel: string;
  attention?: boolean;
  details: readonly { label: string; value: string }[];
  activity: readonly string[];
  source?: string;
  sourceLabel?: string;
};

/** A coherent demo snapshot for the returning developer, tied to PROJECTS and
 *  their existing agent sessions. These are sample work items, not live results. */
export const RETURNING_WORK: readonly ReturningWork[] = [
  {
    id: "opportunity-handler", title: "OpportunityTriggerHandler.cls", surfaceId: "code",
    projectId: "trailblazer-crm", worktreeId: "main", kind: "Apex class",
    summary: "Agent is refactoring the handler and its tests.", updated: "2026-09-14T14:56:00Z",
    status: "working", statusLabel: "Agent working",
    details: [{ label: "Files touched", value: "3 files" }, { label: "Focus", value: "Bulk processing and shared validation" }, { label: "Next step", value: "Review the agent’s changes" }],
    activity: ["Agent started consolidating validation logic.", "Updated the handler and supporting test class.", "Preparing a summary of the changes for review."],
    sourceLabel: "Working notes",
    source: "OpportunityTriggerHandler.cls\nOpportunityValidationService.cls\nOpportunityTriggerHandlerTest.cls\n\nCurrent task\nConsolidate shared validation and cover bulk updates.",
  },
  {
    id: "lead-routing-release", title: "Lead routing → UAT", surfaceId: "alm",
    projectId: "trailblazer-crm", worktreeId: "lead-routing", kind: "Release plan",
    summary: "The updated Lead Assignment Rule is waiting for your review.", updated: "2026-09-14T14:48:00Z",
    status: "review", statusLabel: "Approval needed", attention: true,
    details: [{ label: "Target", value: "UAT Sandbox" }, { label: "Change", value: "Lead Assignment Rule and supporting automation" }, { label: "Gate", value: "Developer approval before deployment" }],
    activity: ["Agent assembled the lead-routing change set.", "Validation completed in the development sandbox.", "Agent paused before deployment to request approval."],
  },
  {
    id: "lead-routing-agent", title: "Lead routing assistant", surfaceId: "build",
    projectId: "trailblazer-crm", worktreeId: "lead-routing", kind: "Agent",
    summary: "Qualification instructions and routing actions are ready to refine.", updated: "2026-09-14T14:42:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Purpose", value: "Qualify incoming leads and suggest an owner" }, { label: "Actions", value: "Read lead context · Recommend a queue · Explain the assignment" }, { label: "Related work", value: "Lead routing → UAT" }],
    activity: ["Added guidance for incomplete lead records.", "Updated the routing action to explain its recommendation.", "Saved the configuration for the next review."],
    sourceLabel: "Agent instructions",
    source: "Review the lead’s region, company size, and product interest.\nRecommend the most appropriate sales queue.\nExplain the recommendation and ask for missing information.\nRequest approval before changing an assignment.",
  },
  {
    id: "hotfix-tests", title: "W-9821 regression tests", surfaceId: "code",
    projectId: "trailblazer-crm", worktreeId: "hotfix-9821", kind: "Test suite",
    summary: "The hotfix and regression coverage are ready for code review.", updated: "2026-09-14T14:35:00Z",
    status: "review", statusLabel: "Code review needed", attention: true,
    details: [{ label: "Scope", value: "Opportunity updates and owner reassignment" }, { label: "Branch", value: "hotfix/W-9821" }, { label: "Next step", value: "Review the fix and its regression coverage" }],
    activity: ["Reproduced the reassignment issue.", "Added regression coverage for the fix.", "Agent finished preparing the changes for review."],
  },
  {
    id: "integration-access", title: "Integration user access", surfaceId: "govern",
    projectId: "trailblazer-crm", worktreeId: "main", kind: "Access review",
    summary: "Review the permissions requested for the lead-routing integration.", updated: "2026-09-14T14:22:00Z",
    status: "review", statusLabel: "Review needed", attention: true,
    details: [{ label: "Identity", value: "Lead routing integration user" }, { label: "Requested access", value: "Read leads and accounts · Update lead owner" }, { label: "Review focus", value: "Limit access to the routing workflow" }],
    activity: ["Captured the integration’s requested permissions.", "Compared the request with the routing workflow.", "Prepared the access review for your decision."],
  },
  {
    id: "developer-toolkit", title: "CRM developer toolkit", surfaceId: "code",
    projectId: "trailblazer-crm", worktreeId: "main", kind: "Toolkit",
    summary: "Your saved skills and integrations for Salesforce development.", updated: "2026-09-14T14:00:00Z",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Skills", value: "Apex review · Regression planning" }, { label: "Plugin", value: "Salesforce development" }, { label: "Connections", value: "Salesforce connector · Project and org MCP tools" }],
    activity: ["Added an Apex review skill to the toolkit.", "Configured the Salesforce connector and project tools.", "Saved the toolkit for reuse across CRM tasks."],
    sourceLabel: "Toolkit configuration",
    source: "skills:\n  - apex-review\n  - regression-planning\nplugins:\n  - salesforce-development\nconnectors:\n  - salesforce\nmcp_tools:\n  - project-context\n  - org-metadata",
  },
  {
    id: "storefront-app", title: "Acme Storefront", surfaceId: "alm",
    projectId: "acme-storefront", worktreeId: "main", kind: "React app",
    summary: "The storefront is live, with your next UI changes ready to plan.", updated: "2026-09-14T13:00:00Z",
    status: "live", statusLabel: "Live",
    details: [{ label: "Environment", value: "Production" }, { label: "Last deployment", value: "2026-09-14T13:00:00Z" }, { label: "Next focus", value: "Account browsing and search experience" }],
    activity: ["Completed the storefront release.", "Deployment is live in production.", "Saved notes for the next iteration."],
  },
  {
    id: "storefront-health", title: "Storefront health", surfaceId: "govern",
    projectId: "acme-storefront", worktreeId: "main", kind: "Health monitor",
    summary: "Account search latency has increased. Review the agent’s findings and proposed cache adjustment.", updated: "2026-09-14T13:00:00Z",
    status: "review", statusLabel: "Performance review needed", attention: true,
    details: [{ label: "Application", value: "Acme Storefront" }, { label: "Signal", value: "Account search p95 increased from 420 ms to 1.2 s" }, { label: "Proposed response", value: "Review cache invalidation and rerun the search benchmark" }],
    activity: ["Detected higher search latency after the latest release.", "Agent traced repeated account lookups and prepared a cache adjustment.", "Waiting for your review before applying the proposed change."],
  },
  {
    id: "account-query", title: "Enterprise accounts.soql", surfaceId: "code",
    projectId: "acme-storefront", worktreeId: "main", kind: "Saved SOQL query",
    summary: "Your saved account query for the storefront experience.", updated: "2026-09-13T15:00:00Z",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Object", value: "Account" }, { label: "Fields", value: "Id · Name · Industry" }, { label: "Limit", value: "100 records" }],
    activity: ["Selected the account fields used by the storefront.", "Saved the query for the next development session."],
    sourceLabel: "SOQL query",
    source: "SELECT Id, Name, Industry\nFROM Account\nORDER BY Name\nLIMIT 100",
  },
  {
    id: "storefront-release", title: "Storefront next release", surfaceId: "alm",
    projectId: "acme-storefront", worktreeId: "main", kind: "Release plan",
    summary: "Account search and accessibility improvements passed validation. Review the change summary and approve the UAT rollout.", updated: "2026-09-13T15:00:00Z",
    status: "review", statusLabel: "Approval needed", attention: true,
    details: [{ label: "Source", value: "main" }, { label: "Validation", value: "SIT checks passed; ready for UAT Sandbox" }, { label: "Planned scope", value: "Account search, keyboard navigation, and empty states" }],
    activity: ["Agent completed the account search and accessibility updates.", "Automated checks and the SIT smoke test passed.", "Release notes are ready; the UAT rollout is waiting for your approval."],
  },
  {
    id: "builder-lead-routing", title: "Lead routing assistant", surfaceId: "build",
    projectId: "trailblazer-crm", worktreeId: null, kind: "Agent",
    summary: "Qualification guidance is ready to refine.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Qualification guidance is ready to refine." }],
    activity: ["Saved the project context and initial configuration.", "Qualification guidance is ready to refine."],
  },
  {
    id: "builder-routing-release", title: "Lead routing → UAT", surfaceId: "alm",
    projectId: "trailblazer-crm", worktreeId: null, kind: "Release plan",
    summary: "Review the lead assignment automation before its first release.", updated: "2026-09-14T12:00:00Z",
    status: "review", statusLabel: "Approval needed", attention: true,
    details: [{ label: "Next step", value: "Review the lead assignment automation before its first release." }],
    activity: ["Saved the project context and initial configuration.", "Review the lead assignment automation before its first release."],
  },
  {
    id: "onboarding-welcome", title: "Customer welcome flow", surfaceId: "build",
    projectId: "customer-onboarding", worktreeId: null, kind: "Flow",
    summary: "Welcome tasks and follow-up reminders are ready to refine.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Welcome tasks and follow-up reminders are ready to refine." }],
    activity: ["Saved the project context and initial configuration.", "Welcome tasks and follow-up reminders are ready to refine."],
  },
  {
    id: "onboarding-release", title: "Onboarding first release", surfaceId: "alm",
    projectId: "customer-onboarding", worktreeId: null, kind: "Release plan",
    summary: "Plan validation of the welcome flow with the customer success team.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Draft plan",
    details: [{ label: "Next step", value: "Plan validation of the welcome flow with the customer success team." }],
    activity: ["Saved the project context and initial configuration.", "Plan validation of the welcome flow with the customer success team."],
  },
  {
    id: "service-routing", title: "Case routing flow", surfaceId: "build",
    projectId: "service-operations", worktreeId: null, kind: "Flow",
    summary: "Review priority routing and escalation rules for incoming cases.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Review priority routing and escalation rules for incoming cases." }],
    activity: ["Saved the project context and initial configuration.", "Review priority routing and escalation rules for incoming cases."],
  },
  {
    id: "service-health", title: "Service response monitor", surfaceId: "govern",
    projectId: "service-operations", worktreeId: null, kind: "Health monitor",
    summary: "Response targets and escalation signals are configured for review.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Next step", value: "Response targets and escalation signals are configured for review." }],
    activity: ["Saved the project context and initial configuration.", "Response targets and escalation signals are configured for review."],
  },
  {
    id: "crm-access-policy", title: "Integration permission policy", surfaceId: "govern",
    projectId: "trailblazer-crm", worktreeId: "access-review", kind: "Permission set",
    summary: "Limit integration access to the fields used by lead routing.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to review",
    details: [{ label: "Next step", value: "Limit integration access to the fields used by lead routing." }],
    activity: ["Saved the project context and initial configuration.", "Limit integration access to the fields used by lead routing."],
  },
  {
    id: "storefront-search", title: "Account search experience", surfaceId: "build",
    projectId: "acme-storefront", worktreeId: "search-refresh", kind: "Experience",
    summary: "Refine the account search layout and empty states.", updated: "2026-09-14T12:00:00Z",
    status: "working", statusLabel: "Agent working",
    details: [{ label: "Next step", value: "Refine the account search layout and empty states." }],
    activity: ["Saved the project context and initial configuration.", "Refine the account search layout and empty states."],
  },
  {
    id: "storefront-rollout", title: "UAT rollout checklist", surfaceId: "alm",
    projectId: "acme-storefront", worktreeId: "uat-rollout", kind: "Release plan",
    summary: "Confirm release gates and rollback steps for UAT.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Draft plan",
    details: [{ label: "Next step", value: "Confirm release gates and rollback steps for UAT." }],
    activity: ["Saved the project context and initial configuration.", "Confirm release gates and rollback steps for UAT."],
  },
  {
    id: "onboarding-flow-change", title: "Customer welcome flow", surfaceId: "build",
    projectId: "customer-onboarding", worktreeId: "welcome-flow", kind: "Flow",
    summary: "Refine welcome tasks and follow-up reminders.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Refine welcome tasks and follow-up reminders." }],
    activity: ["Saved the project context and initial configuration.", "Refine welcome tasks and follow-up reminders."],
  },
  {
    id: "onboarding-handoff", title: "Customer success handoff", surfaceId: "alm",
    projectId: "customer-onboarding", worktreeId: "handoff-checklist", kind: "Release plan",
    summary: "Plan acceptance checks with the customer success team.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Draft plan",
    details: [{ label: "Next step", value: "Plan acceptance checks with the customer success team." }],
    activity: ["Saved the project context and initial configuration.", "Plan acceptance checks with the customer success team."],
  },
  {
    id: "service-routing-change", title: "Priority case routing", surfaceId: "build",
    projectId: "service-operations", worktreeId: "case-routing", kind: "Flow",
    summary: "Refine priority routing and escalation rules.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Refine priority routing and escalation rules." }],
    activity: ["Saved the project context and initial configuration.", "Refine priority routing and escalation rules."],
  },
  {
    id: "service-alerts", title: "Service response alerts", surfaceId: "govern",
    projectId: "service-operations", worktreeId: "sla-alerts", kind: "Health monitor",
    summary: "Confirm alert thresholds before enabling notifications.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Next step", value: "Confirm alert thresholds before enabling notifications." }],
    activity: ["Saved the project context and initial configuration.", "Confirm alert thresholds before enabling notifications."],
  },
  {
    id: "revenue-dashboard", title: "Revenue forecast dashboard", surfaceId: "build",
    projectId: "revenue-insights", worktreeId: "forecast-dashboard", kind: "Dashboard",
    summary: "Arrange forecast trends and pipeline coverage for sales leaders.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Arrange forecast trends and pipeline coverage for sales leaders." }],
    activity: ["Saved the project context and initial configuration.", "Arrange forecast trends and pipeline coverage for sales leaders."],
  },
  {
    id: "revenue-quality", title: "Revenue data validation", surfaceId: "code",
    projectId: "revenue-insights", worktreeId: "data-quality", kind: "Test suite",
    summary: "Review coverage for duplicate opportunities and missing close dates.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Review coverage for duplicate opportunities and missing close dates." }],
    activity: ["Saved the project context and initial configuration.", "Review coverage for duplicate opportunities and missing close dates."],
  },
  {
    id: "integration-sync", title: "OrderSyncService.cls", surfaceId: "code",
    projectId: "integration-hub", worktreeId: "order-sync", kind: "Apex class",
    summary: "Review the order mapping and idempotency checks.", updated: "2026-09-14T12:00:00Z",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Next step", value: "Review the order mapping and idempotency checks." }],
    activity: ["Saved the project context and initial configuration.", "Review the order mapping and idempotency checks."],
  },
  {
    id: "integration-retries", title: "Integration retry policy", surfaceId: "govern",
    projectId: "integration-hub", worktreeId: "retry-policy", kind: "Policy",
    summary: "Confirm retry limits and failed-message handling.", updated: "2026-09-14T12:00:00Z",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Next step", value: "Confirm retry limits and failed-message handling." }],
    activity: ["Saved the project context and initial configuration.", "Confirm retry limits and failed-message handling."],
  },
];

export function returningWorkById(id?: string) {
  return RETURNING_WORK.find((work) => work.id === id);
}

export function workCanvasInput(work: ReturningWork): CanvasSpecInput {
  return {
    kind: "work", title: work.title,
    params: { workId: work.id, projectId: work.projectId, worktreeId: work.worktreeId },
  };
}

/** All demo work consumers validate the same captured identity claims. */
export function workForCanvas(params: { workId: string; projectId: string; worktreeId: string | null }) {
  const work = returningWorkById(params.workId);
  return work?.projectId === params.projectId && work.worktreeId === params.worktreeId ? work : undefined;
}
