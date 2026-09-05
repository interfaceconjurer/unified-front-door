"use client";

import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { WorkspaceControls } from "./WorkspaceControls";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
};

/**
 * The common wayfinder shared by the front door and every purpose-built app.
 * It carries the workspace context (project + target org), a direct path home,
 * and the command palette that switches surfaces (⌘⇧P). The agent no longer
 * lives here — it stands as a persistent panel — and the current surface reads
 * off the agent header, so the bar stays focused on "what you're working on"
 * and "where to go."
 */
export function TopBar({ onOpenPalette }: TopBarProps) {
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

        <WorkspaceControls />

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
