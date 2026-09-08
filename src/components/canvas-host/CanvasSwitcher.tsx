"use client";

import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import styles from "./CanvasHost.module.css";

export function CanvasSwitcher() {
  const { state, activeCanvas, dispatch } = useControlPlane();
  const canvases = Object.values(state.canvases).filter((canvas) => canvas.lifecycle !== "preparing" && canvas.lifecycle !== "error");
  if (canvases.length < 2) return <span className={styles.canvasLabel}>{activeCanvas?.ownerLabel}</span>;
  return (
    <label className={styles.switcherLabel}>Canvases<span className={styles.srOnly}>Choose active canvas</span><select value={activeCanvas?.id} onChange={(event) => { dispatch({ type: "OPEN_CANVAS", canvasId: event.target.value, userInitiated: true }); requestAnimationFrame(() => document.getElementById(`canvas-heading-${event.target.value}`)?.focus()); }}>{canvases.map((canvas) => <option key={canvas.id} value={canvas.id}>{canvas.title} · {canvas.ownerLabel}</option>)}</select></label>
  );
}
