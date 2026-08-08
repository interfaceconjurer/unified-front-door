import { LayersIcon } from "@/components/icons";
import styles from "./TopBar.module.css";

type TopBarProps = {
  /** Current project scope — the active project's name when a project canvas is
   *  open, else null. Shown next to the brand; absent in any global space. */
  scope: string | null;
  almMode: boolean;
  onToggleAlm: () => void;
};

/**
 * Global top bar: product identity on the left, ALM-mode toggle on the far
 * right. When you're inside a project canvas, the project's name appears next to
 * the brand as a scope indicator — your persistent "you are here"; it disappears
 * in global spaces (Today, the ALM surfaces, …). ALM mode is the global switch
 * for the ALM surfaces — it reveals the rail's top-level ALM items and a
 * project's inner nav (Trust / Work Items / Pipelines / Testing). The flag itself
 * lives in the canvas context.
 */
export function TopBar({ scope, almMode, onToggleAlm }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            P
          </span>
          <span className={styles.brandName}>Platform Studio</span>
        </div>
        {scope && (
          <div className={styles.scope}>
            <span className={styles.scopeDot} aria-hidden="true" />
            <span className={styles.scopeName}>{scope}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.almToggle}
        aria-pressed={almMode}
        onClick={onToggleAlm}
        data-on={almMode || undefined}
      >
        <LayersIcon width={16} height={16} />
        <span className={styles.almLabel}>ALM Mode</span>
        <span className={styles.switch} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </button>
    </header>
  );
}
