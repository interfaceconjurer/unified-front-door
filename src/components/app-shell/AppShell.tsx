"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { FrontDoor } from "@/components/front-door/FrontDoor";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";

/**
 * The shared chrome. The left "chat column" is a single persistent element that
 * lives across every route, so its width can animate rather than tear down: on
 * the front door it holds the merged workstage (FrontDoor) at full width; enter
 * a surface and it shrinks to 40% while the surface pane slides in from the
 * right to fill the remaining 60%. Because AppShell is mounted once in the root
 * layout, that column never unmounts as `children` swap beneath it. Surface
 * navigation runs through a ⌘⇧P command palette the shell owns.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The front door merges the agent and launcher into one column, so it renders
  // full-width without the separate persistent agent panel.
  const isFrontDoor = pathname === "/";
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Read from the persisted store (SSR-safe: fixed closed default on the
  // server and first hydration pass) rather than a plain `useState`, so the
  // panel survives a reload — see `useWorkspacePanel`. This has to happen
  // above `<WorkspaceProvider>` since AppShell is the component that mounts
  // it, so it can't consume that context itself. Passing `isFrontDoor` is what
  // lets the hook default the panel OPEN on the home route (browsing
  // projects/apps/sessions is the point of home) while staying closed
  // elsewhere — but only until the user explicitly toggles it, at which
  // point that choice is persisted and wins on every route.
  const { panelOpen, togglePanel } = useWorkspacePanel(isFrontDoor);

  // Global shortcuts: ⌘⇧P (⌃⇧P off Mac) toggles the palette, ⌘B (⌃B off Mac)
  // toggles the left workspace panel. Unlike the old store-level `togglePanel`,
  // this one closes over the route-resolved `panelOpen` (so it flips the
  // *effective* state, not a possibly-unset stored one) and is therefore
  // re-created whenever that changes — listed in the deps so the listener
  // always sees the current value instead of a stale closure. Shift
  // distinguishes the two — plain ⌘B must not also fire when ⌘⇧P is pressed.
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
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
        />
        <div className={styles.body}>
          {panelOpen && (
            <div className={styles.panelSlot}>
              <WorkspacePanel onClose={togglePanel} />
            </div>
          )}
          {/* The chat/surface split lives in its own flex box that fills only the
              space left after the workspace panel. So the chat column's 100%
              front-door width is 100% *of what's available*, not the whole
              screen — opening the panel shrinks the chat to fit instead of
              pushing it off the right edge. */}
          <div className={styles.split}>
            <div className={`${styles.chatColumn} ${isFrontDoor ? styles.chatColumnFull : ""}`}>
              {/* Keyed only on the home↔surface boundary, not per surface, so the
                  AgentPanel (and its thread) persists as you move between
                  surfaces, and only the merged front-door swap crossfades. */}
              <div key={isFrontDoor ? "home" : "surface"} className={styles.chatInner}>
                {isFrontDoor ? <FrontDoor /> : <AgentPanel />}
              </div>
            </div>
            {/* The surface is an overlay pinned at its final 60% width: adding
                .surfaceVisible slides it in from the right (and the front door
                parks it off-screen) so its content never reflows as it enters. */}
            <main
              className={`${styles.surfacePane} ${isFrontDoor ? "" : styles.surfaceVisible}`}
              aria-hidden={isFrontDoor}
            >
              <div key={pathname} className={styles.surfaceInner}>
                {children}
              </div>
            </main>
          </div>
        </div>
        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
    </WorkspaceProvider>
  );
}
