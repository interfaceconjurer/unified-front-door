/**
 * The data a project canvas's **metadata explorer** rides on.
 *
 * The explorer is a project's persistent left rail — its own navigation, kept
 * separate from the ALM sub-nav. It gathers the contextual metadata that hangs
 * off a project, in three groups:
 *   - **Files** — the code tree (keyed by a derived path; see FileNode).
 *   - **Plans** — plan documents you'd attach to the project.
 *   - **Resources** — org-level context: connected orgs/sandboxes, reference
 *     docs, linked work items.
 * Selecting any leaf takes over the content area beside the rail; "Overview"
 * brings the dashboard back.
 *
 * All wireframe fidelity — file/plan bodies are generated from their identity,
 * not real source, so every node "has content" without authoring a codebase.
 * Deterministic (pure functions of the identity) so server and client agree.
 */
import type { Tone } from "./canvas-kit";

/** A node in a project's file tree. Files carry no path — it's derived from
 *  position as the tree renders (parent path + name), so there's one source of
 *  truth for a file's identity. */
export type FileNode =
  | { type: "folder"; name: string; children: FileNode[] }
  | { type: "file"; name: string };

/** A recently-touched file, as surfaced on a project's Overview. The `path` is
 *  the deep link — clicking the row opens that file (and reveals it in the tree). */
export type ChangedFile = { path: string; note: string; tone: Tone };

/** An agent's offer to open a specific file — the "the agent opened it and the
 *  explorer came along" route, made concrete on the Overview. */
export type AgentFileHint = { label: string; path: string };

/** A plan document attached to the project (a cutover, a remediation, …). */
export type PlanDoc = { id: string; name: string; note: string; tone: Tone };

/** The kind of an org-level resource — drives the icon and the "type" label. */
export type ResourceKind = "org" | "sandbox" | "doc" | "link";

/** A piece of org-level context added to the project. `detail` is the
 *  where-it-lives line (an org host, a Quip revision, a GUS URL). */
export type OrgResource = {
  id: string;
  name: string;
  kind: ResourceKind;
  detail: string;
  note?: string;
  tone?: Tone;
};

/** A block of rendered document content (plans render as prose, not code). */
export type DocBlock =
  | { t: "h1"; text: string }
  | { t: "h2"; text: string }
  | { t: "p"; text: string }
  | { t: "li"; text: string }
  | { t: "note"; text: string };

// ── Files ──────────────────────────────────────────────────────────────────
const DEFAULT_TREE: FileNode[] = [
  {
    type: "folder",
    name: "src",
    children: [
      {
        type: "folder",
        name: "main",
        children: [
          { type: "file", name: "App.cls" },
          { type: "file", name: "Service.cls" },
        ],
      },
      {
        type: "folder",
        name: "util",
        children: [{ type: "file", name: "Helpers.cls" }],
      },
    ],
  },
  {
    type: "folder",
    name: "config",
    children: [{ type: "file", name: "package.xml" }],
  },
  { type: "file", name: "README.md" },
];

const TREES: Record<string, FileNode[]> = {
  acme: [
    {
      type: "folder",
      name: "src",
      children: [
        {
          type: "folder",
          name: "onboarding",
          children: [
            { type: "file", name: "OnboardingFlow.cls" },
            { type: "file", name: "OnboardingController.cls" },
            { type: "file", name: "ProvisioningService.cls" },
          ],
        },
        {
          type: "folder",
          name: "auth",
          children: [{ type: "file", name: "OAuthCallback.cls" }],
        },
        {
          type: "folder",
          name: "tenants",
          children: [{ type: "file", name: "TenantSeeder.cls" }],
        },
      ],
    },
    {
      type: "folder",
      name: "config",
      children: [
        { type: "file", name: "package.xml" },
        { type: "file", name: "scratch-def.json" },
      ],
    },
    {
      type: "folder",
      name: "tests",
      children: [{ type: "file", name: "OnboardingFlowTest.cls" }],
    },
    { type: "file", name: "README.md" },
  ],
  billing: [
    {
      type: "folder",
      name: "src",
      children: [
        {
          type: "folder",
          name: "billing",
          children: [
            { type: "file", name: "InvoiceService.cls" },
            { type: "file", name: "RoundingHelper.cls" },
            { type: "file", name: "RefundProcessor.cls" },
          ],
        },
        {
          type: "folder",
          name: "payments",
          children: [{ type: "file", name: "PaymentGateway.cls" }],
        },
        {
          type: "folder",
          name: "model",
          children: [
            { type: "file", name: "Invoice.object-meta.xml" },
            { type: "file", name: "LineItem.object-meta.xml" },
          ],
        },
      ],
    },
    {
      type: "folder",
      name: "tests",
      children: [
        { type: "file", name: "InvoiceServiceTest.cls" },
        { type: "file", name: "RefundProcessorTest.cls" },
      ],
    },
    { type: "file", name: "README.md" },
  ],
};

