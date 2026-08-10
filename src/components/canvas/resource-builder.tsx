"use client";

/**
 * The builder a created resource opens into — what the "Create a Resource" wizard
 * swaps its canvas over to once you've picked a kind and a project.
 *
 * The whole point of this surface is the **scope header**: a Flow builder, a page
 * composer, a code editor — whatever the kind — is here "just a canvas" carrying a
 * band across the top that shows it's scoped into the project you chose. Below the
 * band, `surface` (from resource-kinds) selects one of a handful of mock builder
 * stages. Everything is wireframe fidelity: nothing compiles, deploys, or saves.
 */
import type { ReactNode } from "react";
import {
  CheckIcon,
  DatabaseIcon,
  FileIcon,
  FolderIcon,
  GitBranchIcon,
  GridIcon,
  LayersIcon,
  ListCheckIcon,
  PlusIcon,
  PuzzleIcon,
  SendIcon,
  SparklesIcon,
  WorkflowIcon,
  type IconComponent,
} from "@/components/icons";
import {
  CanvasView,
  ChartPlaceholder,
  DataList,
  Panel,
  Pill,
  StatTiles,
} from "./canvas-kit";
import type { Project } from "./projects-data";
import type { ResourceKind } from "./resource-kinds";
import styles from "./resource-builder.module.css";

export function ResourceBuilder({ kind, project }: { kind: ResourceKind; project: Project }) {
  return (
    <CanvasView full>
      <div className={styles.builder}>
        <ScopeHeader kind={kind} project={project} />
        <div className={styles.stage}>{renderSurface(kind, project)}</div>
      </div>
    </CanvasView>
  );
}

/* ── Scope header ───────────────────────────────────────────────────────────
 * A full-width toolbar pinned to the top of the canvas. The project scope leads
 * it — the first thing you read is where this resource lives — over a second row
 * carrying the resource's identity and actions. */
