import type { SurfaceId } from "../workspace/model";

/** Navigation needs a direct request for a named surface, not a topic match. */
export function requestedSurface(text: string): SurfaceId | null {
  const value = text.trim().replace(/[’‘]/g, "'").toLowerCase();
  const slash = value.match(/^\/(build|code|govern|alm)$/);
  if (slash) return slash[1] as SurfaceId;
  const prefix = "(?:(?:please|can you|could you|would you|i want to|i'd like to|i would like to|let's|let us)\\s+)*";
  const action = "(?:open|go to|take me to|switch to|navigate to|work in|start in|continue in|move (?:this|my plan|the plan) to)";
  const surface = "(build(?:\\s*(?:&|and)\\s*setup)?|code|govern(?:\\s*(?:&|and)\\s*observe)?|alm)";
  const boundary = "(?=$|[.!?,]|\\s+(?:and|to)\\b)";
  const match = value.match(new RegExp(`^${prefix}${action}\\s+(?:the\\s+)?${surface}(?:\\s+(?:surface|workspace))?${boundary}`))
    // “Use code to automate this” describes an approach, not navigation.
    ?? value.match(new RegExp(`^${prefix}use\\s+(?:the\\s+)?${surface}\\s+(?:surface|workspace)${boundary}`));
  const name = match?.[1];
  if (!name) return null;
  if (name.startsWith("build")) return "build";
  if (name.startsWith("govern")) return "govern";
  return name as SurfaceId;
}
