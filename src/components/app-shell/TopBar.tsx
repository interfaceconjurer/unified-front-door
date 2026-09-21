"use client";

import Link from "next/link";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { ChevronRightIcon, EyeIcon, HomeIcon, LayersIcon, PanelIcon, SearchIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { previewCanvas } from "@/lib/preview/model";
import styles from "./TopBar.module.css";

type TopBarProps = {
  onOpenPalette: () => void;
  onOpenProjects: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  surfaceOpen: boolean;
  onToggleSurface: () => void;
  profileMenu: React.ReactNode;
};

/** Global search and current project scope stay visible on every surface. */
export function TopBar({ onOpenPalette, onOpenProjects, panelOpen, onTogglePanel, surfaceOpen, onToggleSurface, profileMenu }: TopBarProps) {
  const { navigateGlobalHome, globalHomeHref, openCanvas } = useNavigation();
  const { activeProject, activeWorktree, target, destination } = useWorkspace();
  const { profile } = useDemoProfile();
  const preview = activeProject && activeWorktree && profile?.surfaceAccess.includes("build")
    ? previewCanvas(activeProject.id, activeWorktree.id, target.orgId) : null;
  const previewOpen = destination.kind === "available" && destination.destination.canvas?.kind === "preview";
  return (
    <header className={styles.bar} data-project-scoped={!!activeProject}>
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

        <Link href={globalHomeHref} scroll={false} className={`${styles.panelToggle} ${styles.globalHome} ${!activeProject ? styles.globalHomeActive : ""}`}
          aria-current={!activeProject ? "location" : undefined}
          aria-label="Global home" title={activeProject ? "Leave project and go to global home" : "Global home"}
          onNavigate={event => { event.preventDefault(); navigateGlobalHome(); }}>
          <HomeIcon width={16} height={16} aria-hidden="true" />
        </Link>
        <Link href={globalHomeHref} scroll={false} onNavigate={(event) => { event.preventDefault(); navigateGlobalHome(); }} className={styles.homeLink} aria-label="Platform Studio home">
          <span className={styles.brandName}>Platform Studio</span>
        </Link>
        {activeProject && <>
          <span className={styles.divider} aria-hidden="true" />
          <button type="button" className={styles.projectScope} onClick={onOpenProjects} aria-haspopup="dialog"
            aria-label={`Switch project, current project: ${activeProject.name}${activeWorktree ? `, branch: ${activeWorktree.branch}` : ""}`}
            title={`${activeProject.name}${activeWorktree ? ` · ${activeWorktree.branch}` : ""}`}>
            <LayersIcon width={17} height={17} aria-hidden="true" />
            <span className={styles.projectCopy}><span className={styles.projectLabel}>Project{activeWorktree ? ` · ${activeWorktree.branch}` : ""}</span><strong>{activeProject.name}</strong></span>
            <ChevronRightIcon className={styles.projectChevron} width={13} height={13} aria-hidden="true" />
          </button>
        </>}
      </div>
        <button
          type="button"
          className={styles.commandTrigger}
          onClick={onOpenPalette}
          aria-label="Search workspace"
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+Shift+P Control+Shift+P"
        >
          <SearchIcon className={styles.commandIcon} width={16} height={16} />
          <span className={styles.commandLabel}>Search resources, projects, and more…</span>
          <span className={styles.commandLabelCompact}>Search or jump to…</span>
          <kbd className={styles.commandKbd}>⌘⇧P</kbd>
        </button>
      <div className={styles.actions}>
        {preview && <button type="button" className={styles.previewButton} aria-label="Preview project" aria-pressed={previewOpen}
          title={`Preview ${activeProject?.name} · ${activeWorktree?.branch}`} onClick={() => openCanvas("build", preview)}>
          <EyeIcon width={16} height={16} /><span>Preview</span>
        </button>}
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
