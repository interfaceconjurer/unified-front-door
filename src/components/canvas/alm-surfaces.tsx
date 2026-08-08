/**
 * The ALM surfaces — Trust, Work Items, Pipelines, Testing.
 *
 * These four show up in three places: as top-level left-rail rows (gated on ALM
 * mode), as their own global canvases, and as a project's inner sub-nav. Their
 * id + label + icon are single-sourced here so those places can't drift and
 * adding a surface is one edit. The canvas registry additionally gives each a
 * blurb and a body (see canvases.tsx); those stay with the registry since
 * they're per-surface, but the id/label/icon come from here.
 */
import {
  ShieldIcon,
  ListCheckIcon,
  GitBranchIcon,
  BeakerIcon,
  type IconComponent,
} from "@/components/icons";

export type AlmSurfaceId = "trust" | "work-items" | "pipelines" | "testing";

export type AlmSurface = { id: AlmSurfaceId; label: string; Icon: IconComponent };

export const almSurfaces: AlmSurface[] = [
  { id: "trust", label: "Trust", Icon: ShieldIcon },
  { id: "work-items", label: "Work Items", Icon: ListCheckIcon },
  { id: "pipelines", label: "Pipelines", Icon: GitBranchIcon },
  { id: "testing", label: "Testing", Icon: BeakerIcon },
];
