"use client";

import type { SurfaceId } from "@/lib/workspace/model";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/interaction/Modal";
import { usePathname } from "next/navigation";
import {
  DatabaseIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import { surfaceAppForPath, surfaceApps } from "@/components/front-door/app-catalog";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface } from "@/lib/demo-profiles";
import type { AgentSessionStatus, OrgKind } from "@/lib/workspace/model";
import { allSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import { RESOURCE_TYPES, resourceKey, searchResources, type ResourceType } from "@/lib/org-resources/model";
import { resourcesForOrg } from "@/lib/org-resources/catalog";
import { SURFACES } from "@/lib/workspace/surfaces";
import { RESOURCE_ICONS } from "@/components/surfaces/resource-icons";
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

export type CommandPaletteTab = "surfaces" | "projects" | "sessions" | "orgs" | "resources";
type Tab = CommandPaletteTab;

const TAB_ORDER: readonly Tab[] = ["surfaces", "projects", "sessions", "orgs", "resources"];
const TAB_LABEL: Record<Tab, string> = {
  surfaces: "Surfaces",
  projects: "Projects",
  sessions: "Sessions",
  orgs: "Orgs",
  resources: "Resources",
};
const TAB_PLACEHOLDER: Record<Tab, string> = {
  surfaces: "Search surfaces…",
  projects: "Search projects…",
  sessions: "Search sessions…",
  orgs: "Search orgs…",
  resources: "Search resources…",
};
// What ↵ does, in this tab's own vocabulary — surfaces "open" (navigate),
// projects "switch" (re-point context, stay put), sessions "go" (teleport).
const TAB_ENTER_HINT: Record<Tab, string> = { surfaces: "open", projects: "switch", sessions: "go", orgs: "switch", resources: "open" };
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
  surfaceLabel?: string;
};

// Stable ordering keeps all other destinations in their existing order.
const currentFirst = (a: PaletteItem, b: PaletteItem) => Number(b.isCurrent) - Number(a.isCurrent);

/**
 * A Spotlight/Raycast-style command palette for switching what you're looking
 * at. Opened with ⌘⇧P (the shell owns the shortcut and only mounts this while
 * open, so its state starts fresh each time), it overlays a search box over
 * the whole app. Five tabs:
 *  - Surfaces — Front Door stays first, followed by the current surface;
 *    picking another destination navigates.
 *  - Projects — the shell-level workspace noun; picking a project calls
 *    `selectProject` and re-projects the current surface instead of
 *    navigating. Multi-worktree projects list their worktrees inline and
 *    indented, each with a status dot from that worktree's agent session;
 *    picking a worktree additionally calls `selectProject` — still no
 *    navigation, because switching what you're working on is a re-point, not
 *    a trip.
 *  - Sessions — the current session first, then every other session across
 *    projects sorted waiting → working → idle.
 *    Picking one sets the project + worktree AND navigates to the Code
 *    surface (v1 read of "where the agent is working" — see plan.md), because
 *    unlike Projects, a session is something you're jumping *to*.
 *  - Orgs — connections available from login; picking one changes the target
 *    org without navigating or changing the assessment scope.
 *  - Resources — browse a connected org's metadata and open its canvas.
 * Each tab starts with the current destination highlighted, when it matches
 * the search. Type to filter, ↑/↓ to move, ←/→ to switch focused tabs, ↵ to
 * select, esc to dismiss.
 */
