"use client";

import { useLayoutEffect, useState, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Smooth only newly received text. Durable state and completed history are immediate. */
export function StreamingText({ text, active }: { text: string; active: boolean }) {
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  const [shown, setShown] = useState(text);
  const [previous, setPrevious] = useState({ text, active, reduce });
  // A terminal update or a changed source must never show an old buffered reply.
  // Synchronize during render so the flush is visible in the same commit.
  if (previous.text !== text || previous.active !== active || previous.reduce !== reduce) {
    setPrevious({ text, active, reduce });
    if (!active || !previous.active || reduce || previous.reduce || !text.startsWith(shown)) setShown(text);
  }

  useLayoutEffect(() => {
    if (!active || reduce || shown === text) return;
    let frame = 0;
    const prefix = shown;
    const boundaries = Array.from(graphemes.segment(text.slice(prefix.length)), part => prefix.length + part.index + part.segment.length);
    const started = performance.now();
    // Adapt to the backlog, catching up within 450 ms even after a large batch.
    const duration = Math.min(450, boundaries.length / 0.06);
    function advance(now: number) {
      const count = Math.min(boundaries.length, Math.floor((now - started) / duration * boundaries.length));
      if (count > 0) setShown(text.slice(0, boundaries[count - 1]));
      if (count < boundaries.length) frame = requestAnimationFrame(advance);
    }
    function flush() { cancelAnimationFrame(frame); setShown(text); }
    // Background tabs suspend animation frames. Show the received prefix on return.
    document.addEventListener("visibilitychange", flush);
    if (document.hidden) flush();
    else frame = requestAnimationFrame(advance);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", flush); };
    // Each received prefix owns one animation. Frame updates do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active, reduce]);

  return <span data-streamed-text="" aria-busy={active || undefined}>{shown}</span>;
}
