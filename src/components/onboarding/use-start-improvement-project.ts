"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import type { FindingSnapshot } from "@/lib/assessment/model";
import { useAssessment } from "./use-assessment";

/** Acknowledge the durable draft before moving its author into the review. */
export function useStartImprovementProject() {
  const { store } = useAssessment();
  const { captureIntent, openProjectCreation } = useNavigation();
  const [pending, setPending] = useState(false);
  const queued = useSyncExternalStore(store.subscribe, store.isBeginningDraft, () => false);
  const inFlight = useRef(false);
  async function startProject(findings: FindingSnapshot[]) {
    if (inFlight.current || store.isBeginningDraft() || !findings.length) return;
    if (store.getSnapshot().draft) { openProjectCreation(); return; }
    const runId = findings[0]!.runId;
    if (!findings.every(finding => finding.runId === runId)) return;
    const current = captureIntent();
    inFlight.current = true; setPending(true);
    try {
      const draft = await store.beginDraft(runId, {
        name: "Acme org improvements", goal: findings.map(finding => finding.impact).join(" "),
        targetOrgId: "", findingIds: findings.map(finding => finding.id),
      });
      if (draft && current()) openProjectCreation();
    } finally { inFlight.current = false; setPending(false); }
  }
  return { startProject, pending: pending || queued };
}