export function CommandPalette({ initialTab = "surfaces", open, onClose, onExited }: {
  initialTab?: CommandPaletteTab;
  open: boolean;
  onClose: (action?: () => void) => void;
  onExited: () => void;
}) {
  const { navigateSurface, selectProject, selectOrg, openResource, openProjectCreation } = useNavigation();
  const pathname = usePathname();
  const { profile } = useDemoProfile();
  const currentSurfaceId = surfaceAppForPath(pathname)?.id;
  const { projects, activeProject, activeWorktree, hasProjects,
    orgs, activeOrg, destination } =
    useWorkspace();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const [resourceOrgId, setResourceOrgId] = useState(activeOrg?.id ?? "");
  const [resourceType, setResourceType] = useState<ResourceType | "all">("all");
  const currentCanvas = destination.kind === "available" ? destination.destination.canvas : undefined;
  const resourceInventory = useMemo(() => orgs.some(org => org.id === resourceOrgId && org.connection === "connected")
    ? resourcesForOrg(resourceOrgId).filter(resource => profile && canAccessSurface(profile, RESOURCE_TYPES[resource.resourceType].surface)) : [], [orgs, resourceOrgId, profile]);

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
          if (d.id !== (currentSurfaceId ?? "home")) navigateSurface(d.id === "home" ? null : d.id as SurfaceId);
        },
      })).sort((a, b) =>
        Number(b.id === "home") - Number(a.id === "home") || currentFirst(a, b),
      );
    }

    // Org connections exist before the user has created a project.
    if (tab === "orgs") {
      return orgs.filter((org) => org.connection === "connected").map((org) => ({
        id: org.id,
        label: org.label,
        description: [ORG_KIND_LABEL[org.kind], "Connected",
          ...(org.kind === "scratch" && org.expiresInDays != null ? [org.expiresInDays === 0 ? "Expired" : `At capture: ${org.expiresInDays} days remaining`] : []),
        ].join(" · "),
        Icon: DatabaseIcon,
        orgKind: org.kind,
        isCurrent: org.id === activeOrg?.id,
        select: () => {
          selectOrg(org.id);
        },
      })).filter((org) => matchesQuery(org.label, org.description)).sort(currentFirst);
    }

    if (tab === "resources") {
      return searchResources(resourceInventory, query, resourceType).map(resource => {
        const kind = RESOURCE_TYPES[resource.resourceType];
        return {
          id: resourceKey(resource), label: resource.label,
          description: `${kind.label} · ${resource.apiName}`,
          Icon: RESOURCE_ICONS[kind.group], surfaceLabel: SURFACES[kind.surface].label,
          isCurrent: currentCanvas?.kind === "org-resource" && currentCanvas.params.orgId === resource.orgId && resourceKey(currentCanvas.params) === resourceKey(resource),
          select: () => openResource(resource),
        };
      }).sort(currentFirst);
    }

    if (!hasProjects) return [];

    if (tab === "projects") {
      const rows: PaletteItem[] = [];
      // Move whole project groups together so their children stay attached.
      const tree = buildProjectTree(projects).sort(
        (a, b) => Number(b.project.id === activeProject?.id) - Number(a.project.id === activeProject?.id),
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
        // Tree guides are re-derived after filtering, so each group ends at
        // its last remaining child. Selection never detaches a worktree.
        const projectMatches = matchesQuery(
          project.name,
          project.description,
          (base?.worktree.label ?? "Planning project"),
          (base?.worktree.branch ?? ""),
        );
        const matchingChildren = children.filter(
          ({ worktree }) => projectMatches || matchesQuery(worktree.label, worktree.branch),
        );

        if (!(projectMatches || matchingChildren.length > 0)) continue;

        rows.push({
          id: project.id,
          label: project.name,
          // Subtitle = the primary branch, so the node reads as "project on main".
          description: (base?.worktree.label ?? "Planning project"),
          Icon: LayersIcon,
          // Current only when the project is active AND on its primary worktree —
          // if a feature worktree is active, its own child row carries "Current".
          isCurrent: project.id === activeProject?.id && base?.worktree.id === activeWorktree?.id,
          select: () => {
            selectProject(project.id, base?.worktree.id);
          },
        });

        matchingChildren.forEach(({ worktree, status }) => {
          const isCurrent = project.id === activeProject?.id && worktree.id === activeWorktree?.id;
          rows.push({
            id: `${project.id}::${worktree.id}`,
            label: worktree.label,
            description: worktree.branch,
            isCurrent,
            indent: true,
            status,
            select: () => {
              selectProject(project.id, worktree.id);
            },
          });
        });
      }
      return rows.map((row, index, ordered) =>
        row.indent ? { ...row, lastChild: !ordered[index + 1]?.indent } : row,
      );
    }

    // tab === "sessions": every session, across every project, flattened for
    // global triage — `allSessionRows` already sorts waiting → working → idle.
    return allSessionRows(projects)
      .filter(({ project, worktree, session }) =>
        matchesQuery(project.name, worktree.label, worktree.branch, session.summary, STATUS_LABEL[session.status]),
      )
      .map(({ project, worktree, session }) => ({
        id: `${project.id}::${worktree.id}`,
        label: worktree.label,
        description: `${project.name} · ${worktree.branch} — ${session.summary}`,
        isCurrent: project.id === activeProject?.id && worktree.id === activeWorktree?.id,
        status: session.status,
        select: () => {
          selectProject(project.id, worktree.id);
        },
      })).sort(currentFirst);
  }, [
    tab,
    query,
    profile,
    projects,
    hasProjects,
    activeProject?.id,
    activeWorktree?.id,
    navigateSurface,
    selectProject,
    currentSurfaceId,
    orgs,
    activeOrg?.id,
    selectOrg,
    resourceInventory,
    resourceType,
    currentCanvas,
    openResource,
  ]);

  // Opening, switching tabs, and clearing search highlight the current item,
  // including a worktree nested beneath its project. Search starts at its
  // first match; explicit keyboard/pointer selection still takes precedence.
  const defaultActive = query.trim() ? 0 : Math.max(0, items.findIndex((item) => item.isCurrent));
  const safeActive = items.length ? Math.min(active ?? defaultActive, items.length - 1) : 0;
  // Keep keyboard selection visible in long org inventories without scrolling
  // the modal header or the page behind it.
  const activeItemId = items[safeActive]?.id;
  useEffect(() => {
    const list = resultsRef.current, row = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !row) return;
    const bounds = row.getBoundingClientRect(), viewport = list.getBoundingClientRect();
    if (bounds.top < viewport.top) list.scrollTop -= viewport.top - bounds.top;
    else if (bounds.bottom > viewport.bottom) list.scrollTop += bounds.bottom - viewport.bottom;
  }, [activeItemId, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    setActive(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(items.length ? (safeActive + 1) % items.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(items.length ? (safeActive - 1 + items.length) % items.length : 0);
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

  function startProject() {
    onClose(openProjectCreation);
  }

  function startConversation() {
    onClose(() => {
      if (pathname === "/") {
        requestAnimationFrame(() => document.getElementById("agent-composer")?.focus());
      } else {
        navigateSurface(null);
        requestAnimationFrame(() => document.getElementById("agent-composer")?.focus());
      }
    });
  }

  return (
    <Modal className={styles.overlay} open={open} onDismiss={() => onClose()} onExited={onExited}
      initialFocus={inputRef} label="Search surfaces, projects, sessions, orgs, and resources">
      <div className={styles.palette} data-modal-motion>
        <div className={styles.tabs} role="tablist" aria-label="Palette section">
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`command-palette-tab-${t}`}
              aria-controls="command-palette-panel"
              aria-selected={t === tab}
              className={`${styles.tab} ${t === tab ? styles.tabActive : ""}`}
              tabIndex={t === tab ? 0 : -1}
              onKeyDown={(event) => {
                const index = TAB_ORDER.indexOf(t);
                const next = event.key === "ArrowRight" ? (index + 1) % TAB_ORDER.length
                  : event.key === "ArrowLeft" ? (index - 1 + TAB_ORDER.length) % TAB_ORDER.length
                  : event.key === "Home" ? 0 : event.key === "End" ? TAB_ORDER.length - 1 : null;
                if (next === null) return;
                event.preventDefault(); switchTab(TAB_ORDER[next]!);
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
              }}
              onClick={() => switchTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="command-palette-panel" aria-labelledby={`command-palette-tab-${tab}`} className={styles.tabPanel}>
        <div className={styles.searchRow}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            ref={inputRef}
            // The palette exists only to receive typing; focus it on mount.
            className={styles.input}
            type="text"
            placeholder={TAB_PLACEHOLDER[tab]}
            aria-label={TAB_PLACEHOLDER[tab]}
            value={query}
            role={showGuidedEmpty ? "searchbox" : "combobox"}
            aria-expanded={showGuidedEmpty ? undefined : true}
            aria-controls={showGuidedEmpty ? undefined : "command-palette-results"}
            aria-activedescendant={items[safeActive] ? `cmd-${tab}-${items[safeActive].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(null);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        {showGuidedEmpty && (
          <div className={styles.guidedEmpty} id="command-palette-results" role="status">
            <strong>No {tab} yet</strong>
            <button type="button" onClick={tab === "projects" ? startProject : startConversation}>
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

        {tab === "resources" && <>
          <div className={styles.resourceFilters}>
            <label>Org<select aria-label="Resource org" value={resourceOrgId} onChange={event => { setResourceOrgId(event.target.value); setActive(null); }}>
              <option value="">Choose a connected org</option>
              {orgs.filter(org => org.connection === "connected").map(org => <option key={org.id} value={org.id}>{org.label}</option>)}
            </select></label>
            <label>Type<select aria-label="Resource type" value={resourceType} onChange={event => { setResourceType(event.target.value as ResourceType | "all"); setActive(null); }}>
              <option value="all">All resource types</option>
              {Object.entries(RESOURCE_TYPES).filter(([, kind]) => profile && canAccessSurface(profile, kind.surface)).map(([id, kind]) => <option key={id} value={id}>{kind.plural}</option>)}
            </select></label>
          </div>
          <p className={styles.contextHint} role="status">{resourceOrgId ? `${items.length} ${items.length === 1 ? "resource" : "resources"} · Demo metadata` : "Browse metadata from a connected org"}</p>
        </>}

        {/* Reset scrolling with the results so the first selection is visible. */}
        {!showGuidedEmpty && <ul ref={resultsRef} key={`${tab}:${query}:${resourceOrgId}:${resourceType}`} className={styles.results} id="command-palette-results" role="listbox" aria-label={TAB_LABEL[tab]}>
          {items.length === 0 && (
            <li className={styles.empty}>
              {tab === "resources" ? !resourceOrgId ? "Choose an org above to explore its objects, flows, permissions, and more." : query.trim() ? `No resources match “${query}” with these filters.` : "No resources of this type are available in this demo org." : `No ${tab} match “${query}”.`}
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
                    {item.surfaceLabel && <span className={styles.surfaceLabel}>{item.surfaceLabel}</span>}
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

        </div>
        <div className={styles.footer}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> switch focused tabs
          </span>
          <span>
            <kbd>↵</kbd> {TAB_ENTER_HINT[tab]}
          </span>
          <span>
            <kbd>esc</kbd> dismiss
          </span>
        </div>
      </div>
    </Modal>
  );
}
