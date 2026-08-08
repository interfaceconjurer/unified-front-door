"use client";

import { CloseIcon, PlusIcon } from "@/components/icons";
import { useCanvas } from "./canvas-context";
import styles from "./CanvasArea.module.css";

/**
 * Center work area: a tab bar of open canvases over a canvas stage. Open/focus,
 * close, and add are all driven by the shared canvas context, so the left nav
 * (and, later, the agent) can open canvases into these same tabs. Bodies come
 * from the canvas registry; canvases without one show a wireframe placeholder.
 */
export function CanvasArea() {
  const { canvases, activeId, almMode, openProject, focusCanvas, closeCanvas, addBlankCanvas } = useCanvas();
  const active = canvases.find((c) => c.id === activeId) ?? null;

  return (
    <section className={styles.canvas} aria-label="Canvas">
      <div className={styles.tabbar} role="tablist" aria-label="Open canvases">
        {canvases.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div key={c.id} className={styles.tab} data-active={isActive || undefined} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className={styles.tabButton}
                onClick={() => focusCanvas(c.id)}
              >
                <span className={styles.tabIcon}>
                  <c.Icon width={16} height={16} />
                </span>
                <span className={styles.tabLabel}>{c.title}</span>
              </button>
              <button
                type="button"
                className={styles.close}
                aria-label={`Close ${c.title}`}
                onClick={() => closeCanvas(c.id)}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.add}
          aria-label="New canvas"
          title="New canvas"
          onClick={addBlankCanvas}
        >
          <PlusIcon width={18} height={18} />
        </button>
      </div>

      <div className={styles.stage} role="tabpanel" aria-label={active ? active.title : "Canvas"}>
        {active ? (
          active.Body ? (
            <active.Body openProject={openProject} almMode={almMode} />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden="true">
                <active.Icon width={30} height={30} />
              </span>
              <h1 className={styles.placeholderTitle}>{active.title}</h1>
              <p className={styles.placeholderBlurb}>{active.blurb}</p>
              <div className={styles.wireframe} aria-hidden="true">
                <span>Canvas placeholder</span>
              </div>
            </div>
          )
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No canvases open</p>
            <p className={styles.emptyHint}>
              Ask the agent to pull one in — or start a blank canvas.
            </p>
            <button type="button" className={styles.emptyAdd} onClick={addBlankCanvas}>
              <PlusIcon width={16} height={16} />
              New canvas
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
