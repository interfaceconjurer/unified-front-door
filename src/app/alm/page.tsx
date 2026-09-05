import { surfaceAppById } from "@/components/front-door/app-catalog";
import { SurfacePlaceholder } from "@/components/surfaces/SurfacePlaceholder";

export default function AlmPage() {
  return <SurfacePlaceholder surface={surfaceAppById("alm")} />;
}