const DEFAULT_CHANGED: ChangedFile[] = [
  { path: "src/main/Service.cls", note: "edited 2h ago", tone: "neutral" },
  { path: "src/util/Helpers.cls", note: "edited yesterday", tone: "neutral" },
];

const CHANGED: Record<string, ChangedFile[]> = {
  acme: [
    { path: "src/auth/OAuthCallback.cls", note: "W-10241 · 2 changes", tone: "info" },
    { path: "src/onboarding/OnboardingFlow.cls", note: "staging cutover", tone: "neutral" },
    { path: "config/scratch-def.json", note: "edited yesterday", tone: "neutral" },
  ],
  billing: [
    { path: "src/billing/RoundingHelper.cls", note: "W-10238 · invoice rounding", tone: "info" },
    { path: "src/billing/RefundProcessor.cls", note: "coverage −6%", tone: "warning" },
    { path: "src/model/Invoice.object-meta.xml", note: "3 schema changes", tone: "info" },
  ],
};

const AGENT_HINTS: Record<string, AgentFileHint> = {
  acme: { label: "Open the OAuth callback fix", path: "src/auth/OAuthCallback.cls" },
  billing: { label: "Open the invoice-rounding fix", path: "src/billing/RoundingHelper.cls" },
};

// ── Plans ──────────────────────────────────────────────────────────────────
const DEFAULT_PLANS: PlanDoc[] = [
  { id: "release-readiness", name: "Release readiness", note: "Draft", tone: "neutral" },
];

const PLANS: Record<string, PlanDoc[]> = {
  acme: [
    { id: "staging-cutover", name: "Staging cutover plan", note: "In progress", tone: "info" },
    { id: "oauth-remediation", name: "OAuth remediation", note: "W-10241", tone: "neutral" },
  ],
  billing: [
    { id: "rounding-fix", name: "Invoice rounding fix", note: "W-10238", tone: "info" },
    { id: "coverage-recovery", name: "Coverage recovery", note: "−6% → 85% target", tone: "warning" },
  ],
};

// ── Resources ────────────────────────────────────────────────────────────────
const DEFAULT_RESOURCES: OrgResource[] = [
  { id: "org-prod", name: "Production org", kind: "org", detail: "NA100 · my.salesforce.com", note: "Prod" },
  { id: "doc-notes", name: "Project notes", kind: "doc", detail: "Quip · shared" },
];

const RESOURCES: Record<string, OrgResource[]> = {
  acme: [
    { id: "org-prod", name: "Acme Production", kind: "org", detail: "NA142 · acme.my.salesforce.com", note: "Prod" },
    { id: "org-staging", name: "Staging sandbox", kind: "sandbox", detail: "CS42 · acme--staging", note: "Sandbox" },
    { id: "doc-runbook", name: "Onboarding runbook", kind: "doc", detail: "Quip · edited 3d ago" },
    { id: "link-w10241", name: "W-10241 — OAuth callback", kind: "link", detail: "gus.lightning.force.com", note: "Work item", tone: "info" },
  ],
  billing: [
    { id: "org-prod", name: "Billing Production", kind: "org", detail: "NA88 · billing.my.salesforce.com", note: "Prod" },
    { id: "org-uat", name: "UAT sandbox", kind: "sandbox", detail: "CS15 · billing--uat", note: "Sandbox" },
    { id: "doc-spec", name: "Rounding spec", kind: "doc", detail: "Quip · rev 4" },
    { id: "link-w10238", name: "W-10238 — Invoice rounding", kind: "link", detail: "gus.lightning.force.com", note: "Work item", tone: "info" },
  ],
};

// ── Lookups ──────────────────────────────────────────────────────────────────
/** The file tree for a project (a generic one for projects without a bespoke tree). */
export function filesForProject(id: string): FileNode[] {
  return TREES[id] ?? DEFAULT_TREE;
}

/** The recently-changed files a project surfaces on its Overview. */
export function changedFilesForProject(id: string): ChangedFile[] {
  return CHANGED[id] ?? DEFAULT_CHANGED;
}

/** An agent's file suggestion for a project, if any. */
export function agentHintForProject(id: string): AgentFileHint | null {
  return AGENT_HINTS[id] ?? null;
}

/** The plan documents attached to a project. */
export function plansForProject(id: string): PlanDoc[] {
  return PLANS[id] ?? DEFAULT_PLANS;
}

