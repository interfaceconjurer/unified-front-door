import { SurfaceProjection } from "@/components/surfaces/SurfaceProjection";
import { WorktreeSwitcher } from "@/components/surfaces/WorktreeSwitcher";

export default function CodePage() {
  // Code is the surface that exposes the full project, including its worktrees.
  return <SurfaceProjection surfaceId="code" toolbar={<WorktreeSwitcher />} />;
}
