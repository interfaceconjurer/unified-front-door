"use client";

import { useEffect, useState } from "react";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * The shared chrome. The agent is the constant: a persistent left panel that
 * never unmounts, so it's the same agent everywhere and its context follows you.
 * The top bar and the right half are what change — the app launcher on the front
 * door, a purpose-built surface everywhere else. Surface navigation runs through
 * a ⌘⇧P command palette the shell owns.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘⇧P (⌃⇧P on non-Mac) toggles the palette from anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <WorkspaceProvider>
      <div className={styles.shell}>
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <div className={styles.body}>
          <AgentPanel />
          <main className={styles.main}>{children}</main>
        </div>
        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
    </WorkspaceProvider>
  );
}
