"use client";

import {
  BoxIcon,
  DatabaseIcon,
  FileIcon,
  GitBranchIcon,
  LayersIcon,
  ListCheckIcon,
  PlusIcon,
  PuzzleIcon,
  ShieldIcon,
  SparklesIcon,
  WorkflowIcon,
  type IconComponent,
} from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  projectionForSurface,
  type ProjectionInsight,
  type ProjectionMetric,
} from "@/lib/workspace/projections";
import { useSurfaceCanvases } from "./surface-canvas-context";
import styles from "./SurfaceProjection.module.css";

const METRIC_ICON: Record<ProjectionMetric["key"], IconComponent> = {
  objects: DatabaseIcon,
  flows: WorkflowIcon,
  apex: FileIcon,
  lwc: PuzzleIcon,
  permsets: ShieldIcon,
  worktrees: GitBranchIcon,
  components: LayersIcon,
};

const INSIGHT_ICON: Record<ProjectionInsight["tone"], IconComponent> = {
  neutral: ListCheckIcon,
  info: SparklesIcon,
  caution: ShieldIcon,
};

type SurfaceProjectionProps = {
  /** The lens to render. A plain string so a server page can hand it across the
   *  client boundary — the surface object (with its Icon function) is resolved
   *  here, on the client, rather than serialized. */
  surfaceId: SurfaceId;
  /** Surface-specific lens control (e.g. the Code surface's worktree switcher). */
  toolbar?: React.ReactNode;
  /** Generic extra body section for content that's specific to one surface and
   *  doesn't fit the metrics/insights shape every lens shares (e.g. the Code
   *  surface's agent sessions rail). Kept as a plain slot — SurfaceProjection
   *  stays a lens renderer for all four surfaces, not a Code-specific layout. */
  children?: React.ReactNode;
};

/**
 * A surface body rendered as a *projection* of the active project. It reads the
 * shell-level workspace (project + target org) and asks the projection module
 * what this particular lens should show, then lays it out: a lead, the facet
 * metrics this lens centers on, and lens-specific insights. Switching project or
 * org re-projects in place; switching surface re-frames the same project — the
 * whole point of the front door.
 */
export function SurfaceProjection({ surfaceId, toolbar, children }: SurfaceProjectionProps) {
  const surface = surfaceAppById(surfaceId);
  const { profile } = useDemoProfile();
  const { activeProject, activeOrg } = useWorkspace();
  const { openCanvas } = useSurfaceCanvases(surfaceId);
  const emptyWorkspace = profile?.workspaceExperience === "empty";
  const projection = emptyWorkspace
    ? { lead: surface.workspaceDescription, metrics: [], insights: [] }
    : projectionForSurface(surface.id, activeProject, activeOrg);

  // Deployed apps are a Build-only launch group, and only when the active
  // project actually has apps — no empty shell otherwise. Every other surface
  // launches its capabilities alone. When both groups show (Build with apps),
  // each carries a visible sublabel to tell the two clusters apart; a lone
  // capabilities group leans on the region heading instead.
  const deployedApps = !emptyWorkspace && surface.id === "build" ? activeProject.apps : [];
  const showApps = deployedApps.length > 0;

  return (
    <div className={styles.surface}>
      <section className={styles.workspace} aria-labelledby="surface-heading">
        <header className={styles.header}>
          <div className={styles.headingText}>
            {/* Surface identity only — its icon and name. The project this lens
                projects is not restated here; that's the status bar's single
                source of truth for workspace coordinates. */}
            <h1 id="surface-heading">
              <surface.Icon className={styles.titleIcon} width={26} height={26} aria-hidden="true" />
              {surface.label}
            </h1>
            <p className={styles.lead}>{projection.lead}</p>
          </div>
          {!emptyWorkspace && toolbar}
        </header>

        <ul className={styles.metrics} aria-label="Project facets in this lens">
          {projection.metrics.map((metric) => {
            const Icon = METRIC_ICON[metric.key];
            return (
              <li
                key={metric.key}
                className={`${styles.metric} ${metric.emphasis ? styles.metricEmphasis : ""}`}
              >
                <span className={styles.metricIcon} aria-hidden="true">
                  <Icon width={18} height={18} />
                </span>
                <span className={styles.metricValue}>{metric.value}</span>
                <span className={styles.metricLabel}>{metric.label}</span>
              </li>
            );
          })}
        </ul>

        <div className={styles.insights}>
          {projection.insights.map((insight) => {
            const Icon = INSIGHT_ICON[insight.tone];
            return (
              <article
                key={insight.key}
                className={`${styles.insight} ${styles[insight.tone]}`}
              >
                <span className={styles.insightIcon} aria-hidden="true">
                  <Icon width={18} height={18} />
                </span>
                <div>
                  <h2 className={styles.insightTitle}>{insight.title}</h2>
                  <p className={styles.insightDetail}>{insight.detail}</p>
                </div>
              </article>
            );
          })}
        </div>

        {!emptyWorkspace && children && <div className={styles.extra}>{children}</div>}

        {/* Launch region — the surface's own affordances, each opening a real
            canvas tab in THIS surface (idempotent by kind+params, so re-opening
            focuses the existing tab). Replaces the old passive capability chips:
            everything here is actionable and belongs to this surface. */}
        <section className={styles.launch} aria-labelledby="surface-launch-heading">
          <h2 id="surface-launch-heading" className={styles.launchHeading}>
            Launch
          </h2>

          {showApps && (
            <div className={styles.launchGroup} role="group" aria-label="Deployed apps">
              <span className={styles.launchGroupLabel}>Deployed apps</span>
              <ul className={styles.launchList}>
                {deployedApps.map((app) => (
                  <li key={app.id}>
                    <button
                      type="button"
                      className={styles.launchButton}
                      aria-label={`Open ${app.label}`}
                      onClick={() =>
                        openCanvas(surfaceId, {
                          kind: "app",
                          title: app.label,
                          params: { projectId: activeProject.id, appId: app.id },
                        })
                      }
                    >
                      <span
                        className={`${styles.launchIcon} ${styles.launchIconApp}`}
                        aria-hidden="true"
                      >
                        <BoxIcon width={16} height={16} />
                      </span>
                      <span className={styles.launchButtonCopy}>
                        <span className={styles.launchLabel}>{app.label}</span>
                        <span className={styles.launchHint}>{app.environment}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={styles.launchGroup}
            role="group"
            aria-label={`${surface.label} capabilities`}
          >
            {showApps && <span className={styles.launchGroupLabel}>Capabilities</span>}
            <ul className={styles.launchList}>
              {surface.capabilities.map((capability) => (
                <li key={capability}>
                  <button
                    type="button"
                    className={styles.launchButton}
                    onClick={() =>
                      openCanvas(surfaceId, {
                        kind: "capability",
                        title: capability,
                        params: { surface: surfaceId, name: capability },
                      })
                    }
                  >
                    <span className={styles.launchIcon} aria-hidden="true">
                      <PlusIcon width={16} height={16} />
                    </span>
                    <span className={styles.launchLabel}>{capability}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </div>
  );
}
