/**
 * Per-project mock data — the "scoped" half of the global↔project model.
 *
 * The global canvases (canvas-views.tsx) show everything across all projects;
 * these objects are the same kinds of surfaces (work items, pipelines, trust,
 * testing) narrowed to one project. The data is deliberately continuous with the
 * global mock — Acme's blocked Release 26.8, Billing's −6% coverage dip — so
 * opening a project reads as zooming into the same system, not a separate app.
 *
 * A project is opened as its own canvas tab (see canvas-context.openProject);
 * ProjectWorkspace renders one of these with an inner Overview/Trust/Work Items/
 * Pipelines/Testing nav.
 */
import {
  GridIcon,
  DatabaseIcon,
  ShieldIcon,
  WorkflowIcon,
  ListCheckIcon,
  ChartIcon,
  GitBranchIcon,
  BeakerIcon,
  type IconComponent,
} from "@/components/icons";
import { Pill, Stages, type Row, type Stat, type Tone } from "./canvas-kit";

export type Project = {
  id: string;
  name: string;
  subtitle: string;
  Icon: IconComponent;
  status: { label: string; tone: Tone };
  /** Card meta lines shown in the Projects grid. */
  meta: string[];
  /** Overview tab. */
  summary: string;
  stats: Stat[];
  activity: Row[];
  /** Work Items tab. */
  workItems: Row[];
  /** Pipelines tab. */
  pipelines: Row[];
  /** Trust tab. */
  trustStats: Stat[];
  approvals: Row[];
  audit: Row[];
  /** Testing tab. */
  testStats: Stat[];
  suites: Row[];
};

