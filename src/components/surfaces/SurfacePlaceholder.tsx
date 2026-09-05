import { ChevronRightIcon } from "@/components/icons";
import type { SurfaceApp } from "@/components/front-door/app-catalog";
import styles from "./SurfacePlaceholder.module.css";

type SurfacePlaceholderProps = {
  surface: SurfaceApp;
  /** Surface-specific header control (e.g. the Code surface's worktree switcher).
   *  Surfaces that expose more of the project than others put their lens control
   *  here; when omitted the header just shows the prototype badge. */
  toolbar?: React.ReactNode;
};

/**
 * A deliberately light placeholder showing that each destination can own its
 * information architecture beneath the one shared top bar, alongside the
 * persistent agent panel on the left.
 */
export function SurfacePlaceholder({ surface, toolbar }: SurfacePlaceholderProps) {
  return (
    <div className={styles.surface}>
      <section className={styles.workspace} aria-labelledby="surface-heading">
        <header className={styles.workspaceHeader}>
          <div>
            <div className={styles.status}>Purpose-built app prototype</div>
            <h1 id="surface-heading">{surface.label}</h1>
            <p>{surface.workspaceDescription}</p>
          </div>
          {toolbar ?? <span className={styles.prototypeBadge}>Placeholder</span>}
        </header>

        <div className={styles.canvas}>
          <div className={styles.canvasIntro}>
            <span className={styles.largeIcon} aria-hidden="true">
              <surface.Icon width={32} height={32} />
            </span>
            <h2>A workspace shaped for this job</h2>
            <p>
              This is intentionally a shell. {surface.label} can develop its own
              workflows, navigation, and interaction model without losing the
              shared platform wayfinder.
            </p>
          </div>

          <ul className={styles.capabilities}>
            {surface.capabilities.map((capability) => (
              <li key={capability}>
                <span>{capability}</span>
                <ChevronRightIcon width={17} height={17} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
