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
  if (!activeCanvas || state.presentation.mode === "chat-only") return null;

  function restoreInvoker(canvasId: string) {
    requestAnimationFrame(() => {
      const invoker = document.querySelector<HTMLElement>(`[data-canvas-invoker="${canvasId}"]`);
      (invoker ?? document.getElementById("agent-composer"))?.focus();
    });
  }

  return (
    <section className={styles.host} aria-label={`${activeCanvas.title} canvas`}>
      <header className={styles.toolbar}>
        <button type="button" className={styles.close} onClick={() => { const id = activeCanvas.id; dispatch({ type: "CLOSE_CANVAS" }); restoreInvoker(id); }} aria-label={`Close ${activeCanvas.title} canvas`}><CloseIcon width={16} height={16} /><span>Close</span></button>
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
        {activeCanvas.capabilityId === "agent-studio.agent" ? <AgentStudioDemo canvasId={activeCanvas.id} /> : <FlowAutomationDemo embedded canvasId={activeCanvas.id} />}
      </div>
    </section>
  );
}
