"use client";

import { useControlPlane } from "./ControlPlaneProvider";

const visuallyHidden: React.CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };

/** One polite live region for ready, open, close, layout, and result transitions. */
export function ControlPlaneAnnouncer() {
  const { state } = useControlPlane();
  return <div style={visuallyHidden} aria-live="polite" aria-atomic="true">{state.announcement}</div>;
}
