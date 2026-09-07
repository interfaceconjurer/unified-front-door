"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  DatabaseIcon,
  GitBranchIcon,
  SparklesIcon,
  WorkflowIcon,
  type IconComponent,
} from "@/components/icons";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import type { FlowNodeId } from "@/components/control-plane/control-plane-fixtures";
import { artifactIsOpen, type JourneyPhase } from "@/components/control-plane/control-plane-model";
import { SurfaceProjection } from "@/components/surfaces/SurfaceProjection";
import { useWorkspace } from "@/components/workspace/workspace-context";
import styles from "./FlowAutomationDemo.module.css";

const NODE_ICON: Record<"trigger" | "lookup" | "decision" | "action", IconComponent> = {
  trigger: SparklesIcon,
  lookup: DatabaseIcon,
  decision: GitBranchIcon,
  action: WorkflowIcon,
};

const AGENT_REFERENCE_PHASES: readonly JourneyPhase[] = [
  "node-referenced",
  "preview-complete",
  "ready",
];

/** Build-owned artifact presentation for the deterministic control-plane journey. */
export function FlowAutomationDemo() {
  const { state, artifact, dispatch } = useControlPlane();
  const { activeProject, activeOrg } = useWorkspace();
  const [manualSelection, setManualSelection] = useState<{
    id: FlowNodeId;
    phase: JourneyPhase;
  }>({ id: "start", phase: "artifact-open" });
  const previousPhase = useRef(state.phase);
  const open = artifactIsOpen(state.phase);

  const agentReferencedDecision = AGENT_REFERENCE_PHASES.includes(state.phase);
  const selectedNodeId =
    manualSelection.phase === state.phase
      ? manualSelection.id
      : agentReferencedDecision
        ? "high-value"
        : manualSelection.id;
  const selectedNode = artifact.nodes.find((node) => node.id === selectedNodeId) ?? artifact.nodes[0]!;
  const previewVisible = state.phase === "preview-complete" || state.phase === "ready";

  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = state.phase;
    if (previous === state.phase) return;

    if (state.phase === "artifact-open") {
      requestAnimationFrame(() => document.getElementById("flow-artifact-heading")?.focus());
    } else if (state.phase === "node-referenced") {
      requestAnimationFrame(() => document.getElementById("flow-node-high-value")?.focus());
    } else if (state.phase === "preview-complete") {
      requestAnimationFrame(() => document.getElementById("flow-preview-heading")?.focus());
    }
  }, [state.phase]);

  if (!open) return <SurfaceProjection surfaceId="build" />;

  return (
    <section className={styles.surface} aria-labelledby="flow-artifact-heading">
      <header className={styles.artifactHeader}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>Build & Setup · {activeProject.name}</p>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden="true">
              <WorkflowIcon width={22} height={22} />
            </span>
            <div>
              <h1 id="flow-artifact-heading" tabIndex={-1}>
                Flow · {artifact.name}
              </h1>
              <p>Routes high-value Leads while keeping the draft inspectable in Build.</p>
            </div>
          </div>
        </div>
        <div className={styles.statusGroup} aria-label="Artifact status">
          <span className={styles.draftStatus}>Draft</span>
          {previewVisible && (
            <span className={styles.validatedStatus}>
              <CheckIcon width={14} height={14} aria-hidden="true" />
              Validated
            </span>
          )}
        </div>
      </header>

      <div className={styles.workArea}>
        <div className={styles.canvas} aria-label="Route High-Value Leads Flow">
          <div className={styles.canvasHeader}>
            <div>
              <h2>Flow path</h2>
              <p>Select an element to inspect the surface-owned configuration.</p>
            </div>
            <span className={styles.fixtureBadge}>Prototype fixture</span>
          </div>

          <div className={styles.flow}>
            {artifact.nodes.map((node, index) => {
              const Icon = NODE_ICON[node.kind];
              const selected = node.id === selectedNodeId;
              return (
                <div key={node.id} className={styles.flowStep}>
                  {index > 0 && (
                    <span className={styles.connector} aria-hidden="true">
                      <span />
                    </span>
                  )}
                  {node.id === "assign-queue" && (
                    <span className={styles.yesLabel} aria-hidden="true">
                      Yes
                    </span>
                  )}
                  <button
                    id={`flow-node-${node.id}`}
                    type="button"
                    className={`${styles.node} ${selected ? styles.nodeSelected : ""}`}
                    aria-pressed={selected}
                    onClick={() => {
                      setManualSelection({ id: node.id, phase: state.phase });
                      if (node.id === "high-value" && state.phase === "artifact-open") {
                        dispatch({ type: "REFERENCE_DECISION" });
                      }
                    }}
                  >
                    <span className={styles.nodeIcon} aria-hidden="true">
                      <Icon width={18} height={18} />
                    </span>
                    <span className={styles.nodeCopy}>
                      <strong>{node.label}</strong>
                      <small>{node.detail}</small>
                    </span>
                    {selected && <span className={styles.selectedTag}>Selected</span>}
                  </button>
                </div>
              );
            })}
            <div className={styles.noPath} aria-label="No path keeps the current owner">
              <span>No</span>
              Keep current owner
            </div>
          </div>
        </div>

        <aside className={styles.inspector} aria-labelledby="inspector-heading">
          <p className={styles.inspectorEyebrow}>Selection inspector</p>
          <h2 id="inspector-heading">{selectedNode.label}</h2>
          <p>{selectedNode.detail}</p>

          {selectedNode.id === "high-value" ? (
            <dl className={styles.details}>
              <div>
                <dt>Resource</dt>
                <dd>Lead.AnnualRevenue</dd>
              </div>
              <div>
                <dt>Operator</dt>
                <dd>Greater than or equal</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>$250,000</dd>
              </div>
              <div>
                <dt>Yes path</dt>
                <dd>Enterprise Queue</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.inspectorHint}>
              The agent can point to a decision, but this surface remains the authoritative view.
            </p>
          )}

          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <div>
                <p className={styles.inspectorEyebrow}>Deterministic preview</p>
                <h2 id="flow-preview-heading" tabIndex={-1}>
                  {previewVisible ? "Preview passed" : "Test the routing path"}
                </h2>
              </div>
              {previewVisible && (
                <span className={styles.previewCheck} aria-hidden="true">
                  <CheckIcon width={18} height={18} />
                </span>
              )}
            </div>

            {previewVisible ? (
              <dl className={styles.previewResult}>
                <div>
                  <dt>Lead</dt>
                  <dd>{artifact.preview.record}</dd>
                </div>
                <div>
                  <dt>Annual Revenue</dt>
                  <dd>{artifact.preview.annualRevenue}</dd>
                </div>
                <div>
                  <dt>Path</dt>
                  <dd>{artifact.preview.path}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>{artifact.preview.outcome}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.previewHint}>
                Use one fixture Lead to verify the decision without saving or changing {activeOrg.label}.
              </p>
            )}

            <button
              id="flow-preview-button"
              type="button"
              className={styles.previewButton}
              onClick={() => dispatch({ type: "RUN_PREVIEW" })}
            >
              {previewVisible ? "Preview again" : "Run preview"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
