"use client";

import type { Ref } from "react";
import Link from "next/link";
import { PanelIcon, SearchIcon } from "@/components/icons";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  workspaceToggleRef: Ref<HTMLButtonElement>;
  canvasLabel?: string;
  onNewChat: () => void;
  onShowWork: () => void;
  homeActive: boolean;
};

export function TopBar({ onOpenPalette, panelOpen, onTogglePanel, workspaceToggleRef, canvasLabel, onNewChat, onShowWork, homeActive }: TopBarProps) {
  return (
    <header className={`${styles.bar} ${homeActive ? styles.homeBar : ""}`}>
      <div className={styles.left}>
        <Link href="/" className={styles.homeLink} aria-label="Platform home"><span className={styles.logo} aria-hidden="true">U</span><span className={styles.brandName}>Platform</span></Link>
        <button ref={workspaceToggleRef} type="button" className={`${styles.panelToggle} ${panelOpen ? styles.panelToggleActive : ""}`} onClick={onTogglePanel} aria-expanded={panelOpen} aria-pressed={panelOpen} aria-label="Toggle workspace panel" aria-keyshortcuts="Meta+B Control+B" title="Toggle workspace panel (⌘B)"><PanelIcon width={16} height={16} /></button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={styles.commandTrigger} onClick={onOpenPalette} aria-label="Search capabilities and work" aria-keyshortcuts="Meta+Shift+P Control+Shift+P"><SearchIcon className={styles.commandIcon} width={16} height={16} /><span className={styles.commandLabel}>Search</span><kbd className={styles.commandKbd}>⌘⇧P</kbd></button>
        {canvasLabel && <div className={styles.artifactContext} aria-label={`Current canvas: ${canvasLabel}`}><span>Canvas</span><span className={styles.artifactSeparator} aria-hidden="true">/</span><strong>{canvasLabel}</strong></div>}
      </div>
      <nav className={styles.primaryNav} aria-label="Primary navigation">
        <Link href="/" onClick={onNewChat}>New Chat</Link>
        <button type="button" onClick={onShowWork}>Work</button>
        <Link href="/?fixture=returning" onClick={onShowWork}>Projects</Link>
      </nav>
      <div className={styles.actions}><button type="button" className={styles.helpButton} aria-label="Help">?</button><button type="button" className={styles.avatar} aria-label="User profile">JW</button></div>
    </header>
  );
}
