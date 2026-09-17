"use client";

import { useSyncExternalStore } from "react";
import type { PersistenceControls, PersistenceStatus as Status } from "@/lib/browser-persistence";
import styles from "./PersistenceStatus.module.css";

type Props = {
  store: PersistenceControls;
  hasContent?: boolean;
  label?: string;
  onlyProblems?: boolean;
};

export function PersistenceStatus({ store, ...props }: Props) {
  const status = useSyncExternalStore(store.subscribe, store.getPersistenceSnapshot, store.getServerPersistenceSnapshot);
  return <PersistenceStatusView {...props} bufferFailure={store.hasBufferFailure?.()} error={store.getError?.()} location={store.location} canKeepLocal={store.canKeepLocalChanges?.()} pendingLocation={store.pendingLocation?.()} status={status} retry={store.retryPersistence} keepLocal={store.keepLocalChanges} useSaved={store.useSavedVersion} />;
}

export function PersistenceStatusView({ status, location, error, bufferFailure, canKeepLocal, pendingLocation, hasContent = true, label, onlyProblems = false, retry, keepLocal, useSaved }: Omit<Props, "store"> & {
  location?: "server" | "browser";
  canKeepLocal?: boolean;
  error?: string;
  bufferFailure?: boolean;
  pendingLocation?: string;
  status: Status;
  retry: () => void;
  keepLocal: () => void;
  useSaved: () => void;
}) {
  const problem = !["loading", "absent", "saved", "saving"].includes(status) && !(location === "server" && status === "unsaved");
  if (onlyProblems && !problem && !bufferFailure) return null;
  const message = location === "server" ? status === "loading" ? "Loading saved data…"
    : status === "saved" ? "Saved to database"
    : status === "saving" || status === "unsaved" ? "Saving to database…"
    : status === "conflict" ? "The saved version changed. Your pending edits are preserved for review."
    : status === "invalid" ? "The local edit buffer could not be read. Its original bytes are preserved."
    : "Database saving is unavailable. Pending edits are preserved; retry checks whether the original command committed."
    : status === "loading" ? "Checking saved changes…"
    : status === "saved" ? hasContent ? "Saved in this browser" : "No changes yet"
    : status === "absent" ? "No saved changes yet"
    : status === "conflict" ? "Another tab changed the saved version. Your changes are only in this tab."
    : status === "invalid" ? "Saved data could not be read. Changes are only in this tab."
    : status === "unsupported" ? "Saved data needs a newer app version. Changes are only in this tab."
    : "Changes are only in this tab. Saving is unavailable.";

  return <span className={styles.status} data-persistence={status}>
    <span role="status">{label && `${label}: `}{message}</span>
    {location === "server" && problem && error && <span>{error}</span>}
    {location === "server" && status !== "saved" && pendingLocation && <span>{pendingLocation}</span>}
    {problem && <span className={styles.actions}>
      <button type="button" onClick={retry}>Retry saving</button>
      {status === "conflict" && <>
        <button type="button" disabled={canKeepLocal === false} onClick={keepLocal}>{location === "server" ? "Apply my pending fields to the latest saved version" : "Keep my changes (replace saved version)"}</button>
        <button type="button" onClick={useSaved}>Use saved version (discard my changes)</button>
      </>}
      {location !== "server" && (status === "invalid" || status === "unsupported") && <button type="button" onClick={keepLocal}>Replace saved data with this tab&apos;s changes</button>}
    </span>}
  </span>;
}
