/** Single exhaustive surface declaration shared by data and presentation. */
export const SURFACES = {
  build: { href: "/build", label: "Build & Setup" },
  code: { href: "/code", label: "Code" },
  govern: { href: "/govern", label: "Govern & Observe" },
  alm: { href: "/alm", label: "ALM" },
} as const;
export type SurfaceId = keyof typeof SURFACES;
export const SURFACE_IDS = Object.keys(SURFACES) as SurfaceId[];
export function isSurfaceId(value: unknown): value is SurfaceId { return typeof value === "string" && Object.hasOwn(SURFACES, value); }
