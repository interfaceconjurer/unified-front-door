import Link from "next/link";
import { ChevronRightIcon, SparklesIcon } from "@/components/icons";
import type { SurfaceApp } from "@/components/front-door/app-catalog";
import styles from "./SurfacePlaceholder.module.css";

type SurfacePlaceholderProps = {
  surface: SurfaceApp;
};

/**
 * A deliberately light placeholder showing that each destination can own its
 * information architecture beneath the one shared top bar.
 */
export function SurfacePlaceholder({ surface }: SurfacePlaceholderProps) {
  return (
    <div className={styles.surface}>
      <aside className={styles.localRail}>
        <div className={styles.appIdentity}>
          <span className={styles.appIcon} aria-hidden="true">
            <surface.Icon width={22} height={22} />
          </span>
          <span>{surface.label}</span>
        </div>

        <nav aria-label={`${surface.label} navigation`}>
          <ul className={styles.localNav}>
            {surface.navigation.map((item, index) => (
              <li key={item}>
                <span
                  className={styles.localNavItem}
                  aria-current={index === 0 ? "page" : undefined}
                  data-current={index === 0 || undefined}
                  data-disabled={index !== 0 || undefined}
                >
                  <span>{item}</span>
                  {index !== 0 && <span className={styles.soon}>Soon</span>}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/" className={styles.backLink}>
          Back to Front Door
        </Link>
      </aside>

      <section className={styles.workspace} aria-labelledby="surface-heading">
        <header className={styles.workspaceHeader}>
          <div>
            <div className={styles.status}>Purpose-built app prototype</div>
            <h1 id="surface-heading">{surface.label}</h1>
            <p>{surface.workspaceDescription}</p>
          </div>
          <span className={styles.prototypeBadge}>Placeholder</span>
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

          <div className={styles.agentCallout}>
            <SparklesIcon width={19} height={19} />
            <span>
              Use <strong>Ask Agent</strong> in the top bar to open the shared
              agent on the left without leaving this app.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
