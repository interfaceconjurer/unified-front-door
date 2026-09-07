export type JourneyPhase =
  | "orient"
  | "proposal"
  | "artifact-open"
  | "node-referenced"
  | "preview-complete"
  | "ready";

export type ExperienceMode = "orient" | "collaborate" | "focus";

export type ControlPlaneState = {
  phase: JourneyPhase;
  focusMode: boolean;
};

export type ControlPlaneAction =
  | { type: "START_AUTOMATION" }
  | { type: "DISMISS_PROPOSAL" }
  | { type: "OPEN_ARTIFACT" }
  | { type: "REFERENCE_DECISION" }
  | { type: "ENTER_FOCUS" }
  | { type: "EXIT_FOCUS" }
  | { type: "RUN_PREVIEW" }
  | { type: "RUN_AGAIN" }
  | { type: "RESET" };

export const INITIAL_CONTROL_PLANE_STATE: ControlPlaneState = {
  phase: "orient",
  focusMode: false,
};

export function experienceMode(state: ControlPlaneState): ExperienceMode {
  if (state.focusMode) return "focus";
  return state.phase === "orient" ? "orient" : "collaborate";
}

export function artifactIsOpen(phase: JourneyPhase): boolean {
  return phase === "artifact-open" || phase === "node-referenced" || phase === "preview-complete" || phase === "ready";
}

export function canEnterFocus(state: ControlPlaneState): boolean {
  return artifactIsOpen(state.phase) && !state.focusMode;
}

/**
 * Deterministic prototype journey. Invalid or out-of-order events are ignored,
 * so the agent cannot claim an artifact or preview that Build has not opened.
 */
export function controlPlaneReducer(
  state: ControlPlaneState,
  action: ControlPlaneAction,
): ControlPlaneState {
  switch (action.type) {
    case "START_AUTOMATION":
      return state.phase === "orient" ? { phase: "proposal", focusMode: false } : state;
    case "DISMISS_PROPOSAL":
      return state.phase === "proposal" ? INITIAL_CONTROL_PLANE_STATE : state;
    case "OPEN_ARTIFACT":
      return state.phase === "proposal" ? { phase: "artifact-open", focusMode: false } : state;
    case "REFERENCE_DECISION":
      return state.phase === "artifact-open" || state.phase === "ready"
        ? { phase: "node-referenced", focusMode: false }
        : state;
    case "ENTER_FOCUS":
      return canEnterFocus(state) ? { ...state, focusMode: true } : state;
    case "EXIT_FOCUS":
      if (!state.focusMode) return state;
      return {
        phase: state.phase === "preview-complete" ? "ready" : state.phase,
        focusMode: false,
      };
    case "RUN_PREVIEW":
      return artifactIsOpen(state.phase) && state.phase !== "preview-complete"
        ? { phase: "preview-complete", focusMode: state.focusMode }
        : state;
    case "RUN_AGAIN":
      return state.phase === "ready" || state.phase === "preview-complete"
        ? { phase: "node-referenced", focusMode: false }
        : state;
    case "RESET":
      return INITIAL_CONTROL_PLANE_STATE;
  }
}
