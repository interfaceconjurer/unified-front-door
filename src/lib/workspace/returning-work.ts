import type { CanvasSpecInput } from "@/lib/surface-canvas/model";
import type { SurfaceId } from "./model";

export type WorkStatus = "working" | "review" | "ready" | "saved" | "live";
export type ReturningWork = {
  id: string;
  title: string;
  surfaceId: SurfaceId;
  projectId: string;
  worktreeId: string;
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
    summary: "Agent is refactoring the handler and its tests.", updated: "4 min ago",
    status: "working", statusLabel: "Agent working",
    details: [{ label: "Files touched", value: "3 files" }, { label: "Focus", value: "Bulk processing and shared validation" }, { label: "Next step", value: "Review the agent’s changes" }],
    activity: ["Agent started consolidating validation logic.", "Updated the handler and supporting test class.", "Preparing a summary of the changes for review."],
    sourceLabel: "Working notes",
    source: "OpportunityTriggerHandler.cls\nOpportunityValidationService.cls\nOpportunityTriggerHandlerTest.cls\n\nCurrent task\nConsolidate shared validation and cover bulk updates.",
  },
  {
    id: "lead-routing-release", title: "Lead routing → UAT", surfaceId: "alm",
    projectId: "trailblazer-crm", worktreeId: "lead-routing", kind: "Release plan",
    summary: "The updated Lead Assignment Rule is waiting for your review.", updated: "12 min ago",
    status: "review", statusLabel: "Approval needed", attention: true,
    details: [{ label: "Target", value: "UAT Sandbox" }, { label: "Change", value: "Lead Assignment Rule and supporting automation" }, { label: "Gate", value: "Developer approval before deployment" }],
    activity: ["Agent assembled the lead-routing change set.", "Validation completed in the development sandbox.", "Agent paused before deployment to request approval."],
  },
  {
    id: "lead-routing-agent", title: "Lead routing assistant", surfaceId: "build",
    projectId: "trailblazer-crm", worktreeId: "lead-routing", kind: "Agent",
    summary: "Qualification instructions and routing actions are ready to refine.", updated: "18 min ago",
    status: "ready", statusLabel: "Ready to continue",
    details: [{ label: "Purpose", value: "Qualify incoming leads and suggest an owner" }, { label: "Actions", value: "Read lead context · Recommend a queue · Explain the assignment" }, { label: "Related work", value: "Lead routing → UAT" }],
    activity: ["Added guidance for incomplete lead records.", "Updated the routing action to explain its recommendation.", "Saved the configuration for the next review."],
    sourceLabel: "Agent instructions",
    source: "Review the lead’s region, company size, and product interest.\nRecommend the most appropriate sales queue.\nExplain the recommendation and ask for missing information.\nRequest approval before changing an assignment.",
  },
  {
    id: "hotfix-tests", title: "W-9821 regression tests", surfaceId: "code",
    projectId: "trailblazer-crm", worktreeId: "hotfix-9821", kind: "Test suite",
    summary: "The hotfix and regression coverage are ready for code review.", updated: "25 min ago",
    status: "ready", statusLabel: "Ready for review",
    details: [{ label: "Scope", value: "Opportunity updates and owner reassignment" }, { label: "Branch", value: "hotfix/W-9821" }, { label: "Next step", value: "Review the fix and its regression coverage" }],
    activity: ["Reproduced the reassignment issue.", "Added regression coverage for the fix.", "Agent finished preparing the changes for review."],
  },
  {
    id: "integration-access", title: "Integration user access", surfaceId: "govern",
    projectId: "trailblazer-crm", worktreeId: "main", kind: "Access review",
    summary: "Review the permissions requested for the lead-routing integration.", updated: "38 min ago",
    status: "review", statusLabel: "Review needed", attention: true,
    details: [{ label: "Identity", value: "Lead routing integration user" }, { label: "Requested access", value: "Read leads and accounts · Update lead owner" }, { label: "Review focus", value: "Limit access to the routing workflow" }],
    activity: ["Captured the integration’s requested permissions.", "Compared the request with the routing workflow.", "Prepared the access review for your decision."],
  },
  {
    id: "developer-toolkit", title: "CRM developer toolkit", surfaceId: "code",
    projectId: "trailblazer-crm", worktreeId: "main", kind: "Toolkit",
    summary: "Your saved skills and integrations for Salesforce development.", updated: "1 hour ago",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Skills", value: "Apex review · Regression planning" }, { label: "Plugin", value: "Salesforce development" }, { label: "Connections", value: "Salesforce connector · Project and org MCP tools" }],
    activity: ["Added an Apex review skill to the toolkit.", "Configured the Salesforce connector and project tools.", "Saved the toolkit for reuse across CRM tasks."],
    sourceLabel: "Toolkit configuration",
    source: "skills:\n  - apex-review\n  - regression-planning\nplugins:\n  - salesforce-development\nconnectors:\n  - salesforce\nmcp_tools:\n  - project-context\n  - org-metadata",
  },
  {
    id: "storefront-app", title: "Acme Storefront", surfaceId: "build",
    projectId: "acme-storefront", worktreeId: "main", kind: "React app",
    summary: "The storefront is live, with your next UI changes ready to plan.", updated: "2 hours ago",
    status: "live", statusLabel: "Live",
    details: [{ label: "Environment", value: "Production" }, { label: "Last deployment", value: "2 hours ago" }, { label: "Next focus", value: "Account browsing and search experience" }],
    activity: ["Completed the storefront release.", "Deployment is live in production.", "Saved notes for the next iteration."],
  },
  {
    id: "storefront-health", title: "Storefront health", surfaceId: "govern",
    projectId: "acme-storefront", worktreeId: "main", kind: "Health monitor",
    summary: "Follow the storefront’s availability, errors, and API usage.", updated: "2 hours ago",
    status: "saved", statusLabel: "Monitoring configured",
    details: [{ label: "Application", value: "Acme Storefront" }, { label: "Signals", value: "Availability · Errors · API usage" }, { label: "Environment", value: "Production" }],
    activity: ["Added the storefront’s operational signals.", "Saved the monitoring configuration after the release."],
  },
  {
    id: "account-query", title: "Enterprise accounts.soql", surfaceId: "code",
    projectId: "acme-storefront", worktreeId: "main", kind: "Saved SOQL query",
    summary: "Your saved account query for the storefront experience.", updated: "Yesterday",
    status: "saved", statusLabel: "Saved",
    details: [{ label: "Object", value: "Account" }, { label: "Fields", value: "Id · Name · Industry" }, { label: "Limit", value: "100 records" }],
    activity: ["Selected the account fields used by the storefront.", "Saved the query for the next development session."],
    sourceLabel: "SOQL query",
    source: "SELECT Id, Name, Industry\nFROM Account\nORDER BY Name\nLIMIT 100",
  },
  {
    id: "storefront-release", title: "Storefront next release", surfaceId: "alm",
    projectId: "acme-storefront", worktreeId: "main", kind: "Release plan",
    summary: "Continue planning the next storefront release.", updated: "Yesterday",
    status: "saved", statusLabel: "Draft",
    details: [{ label: "Source", value: "main" }, { label: "Validation", value: "SIT Sandbox" }, { label: "Planned scope", value: "Account search and UI improvements" }],
    activity: ["Started the release plan for the next iteration.", "Added UI improvements to the planned scope."],
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
