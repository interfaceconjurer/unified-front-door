"use client";
import { useSyncExternalStore } from "react";
import { applicationClient, type RecoverableBuffer } from "@/lib/application/client";
import { EMPTY_APPLICATION } from "@/lib/application/remote-store";
const subscribeEmpty = () => () => {};
const empty = () => EMPTY_APPLICATION;
function exportBuffer(entry: RecoverableBuffer) {
  const url = URL.createObjectURL(new Blob([entry.raw], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pending-workspace-edits.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PendingEdits() {
  const state = useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const workspace = applicationClient.workspace;
  useSyncExternalStore(workspace?.subscribe ?? subscribeEmpty, workspace?.getSnapshot ?? empty, empty);
  const pending = workspace?.reviewPending() ?? [];
  return <aside aria-label="Pending edit recovery">
    <button type="button" onClick={applicationClient.showRecovery}>Recover pending edits</button>
    {!!pending.length && <details><summary>Review saved and pending edits</summary>
      {pending.map((entry, index) => <section key={index}><h3>{entry.title}</h3><p>Saved version</p><pre>{JSON.stringify(entry.saved, null, 2)}</pre><p>Pending changes</p><pre>{JSON.stringify(entry.pending, null, 2)}</pre></section>)}
    </details>}
    {state.recovery && <section aria-label="Recoverable buffers"><h2>Pending edits from this browser</h2>
      <p>Each buffer retains its original profile and workspace. Export it to recover the text. Older session commands are never replayed into your current workspace.</p>
      {!state.recovery.length && <p>No pending edit buffers were found.</p>}
      {state.recovery.map((entry) => <section key={`${entry.key}:${entry.variant ?? "memory"}`}><h3>{entry.label}</h3><p>{entry.memoryOnly ? "Only held in this tab. Export before closing it." : "Buffered in this browser."}</p>
        <button type="button" onClick={() => exportBuffer(entry)}>Export pending edits</button>
        <details><summary>Review before discarding</summary><pre>{entry.raw}</pre><button type="button" onClick={() => applicationClient.discardRecovery(entry)}>Discard this reviewed buffer</button></details>
      </section>)}
      <button type="button" onClick={applicationClient.hideRecovery}>Close pending edit recovery</button>
    </section>}
  </aside>;
}
