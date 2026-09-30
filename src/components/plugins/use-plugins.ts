"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { applicationClient } from "@/lib/application/client";
import { PluginInstallStore, type PluginId } from "@/lib/plugins/catalog";

const stores = new Map<string, PluginInstallStore>();
const NONE: PluginId[] = [];
function storeFor(key: string, access: readonly PluginId[]): PluginInstallStore {
  let store = stores.get(key);
  if (!store) { store = new PluginInstallStore(key, access); stores.set(key, store); }
  return store;
}

/** Simulated per-profile installation. Access bounds what can be installed;
 *  uninstalling hides capabilities and views but never deletes drafts. */
export function usePlugins() {
  const { profile } = useDemoProfile();
  const session = applicationClient.getSnapshot().session;
  const key = profile && session ? `ufd.plugins.v1.${session.namespaceId}.${profile.id}.${session.workspaceEpoch}` : null;
  const store = useMemo(() => key && profile ? storeFor(key, profile.surfaceAccess) : null, [key, profile]);
  const installed = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.installed ?? none, none);
  return useMemo(() => ({
    access: profile?.surfaceAccess ?? NONE,
    installed,
    isInstalled: (id: PluginId) => installed.includes(id),
    install: (id: PluginId) => store?.install(id) ?? false,
    uninstall: (id: PluginId) => store?.uninstall(id),
  }), [installed, profile, store]);
}
const noopSubscribe = () => () => {};
const none = () => NONE;