/** The org-level resources added to a project. */
export function resourcesForProject(id: string): OrgResource[] {
  return RESOURCES[id] ?? DEFAULT_RESOURCES;
}

/** Human label for a resource's kind. */
export function resourceKindLabel(kind: ResourceKind): string {
  switch (kind) {
    case "org":
      return "Org";
    case "sandbox":
      return "Sandbox";
    case "doc":
      return "Document";
    case "link":
      return "Link";
  }
}

// ── Faux content ─────────────────────────────────────────────────────────────
/** Human label for a file's language, from its extension. */
export function languageOf(path: string): string {
  const ext = extensionOf(path);
  switch (ext) {
    case "cls":
      return "Apex";
    case "json":
      return "JSON";
    case "xml":
      return "XML";
    case "md":
      return "Markdown";
    default:
      return ext ? ext.toUpperCase() : "Text";
  }
}

/**
 * Faux file body, generated from the path so every node has plausible content.
 * Deterministic (a pure function of the path) — no randomness, so it renders the
 * same on the server and client.
 */
export function fileLines(path: string): string[] {
  const name = path.split("/").pop() ?? path;
  const dot = name.indexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  switch (extensionOf(path)) {
    case "cls":
      return apexLines(base);
    case "json":
      return jsonLines();
    case "xml":
      return xmlLines(base);
    case "md":
      return markdownLines(base);
    default:
      return genericLines(base);
  }
}

/** Faux plan document, rendered as prose blocks rather than code. */
export function planBlocks(plan: PlanDoc): DocBlock[] {
  return [
    { t: "h1", text: plan.name },
    { t: "note", text: plan.note },
    { t: "h2", text: "Goal" },
    {
      t: "p",
      text: "Wireframe placeholder — the intent of this plan in a sentence or two. Content is illustrative, generated for layout only.",
    },
    { t: "h2", text: "Steps" },
    { t: "li", text: "Assess the current state and capture the baseline." },
    { t: "li", text: "Make the change behind a flag; keep it reversible." },
    { t: "li", text: "Verify against the affected tests and pipelines." },
    { t: "li", text: "Roll out, watch coverage and trust signals, then clean up." },
    { t: "h2", text: "Status" },
    { t: "p", text: "Tracked on the project Overview; linked work items carry the detail." },
  ];
}

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function apexLines(cls: string): string[] {
  return [
    `public with sharing class ${cls} {`,
    "",
    `    private static final Logger LOG = Logger.get(${cls}.class);`,
    "",
    `    public ${cls}() {`,
    "        // wireframe — illustrative only",
    "    }",
    "",
    "    public Result run(Request request) {",
    "        validate(request);",
    "        final Context ctx = Context.of(request);",
    "        return process(ctx);",
    "    }",
    "",
    "    private void validate(Request request) {",
    "        if (request == null) {",
    "            throw new IllegalArgumentException('request is required');",
    "        }",
    "    }",
    "",
    "    private Result process(Context ctx) {",
    "        // TODO: implement",
    "        return Result.ok();",
    "    }",
    "}",
  ];
}

function jsonLines(): string[] {
  return [
    "{",
    '  "orgName": "Unified Front Door Scratch",',
    '  "edition": "Developer",',
    '  "features": ["EnableSetPasswordInApi", "AuthorApex"],',
    '  "settings": {',
    '    "lightningExperienceSettings": {',
    '      "enableS1DesktopEnabled": true',
    "    },",
    '    "mobileSettings": {',
    '      "enableS1EncryptedStoragePref2": false',
    "    }",
    "  }",
    "}",
  ];
}

function xmlLines(label: string): string[] {
  const object = label.split(".")[0];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
    `    <label>${object}</label>`,
    `    <pluralLabel>${object}s</pluralLabel>`,
    "    <nameField>",
    "        <type>Text</type>",
    "        <label>Name</label>",
    "    </nameField>",
    "    <deploymentStatus>Deployed</deploymentStatus>",
    "    <sharingModel>ReadWrite</sharingModel>",
    "</CustomObject>",
  ];
}

function markdownLines(base: string): string[] {
  return [
    `# ${base}`,
    "",
    "Wireframe placeholder for the Unified Front Door prototype.",
    "",
    "## Overview",
    "",
    "- This file is illustrative — content is generated for layout only.",
    "- Open it from the project Overview, a work item, or the agent.",
    "",
    "## Notes",
    "",
    "See the project canvas for live status.",
  ];
}

function genericLines(base: string): string[] {
  return [
    `// ${base}`,
    "// Wireframe placeholder — generated for layout only.",
    "",
    "export function main() {",
    "  return run();",
    "}",
  ];
}
