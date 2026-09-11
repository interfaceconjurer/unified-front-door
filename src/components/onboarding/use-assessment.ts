"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { getAssessmentStore } from "@/lib/onboarding/persistence";

export function useAssessment() {
  const { profile } = useDemoProfile();
  const store = getAssessmentStore(profile?.id ?? "jw");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { state, store };
}

/** Mount once at workspace level, so leaving home does not stop the assessment. */
export function useAssessmentRunner() {
  const { profile } = useDemoProfile();
  const { state, store } = useAssessment();
  const enabled = profile?.onboarding === "org-assessment";
  useEffect(() => {
    if (enabled && store.getSnapshot().status === "idle") store.start();
  }, [enabled, store]);
  useEffect(() => {
    if (!enabled || state.status !== "running") return;
    const timer = window.setInterval(store.advance, 1400);
    return () => window.clearInterval(timer);
  }, [enabled, state.status, store]);
  return state;
}
