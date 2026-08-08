"use client";

/**
 * A project opened as its own canvas tab — the "a project is a canvas you open,
 * not a mode you toggle" shape.
 *
 * The global left rail never changes when you're in here. Instead, the project
 * canvas carries its own two-column workspace: a free-floating **metadata
 * explorer** rail on the left, and a framed main column on the right (its own
 * breadcrumb + title header, then a bordered content box).
 *
 * The explorer is the project's own navigation, kept separate from the ALM
 * sub-nav. Its pinned "Project home" is the home — the dashboard, with the ALM
 * sections (Trust / Work Items / Pipelines / Testing) as a sub-nav you drill
 * into, gated on the global ALM mode. Below it the explorer gathers the
 * project's contextual metadata — Plans, Resources, Files. Selecting any leaf
 * takes over the content box beside it; clicking Project home (or a pane's
 * Close) brings the dashboard back. All content is mock and continuous with the
 * global canvases (see projects-data / project-metadata).
 *
 * Self-contained by design: it receives the project and a way back to the grid
 * as props, so it never imports the canvas context — that keeps it a leaf of the
 * import graph and lets canvas-context own it without a cycle.
 */
import { useState, type ReactElement } from "react";
import { HomeIcon, FileIcon, SparklesIcon, type IconComponent } from "@/components/icons";
import { almSurfaces, type AlmSurfaceId } from "./alm-surfaces";
import { CanvasHeader, CanvasView, DataList, Pill, StatTiles, type Row } from "./canvas-kit";
import { ExplorerContent, MetadataExplorer, type Selection } from "./metadata-explorer";
import {
  agentHintForProject,
  changedFilesForProject,
  filesForProject,
  plansForProject,
  resourcesForProject,
} from "./project-metadata";
import type { Project } from "./projects-data";
import styles from "./project-workspace.module.css";

// Overview (the dashboard home) plus the ALM surfaces, single-sourced so the
// project's inner sub-nav can't drift from the rail and the canvas registry.
type SubTabId = "overview" | AlmSurfaceId;

const SUBTABS: { id: SubTabId; label: string; Icon: IconComponent }[] = [
  { id: "overview", label: "Overview", Icon: HomeIcon },
  ...almSurfaces,
];

