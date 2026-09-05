"use client";

import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { type SurfaceApp } from "@/components/front-door/app-catalog";
import styles from "./TopBar.module.css";

type TopBarProps = {
  currentApp: SurfaceApp | undefined;
  onOpenPalette: () => void;
};

/**
 * The common wayfinder shared by the front door and every purpose-built app.
 * It always provides a direct path home, the command palette that switches
 * surfaces (⌘⇧P), and the current location. The agent no longer lives here — it
 * stands as a persistent panel — so the bar stays focused on navigation.
 */
export function TopBar({ currentApp, onOpenPalette }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link href="/" className={styles.homeLink} aria-label="Front Door home">
          <span className={styles.logo} aria-hidden="true">
            U
          </span>
          <span className={styles.brandName}>Front Door</span>
        </Link>

        <span className={styles.divider} aria-hidden="true" />

        <button
          type="button"
          className={styles.commandTrigger}
          onClick={onOpenPalette}
          aria-label="Go to a surface"
          aria-keyshortcuts="Meta+Shift+P Control+Shift+P"
        >
          <SearchIcon className={styles.commandIcon} width={16} height={16} />
          <span className={styles.commandLabel}>Go to…</span>
          <kbd className={styles.commandKbd}>⌘⇧P</kbd>
        </button>

        <div className={styles.location} aria-label="Current location">
          <span className={styles.locationSeparator} aria-hidden="true">
            /
          </span>
          {currentApp ? (
            <>
              <span className={styles.appName}>{currentApp.label}</span>
              <span className={styles.locationSeparator} aria-hidden="true">
                /
              </span>
              <span className={styles.pageName}>Overview</span>
            </>
          ) : (
            <span className={styles.pageName}>Home</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.helpButton} aria-label="Help">
          ?
        </button>
        <button type="button" className={styles.avatar} aria-label="User profile">
          JW
        </button>
      </div>
    </header>
  );
}
