import {
  ChartIcon,
  CodeIcon,
  GridIcon,
  GitBranchIcon,
  type IconComponent,
} from "@/components/icons";
import { SURFACES, SURFACE_IDS, type SurfaceId } from "@/lib/workspace/surfaces";

export type SurfaceApp = {
  id: SurfaceId;
  href: string;
  label: string;
  description: string;
  workspaceDescription: string;
  Icon: IconComponent;
  capabilities: readonly string[];
};

const presentation: Record<SurfaceId, Omit<SurfaceApp, "id" | "href" | "label">> = {
  build: {
    description: "Configure data, automation, agents, and experiences.",
    workspaceDescription:
      "Bring your data, automation, agents, and app experiences together.",
    Icon: GridIcon,
    capabilities: ["Guided setup", "Visual builders", "Configuration"],
  },
  code: {
    description: "Develop, test, debug, and extend the platform.",
    workspaceDescription:
      "Start a project, write code, and give your agents the tools to build with you.",
    Icon: CodeIcon,
    capabilities: ["Start an SFDX project", "Write Apex", "Build a SOQL query", "Create tests"],
  },
  govern: {
    description: "Secure, monitor, and understand platform health.",
    workspaceDescription:
      "Understand your platform, manage access, and set guardrails for your apps and agents.",
    Icon: ChartIcon,
    capabilities: ["Security posture", "Platform health", "Policy controls"],
  },
  alm: {
    description: "Plan, validate, release, and operate change.",
    workspaceDescription:
      "Plan your work, validate changes, and build a path to release.",
    Icon: GitBranchIcon,
    capabilities: ["Work planning", "Delivery pipelines", "Release health"],
  },
};
export const surfaceApps: readonly SurfaceApp[] = SURFACE_IDS.map((id) => ({ id, ...SURFACES[id], ...presentation[id] }));

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