export function ProjectWorkspace({
  project,
  almMode,
  onOpenProjects,
}: {
  project: Project;
  almMode: boolean;
  onOpenProjects: () => void;
}) {
  // The ALM sub-nav's tab within the Overview home (only meaningful when the
  // explorer selection is "overview").
  const [tab, setTab] = useState<SubTabId>("overview");
  // What the explorer has open beside it. "overview" is home; the rest are
  // leaves. This is the seam every "open a file" route (deep link, agent,
  // search, a work item) funnels through — they set { kind: "file", path }.
  const [sel, setSel] = useState<Selection>({ kind: "overview" });

  // The inner sub-nav's Trust / Work Items / Pipelines / Testing are ALM
  // surfaces, so they only appear when ALM mode is on. With it off, only the
  // Overview dashboard is available: clamp the active tab so a previously-
  // selected ALM tab stops rendering the moment the mode is switched off, and
  // snaps back when it's switched on again.
  const effectiveTab: SubTabId = !almMode && tab !== "overview" ? "overview" : tab;
  const activeLabel = SUBTABS.find((t) => t.id === effectiveTab)?.label ?? "";

  const goHome = () => {
    setSel({ kind: "overview" });
    setTab("overview");
  };
  // Explorer selections route through here so choosing Overview lands on the
  // dashboard (not a stale ALM drill-down).
  const handleSelect = (next: Selection) => (next.kind === "overview" ? goHome() : setSel(next));
  const openFile = (path: string) => setSel({ kind: "file", path });

  const atHome = sel.kind === "overview" && effectiveTab === "overview";
  const trail =
    sel.kind === "file"
      ? sel.path
      : sel.kind === "plan"
        ? sel.plan.name
        : sel.kind === "resource"
          ? sel.resource.name
          : effectiveTab !== "overview"
            ? activeLabel
            : null;

  return (
    <CanvasView wide>
      <div className={styles.workspace}>
        <MetadataExplorer
          tree={filesForProject(project.id)}
          plans={plansForProject(project.id)}
          resources={resourcesForProject(project.id)}
          selection={sel}
          onSelect={handleSelect}
        />
        <div className={styles.main}>
          <div className={styles.head}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <button type="button" className={styles.crumbLink} onClick={onOpenProjects}>
                Projects
              </button>
              <span className={styles.crumbSep} aria-hidden="true">
                /
              </span>
              {atHome ? (
                <span className={styles.crumbCurrent}>{project.name}</span>
              ) : (
                // Away from home the project crumb is the way back to the dashboard.
                <button type="button" className={styles.crumbLink} onClick={goHome}>
                  {project.name}
                </button>
              )}
              {trail && (
                <>
                  <span className={styles.crumbSep} aria-hidden="true">
                    /
                  </span>
                  <span className={styles.crumbCurrent}>{trail}</span>
                </>
              )}
            </nav>
            <CanvasHeader
              Icon={project.Icon}
              title={project.name}
              subtitle={project.subtitle}
              action={<Pill tone={project.status.tone}>{project.status.label}</Pill>}
            />
          </div>

          <div className={styles.contentBox}>
            {sel.kind === "overview" ? (
              <div className={styles.overviewPad}>
                {almMode && (
                  <nav className={styles.subnav} aria-label="Project sections">
                    {SUBTABS.map((t) => {
                      const isActive = t.id === effectiveTab;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={styles.subtab}
                          data-active={isActive || undefined}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setTab(t.id)}
                        >
                          <t.Icon width={16} height={16} />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                )}
                <div className={styles.tabBody}>{renderTab(effectiveTab, project, openFile)}</div>
              </div>
            ) : (
              <ExplorerContent selection={sel} onClose={goHome} />
            )}
          </div>
        </div>
      </div>
    </CanvasView>
  );
}

/** The scoped content for the active sub-tab (within the Overview home). */
function renderTab(
  tab: SubTabId,
  project: Project,
  onOpenFile: (path: string) => void,
): ReactElement {
  switch (tab) {
    case "overview":
      return <Overview project={project} onOpenFile={onOpenFile} />;
    case "trust":
      return (
        <>
          <StatTiles stats={project.trustStats} />
          {project.approvals.length > 0 && (
            <DataList title="Pending approvals" rows={project.approvals} />
          )}
          <DataList title="Recent activity" rows={project.audit} />
        </>
      );
    case "work-items":
      return <DataList rows={project.workItems} />;
    case "pipelines":
      return <DataList rows={project.pipelines} />;
    case "testing":
      return (
        <>
          <StatTiles stats={project.testStats} />
          <DataList title="Test suites" rows={project.suites} />
        </>
      );
  }
}

/** Overview tab — the dashboard, plus the file entry points that open the
 *  explorer content (an agent hint and the changed-files list). */
function Overview({
  project,
  onOpenFile,
}: {
  project: Project;
  onOpenFile: (path: string) => void;
}) {
  const hint = agentHintForProject(project.id);
  const changedRows: Row[] = changedFilesForProject(project.id).map((cf) => ({
    Icon: FileIcon,
    primary: cf.path,
    tags: [
      <Pill key="note" tone={cf.tone}>
        {cf.note}
      </Pill>,
    ],
    onSelect: () => onOpenFile(cf.path),
  }));

  return (
    <>
      <p className={styles.summary}>{project.summary}</p>
      <StatTiles stats={project.stats} />
      {hint && (
        <div className={styles.agentNote}>
          <span className={styles.agentIcon} aria-hidden="true">
            <SparklesIcon width={18} height={18} />
          </span>
          <p className={styles.agentText}>
            <strong>From your agent</strong> — I pulled up the file behind this. Open it and
            you&rsquo;ll see where it sits in the explorer.
          </p>
          <button
            type="button"
            className={styles.agentBtn}
            onClick={() => onOpenFile(hint.path)}
          >
            {hint.label}
          </button>
        </div>
      )}
      <DataList title="Changed files" rows={changedRows} />
      <DataList title="Recent activity" rows={project.activity} />
    </>
  );
}
