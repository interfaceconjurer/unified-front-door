import type { Org, Project } from "./model";

/**
 * Global org registry — every authenticated org, standing in for `sf org list`.
 * Orgs are shared across projects; a project just points at one by default.
 * Mixed kinds and states so the holistic org switcher has something to show
 * (scratch expiry, an expired org, production as the caution case).
 */
export const ORGS: readonly Org[] = [
  { id: "acme-devhub", label: "Acme Dev Hub", kind: "devhub", connection: "connected" },
  { id: "scratch-lead", label: "scratch · lead-routing", kind: "scratch", connection: "connected", expiresInDays: 5 },
  { id: "scratch-hotfix", label: "scratch · hotfix-9821", kind: "scratch", connection: "expired", expiresInDays: 0 },
  { id: "sit", label: "SIT Sandbox", kind: "sandbox", connection: "connected" },
  { id: "uat", label: "UAT Sandbox", kind: "sandbox", connection: "connected" },
  { id: "prod", label: "Production", kind: "production", connection: "connected" },
];

/** Full developer workspace; earlier expansion phases project this catalog. */
export const PROJECTS: readonly Project[] = [
  {
    id: "acme-storefront",
    name: "Acme Storefront",
    description: "Commerce experience and its supporting data model.",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "search-refresh", label: "search-refresh", branch: "feature/search-refresh", isPrimary: false },
      { id: "uat-rollout", label: "uat-rollout", branch: "release/uat-rollout", isPrimary: false },
    ],
    defaultOrgId: "sit",
    facets: { objects: 12, flows: 4, apexClasses: 8, lwc: 15, permissionSets: 3 },
    // Sessions appear in global workspace navigation, including single-worktree projects.
    agentSessions: [
      { worktreeId: "search-refresh", status: "working", summary: "Refining account search filters and empty states." },
      { worktreeId: "uat-rollout", status: "idle", summary: "Preparing the next rollout checklist for UAT." },
      { worktreeId: "main", status: "waiting", summary: "Storefront release passed SIT checks; review the UAT rollout and search performance findings. Snapshot: 2026-09-14 13:00 UTC." },
    ],
    // One live app, with follow-up performance and release reviews in its work.
    apps: [
      {
        id: "storefront-prod",
        label: "Acme Storefront",
        url: "https://acme-storefront.example.app",
        status: "live",
        environment: "Production",
        lastDeployed: "2026-09-14T13:00:00Z",
      },
    ],
  },
  {
    id: "trailblazer-crm",
    name: "Trailblazer CRM",
    description: "Sales and service platform with automation and integrations.",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "lead-routing", label: "lead-routing", branch: "feature/lead-routing", isPrimary: false },
      { id: "access-review", label: "access-review", branch: "feature/access-review", isPrimary: false },
      { id: "hotfix-9821", label: "hotfix-9821", branch: "hotfix/W-9821", isPrimary: false },
    ],
    defaultOrgId: "uat",
    facets: { objects: 48, flows: 22, apexClasses: 61, lwc: 34, permissionSets: 11 },
    // Deliberately varied — this is the case the sessions rail exists to show:
    // three worktrees with ongoing implementation, approval, and code review.
    agentSessions: [
      { worktreeId: "access-review", status: "idle", summary: "Integration permission changes are ready to review." },
      {
        worktreeId: "main",
        status: "working",
        summary: "Refactoring OpportunityTriggerHandler — 3 files touched; last update at 2026-09-14 14:56 UTC.",
      },
      {
        worktreeId: "lead-routing",
        status: "waiting",
        summary: "Needs approval before deploying the updated Lead Assignment Rule to UAT.",
      },
      {
        worktreeId: "hotfix-9821",
        status: "waiting",
        summary: "Fix for W-9821 and its regression coverage are waiting for your code review. Snapshot: 2026-09-14 14:35 UTC.",
      },
    ],
    // Two apps, deliberately mixed status — the case that exercises the
    // non-live treatment (Support Community is mid-deploy).
    apps: [
      {
        id: "partner-portal",
        label: "Partner Portal",
        url: "https://partner-portal.trailblazer.example.app",
        status: "live",
        environment: "UAT Sandbox",
        lastDeployed: "2026-09-13T15:00:00Z",
      },
      {
        id: "support-community",
        label: "Support Community",
        url: "https://support-community.trailblazer.example.app",
        status: "building",
        environment: "Staging",
        lastDeployed: "2026-09-14T14:54:00Z",
      },
    ],
  },
  {
    id: "customer-onboarding", name: "Customer Onboarding", description: "Welcome new customers with guided tasks and timely follow-ups.", defaultOrgId: "uat",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "welcome-flow", label: "welcome-flow", branch: "feature/welcome-flow", isPrimary: false },
      { id: "handoff-checklist", label: "handoff-checklist", branch: "feature/handoff-checklist", isPrimary: false },
    ],
    facets: { objects: 5, flows: 3, apexClasses: 2, lwc: 1, permissionSets: 2 },
    agentSessions: [
      { worktreeId: "main", status: "idle", summary: "Project context is saved and ready to continue." },
      { worktreeId: "welcome-flow", status: "idle", summary: "The next change is drafted and ready to refine." },
      { worktreeId: "handoff-checklist", status: "idle", summary: "Planning the next iteration and its acceptance criteria." },
    ],
    apps: [],
  },
  {
    id: "service-operations", name: "Service Operations", description: "Route support cases and monitor service response.", defaultOrgId: "uat",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "case-routing", label: "case-routing", branch: "feature/case-routing", isPrimary: false },
      { id: "sla-alerts", label: "sla-alerts", branch: "feature/sla-alerts", isPrimary: false },
    ],
    facets: { objects: 9, flows: 5, apexClasses: 6, lwc: 3, permissionSets: 4 },
    agentSessions: [
      { worktreeId: "main", status: "idle", summary: "Project context is saved and ready to continue." },
      { worktreeId: "case-routing", status: "idle", summary: "The next change is drafted and ready to refine." },
      { worktreeId: "sla-alerts", status: "idle", summary: "Planning the next iteration and its acceptance criteria." },
    ],
    apps: [],
  },
  {
    id: "revenue-insights", name: "Revenue Insights", description: "Revenue dashboards and the data pipelines behind them.", defaultOrgId: "uat",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "forecast-dashboard", label: "forecast-dashboard", branch: "feature/forecast-dashboard", isPrimary: false },
      { id: "data-quality", label: "data-quality", branch: "feature/data-quality", isPrimary: false },
    ],
    facets: { objects: 7, flows: 2, apexClasses: 4, lwc: 5, permissionSets: 3 },
    agentSessions: [
      { worktreeId: "main", status: "idle", summary: "Project context is saved and ready to continue." },
      { worktreeId: "forecast-dashboard", status: "idle", summary: "The next change is drafted and ready to refine." },
      { worktreeId: "data-quality", status: "idle", summary: "Planning the next iteration and its acceptance criteria." },
    ],
    apps: [],
  },
  {
    id: "integration-hub", name: "Integration Hub", description: "Connect order and customer systems with reliable integrations.", defaultOrgId: "uat",
    worktrees: [
      { id: "main", label: "main", branch: "main", isPrimary: true },
      { id: "order-sync", label: "order-sync", branch: "feature/order-sync", isPrimary: false },
      { id: "retry-policy", label: "retry-policy", branch: "feature/retry-policy", isPrimary: false },
    ],
    facets: { objects: 6, flows: 3, apexClasses: 12, lwc: 2, permissionSets: 4 },
    agentSessions: [
      { worktreeId: "main", status: "idle", summary: "Project context is saved and ready to continue." },
      { worktreeId: "order-sync", status: "idle", summary: "The next change is drafted and ready to refine." },
      { worktreeId: "retry-policy", status: "idle", summary: "Planning the next iteration and its acceptance criteria." },
    ],
    apps: [],
  },
];
