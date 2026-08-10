/**
 * The catalog of things you can **create** inside the workspace.
 *
 * "Create a Resource" (the ＋ affordance by the tabs, and the project Overview's
 * "Add resource" action) opens a wizard that walks: pick a kind → pick a project
 * → land in that kind's builder. This module is the single source for those
 * kinds — id, label, one-line blurb, icon, the category it groups under, and the
 * builder **surface** it opens into. Keeping it here (like alm-surfaces for the
 * ALM four) means the picker, the builder, and any future entry point can't
 * drift, and adding a kind is one edit.
 *
 * Everything downstream is wireframe fidelity — the "builder" a kind opens is a
 * mock surface (see resource-builder), not a real editor.
 */
import {
  WorkflowIcon,
  LayersIcon,
  ChartIcon,
  SparklesIcon,
  GridIcon,
  PuzzleIcon,
  FileIcon,
  BeakerIcon,
  LinkIcon,
  DatabaseIcon,
  type IconComponent,
} from "@/components/icons";

/** Which mock builder a kind opens into. One surface can back several kinds
 *  (Apex and an API are both "code"); the builder switches on this. */
export type ResourceSurface =
  | "diagram" // a node/flow canvas (Flow)
  | "layout" // a page/app layout composer (Page, React App)
  | "code" // a code editor (Apex, LWC, API)
  | "dashboard" // charts + KPIs (Dashboard)
  | "agent" // an agent/skill configuration (Agent, Skill)
  | "schema"; // a data model's fields (Data Model)

/** The buckets the type picker groups kinds under. */
export type ResourceCategory = "ui" | "automation" | "data" | "intelligence";

/** Every creatable kind's id. A closed set (not a bare string) so entry points
 *  and the builder can switch on it and a typo can't slip through. */
export type ResourceKindId =
  | "page"
  | "react-app"
  | "lwc"
  | "flow"
  | "apex"
  | "api"
  | "data-model"
  | "dashboard"
  | "agent"
  | "skill";

/** A kind of resource you can create and scope to a project. */
export type ResourceKind = {
  id: ResourceKindId;
  label: string;
  /** One-line description, shown on the picker card. */
  blurb: string;
  Icon: IconComponent;
  category: ResourceCategory;
  surface: ResourceSurface;
};

export const categoryLabels: Record<ResourceCategory, string> = {
  ui: "UI & Experience",
  automation: "Automation & Logic",
  data: "Data & Analytics",
  intelligence: "Intelligence",
};

/** The order categories appear in the picker. Taken from categoryLabels — which
 *  is total over ResourceCategory — so every category is always present and
 *  adding one can't silently drop its kinds from the picker. */
export const categoryOrder = Object.keys(categoryLabels) as ResourceCategory[];

export const resourceKinds: ResourceKind[] = [
  // UI & Experience
  {
    id: "page",
    label: "Page",
    blurb: "Compose a Lightning page from components.",
    Icon: LayersIcon,
    category: "ui",
    surface: "layout",
  },
  {
    id: "react-app",
    label: "React App",
    blurb: "A standalone React application.",
    Icon: GridIcon,
    category: "ui",
    surface: "layout",
  },
  {
    id: "lwc",
    label: "Lightning Web Component",
    blurb: "A reusable UI component.",
    Icon: PuzzleIcon,
    category: "ui",
    surface: "code",
  },
  // Automation & Logic
  {
    id: "flow",
    label: "Flow",
    blurb: "Automate a process with a visual flow.",
    Icon: WorkflowIcon,
    category: "automation",
    surface: "diagram",
  },
  {
    id: "apex",
    label: "Apex Class",
    blurb: "Server-side business logic.",
    Icon: FileIcon,
    category: "automation",
    surface: "code",
  },
  {
    id: "api",
    label: "API",
    blurb: "Expose a REST or GraphQL endpoint.",
    Icon: LinkIcon,
    category: "automation",
    surface: "code",
  },
  // Data & Analytics
  {
    id: "data-model",
    label: "Data Model",
    blurb: "A custom object and its fields.",
    Icon: DatabaseIcon,
    category: "data",
    surface: "schema",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    blurb: "Chart metrics and KPIs on one board.",
    Icon: ChartIcon,
    category: "data",
    surface: "dashboard",
  },
  // Intelligence
  {
    id: "agent",
    label: "Agent",
    blurb: "An Agentforce agent with topics and actions.",
    Icon: SparklesIcon,
    category: "intelligence",
    surface: "agent",
  },
  {
    id: "skill",
    label: "Skill",
    blurb: "A reusable capability for your agents.",
    Icon: BeakerIcon,
    category: "intelligence",
    surface: "agent",
  },
];

/** The kinds grouped into their categories, in {@link categoryOrder}. Empty
 *  categories are dropped so the picker only renders groups that have cards. */
export function resourceKindsByCategory(): { category: ResourceCategory; label: string; kinds: ResourceKind[] }[] {
  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      kinds: resourceKinds.filter((k) => k.category === category),
    }))
    .filter((group) => group.kinds.length > 0);
}
