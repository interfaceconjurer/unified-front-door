/** A rendering boundary, not a delay tied to an animation's duration. */
export function nextFrame(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    });
    const abort = () => { cancelAnimationFrame(frame); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function untilAborted(promise: Promise<unknown>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

/** Resample after completion/cancellation: a reversed transition may have
 * replaced the animation we originally awaited. No duration is duplicated. */
export async function waitForMotion(getAnimations: () => Animation[], signal: AbortSignal): Promise<void> {
  while (true) {
    await nextFrame(signal);
    const running = getAnimations().filter((animation) =>
      animation.playState !== "finished" && animation.playState !== "idle" &&
      animation.effect?.getComputedTiming().iterations !== Infinity,
    );
    if (!running.length) return;
    await untilAborted(Promise.allSettled(running.map((animation) => animation.finished)), signal);
  }
}

export function waitForWorkspaceMotion(shell: HTMLElement, signal: AbortSignal): Promise<void> {
  return waitForMotion(() => [
    // Only the shell's geometry, not spinners or animations inside its apps.
    ...Array.from(shell.querySelectorAll<HTMLElement>("[data-workspace-motion]")).flatMap((element) => element.getAnimations()),
    // React's surface-to-surface snapshots animate on document pseudo-elements.
    ...document.getAnimations().filter((animation) =>
      (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"),
    ),
  ], signal);
}

/** Scroll on a real animation timeline so its completion gates the reveal.
 * requestAnimationFrame paints the interpolated scroll position; finished
 * owns completion, including changed playback rates and cancellation. */
export async function scrollToEntry(container: HTMLElement, entry: HTMLElement, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const start = container.scrollTop;
  const target = Math.max(0, Math.min(
    entry.getBoundingClientRect().top - container.getBoundingClientRect().top + start - 20,
    container.scrollHeight - container.clientHeight,
  ));
  if (Math.abs(target - start) < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    container.scrollTop = target;
    return;
  }
  const style = getComputedStyle(container);
  const time = style.getPropertyValue("--chat-scroll-duration").trim();
  const duration = parseFloat(time) * (time.endsWith("ms") ? 1 : 1000);
  const animation = container.animate([{}, {}], {
    duration: Number.isFinite(duration) ? duration : 0,
    easing: style.getPropertyValue("--chat-scroll-easing").trim() || "ease-in-out",
  });
  animation.id = "conversation-scroll";
  let frame = 0;
  const paint = () => {
    const progress = animation.effect?.getComputedTiming().progress ?? 0;
    container.scrollTop = start + (target - start) * progress;
    frame = requestAnimationFrame(paint);
  };
  frame = requestAnimationFrame(paint);
  const cancel = () => animation.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await animation.finished;
    signal.throwIfAborted();
    container.scrollTop = target;
  } finally {
    cancelAnimationFrame(frame);
    signal.removeEventListener("abort", cancel);
    animation.cancel();
  }
}
