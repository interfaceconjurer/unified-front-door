import type { SessionView } from "./contracts";

/** Every store writes a fresh key, including same-page re-adoption and cloned sessionStorage. */
export function allocateBuffer(session: SessionView, storage: Pick<Storage, "getItem" | "setItem"> | null, instanceId = crypto.randomUUID()) {
  const prefix = `ufd.pending.v1.${session.namespaceId}.${session.profileId}.${session.generation}.`;
  const pointer = `ufd.pending-pointer.v1.${session.namespaceId}.${session.profileId}.${session.generation}`;
  let previous: string | null = null;
  try { previous = storage?.getItem(pointer) ?? null; storage?.setItem(pointer, instanceId); } catch { /* Memory-only page identity remains unique. */ }
  return { key: `${prefix}${instanceId}`, restoreKey: previous && previous !== instanceId ? `${prefix}${previous}` : undefined };
}
