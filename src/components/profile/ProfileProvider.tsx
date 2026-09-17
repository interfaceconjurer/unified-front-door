"use client";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { demoProfileById, type DemoProfile, type DemoProfileId } from "@/lib/demo-profiles";
import { applicationClient, getActiveAssessmentStore, type ProfileResetResult } from "@/lib/application/client";

type ProfileContextValue = {
  profile: DemoProfile | null; resolved: boolean; sessionKey: string;
  signIn: (id: DemoProfileId) => Promise<boolean>; signOut: () => Promise<boolean>;
  clearData: (id: DemoProfileId) => Promise<ProfileResetResult>;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);
export function ProfileProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  useEffect(() => { applicationClient.start(); }, []);
  const session = state.session;
  const assessmentStore = getActiveAssessmentStore();
  useSyncExternalStore(assessmentStore.subscribe, assessmentStore.getSnapshot, assessmentStore.getServerSnapshot);
  const dataReady = !session?.profileId || !!applicationClient.workspace?.isReady();
  const value = useMemo<ProfileContextValue>(() => ({
    profile: session?.profileId ? demoProfileById(session.profileId) : null, resolved: state.resolved && dataReady,
    sessionKey: session ? `${session.namespaceId}.${session.profileId}.${session.generation}` : "anonymous",
    signIn: (id) => applicationClient.change("select", id), signOut: () => applicationClient.change("signout"),
    clearData: (id) => applicationClient.clearProfile(id, session?.namespaceId),
  }), [session, state.resolved, dataReady]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
export function useDemoProfile(): ProfileContextValue { const value = useContext(ProfileContext); if (!value) throw new Error("useDemoProfile requires ProfileProvider"); return value; }
