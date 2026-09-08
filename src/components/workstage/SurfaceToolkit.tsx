import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { surfaceApps } from "@/components/front-door/app-catalog";
import styles from "./AgentWorkstage.module.css";

export function SurfaceToolkit({ onOpenToolkit }: { onOpenToolkit: () => void }) {
  return (
    <section className={styles.surfaceToolkit} aria-labelledby="surface-toolkit-heading">
      <header className={styles.surfaceToolkitHeader}>
        <h2 id="surface-toolkit-heading">Explore surfaces</h2>
        <button type="button" onClick={onOpenToolkit}>
          Open toolkit
          <kbd>⌘⇧P</kbd>
        </button>
      </header>
      <ul className={styles.surfaceList}>
        {surfaceApps.map((surface) => (
          <li key={surface.id}>
            <Link href={surface.href}>
              <span className={styles.surfaceIcon} aria-hidden="true">
                <surface.Icon width={20} height={20} />
              </span>
              <span className={styles.surfaceCopy}>
                <strong>{surface.label}</strong>
                <small>{surface.description}</small>
              </span>
              <ChevronRightIcon className={styles.surfaceChevron} width={17} height={17} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
