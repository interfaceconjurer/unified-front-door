"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, DatabaseIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { Org, OrgKind } from "@/lib/workspace/model";
import styles from "./StatusBar.module.css";

const ORG_KIND_LABEL: Record<OrgKind, string> = {
  devhub: "Dev Hub",
  scratch: "Scratch",
  sandbox: "Sandbox",
  production: "Production",
};

function orgStatusText(org: Org): string | null {
  if (org.connection === "expired") return "Expired";
  if (org.kind === "scratch" && org.expiresInDays != null) return `${org.expiresInDays}d left`;
  return null;
}

type OpenPopover = null | "project" | "org";

/**
 * Persistent bottom status bar — the home for ambient global state that must stay
 * visible across every surface. Today it carries the workspace context (project ·
 * worktree · target org); the org especially lives here because "which org am I
 * pointed at" is risk-bearing and should never be hidden behind a palette. It's
 * also the container for future global concerns (session count, connection,
 * notifications). Chips open popovers to switch; worktree is display-only here
 * (switching lives in the Code surface).
 */
export function StatusBar() {
  const {
    projects,
    orgs,
    activeProject,
    activeWorktree,
    activeOrg,
    setActiveProject,
    setActiveOrg,
  } = useWorkspace();
  const [open, setOpen] = useState<OpenPopover>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const showWorktree = activeProject.worktrees.length > 1;

  // Dismiss the open popover on an outside click or Escape. Subscribing to
  // document events is the sanctioned effect use; state changes only in callbacks.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <footer className={styles.bar} ref={rootRef}>
      <div className={styles.cluster}>
        <div className={styles.chipWrap}>
          <button
            type="button"
            className={styles.chip}
            aria-haspopup="menu"
            aria-expanded={open === "project"}
            onClick={() => setOpen((current) => (current === "project" ? null : "project"))}
          >
            <LayersIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeProject.name}</span>
          </button>

          {open === "project" && (
            <div className={styles.popover} role="menu">
              <p className={styles.popoverTitle}>Projects</p>
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={project.id === activeProject.id}
                  className={styles.option}
                  onClick={() => {
                    setActiveProject(project.id);
                    setOpen(null);
                  }}
                >
                  <span className={styles.optionCheck} aria-hidden="true">
                    {project.id === activeProject.id && <CheckIcon width={15} height={15} />}
                  </span>
                  <span className={styles.optionCopy}>
                    <span className={styles.optionLabel}>{project.name}</span>
                    <span className={styles.optionSub}>{project.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {showWorktree && (
          <span className={`${styles.chip} ${styles.static}`} title="Worktree (switch in Code)">
            <GitBranchIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeWorktree.label}</span>
          </span>
        )}
      </div>

      <div className={styles.cluster}>
        <div className={styles.chipWrap}>
          <button
            type="button"
            className={`${styles.chip} ${styles.orgChip} ${styles[activeOrg.kind]}`}
            aria-haspopup="menu"
            aria-expanded={open === "org"}
            onClick={() => setOpen((current) => (current === "org" ? null : "org"))}
          >
            <span className={styles.orgDot} aria-hidden="true" />
            <DatabaseIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeOrg.label}</span>
          </button>

          {open === "org" && (
            <div className={`${styles.popover} ${styles.popoverRight}`} role="menu">
              <p className={styles.popoverTitle}>
                Target org
                <span className={styles.popoverHint}>for {activeProject.name}</span>
              </p>
              {orgs.map((org) => {
                const status = orgStatusText(org);
                return (
                  <button
                    key={org.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={org.id === activeOrg.id}
                    className={`${styles.option} ${styles[org.kind]}`}
                    onClick={() => {
                      setActiveOrg(org.id);
                      setOpen(null);
                    }}
                  >
                    <span className={styles.optionCheck} aria-hidden="true">
                      {org.id === activeOrg.id && <CheckIcon width={15} height={15} />}
                    </span>
                    <span className={styles.orgDot} aria-hidden="true" />
                    <span className={styles.optionCopy}>
                      <span className={styles.optionLabel}>{org.label}</span>
                      <span className={styles.optionSub}>{ORG_KIND_LABEL[org.kind]}</span>
                    </span>
                    {status && (
                      <span
                        className={`${styles.orgStatus} ${
                          org.connection === "expired" ? styles.orgStatusBad : ""
                        }`}
                      >
                        {status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
