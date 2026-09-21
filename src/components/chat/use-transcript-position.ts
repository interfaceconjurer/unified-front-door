"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Message } from "@/lib/chat/conversation";

type Position = { anchor: number; offset: number; end: number | null };
function readPositions(key: string): Record<string, Position> {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(-64).filter((entry): entry is [string, Position] => {
      const p = entry[1] as Position;
      return p && Number.isSafeInteger(p.anchor) && Number.isFinite(p.offset) && (p.end === null || Number.isSafeInteger(p.end));
    }));
  } catch { return {}; }
}

/** Per-tab reading position is presentation state, scoped to the workspace epoch. */
export function useTranscriptPosition({ identity, threadKey, messages, containerRef, transitioning, onRestore }: {
  identity: string; threadKey: string; messages: Message[];
  containerRef: RefObject<HTMLDivElement | null>; transitioning: boolean;
  onRestore: (scrollTop: number) => void;
}) {
  const storageKey = `ufd.chat-position.v1.${identity}`;
  const [initial] = useState(() => readPositions(storageKey));
  const positions = useRef(initial);
  const [ends, setEnds] = useState<Record<string, number | null>>(() => Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, value.end])));
  const storedEnd = ends[threadKey];
  const end = storedEnd != null && messages.some(message => message.id === storedEnd) ? storedEnd : null;
  const restored = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !messages.length || restored.current === threadKey) return;
    container.style.setProperty("--transcript-height", `${container.clientHeight}px`);
    const position = positions.current[threadKey];
    const last = messages.at(-1), previous = messages.at(-2);
    const latest = last?.role === "agent" && (previous?.role === "user" || previous?.role === "context") ? previous : last;
    const saved = position && container.querySelector<HTMLElement>(`[data-message-id="${position.anchor}"]`);
    const entry = saved || container.querySelector<HTMLElement>(`[data-message-id="${latest?.id}"]`);
    if (!entry) return;
    const inset = parseFloat(getComputedStyle(container).scrollPaddingBlockStart) || 0;
    container.scrollTop += entry.getBoundingClientRect().top - container.getBoundingClientRect().top - (saved ? position.offset : inset);
    restored.current = threadKey;
    if (saved) onRestore(container.scrollTop);
  }, [containerRef, messages, threadKey, onRestore]);

  const remember = useEffectEvent(() => {
    const container = containerRef.current;
    if (!container || restored.current !== threadKey || transitioning) return;
    const top = container.getBoundingClientRect().top;
    const anchor = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"))
      .find(entry => entry.getBoundingClientRect().bottom > top + 1);
    if (!anchor) return;
    positions.current = { ...positions.current, [threadKey]: { anchor: Number(anchor.dataset.messageId), offset: anchor.getBoundingClientRect().top - top, end } };
    try { sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(Object.entries(positions.current).slice(-64)))); } catch { /* Reading position is optional; chat data stays server-owned. */ }
  });
  useEffect(() => { if (!transitioning) remember(); }, [transitioning, threadKey, end, messages.length]);
  useEffect(() => {
    const container = containerRef.current;
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; remember(); }, 100);
    };
    const flush = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; remember(); };
    container?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      container?.removeEventListener("scroll", schedule);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [containerRef]);
  return { end, showPage: (next: number | null) => setEnds(current => ({ ...current, [threadKey]: next })) };
}
