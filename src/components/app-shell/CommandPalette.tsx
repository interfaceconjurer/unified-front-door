"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/interaction/Modal";
import {
  CloseIcon,
  DatabaseIcon,
  LayersIcon,
  PlusIcon,
  PuzzleIcon,
  SearchIcon,
  type IconComponent,
} from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { usePlugins } from "@/components/plugins/use-plugins";
import { ALM_STAGES, ALM_STAGE_LABEL, PLUGINS, PLUGIN_IDS, capabilityCatalog, type AlmStage, type CatalogCapability, type PluginId } from "@/lib/plugins/catalog";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { StatusDot } from "@/components/workspace/StatusDot";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface } from "@/lib/demo-profiles";
import type { AgentSessionStatus, OrgKind } from "@/lib/workspace/model";
import { allSessionRows, buildProjectTree, STATUS_LABEL } from "@/lib/workspace/selectors";
import { RESOURCE_TYPES, resourceKey, searchResources, type ResourceType } from "@/lib/org-resources/model";
import { resourcesForOrg } from "@/lib/org-resources/catalog";
import { SETUP_AREAS } from "@/lib/org-resources/setup";
import { capabilityForCanvas } from "@/components/surfaces/surface-capabilities";
import { SURFACES } from "@/lib/workspace/surfaces";
import { matchesPaletteQuery, rankPaletteGroups } from "@/lib/navigation/palette-search";
import { RESOURCE_ICONS } from "@/components/surfaces/resource-icons";
import styles from "./CommandPalette.module.css";
import orgStyles from "@/components/workspace/OrgKind.module.css";

export type CommandPaletteTab = "capabilities" | "projects" | "sessions" | "orgs" | "resources" | "plugins";
type Tab = CommandPaletteTab;

const TAB_ORDER: readonly Tab[] = ["capabilities", "projects", "sessions", "orgs", "resources", "plugins"];
const TAB_LABEL: Record<Tab, string> = {
  capabilities: "Capabilities",
  projects: "Projects",
  sessions: "Sessions",
  orgs: "Orgs",
  resources: "Resources",
  plugins: "Plugins",
};
const TAB_PLACEHOLDER: Record<Tab, string> = {
  capabilities: "Search capabilities…",
  projects: "Search projects…",
  sessions: "Search sessions…",
  orgs: "Search orgs…",
  resources: "Search resources…",
  plugins: "Search plugins…",
};
// What ↵ does, in this tab's own vocabulary — capabilities "open" a view,
// projects and orgs "switch" context, sessions "go" to their saved work.
const TAB_ENTER_HINT: Record<Tab, string> = { capabilities: "open", projects: "switch", sessions: "go", orgs: "switch", resources: "open", plugins: "details" };
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
// under its project. Projects-tab and session selections explicitly resume
// their context; project plan and resource rows use scoped canvas navigation.
type PaletteItem = {
  id: string;
  label: string;
  description: string;
  searchNames?: string[];
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
  /** Detail pane subject for capability and plugin rows. */
  capability?: CatalogCapability;
  plugin?: PluginId;
};

// Stable ordering keeps all other destinations in their existing order.
const currentFirst = (a: PaletteItem, b: PaletteItem) => Number(b.isCurrent) - Number(a.isCurrent);

/**
 * A Spotlight/Raycast-style command palette for switching what you're looking
 * at. Opened with ⌘⇧P (the shell owns the shortcut and only mounts this while
 * open, so its state starts fresh each time), it overlays a search box over
 * the whole app. It opens on Capabilities; other tabs offer scoped searches:
 *  - Projects — explicit project/worktree entry resumes that line of work.
 *    Project trees stay connected when filtering and ranking results.
 *  - Sessions — the current session first, then every other session across
 *    projects sorted waiting → working → idle.
 *    Picking one explicitly resumes that project's worktree.
 *  - Orgs — connections available from login; picking one changes the target
 *    org without navigating or changing the assessment scope.
 *  - Resources — browse a connected org's metadata and open its canvas.
 * Tabs start with their current destination highlighted. Type to filter, ↑/↓ to move, ←/→ to switch focused tabs, ↵ to
 * select, esc to dismiss.
 */
