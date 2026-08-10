"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { LeftNav } from "./LeftNav";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { scopeMetaFor } from "@/components/chat/chat-scopes";
import { GLOBAL_SCOPE } from "@/components/canvas/canvas-ids";
import { CanvasProvider, useCanvas } from "@/components/canvas/canvas-context";
import styles from "./AppShell.module.css";

/**
 * Persistent application chrome. Wraps everything in CanvasProvider so the left
 * rail and the canvas area (in the main region) share one set of open canvases:
 * clicking a nav item opens or focuses its canvas. The actual chrome lives in
 * AppShellChrome, one level down, so it can react to the active canvas.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CanvasProvider>
      <AppShellChrome>{children}</AppShellChrome>
    </CanvasProvider>
  );
}

/**
 * Top bar + collapsible left rail, with route content in the main region. Owns
 * the rail's collapsed/expanded state — the one piece of shell-level UI state
 * that lives here. ALM mode is owned by CanvasProvider (so the rail and the
 * canvas bodies share one source) and merely consumed here for the bar/rail.
 *
 * The rail auto-collapses when a focused work surface is active — a project
 * canvas or a resource builder — since each is its own workspace and gets the
 * room. This is a one-way rule — entering one collapses the rail, but leaving it
 * never re-opens it. A collapse (whether automatic or manual) sticks until the
 * user explicitly pops the rail back out, so focused mode carries over as you
 * move between canvases.
 */
function AppShellChrome({ children }: { children: React.ReactNode }) {
  const { canvases, activeId, almMode, toggleAlmMode } = useCanvas();

  // Adjust the collapse state *during render* when the active canvas enters a
  // focused work surface (React's recommended alternative to a setState-in-
  // effect). Projects and builders declare the same canvas metadata, so the
  // shell does not need to infer behavior from their ids. Only the entry edge
  // collapses; leaving one leaves the rail as-is, so a collapse sticks until the
  // user reopens it.
  const activeCanvas = canvases.find((c) => c.id === activeId);
  const activeWantsFocus = activeCanvas?.focusView ?? false;
  // The top bar names the active project scope; null in any global space.
  // Resolve the name from scope metadata rather than the canvas title so a
  // builder's "Flow · Acme Onboarding" title does not leak into the bar.
  const scopeKey = activeCanvas?.scopeKey ?? GLOBAL_SCOPE;
  const projectScope = scopeKey === GLOBAL_SCOPE ? null : scopeMetaFor(scopeKey).label;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(activeWantsFocus);
  const [prevWantsFocus, setPrevWantsFocus] = useState(activeWantsFocus);
  if (activeWantsFocus !== prevWantsFocus) {
    setPrevWantsFocus(activeWantsFocus);
    if (activeWantsFocus) setSidebarCollapsed(true);
  }

  return (
    <div className={styles.shell}>
      <TopBar scope={projectScope} almMode={almMode} onToggleAlm={toggleAlmMode} />
      <div className={styles.body}>
        <LeftNav
          almMode={almMode}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
        <main className={styles.main}>{children}</main>
        <ChatPanel />
      </div>
    </div>
  );
}
