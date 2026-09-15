import type { SurfaceId } from "../workspace/model";

const PREFIX = "(?:(?:please|can you|could you|would you|i want to|i'd like to|i would like to|let's|let us)\\s+)*";
const ACTION = "(?:open|go to|take me to|switch to|navigate to|work in|start in|continue in|move (?:this|my plan|the plan) to)";
const SURFACE = "(build(?:\\s*(?:&|and)\\s*setup)?|code|govern(?:\\s*(?:&|and)\\s*observe)?|alm)";
const BOUNDARY = "(?=$|[.!?,]|\\s+(?:and|to)\\b)";
const SURFACE_INTENT_REGEX = new RegExp(`^${PREFIX}${ACTION}\\s+(?:the\\s+)?${SURFACE}(?:\\s+(?:surface|workspace))?${BOUNDARY}`);
const USE_SURFACE_REGEX = new RegExp(`^${PREFIX}use\\s+(?:the\\s+)?${SURFACE}\\s+(?:surface|workspace)${BOUNDARY}`);

/** Navigation needs a direct request for a named surface, not a topic match. */
export function requestedSurface(text: string): SurfaceId | null {
  const value = text.trim().replace(/[’‘]/g, "'").toLowerCase();
  const slash = value.match(/^\/(build|code|govern|alm)$/);
  if (slash) return slash[1] as SurfaceId;
  const match = value.match(SURFACE_INTENT_REGEX)
    // “Use code to automate this” describes an approach, not navigation.
    ?? value.match(USE_SURFACE_REGEX);
  const name = match?.[1];
  if (!name) return null;
  if (name.startsWith("build")) return "build";
  if (name.startsWith("govern")) return "govern";
  return name as SurfaceId;
}
