"use client";

import { useRef, type RefObject } from "react";
import { surfaceApps } from "@/components/front-door/app-catalog";
import { CheckIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import type { SurfaceId } from "@/lib/workspace/model";
import styles from "./SurfaceSwitcherMenu.module.css";

/** The native popover escapes the scrolling tab strip and owns light dismissal. */
export function SurfaceSwitcherMenu({ id, surfaceId, menuRef, triggerRef, onOpenChange, onSelect }: {
  id: string;
  surfaceId: SurfaceId;
  menuRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onSelect: (surface: SurfaceId) => void;
}) {
  const { profile } = useDemoProfile();
  const surfaces = surfaceApps.filter(surface => profile?.surfaceAccess.includes(surface.id));
  const items = useRef(new Map<SurfaceId, HTMLButtonElement>());
  function close() {
    menuRef.current?.hidePopover();
    triggerRef.current?.focus({ preventScroll: true });
  }

  return <div id={id} ref={menuRef} popover="auto" role="menu" aria-label="Switch surface"
    className={styles.menu}
    onToggle={event => {
      const open = event.newState === "open";
      onOpenChange(open);
      if (open) items.current.get(surfaceId)?.focus({ preventScroll: true });
    }}
    onKeyDown={event => {
      const index = surfaces.findIndex(surface => items.current.get(surface.id) === document.activeElement);
      let next: number;
      if (event.key === "ArrowDown") next = (index + 1) % surfaces.length;
      else if (event.key === "ArrowUp") next = (index - 1 + surfaces.length) % surfaces.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = surfaces.length - 1;
      else if (event.key === "Escape" || event.key === "Tab") {
        // Let Tab continue out of the trigger's normal position in the tab order.
        if (event.key === "Escape") event.preventDefault();
        close();
        return;
      } else return;
      event.preventDefault();
      const nextSurface = surfaces[next];
      if (nextSurface) items.current.get(nextSurface.id)?.focus();
    }}>
    {surfaces.map(surface => <button key={surface.id} type="button" role="menuitemradio"
      aria-checked={surface.id === surfaceId} tabIndex={-1}
      ref={node => { if (node) items.current.set(surface.id, node); else items.current.delete(surface.id); }}
      onClick={() => { close(); onSelect(surface.id); }}>
      <surface.Icon width={17} height={17} aria-hidden="true" />
      <span>{surface.label}</span>
      {surface.id === surfaceId && <CheckIcon className={styles.check} width={16} height={16} aria-hidden="true" />}
    </button>)}
  </div>;
}
