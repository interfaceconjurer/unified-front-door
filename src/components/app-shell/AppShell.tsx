"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CanvasHost } from "@/components/canvas-host/CanvasHost";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { ControlPlaneAnnouncer } from "@/components/control-plane/ControlPlaneAnnouncer";
import { ControlPlaneProvider, useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";

type NarrowPane = "agent" | "canvas";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ControlPlaneProvider><AppShellFrame>{children}</AppShellFrame></ControlPlaneProvider>;
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, activeCanvas, currentLayout, dispatch } = useControlPlane();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [narrowPane, setNarrowPane] = useState<NarrowPane>("agent");
  const { panelOpen, setPanelOpen, togglePanel } = useWorkspacePanel();
  const workspaceToggleRef = useRef<HTMLButtonElement>(null);
  const agentTabRef = useRef<HTMLButtonElement>(null);
  const canvasTabRef = useRef<HTMLButtonElement>(null);
  const isHome = pathname === "/";
  const canvasVisible = isHome ? state.presentation.mode !== "chat-only" : true;
  const focusMode = isHome && state.presentation.mode === "focus";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setNarrowPane(canvasVisible ? "canvas" : "agent"));
    return () => cancelAnimationFrame(frame);
  }, [canvasVisible, activeCanvas?.id]);

  const closeWorkspace = useCallback(({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    setPanelOpen(false);
    if (restoreFocus) requestAnimationFrame(() => workspaceToggleRef.current?.focus());
  }, [setPanelOpen]);

  function openPalette() {
    if (panelOpen) closeWorkspace({ restoreFocus: false });
    setPaletteOpen(true);
  }

  function showNarrowPane(pane: NarrowPane, moveFocus = false) {
    setNarrowPane(pane);
    if (focusMode && pane === "agent") dispatch({ type: "EXIT_FOCUS" });
    if (moveFocus) requestAnimationFrame(() => (pane === "agent" ? agentTabRef.current : canvasTabRef.current)?.focus());
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape" && focusMode && !paletteOpen && !panelOpen) {
        event.preventDefault(); dispatch({ type: "EXIT_FOCUS" }); return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "p") { event.preventDefault(); if (panelOpen) closeWorkspace({ restoreFocus: false }); setPaletteOpen((open) => !open); }
      else if (!event.shiftKey && key === "b") { event.preventDefault(); setPaletteOpen(false); togglePanel(); }
      else if (event.shiftKey && key === "f" && isHome && canvasVisible) { event.preventDefault(); dispatch({ type: focusMode ? "EXIT_FOCUS" : "ENTER_FOCUS" }); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvasVisible, closeWorkspace, dispatch, focusMode, isHome, paletteOpen, panelOpen, togglePanel]);

  const layoutClass = !isHome
    ? styles.modeDirect
    : focusMode
      ? styles.modeFocus
      : state.presentation.mode === "chat-only"
        ? styles.modeChatOnly
        : styles[`layout${currentLayout.replace(/(^|-)([a-z])/g, (_, __, letter: string) => letter.toUpperCase())}` as keyof typeof styles];
  const narrowClass = narrowPane === "agent" ? styles.narrowAgentActive : styles.narrowCanvasActive;

  return (
    <WorkspaceProvider>
      <div className={styles.shell}>
        <ControlPlaneAnnouncer />
        <TopBar
          onOpenPalette={openPalette}
          panelOpen={panelOpen}
          onTogglePanel={() => { setPaletteOpen(false); togglePanel(); }}
          workspaceToggleRef={workspaceToggleRef}
          canvasLabel={isHome ? activeCanvas?.title : undefined}
          onNewChat={() => dispatch({ type: "START_NEW" })}
          onShowWork={() => dispatch({ type: "SHOW_RETURNING" })}
        />
        <div className={styles.body}>
          <div className={`${styles.bodyContent} ${layoutClass ?? ""} ${narrowClass}`} inert={panelOpen ? true : undefined}>
            {canvasVisible && <div className={styles.narrowSwitcher} role="tablist" aria-label="Workstage pane">
              <button ref={agentTabRef} id="agent-pane-tab" type="button" role="tab" tabIndex={narrowPane === "agent" ? 0 : -1} aria-selected={narrowPane === "agent"} aria-controls="agent-pane" onClick={() => showNarrowPane("agent")} onKeyDown={(event) => { if (["ArrowRight","ArrowLeft","End"].includes(event.key)) { event.preventDefault(); showNarrowPane("canvas", true); } else if (event.key === "Home") { event.preventDefault(); agentTabRef.current?.focus(); } }}>Agent</button>
              <button ref={canvasTabRef} id="canvas-pane-tab" type="button" role="tab" tabIndex={narrowPane === "canvas" ? 0 : -1} aria-selected={narrowPane === "canvas"} aria-controls="canvas-pane" onClick={() => showNarrowPane("canvas")} onKeyDown={(event) => { if (["ArrowRight","ArrowLeft","Home"].includes(event.key)) { event.preventDefault(); showNarrowPane("agent", true); } else if (event.key === "End") { event.preventDefault(); canvasTabRef.current?.focus(); } }}>Canvas</button>
            </div>}
            <div id="agent-pane" className={styles.agentPane} role={canvasVisible ? "tabpanel" : undefined} aria-labelledby={canvasVisible ? "agent-pane-tab" : undefined}><AgentPanel /></div>
            {canvasVisible && <main id="canvas-pane" className={styles.main} role="tabpanel" aria-labelledby="canvas-pane-tab">{isHome ? <CanvasHost /> : children}</main>}
          </div>
          {panelOpen && <div className={styles.drawerLayer}><WorkspacePanel onClose={() => closeWorkspace()} /><button type="button" className={styles.drawerScrim} aria-label="Close workspace panel" onClick={() => closeWorkspace()} /></div>}
        </div>
        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
    </WorkspaceProvider>
  );
}
