"use client";

import { Suspense, useCallback, useEffect, useRef, useState, ViewTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavigationProvider, useNavigation } from "@/components/navigation/NavigationProvider";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { surfaceAppForPath } from "@/components/front-door/app-catalog";
import { SurfaceCanvasHost } from "@/components/surfaces/SurfaceCanvasHost";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { SurfaceCanvasProvider } from "@/components/surfaces/surface-canvas-context";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { normalizeDestinationHref } from "@/lib/navigation/model";
import { waitForWorkspaceMotion } from "@/lib/motion";
import { CommandPalette, type CommandPaletteTab } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";
import "@/components/surfaces/surface-transitions.css";

/**
 * The shared chrome. The left "chat column" is a single persistent element that
 * lives across every route, so its width can animate rather than tear down: on
 * the front door it holds the conversation and Today briefing at full width; enter
 * a surface and it shrinks to 40% while the surface pane slides in from the
 * right to fill the remaining 60%. Because AppShell is mounted once in the root
 * layout, that column never unmounts as `children` swap beneath it. Surface
 * navigation runs through a ⌘⇧P command palette the shell owns.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter();
  const { profile, resolved, sessionKey } = useDemoProfile();
  useEffect(() => {
    if (!resolved) return;
    if (!profile && pathname !== "/login") {
      const destination = normalizeDestinationHref(`${window.location.pathname}${window.location.search}`);
      router.replace(destination ? `/login?returnTo=${encodeURIComponent(destination)}` : "/login");
    } else if (profile && pathname === "/login") {
      router.replace(normalizeDestinationHref(new URLSearchParams(window.location.search).get("returnTo")) ?? "/");
    }
  }, [pathname, profile, resolved, router]);
  if (!resolved) return null;
  if (pathname === "/login") return children;
  if (!profile) return null;
  return <Suspense fallback={null}><WorkspaceProvider key={sessionKey}><SurfaceCanvasProvider><NavigationProvider><ShellContent>{children}</ShellContent></NavigationProvider></SurfaceCanvasProvider></WorkspaceProvider></Suspense>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { navigateSurface } = useNavigation();
  const { profile } = useDemoProfile();
  const isLogin = pathname === "/login";
  // The same agent fills the front door and narrows to make room for a surface.
  const isFrontDoor = pathname === "/";
  const shellRef = useRef<HTMLDivElement>(null);
  const waitForLayout = useCallback(async (signal: AbortSignal) => {
    if (shellRef.current) await waitForWorkspaceMotion(shellRef.current, signal);
  }, []);
  useEffect(() => {
    // Breakpoints and viewport-based insets can start the same CSS transitions
    // used for panel toggles. Finish them before the resize frame is painted so
    // the layout follows the window immediately, including mid-toggle resizes.
    const finishResizeTransitions = () => {
      shellRef.current?.querySelectorAll("[data-workspace-motion]").forEach(node => {
        for (const animation of node.getAnimations()) {
          if (animation instanceof CSSTransition) animation.finish();
        }
      });
    };
    window.addEventListener("resize", finishResizeTransitions);
    return () => window.removeEventListener("resize", finishResizeTransitions);
  }, []);
  // Which surface (if any) this route belongs to — drives whether the route
  // content is wrapped in its per-surface canvas/tab host. The front door and
  // any non-surface route render their content bare.
  const surface = surfaceAppForPath(pathname);
  const [surfaceVisibility, setSurfaceVisibility] = useState({ pathname, open: !isFrontDoor });
  // A newly selected route reveals its surface; manual toggles keep it mounted.
  if (surfaceVisibility.pathname !== pathname) {
    setSurfaceVisibility({ pathname, open: !isFrontDoor });
  }
  const surfaceOpen = surfaceVisibility.pathname !== pathname ? !isFrontDoor : surfaceVisibility.open;
  const surfacePaneRef = useRef<HTMLElement>(null);
  const [paletteTab, setPaletteTab] = useState<CommandPaletteTab | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteClosing = useRef(false);
  const paletteAction = useRef<(() => void) | undefined>(undefined);
  const openPalette = useCallback((tab: CommandPaletteTab) => {
    if (!paletteTab) {
      setPaletteTab(tab);
    }
    // Reopening during dismissal reverses the dissolve and cancels its action.
    paletteClosing.current = false;
    paletteAction.current = undefined;
    setPaletteOpen(true);
  }, [paletteTab]);
  const closePalette = useCallback((action?: () => void) => {
    if (paletteClosing.current) return;
    paletteClosing.current = true;
    paletteAction.current = action;
    setPaletteOpen(false);
  }, []);
  const finishPaletteClose = useCallback(() => {
    if (!paletteClosing.current) return;
    const action = paletteAction.current;
    paletteClosing.current = false;
    paletteAction.current = undefined;
    setPaletteTab(null);
    action?.();
  }, []);
  // Read from the persisted store (SSR-safe: fixed closed default on the
  // server and first hydration pass) rather than a plain `useState`, so the
  // panel survives a reload. New workspaces start collapsed; established ones
  // default open on home. An explicit user preference still takes precedence.
  const { panelOpen, togglePanel } = useWorkspacePanel(
    isFrontDoor && profile?.workspaceExperience === "established",
  );
  const panelSlot = useRef<HTMLDivElement>(null);
  const toggleWorkspacePanel = useCallback(() => {
    if (panelOpen && panelSlot.current?.contains(document.activeElement)) {
      document.getElementById("workspace-panel-toggle")?.focus();
    }
    togglePanel();
  }, [panelOpen, togglePanel]);

  const toggleSurfacePanel = useCallback(() => {
    if (!surface) {
      navigateSurface("build");
      return;
    }
    if (surfaceOpen && surfacePaneRef.current?.contains(document.activeElement)) {
      document.getElementById("surface-panel-toggle")?.focus();
    }
    setSurfaceVisibility({ pathname, open: !surfaceOpen });
  }, [pathname, navigateSurface, surface, surfaceOpen]);

  // ⌘⇧P opens the palette; ⌘B and ⌘⇧B toggle the left and right panels.
  useEffect(() => {
    if (isLogin || !profile) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "p") {
        event.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette("all");
      } else if (key === "b") {
        event.preventDefault();
        if (event.shiftKey) toggleSurfacePanel();
        else toggleWorkspacePanel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLogin, profile, toggleWorkspacePanel, toggleSurfacePanel, paletteOpen, openPalette, closePalette]);

  if (!profile) return null;

  return (
      <div className={styles.shell} ref={shellRef}>
        <TopBar
          onOpenPalette={() => openPalette("all")}
          onOpenProjects={() => openPalette("projects")}
          panelOpen={panelOpen}
          onTogglePanel={toggleWorkspacePanel}
          surfaceOpen={surfaceOpen}
          onToggleSurface={toggleSurfacePanel}
          profileMenu={<ProfileMenu />}
        />
        <div className={styles.body}>
          <div id="workspace-panel" ref={panelSlot} className={styles.panelSlot} data-workspace-motion data-open={panelOpen} inert={!panelOpen}>
            <WorkspacePanel onClose={toggleWorkspacePanel} />
          </div>
          {/* The chat/surface split lives in its own flex box that fills only the
              space left after the workspace panel. So the chat column's 100%
              front-door width is 100% *of what's available*, not the whole
              screen — opening the panel shrinks the chat to fit instead of
              pushing it off the right edge. */}
          <div className={styles.workspaceMotion} data-workspace-motion>
            <div className={styles.split}>
              <div className={`${styles.chatColumn} ${surfaceOpen ? "" : styles.chatColumnFull}`} data-chat-only={!panelOpen && !surfaceOpen} data-workspace-motion>
                {/* Keep the agent, its conversation state, and its composer mounted
                    across the home/surface boundary, including Today cards. */}
                <div className={styles.chatInner}>
                  <AgentPanel waitForLayout={waitForLayout} layoutKey={`${pathname}:${surfaceOpen}:${panelOpen}`} />
                </div>
              </div>
              {/* The surface is an overlay pinned at its final 60% width: adding
                  .surfaceVisible slides it in from the right (and the front door
                  parks it off-screen) so its content never reflows as it enters. */}
              <main
                id="surface-panel"
                data-workspace-motion
                ref={surfacePaneRef}
                className={`${styles.surfacePane} ${surfaceOpen ? styles.surfaceVisible : ""}`}
                aria-hidden={!surfaceOpen}
                inert={!surfaceOpen}
              >
                {surface ? (
                  // Project/Home changes dissolve; surface-only swaps retain
                  // their movement without mounting duplicate live canvases.
                  <ViewTransition key={surface.id} name="surface-canvas" default="none"
                    share={{ "workspace-context": "workspace-dissolve", default: "surface-swap" }}
                    update={{ "workspace-context": "workspace-dissolve", default: "none" }}
                    enter={{ "workspace-context": "workspace-dissolve", default: "none" }}
                    exit={{ "workspace-context": "workspace-dissolve", default: "none" }}>
                    <div className={styles.surfaceInner}>
                      <SurfaceCanvasHost surfaceId={surface.id}>{children}</SurfaceCanvasHost>
                    </div>
                  </ViewTransition>
                ) : (
                  <div className={styles.surfaceInner}>{children}</div>
                )}
              </main>
            </div>
          </div>
        </div>
        <StatusBar onOpenProjects={() => openPalette("projects")} onOpenOrgs={() => openPalette("orgs")} />
        {paletteTab && <CommandPalette initialTab={paletteTab} open={paletteOpen} onClose={closePalette} onExited={finishPaletteClose} />}
      </div>

  );
}
