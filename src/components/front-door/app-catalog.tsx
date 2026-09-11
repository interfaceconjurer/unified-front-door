import {
  ChartIcon,
  FileIcon,
  GridIcon,
  GitBranchIcon,
  type IconComponent,
} from "@/components/icons";
import type { SurfaceId } from "@/lib/workspace/model";

export type SurfaceApp = {
  id: SurfaceId;
  href: string;
  label: string;
  description: string;
  workspaceDescription: string;
  Icon: IconComponent;
  capabilities: readonly string[];
};

export const surfaceApps: readonly SurfaceApp[] = [
  {
    id: "build",
    href: "/build",
    label: "Build & Setup",
    description: "Configure data, automation, agents, and experiences.",
    workspaceDescription:
      "Bring your data, automation, agents, and app experiences together.",
    Icon: GridIcon,
    capabilities: ["Guided setup", "Visual builders", "Configuration"],
  },
  {
    id: "code",
    href: "/code",
    label: "Code",
    description: "Develop, test, debug, and extend the platform.",
    workspaceDescription:
      "Start a project, write code, and give your agents the tools to build with you.",
    Icon: FileIcon,
    capabilities: ["Start an SFDX project", "Write Apex", "Build a SOQL query", "Create tests"],
  },
  {
    id: "govern",
    href: "/govern",
    label: "Govern & Observe",
    description: "Secure, monitor, and understand platform health.",
    workspaceDescription:
      "Understand your platform, manage access, and set guardrails for your apps and agents.",
    Icon: ChartIcon,
    capabilities: ["Security posture", "Platform health", "Policy controls"],
  },
  {
    id: "alm",
    href: "/alm",
    label: "ALM",
    description: "Plan, validate, release, and operate change.",
    workspaceDescription:
      "Plan your work, validate changes, and build a path to release.",
    Icon: GitBranchIcon,
    capabilities: ["Work planning", "Delivery pipelines", "Release health"],
  },
];

export function surfaceAppForPath(pathname: string) {
  return surfaceApps.find(
    (surface) => pathname === surface.href || pathname.startsWith(`${surface.href}/`),
  );
}

export function surfaceAppById(id: SurfaceApp["id"]) {
  const surface = surfaceApps.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`Unknown surface app: ${id}`);
  return surface;
}
