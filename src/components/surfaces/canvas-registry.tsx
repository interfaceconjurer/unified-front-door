"use client";

import { BoxIcon, ClipboardIcon, FileIcon, LinkIcon, ListCheckIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { CanvasSpec, LaunchableCanvasKind } from "@/lib/surface-canvas/model";
import { APP_STATUS_LABEL } from "@/lib/workspace/selectors";
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

/** A single deployed app's ops/observe view — the canvas an app row in the
 *  WorkspacePanel opens. Its params (projectId + appId) resolve the app from the
 *  live workspace, so switching project or a deploy landing re-scopes it in
 *  place, same as the other canvases. Shows the live URL as a real link and the
 *  deploy facts (environment / status / last deployed); the status reuses the
 *  panel's restrained per-state hues so a status reads the same in either place.
 *  If the app can't be resolved (removed/renamed since the tab was opened) it
 *  degrades to the same quiet placeholder an unknown kind gets. */
function AppCanvas({ spec }: { spec: CanvasSpec }) {
  const { projects } = useWorkspace();
  const project = projects.find((p) => p.id === spec.params?.projectId);
  const app = project?.apps.find((a) => a.id === spec.params?.appId);

  if (!project || !app) {
    return <PlaceholderCanvas title={spec.title} meta="This app is no longer available." />;
  }

  return (
    <article className={styles.canvas}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <BoxIcon width={18} height={18} />
        </span>
        <div>
          <h2 className={styles.title}>{spec.title}</h2>
          <p className={styles.meta}>Deployed app · {project.name}</p>
        </div>
      </header>
      <a className={styles.appUrl} href={app.url} target="_blank" rel="noreferrer">
        <LinkIcon width={14} height={14} aria-hidden="true" />
        <span className={styles.appUrlText}>{app.url}</span>
      </a>
      <dl className={styles.appFacts}>
        <div className={styles.appFact}>
          <dt className={styles.appFactLabel}>Environment</dt>
          <dd className={styles.appFactValue}>{app.environment}</dd>
        </div>
        <div className={styles.appFact}>
          <dt className={styles.appFactLabel}>Status</dt>
          <dd className={`${styles.appFactValue} ${styles.appStatus} ${styles[`appStatus-${app.status}`]}`}>
            {APP_STATUS_LABEL[app.status]}
          </dd>
        </div>
        <div className={styles.appFact}>
          <dt className={styles.appFactLabel}>Last deployed</dt>
          <dd className={styles.appFactValue}>{app.lastDeployed}</dd>
        </div>
      </dl>
    </article>
  );
}

const CANVAS_COMPONENTS: Record<LaunchableCanvasKind, CanvasComponent> = {
  notes: NotesCanvas,
  activity: ActivityCanvas,
  app: AppCanvas,
};

/** The quiet fallback shape — a header-only canvas whose message sits in the
 *  meta slot. Rendered for a kind this build no longer knows (a stale persisted
 *  tab) and reused by `AppCanvas` when its app can't be resolved, so both
 *  degrade to the same empty canvas rather than a broken tab. */
function PlaceholderCanvas({ title, meta }: { title: string; meta: string }) {
  return (
    <article className={styles.canvas}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <ClipboardIcon width={18} height={18} />
        </span>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.meta}>{meta}</p>
        </div>
      </header>
    </article>
  );
}

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
    return <PlaceholderCanvas title={spec.title} meta="This canvas kind isn’t available in this build." />;
  }
  return <Component spec={spec} />;
}
