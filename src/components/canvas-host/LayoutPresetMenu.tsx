"use client";

import type { LayoutPreset } from "@/components/capabilities/capability-model";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import styles from "./CanvasHost.module.css";

const PRESETS: readonly { id: LayoutPreset; label: string; detail: string }[] = [
  { id: "canvas-roomy", label: "Canvas roomy", detail: "40 / 60" },
  { id: "balanced", label: "Balanced", detail: "50 / 50" },
  { id: "chat-roomy", label: "Chat roomy", detail: "60 / 40" },
];

export function LayoutPresetMenu() {
  const { currentLayout, dispatch } = useControlPlane();
  return <details className={styles.menu}><summary>Layout</summary><div role="group" aria-label="Layout preset">{PRESETS.map((preset) => <button key={preset.id} type="button" aria-pressed={currentLayout === preset.id} onClick={(event) => { dispatch({ type: "SET_LAYOUT", layout: preset.id }); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span>{preset.label}</span><small>{preset.detail}</small></button>)}</div></details>;
}
