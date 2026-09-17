import {
  BeakerIcon, ChartIcon, DatabaseIcon, FileIcon, FolderIcon, GitBranchIcon,
  GridIcon, LinkIcon, ListCheckIcon, PuzzleIcon, ShieldIcon, SparklesIcon,
  WorkflowIcon, type IconComponent,
} from "@/components/icons";
import type { SurfaceId } from "@/lib/workspace/model";

export type CapabilityField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: "textarea" | "select";
  options?: readonly string[];
};

export type SurfaceCapability = {
  id: string;
  label: string;
  description: string;
  Icon: IconComponent;
  fields: readonly CapabilityField[];
  group?: "toolkit";
};

const NAME_FIELD: CapabilityField = { id: "name", label: "Name", placeholder: "Give this draft a name" };
const GOAL_FIELD: CapabilityField = { id: "goal", label: "What would you like to build?", type: "textarea", placeholder: "Describe the outcome, the data you need, and how it should work…" };

const CAPABILITIES: Record<SurfaceId, readonly SurfaceCapability[]> = {
  code: [
    {
      id: "sfdx-project", label: "Start an SFDX project", Icon: FolderIcon,
      description: "Set up your source, project structure, and development org.",
      fields: [
        { id: "name", label: "Project name", placeholder: "my-salesforce-project" },
        { id: "starter", label: "Starting point", type: "select", options: ["Blank SFDX project", "Existing repository"] },
        { id: "repository", label: "Repository URL (optional)", placeholder: "https://github.com/your-team/your-project" },
        { id: "org", label: "Development org alias (optional)", placeholder: "my-dev-org" },
        GOAL_FIELD,
      ],
    },
    {
      id: "react-app", label: "Build a React app", Icon: GridIcon,
      description: "Create a custom experience connected to your Salesforce data.",
      fields: [{ ...NAME_FIELD, label: "App name", placeholder: "account-explorer" }, GOAL_FIELD,
        { id: "data", label: "Data to connect", type: "textarea", placeholder: "For example, accounts and their related contacts…" }],
    },
    {
      id: "apex", label: "Write Apex", Icon: FileIcon,
      description: "Create classes, triggers, and server-side business logic.",
      fields: [{ id: "name", label: "Apex name", placeholder: "AccountService" },
        { id: "kind", label: "Type", type: "select", options: ["Class", "Trigger", "Anonymous Apex"] },
        { id: "source", label: "Apex source", type: "textarea", placeholder: "Write or paste your Apex here…" }],
    },
    {
      id: "query", label: "Query your data", Icon: DatabaseIcon,
      description: "Explore Salesforce objects and build SOQL queries.",
      fields: [{ ...NAME_FIELD, label: "Query name", placeholder: "Recent accounts" },
        { id: "object", label: "Salesforce object", placeholder: "Account" },
        { id: "source", label: "SOQL query", type: "textarea", placeholder: "SELECT Id, Name\nFROM Account\nLIMIT 25" }],
    },
    {
      id: "tests", label: "Create & run tests", Icon: BeakerIcon,
      description: "Build test suites, run checks, and investigate failures.",
      fields: [{ ...NAME_FIELD, label: "Test suite name", placeholder: "Account service tests" },
        { id: "framework", label: "Test framework", type: "select", options: ["Apex tests", "Jest", "Vitest"] },
        { id: "scope", label: "What should the tests cover?", type: "textarea", placeholder: "Describe the behavior, edge cases, and expected results…" }],
    },
    {
      id: "agent", label: "Create an agent", Icon: SparklesIcon,
      description: "Define instructions, give it tools, and shape how it works.",
      fields: [{ ...NAME_FIELD, label: "Agent name", placeholder: "Lead routing assistant" },
        { id: "instructions", label: "Instructions", type: "textarea", placeholder: "What should this agent do, and how should it behave?" },
        { id: "tools", label: "Tools and data it needs", type: "textarea", placeholder: "Describe the skills, services, and data the agent needs access to…" }],
    },
    {
      id: "toolkit", label: "Your toolkit", Icon: PuzzleIcon, group: "toolkit",
      description: "Shape how you and your agents work with skills, plugins, connectors, and MCP tools.",
      fields: [],
    },
  ],
  build: [
    {
      id: "data-model", label: "Model your data", Icon: DatabaseIcon,
      description: "Define objects, fields, and relationships for your application.",
      fields: [NAME_FIELD, { id: "schema", label: "Objects and relationships", type: "textarea", placeholder: "Describe the information your application needs to store…" }],
    },
    {
      id: "automation", label: "Build an automation", Icon: WorkflowIcon,
      description: "Turn a business process into a flow with triggers and actions.",
      fields: [NAME_FIELD, { id: "trigger", label: "When should it start?", placeholder: "For example, when a new lead is created" }, GOAL_FIELD],
    },
    {
      id: "agent", label: "Create an agent", Icon: SparklesIcon,
      description: "Give an agent a purpose, instructions, and actions it can take.",
      fields: [NAME_FIELD, { id: "instructions", label: "Agent instructions", type: "textarea", placeholder: "Describe its job and the actions it should take…" }],
    },
    {
      id: "experience", label: "Build an experience", Icon: GridIcon,
      description: "Put together pages and apps for the people who use your platform.",
      fields: [NAME_FIELD, GOAL_FIELD],
    },
  ],
  govern: [
    {
      id: "security", label: "Review security", Icon: ShieldIcon,
      description: "Understand access, permissions, and your security posture.",
      fields: [NAME_FIELD, { id: "scope", label: "Review scope", type: "textarea", placeholder: "Which users, permissions, or resources would you like to review?" }],
    },
    {
      id: "health", label: "Monitor platform health", Icon: ChartIcon,
      description: "Follow the signals that tell you how your platform is running.",
      fields: [NAME_FIELD, { id: "signals", label: "Signals to monitor", type: "textarea", placeholder: "For example, errors, latency, API usage, and agent activity…" }],
    },
    {
      id: "policies", label: "Define a policy", Icon: ListCheckIcon,
      description: "Set standards and guardrails for data, apps, and agents.",
      fields: [NAME_FIELD, { id: "rules", label: "Policy rules", type: "textarea", placeholder: "Describe what should be allowed, restricted, or reviewed…" }],
    },
    {
      id: "agent-activity", label: "Observe agent activity", Icon: SparklesIcon,
      description: "Explore agent behavior, tool usage, and the outcomes of its work.",
      fields: [NAME_FIELD, { id: "scope", label: "Agents and activity to follow", type: "textarea", placeholder: "Describe the agents, actions, and outcomes you want to understand…" }],
    },
  ],
  alm: [
    {
      id: "work", label: "Plan your work", Icon: ListCheckIcon,
      description: "Turn an idea into work items and changes you can deliver.",
      fields: [NAME_FIELD, GOAL_FIELD],
    },
    {
      id: "pipeline", label: "Set up a pipeline", Icon: GitBranchIcon,
      description: "Map the path from your development org to production.",
      fields: [NAME_FIELD, { id: "repository", label: "Repository URL", placeholder: "https://github.com/your-team/your-project" },
        { id: "stages", label: "Stages and approvals", type: "textarea", placeholder: "Describe your environments, validation steps, and release approvals…" }],
    },
    {
      id: "validation", label: "Validate a change", Icon: BeakerIcon,
      description: "Plan the checks and tests a change needs before it moves forward.",
      fields: [NAME_FIELD, { id: "checks", label: "Validation checks", type: "textarea", placeholder: "Describe the change and the checks it needs to pass…" }],
    },
    {
      id: "release", label: "Prepare a release", Icon: WorkflowIcon,
      description: "Bring changes, approvals, and a rollout plan together.",
      fields: [NAME_FIELD, { id: "plan", label: "Release plan", type: "textarea", placeholder: "Describe what is shipping, who needs to approve it, and how to roll it out…" }],
    },
  ],
};

