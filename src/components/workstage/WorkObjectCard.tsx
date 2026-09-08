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
          <p className={styles.eyebrow}>{isFlow ? "Flow" : "Agent"} · {canvas.truthState}</p>
          <h3 id={`work-object-${canvas.id}`}>{canvas.title}</h3>
          <p className={styles.summary}>
            {isFlow ? "4 steps · 1 decision" : "3 topics · 2 actions"}
          </p>
        </div>
        <div className={styles.thumbnail} aria-hidden="true">
          <WorkflowIcon width={22} height={22} />
          <span />
          <span />
        </div>
      </div>
      <p className={styles.ownerLine}>{canvas.ownerLabel} owns this sample{canvas.revision ? ` · ${canvas.revision}` : ""}</p>
      <div className={styles.actions}>
        {active ? (
          <span className={styles.openStatus} data-canvas-invoker={canvas.id}>
            {isFlow ? "Flow open" : "Agent draft open"}
          </span>
        ) : (
          <button type="button" className={styles.primary} data-canvas-invoker={canvas.id} onClick={onOpen}>
            {closed ? (isFlow ? "Reopen Flow" : "Reopen Agent draft") : (isFlow ? "Review Flow" : "Review Agent draft")}
            <ChevronRightIcon width={15} height={15} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onRefine}>Keep discussing</button>
      </div>
      <Link className={styles.directLink} href={canvas.canonicalUrl}>Open in {canvas.ownerLabel}</Link>
    </article>
  );
}
