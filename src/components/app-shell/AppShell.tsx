"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { ControlPlaneAnnouncer } from "@/components/control-plane/ControlPlaneAnnouncer";
import {
  ControlPlaneProvider,
  useControlPlane,
} from "@/components/control-plane/ControlPlaneProvider";
import { artifactIsOpen } from "@/components/control-plane/control-plane-model";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";

type NarrowPane = "agent" | "surface";

/**
 * Shared shell for the experiment. The provider holds only journey/control
 * state; workspace selection remains in WorkspaceProvider and Build owns the
 * artifact presentation.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ControlPlaneProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </ControlPlaneProvider>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, mode, canEnterFocus, artifact, dispatch } = useControlPlane();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [narrowPaneOverride, setNarrowPaneOverride] = useState<NarrowPane | null>(null);
  const { panelOpen, setPanelOpen, togglePanel } = useWorkspacePanel();
  const workspaceToggleRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef(mode);
  const artifactOpen = artifactIsOpen(state.phase);
  const buildArtifactActive = pathname === "/build" && artifactOpen;

  const closeWorkspace = useCallback(
    ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      setPanelOpen(false);
      if (restoreFocus) requestAnimationFrame(() => workspaceToggleRef.current?.focus());
    },
    [setPanelOpen],
  );

  function openPalette() {
    if (panelOpen) closeWorkspace({ restoreFocus: false });
    setPaletteOpen(true);
  }

  function toggleFocusMode() {
    dispatch({ type: mode === "focus" ? "EXIT_FOCUS" : "ENTER_FOCUS" });
  }

  function showNarrowPane(pane: NarrowPane) {
    if (pane === "agent" && mode === "focus") dispatch({ type: "EXIT_FOCUS" });
    setNarrowPaneOverride(pane);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;

      if (event.key === "Escape" && mode === "focus" && !paletteOpen && !panelOpen) {
        event.preventDefault();
        dispatch({ type: "EXIT_FOCUS" });
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "p") {
        event.preventDefault();
        if (panelOpen) closeWorkspace({ restoreFocus: false });
        setPaletteOpen((open) => !open);
      } else if (!event.shiftKey && key === "b") {
        event.preventDefault();
        setPaletteOpen(false);
        togglePanel();
      } else if (event.shiftKey && key === "f" && (mode === "focus" || canEnterFocus)) {
        event.preventDefault();
        dispatch({ type: mode === "focus" ? "EXIT_FOCUS" : "ENTER_FOCUS" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEnterFocus, closeWorkspace, dispatch, mode, paletteOpen, panelOpen, togglePanel]);

  useEffect(() => {
    const previous = previousMode.current;
    previousMode.current = mode;
    if (previous === mode) return;

    if (mode === "focus") {
      setPanelOpen(false);
      requestAnimationFrame(() => document.getElementById("flow-preview-button")?.focus());
    } else if (previous === "focus") {
      requestAnimationFrame(() => {
        const target =
          document.getElementById("agent-completion-heading") ??
          document.getElementById("agent-reference-heading");
        target?.focus();
      });
    }
  }, [mode, setPanelOpen]);

  const modeClass =
    mode === "orient"
      ? styles.modeOrient
      : mode === "focus"
        ? styles.modeFocus
        : styles.modeCollaborate;
  const narrowPane = mode === "focus" ? "surface" : (narrowPaneOverride ?? (artifactOpen ? "surface" : "agent"));
  const narrowClass =
    narrowPane === "agent" ? styles.narrowAgentActive : styles.narrowSurfaceActive;

  return (
    <WorkspaceProvider>
      <div className={styles.shell}>
        <ControlPlaneAnnouncer />
        <TopBar
          onOpenPalette={openPalette}
          panelOpen={panelOpen}
          onTogglePanel={() => {
            setPaletteOpen(false);
            togglePanel();
          }}
          workspaceToggleRef={workspaceToggleRef}
          artifactLabel={buildArtifactActive ? artifact.name : undefined}
          focusAvailable={buildArtifactActive && (canEnterFocus || mode === "focus")}
          focusActive={mode === "focus"}
          onToggleFocus={toggleFocusMode}
        />

        <div className={styles.body}>
          <div
            className={`${styles.bodyContent} ${modeClass} ${narrowClass}`}
            inert={panelOpen ? true : undefined}
          >
            <div className={styles.narrowSwitcher} role="tablist" aria-label="Workspace pane">
              <button
                type="button"
                role="tab"
                aria-selected={narrowPane === "agent"}
                aria-controls="agent-pane"
                onClick={() => showNarrowPane("agent")}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") showNarrowPane("surface");
                }}
              >
                Agent
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={narrowPane === "surface"}
                aria-controls="surface-pane"
                onClick={() => showNarrowPane("surface")}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") showNarrowPane("agent");
                }}
              >
                Surface
              </button>
            </div>
            <div id="agent-pane" className={styles.agentPane} role="tabpanel">
              <AgentPanel />
            </div>
            <main id="surface-pane" className={styles.main} role="tabpanel">
              {children}
            </main>
          </div>

          {panelOpen && (
            <div className={styles.drawerLayer}>
              <WorkspacePanel onClose={() => closeWorkspace()} />
              <button
                type="button"
                className={styles.drawerScrim}
                aria-label="Close workspace panel"
                onClick={() => closeWorkspace()}
              />
            </div>
          )}
        </div>

        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
    </WorkspaceProvider>
  );
}
