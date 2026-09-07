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
          <p>Check company fit and annual revenue. Ask when evidence is missing. Route only after the criteria are met.</p>
        </section>
        <section className={styles.topics} aria-labelledby="topics-heading">
          <p className={styles.eyebrow}>Topics</p><h2 id="topics-heading">Qualification topics</h2>
          <ul><li><span>01</span><div><strong>Company fit</strong><small>Industry, size, region</small></div></li><li><span>02</span><div><strong>Commercial intent</strong><small>Use case, timeline, revenue</small></div></li><li><span>03</span><div><strong>Routing</strong><small>Threshold and owner</small></div></li></ul>
        </section>
        <section className={styles.actions} aria-labelledby="actions-heading">
          <h2 id="actions-heading">Actions</h2>
          <div className={styles.actionRow}><SparklesIcon width={17} height={17} /><span><strong>Find account context</strong><small>Sample response fixture</small></span><span className={styles.ready}>Ready</span></div>
          {flowConnected ? <div className={`${styles.actionRow} ${styles.connected}`}><WorkflowIcon width={17} height={17} /><span><strong>Route High-Value Leads</strong><small>Connected · rev 3</small></span><span className={styles.ready}><CheckIcon width={13} height={13} /> Connected</span></div> : flowPrepared ? <p className={styles.flowReadyStatus}><CheckIcon width={14} height={14} aria-hidden="true" /> Routing Flow ready to review</p> : <button type="button" className={styles.prepareFlow} disabled={!state.context} onClick={() => dispatch({ type: "CAPABILITY_READY", canvas: FLOW_CANVAS, ready: FLOW_READY, autoOpen: false })}>{state.context ? "Add routing Flow" : "Open from Front Door to add routing"}</button>}
        </section>
        <section className={styles.test} aria-labelledby="test-heading">
          <p className={styles.eyebrow}>Test conversation</p><h2 id="test-heading">Sample response</h2>
          <div><p><strong>Lead</strong> We expect $420k in annual revenue and need US enterprise support.</p><p><strong>Agent</strong> This meets the sample threshold. Review the routing Flow before trying the sample.</p></div>
        </section>
      </div>
      <footer>Prototype · sample data · nothing is saved or run.</footer>
    </section>
  );
}
