"use client";

import { useRef } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import type { SurfaceId } from "@/lib/workspace/model";
import { OVERVIEW_CANVAS_ID, type CanvasSpecInput } from "@/lib/surface-canvas/model";
import { CanvasContent } from "./canvas-registry";
import { useSurfaceCanvases } from "./surface-canvas-context";
import styles from "./SurfaceCanvasHost.module.css";

/** DOM ids that wire each tab to the shared panel for `aria-controls` /
 *  `aria-labelledby`. Scoped by surface so two surface panes (were they ever
 *  mounted together) couldn't collide. */
function tabDomId(surfaceId: SurfaceId, canvasId: string): string {
  return `surface-canvas-tab-${surfaceId}-${canvasId}`;
}
function panelDomId(surfaceId: SurfaceId): string {
  return `surface-canvas-panel-${surfaceId}`;
}

/**
 * The surface pane's tab framework — the "workstage" for one surface. Renders a
 * tablist above a single canvas panel: tab 0 is the pinned, non-closable
 * Overview launch pad (the surface's existing projection body, `children`, plus
 * launch affordances), and every launched canvas is a closable tab after it.
 *
 * Lives inside the surface pane (mounted by `AppShell`), but its state comes
 * from the shell-level `SurfaceCanvasProvider` above the router outlet, so the
 * open-tab set survives leaving and re-entering the surface and a full reload.
 * Switching surface (route) re-mounts this host for that surface's own set.
 *
 * A11y follows the tabs pattern: `role=tablist/tab/tabpanel`, `aria-selected`,
 * and roving tabindex — only the active tab is in the Tab order; Arrow/Home/End
 * move focus and selection together, and Delete/Backspace closes the focused
 * tab when it's closable.
 */
