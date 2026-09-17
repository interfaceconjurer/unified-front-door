"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

/** Owns modality until the closing animation finishes, including cancelled closes. */
export function Modal({ open, onDismiss, onExited, initialFocus, label, className, children }: {
  open: boolean; onDismiss: () => void; onExited: () => void;
  initialFocus: RefObject<HTMLElement | null>; label: string; className?: string; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = dialog.current!;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal(); initialFocus.current?.focus();
    return () => { node.close(); if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, [initialFocus]);
  useEffect(() => {
    if (open) { initialFocus.current?.focus(); return; }
    let cancelled = false;
    const node = dialog.current!;
    // Status indicators and feature content own their own timelines. Only the
    // dialog shell's finite close motion may delay releasing native modality.
    const frames = [node, ...node.querySelectorAll<HTMLElement>("[data-modal-motion]")]
      .flatMap(element => element.getAnimations())
      .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    void Promise.allSettled(frames.map(frame => frame.finished)).then(() => {
      if (!cancelled) onExited();
    });
    return () => { cancelled = true; };
  }, [open, initialFocus, onExited]);
  return <dialog ref={dialog} className={className} data-open={open} aria-label={label}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onMouseDown={event => {
      if (event.target !== event.currentTarget) return;
      // With reduced motion, cleanup can restore the trigger before this
      // mousedown's native focus action. Do not let that later action steal it.
      event.preventDefault(); onDismiss();
    }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'))
        .filter(node => node.tabIndex >= 0 && !node.closest("[inert]") && node.getClientRects().length > 0);
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>{children}</dialog>;
}
