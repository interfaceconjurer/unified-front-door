/**
 * Canvas kit — the shared building blocks every dedicated canvas body composes.
 *
 * Each nav item opens a canvas that "roughly makes sense" for it (a project
 * grid, a work-item list, a pipeline board, …). Rather than hand-build each one,
 * canvases are assembled from these few primitives so they stay visually
 * consistent and honest to the SLDS token house style. Everything here is mock,
 * presentational, and wireframe-fidelity — no data, no behavior.
 */
import { Fragment, type ReactNode } from "react";
import type { IconComponent } from "@/components/icons";
import styles from "./canvas-kit.module.css";

/** Semantic status tone. Drives pill / delta / stage-dot color. */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Outer wrapper for a canvas body: centers content and defines the tone vars.
 *  `wide` bumps the max width for surfaces that carry their own side rail (the
 *  project workspace), which also auto-collapses the global rail for the room.
 *  `full` bleeds edge-to-edge and flush to the artboard top, for builder
 *  surfaces that bring their own chrome (a top toolbar over a working area). */
export function CanvasView({
  children,
  wide,
  full,
}: {
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`${styles.view} ${wide ? styles.viewWide : ""} ${full ? styles.viewFull : ""}`}>
      {children}
    </div>
  );
}

/** Canvas title block, with an optional accent icon and a trailing action. */
export function CanvasHeader({
  Icon,
  title,
  subtitle,
  action,
}: {
  Icon?: IconComponent;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        {Icon && (
          <span className={styles.headerIcon} aria-hidden="true">
            <Icon width={22} height={22} />
          </span>
        )}
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

/** Ghost/outline button used for canvas header actions. Wire `onClick` to make it
 *  do something (opening the resource wizard, say); left off, it's an inert mock. */
export function ActionButton({
  Icon,
  children,
  onClick,
}: {
  Icon?: IconComponent;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      {Icon && <Icon width={16} height={16} />}
      <span>{children}</span>
    </button>
  );
}

/** Small status chip. */
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

export type Stat = { label: string; value: string; delta?: string; deltaTone?: Tone };

/** Responsive row of headline metrics. */
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className={styles.tiles}>
      {stats.map((s) => (
        <div key={s.label} className={styles.tile}>
          <span className={styles.tileValue}>{s.value}</span>
          <span className={styles.tileLabel}>{s.label}</span>
          {s.delta && (
            <span className={styles.tileDelta} data-tone={s.deltaTone ?? "neutral"}>
              {s.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export type CardItem = {
  /** Stable React key. Falls back to `title` (unique across today's mock data);
   *  set it when cards are dynamic or titles could repeat. */
  id?: string;
  Icon: IconComponent;
  title: string;
  subtitle?: string;
  meta?: string[];
  status?: { label: string; tone?: Tone };
  /** When set, the whole card becomes an activatable button (opens something). */
  onSelect?: () => void;
};

/** Responsive grid of entity cards (projects, apps, …). */
export function CardGrid({ cards }: { cards: CardItem[] }) {
  return (
    <div className={styles.grid}>
      {cards.map((c) => {
        const inner = (
          <>
            <div className={styles.cardTop}>
              <span className={styles.cardIcon} aria-hidden="true">
                <c.Icon width={20} height={20} />
              </span>
              {c.status && <Pill tone={c.status.tone}>{c.status.label}</Pill>}
            </div>
            <div className={styles.cardText}>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              {c.subtitle && <p className={styles.cardSubtitle}>{c.subtitle}</p>}
            </div>
            {c.meta && c.meta.length > 0 && (
              <ul className={styles.cardMeta}>
                {c.meta.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </>
        );

        if (!c.onSelect) {
          return (
            <article key={c.id ?? c.title} className={styles.card}>
              {inner}
            </article>
          );
        }

        const onSelect = c.onSelect;
        return (
          <article
            key={c.id ?? c.title}
            className={`${styles.card} ${styles.cardClickable}`}
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }}
          >
            {inner}
          </article>
        );
      })}
    </div>
  );
}

/** Titled white card container for arbitrary content (e.g. a chart). */
export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      {(title || action) && (
        <div className={styles.panelHead}>
          {title && <h2 className={styles.panelTitle}>{title}</h2>}
          {action}
        </div>
      )}
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

export type Row = {
  /** Stable React key. Falls back to `primary` (unique across today's mock data);
   *  set it when rows are dynamic or primary text could repeat. */
  id?: string;
  Icon?: IconComponent;
  primary: string;
  /** ReactNode so callers can drop in <Stages /> or rich content. */
  secondary?: ReactNode;
  /** Muted trailing text, e.g. a timestamp. */
  meta?: string;
  /** Right-aligned chips (typically <Pill />). */
  tags?: ReactNode[];
  /** When set, the whole row becomes an activatable button (e.g. opens a file). */
  onSelect?: () => void;
};

/** A titled panel whose body is a divided list of rows. */
export function DataList({
  title,
  action,
  rows,
}: {
  title?: string;
  action?: ReactNode;
  rows: Row[];
}) {
  return (
    <section className={styles.panel}>
      {(title || action) && (
        <div className={styles.panelHead}>
          {title && <h2 className={styles.panelTitle}>{title}</h2>}
          {action}
        </div>
      )}
      <ul className={styles.rows}>
        {rows.map((row) => {
          const inner = (
            <>
              {row.Icon && (
                <span className={styles.rowIcon} aria-hidden="true">
                  <row.Icon width={18} height={18} />
                </span>
              )}
              <div className={styles.rowMain}>
                <span className={styles.rowPrimary}>{row.primary}</span>
                {row.secondary != null && (
                  <span className={styles.rowSecondary}>{row.secondary}</span>
                )}
              </div>
              {row.meta && <span className={styles.rowMetaText}>{row.meta}</span>}
              {row.tags && row.tags.length > 0 && (
                <span className={styles.rowTags}>
                  {row.tags.map((tag, i) => (
                    <Fragment key={i}>{tag}</Fragment>
                  ))}
                </span>
              )}
            </>
          );

          if (!row.onSelect) {
            return (
              <li key={row.id ?? row.primary} className={styles.row}>
                {inner}
              </li>
            );
          }

          const onSelect = row.onSelect;
          return (
            <li
              key={row.id ?? row.primary}
              className={`${styles.row} ${styles.rowClickable}`}
              role="button"
              tabIndex={0}
              onClick={onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect();
                }
              }}
            >
              {inner}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type Step = { label: string; state: "done" | "active" | "failed" | "todo" };

/** Compact pipeline stage indicator: connected dots with labels. */
export function Stages({ steps }: { steps: Step[] }) {
  return (
    <span className={styles.stages}>
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          {i > 0 && <span className={styles.stageBar} aria-hidden="true" />}
          <span className={styles.step}>
            <span className={styles.stageDot} data-state={step.state} aria-hidden="true" />
            <span className={styles.stageLabel}>{step.label}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Wireframe bar chart — a stand-in for a real metrics visualization. */
export function ChartPlaceholder({
  bars = [42, 58, 51, 70, 63, 82, 74, 90, 68, 79, 86, 95],
}: {
  bars?: number[];
}) {
  return (
    <div className={styles.chart} aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className={styles.bar} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
