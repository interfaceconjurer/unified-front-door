"use client";

import { usePathname } from "next/navigation";
import { SparklesIcon } from "@/components/icons";
import { surfaceAppForPath } from "@/components/front-door/app-catalog";
import { AgentWorkstage } from "@/components/workstage/AgentWorkstage";
import styles from "./AgentPanel.module.css";

/** The persistent Agent seam; Home owns the full workstage, direct routes keep a compact companion. */
export function AgentPanel({ onOpenToolkit }: { onOpenToolkit: () => void }) {
  const pathname = usePathname();
  if (pathname === "/") return <AgentWorkstage onOpenToolkit={onOpenToolkit} />;

  const surface = surfaceAppForPath(pathname);
  return (
    <section className={styles.agent} aria-labelledby="surface-agent-heading">
      <header className={styles.heading}>
        <span className={styles.avatar} aria-hidden="true"><SparklesIcon width={20} height={20} /></span>
        <div className={styles.headingText}>
          <p className={styles.kicker}>Agent</p>
          <h2 id="surface-agent-heading">Working alongside {surface?.label ?? "this capability"}</h2>
          <p className={styles.intro}>The capability owns the artifact and its actions. The Agent can explain and coordinate.</p>
        </div>
      </header>
      <div className={styles.transcript} role="log">
        <div className={`${styles.message} ${styles.agentMessage}`}><div className={styles.bubble}>Direct access remains available without starting or resuming a Front Door conversation.</div></div>
      </div>
      <div className={styles.promptArea}>
        <form className={styles.composer} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.srOnly} htmlFor="surface-agent-composer">Message the agent</label>
          <textarea id="surface-agent-composer" rows={2} placeholder={`Ask about ${surface?.label ?? "this capability"}…`} />
          <button type="submit" disabled aria-label="Send message">↑</button>
        </form>
        <p className={styles.composerHint}>Prototype · no model or org actions are connected.</p>
      </div>
    </section>
  );
}
