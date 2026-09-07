import type { AgentSessionStatus } from "@/lib/workspace/model";
import styles from "./StatusDot.module.css";

/**
 * The working/waiting/idle status indicator — a small dot, pulsing while
 * working. The single place the status→color mapping lives, so every surface
 * that shows a session's status (the command palette, the WorkspacePanel; the
 * Code surface's AgentSessionsRail keeps its own copy for now — see plan.md)
 * agrees on the same three colors instead of re-deriving them.
 */
export function StatusDot({ status, className }: { status: AgentSessionStatus; className?: string }) {
  return (
    <span
      className={`${styles.dot} ${styles[status]} ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
