"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { LeftNav } from "./LeftNav";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CanvasProvider, useCanvas } from "@/components/canvas/canvas-context";
import { isProjectCanvasId } from "@/components/canvas/canvas-ids";
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
 * The rail auto-collapses when a project canvas is focused: a project is its own
 * workspace, so it gets the room. The rule re-applies only when you cross the
 * project/non-project boundary (it keys off that, not every tab switch), so a
 * manual collapse/expand still sticks while you stay within the same kind of
 * view — and you can always pop the rail back out from inside a project.
 */
function AppShellChrome({ children }: { children: React.ReactNode }) {
  const { canvases, activeId, almMode, toggleAlmMode } = useCanvas();

  // Adjust the collapse state *during render* when the project/non-project scope
  // flips (React's recommended alternative to a setState-in-effect): crossing
  // that boundary re-applies the rule, while a manual toggle still sticks as long
  // as you stay within the same kind of view.
  const activeIsProject = isProjectCanvasId(activeId);
  // The top bar names the current project as a scope indicator; null in any
  // global space so it disappears there.
  const projectScope = activeIsProject
    ? canvases.find((c) => c.id === activeId)?.title ?? null
    : null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(activeIsProject);
  const [prevIsProject, setPrevIsProject] = useState(activeIsProject);
  if (activeIsProject !== prevIsProject) {
    setPrevIsProject(activeIsProject);
    setSidebarCollapsed(activeIsProject);
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
