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
export function useAssessmentRunner() {
  const { profile } = useDemoProfile();
  const { state, store } = useAssessment();
  const application = useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const persistence = useSyncExternalStore(store.subscribe, store.getPersistenceSnapshot, store.getServerPersistenceSnapshot);
  const agent = applicationClient.agent ?? inactiveAgent;
  const execution = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot);
  useEffect(() => { agent.start(); }, [agent]);
  const enabled = profile?.onboarding === "org-assessment" && !application.legacy && persistence === "saved";
  useEffect(() => {
    if (enabled && execution.ready && (state.status === "idle" || state.status === "running" && !execution.data.runs.some(run => run.assessmentRunId === state.currentRunId))) store.start();
  }, [enabled, execution.ready, execution.data.runs, store, state.status, state.currentRunId]);
  return state;
}
