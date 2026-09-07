"use client";

import { useControlPlane } from "./ControlPlaneProvider";

const PHASE_ANNOUNCEMENT = {
  orient: "Front Door orientation ready.",
  proposal: "Automation plan ready for review.",
  "artifact-open": "Flow Route High-Value Leads opened in Build.",
  "node-referenced": "Decision High value selected in the Flow.",
  "preview-complete": "Preview passed. Edge Communications routes to Enterprise Queue.",
  ready: "Collaborate mode restored. Preview result remains available in Build.",
} as const;

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function ControlPlaneAnnouncer() {
  const { state } = useControlPlane();
  return (
    <div style={visuallyHidden} aria-live="polite" aria-atomic="true">
      {PHASE_ANNOUNCEMENT[state.phase]}
    </div>
  );
}
