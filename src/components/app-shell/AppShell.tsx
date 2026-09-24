"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { signInDestination } from "@/lib/navigation/sign-in";
import { applicationClient, getActiveSelectionStore } from "@/lib/application/client";
import { connectedOrgForProfile } from "@/lib/workspace/orgs";
import { waitForWorkspaceMotion } from "@/lib/motion";
import { CommandPalette, type CommandPaletteTab } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import { SessionConnection } from "./SessionConnection";
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
  const previousProfile = useRef(profile?.id);
  useEffect(() => {
    if (!resolved) return;
    const changedProfile = previousProfile.current !== undefined && previousProfile.current !== profile?.id;
    previousProfile.current = profile?.id;
    if (!profile && pathname !== "/login") {
      const destination = changedProfile ? null : normalizeDestinationHref(`${window.location.pathname}${window.location.search}`);
      router.replace(destination ? `/login?returnTo=${encodeURIComponent(destination)}` : "/login");
    } else if (profile && (pathname === "/login" || changedProfile)) {
      const org = connectedOrgForProfile(profile.id, applicationClient.selection?.getSnapshot().target?.orgId);
      if (org) router.replace(signInDestination(profile.id, org.id, changedProfile ? null : new URLSearchParams(window.location.search).get("returnTo"), applicationClient.selection?.getSnapshot().lastDestination));
    }
  }, [pathname, profile, resolved, router]);
  if (!resolved) return <SessionConnection />;
  // A ready profile still waits for the redirect. Remounting LoginPage here
  // would briefly expose its reset profile list before the workspace appears.
  if (pathname === "/login") return profile ? <SessionConnection /> : children;
  if (!profile) return <SessionConnection signingOut />;
  return <Suspense fallback={<SessionConnection />}><WorkspaceProvider key={sessionKey}><SurfaceCanvasProvider><NavigationProvider><ShellContent>{children}</ShellContent></NavigationProvider></SurfaceCanvasProvider></WorkspaceProvider></Suspense>;
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
  const selectionStore = getActiveSelectionStore(profile?.id);
  const selection = useSyncExternalStore(selectionStore.subscribe, selectionStore.getSnapshot, selectionStore.getServerSnapshot);
  const surfaceOpen = !isFrontDoor && (selection.surfacePanelOpen ?? true);
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
  const { panelOpen, togglePanel } = useWorkspacePanel();
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
    selectionStore.setSurfacePanelOpen(!surfaceOpen);
  }, [selectionStore, navigateSurface, surface, surfaceOpen]);

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
                  <div className={styles.surfaceInner}>
                    <SurfaceCanvasHost key={surface.id} surfaceId={surface.id}>{children}</SurfaceCanvasHost>
                  </div>
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
