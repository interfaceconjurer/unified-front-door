"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavigationProvider, useNavigation } from "@/components/navigation/NavigationProvider";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { Workbench } from "@/components/surfaces/Workbench";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { SurfaceCanvasProvider, useWorkbench } from "@/components/surfaces/surface-canvas-context";
import { workbenchViews } from "@/lib/surface-canvas/persistence";
import { useWorkspace, useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { normalizeDestinationHref } from "@/lib/navigation/model";
import { signInDestination } from "@/lib/navigation/sign-in";
import { applicationClient, getActiveCanvasStore, getActiveSelectionStore } from "@/lib/application/client";
import { connectedOrgForProfile } from "@/lib/workspace/orgs";
import type { SurfaceId } from "@/lib/workspace/surfaces";
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
  const { selectView } = useNavigation();
  const workbench = useWorkbench();
  const { destination } = useWorkspace();
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
  // The workbench panel is open by explicit choice or by navigating to a view.
  // Today starts with it closed; plugin routes reveal it unless it was hidden.
  const selectionStore = getActiveSelectionStore(profile?.id);
  const selection = useSyncExternalStore(selectionStore.subscribe, selectionStore.getSnapshot, selectionStore.getServerSnapshot);
  const surfaceOpen = selection.surfacePanelOpen ?? !isFrontDoor;
  const scrollFirstView = destination.kind === "available" && !!destination.destination.surface
    && (!destination.destination.canvas || destination.destination.canvas.kind === "capability");
  const [surfaceVisible, setSurfaceVisible] = useState(surfaceOpen);
  const waitingForTodayScroll = useRef(false);
  const openedByToggle = useRef(false);
  const todayScrollFallback = useRef<{ log: HTMLElement; padding: string; anchor: string; observer: ResizeObserver } | null>(null);
  const clearTodayScrollFallback = useCallback(() => {
    const fallback = todayScrollFallback.current;
    if (!fallback) return;
    fallback.observer.disconnect();
    fallback.log.style.paddingBottom = fallback.padding;
    fallback.log.style.overflowAnchor = fallback.anchor;
    todayScrollFallback.current = null;
  }, []);
  if (!surfaceOpen && surfaceVisible) setSurfaceVisible(false);
  useLayoutEffect(() => {
    if (!surfaceOpen) {
      waitingForTodayScroll.current = false;
      openedByToggle.current = false;
      clearTodayScrollFallback();
      return;
    }
    if (surfaceVisible || waitingForTodayScroll.current) return;
    // Navigation can open the persisted panel before the destination route
    // arrives. Wait for that route before deciding whether Today must scroll.
    if (isFrontDoor && !openedByToggle.current) return;
    // A capability or overview launched over Today holds the wide chat until
    // its new transcript entry has scrolled the briefing out of sight.
    const log = shellRef.current?.querySelector<HTMLElement>('[role="log"]');
    const today = log?.querySelector<HTMLElement>('[data-kind="today"]');
    const card = today?.getBoundingClientRect(), viewport = log?.getBoundingClientRect();
    if (scrollFirstView && !openedByToggle.current && card && viewport && card.bottom > viewport.top && card.top < viewport.bottom) {
      waitingForTodayScroll.current = true;
      return;
    }
    openedByToggle.current = false;
    const frame = requestAnimationFrame(() => setSurfaceVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [surfaceOpen, surfaceVisible, scrollFirstView, isFrontDoor, clearTodayScrollFallback]);
  const releaseSurfaceGate = useCallback(() => {
    if (!waitingForTodayScroll.current) return false;
    waitingForTodayScroll.current = false;
    setSurfaceVisible(true);
    return true;
  }, []);
  useEffect(() => {
    if (!surfaceOpen || surfaceVisible || !waitingForTodayScroll.current) return;
    let frame = 0;
    const timer = window.setTimeout(() => {
      if (!waitingForTodayScroll.current) return;
      const log = shellRef.current?.querySelector<HTMLElement>('[role="log"]');
      const today = log?.querySelector<HTMLElement>('[data-kind="today"]');
      if (!log || !today) { releaseSurfaceGate(); return; }
      // A visit may be delayed or unavailable. Add enough scroll range to move
      // the existing briefing away even without a new transcript entry.
      const observer = new ResizeObserver(() => {
        const overlap = today.getBoundingClientRect().bottom - log.getBoundingClientRect().top + 1;
        if (overlap > 0) log.scrollTop += overlap;
      });
      todayScrollFallback.current = { log, padding: log.style.paddingBottom, anchor: log.style.overflowAnchor, observer };
      log.style.paddingBottom = `${log.clientHeight}px`;
      log.style.overflowAnchor = "none";
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scroll = () => {
        if (!waitingForTodayScroll.current) return;
        const overlap = today.getBoundingClientRect().bottom - log.getBoundingClientRect().top + 1;
        if (overlap <= 0) {
          observer.observe(today);
          releaseSurfaceGate();
          return;
        }
        const before = log.scrollTop;
        log.scrollTop += reduced ? overlap : Math.min(overlap, 80);
        if (log.scrollTop === before) {
          // An unexpected scroll clamp must not leave the workbench inert.
          observer.observe(today);
          releaseSurfaceGate();
          return;
        }
        frame = requestAnimationFrame(scroll);
      };
      scroll();
    }, 600);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [surfaceOpen, surfaceVisible, isFrontDoor, scrollFirstView, releaseSurfaceGate]);
  useEffect(() => () => clearTodayScrollFallback(), [clearTodayScrollFallback]);
  const shownSurfaceOpen = surfaceOpen && surfaceVisible;
  const surfacePaneRef = useRef<HTMLElement>(null);
  const [paletteTab, setPaletteTab] = useState<CommandPaletteTab | null>(null);
  const [palettePlugin, setPalettePlugin] = useState<SurfaceId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteClosing = useRef(false);
  const paletteAction = useRef<(() => void) | undefined>(undefined);
  const openPalette = useCallback((tab: CommandPaletteTab, plugin: SurfaceId | null = null) => {
    if (!paletteTab) {
      setPaletteTab(tab);
    }
    setPalettePlugin(plugin);
    // Reopening during dismissal reverses the dissolve and cancels its action.
    paletteClosing.current = false;
    paletteAction.current = undefined;
    setPaletteOpen(true);
  }, [paletteTab]);
  const exploreCapabilities = useCallback((plugin: SurfaceId) => openPalette("capabilities", plugin), [openPalette]);
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
    setPalettePlugin(null);
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
    if (surfaceOpen && surfacePaneRef.current?.contains(document.activeElement)) {
      document.getElementById("workbench-toggle")?.focus();
    }
    // Reopening from Today returns to the last active view, if any remain.
    if (!surfaceOpen) {
      openedByToggle.current = true;
      setSurfaceVisible(true);
    } else {
      openedByToggle.current = false;
      setSurfaceVisible(false);
    }
    if (!surfaceOpen && !workbench.activeId && workbench.views.length) {
      const store = getActiveCanvasStore(profile?.id, getActiveSelectionStore(profile?.id).getSnapshot().target);
      const last = workbenchViews(store.getSnapshot()).active;
      selectView(workbench.views.some(view => view.id === last) ? last! : workbench.views.at(-1)!.id);
      return;
    }
    selectionStore.setSurfacePanelOpen(!surfaceOpen);
  }, [selectionStore, surfaceOpen, workbench, selectView, profile?.id]);

  // ⌘⇧P opens the palette; ⌘B and ⌘⇧B toggle the left and right panels.
  useEffect(() => {
    if (isLogin || !profile) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "p") {
        event.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette("capabilities");
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
          onOpenPalette={() => openPalette("capabilities")}
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
              <div className={`${styles.chatColumn} ${shownSurfaceOpen ? "" : styles.chatColumnFull}`} data-chat-only={!panelOpen && !shownSurfaceOpen} data-workspace-motion>
                {/* Keep the agent, its conversation state, and its composer mounted
                    across the home/surface boundary, including Today cards. */}
                <div className={styles.chatInner}>
                  <AgentPanel waitForLayout={waitForLayout} layoutKey={`${pathname}:${surfaceOpen}:${panelOpen}`} releaseSurfaceGate={releaseSurfaceGate} exploreCapabilities={exploreCapabilities} />
                </div>
              </div>
              {/* The surface is an overlay pinned at its final 60% width: adding
                  .surfaceVisible slides it in from the right (and the front door
                  parks it off-screen) so its content never reflows as it enters. */}
              <main
                id="workbench"
                aria-label="Workbench"
                data-workspace-motion
                data-awaiting-scroll={surfaceOpen && !shownSurfaceOpen}
                ref={surfacePaneRef}
                className={`${styles.surfacePane} ${shownSurfaceOpen ? styles.surfaceVisible : ""}`}
                aria-hidden={!shownSurfaceOpen}
                inert={!shownSurfaceOpen}
              >
                <div className={styles.surfaceInner}>
                  <Workbench onChooseCapability={() => openPalette("capabilities")} />
                  {children}
                </div>
              </main>
            </div>
          </div>
        </div>
        <StatusBar onOpenProjects={() => openPalette("projects")} onOpenOrgs={() => openPalette("orgs")} />
        {paletteTab && <CommandPalette key={`${paletteTab}:${palettePlugin ?? "all"}`} initialTab={paletteTab} initialPlugin={palettePlugin} open={paletteOpen} onClose={closePalette} onExited={finishPaletteClose} />}
      </div>

  );
}
