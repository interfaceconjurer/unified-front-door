"use client";

/**
 * Shared canvas state for the whole shell.
 *
 * The left nav and the canvas area are siblings in the layout, so the set of
 * open canvases and the active one live here, in a context provided high in the
 * tree (AppShell). That's what lets a nav click open or focus a canvas while the
 * canvas area renders the tabs — and it's the same seam the agent/chat will use
 * later to pull canvases in.
 */
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { FileIcon } from "@/components/icons";
import { canvasRegistry, initialCanvases, type Canvas } from "./canvases";
import { projectCanvasId } from "./canvas-ids";
import { projectsById } from "./projects-data";
import { ProjectWorkspace } from "./project-workspace";
import { ProjectProvisioner } from "./project-provisioner";

type CanvasContextValue = {
  canvases: Canvas[];
  activeId: string;
  /** ALM mode — the global switch for the ALM surfaces (Trust / Work Items /
   *  Pipelines / Testing), both the rail's top-level ALM items and a project's
   *  inner nav. Lives here so the rail and the canvas bodies read one source. */
  almMode: boolean;
  toggleAlmMode: () => void;
  /** Scope keys whose agent session has come live (project tabs past their
   *  "Launching agent session" provisioning step). The chat panel gates its
   *  reload reveal on this so the session lands with that checkmark. */
  liveAgentScopes: Set<string>;
  /** Open a registered canvas by id, or focus it if it's already open. */
  openCanvas: (id: string) => void;
  /** Open (or focus) a project as its own canvas tab, by project id. */
  openProject: (id: string) => void;
  /** Focus an already-open canvas (tab click). */
  focusCanvas: (id: string) => void;
  closeCanvas: (id: string) => void;
  /** Add a fresh, empty canvas (the ＋ affordance). */
  addBlankCanvas: () => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [canvases, setCanvases] = useState<Canvas[]>(initialCanvases);
  const [activeId, setActiveId] = useState<string>(initialCanvases[0]?.id ?? "");
  const [almMode, setAlmMode] = useState(false);
  const toggleAlmMode = () => setAlmMode((v) => !v);
  // Monotonic counter so manually-added canvases get stable, unique ids.
  const untitledCount = useRef(0);
  // Which project tabs have finished "provisioning" their workspace. Opening a
  // project runs a provisioning sequence once; this set lets a revisit (tab
  // switches remount the body) skip straight to the workspace, and closing a
  // tab clears its entry so reopening spins it up again.
  const provisionedRef = useRef<Set<string>>(new Set());
  // Scope keys whose agent session has come "live." A project's session goes
  // live when its provisioner reaches the "Launching agent session" step; the
  // chat panel holds its reload beat until the active scope is in here, so the
  // session reveal lands in lockstep with that checkmark rather than on its own
  // clock. The provisioner drives this (false when it starts a fresh spin-up,
  // true when the launch step lands); closing a tab clears it.
  const [liveAgentScopes, setLiveAgentScopes] = useState<Set<string>>(new Set());
  const setAgentSessionLive = (id: string, live: boolean) =>
    setLiveAgentScopes((prev) => {
      if (prev.has(id) === live) return prev;
      const next = new Set(prev);
      if (live) next.add(id);
      else next.delete(id);
      return next;
    });

  const openCanvas = (id: string) => {
    const def = canvasRegistry[id];
    if (!def) return;
    setCanvases((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, def]));
    setActiveId(id);
  };

  // A project isn't a registered canvas — it's opened on demand as its own tab.
  // The tab id is namespaced (see canvas-ids) so it can't collide with a nav
  // canvas, and the body is self-contained (it gets the project + a way back to
  // the Projects grid), which keeps this context out of the bodies' import graph.
  const openProject = (id: string) => {
    const project = projectsById[id];
    if (!project) return;
    const canvasId = projectCanvasId(id);
    setCanvases((prev) =>
      prev.some((c) => c.id === canvasId)
        ? prev
        : [
            ...prev,
            {
              id: canvasId,
              title: project.name,
              Icon: project.Icon,
              blurb: project.subtitle,
              // Gate the workspace behind a one-time provisioning sequence. The
              // gate reads/writes provisionedRef (via this closure) so a revisit
              // skips it, and it doesn't mount ProjectWorkspace until it's done.
              Body: ({ almMode: alm }) => (
                <ProjectProvisioner
                  project={project}
                  alreadyProvisioned={provisionedRef.current.has(canvasId)}
                  onProvisioned={() => provisionedRef.current.add(canvasId)}
                  onAgentSessionChange={(live) => setAgentSessionLive(canvasId, live)}
                >
                  <ProjectWorkspace
                    project={project}
                    almMode={alm}
                    onOpenProjects={() => openCanvas("projects")}
                  />
                </ProjectProvisioner>
              ),
            },
          ],
    );
    setActiveId(canvasId);
  };

  const focusCanvas = (id: string) => setActiveId(id);

  const closeCanvas = (id: string) => {
    // Tearing down the tab tears down its workspace, so reopening re-provisions.
    provisionedRef.current.delete(id);
    setAgentSessionLive(id, false);
    // Both setters at top level (rather than nesting setActiveId inside the
    // setCanvases updater): closing a tab is a discrete user action, so reading
    // the current canvases/activeId from the render is correct, and it keeps the
    // updater pure.
    const idx = canvases.findIndex((c) => c.id === id);
    const next = canvases.filter((c) => c.id !== id);
    setCanvases(next);
    // If we closed the active tab, fall to the neighbor on its right, else left.
    if (id === activeId) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      setActiveId(neighbor?.id ?? "");
    }
  };

  const addBlankCanvas = () => {
    const n = (untitledCount.current += 1);
    const canvas: Canvas = {
      id: `untitled-${n}`,
      title: `Untitled ${n}`,
      Icon: FileIcon,
      blurb: "A blank canvas — nothing here yet.",
    };
    setCanvases((prev) => [...prev, canvas]);
    setActiveId(canvas.id);
  };

  return (
    <CanvasContext.Provider
      value={{ canvases, activeId, almMode, toggleAlmMode, liveAgentScopes, openCanvas, openProject, focusCanvas, closeCanvas, addBlankCanvas }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used within a CanvasProvider");
  return ctx;
}
