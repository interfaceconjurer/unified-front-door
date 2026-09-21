import type { CSSProperties } from "react";

/** Reading order for the active briefing's shared CSS reveal. */
export function todayRow(order: number) {
  return { "data-today-row": order, style: { "--today-order": order } as CSSProperties };
}
