"use client";

import Link from "next/link";
import { PanelIcon, SearchIcon } from "@/components/icons";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
};

/**
 * The common wayfinder shared by the front door and every purpose-built app.
 * It's deliberately spare: a path home, the workspace-panel toggle, and the
 * command palette that switches surfaces (⌘⇧P). Workspace context
 * (project · worktree · target org) now lives in the persistent bottom status
 * bar, and the agent stands as its own panel, so the top bar is left to
 * answer just one question — "where do you want to go?"
 */
export function TopBar({ onOpenPalette, panelOpen, onTogglePanel }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link href="/" className={styles.homeLink} aria-label="Unified Platform home">
          <span className={styles.logo} aria-hidden="true">
            U
          </span>
          <span className={styles.brandName}>Unified Platform</span>
        </Link>

        <button
          type="button"
          className={`${styles.panelToggle} ${panelOpen ? styles.panelToggleActive : ""}`}
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-pressed={panelOpen}
          aria-label="Toggle workspace panel"
          aria-keyshortcuts="Meta+B Control+B"
          title="Toggle workspace panel (⌘B)"
        >
          <PanelIcon width={16} height={16} />
        </button>

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
