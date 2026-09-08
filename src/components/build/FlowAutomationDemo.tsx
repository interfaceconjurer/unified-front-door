"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon, DatabaseIcon, GitBranchIcon, SparklesIcon, WorkflowIcon, type IconComponent } from "@/components/icons";
import { FLOW_LAUNCH } from "@/components/capabilities/capability-fixtures";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import { FLOW_ARTIFACT, type FlowNodeId } from "@/components/control-plane/control-plane-fixtures";
import { SurfaceProjection } from "@/components/surfaces/SurfaceProjection";
import styles from "./FlowAutomationDemo.module.css";

const NODE_ICON: Record<"trigger" | "lookup" | "decision" | "action", IconComponent> = { trigger: SparklesIcon, lookup: DatabaseIcon, decision: GitBranchIcon, action: WorkflowIcon };

/** Build-owned capability adapter. The host receives only generic ready/result envelopes. */
export function FlowAutomationDemo({ embedded = false, canvasId = "direct-build-flow" }: { embedded?: boolean; canvasId?: string }) {
  const { state, dispatch } = useControlPlane();
  const [selectedNodeId, setSelectedNodeId] = useState<FlowNodeId>("start");
  const [sampleVisible, setSampleVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => () => {
    pendingRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const selectedNode = FLOW_ARTIFACT.nodes.find((node) => node.id === selectedNodeId) ?? FLOW_ARTIFACT.nodes[0]!;
  const acknowledged = state.acknowledgedCorrelationIds.includes(FLOW_LAUNCH.correlationId);
  const pending = state.pendingAction?.canvasId === canvasId;

  useEffect(() => {
    pendingRef.current = pending;
    if (!pending && timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [pending]);

  if (!embedded) return <SurfaceProjection surfaceId="build" />;

  function showSampleOutcome() {
    pendingRef.current = true;
    dispatch({
      type: "CAPABILITY_ACTION_PENDING",
      canvasId,
      instanceId: FLOW_LAUNCH.instanceId,
      actionId: "flow.show-sample-outcome",
      correlationId: FLOW_LAUNCH.correlationId,
    });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!pendingRef.current) return;
      setSampleVisible(true);
      dispatch({
        type: "CAPABILITY_RESULT",
        canvasId,
        instanceId: FLOW_LAUNCH.instanceId,
        result: {
          actionId: "flow.show-sample-outcome",
          correlationId: FLOW_LAUNCH.correlationId,
          status: "succeeded",
          userSummary: "Sample result acknowledged. Edge Communications routes to Enterprise Queue.",
          resumeRef: "resume_flow_b82a",
          artifactRevision: "rev 3",
        },
      });
    }, 450);
  }

  return (
    <section className={styles.surface} aria-labelledby={`canvas-heading-${canvasId}`}>
      <header className={styles.artifactHeader}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>Build & Setup · {state.context?.label ?? "Sample context"}</p>
          <div className={styles.titleRow}><span className={styles.titleIcon} aria-hidden="true"><WorkflowIcon width={22} height={22} /></span><div><h1 id={`canvas-heading-${canvasId}`} tabIndex={-1}>Flow · {FLOW_ARTIFACT.name}</h1><p>Routes qualified leads to the right owner.</p></div></div>
        </div>
        <div className={styles.statusGroup} aria-label="Artifact status"><span className={styles.draftStatus}>Sample Draft</span>{acknowledged && <span className={styles.validatedStatus}><CheckIcon width={14} height={14} aria-hidden="true" />Result acknowledged</span>}<Link href="/build">Open directly</Link></div>
      </header>
      <div className={styles.workArea}>
        <div className={styles.canvas} aria-label="Route High-Value Leads Flow">
          <div className={styles.canvasHeader}><div><h2>Flow path</h2><p>Select a step to review it.</p></div><span className={styles.fixtureBadge}>Sample</span></div>
          <div className={styles.flow}>
            {FLOW_ARTIFACT.nodes.map((node, index) => { const Icon = NODE_ICON[node.kind]; const selected = node.id === selectedNodeId; return <div key={node.id} className={styles.flowStep}>{index > 0 && <span className={styles.connector} aria-hidden="true"><span /></span>}{node.id === "assign-queue" && <span className={styles.yesLabel} aria-hidden="true">Yes</span>}<button id={`flow-node-${node.id}`} type="button" className={`${styles.node} ${selected ? styles.nodeSelected : ""}`} aria-pressed={selected} onClick={() => setSelectedNodeId(node.id)}><span className={styles.nodeIcon} aria-hidden="true"><Icon width={18} height={18} /></span><span className={styles.nodeCopy}><strong>{node.label}</strong><small>{node.detail}</small></span>{selected && <span className={styles.selectedTag}>Selected</span>}</button></div>; })}
            <div className={styles.noPath} aria-label="No path keeps the current owner"><span>No</span>Keep current owner</div>
          </div>
        </div>
        <aside className={styles.inspector} aria-labelledby="inspector-heading">
          <p className={styles.inspectorEyebrow}>Selection inspector</p><h2 id="inspector-heading">{selectedNode.label}</h2><p>{selectedNode.detail}</p>
          {selectedNode.id === "high-value" ? <dl className={styles.details}><div><dt>Resource</dt><dd>Lead.AnnualRevenue</dd></div><div><dt>Operator</dt><dd>Greater than or equal</dd></div><div><dt>Value</dt><dd>$250,000</dd></div><div><dt>Yes path</dt><dd>Enterprise Queue</dd></div></dl> : <p className={styles.inspectorHint}>Build owns this configuration.</p>}
          <div className={styles.preview}><div className={styles.previewHeader}><div><p className={styles.inspectorEyebrow}>Sample data</p><h2 id="flow-preview-heading" tabIndex={-1}>{sampleVisible ? "Sample outcome" : "Try the sample lead"}</h2></div>{sampleVisible && <span className={styles.previewCheck} aria-hidden="true"><CheckIcon width={18} height={18} /></span>}</div>
            {sampleVisible ? <dl className={styles.previewResult}><div><dt>Lead</dt><dd>{FLOW_ARTIFACT.preview.record}</dd></div><div><dt>Annual Revenue</dt><dd>{FLOW_ARTIFACT.preview.annualRevenue}</dd></div><div><dt>Path</dt><dd>{FLOW_ARTIFACT.preview.path}</dd></div><div><dt>Outcome</dt><dd>{FLOW_ARTIFACT.preview.outcome}</dd></div></dl> : <p className={styles.previewHint}>Uses sample data only.</p>}
            <button id="flow-preview-button" type="button" className={styles.previewButton} disabled={pending} onClick={showSampleOutcome}>{pending ? "Checking…" : sampleVisible ? "Try again" : "Try sample"}</button>
            <p className={styles.focusHint}>Prototype · sample data · nothing is saved or run.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