export function SurfaceCanvasHost({
  surfaceId,
  children,
}: {
  surfaceId: SurfaceId;
  children: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  const SurfaceIcon = surface.Icon;
  const { canvases, activeCanvasId, closeCanvas, setActiveCanvas } = useSurfaceCanvases(surfaceId);
  // Imperative focus targets for roving-tabindex keyboard nav. Focusing a tab
  // whose tabindex is still -1 (before the store-driven re-render flips it to 0)
  // is fine — programmatic focus ignores tabindex.
  const tabRefs = useRef(new Map<string, HTMLButtonElement | null>());

  // `activeCanvasId` is guaranteed by the store/parser to be either the overview
  // or a live launched tab, so the lookup normally hits; the `?? canvases[0]!`
  // (overview is always index 0) is defensive-only, for the theoretical window
  // where a stale render's id no longer resolves. `activeIndex` anchors the
  // Arrow/Home/End roving-tabindex math to that resolved tab.
  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0]!;
  const activeIndex = canvases.findIndex((c) => c.id === activeCanvas.id);

  function focusTab(canvasId: string): void {
    setActiveCanvas(surfaceId, canvasId);
    tabRefs.current.get(canvasId)?.focus();
  }

  function onTabsKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const last = canvases.length - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      // Wrap around so the strip is a ring, matching the tabs APG pattern.
      const nextIndex = (activeIndex + delta + canvases.length) % canvases.length;
      focusTab(canvases[nextIndex]!.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(canvases[0]!.id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(canvases[last]!.id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      // Close the focused tab when it isn't the pinned overview. The store moves
      // the active id to a sensible neighbor (the tab that slides into the closed
      // slot, else the previous one, else the overview); we mirror that choice
      // here and re-focus it so keyboard-close keeps roving-tabindex continuity
      // instead of dropping focus to <body>. The neighbor still exists in the
      // current DOM — only the closed tab unmounts — and programmatic focus
      // ignores its (still -1) tabindex until the store-driven re-render flips it.
      if (activeCanvas.id === OVERVIEW_CANVAS_ID) return;
      event.preventDefault();
      const neighborId = canvases[activeIndex + 1]?.id ?? canvases[activeIndex - 1]!.id;
      closeCanvas(surfaceId, activeCanvas.id);
      tabRefs.current.get(neighborId)?.focus();
    }
  }

  return (
    <div className={styles.host}>
      <div
        role="tablist"
        aria-label={`${surface.label} canvases`}
        aria-orientation="horizontal"
        className={styles.tabs}
        onKeyDown={onTabsKeyDown}
      >
        {canvases.map((canvas) => {
          // Derive selection from the *resolved* `activeCanvas`, not the raw
          // `activeCanvasId`, so tab selection, roving tabindex, and the rendered
          // panel can never disagree even if a stale id failed to resolve.
          const isActive = canvas.id === activeCanvas.id;
          const isOverview = canvas.id === OVERVIEW_CANVAS_ID;
          const closable = !isOverview;
          return (
            // role=presentation keeps the tab itself a direct semantic child of
            // the tablist while letting the close button ride alongside it.
            <span
              key={canvas.id}
              role="presentation"
              className={`${styles.tabWrap} ${isOverview ? styles.tabWrapSurface : ""}`}
            >
              <button
                type="button"
                role="tab"
                id={tabDomId(surfaceId, canvas.id)}
                aria-selected={isActive}
                aria-controls={panelDomId(surfaceId)}
                tabIndex={isActive ? 0 : -1}
                ref={(node) => {
                  tabRefs.current.set(canvas.id, node);
                }}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => setActiveCanvas(surfaceId, canvas.id)}
              >
                {isOverview ? (
                  // The pinned first tab IS the surface: its own icon + name,
                  // always present and non-closable, so which surface you're in
                  // stays visible no matter which canvas is active. Its text
                  // (the surface label) is the tab's accessible name; clicking it
                  // returns to the surface overview.
                  <>
                    <SurfaceIcon
                      width={15}
                      height={15}
                      aria-hidden="true"
                      className={styles.surfaceTabIcon}
                    />
                    {surface.label}
                  </>
                ) : (
                  canvas.title
                )}
              </button>
              {closable && (
                <button
                  type="button"
                  // Not in the roving order (Tab reaches only the active tab);
                  // reachable by mouse and via Delete/Backspace on the tab.
                  tabIndex={-1}
                  aria-label={`Close ${canvas.title}`}
                  className={styles.close}
                  onClick={() => closeCanvas(surfaceId, canvas.id)}
                >
                  <CloseIcon width={13} height={13} aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelDomId(surfaceId)}
        aria-labelledby={tabDomId(surfaceId, activeCanvas.id)}
        tabIndex={0}
        className={styles.panel}
      >
        {activeCanvas.id === OVERVIEW_CANVAS_ID ? (
          <>
            <LaunchPad surfaceId={surfaceId} />
            {children}
          </>
        ) : (
          <CanvasContent spec={activeCanvas} />
        )}
      </div>
    </div>
  );
}

/** A launch definition: label + the serializable spec it opens. `makeSpec` is
 *  handed the next free note number so a "new each time" launch (notes) always
 *  gets an unused id, while a singleton launch (activity) omits params and thus
 *  dedupes to a single tab. */
type Launch = {
  key: string;
  label: string;
  hint: string;
  makeSpec: (nextNoteNumber: number) => CanvasSpecInput;
};

/** The two prototype launches, chosen to exercise both `openCanvas` dedupe
 *  paths from the UI: `activity` is params-free, so re-launching focuses the one
 *  open tab (singleton), while `notes` carries a per-note number, so each launch
 *  opens a distinct tab. Between them they demonstrate the whole tab lifecycle
 *  the phase requires. */
const LAUNCHES: readonly Launch[] = [
  {
    key: "activity",
    label: "Open activity log",
    hint: "One per surface — re-opening focuses it",
    makeSpec: () => ({ kind: "activity", title: "Activity log" }),
  },
  {
    key: "notes",
    label: "New scratch note",
    hint: "Opens a fresh tab each time",
    makeSpec: (nextNoteNumber) => ({
      kind: "notes",
      title: `Scratch note ${nextNoteNumber}`,
      params: { n: String(nextNoteNumber) },
    }),
  },
];

/**
 * The launch-pad affordances shown on the Overview tab. Each button calls
 * `openCanvas`, which opens+activates a new tab (or focuses the matching one for
 * a params-free singleton). This is the "empty editor as launch pad" made
 * concrete — the minimum needed to exercise the whole tab lifecycle.
 */
function LaunchPad({ surfaceId }: { surfaceId: SurfaceId }) {
  const { canvases, openCanvas } = useSurfaceCanvases(surfaceId);
  // Next free note number = one past the highest `n` currently open, NOT the
  // count of open notes: deriving from the count re-issues an id after a close
  // (open 1+2, close 1, "new" would recompute n=2 and merely re-focus the old
  // tab). Reading the max live `n` always yields an unused id, and — because it
  // reads the persisted specs rather than a session counter — it also stays
  // monotonic across a reload.
  const nextNoteNumber =
    canvases.reduce((max, c) => {
      if (c.kind !== "notes") return max;
      const n = Number(c.params?.n);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;

  return (
    <section className={styles.launchPad} aria-label="Launch a canvas">
      <div className={styles.launchCopy}>
        <h2 className={styles.launchTitle}>Launch a canvas</h2>
        <p className={styles.launchLead}>
          Open a working canvas as its own tab in this surface. Tabs persist across
          reloads and stay scoped to this surface.
        </p>
      </div>
      <ul className={styles.launchList}>
        {LAUNCHES.map((launch) => (
          <li key={launch.key}>
            <button
              type="button"
              className={styles.launchButton}
              onClick={() => openCanvas(surfaceId, launch.makeSpec(nextNoteNumber))}
            >
              <span className={styles.launchIcon} aria-hidden="true">
                <PlusIcon width={16} height={16} />
              </span>
              <span className={styles.launchButtonCopy}>
                <span className={styles.launchLabel}>{launch.label}</span>
                <span className={styles.launchHint}>{launch.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
