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
import { SparklesIcon } from "@/components/icons";
import { canvasRegistry, initialCanvases, type Canvas } from "./canvases";
import { projectCanvasId, type ScopeKey } from "./canvas-ids";
import { projectsById } from "./projects-data";
import { ProjectWorkspace } from "./project-workspace";
import { ProjectProvisioner } from "./project-provisioner";
import { ResourceWizard } from "./create-resource";
import { ResourceBuilder } from "./resource-builder";

type CanvasContextValue = {
  canvases: Canvas[];
  activeId: string;
  /** ALM mode — the global switch for the ALM surfaces (Trust / Work Items /
   *  Pipelines / Testing), both the rail's top-level ALM items and a project's
   *  inner nav. Lives here so the rail and the canvas bodies read one source. */
  almMode: boolean;
  toggleAlmMode: () => void;
  /** Scope keys whose agent session has come live. A project tab's provisioner
   *  flips it true at the "Launching agent session" step; a resource builder
   *  marks its project scope live the moment it opens (it has no provisioning
   *  gate). The chat panel gates its reload reveal on this. */
  liveAgentScopes: Set<ScopeKey>;
  /** Open a registered canvas by id, or focus it if it's already open. */
  openCanvas: (id: string) => void;
  /** Open (or focus) a project as its own canvas tab, by project id. */
  openProject: (id: string) => void;
  /** Focus an already-open canvas (tab click). */
  focusCanvas: (id: string) => void;
  closeCanvas: (id: string) => void;
  /** Open a fresh "Create a Resource" canvas — the ＋ affordance by the tabs, and
   *  a project's "Add resource" action. Pass a projectId to preset the target
   *  project so the wizard skips the project step and builds straight into it. */
  openResourceCanvas: (opts?: { projectId?: string }) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [canvases, setCanvases] = useState<Canvas[]>(initialCanvases);
  const [activeId, setActiveId] = useState<string>(initialCanvases[0]?.id ?? "");
  const [almMode, setAlmMode] = useState(false);
  const toggleAlmMode = () => setAlmMode((v) => !v);
  // Monotonic counter so each "Create a Resource" canvas gets a stable, unique id.
  const resourceCount = useRef(0);
  // Which project tabs have finished "provisioning" their workspace. Opening a
  // project runs a provisioning sequence once; this set lets a revisit (tab
  // switches remount the body) skip straight to the workspace, and closing a
  // tab clears its entry so reopening spins it up again.
  const provisionedRef = useRef<Set<string>>(new Set());
  // Scope keys whose agent session has come "live." Two things flip a scope on:
  // a project's provisioner when it reaches the "Launching agent session" step,
  // and a resource builder the moment it opens (it has no provisioning gate).
  // The chat panel holds its reload beat until the active scope is in here, so
  // the reveal lands in lockstep with that checkmark rather than on its own
  // clock. A scope clears only when its last canvas closes — a project and its
  // builders can share one — so closing one tab never strands another's chat.
  const [liveAgentScopes, setLiveAgentScopes] = useState<Set<ScopeKey>>(new Set());
  const setAgentSessionLive = (scope: ScopeKey, live: boolean) =>
    setLiveAgentScopes((prev) => {
      if (prev.has(scope) === live) return prev;
      const next = new Set(prev);
      if (live) next.add(scope);
      else next.delete(scope);
      return next;
    });

  const openCanvas = (id: string) => {
    const def = canvasRegistry[id];
    if (!def) return;
    setCanvases((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, def]));
    setActiveId(id);
  };

  // Patch an open canvas in place (title, icon, blurb, body). The resource wizard
  // uses this to swap its canvas over to the chosen builder once a kind + project
  // are picked — same tab id, new body — so the built surface persists across tab
  // switches like any other canvas.
  const updateCanvas = (id: string, patch: Partial<Canvas>) =>
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // A "Create a Resource" canvas isn't in the registry — it's opened on demand as
  // its own tab. Its id is namespaced (`resource-<n>`) so it can't collide with a
  // nav canvas. The wizard starts without scope metadata, so it uses the global
  // agent session; once a kind + project are chosen, onBuild swaps this same tab
  // into a focused, project-scoped builder.
  const openResourceCanvas = (opts?: { projectId?: string }) => {
    // An explicit projectId comes from an already-open project ("Add resource"),
    // so it resolves; an unknown id just falls through to the unscoped wizard
    // (pick the project by hand) rather than failing.
    const presetProject = opts?.projectId ? projectsById[opts.projectId] : undefined;
    const n = (resourceCount.current += 1);
    const canvasId = `resource-${n}`;
    const canvas: Canvas = {
      id: canvasId,
      title: "Create a Resource",
      Icon: SparklesIcon,
      blurb: "Pick what to build, then the project to scope it to.",
      Body: () => (
        <ResourceWizard
          presetProject={presetProject}
          onBuild={(kind, project) => {
            // Bind the agent panel + top-bar scope to the chosen project. A
            // builder has no provisioning gate like a project canvas, so its
            // agent session is up the moment it opens — mark the scope live now,
            // or the chat would wait on a "session live" signal that never comes.
            const scopeKey = projectCanvasId(project.id);
            setAgentSessionLive(scopeKey, true);
            updateCanvas(canvasId, {
              title: `${kind.label} · ${project.name}`,
              Icon: kind.Icon,
              blurb: `${kind.label} scoped to ${project.name}.`,
              // The builder is a focused work surface — collapse the rail for it
              // (the wizard step before it leaves the rail alone).
              focusView: true,
              // Point the agent panel + top bar at the builder's project.
              scopeKey,
              Body: () => <ResourceBuilder kind={kind} project={project} />,
            });
          }}
        />
      ),
    };
    setCanvases((prev) => [...prev, canvas]);
    setActiveId(canvasId);
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
              // Project canvases and resource builders use the same metadata
              // contract for focused layout and project-scoped agent context.
              focusView: true,
              scopeKey: canvasId,
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
                    onAddResource={() => openResourceCanvas({ projectId: id })}
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
    // Both setters at top level (rather than nesting setActiveId inside the
    // setCanvases updater): closing a tab is a discrete user action, so reading
    // the current canvases/activeId from the render is correct, and it keeps the
    // updater pure.
    const idx = canvases.findIndex((c) => c.id === id);
    const closing = canvases[idx];
    const next = canvases.filter((c) => c.id !== id);
    // Agent-session liveness is keyed by scope, and a project canvas shares its
    // scope key with every resource builder scoped to the same project. Clear
    // the scope only once its last canvas is gone — otherwise closing the
    // project tab would strand an open builder's chat, waiting on a "session
    // live" signal that never comes back.
    if (closing?.scopeKey && !next.some((c) => c.scopeKey === closing.scopeKey)) {
      setAgentSessionLive(closing.scopeKey, false);
    }
    setCanvases(next);
    // If we closed the active tab, fall to the neighbor on its right, else left.
    if (id === activeId) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      setActiveId(neighbor?.id ?? "");
    }
  };

  return (
    <CanvasContext.Provider
      value={{ canvases, activeId, almMode, toggleAlmMode, liveAgentScopes, openCanvas, openProject, focusCanvas, closeCanvas, openResourceCanvas }}
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
