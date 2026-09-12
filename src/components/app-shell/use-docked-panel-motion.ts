"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** Lay out the dock once, then animate the workspace's previous visual bounds
 * into the new bounds (FLIP). The sidebar itself only translates in CSS. */
export function useDockedPanelMotion(open: boolean, enabled: boolean) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previous = useRef<{ bounds: DOMRect; open: boolean } | null>(null);
  const motion = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!enabled || !workspace) {
      motion.current?.cancel();
      motion.current = null;
      previous.current = null;
      return;
    }

    // Sample an interrupted slide before cancelling it, so rapid toggles start
    // from the position on screen instead of jumping to an old endpoint.
    const transform = new DOMMatrixReadOnly(getComputedStyle(workspace).transform);
    const first = previous.current;
    motion.current?.cancel();
    motion.current = null;
    const last = workspace.getBoundingClientRect();
    previous.current = { bounds: last, open };

    if (!first || first.open === open ||
        matchMedia("(prefers-reduced-motion: reduce), (max-width: 900px)").matches) return;

    if (!last.width) return;
    const offset = first.bounds.left + transform.m41 - last.left;
    const scale = first.bounds.width * transform.a / last.width;
    if (Math.abs(offset) < 0.5 && Math.abs(scale - 1) < 0.001) return;

    const style = getComputedStyle(workspace);
    const duration = style.getPropertyValue("--shell-motion-duration").trim();
    const slide = workspace.previousElementSibling?.getAnimations().find((animation) =>
      animation instanceof CSSTransition && animation.transitionProperty === "transform");
    // CSS shortens a reversed transition. Match that duration so the panel
    // and workspace keep meeting at the same edge during quick toggles.
    const slideDuration = slide?.effect?.getComputedTiming().duration;
    const animation = workspace.animate([
      { transform: `translateX(${offset}px) scaleX(${scale})` },
      { transform: "none" },
    ], {
      duration: typeof slideDuration === "number" ? slideDuration :
        parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
      easing: style.getPropertyValue("--shell-motion-easing").trim(),
    });
    motion.current = animation;
    if (slide) {
      // CSS transitions can start in the style-update frame, before WAAPI's
      // pending animation starts. Share their timeline origin as well as time.
      if (typeof slide.startTime === "number") animation.startTime = slide.startTime;
      void Promise.all([slide.ready, animation.ready]).then(() => {
        if (motion.current === animation && typeof slide.startTime === "number")
          animation.startTime = slide.startTime;
      }, () => {});
    }
    // No permanent will-change or retained animation layer after settling.
    void animation.finished.then(() => {
      if (motion.current === animation) {
        animation.cancel();
        motion.current = null;
      }
    }, () => {});
  }, [open, enabled]);

  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    function settle() {
      motion.current?.cancel();
      motion.current = null;
      const workspace = workspaceRef.current;
      if (workspace && previous.current) previous.current.bounds = workspace.getBoundingClientRect();
    }
    window.addEventListener("resize", settle);
    reducedMotion.addEventListener("change", settle);
    return () => {
      window.removeEventListener("resize", settle);
      reducedMotion.removeEventListener("change", settle);
      motion.current?.cancel();
    };
  }, []);

  return workspaceRef;
}
