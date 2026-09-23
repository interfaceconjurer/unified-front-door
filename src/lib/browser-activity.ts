export const BROWSER_IDLE_MS = 60000;
export function browserVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/** Only user input/focus extends activity; network responses never do. */
class BrowserActivity {
  private lastInput = 0;
  private listeners = new Set<() => void>();
  private remove?: () => void;
  isActive = () => typeof window === "undefined" || browserVisible() && Date.now() - this.lastInput < BROWSER_IDLE_MS;
  subscribe = (resume: () => void): (() => void) => {
    this.listeners.add(resume);
    if (!this.remove && typeof window !== "undefined") {
      this.lastInput = Date.now();
      const input = () => {
        const wasActive = this.isActive();
        if (!browserVisible()) return;
        this.lastInput = Date.now();
        if (!wasActive) this.listeners.forEach(listener => listener());
      };
      const focus = () => {
        if (!browserVisible()) return;
        this.lastInput = Date.now(); this.listeners.forEach(listener => listener());
      };
      const events = ["pointerdown", "pointermove", "keydown", "input", "scroll"];
      for (const event of events) window.addEventListener?.(event, input, { passive: true, capture: true });
      window.addEventListener?.("focus", focus);
      globalThis.document?.addEventListener?.("visibilitychange", focus);
      this.remove = () => {
        for (const event of events) window.removeEventListener?.(event, input, true);
        window.removeEventListener?.("focus", focus); globalThis.document?.removeEventListener?.("visibilitychange", focus);
      };
    }
    return () => { this.listeners.delete(resume); if (!this.listeners.size) { this.remove?.(); this.remove = undefined; } };
  };
}
export const browserActivity = new BrowserActivity();
