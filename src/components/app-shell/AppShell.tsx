"use client";

import { useEffect, useState } from "react";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { ControlPlaneAnnouncer } from "@/components/control-plane/ControlPlaneAnnouncer";
import { ControlPlaneProvider } from "@/components/control-plane/ControlPlaneProvider";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";

/**
 * The shared chrome. The agent is the constant: a persistent left panel that
 * never unmounts, so it's the same agent everywhere and its context follows you.
 * The top bar and the right half are what change — the app launcher on the front
 * door, a purpose-built surface everywhere else. Surface navigation runs through
 * a ⌘⇧P command palette the shell owns.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ControlPlaneProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </ControlPlaneProvider>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Read from the persisted store (SSR-safe: fixed closed default on the
  // server and first hydration pass) rather than a plain `useState`, so the
  // panel survives a reload — see `useWorkspacePanel`. This has to happen
  // above `<WorkspaceProvider>` since AppShell is the component that mounts
  // it, so it can't consume that context itself.
  const { panelOpen, togglePanel } = useWorkspacePanel();

  // Global shortcuts: ⌘⇧P (⌃⇧P off Mac) toggles the palette, ⌘B (⌃B off Mac)
  // toggles the left workspace panel. togglePanel is a stable store method, so
  // the listener is bound once. Shift distinguishes the two — plain ⌘B must not
  // also fire when ⌘⇧P is pressed.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (!event.shiftKey && key === "b") {
        event.preventDefault();
        togglePanel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel]);

  return (
    <WorkspaceProvider>
      <div className={styles.shell}>
        <ControlPlaneAnnouncer />
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
        />
        <div className={`${styles.body} ${panelOpen ? styles.bodyPanelOpen : ""}`}>
          {panelOpen && <WorkspacePanel />}
          <AgentPanel />
          <main className={styles.main}>{children}</main>
        </div>
        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
    </WorkspaceProvider>
  );
}
