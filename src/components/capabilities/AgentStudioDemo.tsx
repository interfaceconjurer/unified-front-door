"use client";

import Link from "next/link";
import { CheckIcon, SparklesIcon, WorkflowIcon } from "@/components/icons";
import { FLOW_CANVAS, FLOW_READY } from "./capability-fixtures";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import styles from "./AgentStudioDemo.module.css";

export function AgentStudioDemo({ canvasId }: { canvasId: string }) {
  const { state, dispatch } = useControlPlane();
  const flowPrepared = Boolean(state.canvases[FLOW_CANVAS.id]);
  const flowConnected = state.acknowledgedCorrelationIds.includes("corr-flow-sample-01");
  return (
    <section className={styles.studio} aria-labelledby={`canvas-heading-${canvasId}`}>
      <header className={styles.header}>
        <div><p>Agent Studio · Sample Draft</p><h1 id={`canvas-heading-${canvasId}`} tabIndex={-1}>Lead Qualification Agent</h1><span>Agent definition · rev 3</span></div>
        <Link href="/build/agent-studio">Open Agent Studio directly</Link>
      </header>
      <div className={styles.grid}>
        <section className={styles.instructions} aria-labelledby="instructions-heading">
          <p className={styles.eyebrow}>Instructions</p><h2 id="instructions-heading">Qualify before routing</h2>
          <p>Collect company fit and revenue evidence. Explain uncertainty. Route only after qualification criteria are met.</p>
        </section>
        <section className={styles.topics} aria-labelledby="topics-heading">
          <p className={styles.eyebrow}>Topics</p><h2 id="topics-heading">Qualification topics</h2>
          <ul><li><span>01</span><div><strong>Company fit</strong><small>Industry, employee count, operating region</small></div></li><li><span>02</span><div><strong>Commercial intent</strong><small>Use case, timeline, annual revenue</small></div></li><li><span>03</span><div><strong>Routing</strong><small>Enterprise threshold and owner handoff</small></div></li></ul>
        </section>
        <section className={styles.actions} aria-labelledby="actions-heading">
          <p className={styles.eyebrow}>Actions</p><h2 id="actions-heading">Connected capabilities</h2>
          <div className={styles.actionRow}><SparklesIcon width={17} height={17} /><span><strong>Find account context</strong><small>Sample response fixture</small></span><span className={styles.ready}>Ready</span></div>
          {flowConnected ? <div className={`${styles.actionRow} ${styles.connected}`}><WorkflowIcon width={17} height={17} /><span><strong>Route High-Value Leads</strong><small>Build acknowledgement · rev 3</small></span><span className={styles.ready}><CheckIcon width={13} height={13} /> Connected</span></div> : <button type="button" className={styles.prepareFlow} disabled={flowPrepared} onClick={() => dispatch({ type: "CAPABILITY_READY", canvas: FLOW_CANVAS, ready: FLOW_READY, autoOpen: false })}>{flowPrepared ? "Routing Flow ready in conversation" : "Prepare routing Flow suggestion"}</button>}
        </section>
        <section className={styles.test} aria-labelledby="test-heading">
          <p className={styles.eyebrow}>Test conversation</p><h2 id="test-heading">Sample response</h2>
          <div><p><strong>Lead</strong> We expect $420k annual revenue and need US enterprise routing.</p><p><strong>Agent</strong> This meets the sample threshold. I can request the acknowledged routing action after you review it.</p></div>
        </section>
      </div>
      <footer>Interactive prototype · sample data · nothing is saved or run in Salesforce.</footer>
    </section>
  );
}
