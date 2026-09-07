"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, LayersIcon, SearchIcon, type IconComponent } from "@/components/icons";
import { surfaceAppById, surfaceApps } from "@/components/front-door/app-catalog";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { AgentSessionStatus } from "@/lib/workspace/model";
import { allSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import styles from "./CommandPalette.module.css";

type Destination = {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: IconComponent;
};

// The front door plus every surface, as jump targets. This is the same set the
// old top-bar <select> offered, now reachable from a Spotlight-style palette.
const DESTINATIONS: readonly Destination[] = [
  {
    id: "home",
    label: "Front Door",
    description: "Start from an outcome and let the agent route you.",
    href: "/",
    Icon: HomeIcon,
  },
  ...surfaceApps.map((surface) => ({
    id: surface.id,
    label: surface.label,
    description: surface.description,
    href: surface.href,
    Icon: surface.Icon,
  })),
];

type Tab = "surfaces" | "projects" | "sessions";

const TAB_ORDER: readonly Tab[] = ["surfaces", "projects", "sessions"];
const TAB_LABEL: Record<Tab, string> = {
  surfaces: "Surfaces",
  projects: "Projects",
  sessions: "Sessions",
};
const TAB_PLACEHOLDER: Record<Tab, string> = {
  surfaces: "Search surfaces…",
  projects: "Search projects…",
  sessions: "Search sessions…",
};
// What ↵ does, in this tab's own vocabulary — surfaces "open" (navigate),
// projects "switch" (re-point context, stay put), sessions "go" (teleport).
const TAB_ENTER_HINT: Record<Tab, string> = { surfaces: "open", projects: "switch", sessions: "go" };

// A row in the results list, normalized across tabs so keyboard nav and
// rendering don't need to branch on which tab built it — only on which
// *optional* fields a given row happens to carry. `status` swaps the icon
// slot for a status dot (and adds a status chip); `indent` nests a worktree
// under its project. Surfaces navigate; projects/worktrees re-project the
// current surface in place; sessions teleport to where the agent works.
type PaletteItem = {
  id: string;
  label: string;
  description: string;
  Icon?: IconComponent;
  isCurrent: boolean;
  select: () => void;
  /** Nested one level under its parent project (a worktree row). */
  indent?: boolean;
  /** The last worktree under its project — draws the tree guide as └ (a
   *  corner that stops at this row) rather than ├ (a line continuing down). */
  lastChild?: boolean;
  /** Present on worktree/session rows; renders a status dot + chip instead
   *  of (resp. alongside) the plain icon/current-tag treatment. */
  status?: AgentSessionStatus;
};

/**
 * A Spotlight/Raycast-style command palette for switching what you're looking
 * at. Opened with ⌘⇧P (the shell owns the shortcut and only mounts this while
 * open, so its state starts fresh each time), it overlays a search box over
 * the whole app. Three tabs:
 *  - Surfaces — the purpose-built destinations; picking one navigates.
 *  - Projects — the shell-level workspace noun; picking a project calls
 *    `setActiveProject` and re-projects the current surface instead of
 *    navigating. Multi-worktree projects list their worktrees inline and
 *    indented, each with a status dot from that worktree's agent session;
 *    picking a worktree additionally calls `setActiveWorktree` — still no
 *    navigation, because switching what you're working on is a re-point, not
 *    a trip.
 *  - Sessions — every agent session across every project, globally, sorted
 *    waiting → working → idle so the thing that needs you most sorts first.
 *    Picking one sets the project + worktree AND navigates to the Code
 *    surface (v1 read of "where the agent is working" — see plan.md), because
 *    unlike Projects, a session is something you're jumping *to*.
 * Type to filter within the active tab, ↑/↓ to move, ←/→ to switch tabs, ↵ to
 * select, esc to dismiss.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree } =
    useWorkspace();
  const [tab, setTab] = useState<Tab>("surfaces");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (...parts: string[]) =>
      !q || parts.some((part) => part.toLowerCase().includes(q));

    if (tab === "surfaces") {
      return DESTINATIONS.filter((d) => matchesQuery(d.label, d.description)).map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        Icon: d.Icon,
        isCurrent: d.href === pathname,
        select: () => {
          onClose();
          if (d.href !== pathname) router.push(d.href);
        },
      }));
    }

    if (tab === "projects") {
      const rows: PaletteItem[] = [];
      for (const { project, worktrees } of buildProjectTree(projects)) {
        const projectMatches = matchesQuery(project.name, project.description);
        // A worktree stays visible if it matches on its own, or if its
        // project matched (in which case all of a matching project's
        // worktrees show, same as the unfiltered case) — so searching
        // "hotfix" surfaces just that worktree, still under its project for
        // context, while searching "trailblazer" surfaces every worktree.
        // `lastChild` is re-derived against this filtered list (not the
        // shared derivation's unfiltered one), since the tree guide's corner
        // has to land on the last row actually on screen.
        const matchingWorktrees = worktrees.filter(
          ({ worktree }) => projectMatches || matchesQuery(worktree.label, worktree.branch),
        );

        if (projectMatches || matchingWorktrees.length > 0) {
          rows.push({
            id: project.id,
            label: project.name,
            description: project.description,
            Icon: LayersIcon,
            isCurrent: project.id === activeProject.id,
            // Project is shell-level, not a route — switch it in place and stay put.
            select: () => {
              setActiveProject(project.id);
              onClose();
            },
          });
        }

        matchingWorktrees.forEach(({ worktree, status }, worktreeIndex) => {
          rows.push({
            id: `${project.id}::${worktree.id}`,
            label: worktree.label,
            description: worktree.branch,
            isCurrent: project.id === activeProject.id && worktree.id === activeWorktree.id,
            indent: true,
            lastChild: worktreeIndex === matchingWorktrees.length - 1,
            status,
            // Still shell-level — switching worktree re-points the agent
            // session in place, same "stay put" contract as the project row.
            // Pass project.id explicitly: setActiveProject above doesn't take
            // effect until the next render, so setActiveWorktree's own default
            // (the *current* activeProject) would target the wrong project
            // when picking a worktree in a project that isn't active yet.
            select: () => {
              setActiveProject(project.id);
              setActiveWorktree(worktree.id, project.id);
              onClose();
            },
          });
        });
      }
      return rows;
    }

    // tab === "sessions": every session, across every project, flattened for
    // global triage — `allSessionRows` already sorts waiting → working → idle.
    const codeHref = surfaceAppById("code").href;
    return allSessionRows(projects)
      .filter(({ project, worktree, session }) =>
        matchesQuery(project.name, worktree.label, worktree.branch, session.summary, STATUS_LABEL[session.status]),
      )
      .map(({ project, worktree, session }) => ({
        id: `${project.id}::${worktree.id}`,
        label: worktree.label,
        description: `${project.name} · ${worktree.branch} — ${session.summary}`,
        isCurrent: project.id === activeProject.id && worktree.id === activeWorktree.id,
        status: session.status,
        // A session is somewhere to jump TO — unlike Projects, this teleports.
        // Sessions are the primary case for jumping into a project that isn't
        // active yet, so the explicit project.id here (see the worktree-row
        // select above for why) is load-bearing, not defensive.
        select: () => {
          setActiveProject(project.id);
          setActiveWorktree(worktree.id, project.id);
          onClose();
          if (pathname !== codeHref) router.push(codeHref);
        },
      }));
  }, [
    tab,
    query,
    pathname,
    projects,
    activeProject.id,
    activeWorktree.id,
    router,
    onClose,
    setActiveProject,
    setActiveWorktree,
  ]);

  // Derived, not stored: `active` can point past the end after filtering or a
  // tab switch, so we clamp it here rather than correcting state in an effect.
  const safeActive = items.length ? Math.min(active, items.length - 1) : 0;

  function switchTab(next: Tab) {
    setTab(next);
    setActive(0);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(items.length ? (safeActive + 1) % items.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(items.length ? (safeActive - 1 + items.length) % items.length : 0);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Horizontal caret movement isn't meaningful in a single-line filter, so
      // ←/→ switch tabs instead — but only when there's actually a tab to move
      // to, so a stray ArrowLeft/Right at the edge doesn't eat the keystroke.
      const currentIndex = TAB_ORDER.indexOf(tab);
      const nextIndex = event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab) {
        event.preventDefault();
        switchTab(nextTab);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[safeActive]?.select();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        // Dismiss only on backdrop clicks, not clicks that start inside the panel.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Switch surfaces, projects, or sessions"
      >
        <div className={styles.tabs} role="tablist" aria-label="Palette section">
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              className={`${styles.tab} ${t === tab ? styles.tabActive : ""}`}
              // Prevent the mousedown from moving DOM focus onto this button —
              // the ↑/↓/↵/←/→ handler lives on the search input, so a mouse
              // click on a tab would otherwise strand focus here and kill
              // keyboard nav until the user clicks back into the input.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => switchTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div className={styles.searchRow}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            // The palette exists only to receive typing; focus it on mount.
            autoFocus
            className={styles.input}
            type="text"
            placeholder={TAB_PLACEHOLDER[tab]}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={items[safeActive] ? `cmd-${tab}-${items[safeActive].id}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        <ul className={styles.results} id="command-palette-results" role="listbox">
          {items.length === 0 && (
            <li className={styles.empty}>
              No {tab} match “{query}”.
            </li>
          )}
          {items.map((item, index) => {
            const isActive = index === safeActive;
            return (
              <li key={item.id} role="option" id={`cmd-${tab}-${item.id}`} aria-selected={isActive}>
                <button
                  type="button"
                  className={`${styles.result} ${isActive ? styles.resultActive : ""} ${
                    item.indent ? styles.resultIndent : ""
                  } ${item.lastChild ? styles.resultLastChild : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => item.select()}
                >
                  <span
                    className={`${styles.resultIcon} ${item.status ? styles.resultIconPlain : ""}`}
                    aria-hidden="true"
                  >
                    {item.status ? (
                      <StatusDot status={item.status} />
                    ) : (
                      item.Icon && <item.Icon width={18} height={18} />
                    )}
                  </span>
                  <span className={styles.resultCopy}>
                    <span className={styles.resultLabel}>{item.label}</span>
                    <span className={styles.resultDescription}>{item.description}</span>
                  </span>
                  <span className={styles.resultTrailing}>
                    {item.status && (
                      <span className={`${styles.statusLabel} ${styles[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    )}
                    {item.isCurrent && <span className={styles.currentTag}>Current</span>}
                    {!item.status && !item.isCurrent && isActive && (
                      <span className={styles.enterHint} aria-hidden="true">
                        ↵
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className={styles.footer}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> switch tabs
          </span>
          <span>
            <kbd>↵</kbd> {TAB_ENTER_HINT[tab]}
          </span>
          <span>
            <kbd>esc</kbd> dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
