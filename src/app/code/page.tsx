import { surfaceAppById } from "@/components/front-door/app-catalog";
import { SurfacePlaceholder } from "@/components/surfaces/SurfacePlaceholder";
import { WorktreeSwitcher } from "@/components/surfaces/WorktreeSwitcher";

export default function CodePage() {
  // Code is the surface that exposes the full project, including its worktrees.
  return <SurfacePlaceholder surface={surfaceAppById("code")} toolbar={<WorktreeSwitcher />} />;
}
