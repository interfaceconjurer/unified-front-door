"use client";

import { type CSSProperties } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { useCanvas } from "@/components/canvas/canvas-context";
import { navItems, type NavItem } from "./nav-items";
import styles from "./LeftNav.module.css";

type LeftNavProps = {
  almMode: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

/**
 * Collapsible left rail. Expanded shows icon + label; collapsed shows the icon
 * alone, with the label preserved as the link's accessible name and tooltip.
 *
 * The ALM items (Trust / Work Items / Pipelines / Testing) are top-level rows,
 * level with everything else — not nested under Projects. They stay mounted and
 * each collapses to zero height when ALM mode is off, so the rail can animate
 * them in (cascading open, staggered by position) and out (collapsing together).
 * See LeftNav.module.css. While hidden they're pulled from the tab order and
 * from assistive tech.
 *
 * Clicking an item opens (or focuses) its canvas; the highlight follows the
 * active canvas, so switching tabs in the canvas area updates the rail too. A
 * canvas with no matching nav item (e.g. a project tab) highlights nothing. An
 * active ALM canvas with ALM mode off still marks its row current — the row is
 * just hidden, so the highlight rides along out of view until the mode returns.
 */
export function LeftNav({ almMode, collapsed, onToggleCollapse }: LeftNavProps) {
  const { activeId, openCanvas } = useCanvas();

  // Stagger index within the ALM group (0-based), for the cascade-open delay.
  const almOrder = navItems.filter((n) => n.alm).map((n) => n.id);

  const renderLink = (item: NavItem, hidden: boolean) => {
    const isActive = item.id === activeId;
    return (
      <a
        href={item.href}
        className={styles.link}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        data-active={isActive || undefined}
        tabIndex={hidden ? -1 : undefined}
        onClick={(e) => {
          e.preventDefault();
          openCanvas(item.id);
        }}
      >
        <span className={styles.icon}>
          <item.Icon />
        </span>
        <span className={styles.label}>{item.label}</span>
      </a>
    );
  };

  return (
    <nav
      className={`${styles.nav} ${collapsed ? styles.collapsed : ""}`}
      aria-label="Primary"
      data-collapsed={collapsed || undefined}
    >
      <ul className={styles.list}>
        {navItems.map((item) =>
          item.alm ? (
            <li
              key={item.id}
              className={styles.almRow}
              data-open={almMode || undefined}
              aria-hidden={!almMode || undefined}
              style={{ "--alm-index": almOrder.indexOf(item.id) } as CSSProperties}
            >
              <div className={styles.almRowInner}>{renderLink(item, !almMode)}</div>
            </li>
          ) : (
            <li key={item.id}>{renderLink(item, false)}</li>
          ),
        )}
      </ul>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className={`${styles.icon} ${styles.chevron}`}>
            <ChevronLeftIcon />
          </span>
          <span className={styles.label}>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
