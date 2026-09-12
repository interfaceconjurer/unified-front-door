import type { ReactNode } from "react";
import styles from "./CanvasLayout.module.css";

/** Shared canvas gutters and left-aligned content column. SurfaceCanvasHost
 * supplies this for every overview and launched canvas; bodies pass content
 * without adding their own outer padding, width limits, or auto margins.
 * `wide` accommodates an inner side rail; `full` is for builder-owned chrome. */
export function CanvasLayout({
  children,
  width = "standard",
  className,
}: {
  children: ReactNode;
  width?: "standard" | "wide" | "full";
  className?: string;
}) {
  return (
    <div className={`${styles.layout}${className ? ` ${className}` : ""}`} data-canvas-layout={width}>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
