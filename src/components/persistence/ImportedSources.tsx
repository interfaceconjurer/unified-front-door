"use client";
import { useSyncExternalStore } from "react";
import { applicationClient } from "@/lib/application/client";
import { EMPTY_APPLICATION } from "@/lib/application/remote-store";

const subscribeEmpty = () => () => {};
const empty = () => EMPTY_APPLICATION;
export function ImportedSources() {
  useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const workspace = applicationClient.workspace;
  const snapshot = useSyncExternalStore(workspace?.subscribe ?? subscribeEmpty, workspace?.getSnapshot ?? empty, empty);
  if (!snapshot.imports.length) return null;
  async function download(sourceHash: string) {
    const result = await applicationClient.exportImportedSource(sourceHash); if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "imported-workspace-source.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <aside aria-label="Preserved browser imports"><details><summary>Preserved browser imports ({snapshot.imports.length})</summary>
    <p>Each export contains the original browser source and any ambiguous drafts preserved for recovery. Importing and later edits do not change that source.</p>
    {snapshot.imports.map(source => <section key={source.sourceHash}>
      <h3>Import {source.sourceHash.slice(0, 8)}</h3><p>{source.importedAt} · {source.projects} projects · {source.drafts} drafts · {source.recovery} items preserved for recovery</p>
      <button type="button" onClick={() => { void download(source.sourceHash); }}>Export original source and recovery</button>
    </section>)}
  </details></aside>;
}