export function CommandPalette({ initialTab = "capabilities", initialPlugin = null, open, onClose, onExited }: {
  initialTab?: CommandPaletteTab;
  initialPlugin?: PluginId | null;
  open: boolean;
  onClose: (action?: () => void) => void;
  onExited: () => void;
}) {
  const { navigateSurface, selectProject, selectOrg, openResource, openProjectCreation, openCanvas, openCanvasAcrossProjects, capabilityScope } = useNavigation();
  const { profile } = useDemoProfile();
  const plugins = usePlugins();
  const [stage, setStage] = useState<AlmStage | "all">("all");
  const [capabilityPlugin, setCapabilityPlugin] = useState<PluginId | "all">(initialPlugin ?? "all");
  const [pluginFilter, setPluginFilter] = useState<"installed" | "available">("installed");
  const [notice, setNotice] = useState("");
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
  const resourceOrg = orgs.find(org => org.id === resourceOrgId && org.connection === "connected");
  const currentCanvas = destination.kind === "available" ? destination.destination.canvas : undefined;
  const currentPlugin = destination.kind === "available" ? destination.destination.surface : null;
  const resourceInventory = useMemo(() => orgs.some(org => org.id === resourceOrgId && org.connection === "connected")
    ? resourcesForOrg(resourceOrgId).filter(resource => profile && canAccessSurface(profile, RESOURCE_TYPES[resource.resourceType].surface)) : [], [orgs, resourceOrgId, profile]);

  const items = useMemo<PaletteItem[]>(() => {
    const matchesQuery = (...parts: string[]) => matchesPaletteQuery(query, ...parts);
    function categoryItems(category: Tab): PaletteItem[] {
      if (category === "capabilities") {
        return capabilityCatalog(plugins.installed)
          .filter(item => (capabilityPlugin === "all" || item.plugin === capabilityPlugin)
            && (stage === "all" || item.stages.includes(stage))
            && matchesQuery(item.name, item.description, PLUGINS[item.plugin].name, ...item.stages.map(key => ALM_STAGE_LABEL[key])))
          .map(item => {
            const current = item.capability === "overview" ? currentCanvas === undefined && currentPlugin === item.plugin
              : currentCanvas?.kind === "capability" && currentCanvas.params.surface === item.plugin && currentCanvas.params.capability === item.capability && !currentCanvas.params.section;
            return {
              id: `${item.plugin}:${item.capability}`, label: item.name, description: item.description,
              Icon: item.capability === "overview" ? surfaceAppById(item.plugin).Icon : capabilityForCanvas(item.plugin, item.capability)?.Icon ?? PuzzleIcon,
              surfaceLabel: PLUGINS[item.plugin].name, isCurrent: !!current, capability: item,
              select: () => item.capability === "overview" ? navigateSurface(item.plugin, "overview")
                : openCanvas(item.plugin, { kind: "capability", title: item.name, params: { ...capabilityScope, surface: item.plugin, capability: item.capability } }),
            };
          });
      }

      if (category === "plugins") {
        const wanted = tab === "plugins" ? pluginFilter : "installed";
        return PLUGIN_IDS.filter(id => plugins.access.includes(id) && plugins.isInstalled(id) === (wanted === "installed"))
          .filter(id => matchesQuery(PLUGINS[id].name, PLUGINS[id].description, PLUGINS[id].publisher))
          .map(id => ({ id, label: PLUGINS[id].name, description: `${PLUGINS[id].publisher} · ${PLUGINS[id].version}`,
            Icon: surfaceAppById(id).Icon, isCurrent: false, plugin: id, select: () => {} }));
      }

      // Org connections exist before the user has created a project.
      if (category === "orgs") {
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

      if (category === "resources") {
        const areas: PaletteItem[] = resourceOrg && profile && canAccessSurface(profile, "build") && resourceType === "all"
          ? SETUP_AREAS.filter(area => matchesQuery(area.title, area.label, area.description)).map(area => ({
            id: `setup:${area.id}`, label: area.title, description: `Setup area · ${resourceOrg.label}`,
            searchNames: [area.label], Icon: capabilityForCanvas("build", area.id)!.Icon, surfaceLabel: "Build & Setup",
            isCurrent: currentCanvas?.kind === "capability" && currentCanvas.params.surface === "build" && currentCanvas.params.capability === area.id && currentCanvas.params.orgId === resourceOrg.id,
            select: () => openCanvas("build", { kind: "capability", title: area.title, params: { ...capabilityScope, surface: "build", capability: area.id, orgId: resourceOrg.id } }),
          })) : [];
        return [...areas, ...searchResources(resourceInventory, query, resourceType).map(resource => {
          const kind = RESOURCE_TYPES[resource.resourceType];
          return {
            id: resourceKey(resource), label: resource.label,
            description: `${kind.label} · ${resource.apiName} · ${orgs.find(org => org.id === resource.orgId)?.label ?? resource.orgId}`,
            searchNames: [resource.apiName],
            Icon: RESOURCE_ICONS[kind.group], surfaceLabel: SURFACES[kind.surface].label,
            isCurrent: currentCanvas?.kind === "org-resource" && currentCanvas.params.orgId === resource.orgId && resourceKey(currentCanvas.params) === resourceKey(resource),
            select: () => openResource(resource),
          };
        })].sort(currentFirst);
      }

      if (!hasProjects) return [];

      if (category === "projects") {
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
            (base?.worktree.label ?? project.description),
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
            description: (base?.worktree.label ?? project.description),
            searchNames: [base?.worktree.branch ?? ""],
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
              searchNames: [worktree.branch],
              isCurrent,
              indent: true,
              status,
              select: () => {
                selectProject(project.id, worktree.id);
              },
            });
          });
          // Keep the former project-plan search action available after removing
          // the mixed All tab. The project row above still switches workspace.
          rows.push({ id: `plan:${project.id}`, label: `View ${project.name} plan`, description: "ALM · Project plan",
            Icon: LayersIcon, isCurrent: false, indent: true,
            select: () => openCanvasAcrossProjects("alm", { kind: "improvement-project", title: project.name, params: { projectId: project.id } }),
          });
        }
        return rows.map((row, index, ordered) =>
          row.indent ? { ...row, lastChild: !ordered[index + 1]?.indent } : row,
        );
      }

      // category === "sessions": every session, across every project, flattened for
      // global triage — `allSessionRows` already sorts waiting → working → idle.
      return allSessionRows(projects)
        .filter(({ project, worktree, session }) =>
          matchesQuery(project.name, worktree?.label ?? project.name, worktree?.branch ?? "", session.summary, STATUS_LABEL[session.status]),
        )
        .map(({ project, worktree, session }) => ({
          id: `${project.id}::${worktree?.id}`,
          label: worktree?.label ?? project.name,
          description: `${project.name}${worktree ? ` · ${worktree.branch}` : ""} — ${session.summary}`,
          searchNames: [worktree?.branch ?? ""],
          isCurrent: project.id === activeProject?.id && worktree?.id === activeWorktree?.id,
          status: session.status,
          select: () => {
            selectProject(project.id, worktree?.id);
          },
        })).sort(currentFirst);
    }
    return rankPaletteGroups(categoryItems(tab), query);
  }, [
    tab,
    query,
    capabilityPlugin,
    profile,
    plugins,
    stage,
    pluginFilter,
    currentPlugin,
    projects,
    hasProjects,
    activeProject,
    activeWorktree?.id,
    navigateSurface,
    selectProject,
    orgs,
    activeOrg?.id,
    selectOrg,
    resourceInventory,
    resourceType,
    currentCanvas,
    openResource,
    openCanvas,
    openCanvasAcrossProjects,
    capabilityScope,
    resourceOrg,
  ]);

  // Searches start at the first result. Unfiltered category tabs
  // highlight the current item, including a nested worktree. Explicit
  // keyboard/pointer selection still takes precedence.
  const defaultActive = query.trim() ? 0
    : Math.max(0, items.findIndex((item) => item.isCurrent));
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
    setNotice("");
  }
  /** Plugin detail actions keep the palette open; they don't navigate. */
  function showPlugin(id: PluginId) {
    const filter = plugins.isInstalled(id) ? "installed" : "available";
    setPluginFilter(filter); setTab("plugins"); setQuery(""); setNotice("");
    const list = PLUGIN_IDS.filter(item => plugins.access.includes(item) && plugins.isInstalled(item) === (filter === "installed"));
    setActive(Math.max(0, list.indexOf(id)));
  }
  function showCapability(item: CatalogCapability) {
    setTab("capabilities"); setCapabilityPlugin(item.plugin); setStage("all"); setQuery(item.name); setActive(0); setNotice("");
  }
  function togglePlugin(id: PluginId) {
    const count = capabilityCatalog([id]).length;
    if (plugins.isInstalled(id)) { plugins.uninstall(id); setNotice(`${PLUGINS[id].name} uninstalled. Its capabilities are hidden; drafts are kept.`); }
    else if (plugins.install(id)) { setNotice(`${PLUGINS[id].name} installed. ${count} capabilities added.`); setPluginFilter("installed"); }
    setActive(null);
  }

  function clearSearch() {
    setQuery("");
    setActive(null);
    inputRef.current?.focus();
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
      if (item?.plugin) showPlugin(item.plugin);
      else if (item) onClose(item.select);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const showGuidedEmpty = !hasProjects && (tab === "projects" || tab === "sessions");

  function startProject() {
    onClose(openProjectCreation);
  }

  return (
    <Modal className={styles.overlay} open={open} onDismiss={() => onClose()} onExited={onExited}
      initialFocus={inputRef} label="Search capabilities, projects, sessions, orgs, resources, and plugins">
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

        <div role="tabpanel" id="command-palette-panel" aria-labelledby={`command-palette-tab-${tab}`} className={styles.tabPanel}
          data-preview={tab === "capabilities" || tab === "plugins"}>
        <div className={styles.listPane}>
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
            aria-autocomplete={showGuidedEmpty ? undefined : "list"}
            aria-expanded={showGuidedEmpty ? undefined : true}
            aria-controls={showGuidedEmpty ? undefined : "command-palette-results"}
            aria-activedescendant={items[safeActive] ? `cmd-${tab}-${items[safeActive].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(null);
            }}
            onKeyDown={onKeyDown}
          />
          <div className={styles.searchActions}>
            {query && <button type="button" className={styles.clearSearch} aria-label="Clear search" title="Clear search" onClick={clearSearch}>
              <CloseIcon width={16} height={16} aria-hidden="true" />
            </button>}
            <kbd className={styles.escHint}>esc</kbd>
          </div>
        </div>

        {showGuidedEmpty && (
          <div className={styles.guidedEmpty} id="command-palette-results" role="status">
            <strong>No {tab} yet</strong>
            {tab === "projects" ? <button type="button" onClick={startProject}>
              <PlusIcon width={15} height={15} aria-hidden="true" />
              Start your first project
            </button> : <p>Your chats will appear here.</p>}
          </div>
        )}

        {tab === "orgs" && (
          <p className={styles.contextHint}>
            Connected orgs · {orgs.filter((org) => org.connection === "connected").length} available from your login
          </p>
        )}

        {tab === "capabilities" && <>
          <div className={styles.stageFilters} role="group" aria-label="Capability plugin">
            {(["all", ...PLUGIN_IDS.filter(id => plugins.access.includes(id))] as const).map(key => <button key={key} type="button" aria-pressed={capabilityPlugin === key}
              onClick={() => { setCapabilityPlugin(key); setActive(null); }}>{key === "all" ? "All plugins" : PLUGINS[key].name}</button>)}
          </div>
          <div className={styles.stageFilters} role="group" aria-label="ALM stage">
            {(["all", ...ALM_STAGES] as const).map(key => <button key={key} type="button" aria-pressed={stage === key}
              onClick={() => { setStage(key); setActive(null); }}>{key === "all" ? "All stages" : ALM_STAGE_LABEL[key]}</button>)}
          </div>
        </>}

        {tab === "plugins" && <div className={styles.stageFilters} role="group" aria-label="Plugin availability">
          {(["installed", "available"] as const).map(key => <button key={key} type="button" aria-pressed={pluginFilter === key}
            onClick={() => { setPluginFilter(key); setActive(null); }}>{key === "installed" ? "Installed" : "Available"}</button>)}
        </div>}
        {notice && <p className={styles.contextHint} role="status">{notice}</p>}

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
          <p className={styles.contextHint} role="status">{resourceOrgId ? `${items.length} ${items.length === 1 ? "result" : "results"} · Demo metadata` : "Browse metadata from a connected org"}</p>
        </>}

        {/* Reset scrolling with the results so the first selection is visible. */}
        {!showGuidedEmpty && <ul ref={resultsRef} key={`${tab}:${capabilityPlugin}:${query}:${resourceOrgId}:${resourceType}`} className={styles.results} id="command-palette-results" role="listbox" aria-label={TAB_LABEL[tab]} onKeyDown={onKeyDown}>
          {items.length === 0 && (
            <li role="presentation" className={styles.empty}>
              {tab === "plugins" && !query.trim() ? pluginFilter === "available" ? "No other plugins are available for your workspace." : "No plugins are installed. Install one from Available." : tab === "resources" ? !resourceOrgId ? "Choose an org above to explore its objects, flows, permissions, and more." : query.trim() ? `No resources match “${query}” with these filters.` : "No resources of this type are available in this demo org." : tab === "capabilities" && capabilityPlugin !== "all" && !plugins.isInstalled(capabilityPlugin) ? `${PLUGINS[capabilityPlugin].name} is not installed. Open Plugins to install it.` : `No ${tab} match “${query}”.`}
            </li>
          )}
          {items.map((item, index) => {
            const isActive = index === safeActive;
            return (
              <li key={item.id} role="presentation"
                className={item.orgKind ? orgStyles[item.orgKind] : undefined}>
                <button
                  type="button"
                  role="option"
                  id={`cmd-${tab}-${item.id}`}
                  aria-selected={isActive}
                  tabIndex={-1}
                  className={`${styles.result} ${isActive ? styles.resultActive : ""} ${
                    item.indent ? styles.resultIndent : ""
                  } ${item.lastChild ? styles.resultLastChild : ""}`}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setActive(index)}
                  onClick={() => item.plugin ? showPlugin(item.plugin) : onClose(item.select)}
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
                    <span className={styles.resultLabel} data-result-label>{item.label}</span>
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
        {(tab === "capabilities" || tab === "plugins") && <div key={`${tab}:${items[safeActive]?.id ?? "none"}`} className={styles.previewPane} data-palette-preview>
          {items[safeActive] ? <PaletteDetails item={items[safeActive]}
            installed={plugins.installed} onShowPlugin={showPlugin} onShowCapability={showCapability} onTogglePlugin={togglePlugin}
            onOpen={() => onClose(items[safeActive]!.select)} />
            : <p className={styles.previewEmpty}>Select a {tab === "plugins" ? "plugin" : "capability"} to see its details.</p>}
        </div>}
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
            <kbd>↵</kbd> {tab === "projects" && items[safeActive]?.id.startsWith("plan:") ? "open" : TAB_ENTER_HINT[tab]}
          </span>
          <span>
            <kbd>esc</kbd> dismiss
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** Detail pane: a capability links back to its plugin; a plugin shows its
 *  package details, install state and contributed capabilities. */
function PaletteDetails({ item, installed, onShowPlugin, onShowCapability, onTogglePlugin, onOpen }: {
  item: PaletteItem; installed: readonly PluginId[];
  onShowPlugin: (id: PluginId) => void; onShowCapability: (item: CatalogCapability) => void;
  onTogglePlugin: (id: PluginId) => void; onOpen: () => void;
}) {
  if (item.capability) {
    const capability = item.capability, plugin = PLUGINS[capability.plugin];
    return <section className={styles.details} aria-label="Capability details">
      <button type="button" className={styles.detailsLink} onClick={() => onShowPlugin(capability.plugin)} aria-label={`View ${plugin.name} in Plugins`}>From {plugin.name} ↗</button>
      <h2>{capability.name}</h2>
      <p>{capability.description}</p>
      <dl><dt>Stages</dt><dd>{capability.stages.map(stage => ALM_STAGE_LABEL[stage]).join(", ")}</dd><dt>Opens</dt><dd>A view in the workbench</dd></dl>
      <button type="button" className="slds-button slds-button_brand" onClick={onOpen}>Open {capability.name}</button>
    </section>;
  }
  if (!item.plugin) return null;
  const plugin = PLUGINS[item.plugin], isInstalled = installed.includes(item.plugin), contributes = capabilityCatalog([item.plugin]);
  return <section className={styles.details} aria-label="Plugin details">
    <span className={styles.detailsStatus}>{isInstalled ? "Installed" : "Available"}</span>
    <h2>{plugin.name}</h2>
    <p>{plugin.description}</p>
    <dl><dt>Publisher</dt><dd>{plugin.publisher}</dd><dt>Version</dt><dd>{plugin.version}</dd><dt>Workspace</dt><dd>{isInstalled ? "Installed here" : "Not installed"}</dd></dl>
    <h3>Contributes {contributes.length} capabilities</h3>
    <ul className={styles.detailsList}>{contributes.map(capability => <li key={capability.capability}>
      {isInstalled ? <button type="button" onClick={() => onShowCapability(capability)}>{capability.name}<small>View in Capabilities</small></button>
        : <span>{capability.name}<small>Available after installation</small></span>}
    </li>)}</ul>
    <button type="button" className={`slds-button ${isInstalled ? "slds-button_neutral" : "slds-button_brand"}`} onClick={() => onTogglePlugin(item.plugin!)}>
      {isInstalled ? `Uninstall ${plugin.name}` : `Install ${plugin.name}`}
    </button>
  </section>;
}
