"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch } from "react";
import {
  activeCanvas,
  controlPlaneReducer,
  currentLayout,
  INITIAL_CONTROL_PLANE_STATE,
  type ControlPlaneAction,
  type ControlPlaneState,
} from "./control-plane-model";

type ControlPlaneContextValue = {
  state: ControlPlaneState;
  activeCanvas: ReturnType<typeof activeCanvas>;
  currentLayout: ReturnType<typeof currentLayout>;
  dispatch: Dispatch<ControlPlaneAction>;
};

const ControlPlaneContext = createContext<ControlPlaneContextValue | null>(null);

export function ControlPlaneProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(controlPlaneReducer, INITIAL_CONTROL_PLANE_STATE);

  const value = useMemo<ControlPlaneContextValue>(
    () => ({ state, activeCanvas: activeCanvas(state), currentLayout: currentLayout(state), dispatch }),
    [state],
  );

  return <ControlPlaneContext.Provider value={value}>{children}</ControlPlaneContext.Provider>;
}

export function useControlPlane(): ControlPlaneContextValue {
  const value = useContext(ControlPlaneContext);
  if (!value) throw new Error("useControlPlane must be used within ControlPlaneProvider");
  return value;
}