function ScopeHeader({ kind, project }: { kind: ResourceKind; project: Project }) {
  return (
    <header className={styles.bar}>
      {/* Row 1 — the scope, above everything else. A folder icon (the app's
          "project" glyph) reads "Working in: <project>" as a plain phrase. */}
      <div className={styles.scopeRow}>
        <span className={styles.scopeIcon} aria-hidden="true">
          <FolderIcon width={15} height={15} />
        </span>
        <span className={styles.scopeLabel}>Working in:</span>
        <span className={styles.scopeValue}>{project.name}</span>
      </div>

      {/* Row 2 — resource identity + actions (actions pushed to the right). */}
      <div className={styles.mainRow}>
        <span className={styles.barIcon} aria-hidden="true">
          <kind.Icon width={22} height={22} />
        </span>
        <div className={styles.barText}>
          <div className={styles.barTitleRow}>
            <span className={styles.barTitle}>Untitled {kind.label}</span>
            <span className={styles.statusChip}>Draft</span>
          </div>
          <span className={styles.barKind}>{kind.label} builder</span>
        </div>

        <div className={styles.barActions}>
          <button type="button" className={styles.ghostBtn}>
            Preview
          </button>
          <button type="button" className={styles.primaryBtn}>
            <CheckIcon width={16} height={16} />
            <span>Save</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** Pick the mock stage for a kind's surface. Exhaustive over ResourceSurface so
 *  adding a surface is a compile error until it's handled here. */
function renderSurface(kind: ResourceKind, project: Project) {
  switch (kind.surface) {
    case "diagram":
      return <DiagramSurface />;
    case "layout":
      return <LayoutSurface kind={kind} />;
    case "code":
      return <CodeSurface kind={kind} project={project} />;
    case "dashboard":
      return <DashboardSurface />;
    case "agent":
      return <AgentSurface kind={kind} />;
    case "schema":
      return <SchemaSurface />;
    default: {
      const _exhaustive: never = kind.surface;
      return _exhaustive;
    }
  }
}

/* ── diagram — a flow canvas ────────────────────────────────────────────────
 * A node palette beside a dotted canvas with a top-to-bottom chain of steps. */
const FLOW_PALETTE: { label: string; Icon: IconComponent }[] = [
  { label: "Trigger", Icon: SparklesIcon },
  { label: "Decision", Icon: GitBranchIcon },
  { label: "Action", Icon: WorkflowIcon },
  { label: "Update", Icon: DatabaseIcon },
];

const FLOW_NODES: { label: string; sub: string; Icon: IconComponent; tone: "info" | "neutral" }[] = [
  { label: "Start", sub: "Record created", Icon: SparklesIcon, tone: "info" },
  { label: "Decision", sub: "Amount > 10,000?", Icon: GitBranchIcon, tone: "neutral" },
  { label: "Create record", sub: "Approval request", Icon: WorkflowIcon, tone: "neutral" },
  { label: "End", sub: "", Icon: CheckIcon, tone: "info" },
];

function DiagramSurface() {
  return (
    <div className={styles.split}>
      <aside className={styles.palette}>
        <span className={styles.paletteHead}>Elements</span>
        {FLOW_PALETTE.map((p) => (
          <div key={p.label} className={styles.paletteItem}>
            <p.Icon width={16} height={16} />
            <span>{p.label}</span>
          </div>
        ))}
      </aside>
      <div className={styles.flowCanvas}>
        {FLOW_NODES.map((n, i) => (
          <div key={n.label} className={styles.flowStep}>
            {i > 0 && <span className={styles.flowConnector} aria-hidden="true" />}
            <div className={styles.flowNode} data-tone={n.tone}>
              <span className={styles.flowNodeIcon} aria-hidden="true">
                <n.Icon width={18} height={18} />
              </span>
              <div className={styles.flowNodeText}>
                <span className={styles.flowNodeTitle}>{n.label}</span>
                {n.sub && <span className={styles.flowNodeSub}>{n.sub}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── layout — a page/app composer ───────────────────────────────────────────
 * A browser frame with a header, sidebar, and content skeleton, plus a
 * component palette. Backs both Page and React App. */
const LAYOUT_PALETTE: { label: string; Icon: IconComponent }[] = [
  { label: "Header", Icon: LayersIcon },
  { label: "Card", Icon: GridIcon },
  { label: "Table", Icon: ListCheckIcon },
  { label: "Chart", Icon: DatabaseIcon },
];

function LayoutSurface({ kind }: { kind: ResourceKind }) {
  return (
    <div className={styles.split}>
      <div className={styles.frame}>
        <div className={styles.frameChrome} aria-hidden="true">
          <span className={styles.frameDot} />
          <span className={styles.frameDot} />
          <span className={styles.frameDot} />
          <span className={styles.frameUrl}>{kind.label.toLowerCase().replace(/\s+/g, "-")}.app</span>
        </div>
        <div className={styles.frameBody}>
          <div className={styles.lyHeader}>
            <span className={styles.skelBadge} />
            <span className={styles.skelLineShort} />
          </div>
          <div className={styles.lyRow}>
            <div className={styles.lySidebar}>
              <span className={styles.skelLine} />
              <span className={styles.skelLine} />
              <span className={styles.skelLine} />
              <span className={styles.skelLineShort} />
            </div>
            <div className={styles.lyContent}>
              <div className={styles.lyCards}>
                <span className={styles.skelCard} />
                <span className={styles.skelCard} />
                <span className={styles.skelCard} />
              </div>
              <span className={styles.skelBlock} />
              <span className={styles.skelLine} />
              <span className={styles.skelLineShort} />
            </div>
          </div>
        </div>
      </div>
      <aside className={styles.palette}>
        <span className={styles.paletteHead}>Components</span>
        {LAYOUT_PALETTE.map((c) => (
          <div key={c.label} className={styles.paletteItem}>
            <c.Icon width={16} height={16} />
            <span>{c.label}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

/* ── code — a faux editor ───────────────────────────────────────────────────
 * Line-numbered, lightly token-colored. The snippet is chosen per kind and name-
 * drops the project in a comment so the scope shows up in the "code" too. */
function Kw({ children }: { children: ReactNode }) {
  return <span className={styles.tokKw}>{children}</span>;
}
function Str({ children }: { children: ReactNode }) {
  return <span className={styles.tokStr}>{children}</span>;
}
function Com({ children }: { children: ReactNode }) {
  return <span className={styles.tokCom}>{children}</span>;
}
function Typ({ children }: { children: ReactNode }) {
  return <span className={styles.tokTyp}>{children}</span>;
}
function Fn({ children }: { children: ReactNode }) {
  return <span className={styles.tokFn}>{children}</span>;
}

function fileNameFor(kind: ResourceKind): string {
  switch (kind.id) {
    case "apex":
      return "AccountService.cls";
    case "lwc":
      return "untitledComponent.js";
    case "api":
      return "route.ts";
    default:
      return "untitled.txt";
  }
}

function codeLinesFor(kind: ResourceKind, project: Project): ReactNode[] {
  const scope = <Com>{`// Scoped to ${project.name}`}</Com>;
  switch (kind.id) {
    case "apex":
      return [
        <><Kw>public with sharing class</Kw> <Typ>AccountService</Typ> {"{"}</>,
        <>{"    "}<Kw>@AuraEnabled</Kw>(cacheable=<Kw>true</Kw>)</>,
        <>{"    "}<Kw>public static</Kw> <Typ>List</Typ>&lt;<Typ>Account</Typ>&gt; <Fn>getTopAccounts</Fn>() {"{"}</>,
        <>{"        "}{scope}</>,
        <>{"        "}<Kw>return</Kw> [</>,
        <>{"            "}<Kw>SELECT</Kw> Id, Name, AnnualRevenue</>,
        <>{"            "}<Kw>FROM</Kw> Account <Kw>ORDER BY</Kw> AnnualRevenue <Kw>DESC</Kw></>,
        <>{"            "}<Kw>LIMIT</Kw> 10</>,
        <>{"        "}];</>,
        <>{"    "}{"}"}</>,
        <>{"}"}</>,
      ];
    case "lwc":
      return [
        <><Kw>import</Kw> {"{ LightningElement, api }"} <Kw>from</Kw> <Str>&apos;lwc&apos;</Str>;</>,
        <>&nbsp;</>,
        <><Kw>export default class</Kw> <Typ>UntitledComponent</Typ> <Kw>extends</Kw> <Typ>LightningElement</Typ> {"{"}</>,
        <>{"    "}<Kw>@api</Kw> recordId;</>,
        <>&nbsp;</>,
        <>{"    "}<Fn>connectedCallback</Fn>() {"{"}</>,
        <>{"        "}{scope}</>,
        <>{"        "}<Kw>this</Kw>.load();</>,
        <>{"    "}{"}"}</>,
        <>{"}"}</>,
      ];
    case "api":
      return [
        <><Kw>import</Kw> {"{ NextRequest, NextResponse }"} <Kw>from</Kw> <Str>&apos;next/server&apos;</Str>;</>,
        <>&nbsp;</>,
        <><Kw>export async function</Kw> <Fn>GET</Fn>(req: <Typ>NextRequest</Typ>) {"{"}</>,
        <>{"    "}{scope}</>,
        <>{"    "}<Kw>const</Kw> data = <Kw>await</Kw> <Fn>load</Fn>(req);</>,
        <>{"    "}<Kw>return</Kw> <Typ>NextResponse</Typ>.<Fn>json</Fn>({"{ data }"});</>,
        <>{"}"}</>,
      ];
    default:
      return [scope];
  }
}

function CodeSurface({ kind, project }: { kind: ResourceKind; project: Project }) {
  const lines = codeLinesFor(kind, project);
  return (
    <div className={styles.editor}>
      <div className={styles.editorTabs}>
        <span className={styles.editorTab} data-active="true">
          <kind.Icon width={14} height={14} />
          <span>{fileNameFor(kind)}</span>
        </span>
      </div>
      <div className={styles.editorMain}>
        <ol className={styles.gutter} aria-hidden="true">
          {lines.map((_, i) => (
            <li key={i}>{i + 1}</li>
          ))}
        </ol>
        <pre className={styles.code}>
          <code>
            {lines.map((ln, i) => (
              <div key={i} className={styles.codeLine}>
                {ln}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

/* ── dashboard — KPIs + a chart ─────────────────────────────────────────────
 * Composed straight from the canvas kit, so a dashboard "builder" reads like the
 * dashboards elsewhere in the app. */
function DashboardSurface() {
  return (
    <div className={styles.dashboard}>
      <StatTiles
        stats={[
          { label: "Total Records", value: "12.4k", delta: "+3.1% WoW", deltaTone: "success" },
          { label: "Active Users", value: "842", delta: "+18 today", deltaTone: "info" },
          { label: "Avg. Response", value: "1.9s", delta: "-0.2s", deltaTone: "success" },
          { label: "Open Issues", value: "7", delta: "2 high", deltaTone: "warning" },
        ]}
      />
      <Panel title="Volume over time" action={<Pill tone="info">Last 12 weeks</Pill>}>
        <ChartPlaceholder />
      </Panel>
      <DataList
        title="Data sources"
        rows={[
          { Icon: DatabaseIcon, primary: "Account", secondary: "Standard object", meta: "12.4k rows" },
          { Icon: DatabaseIcon, primary: "Opportunity", secondary: "Standard object", meta: "3.2k rows" },
          { Icon: WorkflowIcon, primary: "Billing events", secondary: "Platform event", meta: "live" },
        ]}
      />
    </div>
  );
}

/* ── agent — config + a test thread ─────────────────────────────────────────
 * Mock instructions/tools config on the left, a (non-functional) test chat on
 * the right. Backs both Agent and Skill. */
function AgentSurface({ kind }: { kind: ResourceKind }) {
  return (
    <div className={styles.agent}>
      <div className={styles.agentConfig}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name</span>
          <span className={styles.fieldInput}>Untitled {kind.label}</span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Instructions</span>
          <span className={styles.fieldTextarea}>
            You are a helpful {kind.label.toLowerCase()}. Answer questions about the project&rsquo;s
            data, take actions on the user&rsquo;s behalf, and always confirm before writing changes.
          </span>
        </label>
        <DataList
          title="Tools"
          action={
            <button type="button" className={styles.ghostBtnSm}>
              <PlusIcon width={14} height={14} />
              <span>Add</span>
            </button>
          }
          rows={[
            { Icon: DatabaseIcon, primary: "Query records", secondary: "Read from any object", tags: [<Pill key="t" tone="neutral">Read</Pill>] },
            { Icon: WorkflowIcon, primary: "Create record", secondary: "With confirmation", tags: [<Pill key="t" tone="warning">Write</Pill>] },
            { Icon: PuzzleIcon, primary: "Call flow", secondary: "Invoke an automation", tags: [<Pill key="t" tone="neutral">Action</Pill>] },
          ]}
        />
      </div>
      <aside className={styles.testChat}>
        <div className={styles.testHead}>
          <span className={styles.testAvatar} aria-hidden="true">
            <SparklesIcon width={16} height={16} />
          </span>
          <span className={styles.testTitle}>Test</span>
          <Pill tone="neutral">Preview</Pill>
        </div>
        <div className={styles.testBody}>
          <div className={`${styles.testMsg} ${styles.testAgent}`}>
            Hi! I&rsquo;m your {kind.label.toLowerCase()}. Ask me anything about this project.
          </div>
          <div className={`${styles.testMsg} ${styles.testUser}`}>How many open work items are there?</div>
          <div className={`${styles.testMsg} ${styles.testAgent}`}>
            There are 6 open work items — 2 are in review. Want me to list them?
          </div>
        </div>
        <div className={styles.testComposer}>
          <span className={styles.testInput}>Message your {kind.label.toLowerCase()}…</span>
          <span className={styles.testSend} aria-hidden="true">
            <SendIcon width={16} height={16} />
          </span>
        </div>
      </aside>
    </div>
  );
}

/* ── schema — a fields table ────────────────────────────────────────────────
 * The custom object's fields, as an editable-looking table (mock). */
const SCHEMA_FIELDS: { label: string; api: string; type: string; required: boolean }[] = [
  { label: "Name", api: "Name", type: "Text(80)", required: true },
  { label: "Amount", api: "Amount__c", type: "Currency(16, 2)", required: false },
  { label: "Status", api: "Status__c", type: "Picklist", required: true },
  { label: "Owner", api: "OwnerId", type: "Lookup(User)", required: true },
  { label: "Created Date", api: "CreatedDate", type: "Date/Time", required: false },
];

function SchemaSurface() {
  return (
    <div className={styles.schema}>
      <div className={styles.schemaBar}>
        <span className={styles.schemaObject}>
          <DatabaseIcon width={16} height={16} />
          <span>Untitled_Object__c</span>
        </span>
        <button type="button" className={styles.ghostBtnSm}>
          <PlusIcon width={14} height={14} />
          <span>New field</span>
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Field Label</th>
            <th>API Name</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          {SCHEMA_FIELDS.map((f) => (
            <tr key={f.api}>
              <td className={styles.cellLabel}>
                <FileIcon width={15} height={15} />
                <span>{f.label}</span>
              </td>
              <td className={styles.cellApi}>{f.api}</td>
              <td>{f.type}</td>
              <td>
                {f.required ? <Pill tone="info">Required</Pill> : <span className={styles.cellMuted}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
