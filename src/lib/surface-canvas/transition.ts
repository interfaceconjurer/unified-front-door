import { flushSync } from "react-dom";

/** Snapshot only the canvas. External-store updates are synchronous, so they
 * need an explicit browser transition rather than React's route transition. */
export class CanvasTransition {
  private pending: { id: string; cancel: () => void; finish: () => void } | null = null;

  get activeId() { return this.pending?.id; }

  cancel() {
    this.pending?.cancel();
  }

  finish() {
    this.pending?.finish();
  }

  select(panel: HTMLElement, id: string, commit: () => void) {
    this.cancel();
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flushSync(commit);
      return;
    }

    const root = document.documentElement;
    const rootName = root.style.viewTransitionName;
    const panelName = panel.style.viewTransitionName;
    let cancelled = false;
    let committed = false;
    let transition: ViewTransition | undefined;
    const cleanup = () => {
      if (this.pending !== pending) return;
      this.pending = null;
      if (root.style.viewTransitionName === "none") root.style.viewTransitionName = rootName;
      if (panel.style.viewTransitionName === "canvas-content") panel.style.viewTransitionName = panelName;
      delete root.dataset.canvasSwitch;
      delete panel.dataset.canvasSwitch;
    };
    const update = () => {
      if (cancelled || committed || !panel.isConnected) return;
      committed = true;
      flushSync(commit);
    };
    const pending = { id, cancel: () => {
      cancelled = true;
      transition?.skipTransition();
      cleanup();
    }, finish: () => { update(); pending.cancel(); } };
    this.pending = pending;
    // Excluding the root keeps the chat, composer, and tab strip live and sharp.
    root.style.viewTransitionName = "none";
    panel.style.viewTransitionName = "canvas-content";
    root.dataset.canvasSwitch = "true";
    panel.dataset.canvasSwitch = "true";
    try {
      transition = document.startViewTransition(() => {
        // Skipping a native transition still invokes its update callback. Never
        // let a superseded click or an unmounted surface apply stale selection.
        update();
      });
      // A skipped/unsupported capture can reject ready while the update succeeds.
      void transition.ready.catch(() => {});
      void transition.finished.then(cleanup, (error) => {
        cleanup();
        console.error("Could not switch canvas", error);
      });
    } catch {
      cleanup();
      update();
    }
  }
}
