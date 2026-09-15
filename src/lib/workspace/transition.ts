import { flushSync } from "react-dom";
import { nextFrame, scrollToEntry, waitForWorkspaceMotion } from "../motion";

/** One transition for the workspace, including selections made in quick succession. */
export class WorkspaceTransition {
  constructor(private onSwitchingChange: (switching: boolean) => void) {}
  private pending: { commit: () => void; ready?: () => boolean } | null = null;
  private controller: AbortController | null = null;
  private phase: "leaving" | "loading" | "entering" = "leaving";
  private animations: Animation[] = [];
  private originals = new Map<HTMLElement, { opacity: string; filter: string; transform: string; inert: boolean }>();

  get active() { return this.controller !== null; }

  request(commit: () => void, ready?: () => boolean) {
    this.pending = { commit, ready };
    if (this.controller) {
      // Replace an uncommitted selection. If the new state is already entering,
      // dissolve from its current appearance instead of snapping it fully open.
      if (this.phase === "entering") this.freeze();
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    this.phase = "leaving";
    this.onSwitchingChange(true);
    void this.run(controller.signal).catch((error) => {
      if (!controller.signal.aborted) console.error("Could not switch workspace", error);
    }).finally(() => {
      if (this.controller !== controller) return;
      this.restore();
      this.controller = null;
      this.onSwitchingChange(false);
    });
  }

  cancel() {
    this.pending = null;
    this.controller?.abort();
    this.controller = null;
    this.restore();
    this.onSwitchingChange(false);
  }

  private targets() {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-workspace-content]"))
      .filter((element) => !element.parentElement?.closest("[inert]") && element.getClientRects().length);
  }

  private remember(element: HTMLElement) {
    if (!this.originals.has(element)) {
      this.originals.set(element, { opacity: element.style.opacity, filter: element.style.filter, transform: element.style.transform, inert: element.inert });
    }
    element.inert = true;
  }

  private freeze() {
    for (const animation of this.animations) {
      const element = (animation.effect as KeyframeEffect).target as HTMLElement;
      this.remember(element);
      const style = getComputedStyle(element);
      element.style.opacity = style.opacity;
      element.style.filter = style.filter;
      element.style.transform = style.transform;
      animation.cancel();
    }
    this.animations = [];
  }

  private restore() {
    delete document.querySelector<HTMLElement>("[data-workspace-shell]")?.dataset.workspaceSwitch;
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
    for (const [element, original] of this.originals) {
      element.style.opacity = original.opacity;
      element.style.filter = original.filter;
      element.style.transform = original.transform;
      element.inert = original.inert;
      delete element.dataset.workspaceSwitch;
    }
    this.originals.clear();
  }

  private async fade(elements: HTMLElement[], entering: boolean, signal: AbortSignal) {
    this.phase = entering ? "entering" : "leaving";
    this.animations = elements.flatMap((element) => {
      this.remember(element);
      element.dataset.workspaceSwitch = this.phase;
      const today = entering && element.querySelector<HTMLElement>('[data-front-door-active="true"]');
      if (today) {
        // Reveal Today through its staggered rows, without a second fade on
        // their parent. The CSS timelines also serve the initial/home reveal.
        element.style.opacity = "1";
        element.style.filter = "none";
        return Array.from(today.querySelectorAll<HTMLElement>("[data-front-door-row]"))
          .flatMap((row) => row.getAnimations());
      }
      const style = getComputedStyle(element);
      const time = style.getPropertyValue("--shell-motion-duration").trim();
      const duration = parseFloat(time) * (time.endsWith("ms") ? 1 : 1000);
      const blur = style.getPropertyValue("--shell-motion-blur").trim() || "24px";
      return [element.animate([
        { opacity: style.opacity, filter: style.filter },
        { opacity: entering ? 1 : 0, filter: entering ? "blur(0px)" : `blur(${blur})` },
      ], {
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches || !Number.isFinite(duration) ? 0 : duration,
        easing: style.getPropertyValue("--shell-motion-easing").trim() || "ease",
        fill: "forwards",
      })];
    });
    await Promise.allSettled(this.animations.map((animation) => animation.finished));
    signal.throwIfAborted();
    this.freeze();
  }

  private async run(signal: AbortSignal) {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const finishMotion = () => {
      if (reducedMotion.matches) this.animations.forEach((animation) => animation.finish());
    };
    reducedMotion.addEventListener("change", finishMotion);
    try {
      while (this.pending) {
        if (this.phase !== "loading" && !reducedMotion.matches) await this.fade(this.targets(), false, signal);
        signal.throwIfAborted();
        const selection = this.pending;
        this.pending = null;
        this.phase = "loading";
        const shell = document.querySelector<HTMLElement>("[data-workspace-shell]");
        // A route may mount a new canvas asynchronously. Hide it from its first
        // paint, then include it in the same reveal as the incoming transcript.
        if (shell && !reducedMotion.matches) shell.dataset.workspaceSwitch = "loading";
        for (const element of this.originals.keys()) element.dataset.workspaceSwitch = "loading";
        flushSync(() => selection?.commit());
        // Give the incoming session time to seed its transcript while hidden.
        await nextFrame(signal);
        while (!this.pending && selection?.ready && !selection.ready()) await nextFrame(signal);
        if (this.pending) continue;
        const incoming = this.targets();
        for (const element of incoming) {
          this.remember(element);
          element.dataset.workspaceSwitch = "loading";
          if (!reducedMotion.matches) {
            element.style.opacity = "0";
            element.style.filter = `blur(${getComputedStyle(element).getPropertyValue("--shell-motion-blur").trim() || "24px"})`;
          }
        }
        if (shell) await waitForWorkspaceMotion(shell, signal);
        for (const container of incoming.filter((element) => element.dataset.workspaceContent === "chat")) {
          const entries = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"));
          const last = entries.at(-1);
          const previous = entries.at(-2);
          const anchor = last?.dataset.kind === "agent" && ["context", "user"].includes(previous?.dataset.kind ?? "") ? previous : last;
          if (anchor) await scrollToEntry(container, anchor, signal, false);
        }
        signal.throwIfAborted();
        // A newer request during loading can replace this state before reveal.
        if (!this.pending) {
          if (shell) delete shell.dataset.workspaceSwitch;
          if (!reducedMotion.matches) await this.fade(incoming, true, signal);
        }
        signal.throwIfAborted();
      }
    } finally {
      reducedMotion.removeEventListener("change", finishMotion);
    }
  }
}
