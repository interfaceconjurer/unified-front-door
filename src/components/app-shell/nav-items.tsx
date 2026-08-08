/**
 * Left-rail navigation model.
 *
 * The rail is a single ordered list. The ALM items — Trust, Work Items,
 * Pipelines, Testing — are top-level entries flagged `alm`, sitting level with
 * everything else rather than nested under Projects: they're global surfaces
 * (all projects) that can also be viewed scoped to one project, so they aren't
 * "inside" Projects. They're hidden until ALM mode is switched on; the rail
 * keeps them mounted so it can animate them in and out (see LeftNav).
 */
import {
  SunIcon,
  FolderIcon,
  GridIcon,
  ChartIcon,
  PuzzleIcon,
  type IconComponent,
} from "@/components/icons";
import { almSurfaces } from "@/components/canvas/alm-surfaces";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  Icon: IconComponent;
  /** ALM-only item: shown at top level only when ALM mode is on. */
  alm?: boolean;
};

// The ALM rows, derived from the single-sourced surfaces (id/label/icon).
const almNavItems: NavItem[] = almSurfaces.map((s) => ({
  id: s.id,
  label: s.label,
  href: `#${s.id}`,
  Icon: s.Icon,
  alm: true,
}));

export const navItems: NavItem[] = [
  { id: "today", label: "Today", href: "#today", Icon: SunIcon },
  { id: "projects", label: "Projects", href: "#projects", Icon: FolderIcon },
  ...almNavItems,
  { id: "my-apps", label: "My Apps", href: "#my-apps", Icon: GridIcon },
  { id: "metrics", label: "Metrics", href: "#metrics", Icon: ChartIcon },
  { id: "plugins", label: "Plugins", href: "#plugins", Icon: PuzzleIcon },
];
