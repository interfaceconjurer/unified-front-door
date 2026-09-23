"use client";

import { useState } from "react";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { applicationClient } from "@/lib/application/client";
import styles from "./SessionConnection.module.css";

/** Remains outside the workspace so account/load failures always have a UI. */
export function SessionConnection({ signingOut = false }: { signingOut?: boolean }) {
  const { connectionProblem } = useDemoProfile();
  const [retrying, setRetrying] = useState(false);
  const problem = connectionProblem && !signingOut;
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await applicationClient.reconnect(); } finally { setRetrying(false); }
  }
  return <main className={styles.page}>
    <section className={styles.content} aria-labelledby="session-heading" aria-busy={retrying}>
      <span className={styles.brand}>Platform Studio</span>
      <div role={problem ? "alert" : "status"}>
        {(!problem || retrying) && <span className={styles.spinner} aria-hidden="true" />}
        <h1 id="session-heading">{problem ? "Connection interrupted" : signingOut ? "Opening sign-in…" : "Opening your workspace…"}</h1>
        <p>{problem ? "We couldn’t finish connecting to your workspace. Your saved work is still there. Try again to continue." : "This may take a moment."}</p>
      </div>
      {problem && <button type="button" onClick={() => { void retry(); }} disabled={retrying}>{retrying ? "Connecting…" : "Try again"}</button>}
      {signingOut && <a href="/login">Continue to sign-in</a>}
    </section>
  </main>;
}
