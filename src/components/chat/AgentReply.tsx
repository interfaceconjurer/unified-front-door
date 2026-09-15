"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import styles from "./AgentPanel.module.css";

/** Animate the prototype's completed reply only after navigation has settled. */
export function AgentReply({ text, streaming, ready, onComplete }: {
  text: string;
  streaming: boolean;
  ready: boolean;
  onComplete: () => void;
}) {
  const characters = useMemo(() => Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  ), [text]);
  const [visibleCount, setVisibleCount] = useState(0);
  const progress = useRef(0);
  const complete = useEffectEvent(onComplete);

  useEffect(() => {
    if (!streaming || !ready) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      complete();
      return;
    }

    let timer: number;
    const finish = () => {
      window.clearTimeout(timer);
      complete();
    };
    const tick = () => {
      let next = progress.current;
      // Small chunks and brief punctuation pauses mimic a streamed response.
      for (let chunk = 0; chunk < 5 && next < characters.length; chunk++) {
        const character = characters[next++]!;
        if (/[.,!?;:\n]/.test(character)) break;
      }
      progress.current = next;
      setVisibleCount(next);
      if (next === characters.length) {
        finish();
        return;
      }
      const last = characters[next - 1] ?? "";
      const delay = /[.!?\n]/.test(last) ? 50 : /[,;:]/.test(last) ? 25 : 16;
      timer = window.setTimeout(tick, delay);
    };
    const onMotionChange = () => { if (reducedMotion.matches) finish(); };
    reducedMotion.addEventListener("change", onMotionChange);
    timer = window.setTimeout(tick, 16);
    return () => {
      window.clearTimeout(timer);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [streaming, ready, characters]);

  return (
    <div className={styles.agentReply} data-workspace-motion data-streaming={streaming || undefined} aria-busy={streaming || undefined}>
      {/* Reserve the final height so typing cannot shift the scroll target. */}
      <span className={styles.replySizer} aria-hidden="true">{text}</span>
      {/* Expose the completed reply once, rather than announcing each chunk. */}
      <span className={styles.replyText} aria-hidden={streaming || undefined}>
        {streaming ? characters.slice(0, visibleCount).join("") : text}
      </span>
    </div>
  );
}
