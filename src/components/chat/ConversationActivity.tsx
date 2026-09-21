"use client";

import { useEffect, useState } from "react";
import styles from "./AgentPanel.module.css";

/** Keep feedback outside the scrolling transcript, without moving its content. */
export function ConversationActivity({ active, loading, interrupted }: { active: boolean; loading: boolean; interrupted: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [active]);
  return <span className={styles.activity} role="status" aria-live="polite" aria-atomic="true">
    {active && <><span className={styles.activitySpinner} aria-hidden="true" />
      <span className={styles.activityText}>{interrupted ? "Reconnecting…" : slow ? "Still updating…" : loading ? "Loading conversation…" : "Updating conversation…"}</span>
    </>}
  </span>;
}