export const projectList: Project[] = [
  {
    id: "acme",
    name: "Acme Onboarding",
    subtitle: "Customer implementation",
    Icon: GridIcon,
    status: { label: "Active", tone: "success" },
    meta: ["6 open work items", "Deploying to staging"],
    summary:
      "Customer implementation for Acme Corp — provisioning, onboarding flows, and the staging cutover.",
    stats: [
      { label: "Open Work Items", value: "6", delta: "2 in review", deltaTone: "info" },
      { label: "Pipeline", value: "Blocked", delta: "Release 26.8 · FIT failed", deltaTone: "danger" },
      { label: "Coverage", value: "88%", delta: "+2% this week", deltaTone: "success" },
      { label: "Approvals", value: "1", delta: "Awaiting you", deltaTone: "warning" },
    ],
    activity: [
      {
        Icon: GitBranchIcon,
        primary: "Release 26.8 blocked at FIT",
        secondary: "FIT check failed",
        meta: "2h ago",
        tags: [<Pill key="s" tone="danger">Blocked</Pill>],
      },
      { Icon: ListCheckIcon, primary: "W-10241 moved to In Review", secondary: "Jordan", meta: "4h ago" },
      {
        Icon: ShieldIcon,
        primary: "Production data export requested",
        secondary: "Priya",
        meta: "yesterday",
        tags: [<Pill key="s" tone="warning">Awaiting you</Pill>],
      },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10241 · Wire OAuth callback",
        secondary: "Jordan",
        tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="danger">P1</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10240 · Seed demo tenants",
        secondary: "Priya",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10237 · Staging cutover checklist",
        secondary: "you",
        tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Release 26.8",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "done" },
              { label: "FIT", state: "failed" },
              { label: "Deploy", state: "todo" },
            ]}
          />
        ),
        meta: "2h ago",
        tags: [<Pill key="s" tone="danger">Blocked</Pill>],
      },
      {
        Icon: GitBranchIcon,
        primary: "Staging deploy",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "done" },
              { label: "FIT", state: "done" },
              { label: "Deploy", state: "active" },
            ]}
          />
        ),
        meta: "just now",
        tags: [<Pill key="s" tone="info">Deploying</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "94 / 100", delta: "+2 this month", deltaTone: "success" },
      { label: "Open Approvals", value: "1", delta: "Awaiting you", deltaTone: "warning" },
      { label: "MFA Coverage", value: "100%", delta: "12 / 12 members", deltaTone: "success" },
    ],
    approvals: [
      {
        Icon: ShieldIcon,
        primary: "Production data export",
        secondary: "Requested by Priya",
        tags: [<Pill key="s" tone="warning">Awaiting you</Pill>],
      },
    ],
    audit: [
      { primary: "Sandbox refreshed", secondary: "acme-staging", meta: "yesterday" },
      { primary: "Role change approved", secondary: "you → Priya", meta: "2 days ago" },
    ],
    testStats: [
      { label: "Pass Rate", value: "92%", delta: "2 failing", deltaTone: "warning" },
      { label: "Coverage", value: "88%", delta: "+2% this week", deltaTone: "success" },
      { label: "Suites", value: "5", delta: "onboarding, api…", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Onboarding · e2e",
        secondary: "34 tests",
        meta: "2 failing",
        tags: [<Pill key="s" tone="danger">Failing</Pill>],
      },
      {
        Icon: BeakerIcon,
        primary: "Provisioning · integration",
        secondary: "52 tests",
        meta: "96% coverage",
        tags: [<Pill key="s" tone="success">Passing</Pill>],
      },
    ],
  },
  {
    id: "billing",
    name: "Billing Platform",
    subtitle: "Revenue",
    Icon: DatabaseIcon,
    status: { label: "Active", tone: "success" },
    meta: ["3 schema changes in review", "Coverage dipped 6%"],
    summary:
      "Revenue platform — invoicing, payments, and the billing data model. Coverage dipped after yesterday's merge.",
    stats: [
      { label: "Open Work Items", value: "4", delta: "2 in review", deltaTone: "info" },
      { label: "Pipeline", value: "Deploying", delta: "Hotfix 26.7.3", deltaTone: "info" },
      { label: "Coverage", value: "74%", delta: "-6% after merge", deltaTone: "warning" },
      { label: "Approvals", value: "0", delta: "All clear", deltaTone: "success" },
    ],
    activity: [
      {
        Icon: BeakerIcon,
        primary: "Coverage dropped 6% after merge",
        secondary: "Billing · unit",
        meta: "yesterday",
        tags: [<Pill key="s" tone="warning">Low coverage</Pill>],
      },
      {
        Icon: GitBranchIcon,
        primary: "Hotfix 26.7.3 deploying",
        secondary: "Deploy in progress",
        meta: "just now",
        tags: [<Pill key="s" tone="info">Deploying</Pill>],
      },
      { Icon: ListCheckIcon, primary: "W-10238 moved to In Progress", secondary: "Priya", meta: "3h ago" },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10238 · Fix invoice rounding",
        secondary: "Priya",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10212 · Coverage for refund paths",
        secondary: "Jordan",
        tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10205 · Dunning email retries",
        secondary: "Sam",
        tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Billing hotfix 26.7.3",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "done" },
              { label: "FIT", state: "done" },
              { label: "Deploy", state: "active" },
            ]}
          />
        ),
        meta: "just now",
        tags: [<Pill key="s" tone="info">Deploying</Pill>],
      },
      {
        Icon: GitBranchIcon,
        primary: "Nightly billing",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "done" },
              { label: "FIT", state: "done" },
              { label: "Deploy", state: "done" },
            ]}
          />
        ),
        meta: "6h ago",
        tags: [<Pill key="s" tone="success">Passed</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "90 / 100", delta: "+1 this month", deltaTone: "success" },
      { label: "Open Approvals", value: "0", delta: "All clear", deltaTone: "success" },
      { label: "MFA Coverage", value: "100%", delta: "9 / 9 members", deltaTone: "success" },
    ],
    approvals: [],
    audit: [
      { primary: "Data retention policy updated", secondary: "90 → 180 days", meta: "2 days ago" },
      { primary: "Temporary access revoked", secondary: "contractor-4821", meta: "3 days ago" },
    ],
    testStats: [
      { label: "Pass Rate", value: "90%", delta: "-1% this week", deltaTone: "warning" },
      { label: "Coverage", value: "74%", delta: "-6% after merge", deltaTone: "warning" },
      { label: "Suites", value: "4", delta: "billing, payments…", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Billing · unit",
        secondary: "412 tests",
        meta: "74% coverage",
        tags: [<Pill key="s" tone="warning">Low coverage</Pill>],
      },
      {
        Icon: BeakerIcon,
        primary: "Payments · unit",
        secondary: "263 tests",
        meta: "91% coverage",
        tags: [<Pill key="s" tone="success">Passing</Pill>],
      },
    ],
  },
  {
    id: "data-migration",
    name: "Data Migration",
    subtitle: "Platform",
    Icon: ShieldIcon,
    status: { label: "Blocked", tone: "danger" },
    meta: ["Blocked on access approval"],
    summary:
      "Platform migration of legacy accounts — currently blocked on an elevated-access approval.",
    stats: [
      { label: "Open Work Items", value: "3", delta: "1 blocked", deltaTone: "danger" },
      { label: "Pipeline", value: "Running", delta: "Dry-run", deltaTone: "info" },
      { label: "Coverage", value: "71%", delta: "unchanged", deltaTone: "neutral" },
      { label: "Approvals", value: "1", delta: "Awaiting you", deltaTone: "warning" },
    ],
    activity: [
      {
        Icon: ShieldIcon,
        primary: "Elevated access requested: billing-db",
        secondary: "Sam",
        meta: "1h ago",
        tags: [<Pill key="s" tone="warning">Awaiting you</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10225 blocked",
        secondary: "Sam",
        meta: "yesterday",
        tags: [<Pill key="s" tone="danger">Blocked</Pill>],
      },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10225 · Migrate legacy accounts",
        secondary: "Sam",
        tags: [<Pill key="st" tone="danger">Blocked</Pill>, <Pill key="p" tone="danger">P1</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10222 · Backfill account ids",
        secondary: "Lee",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10218 · Dry-run migration report",
        secondary: "you",
        tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Migration dry-run",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "active" },
              { label: "FIT", state: "todo" },
              { label: "Deploy", state: "todo" },
            ]}
          />
        ),
        meta: "20m ago",
        tags: [<Pill key="s" tone="info">Running</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "88 / 100", delta: "review open", deltaTone: "neutral" },
      { label: "Open Approvals", value: "1", delta: "Awaiting you", deltaTone: "warning" },
      { label: "MFA Coverage", value: "100%", delta: "7 / 7 members", deltaTone: "success" },
    ],
    approvals: [
      {
        Icon: ShieldIcon,
        primary: "Elevated access: billing-db",
        secondary: "Requested by Sam",
        tags: [<Pill key="s" tone="warning">Awaiting you</Pill>],
      },
    ],
    audit: [
      { primary: "Access request opened", secondary: "billing-db", meta: "1h ago" },
      { primary: "Migration plan approved", secondary: "you", meta: "2 days ago" },
    ],
    testStats: [
      { label: "Pass Rate", value: "85%", delta: "flaky suite", deltaTone: "warning" },
      { label: "Coverage", value: "71%", delta: "unchanged", deltaTone: "neutral" },
      { label: "Suites", value: "3", delta: "migration, api…", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Migration · integration",
        secondary: "40 tests",
        meta: "71% coverage",
        tags: [<Pill key="s" tone="warning">Low coverage</Pill>],
      },
    ],
  },
  {
    id: "partner-portal",
    name: "Partner Portal",
    subtitle: "External",
    Icon: WorkflowIcon,
    status: { label: "Planning", tone: "neutral" },
    meta: ["Design phase", "SSO handshake in progress"],
    summary: "External partner portal — in design, with the SSO handshake in progress.",
    stats: [
      { label: "Open Work Items", value: "2", delta: "1 in progress", deltaTone: "info" },
      { label: "Pipeline", value: "Running", delta: "Preview build", deltaTone: "info" },
      { label: "Coverage", value: "79%", delta: "3 flaky", deltaTone: "warning" },
      { label: "Approvals", value: "0", delta: "All clear", deltaTone: "success" },
    ],
    activity: [
      { Icon: WorkflowIcon, primary: "SSO handshake in progress", secondary: "Lee", meta: "5h ago" },
      {
        Icon: ListCheckIcon,
        primary: "W-10219 marked Done",
        secondary: "Lee",
        meta: "yesterday",
        tags: [<Pill key="s" tone="success">Done</Pill>],
      },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10219 · Partner SSO handshake",
        secondary: "Lee",
        tags: [<Pill key="st" tone="success">Done</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10216 · Portal shell layout",
        secondary: "you",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Partner Portal preview",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "active" },
              { label: "FIT", state: "todo" },
              { label: "Deploy", state: "todo" },
            ]}
          />
        ),
        meta: "3m ago",
        tags: [<Pill key="s" tone="info">Running</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "86 / 100", delta: "onboarding", deltaTone: "neutral" },
      { label: "Open Approvals", value: "0", delta: "All clear", deltaTone: "success" },
      { label: "MFA Coverage", value: "100%", delta: "5 / 5 members", deltaTone: "success" },
    ],
    approvals: [],
    audit: [{ primary: "SSO client registered", secondary: "partner-portal", meta: "yesterday" }],
    testStats: [
      { label: "Pass Rate", value: "88%", delta: "3 flaky", deltaTone: "warning" },
      { label: "Coverage", value: "79%", delta: "unchanged", deltaTone: "neutral" },
      { label: "Suites", value: "2", delta: "portal, api", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Portal · e2e",
        secondary: "51 tests",
        meta: "3 flaky",
        tags: [<Pill key="s" tone="warning">Flaky</Pill>],
      },
    ],
  },
  {
    id: "support-console",
    name: "Support Console",
    subtitle: "Service",
    Icon: ListCheckIcon,
    status: { label: "Active", tone: "success" },
    meta: ["12 open items", "89% tests passing"],
    summary: "Customer support console — steady state, 12 open items and healthy tests.",
    stats: [
      { label: "Open Work Items", value: "12", delta: "3 closed today", deltaTone: "info" },
      { label: "Pipeline", value: "Passed", delta: "Nightly", deltaTone: "success" },
      { label: "Coverage", value: "89%", delta: "+1% this week", deltaTone: "success" },
      { label: "Approvals", value: "0", delta: "All clear", deltaTone: "success" },
    ],
    activity: [
      { Icon: ListCheckIcon, primary: "3 items closed today", secondary: "team", meta: "1h ago" },
      {
        Icon: GitBranchIcon,
        primary: "Nightly build passed",
        secondary: "all stages green",
        meta: "6h ago",
        tags: [<Pill key="s" tone="success">Passed</Pill>],
      },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10199 · Macro editor a11y",
        secondary: "you",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10188 · Bulk case merge",
        secondary: "Lee",
        tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10180 · SLA timer fix",
        secondary: "Priya",
        tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Support Console CI",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "done" },
              { label: "Test", state: "done" },
              { label: "FIT", state: "done" },
              { label: "Deploy", state: "done" },
            ]}
          />
        ),
        meta: "6h ago",
        tags: [<Pill key="s" tone="success">Passed</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "91 / 100", delta: "+1 this month", deltaTone: "success" },
      { label: "Open Approvals", value: "0", delta: "All clear", deltaTone: "success" },
      { label: "MFA Coverage", value: "100%", delta: "14 / 14 members", deltaTone: "success" },
    ],
    approvals: [],
    audit: [{ primary: "Role change approved", secondary: "you → Lee", meta: "2 days ago" }],
    testStats: [
      { label: "Pass Rate", value: "96%", delta: "+1% this week", deltaTone: "success" },
      { label: "Coverage", value: "89%", delta: "+1% this week", deltaTone: "success" },
      { label: "Suites", value: "4", delta: "cases, console…", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Cases · unit",
        secondary: "210 tests",
        meta: "89% coverage",
        tags: [<Pill key="s" tone="success">Passing</Pill>],
      },
      {
        Icon: BeakerIcon,
        primary: "Console · e2e",
        secondary: "28 tests",
        meta: "all passing",
        tags: [<Pill key="s" tone="success">Passing</Pill>],
      },
    ],
  },
  {
    id: "analytics-hub",
    name: "Analytics Hub",
    subtitle: "Insights",
    Icon: ChartIcon,
    status: { label: "At risk", tone: "warning" },
    meta: ["Launch next week"],
    summary: "Insights and dashboards — launching next week; a few items still at risk.",
    stats: [
      { label: "Open Work Items", value: "5", delta: "1 at risk", deltaTone: "warning" },
      { label: "Pipeline", value: "Queued", delta: "1.2 release", deltaTone: "neutral" },
      { label: "Coverage", value: "76%", delta: "unchanged", deltaTone: "neutral" },
      { label: "Approvals", value: "0", delta: "All clear", deltaTone: "success" },
    ],
    activity: [
      {
        Icon: ChartIcon,
        primary: "Launch scheduled next week",
        secondary: "go/no-go Friday",
        meta: "today",
        tags: [<Pill key="s" tone="warning">At risk</Pill>],
      },
      { Icon: ListCheckIcon, primary: "2 dashboards pending review", secondary: "Priya", meta: "yesterday" },
    ],
    workItems: [
      {
        Icon: ListCheckIcon,
        primary: "W-10260 · Cohort explorer",
        secondary: "Priya",
        tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="danger">P1</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10255 · Export to CSV",
        secondary: "you",
        tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="warning">P2</Pill>],
      },
      {
        Icon: ListCheckIcon,
        primary: "W-10251 · Chart theming",
        secondary: "Lee",
        tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
      },
    ],
    pipelines: [
      {
        Icon: GitBranchIcon,
        primary: "Analytics Hub 1.2",
        secondary: (
          <Stages
            steps={[
              { label: "Build", state: "todo" },
              { label: "Test", state: "todo" },
              { label: "FIT", state: "todo" },
              { label: "Deploy", state: "todo" },
            ]}
          />
        ),
        meta: "queued",
        tags: [<Pill key="s" tone="neutral">Queued</Pill>],
      },
    ],
    trustStats: [
      { label: "Security Score", value: "87 / 100", delta: "onboarding", deltaTone: "neutral" },
      { label: "Open Approvals", value: "0", delta: "All clear", deltaTone: "success" },
      { label: "MFA Coverage", value: "100%", delta: "6 / 6 members", deltaTone: "success" },
    ],
    approvals: [],
    audit: [{ primary: "Data source connected", secondary: "warehouse-prod", meta: "yesterday" }],
    testStats: [
      { label: "Pass Rate", value: "90%", delta: "pre-launch", deltaTone: "warning" },
      { label: "Coverage", value: "76%", delta: "unchanged", deltaTone: "neutral" },
      { label: "Suites", value: "3", delta: "charts, api…", deltaTone: "neutral" },
    ],
    suites: [
      {
        Icon: BeakerIcon,
        primary: "Charts · unit",
        secondary: "120 tests",
        meta: "76% coverage",
        tags: [<Pill key="s" tone="warning">Low coverage</Pill>],
      },
    ],
  },
];

/** Projects keyed by id, for open-or-focus lookups when a card is clicked. */
export const projectsById: Record<string, Project> = Object.fromEntries(
  projectList.map((p) => [p.id, p]),
);
