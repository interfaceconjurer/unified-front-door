"use client";

import { useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { AgentStudioDemo } from "@/components/capabilities/AgentStudioDemo";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import { FlowAutomationDemo } from "@/components/build/FlowAutomationDemo";
import { CanvasSwitcher } from "./CanvasSwitcher";
import { LayoutPresetMenu } from "./LayoutPresetMenu";
import styles from "./CanvasHost.module.css";

export function CanvasHost() {
  const { state, activeCanvas, dispatch } = useControlPlane();
  const focusInvoker = useRef<HTMLElement | null>(null);
  const displayCanvas = activeCanvas ?? (state.lastActiveCanvasId ? state.canvases[state.lastActiveCanvasId] : undefined);
  if (!displayCanvas) return null;

  function restoreInvoker(canvasId: string) {
    requestAnimationFrame(() => {
      const invoker = document.querySelector<HTMLElement>(`[data-canvas-invoker="${canvasId}"]`);
      (invoker ?? document.getElementById("agent-composer"))?.focus();
    });
  }

  return (
    <section className={styles.host} aria-label={`${displayCanvas.title} canvas`}>
      <header className={styles.toolbar}>
        <button type="button" className={styles.close} onClick={() => { const id = displayCanvas.id; dispatch({ type: "CLOSE_CANVAS" }); restoreInvoker(id); }} aria-label={`Close ${displayCanvas.title} canvas`}><CloseIcon width={16} height={16} /><span>Close</span></button>
        <div className={styles.tools}>
          <CanvasSwitcher />
          {state.presentation.mode === "split" && <LayoutPresetMenu />}
          <button
            id="canvas-focus-button"
            type="button"
            className={styles.toolButton}
            onClick={(event) => {
              if (state.presentation.mode === "focus") {
                dispatch({ type: "EXIT_FOCUS" });
                requestAnimationFrame(() => focusInvoker.current?.focus());
              } else {
                focusInvoker.current = event.currentTarget;
                dispatch({ type: "ENTER_FOCUS" });
              }
            }}
            aria-pressed={state.presentation.mode === "focus"}
          >{state.presentation.mode === "focus" ? "Exit Focus" : "Focus"}</button>
        </div>
      </header>
      <div className={styles.body}>
        {Object.values(state.canvases).map((canvas) => {
          const visible = canvas.id === displayCanvas.id;
          return (
            <div key={canvas.id} className={styles.canvasMount} hidden={!visible} inert={!visible ? true : undefined}>
              {canvas.capabilityId === "agent-studio.agent" ? (
                <AgentStudioDemo canvasId={canvas.id} />
              ) : (
                <FlowAutomationDemo embedded canvasId={canvas.id} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
