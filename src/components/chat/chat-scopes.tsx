/**
 * Per-scope agent sessions — the conversation the chat panel loads for whatever
 * the workspace is currently scoped to.
 *
 * The agent is bound to the active canvas's scope. Everything global (Today,
 * Projects, Metrics, the ALM surfaces…) shares one workspace-wide session about
 * org policy, governance, and pipeline posture. Opening a project loads that
 * project's own session, written to be continuous with its mock data (Acme's
 * blocked Release 26.8, Billing's coverage dip, Data Migration's access block…)
 * so the chat reads as zooming into the same system the canvas shows — not a
 * separate app. It's a wireframe: nothing is actually queried.
 *
 * Sessions are keyed by canvas scope metadata — the global scope when no project
 * scope is declared, and `"project:<id>"` for project canvases and builders. The
 * chat panel keeps live history per key, seeding a fresh scope from the constants
 * here.
 */

import { GLOBAL_SCOPE, projectIdFromCanvasId, type ScopeKey } from "@/components/canvas/canvas-ids";
import { projectsById } from "@/components/canvas/projects-data";

export type ChatRole = "agent" | "user" | "tool";
export type ChatMessage = { id: number; role: ChatRole; text: string };

/** The label shown by chat and shell chrome for the active scope. */
export type ScopeMeta = { label: string };

const GLOBAL_META: ScopeMeta = { label: "All projects" };

function projectForScopeKey(scopeKey: ScopeKey) {
  if (scopeKey === GLOBAL_SCOPE) return undefined;
  return projectsById[projectIdFromCanvasId(scopeKey)];
}

// The workspace-wide session. Opens on governance — the policies in force across
// every project — then pivots to pipeline posture, both drawn from the same mock
// world the project sessions live in.
const GLOBAL_SESSION: ChatMessage[] = [
  {
    id: 1,
    role: "agent",
    text: "I'm your workspace agent, working across every project in the org. Ask me about policy, governance, or pipeline health.",
  },
  {
    id: 2,
    role: "user",
    text: "What deployment policies are enforced across all projects?",
  },
  {
    id: 3,
    role: "tool",
    text: 'get_policies(scope: "org", area: "deployment")',
  },
  {
    id: 4,
    role: "agent",
    text: "Three are enforced org-wide: every production deploy needs one approval, the FIT gate must pass before Deploy, and main is protected — no direct pushes. Acme's Release 26.8 is sitting on that FIT gate right now.",
  },
  {
    id: 5,
    role: "user",
    text: "Which pipelines are blocked?",
  },
  {
    id: 6,
    role: "tool",
    text: 'list_pipelines(state: "blocked")',
  },
  {
    id: 7,
    role: "agent",
    text: "One: Acme Onboarding · Release 26.8, failed at FIT 2h ago. Billing's hotfix 26.7.3 is mid-deploy, and everything else is green or queued.",
  },
];

// Project sessions, keyed by project id. Each opens on that project's live
// situation, then walks one query→answer exchange that lands on the same detail
// the project's canvas surfaces.
const PROJECT_SESSIONS: Record<string, ChatMessage[]> = {
  acme: [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Acme Onboarding. Release 26.8 is blocked at FIT and one approval is waiting on you — want to start there?",
    },
    { id: 2, role: "user", text: "Why did the FIT gate fail on 26.8?" },
    { id: 3, role: "tool", text: 'get_pipeline(project: "acme", release: "26.8")' },
    {
      id: 4,
      role: "agent",
      text: "FIT failed 2h ago — Onboarding · e2e has 2 failing tests; Build and Test passed. I can open the failing suite or the release.",
    },
  ],
  billing: [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Billing Platform. Coverage fell to 74% after yesterday's merge, and hotfix 26.7.3 is mid-deploy.",
    },
    { id: 2, role: "user", text: "What dropped the coverage?" },
    { id: 3, role: "tool", text: 'diff_coverage(project: "billing", since: "yesterday")' },
    {
      id: 4,
      role: "agent",
      text: "The refund paths merged without tests — W-10212 covers them and it's in review. Payments · unit is still healthy at 91%.",
    },
  ],
  "data-migration": [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Data Migration. This one's blocked — Sam requested elevated access to billing-db and it's awaiting your approval.",
    },
    { id: 2, role: "user", text: "What does approving it unblock?" },
    { id: 3, role: "tool", text: 'get_work_item(id: "W-10225")' },
    {
      id: 4,
      role: "agent",
      text: "W-10225 · Migrate legacy accounts (P1). It needs billing-db read to finish the dry-run — approve the request and the pipeline can move past Test.",
    },
  ],
  "partner-portal": [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Partner Portal — still in design, with the SSO handshake as the live thread.",
    },
    { id: 2, role: "user", text: "Where does the SSO work stand?" },
    { id: 3, role: "tool", text: 'get_work_item(id: "W-10219")' },
    {
      id: 4,
      role: "agent",
      text: "W-10219 · Partner SSO handshake is Done and the client's registered. Next up is W-10216 · Portal shell layout, in progress; the preview build is running.",
    },
  ],
  "support-console": [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Support Console. Steady state — nightly's green and 12 items are open.",
    },
    { id: 2, role: "user", text: "Anything need me today?" },
    { id: 3, role: "tool", text: 'list_work_items(project: "support-console", assignee: "you")' },
    {
      id: 4,
      role: "agent",
      text: "One's on you: W-10199 · Macro editor a11y, in progress. No approvals pending, and tests are at 89% and trending up.",
    },
  ],
  "analytics-hub": [
    {
      id: 1,
      role: "agent",
      text: "Scoped to Analytics Hub. Launching next week — a couple of items are at risk before Friday's go/no-go.",
    },
    { id: 2, role: "user", text: "What's the risk to launch?" },
    { id: 3, role: "tool", text: 'list_work_items(project: "analytics-hub", risk: "high")' },
    {
      id: 4,
      role: "agent",
      text: "W-10260 · Cohort explorer (P1) is the critical path, still in progress. The 1.2 pipeline is queued and two dashboards are pending Priya's review.",
    },
  ],
};

/** The scope label, resolved from the scope key alone. A builder pointed at a
 *  project reads the same as that project's own canvas. */
export function scopeMetaFor(scopeKey: ScopeKey): ScopeMeta {
  if (scopeKey === GLOBAL_SCOPE) return GLOBAL_META;
  return { label: projectForScopeKey(scopeKey)?.name ?? "Project" };
}

/** The seed transcript for a scope. Known projects get a bespoke session; any
 *  other project falls back to a plain scoped greeting so the model still holds
 *  as projects are added. */
export function seedMessagesFor(scopeKey: ScopeKey): ChatMessage[] {
  if (scopeKey === GLOBAL_SCOPE) return GLOBAL_SESSION;
  const projectId = projectIdFromCanvasId(scopeKey);
  return (
    PROJECT_SESSIONS[projectId] ?? [
      {
        id: 1,
        role: "agent",
        text: `Scoped to ${projectForScopeKey(scopeKey)?.name ?? "this project"}. Ask me to build, query, or navigate within this project.`,
      },
    ]
  );
}
