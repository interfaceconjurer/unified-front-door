import {
  BeakerIcon, ChartIcon, DatabaseIcon, FileIcon, FolderIcon, GitBranchIcon,
  GridIcon, LinkIcon, ListCheckIcon, PuzzleIcon, ShieldIcon, SparklesIcon,
  WorkflowIcon, type IconComponent,
} from "@/components/icons";
import { capabilitiesForSurface as definitionsForSurface, TOOLKIT_SECTIONS as toolkitDefinitions, type SurfaceCapability as CapabilityDefinition } from "@/lib/surface-canvas/capabilities";
import { SURFACE_IDS, type SurfaceId } from "@/lib/workspace/surfaces";
export type { CapabilityField } from "@/lib/surface-canvas/capabilities";
export type SurfaceCapability = CapabilityDefinition & { Icon: IconComponent };

const icons: Record<string, IconComponent> = {
  "sfdx-project": FolderIcon,
  "react-app": GridIcon,
  "apex": FileIcon,
  "query": DatabaseIcon,
  "tests": BeakerIcon,
  "agent": SparklesIcon,
  "toolkit": PuzzleIcon,
  "data-model": DatabaseIcon,
  "automation": WorkflowIcon,
  "experience": GridIcon,
  "security": ShieldIcon,
  "health": ChartIcon,
  "policies": ListCheckIcon,
  "agent-activity": SparklesIcon,
  "work": ListCheckIcon,
  "project": FolderIcon,
  "pipeline": GitBranchIcon,
  "validation": BeakerIcon,
  "release": WorkflowIcon,
  "skills": SparklesIcon,
  "plugins": PuzzleIcon,
  "connectors": LinkIcon,
  "mcp": WorkflowIcon,
};
export const TOOLKIT_SECTIONS = toolkitDefinitions.map(section => ({ ...section, Icon: icons[section.id]! }));
const capabilities = new Map(SURFACE_IDS.map(surface => [surface,
  definitionsForSurface(surface).map(capability => ({ ...capability, Icon: icons[capability.id]! })),
]));
export function capabilitiesForSurface(surfaceId: SurfaceId): readonly SurfaceCapability[] {
  return capabilities.get(surfaceId)!;
}
export function capabilityForCanvas(surfaceId: SurfaceId, id?: string, legacyName?: string) {
  return capabilitiesForSurface(surfaceId).find(capability => capability.id === id || capability.label === legacyName);
}
