import type {
  CanvasId,
  CanvasRecord,
  CapabilityReady,
  CapabilityResult,
  ConversationState,
  LayoutPreset,
  PresentationState,
} from "@/components/capabilities/capability-model";

export type JourneyPhase =
  | "fresh"
  | "planning"
  | "agent-ready"
  | "flow-ready"
  | "flow-pending"
  | "flow-acknowledged"
  | "closed"
  | "stale-resume"
  | "external-fallback"
  | "preparation-error"
  | "context-error"
  | "agent-unavailable";

export type HomeView = "first-time" | "returning";

export type ControlPlaneState = {
  conversationId: string;
  workId?: string;
  conversationState: ConversationState;
  phase: JourneyPhase;
  presentation: PresentationState;
  canvases: Record<CanvasId, CanvasRecord>;
  homeView: HomeView;
  announcement: string;
  pendingCorrelationId?: string;
  acknowledgedCorrelationIds: string[];
};

export type ControlPlaneAction =
  | { type: "START_NEW" }
  | { type: "SHOW_RETURNING" }
  | { type: "BEGIN_WORK" }
  | { type: "CAPABILITY_READY"; canvas: CanvasRecord; ready: CapabilityReady; autoOpen: boolean }
  | { type: "OPEN_CANVAS"; canvasId: CanvasId; userInitiated: boolean }
  | { type: "CLOSE_CANVAS" }
  | { type: "SET_LAYOUT"; layout: LayoutPreset }
  | { type: "ENTER_FOCUS" }
  | { type: "EXIT_FOCUS" }
  | { type: "CAPABILITY_ACTION_PENDING"; canvasId: CanvasId; correlationId: string }
  | { type: "CAPABILITY_RESULT"; canvasId: CanvasId; result: CapabilityResult }
  | { type: "SHOW_SCENARIO"; phase: Extract<JourneyPhase, "stale-resume" | "external-fallback" | "preparation-error" | "context-error" | "agent-unavailable"> }
  | { type: "RESUME_EXACT"; canvas: CanvasRecord }
  | { type: "RESET" };

export const INITIAL_CONTROL_PLANE_STATE: ControlPlaneState = {
  conversationId: "conversation-fresh-01",
  conversationState: "fresh",
  phase: "fresh",
  presentation: { mode: "chat-only" },
  canvases: {},
  homeView: "first-time",
  announcement: "Agent Workstage ready. No project or canvas is selected.",
  acknowledgedCorrelationIds: [],
};

export function activeCanvas(state: ControlPlaneState): CanvasRecord | undefined {
  return state.presentation.mode === "chat-only"
    ? undefined
    : state.canvases[state.presentation.activeCanvasId];
}

export function currentLayout(state: ControlPlaneState): LayoutPreset {
  if (state.presentation.mode === "split") return state.presentation.layout;
  if (state.presentation.mode === "focus") return state.presentation.previousLayout;
  return "canvas-roomy";
}

export function canOpenCanvas(state: ControlPlaneState, canvasId: CanvasId): boolean {
  const canvas = state.canvases[canvasId];
  return Boolean(canvas && ["ready", "closed", "result-acknowledged", "action-pending"].includes(canvas.lifecycle));
}

function updateCanvas(
  state: ControlPlaneState,
  canvasId: CanvasId,
  patch: Partial<CanvasRecord>,
): Record<CanvasId, CanvasRecord> {
  const canvas = state.canvases[canvasId];
  if (!canvas) return state.canvases;
  return { ...state.canvases, [canvasId]: { ...canvas, ...patch } };
}

