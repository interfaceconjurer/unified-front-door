import { AgentSessionsRail } from "@/components/surfaces/AgentSessionsRail";
import { SurfaceProjection } from "@/components/surfaces/SurfaceProjection";

export default function CodePage() {
  // Code is the surface that exposes the full project, including its worktrees
  // and — for a project with more than one — the parallel agent sessions
  // running across them.
  return (
    <SurfaceProjection surfaceId="code">
      <AgentSessionsRail />
    </SurfaceProjection>
  );
}
