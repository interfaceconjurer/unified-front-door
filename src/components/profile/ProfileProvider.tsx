"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  demoProfileById,
  isDemoProfileId,
  type DemoProfile,
  type DemoProfileId,
} from "@/lib/demo-profiles";

const STORAGE_KEY = "ufd.demo-user.v1";

class DemoProfileStore {
  private listeners = new Set<() => void>();
  private cachedRaw: string | null | undefined;
  private cached: DemoProfileId | null = null;
  private storageUnavailable = false;

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => this.listeners.delete(onStoreChange);
  };

  getServerSnapshot = (): DemoProfileId | null => null;

  getSnapshot = (): DemoProfileId | null => {
    if (typeof window === "undefined") return null;
    if (this.storageUnavailable) return this.cached;

    let raw: string | null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      this.storageUnavailable = true;
      return this.cached;
    }

    if (raw === this.cachedRaw) return this.cached;
    this.cachedRaw = raw;
    this.cached = isDemoProfileId(raw) ? raw : null;
    return this.cached;
  };

  setProfile = (profileId: DemoProfileId | null): void => {
    this.cached = profileId;
    this.cachedRaw = profileId;

    if (typeof window !== "undefined") {
      try {
        if (profileId) window.localStorage.setItem(STORAGE_KEY, profileId);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage can be unavailable in private or restricted environments.
        // Keep the selection in memory for the current tab instead of failing.
        this.storageUnavailable = true;
      }
    }

    for (const listener of this.listeners) listener();
  };
}

const demoProfileStore = new DemoProfileStore();

type ProfileContextValue = {
  profile: DemoProfile | null;
  signIn: (profileId: DemoProfileId) => void;
  signOut: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profileId = useSyncExternalStore(
    demoProfileStore.subscribe,
    demoProfileStore.getSnapshot,
    demoProfileStore.getServerSnapshot,
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: profileId ? demoProfileById(profileId) : null,
      signIn: demoProfileStore.setProfile,
      signOut: () => demoProfileStore.setProfile(null),
    }),
    [profileId],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useDemoProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useDemoProfile must be used within ProfileProvider");
  return value;
}
