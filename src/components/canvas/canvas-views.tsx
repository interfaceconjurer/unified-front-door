/**
 * Dedicated canvas bodies — one per nav item. Each is a thin composition of the
 * canvas kit over mock data (wireframe fidelity). The data is kept continuous
 * with the Today brief — same projects (Acme Onboarding, Billing), the same
 * blocked Release 26.8, the same Billing coverage dip — so the prototype reads
 * as one coherent workspace rather than disconnected screens.
 */
import type { ReactElement } from "react";
import {
  FolderIcon,
  GridIcon,
  ChartIcon,
  PuzzleIcon,
  ShieldIcon,
  ListCheckIcon,
  GitBranchIcon,
  BeakerIcon,
  DatabaseIcon,
  PlusIcon,
  WorkflowIcon,
} from "@/components/icons";
import {
  ActionButton,
  CanvasHeader,
  CanvasView,
  CardGrid,
  ChartPlaceholder,
  DataList,
  Panel,
  Pill,
  Stages,
  StatTiles,
  type CardItem,
  type Row,
} from "./canvas-kit";
import type { CanvasBodyProps } from "./canvases";
import { projectList } from "./projects-data";

/* ── Projects ─────────────────────────────────────────────────────────── */
/**
 * The one canvas that's a jumping-off point: each card opens that project as its
 * own canvas tab (open-or-focus), so the global rail stays put while you drop
 * into a project's own workspace. The card data comes from projects-data — the
 * same source the opened project workspace reads — so the grid and the workspace
 * never drift.
 */
export function ProjectsCanvas({ openProject }: CanvasBodyProps): ReactElement {
  const cards: CardItem[] = projectList.map((p) => ({
    id: p.id,
    Icon: p.Icon,
    title: p.name,
    subtitle: p.subtitle,
    meta: p.meta,
    status: p.status,
    onSelect: () => openProject(p.id),
  }));

  return (
    <CanvasView>
      <CanvasHeader
        Icon={FolderIcon}
        title="Projects"
        subtitle="Everything you're building across the org. Open one to work inside it."
        action={<ActionButton Icon={PlusIcon}>New project</ActionButton>}
      />
      <CardGrid cards={cards} />
    </CanvasView>
  );
}

/* ── My Apps ──────────────────────────────────────────────────────────── */
const apps: CardItem[] = [
  {
    Icon: GridIcon,
    title: "Sales Cloud",
    subtitle: "Revenue",
    meta: ["v4.2.0", "Deployed 2 days ago"],
    status: { label: "Production", tone: "success" },
  },
  {
    Icon: ListCheckIcon,
    title: "Service Console",
    subtitle: "Support",
    meta: ["v3.8.1", "Deployed today"],
    status: { label: "Production", tone: "success" },
  },
  {
    Icon: DatabaseIcon,
    title: "Billing Admin",
    subtitle: "Finance",
    meta: ["v2.1.0-rc3", "In staging"],
    status: { label: "Sandbox", tone: "info" },
  },
  {
    Icon: WorkflowIcon,
    title: "Partner Portal",
    subtitle: "External",
    meta: ["v0.4.0", "Preview only"],
    status: { label: "Preview", tone: "neutral" },
  },
  {
    Icon: ChartIcon,
    title: "Analytics Studio",
    subtitle: "Insights",
    meta: ["v1.1.2", "Deployed 5 days ago"],
    status: { label: "Production", tone: "success" },
  },
  {
    Icon: GridIcon,
    title: "Field Ops",
    subtitle: "Operations",
    meta: ["v2.6.0", "Deployed last week"],
    status: { label: "Production", tone: "success" },
  },
];

export function MyAppsCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={GridIcon}
        title="My Apps"
        subtitle="Apps you own or have access to."
        action={<ActionButton Icon={PlusIcon}>New app</ActionButton>}
      />
      <CardGrid cards={apps} />
    </CanvasView>
  );
}