/** Generic deterministic host transitions. Domain actions remain inside capability adapters. */
export function controlPlaneReducer(
  state: ControlPlaneState,
  action: ControlPlaneAction,
): ControlPlaneState {
  switch (action.type) {
    case "START_NEW":
      return {
        ...INITIAL_CONTROL_PLANE_STATE,
        conversationId: `conversation-fresh-${state.conversationId === "conversation-fresh-01" ? "02" : "01"}`,
        announcement: "New chat ready. No previous work was resumed.",
      };
    case "SHOW_RETURNING":
      return {
        ...state,
        homeView: "returning",
        presentation: { mode: "chat-only" },
        announcement: "Work overview ready. Choose Resume to restore exact work.",
      };
    case "BEGIN_WORK":
      if (state.phase !== "fresh") return state;
      return {
        ...state,
        workId: "work-lead-qualification",
        conversationId: "conversation-lead-routing",
        conversationState: "planning",
        phase: "planning",
        homeView: "first-time",
        announcement: "Working plan ready. No canvas has opened.",
      };
    case "CAPABILITY_READY": {
      if (!action.ready.title || action.ready.instanceId !== action.canvas.instanceId) return state;
      const canvases = {
        ...state.canvases,
        [action.canvas.id]: { ...action.canvas, lifecycle: action.autoOpen ? "active" : "ready" } as CanvasRecord,
      };
      return {
        ...state,
        canvases,
        conversationState: "work-ready",
        phase: action.canvas.capabilityId === "build.flow" ? "flow-ready" : "agent-ready",
        presentation: action.autoOpen
          ? { mode: "split", activeCanvasId: action.canvas.id, layout: "canvas-roomy" }
          : state.presentation,
        announcement: `${action.ready.title} is ready${action.autoOpen ? " and opened beside the conversation" : " to open"}.`,
      };
    }
    case "OPEN_CANVAS": {
      if (!canOpenCanvas(state, action.canvasId)) return state;
      const previous = activeCanvas(state);
      let canvases = state.canvases;
      if (previous && previous.id !== action.canvasId) {
        canvases = updateCanvas({ ...state, canvases }, previous.id, { lifecycle: "ready" });
      }
      const canvas = canvases[action.canvasId]!;
      canvases = { ...canvases, [action.canvasId]: { ...canvas, lifecycle: "active" } };
      return {
        ...state,
        canvases,
        presentation: {
          mode: "split",
          activeCanvasId: action.canvasId,
          layout: currentLayout(state),
        },
        conversationState: "continuing",
        announcement: `${canvas.title} opened. ${action.userInitiated ? "Focus moved to the canvas heading." : "Conversation focus was preserved."}`,
      };
    }
    case "CLOSE_CANVAS": {
      const canvas = activeCanvas(state);
      if (!canvas) return state;
      return {
        ...state,
        canvases: updateCanvas(state, canvas.id, { lifecycle: "closed" }),
        presentation: { mode: "chat-only" },
        phase: "closed",
        announcement: `${canvas.title} closed. The same conversation remains available.`,
      };
    }
    case "SET_LAYOUT":
      return state.presentation.mode === "split"
        ? { ...state, presentation: { ...state.presentation, layout: action.layout }, announcement: `${action.layout.replace("-", " ")} layout selected.` }
        : state;
    case "ENTER_FOCUS":
      return state.presentation.mode === "split"
        ? {
            ...state,
            presentation: {
              mode: "focus",
              activeCanvasId: state.presentation.activeCanvasId,
              previousLayout: state.presentation.layout,
            },
            announcement: "Focus mode enabled. The Agent remains available from the dock.",
          }
        : state;
    case "EXIT_FOCUS":
      return state.presentation.mode === "focus"
        ? {
            ...state,
            presentation: {
              mode: "split",
              activeCanvasId: state.presentation.activeCanvasId,
              layout: state.presentation.previousLayout,
            },
            announcement: "Focus mode closed. Previous layout restored.",
          }
        : state;
    case "CAPABILITY_ACTION_PENDING":
      if (!canOpenCanvas(state, action.canvasId)) return state;
      return {
        ...state,
        phase: "flow-pending",
        pendingCorrelationId: action.correlationId,
        canvases: updateCanvas(state, action.canvasId, { lifecycle: "action-pending" }),
        announcement: "Capability action pending acknowledgement.",
      };
    case "CAPABILITY_RESULT":
      if (
        !state.pendingCorrelationId ||
        state.pendingCorrelationId !== action.result.correlationId ||
        action.result.status !== "succeeded"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "flow-acknowledged",
        pendingCorrelationId: undefined,
        acknowledgedCorrelationIds: [...state.acknowledgedCorrelationIds, action.result.correlationId],
        canvases: updateCanvas(state, action.canvasId, {
          lifecycle: "result-acknowledged",
          revision: action.result.artifactRevision,
        }),
        announcement: action.result.userSummary,
      };
    case "SHOW_SCENARIO":
      return {
        ...state,
        phase: action.phase,
        homeView: "first-time",
        presentation: { mode: "chat-only" },
        announcement: `${action.phase.replaceAll("-", " ")} recovery example shown.`,
      };
    case "RESUME_EXACT":
      return {
        ...state,
        conversationId: "conversation-lead-routing",
        workId: "work-lead-qualification",
        conversationState: "continuing",
        homeView: "first-time",
        phase: "agent-ready",
        canvases: {
          ...state.canvases,
          [action.canvas.id]: { ...action.canvas, lifecycle: "active" },
        },
        presentation: { mode: "split", activeCanvasId: action.canvas.id, layout: "canvas-roomy" },
        announcement: `${action.canvas.title} resumed in the last safe canvas layout. Focus mode was not restored.`,
      };
    case "RESET":
      return INITIAL_CONTROL_PLANE_STATE;
  }
}
