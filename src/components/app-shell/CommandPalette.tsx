"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DatabaseIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import { useSurfaceCanvases } from "@/components/surfaces/surface-canvas-context";
import { OVERVIEW_CANVAS_ID } from "@/lib/surface-canvas/model";
import { surfaceAppById, surfaceAppForPath, surfaceApps } from "@/components/front-door/app-catalog";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface } from "@/lib/demo-profiles";
import type { AgentSessionStatus, OrgKind } from "@/lib/workspace/model";
import { allSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import styles from "./CommandPalette.module.css";
import orgStyles from "@/components/workspace/OrgKind.module.css";

type Destination = {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: IconComponent;
};

// The front door plus every surface, as jump targets. This is the same set the
// old top-bar <select> offered, now reachable from a Spotlight-style palette.
const HOME_DESTINATION: Destination = {
  id: "home",
  label: "Front Door",
  description: "Start from an outcome and let the agent route you.",
  href: "/",
  Icon: HomeIcon,
};

export type CommandPaletteTab = "surfaces" | "projects" | "sessions" | "orgs";
type Tab = CommandPaletteTab;

const TAB_ORDER: readonly Tab[] = ["surfaces", "projects", "sessions", "orgs"];
const TAB_LABEL: Record<Tab, string> = {
  surfaces: "Surfaces",
  projects: "Projects",
  sessions: "Sessions",
  orgs: "Orgs",
};
const TAB_PLACEHOLDER: Record<Tab, string> = {
  surfaces: "Search surfaces…",
  projects: "Search projects…",
  sessions: "Search sessions…",
  orgs: "Search orgs…",
};
// What ↵ does, in this tab's own vocabulary — surfaces "open" (navigate),
// projects "switch" (re-point context, stay put), sessions "go" (teleport).
const TAB_ENTER_HINT: Record<Tab, string> = { surfaces: "open", projects: "switch", sessions: "go", orgs: "switch" };
const ORG_KIND_LABEL: Record<OrgKind, string> = {
  devhub: "Dev Hub",
  scratch: "Scratch",
  sandbox: "Sandbox",
  production: "Production",
};

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
  orgKind?: OrgKind;
};

// Stable ordering keeps all other destinations in their existing order.
const currentFirst = (a: PaletteItem, b: PaletteItem) => Number(b.isCurrent) - Number(a.isCurrent);

/**
 * A Spotlight/Raycast-style command palette for switching what you're looking
 * at. Opened with ⌘⇧P (the shell owns the shortcut and only mounts this while
 * open, so its state starts fresh each time), it overlays a search box over
 * the whole app. Four tabs:
 *  - Surfaces — the purpose-built destinations; picking one navigates.
 *  - Projects — the shell-level workspace noun; picking a project calls
 *    `setActiveProject` and re-projects the current surface instead of
 *    navigating. Multi-worktree projects list their worktrees inline and
 *    indented, each with a status dot from that worktree's agent session;
 *    picking a worktree additionally calls `setActiveWorktree` — still no
 *    navigation, because switching what you're working on is a re-point, not
 *    a trip.
 *  - Sessions — the current session first, then every other session across
 *    projects sorted waiting → working → idle.
 *    Picking one sets the project + worktree AND navigates to the Code
 *    surface (v1 read of "where the agent is working" — see plan.md), because
 *    unlike Projects, a session is something you're jumping *to*.
 *  - Orgs — connections available from login; picking one changes the target
 *    org without navigating or changing the assessment scope.
 * Each tab starts with the current destination highlighted, when it matches
 * the search. Type to filter, ↑/↓ to move, ←/→ to switch tabs, ↵ to
 * select, esc to dismiss.
 */
