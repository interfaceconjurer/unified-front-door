import {
  ChartIcon,
  FileIcon,
  GridIcon,
  GitBranchIcon,
  type IconComponent,
} from "@/components/icons";

export type SurfaceApp = {
  id: "build" | "code" | "govern" | "alm";
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
      "A guided workspace for configuring the platform and assembling new capabilities.",
    Icon: GridIcon,
    capabilities: ["Guided setup", "Visual builders", "Configuration"],
  },
  {
    id: "code",
    href: "/code",
    label: "Code",
    description: "Develop, test, debug, and extend the platform.",
    workspaceDescription:
      "A developer workspace designed around source, tests, diagnostics, and deployment readiness.",
    Icon: FileIcon,
    capabilities: ["Source workspace", "Test results", "Diagnostics"],
  },
  {
    id: "govern",
    href: "/govern",
    label: "Govern & Observe",
    description: "Secure, monitor, and understand platform health.",
    workspaceDescription:
      "A trust workspace for policy, security posture, telemetry, and operational health.",
    Icon: ChartIcon,
    capabilities: ["Security posture", "Platform health", "Policy controls"],
  },
  {
    id: "alm",
    href: "/alm",
    label: "ALM",
    description: "Plan, validate, release, and operate change.",
    workspaceDescription:
      "A lifecycle workspace that carries work from planning through release and operation.",
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
