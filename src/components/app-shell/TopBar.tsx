"use client";

import Link from "next/link";
import { PanelIcon, SearchIcon } from "@/components/icons";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
  onOpenHome: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  surfaceOpen: boolean;
  onToggleSurface: () => void;
  profileMenu: React.ReactNode;
};

/**
 * The common wayfinder shared by the front door and every purpose-built app.
 * It's deliberately spare: a path home, the workspace-panel toggle, and the
 * command palette that switches surfaces (⌘⇧P). Workspace context
 * (project · worktree · target org) now lives in the persistent bottom status
 * bar, and the agent stands as its own panel, so the top bar is left to
 * answer just one question — "where do you want to go?"
 */
export function TopBar({ onOpenPalette, onOpenHome, panelOpen, onTogglePanel, surfaceOpen, onToggleSurface, profileMenu }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button
          type="button"
          id="workspace-panel-toggle"
          className={`${styles.panelToggle} ${panelOpen ? styles.panelToggleActive : ""}`}
          onClick={onTogglePanel}
          aria-controls="workspace-panel"
          aria-expanded={panelOpen}
          aria-pressed={panelOpen}
          aria-label="Toggle workspace panel"
          aria-keyshortcuts="Meta+B Control+B"
          title="Toggle workspace panel (⌘B)"
        >
          <PanelIcon width={16} height={16} />
        </button>

        <Link href="/" scroll={false} onNavigate={onOpenHome} className={styles.homeLink} aria-label="Unified Platform home">
          <span className={styles.logo} aria-hidden="true">
            U
          </span>
          <span className={styles.brandName}>Unified Platform</span>
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
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.helpButton} aria-label="Help">
          ?
        </button>
        {profileMenu}
        <button
          type="button"
          id="surface-panel-toggle"
          className={`${styles.panelToggle} ${surfaceOpen ? styles.panelToggleActive : ""}`}
          onClick={onToggleSurface}
          aria-controls="surface-panel"
          aria-expanded={surfaceOpen}
          aria-pressed={surfaceOpen}
          aria-label={surfaceOpen ? "Hide surfaces" : "Show surfaces"}
          aria-keyshortcuts="Meta+Shift+B Control+Shift+B"
          title={surfaceOpen ? "Hide surfaces (⌘⇧B)" : "Show surfaces (⌘⇧B)"}
        >
          <PanelIcon className={styles.rightPanelIcon} width={16} height={16} />
        </button>
      </div>
    </header>
  );
}
