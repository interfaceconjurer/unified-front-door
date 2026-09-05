"use client";

import {
  DatabaseIcon,
  FileIcon,
  GitBranchIcon,
  LayersIcon,
  ListCheckIcon,
  PuzzleIcon,
  ShieldIcon,
  SparklesIcon,
  WorkflowIcon,
  type IconComponent,
} from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  projectionForSurface,
  type ProjectionInsight,
  type ProjectionMetric,
} from "@/lib/workspace/projections";
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
};

/**
 * A surface body rendered as a *projection* of the active project. It reads the
 * shell-level workspace (project + target org) and asks the projection module
 * what this particular lens should show, then lays it out: a lead, the facet
 * metrics this lens centers on, and lens-specific insights. Switching project or
 * org re-projects in place; switching surface re-frames the same project — the
 * whole point of the front door.
 */
export function SurfaceProjection({ surfaceId, toolbar }: SurfaceProjectionProps) {
  const surface = surfaceAppById(surfaceId);
  const { activeProject, activeOrg } = useWorkspace();
  const projection = projectionForSurface(surface.id, activeProject, activeOrg);

  return (
    <div className={styles.surface}>
      <section className={styles.workspace} aria-labelledby="surface-heading">
        <header className={styles.header}>
          <div className={styles.headingText}>
            <div className={styles.kicker}>
              <surface.Icon width={15} height={15} aria-hidden="true" />
              {surface.label} · {activeProject.name}
            </div>
            <h1 id="surface-heading">{surface.label}</h1>
            <p className={styles.lead}>{projection.lead}</p>
          </div>
          {toolbar}
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

        <footer className={styles.actions}>
          <span className={styles.actionsLabel}>In {surface.label} you can</span>
          <ul className={styles.actionChips}>
            {surface.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </footer>
      </section>
    </div>
  );
}
