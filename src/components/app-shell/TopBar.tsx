"use client";

import type { Ref } from "react";
import Link from "next/link";
import { PanelIcon, SearchIcon, WorkflowIcon } from "@/components/icons";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  workspaceToggleRef: Ref<HTMLButtonElement>;
  artifactLabel?: string;
  focusAvailable: boolean;
  focusActive: boolean;
  onToggleFocus: () => void;
};

/** Common wayfinding plus the current artifact and explicit Focus control. */
export function TopBar({
  onOpenPalette,
  panelOpen,
  onTogglePanel,
  workspaceToggleRef,
  artifactLabel,
  focusAvailable,
  focusActive,
  onToggleFocus,
}: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link href="/" className={styles.homeLink} aria-label="Front Door home">
          <span className={styles.logo} aria-hidden="true">
            U
          </span>
          <span className={styles.brandName}>Front Door</span>
        </Link>

        <button
          ref={workspaceToggleRef}
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

        {artifactLabel && (
          <div className={styles.artifactContext} aria-label={`Current Flow: ${artifactLabel}`}>
            <WorkflowIcon width={15} height={15} aria-hidden="true" />
            <span>Flow</span>
            <span className={styles.artifactSeparator} aria-hidden="true">
              /
            </span>
            <strong>{artifactLabel}</strong>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {focusAvailable && (
          <button
            type="button"
            className={`${styles.focusButton} ${focusActive ? styles.focusButtonActive : ""}`}
            onClick={onToggleFocus}
            aria-pressed={focusActive}
            aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
          >
            {focusActive ? "Exit focus" : "Focus"}
            <kbd>⌘⇧F</kbd>
          </button>
        )}
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
