"use client";

import { useEffect, useRef, ViewTransition } from "react";
import { flushSync } from "react-dom";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { FeatureBoundary } from "@/components/interaction/FeatureBoundary";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { CanvasLayout } from "@/components/canvas/CanvasLayout";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { PLUGINS, viewCapability } from "@/lib/plugins/catalog";
import { canvasTarget, type CanvasSpecInput } from "@/lib/surface-canvas/model";
import { CanvasContent } from "./canvas-registry";
import { SurfaceProjection } from "./SurfaceProjection";
import { useWorkbench, type WorkbenchView } from "./surface-canvas-context";
import styles from "./Workbench.module.css";

const PANEL_ID = "workbench-view";
const tabDomId = (id: string) => `workbench-tab-${id}`;

/**
 * The workbench: the capability views opened during this task, across plugins,
 * titled by their capability. Views switch or close in any order; closing keeps
 * the draft. Opening and closing the panel belongs to the one top-bar toggle, so
 * the workbench has no close or "open capability" controls of its own.
 *
 * Follows the tabs pattern: one tab stop (roving tabindex), Arrow/Home/End move
 * focus and selection, and Delete/Backspace closes the focused view.
 */
export function Workbench({ onChooseCapability }: { onChooseCapability: () => void }) {
  const { problem, selectView, closeView } = useNavigation();
  const { views, activeId, recovery } = useWorkbench();
  const tabRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const tabListRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = views.find(view => view.id === activeId) ?? null;
  const activeIndex = active ? views.indexOf(active) : -1;

  useEffect(() => {
    const list = tabListRef.current, tab = activeId ? tabRefs.current.get(activeId)?.parentElement : null;
    if (!list || !tab) return;
    const viewport = list.getBoundingClientRect(), bounds = tab.getBoundingClientRect();
    if (bounds.left < viewport.left) list.scrollLeft -= viewport.left - bounds.left + 8;
    else if (bounds.right > viewport.right) list.scrollLeft += bounds.right - viewport.right + 8;
  }, [activeId]);

  function dismiss(id: string) {
    const index = views.findIndex(view => view.id === id);
    if (index < 0) return;
    const isActive = id === activeId, neighbor = views[index + 1]?.id ?? views[index - 1]?.id;
    const shouldFocus = tabListRef.current?.contains(document.activeElement) || isActive && panelRef.current?.contains(document.activeElement);
    // Closing is immediate; the saved draft remains available for reopening.
    flushSync(() => closeView(id));
    const focusId = isActive ? neighbor : activeId;
    if (shouldFocus && focusId) tabRefs.current.get(focusId)?.focus({ preventScroll: true });
    else if (shouldFocus) document.getElementById("workbench-toggle")?.focus({ preventScroll: true });
  }
  function focusView(id: string) { selectView(id); tabRefs.current.get(id)?.focus(); }
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const focused = views.findIndex(view => tabRefs.current.get(view.id) === document.activeElement);
    const index = focused < 0 ? activeIndex : focused;
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusView(views[(index + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length]!.id);
    } else if (event.key === "Home") { event.preventDefault(); focusView(views[0]!.id); }
    else if (event.key === "End") { event.preventDefault(); focusView(views.at(-1)!.id); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); dismiss(views[index]!.id); }
  }

  return <div className={styles.host}>
    {!!recovery.length && <details aria-label="Recovered legacy drafts"><summary>Recovered legacy drafts ({recovery.length})</summary><p>These older drafts have ambiguous targets. Copy their content into a new draft, or export them for later.</p><a download="recovered-drafts.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(recovery, null, 2))}`}>Export recovered drafts</a>{recovery.map((entry) => <section key={entry.id}><h3>{entry.title}</h3><p>{entry.reason}</p><textarea aria-label={`Recovered content ${entry.id}`} readOnly value={JSON.stringify(entry.original, null, 2)} rows={6} /></section>)}</details>}
    {views.length > 0 && <div ref={tabListRef} role="tablist" aria-label="Open views" aria-orientation="horizontal" className={styles.tabs} onKeyDown={onKeyDown}>
      {views.map(view => {
        const isActive = view.id === active?.id, Icon = surfaceAppById(view.plugin).Icon;
        return <span key={view.id} role="presentation" className={styles.tabWrap}>
          <button type="button" role="tab" id={tabDomId(view.id)} aria-selected={isActive} aria-controls={PANEL_ID}
            tabIndex={isActive || !active && view === views[0] ? 0 : -1} ref={node => { tabRefs.current.set(view.id, node); }}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`} title={`${PLUGINS[view.plugin].name} · ${view.canvas.title}`}
            onClick={() => selectView(view.id)}>
            <Icon width={14} height={14} aria-hidden="true" className={styles.surfaceTabIcon} />{view.canvas.title}
          </button>
          <button type="button" tabIndex={-1} aria-label={`Close ${view.canvas.title}`} className={styles.close} onClick={() => dismiss(view.id)}>
            <CloseIcon width={13} height={13} aria-hidden="true" />
          </button>
        </span>;
      })}
    </div>}
    {/* Keyed by plugin: changing plugin swaps the whole view (recede/land);
        views within one plugin switch immediately. */}
    <ViewTransition key={active?.plugin ?? "empty"} name="surface-canvas" default="none"
      share={{ "workspace-context": "workspace-dissolve", default: "surface-swap" }}
      update={{ "workspace-context": "workspace-dissolve", default: "none" }}
      enter={{ "workspace-context": "workspace-dissolve", default: "none" }}
      exit={{ "workspace-context": "workspace-dissolve", default: "none" }}>
      <div ref={panelRef} role={active ? "tabpanel" : "region"} id={PANEL_ID} aria-labelledby={active ? tabDomId(active.id) : undefined}
        aria-label={active ? undefined : "Workbench"} tabIndex={0} className={styles.panel} data-plugin={active?.plugin}>
        <FeatureBoundary label="Canvas" resetKey={active?.id ?? "empty"}><CanvasLayout>
          {problem ? <section><h2>Destination unavailable</h2><p>{problem}</p></section>
            : active ? <><ViewIdentity view={active} /><ViewBody view={active} /></>
            : <EmptyWorkbench onChooseCapability={onChooseCapability} />}
        </CanvasLayout></FeatureBoundary>
      </div>
    </ViewTransition>
  </div>;
}

function ViewBody({ view }: { view: WorkbenchView }) {
  if (view.canvas.kind === "overview") return <SurfaceProjection surfaceId={view.plugin} />;
  return <CanvasContent key={view.id} spec={view.canvas} />;
}

/** Every view names its plugin, its capability and the context it works in. */
function ViewIdentity({ view }: { view: WorkbenchView }) {
  const { target, projects, orgs } = useWorkspace();
  const input = view.canvas.kind === "overview" ? undefined : view.canvas as CanvasSpecInput;
  const scope = input ? canvasTarget(input, target) : target;
  const project = projects.find(item => item.id === scope.projectId);
  const worktree = project?.worktrees.find(item => item.id === scope.worktreeId);
  const org = orgs.find(item => item.id === scope.orgId);
  const plugin = PLUGINS[view.plugin].name, capability = viewCapability(view.plugin, input);
  const Icon = surfaceAppById(view.plugin).Icon;
  return <div className={styles.identity} data-view-identity data-plugin={plugin} data-capability={capability}>
    <span className={styles.identityPlugin}><Icon width={14} height={14} aria-hidden="true" />{plugin}</span>
    <span aria-hidden="true" className={styles.identitySeparator}>/</span>
    <span className={styles.identityCapability}>{capability}</span>
    <ul className={styles.identityContext} aria-label="Working context">
      <li><span>Org</span>{org?.label ?? "No org selected"}</li>
      <li><span>Project</span>{project ? `${project.name}${worktree ? ` · ${worktree.branch}` : ""}` : "Unbound"}</li>
      {input?.kind === "org-resource" && <li><span>Target</span>{input.params.apiName}</li>}
    </ul>
  </div>;
}

function EmptyWorkbench({ onChooseCapability }: { onChooseCapability: () => void }) {
  return <section className={styles.empty} aria-labelledby="workbench-empty-heading">
    <h2 id="workbench-empty-heading">No capabilities open</h2>
    <p>Choose a capability to work on here. Its view stays in the workbench while you work with the agent.</p>
    <button type="button" className="slds-button slds-button_brand" onClick={onChooseCapability}>
      <SearchIcon width={14} height={14} aria-hidden="true" />Choose a capability
    </button>
  </section>;
}