export const TOOLKIT_SECTIONS = [
  { id: "skills", label: "Skills", Icon: SparklesIcon, description: "Reusable instructions and workflows for your agents.", fields: [
    { id: "name", label: "Skill name", placeholder: "Review Apex changes" },
    { id: "instructions", label: "Instructions", type: "textarea", placeholder: "Describe when to use this skill and the steps to follow…" },
  ] },
  { id: "plugins", label: "Plugins", Icon: PuzzleIcon, description: "Packages that bring related capabilities into your workspace.", fields: [
    { id: "name", label: "Plugin name", placeholder: "My development tools" },
    { id: "source", label: "Package or repository", placeholder: "Package name or repository URL" },
    { id: "notes", label: "Capabilities to include", type: "textarea", placeholder: "Describe what this plugin should add to your toolkit…" },
  ] },
  { id: "connectors", label: "Connectors", Icon: LinkIcon, description: "Connect the services and data your work depends on.", fields: [
    { id: "name", label: "Connector name", placeholder: "Team issue tracker" },
    { id: "service", label: "Service", placeholder: "For example, GitHub or your issue tracker" },
    { id: "access", label: "Access needed", type: "textarea", placeholder: "Describe the data and actions this connection should provide…" },
  ] },
  { id: "mcp", label: "MCP tools", Icon: WorkflowIcon, description: "Give agents access to tools exposed by MCP servers.", fields: [
    { id: "name", label: "Server name", placeholder: "My development server" },
    { id: "url", label: "Server URL", placeholder: "https://your-server.example/mcp" },
    { id: "tools", label: "Tools to make available", type: "textarea", placeholder: "List the tools your agents should be able to use…" },
  ] },
] as const satisfies readonly { id: string; label: string; Icon: IconComponent; description: string; fields: readonly CapabilityField[] }[];

export function capabilitiesForSurface(surfaceId: SurfaceId) {
  return CAPABILITIES[surfaceId];
}

export function capabilityForCanvas(surfaceId: SurfaceId, id?: string, legacyName?: string) {
  return CAPABILITIES[surfaceId].find((capability) => capability.id === id || capability.label === legacyName);
}
