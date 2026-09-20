import type { SurfaceId } from "../workspace/surfaces";

const PREFIX = "(?:(?:please|can you|could you|would you|will you|i want to|i'd like to|i'd like you to|i would like to|i would like you to|let's|let us)\\s+)*";
const ACTION = "(?:open|show(?: me)?|take me to|go to|switch to|navigate to|bring up|view)";
const REQUEST = new RegExp(`^${PREFIX}(${ACTION})\\s+(.+)$`);

/** A conservative affordance gate, not a destination resolver or a planner.
 * Only the current unquoted request may make navigation tools available. */
function navigationObject(text: string): string | null {
  const value = text.trim().toLowerCase().replace(/[’‘]/g, "'");
  if (/^(?:["'“”`>]|example\b)/.test(value)) return null;
  if (/\b(?:don't|do not|never|not to|without)\s+(?:open|show|view|go|switch|navigate|leav(?:e|ing)|take|bring)\b/.test(value)
    || /\b(?:stay|remain)\s+(?:here|in (?:this |the )?chat)\b/.test(value)
    || /\bkeep\s+(?:me|us|this|the conversation|the plan)\s+(?:here|in (?:this |the )?chat)\b/.test(value)
    || /\b(?:not yet|not now|no navigation)\b/.test(value)
    || /\b(?:after|once|when)\s+(?:(?:we|you|i)\s+(?:finish|have finished|complete|are done)|planning)\b/.test(value)) return null;
  const slash = value.match(/^\/(build|code|govern|alm)$/);
  if (slash) return slash[1]!;
  const request = value.match(REQUEST), action = request?.[1], object = request?.[2]?.trim();
  if (!object || !/[a-z0-9]/.test(object)
    || /^(?:how|why|what|whether|when|if|an? example|examples|instructions)\b/.test(object)
    || /^a (?:plan|summary|proposal|list|code example)\b/.test(object)) return null;
  // Asking to see content is not asking to change views. Naming a canvas or
  // surface makes the distinction explicit without a second intent model.
  if (/^(?:show|view)/.test(action ?? "") && !/\b(?:canvas|surface|workspace|view)\b/.test(object)
    && (/^(?:(?:the|my|our|a|an|some)\s+)?(?:(?:deployment|release|project|first|initial|implementation|migration|rollout)\s+)?(?:plan|steps|summary|proposal|example|explanation|options)\b/.test(object)
      || /^(?:the\s+)?code\s+(?:for|to|that)\b/.test(object))) return null;
  return object;
}

export function hasExplicitNavigationIntent(text: string): boolean { return navigationObject(text) !== null; }

/** Demo navigation handles named surfaces; topics and unknown names stay in chat. */
export function requestedSurface(text: string): SurfaceId | null {
  const object = navigationObject(text);
  const match = object?.match(/^(?:the\s+)?(build(?:\s*(?:&|and)\s*setup)?|code|govern(?:\s*(?:&|and)\s*observe)?|alm)(?:\s+(?:surface|workspace))?(?=$|[.!?,]|\s+(?:and|to)\b)/);
  const name = match?.[1];
  return !name ? null : name.startsWith("build") ? "build" : name.startsWith("govern") ? "govern" : name as SurfaceId;
}