/* ── Metrics ──────────────────────────────────────────────────────────── */
const endpointRows: Row[] = [
  { primary: "POST /api/v2/invoices", secondary: "Billing Platform", meta: "p95 188ms", tags: [<Pill key="s" tone="success">Healthy</Pill>] },
  { primary: "GET /api/v2/accounts", secondary: "Sales Cloud", meta: "p95 96ms", tags: [<Pill key="s" tone="success">Healthy</Pill>] },
  { primary: "POST /api/v2/onboarding", secondary: "Acme Onboarding", meta: "p95 402ms", tags: [<Pill key="s" tone="warning">Slow</Pill>] },
  { primary: "GET /api/v2/reports", secondary: "Analytics Hub", meta: "p95 271ms", tags: [<Pill key="s" tone="success">Healthy</Pill>] },
];

export function MetricsCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={ChartIcon}
        title="Metrics"
        subtitle="Traffic and health across your services, last 24 hours."
      />
      <StatTiles
        stats={[
          { label: "API Requests", value: "1.24M", delta: "+8% vs. yesterday", deltaTone: "success" },
          { label: "p95 Latency", value: "212ms", delta: "-14ms", deltaTone: "success" },
          { label: "Error Rate", value: "0.42%", delta: "+0.1%", deltaTone: "warning" },
          { label: "Active Users", value: "3,891", delta: "+120", deltaTone: "success" },
        ]}
      />
      <Panel title="Requests over time">
        <ChartPlaceholder />
      </Panel>
      <DataList title="Busiest endpoints" rows={endpointRows} />
    </CanvasView>
  );
}

/* ── Plugins ──────────────────────────────────────────────────────────── */
const plugins: Row[] = [
  { Icon: PuzzleIcon, primary: "Slack Notifications", secondary: "Post pipeline and approval events to channels", tags: [<Pill key="s" tone="success">Enabled</Pill>] },
  { Icon: PuzzleIcon, primary: "GitHub Sync", secondary: "Mirror work items to and from pull requests", tags: [<Pill key="s" tone="success">Enabled</Pill>] },
  { Icon: PuzzleIcon, primary: "PagerDuty", secondary: "Page on-call when a production pipeline fails", tags: [<Pill key="s" tone="success">Enabled</Pill>] },
  { Icon: PuzzleIcon, primary: "Jira Bridge", secondary: "Two-way sync with an external Jira project", tags: [<Pill key="s" tone="neutral">Disabled</Pill>] },
  { Icon: PuzzleIcon, primary: "Datadog Metrics", secondary: "Stream canvas metrics to a Datadog dashboard", tags: [<Pill key="s" tone="neutral">Disabled</Pill>] },
  { Icon: PuzzleIcon, primary: "Figma Embed", secondary: "Render Figma frames directly on a canvas", tags: [<Pill key="s" tone="success">Enabled</Pill>] },
];

export function PluginsCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={PuzzleIcon}
        title="Plugins"
        subtitle="Extend the workspace with integrations."
        action={<ActionButton Icon={PlusIcon}>Browse marketplace</ActionButton>}
      />
      <DataList rows={plugins} />
    </CanvasView>
  );
}

/* ── Trust ────────────────────────────────────────────────────────────── */
const approvals: Row[] = [
  { Icon: ShieldIcon, primary: "Production data export", secondary: "Requested by Priya · Acme Onboarding", tags: [<Pill key="s" tone="warning">Awaiting you</Pill>] },
  { Icon: ShieldIcon, primary: "Elevated access: billing-db", secondary: "Requested by Sam · Data Migration", tags: [<Pill key="s" tone="warning">Awaiting you</Pill>] },
];

const auditRows: Row[] = [
  { primary: "Role change approved", secondary: "you → Lee", meta: "2h ago" },
  { primary: "Temporary access revoked", secondary: "contractor-4821", meta: "yesterday" },
  { primary: "Data retention policy updated", secondary: "90 → 180 days", meta: "2 days ago" },
];

export function TrustCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={ShieldIcon}
        title="Trust"
        subtitle="Access, approvals, and security posture."
      />
      <StatTiles
        stats={[
          { label: "Security Score", value: "92 / 100", delta: "+3 this month", deltaTone: "success" },
          { label: "Open Approvals", value: "2", delta: "Need your review", deltaTone: "warning" },
          { label: "Policy Violations", value: "0", delta: "All clear", deltaTone: "success" },
          { label: "MFA Coverage", value: "100%", delta: "38 / 38 members", deltaTone: "success" },
        ]}
      />
      <DataList title="Pending approvals" rows={approvals} />
      <DataList title="Recent activity" rows={auditRows} />
    </CanvasView>
  );
}

