"use client";

import { ClipboardIcon, FileIcon, ListCheckIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { CanvasSpec, LaunchableCanvasKind } from "@/lib/surface-canvas/model";
import styles from "./canvas-registry.module.css";

/**
 * The kind→component registry: how a stored, serializable `CanvasSpec` becomes
 * rendered content. The persisted store only ever holds specs (id/kind/title/
 * params), so a canvas's UI is resolved here at render time rather than kept in
 * state — the seam that keeps the whole open-tab set round-tripping through
 * `localStorage`. Adding a launchable kind means adding a `LAUNCHABLE_KINDS`
 * entry (in the model) and a matching entry here; the `Record` type makes a
 * missing one a compile error.
 *
 * Content is intentionally prototype-grade — enough to prove a launched tab is
 * a real, project-aware surface, not to be the actual ops view (that's later
 * phases). Each canvas reads the shell workspace so switching project re-scopes
 * it in place, the same contract `SurfaceProjection` honors.
 */

type CanvasComponent = (props: { spec: CanvasSpec }) => React.ReactElement;

/** A scratch note — the simplest "empty editor" a launch pad can spawn. Its
 *  params carry a per-note number so several can coexist as distinct tabs. */
function NotesCanvas({ spec }: { spec: CanvasSpec }) {
  const { activeProject } = useWorkspace();
  return (
    <article className={styles.canvas}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <FileIcon width={18} height={18} />
        </span>
        <div>
          <h2 className={styles.title}>{spec.title}</h2>
          <p className={styles.meta}>Scratch note · {activeProject.name}</p>
        </div>
      </header>
      <p className={styles.body}>
        A throwaway surface for capturing a thought without leaving the workstage.
        Closing the tab discards it — this is the prototype stand-in for a real,
        persisted note kind.
      </p>
      <textarea
        className={styles.scratch}
        aria-label={`${spec.title} scratch area`}
        placeholder="Jot something…"
        rows={8}
      />
    </article>
  );
}

/** A project-scoped activity feed — a singleton launch (no params) so
 *  re-launching it focuses the open tab rather than stacking duplicates. */
function ActivityCanvas({ spec }: { spec: CanvasSpec }) {
  const { activeProject, activeWorktree } = useWorkspace();
  const events = [
    { tone: "info" as const, when: "just now", text: `Opened activity for ${activeWorktree.label}.` },
    { tone: "neutral" as const, when: "2m ago", text: "Agent finished a scoped edit." },
    { tone: "caution" as const, when: "1h ago", text: "Deploy check flagged a permission set." },
  ];
  return (
    <article className={styles.canvas}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <ListCheckIcon width={18} height={18} />
        </span>
        <div>
          <h2 className={styles.title}>{spec.title}</h2>
          <p className={styles.meta}>Recent activity · {activeProject.name}</p>
        </div>
      </header>
      <ol className={styles.feed}>
        {events.map((event) => (
          <li key={event.text} className={styles.event}>
            <span className={`${styles.dot} ${styles[event.tone]}`} aria-hidden="true" />
            <span className={styles.eventText}>{event.text}</span>
            <span className={styles.eventWhen}>{event.when}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

const CANVAS_COMPONENTS: Record<LaunchableCanvasKind, CanvasComponent> = {
  notes: NotesCanvas,
  activity: ActivityCanvas,
};

/**
 * Resolve a launched canvas spec to its content. Falls back to a quiet
 * placeholder for a kind the current build no longer knows — a persisted tab
 * from an older version — so a stale entry degrades to an empty canvas instead
 * of throwing. (The parser drops unknown kinds on load, so this is belt-and-
 * suspenders for the same-session case.)
 */
export function CanvasContent({ spec }: { spec: CanvasSpec }) {
  const Component = spec.kind === "overview" ? undefined : CANVAS_COMPONENTS[spec.kind];
  if (!Component) {
    return (
      <article className={styles.canvas}>
        <header className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <ClipboardIcon width={18} height={18} />
          </span>
          <div>
            <h2 className={styles.title}>{spec.title}</h2>
            <p className={styles.meta}>This canvas kind isn’t available in this build.</p>
          </div>
        </header>
      </article>
    );
  }
  return <Component spec={spec} />;
}
