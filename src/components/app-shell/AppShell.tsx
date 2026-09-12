"use client";

import { useEffect, useState, ViewTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { surfaceAppForPath } from "@/components/front-door/app-catalog";
import { SurfaceCanvasHost } from "@/components/surfaces/SurfaceCanvasHost";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { SurfaceCanvasProvider } from "@/components/surfaces/surface-canvas-context";
import { useWorkspacePanel, WorkspaceProvider } from "@/components/workspace/workspace-context";
import { canAccessSurface } from "@/lib/demo-profiles";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { WorkspacePanel } from "./WorkspacePanel";
import styles from "./AppShell.module.css";
import "@/components/surfaces/surface-transitions.css";

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
  const router = useRouter();
  const { profile, resolved } = useDemoProfile();
  const isLogin = pathname === "/login";
  // The same agent fills the front door and narrows to make room for a surface.
  const isFrontDoor = pathname === "/";
  // Which surface (if any) this route belongs to — drives whether the route
  // content is wrapped in its per-surface canvas/tab host. The front door and
  // any non-surface route render their content bare.
  const surface = surfaceAppForPath(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Read from the persisted store (SSR-safe: fixed closed default on the
  // server and first hydration pass) rather than a plain `useState`, so the
  // panel survives a reload. New workspaces start collapsed; established ones
  // default open on home. An explicit user preference still takes precedence.
  const { panelOpen, togglePanel } = useWorkspacePanel(
    isFrontDoor && profile?.workspaceExperience === "established",
  );

  // Demo identity is deliberately a client-side product concept, not an auth
  // boundary. Keep signed-out users on the login screen and prevent a profile
  // from remaining on a surface it doesn't expose.
  useEffect(() => {
    if (!resolved) return;
    if (isLogin) {
      if (profile) router.replace("/");
      return;
    }
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (surface && !canAccessSurface(profile, surface.id)) router.replace("/");
  }, [isLogin, profile, resolved, router, surface]);

  // Global shortcuts: ⌘⇧P (⌃⇧P off Mac) toggles the palette, ⌘B (⌃B off Mac)
  // toggles the left workspace panel. Unlike the old store-level `togglePanel`,
  // this one closes over the route-resolved `panelOpen` (so it flips the
  // *effective* state, not a possibly-unset stored one) and is therefore
  // re-created whenever that changes — listed in the deps so the listener
  // always sees the current value instead of a stale closure. Shift
  // distinguishes the two — plain ⌘B must not also fire when ⌘⇧P is pressed.
  useEffect(() => {
    if (isLogin || !profile) return;

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
  }, [isLogin, profile, togglePanel]);

  if (!resolved) return null;
  if (isLogin) return children;
  if (!profile || (surface && !canAccessSurface(profile, surface.id))) return null;

  return (
    <WorkspaceProvider key={profile.id}>
      {/* Peer of the workspace: per-surface canvas ("workstage") state, mounted
          above the router outlet so a surface's open tabs survive route content
          swaps (and, via its persisted store, a reload). */}
      <SurfaceCanvasProvider>
      <div className={styles.shell}>
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
          profileMenu={<ProfileMenu />}
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
              {/* Keep the agent, its conversation state, and its composer mounted
                  across the home/surface boundary. Only the stream dissolves. */}
              <div className={styles.chatInner}>
                <AgentPanel />
              </div>
            </div>
            {/* The surface is an overlay pinned at its final 60% width: adding
                .surfaceVisible slides it in from the right (and the front door
                parks it off-screen) so its content never reflows as it enters. */}
            <main
              className={`${styles.surfacePane} ${isFrontDoor ? "" : styles.surfaceVisible}`}
              aria-hidden={isFrontDoor}
              inert={isFrontDoor}
            >
              {surface ? (
                // Matching names retain the outgoing canvas image across a
                // surface swap. Only shared transitions animate: entering or
                // leaving home keeps the existing agent/panel sequence.
                <ViewTransition key={surface.id} name="surface-canvas" share="surface-swap" default="none">
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
        <StatusBar />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
      </SurfaceCanvasProvider>
    </WorkspaceProvider>
  );
}
