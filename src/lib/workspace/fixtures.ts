import type { Project } from "./model";

/**
 * Fixture projects standing in for a real data source (sfdx-project.json + org
 * list). Deliberately mixed to exercise progressive disclosure:
 *
 * - "acme-storefront" is the SIMPLE case: one worktree, one org. A simple user
 *   never sees worktree or session machinery.
 * - "trailblazer-crm" is the SUPER-USER case: multiple worktrees (parallel lines
 *   of work) and multiple orgs, which is what surfaces the switchers and the
 *   per-worktree agent sessions.
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
    environments: [
      { id: "acme-dev", label: "Dev Sandbox", kind: "sandbox" },
    ],
    facets: { objects: 12, flows: 4, apexClasses: 8, lwc: 15, permissionSets: 3 },
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
    environments: [
      { id: "tb-scratch", label: "Scratch", kind: "scratch" },
      { id: "tb-sit", label: "SIT Sandbox", kind: "sandbox" },
      { id: "tb-prod", label: "Production", kind: "production" },
    ],
    facets: { objects: 48, flows: 22, apexClasses: 61, lwc: 34, permissionSets: 11 },
  },
];
