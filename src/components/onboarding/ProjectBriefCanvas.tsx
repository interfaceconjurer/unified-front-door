"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { CapabilityDraftCanvas } from "@/components/surfaces/CapabilityDraftCanvas";
import { capabilityForCanvas } from "@/components/surfaces/surface-capabilities";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { briefTransferSources } from "@/lib/application/contracts";
import { useAssessment } from "./use-assessment";
import styles from "./onboarding.module.css";

export function ProjectBriefCanvas({ spec }: { spec: CanvasOf<"capability"> }) {
  const { store } = useAssessment();
  const { openImprovementProject, captureIntent } = useNavigation();
  const { openProjectPanel } = useWorkspace();
  const transfers = briefTransferSources(spec.draft?.transferSources);
  const persistence = useSyncExternalStore(store.subscribe, store.getPersistenceSnapshot, store.getServerPersistenceSnapshot);
  const queued = useSyncExternalStore(store.subscribe, () => store.isCreatingFromBrief(spec.id), () => false);
  const inFlight = useRef(false), [creating, setCreating] = useState(false);
  const ready = !!spec.draft?.name?.trim() && !!spec.draft?.goal?.trim();
  async function create() {
    if (inFlight.current || queued || !ready || persistence !== "saved") return;
    const current = captureIntent();
    inFlight.current = true; setCreating(true);
    try {
      const project = await store.createFromBrief(spec.id);
      if (project && current()) { openImprovementProject(project); openProjectPanel(); }
    } finally { inFlight.current = false; setCreating(false); }
  }
  return <div className={styles.projectCanvas}>
    <PersistenceStatus store={store} onlyProblems label="Project creation" />
    <fieldset className={styles.briefingFields} disabled={creating || queued} aria-busy={creating || queued}>
      <CapabilityDraftCanvas surfaceId="alm" capability={capabilityForCanvas("alm", "project")!} spec={spec} />
    </fieldset>
    <div className={styles.selectionBar}>
      <div><strong>Ready to start?</strong><span>{!ready ? "Add a project name and goal to continue." : "Create your project and continue in its own workspace."}</span></div>
      <button type="button" className={styles.primary} disabled={!ready || creating || queued || persistence !== "saved"} onClick={create}>
        {creating || queued ? "Creating project…" : transfers.length ? "Create project and transfer changes" : "Create project"}
      </button>
    </div>
  </div>;
}
