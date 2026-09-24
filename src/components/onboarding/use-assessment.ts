"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { applicationClient, getActiveAssessmentStore } from "@/lib/application/client";
import { inactiveAgent } from "@/lib/agent/client";

export function useAssessment() {
  useDemoProfile();
  const store = getActiveAssessmentStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { state, store };
}

/** Mount once at workspace level, so leaving home does not stop the assessment. */
export function useAssessmentRunner(orgId: string | null) {
  const { profile } = useDemoProfile();
  const { state, store } = useAssessment();
  const persistence = useSyncExternalStore(store.subscribe, store.getPersistenceSnapshot, store.getServerPersistenceSnapshot);
  const agent = applicationClient.agent ?? inactiveAgent;
  const execution = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  useEffect(() => { agent.start(); }, [agent]);
  // Legacy browser records are an optional, explicit import. Their presence
  // must not block work in the independently saved server workspace.
  const enabled = profile?.onboarding === "org-assessment" && persistence === "saved";
  useEffect(() => {
    if (!enabled || !execution.ready) return;
    // Only the first assessment is automatic. Switching connections never
    // starts another scan or retargets an in-flight worker.
    if (state.status === "idle" && !state.runs.length && orgId) store.start(orgId);
    else if (state.status === "running" && !execution.data.runs.some(run => run.assessmentRunId === state.currentRunId)) store.start();
  }, [enabled, execution.ready, execution.data.runs, store, state.status, state.currentRunId, state.runs.length, orgId]);
}
