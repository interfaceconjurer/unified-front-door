import Link from "next/link";
import { ChevronRightIcon, WorkflowIcon } from "@/components/icons";
import type { CanvasRecord } from "@/components/capabilities/capability-model";
import styles from "./WorkObjectCard.module.css";

type WorkObjectCardProps = {
  canvas: CanvasRecord;
  active?: boolean;
  closed?: boolean;
  onOpen: () => void;
  onRefine: () => void;
};

export function WorkObjectCard({ canvas, active, closed, onOpen, onRefine }: WorkObjectCardProps) {
  const isFlow = canvas.capabilityId === "build.flow";
  return (
    <article className={styles.card} aria-labelledby={`work-object-${canvas.id}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{isFlow ? "Flow draft" : "Agent draft"} · Ready</p>
          <h3 id={`work-object-${canvas.id}`}>{canvas.title}</h3>
          <p className={styles.summary}>
            {isFlow ? "6 nodes · 2 unresolved decisions" : "3 topics · 2 actions · test response ready"}
          </p>
        </div>
        <div className={styles.thumbnail} aria-hidden="true">
          <WorkflowIcon width={22} height={22} />
          <span />
          <span />
        </div>
      </div>
      <dl className={styles.meta}>
        <div><dt>Truth</dt><dd>{canvas.truthState}</dd></div>
        <div><dt>Owner</dt><dd>{canvas.ownerLabel}</dd></div>
        {canvas.revision && <div><dt>Freshness</dt><dd>{canvas.revision}</dd></div>}
      </dl>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          data-canvas-invoker={canvas.id}
          onClick={onOpen}
          disabled={active}
        >
          {active ? "Canvas open" : closed ? "Reopen canvas" : "Open editable canvas"}
          {!active && <ChevronRightIcon width={15} height={15} aria-hidden="true" />}
        </button>
        <button type="button" className={styles.secondary} onClick={onRefine}>
          Keep refining here
        </button>
      </div>
      <p className={styles.disclosure}>
        {canvas.ownerLabel} owned · interactive sample structure · nothing is saved or run in Salesforce
      </p>
      <Link className={styles.directLink} href={canvas.canonicalUrl}>
        Open directly in {canvas.ownerLabel}
      </Link>
    </article>
  );
}
