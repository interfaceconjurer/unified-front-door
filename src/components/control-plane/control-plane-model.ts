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
  acknowledgedCorrelationIds: string[];
  pendingAction?: {
    canvasId: CanvasId;
    instanceId: string;
    actionId: string;
    correlationId: string;
  };
  lastActiveCanvasId?: CanvasId;
  conversationLayout: LayoutPreset;
  context?: {
    projectRef: string;
    orgRef: string;
    label: string;
    contextRevision: string;
  };
};

export type ControlPlaneAction =
  | { type: "START_NEW" }
  | { type: "SHOW_RETURNING" }
  | { type: "BEGIN_WORK" }
  | { type: "CONFIRM_CONTEXT"; projectRef: string; orgRef: string; label: string }
  | { type: "CAPABILITY_READY"; canvas: CanvasRecord; ready: CapabilityReady; autoOpen: boolean }
  | { type: "OPEN_CANVAS"; canvasId: CanvasId; userInitiated: boolean }
  | { type: "CLOSE_CANVAS" }
  | { type: "SET_LAYOUT"; layout: LayoutPreset }
  | { type: "ENTER_FOCUS" }
  | { type: "EXIT_FOCUS" }
  | { type: "CAPABILITY_ACTION_PENDING"; canvasId: CanvasId; instanceId: string; actionId: string; correlationId: string }
  | { type: "CAPABILITY_RESULT"; canvasId: CanvasId; instanceId: string; result: CapabilityResult }
  | { type: "SHOW_SCENARIO"; phase: Extract<JourneyPhase, "stale-resume" | "external-fallback" | "preparation-error" | "context-error" | "agent-unavailable"> }
  | { type: "RESUME_EXACT"; canvas: CanvasRecord; resumeRef?: string; context: { projectRef: string; orgRef: string; label: string } }
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
  conversationLayout: "canvas-roomy",
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
  return Boolean(canvas && ["ready", "active", "closed", "result-acknowledged", "action-pending"].includes(canvas.lifecycle));
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
    case "CONFIRM_CONTEXT":
      if (state.phase !== "planning") return state;
      return {
        ...state,
        context: {
          projectRef: action.projectRef,
          orgRef: action.orgRef,
          label: action.label,
          contextRevision: "ctx-2",
        },
        announcement: `${action.label} attached to this work.`,
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
          ? { mode: "split", activeCanvasId: action.canvas.id, layout: state.conversationLayout }
          : state.presentation,
        lastActiveCanvasId: action.autoOpen ? action.canvas.id : state.lastActiveCanvasId,
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
        lastActiveCanvasId: action.canvasId,
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
        lastActiveCanvasId: canvas.id,
        announcement: `${canvas.title} closed. The same conversation remains available.`,
      };
    }
    case "SET_LAYOUT":
      return state.presentation.mode === "split"
        ? { ...state, presentation: { ...state.presentation, layout: action.layout }, conversationLayout: action.layout, announcement: `${action.layout.replace("-", " ")} layout selected.` }
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
    case "CAPABILITY_ACTION_PENDING": {
      const canvas = state.canvases[action.canvasId];
      if (!canOpenCanvas(state, action.canvasId) || canvas?.instanceId !== action.instanceId) return state;
      return {
        ...state,
        phase: "flow-pending",
        pendingAction: {
          canvasId: action.canvasId,
          instanceId: action.instanceId,
          actionId: action.actionId,
          correlationId: action.correlationId,
        },
        canvases: updateCanvas(state, action.canvasId, { lifecycle: "action-pending" }),
        announcement: "Capability action pending acknowledgement.",
      };
    }
    case "CAPABILITY_RESULT":
      if (
        !state.pendingAction ||
        state.pendingAction.canvasId !== action.canvasId ||
        state.pendingAction.instanceId !== action.instanceId ||
        state.pendingAction.actionId !== action.result.actionId ||
        state.pendingAction.correlationId !== action.result.correlationId ||
        state.canvases[action.canvasId]?.instanceId !== action.instanceId ||
        action.result.status !== "succeeded"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "flow-acknowledged",
        pendingAction: undefined,
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
    case "RESUME_EXACT": {
      if (!action.resumeRef || action.resumeRef !== action.canvas.resumeRef) return state;
      const existing = state.canvases[action.canvas.id];
      const canvas = { ...(existing ?? action.canvas), lifecycle: "active" } as CanvasRecord;
      const resultAcknowledged = state.acknowledgedCorrelationIds.length > 0;
      return {
        ...state,
        conversationId: "conversation-lead-routing",
        workId: "work-lead-qualification",
        conversationState: "continuing",
        homeView: "first-time",
        phase: resultAcknowledged
          ? "flow-acknowledged"
          : canvas.capabilityId === "build.flow" ? "flow-ready" : "agent-ready",
        canvases: { ...state.canvases, [canvas.id]: canvas },
        lastActiveCanvasId: canvas.id,
        context: {
          ...action.context,
          contextRevision: "ctx-2",
        },
        presentation: { mode: "split", activeCanvasId: canvas.id, layout: state.conversationLayout },
        announcement: `${canvas.title} resumed in the last safe canvas layout. Focus mode was not restored.`,
      };
    }
    case "RESET":
      return INITIAL_CONTROL_PLANE_STATE;
  }
}
