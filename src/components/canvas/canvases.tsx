/**
 * Canvas registry for the center work area.
 *
 * Each canvas is a work surface that can be pulled into the center region as a
 * tab. The registry is keyed by id, and those ids match the left-nav item ids
 * (see app-shell/nav-items.tsx) — that's the link that lets clicking a nav item
 * open (or focus) its canvas. A canvas either carries a dedicated `Body` or, for
 * blank/ad-hoc canvases, falls back to a wireframe placeholder.
 *
 * The workspace opens with only Today; every other canvas is opened on demand.
 */
import type { ReactElement } from "react";
import {
  SunIcon,
  FolderIcon,
  GridIcon,
  ChartIcon,
  PuzzleIcon,
  ShieldIcon,
  ListCheckIcon,
  GitBranchIcon,
  BeakerIcon,
  type IconComponent,
} from "@/components/icons";
import { TodayBrief } from "./TodayBrief";
import {
  ProjectsCanvas,
  MyAppsCanvas,
  MetricsCanvas,
  PluginsCanvas,
  TrustCanvas,
  WorkItemsCanvas,
  PipelinesCanvas,
  TestingCanvas,
} from "./canvas-views";

/**
 * Props every canvas body receives from the canvas area. Bodies take actions as
 * props (rather than reaching into the canvas context themselves) so the
 * registry can stay a leaf of the import graph — CanvasArea is the single
 * context consumer and injects what each body needs. Zero-arg bodies remain
 * assignable, so most canvases can ignore this entirely.
 */
export type CanvasBodyProps = {
  /** Open (or focus) a project as its own canvas tab. */
  openProject: (id: string) => void;
  /** ALM mode — bodies that surface ALM sections (e.g. a project's inner nav)
   *  gate on this. Most bodies ignore it. */
  almMode: boolean;
};

export type Canvas = {
  id: string;
  title: string;
  Icon: IconComponent;
  /** One-line description shown in the canvas's placeholder body. */
  blurb: string;
  /** Dedicated body. When set, the canvas renders this instead of the generic
   *  wireframe placeholder. */
  Body?: (props: CanvasBodyProps) => ReactElement;
};

// The one canvas the workspace opens with. Named out here so `initialCanvases`
// can reference it directly rather than indexing the registry (which, under
// noUncheckedIndexedAccess, would be a possibly-undefined lookup).
const todayCanvas: Canvas = {
  id: "today",
  title: "Today",
  Icon: SunIcon,
  blurb: "Your daily brief — what needs attention across your projects.",
  Body: TodayBrief,
};

/**
 * Every canvas the app knows how to open, keyed by id. Ids are shared with the
 * left-nav items so a nav click can look its canvas up here.
 */
export const canvasRegistry: Record<string, Canvas> = {
  today: todayCanvas,
  projects: {
    id: "projects",
    title: "Projects",
    Icon: FolderIcon,
    blurb: "Everything you're building across the org.",
    Body: ProjectsCanvas,
  },
  "my-apps": {
    id: "my-apps",
    title: "My Apps",
    Icon: GridIcon,
    blurb: "Apps you own or have access to.",
    Body: MyAppsCanvas,
  },
  metrics: {
    id: "metrics",
    title: "Metrics",
    Icon: ChartIcon,
    blurb: "Traffic and health across your services.",
    Body: MetricsCanvas,
  },
  plugins: {
    id: "plugins",
    title: "Plugins",
    Icon: PuzzleIcon,
    blurb: "Extend the workspace with integrations.",
    Body: PluginsCanvas,
  },
  trust: {
    id: "trust",
    title: "Trust",
    Icon: ShieldIcon,
    blurb: "Access, approvals, and security posture.",
    Body: TrustCanvas,
  },
  "work-items": {
    id: "work-items",
    title: "Work Items",
    Icon: ListCheckIcon,
    blurb: "Stories, bugs, and tasks across your projects.",
    Body: WorkItemsCanvas,
  },
  pipelines: {
    id: "pipelines",
    title: "Pipelines",
    Icon: GitBranchIcon,
    blurb: "Build, test, and deploy runs across your projects.",
    Body: PipelinesCanvas,
  },
  testing: {
    id: "testing",
    title: "Testing",
    Icon: BeakerIcon,
    blurb: "Suite health and coverage across your projects.",
    Body: TestingCanvas,
  },
};

/** The workspace opens with just the Today canvas. */
export const initialCanvases: Canvas[] = [todayCanvas];
