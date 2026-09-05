import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { surfaceApps } from "./app-catalog";
import styles from "./AppLauncher.module.css";

/**
 * The front door's right half: a direct launcher into each purpose-built
 * surface. The agent that used to share this screen now lives in the shell, so
 * this is purely the "distinct rooms" side of "one front door, distinct rooms."
 */
export function AppLauncher() {
  return (
    <section className={styles.launcher} aria-labelledby="apps-heading">
      <div className={styles.launcherHeading}>
        <div>
          <h2 id="apps-heading">Your building surfaces</h2>
          <p>Go directly to a dedicated workspace.</p>
        </div>
        <span className={styles.appCount}>4 apps</span>
      </div>

      <ul className={styles.appGrid}>
        {surfaceApps.map((surface) => (
          <li key={surface.id}>
            <Link href={surface.href} className={styles.appLink}>
              <span className={styles.appIcon} aria-hidden="true">
                <surface.Icon width={22} height={22} />
              </span>
              <span className={styles.appCopy}>
                <strong>{surface.label}</strong>
                <span>{surface.description}</span>
              </span>
              <ChevronRightIcon className={styles.chevron} width={18} height={18} />
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.launcherNote}>
        <strong>One front door, distinct rooms.</strong>
        <span>
          Each app can evolve around its own users and jobs while the agent and
          top bar keep the whole platform connected.
        </span>
      </div>
    </section>
  );
}