export function CommandPalette({ initialTab = "surfaces", open, onClose, onExited }: {
  initialTab?: CommandPaletteTab;
  open: boolean;
  onClose: (action?: () => void) => void;
  onExited: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useDemoProfile();
  const { setActiveCanvas, openCanvas } = useSurfaceCanvases("code");
  const currentSurfaceId = surfaceAppForPath(pathname)?.id;
  const { projects, activeProject, activeWorktree, setActiveProject, setActiveWorktree, hasProjects,
    orgs, activeOrg, setActiveOrg } =
    useWorkspace();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const paletteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    let cancelled = false;
    // Wait for the actual CSS transitions, including shortened reversals.
    // Reduced motion has no transitions, so dismissal completes immediately.
    const transitions = paletteRef.current?.getAnimations() ?? [];
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(() => {
      if (!cancelled) onExited();
    });
    return () => { cancelled = true; };
  }, [open, onExited]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (...parts: string[]) =>
      !q || parts.some((part) => part.toLowerCase().includes(q));

    if (tab === "surfaces") {
      const destinations = [
        HOME_DESTINATION,
        ...surfaceApps
          .filter((surface) => profile && canAccessSurface(profile, surface.id))
          .map((surface) => ({
            id: surface.id,
            label: surface.label,
            description: surface.description,
            href: surface.href,
            Icon: surface.Icon,
          })),
      ];
      return destinations.filter((d) => matchesQuery(d.label, d.description)).map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        Icon: d.Icon,
        isCurrent: d.id === (currentSurfaceId ?? "home"),
        select: () => {
          if (d.id !== (currentSurfaceId ?? "home")) router.push(d.href);
        },
      })).sort(currentFirst);
    }

    // Org connections exist before the user has created a project.
    if (tab === "orgs") {
      return orgs.filter((org) => org.connection === "connected").map((org) => ({
        id: org.id,
        label: org.label,
        description: [ORG_KIND_LABEL[org.kind], "Connected",
          ...(org.kind === "scratch" && org.expiresInDays != null ? [`${org.expiresInDays}d left`] : []),
        ].join(" · "),
        Icon: DatabaseIcon,
        orgKind: org.kind,
        isCurrent: org.id === activeOrg.id,
        select: () => {
          setActiveOrg(org.id);
        },
      })).filter((org) => matchesQuery(org.label, org.description)).sort(currentFirst);
    }

    if (!hasProjects) return [];

    if (tab === "projects") {
      const rows: PaletteItem[] = [];
      // Move whole project groups together so their children stay attached.
      const tree = buildProjectTree(projects).sort(
        (a, b) => Number(b.project.id === activeProject.id) - Number(a.project.id === activeProject.id),
      );
      for (const { project, base, children } of tree) {
        // The project row IS the project-on-main node: its title is the project
        // name and its subtitle is the primary worktree ("main"), so the two
        // read as one node (title + description), not a header with a separate
        // child. Search still matches the prose description even though it's no
        // longer shown. A feature child shows if it matches on its own, or if
        // its project matched (all of a matching project's worktrees show, same
        // as unfiltered) — so searching "hotfix" surfaces just that worktree
        // under its project for context, "trailblazer" surfaces every worktree.
        // Tree guides are re-derived after filtering and pinning the current
        // row, so each group ends at its last remaining child.
        const projectMatches = matchesQuery(
          project.name,
          project.description,
          base.worktree.label,
          base.worktree.branch,
        );
        const matchingChildren = children.filter(
          ({ worktree }) => projectMatches || matchesQuery(worktree.label, worktree.branch),
        );

        if (!(projectMatches || matchingChildren.length > 0)) continue;

        rows.push({
          id: project.id,
          label: project.name,
          // Subtitle = the primary branch, so the node reads as "project on main".
          description: base.worktree.label,
          Icon: LayersIcon,
          // Current only when the project is active AND on its primary worktree —
          // if a feature worktree is active, its own child row carries "Current".
          isCurrent: project.id === activeProject.id && base.worktree.id === activeWorktree.id,
          // Project is shell-level, not a route — switch it in place and stay put.
          // Selecting the node lands on main (its subtitle). Pass project.id
          // explicitly to setActiveWorktree: setActiveProject doesn't take effect
          // until the next render, so the setter's own default (the *current*
          // activeProject) would target the wrong project when the project isn't
          // active yet.
          select: () => {
            setActiveProject(project.id);
            setActiveWorktree(base.worktree.id, project.id);
            if (profile?.onboarding) {
              openCanvas("alm", { kind: "improvement-project", title: project.name, params: { projectId: project.id } });
              router.push("/alm");
              return;
            }
            if (currentSurfaceId) setActiveCanvas(currentSurfaceId, OVERVIEW_CANVAS_ID);
          },
        });

        matchingChildren.forEach(({ worktree, status }) => {
          const isCurrent = project.id === activeProject.id && worktree.id === activeWorktree.id;
          rows.push({
            id: `${project.id}::${worktree.id}`,
            label: worktree.label,
            // A pinned worktree stands alone above its project tree; include
            // the project name so it still has context without a parent row.
            description: isCurrent ? `${project.name} · ${worktree.branch}` : worktree.branch,
            isCurrent,
            indent: !isCurrent,
            status,
            select: () => {
              setActiveProject(project.id);
              setActiveWorktree(worktree.id, project.id);
              if (currentSurfaceId) setActiveCanvas(currentSurfaceId, OVERVIEW_CANVAS_ID);
            },
          });
        });
      }
      return rows.sort(currentFirst).map((row, index, ordered) =>
        row.indent ? { ...row, lastChild: !ordered[index + 1]?.indent } : row,
      );
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
          setActiveCanvas("code", OVERVIEW_CANVAS_ID);
          if (pathname !== codeHref) router.push(codeHref);
        },
      })).sort(currentFirst);
  }, [
    tab,
    query,
    pathname,
    profile,
    projects,
    hasProjects,
    openCanvas,
    activeProject.id,
    activeWorktree.id,
    router,
    setActiveProject,
    setActiveWorktree,
    setActiveCanvas,
    currentSurfaceId,
    orgs,
    activeOrg.id,
    setActiveOrg,
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
      const item = items[safeActive];
      if (item) onClose(item.select);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const showGuidedEmpty = !hasProjects && (tab === "projects" || tab === "sessions");

  function goToBuild() {
    onClose(() => router.push(profile?.onboarding ? "/" : surfaceAppById("build").href));
  }

  function startConversation() {
    onClose(() => {
      if (pathname === "/") {
        requestAnimationFrame(() => document.getElementById("agent-composer")?.focus());
      } else {
        router.push("/#agent-composer");
      }
    });
  }

  return (
    <div
      className={styles.overlay}
      data-open={open}
      role="presentation"
      onMouseDown={(event) => {
        // Dismiss only on backdrop clicks, not clicks that start inside the panel.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={paletteRef}
        className={styles.palette}
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Switch surfaces, projects, sessions, or orgs"
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
            ref={inputRef}
            // The palette exists only to receive typing; focus it on mount.
            autoFocus
            className={styles.input}
            type="text"
            placeholder={TAB_PLACEHOLDER[tab]}
            value={query}
            role={showGuidedEmpty ? "searchbox" : "combobox"}
            aria-expanded={showGuidedEmpty ? undefined : true}
            aria-controls={showGuidedEmpty ? undefined : "command-palette-results"}
            aria-activedescendant={items[safeActive] ? `cmd-${tab}-${items[safeActive].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        {showGuidedEmpty && (
          <div className={styles.guidedEmpty} id="command-palette-results" role="status">
            <strong>No {tab} yet</strong>
            <button type="button" onClick={tab === "projects" ? goToBuild : startConversation}>
              {tab === "projects" ? (
                <>
                  <PlusIcon width={15} height={15} aria-hidden="true" />
                  Start your first project
                </>
              ) : (
                <>
                  <SparklesIcon width={15} height={15} aria-hidden="true" />
                  Start a conversation
                </>
              )}
            </button>
          </div>
        )}

        {tab === "orgs" && (
          <p className={styles.contextHint}>
            Connected orgs · {orgs.filter((org) => org.connection === "connected").length} available from your login
          </p>
        )}

        {/* Reset scrolling with the results so the first selection is visible. */}
        {!showGuidedEmpty && <ul key={`${tab}:${query}`} className={styles.results} id="command-palette-results" role="listbox">
          {items.length === 0 && (
            <li className={styles.empty}>
              No {tab} match “{query}”.
            </li>
          )}
          {items.map((item, index) => {
            const isActive = index === safeActive;
            return (
              <li key={item.id} role="option" id={`cmd-${tab}-${item.id}`} aria-selected={isActive}
                className={item.orgKind ? orgStyles[item.orgKind] : undefined}>
                <button
                  type="button"
                  className={`${styles.result} ${isActive ? styles.resultActive : ""} ${
                    item.indent ? styles.resultIndent : ""
                  } ${item.lastChild ? styles.resultLastChild : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => onClose(item.select)}
                >
                  <span
                    className={`${styles.resultIcon} ${item.status ? styles.resultIconPlain : ""} ${item.orgKind ? styles.resultOrg : ""}`}
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
                    {item.description && (
                      <span className={styles.resultDescription}>{item.description}</span>
                    )}
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
        </ul>}

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
