import { surfaceAppById } from "@/components/front-door/app-catalog";
import { SurfacePlaceholder } from "@/components/surfaces/SurfacePlaceholder";

export default function BuildPage() {
  return <SurfacePlaceholder surface={surfaceAppById("build")} />;
}
