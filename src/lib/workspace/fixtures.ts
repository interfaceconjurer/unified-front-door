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

/**
 * Fixture projects standing in for a real data source (sfdx-project.json + git
 * worktrees). Deliberately mixed to exercise progressive disclosure:
 *
 * - "acme-storefront" is the SIMPLE case: one worktree. A simple user never sees
 *   worktree or session machinery.
 * - "trailblazer-crm" is the SUPER-USER case: multiple worktrees (parallel lines
 *   of work), which surfaces the switcher and the per-worktree agent sessions.
 *
 * Swap this module for real parsing/queries behind the same types and nothing
 * downstream changes.
 */
export const PROJECTS: readonly Project[] = [
  {
    id: "acme-storefront",
    name: "Acme Storefront",
    description: "Commerce experience and its supporting data model.",
    worktrees: [{ id: "main", label: "main", branch: "main", isPrimary: true }],
    defaultOrgId: "sit",
    facets: { objects: 12, flows: 4, apexClasses: 8, lwc: 15, permissionSets: 3 },
    // Single worktree → the rail stays hidden (progressive disclosure), but the
    // session still exists so the seam is exercised even where the UI hides it.
    agentSessions: [
      { worktreeId: "main", status: "idle", summary: "No active work; last session ended 2h ago." },
    ],
    // One live app — the simple case: a single deployed output, nothing to
    // triage.
    apps: [
      {
        id: "storefront-prod",
        label: "Acme Storefront",
        url: "https://acme-storefront.example.app",
        status: "live",
        environment: "Production",
        lastDeployed: "2h ago",
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
      { id: "hotfix-9821", label: "hotfix-9821", branch: "hotfix/W-9821", isPrimary: false },
    ],
    defaultOrgId: "uat",
    facets: { objects: 48, flows: 22, apexClasses: 61, lwc: 34, permissionSets: 11 },
    // Deliberately varied — this is the case the sessions rail exists to show:
    // three worktrees, three different states a super user needs to triage at once.
    agentSessions: [
      {
        worktreeId: "main",
        status: "working",
        summary: "Refactoring OpportunityTriggerHandler — 3 files touched in the last 4 min.",
      },
      {
        worktreeId: "lead-routing",
        status: "waiting",
        summary: "Needs approval before deploying the updated Lead Assignment Rule to UAT.",
      },
      {
        worktreeId: "hotfix-9821",
        status: "idle",
        summary: "Fix for W-9821 is ready for review; no activity in 25 min.",
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
        lastDeployed: "1d ago",
      },
      {
        id: "support-community",
        label: "Support Community",
        url: "https://support-community.trailblazer.example.app",
        status: "building",
        environment: "Staging",
        lastDeployed: "6m ago",
      },
    ],
  },
];
