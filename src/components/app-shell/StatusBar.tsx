"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon, DatabaseIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
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

type OpenPopover = null | "org";

/**
 * Persistent bottom status bar — the home for ambient global state that must stay
 * visible across every surface. Today it carries the workspace context (project ·
 * worktree · target org); the org especially lives here because "which org am I
 * pointed at" is risk-bearing and should never be hidden behind a popover. Project
 * switching now lives in the command palette (⌘⇧P), so the project chip here is a
 * pure readout, same as the worktree chip; only the org chip still opens a popover.
 */
export function StatusBar() {
  const { orgs, activeProject, activeWorktree, activeOrg, setActiveOrg, hasProjects } = useWorkspace();
  const [open, setOpen] = useState<OpenPopover>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const connectedOrgs = orgs.filter((org) => org.connection === "connected");
  const showWorktree = hasProjects && activeProject.worktrees.length > 1;

  // Dismiss the open popover on an outside click or Escape. Subscribing to
  // document events is the sanctioned effect use; state changes only in callbacks.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(null);
        triggerRef.current?.focus();
      } else if (event.key === "Tab") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    if (!options.length) return;
    const index = options.findIndex((option) => option === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }

  return (
    <footer className={styles.bar}>
      <div className={styles.cluster}>
        <span
          className={`${styles.chip} ${styles.static}`}
          title={hasProjects ? `${activeProject.name} (switch in ⌘⇧P)` : undefined}
        >
          <LayersIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
          <span className={styles.chipLabel}>{hasProjects ? activeProject.name : "No project selected"}</span>
        </span>

        {showWorktree && (
          <span className={`${styles.chip} ${styles.static}`} title="Worktree (switch in Code)">
            <GitBranchIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeWorktree.label}</span>
          </span>
        )}
      </div>

      <div className={`${styles.cluster} ${styles.orgCluster}`}>
        <div className={styles.chipWrap} ref={rootRef}>
          <button
            ref={triggerRef}
            type="button"
            className={`${styles.chip} ${styles.orgChip} ${styles[activeOrg.kind]}`}
            aria-haspopup="menu"
            aria-label={`Switch org, current org: ${activeOrg.label}`}
            aria-expanded={open === "org"}
            aria-controls={open === "org" ? "connected-orgs-menu" : undefined}
            onClick={() => setOpen((current) => (current === "org" ? null : "org"))}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen("org");
              }
            }}
          >
            <span className={styles.orgDot} aria-hidden="true" />
            <DatabaseIcon className={styles.chipIcon} width={14} height={14} aria-hidden="true" />
            <span className={styles.chipLabel}>{activeOrg.label}</span>
            <ChevronRightIcon className={styles.orgChevron} width={12} height={12} aria-hidden="true" />
          </button>

          {open === "org" && (
            <div id="connected-orgs-menu" ref={menuRef} className={`${styles.popover} ${styles.popoverRight}`} role="menu" aria-label="Connected orgs" onKeyDown={onMenuKeyDown}>
              <p className={styles.popoverTitle}>
                Connected orgs
                <span className={styles.popoverHint}>{connectedOrgs.length}</span>
              </p>
              <p className={styles.connectionHint}>Available from your login</p>
              {connectedOrgs.map((org) => {
                const status = orgStatusText(org);
                return (
                  <button
                    key={org.id}
                    type="button"
                    role="menuitemradio"
                    tabIndex={-1}
                    aria-checked={org.id === activeOrg.id}
                    className={`${styles.option} ${styles[org.kind]}`}
                    onClick={() => {
                      setActiveOrg(org.id);
                      setOpen(null);
                      triggerRef.current?.focus();
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
