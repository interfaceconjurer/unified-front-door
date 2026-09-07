"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch } from "react";
import { FLOW_ARTIFACT } from "./control-plane-fixtures";
import {
  canEnterFocus,
  controlPlaneReducer,
  experienceMode,
  INITIAL_CONTROL_PLANE_STATE,
  type ControlPlaneAction,
  type ControlPlaneState,
  type ExperienceMode,
} from "./control-plane-model";

type ControlPlaneContextValue = {
  state: ControlPlaneState;
  mode: ExperienceMode;
  canEnterFocus: boolean;
  artifact: typeof FLOW_ARTIFACT;
  dispatch: Dispatch<ControlPlaneAction>;
};

const ControlPlaneContext = createContext<ControlPlaneContextValue | null>(null);

export function ControlPlaneProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(controlPlaneReducer, INITIAL_CONTROL_PLANE_STATE);

  const value = useMemo<ControlPlaneContextValue>(
    () => ({
      state,
      mode: experienceMode(state),
      canEnterFocus: canEnterFocus(state),
      artifact: FLOW_ARTIFACT,
      dispatch,
    }),
    [state],
  );

  return <ControlPlaneContext.Provider value={value}>{children}</ControlPlaneContext.Provider>;
}

export function useControlPlane(): ControlPlaneContextValue {
  const value = useContext(ControlPlaneContext);
  if (!value) throw new Error("useControlPlane must be used within ControlPlaneProvider");
  return value;
}