/* ── Work Items ───────────────────────────────────────────────────────── */
const workItems: Row[] = [
  {
    Icon: ListCheckIcon,
    primary: "W-10241 · Wire OAuth callback",
    secondary: "Acme Onboarding · Jordan",
    tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="danger">P1</Pill>],
  },
  {
    Icon: ListCheckIcon,
    primary: "W-10238 · Fix invoice rounding",
    secondary: "Billing Platform · Priya",
    tags: [<Pill key="st" tone="neutral">In Progress</Pill>, <Pill key="p" tone="warning">P2</Pill>],
  },
  {
    Icon: ListCheckIcon,
    primary: "W-10230 · Add audit log export",
    secondary: "Trust · you",
    tags: [<Pill key="st" tone="neutral">To Do</Pill>, <Pill key="p" tone="neutral">P3</Pill>],
  },
  {
    Icon: ListCheckIcon,
    primary: "W-10225 · Migrate legacy accounts",
    secondary: "Data Migration · Sam",
    tags: [<Pill key="st" tone="danger">Blocked</Pill>, <Pill key="p" tone="danger">P1</Pill>],
  },
  {
    Icon: ListCheckIcon,
    primary: "W-10219 · Partner SSO handshake",
    secondary: "Partner Portal · Lee",
    tags: [<Pill key="st" tone="success">Done</Pill>, <Pill key="p" tone="neutral">P2</Pill>],
  },
  {
    Icon: ListCheckIcon,
    primary: "W-10212 · Coverage for refund paths",
    secondary: "Billing Platform · Jordan",
    tags: [<Pill key="st" tone="info">In Review</Pill>, <Pill key="p" tone="warning">P2</Pill>],
  },
];

export function WorkItemsCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={ListCheckIcon}
        title="Work Items"
        subtitle="Stories, bugs, and tasks across your projects."
        action={<ActionButton Icon={PlusIcon}>New work item</ActionButton>}
      />
      <DataList rows={workItems} />
    </CanvasView>
  );
}

/* ── Pipelines ────────────────────────────────────────────────────────── */
const pipelines: Row[] = [
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
    primary: "Nightly integration",
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
];

export function PipelinesCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={GitBranchIcon}
        title="Pipelines"
        subtitle="Build, test, and deploy runs across your projects."
      />
      <DataList rows={pipelines} />
    </CanvasView>
  );
}

/* ── Testing ──────────────────────────────────────────────────────────── */
const suites: Row[] = [
  { Icon: BeakerIcon, primary: "Billing · unit", secondary: "412 tests", meta: "74% coverage", tags: [<Pill key="s" tone="warning">Low coverage</Pill>] },
  { Icon: BeakerIcon, primary: "Auth · integration", secondary: "88 tests", meta: "96% coverage", tags: [<Pill key="s" tone="success">Passing</Pill>] },
  { Icon: BeakerIcon, primary: "Onboarding · e2e", secondary: "34 tests", meta: "2 failing", tags: [<Pill key="s" tone="danger">Failing</Pill>] },
  { Icon: BeakerIcon, primary: "Payments · unit", secondary: "263 tests", meta: "91% coverage", tags: [<Pill key="s" tone="success">Passing</Pill>] },
  { Icon: BeakerIcon, primary: "Portal · e2e", secondary: "51 tests", meta: "3 flaky", tags: [<Pill key="s" tone="warning">Flaky</Pill>] },
];

export function TestingCanvas(): ReactElement {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={BeakerIcon}
        title="Testing"
        subtitle="Suite health and coverage across your projects."
      />
      <StatTiles
        stats={[
          { label: "Pass Rate", value: "94%", delta: "+1% this week", deltaTone: "success" },
          { label: "Coverage", value: "81%", delta: "-6% after merge", deltaTone: "warning" },
          { label: "Flaky Tests", value: "3", delta: "Portal · e2e", deltaTone: "warning" },
          { label: "Suites", value: "18", delta: "across 6 projects", deltaTone: "neutral" },
        ]}
      />
      <DataList title="Test suites" rows={suites} />
    </CanvasView>
  );
}
