import type { CanvasSpecInput } from "./model";
import type { SurfaceId } from "../workspace/surfaces";
import { workForCanvas } from "../workspace/returning-work";

/** Deployed operations moved to ALM; canvas identities and captured targets did not.
 * Only the known former Build work route is aliased. Other wrong work routes
 * still fail validation, and builder capabilities retain their own surfaces. */
export function canonicalCanvasSurface(surface: SurfaceId, canvas: CanvasSpecInput): SurfaceId {
  if (canvas.kind === "app") return "alm";
  if (surface === "build" && canvas.kind === "work" && workForCanvas(canvas.params)?.id === "storefront-app") return "alm";
  return surface;
}
