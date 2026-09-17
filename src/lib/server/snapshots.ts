import "server-only";
import type { PoolClient } from "pg";
import { transaction, TRANSACTION_TIMEOUT_MS } from "../db";
import { observeAgent, observeRunEvents } from "./agent";
import { diagnoseSnapshotRetry } from "./diagnostics";
import { readWorkspace } from "./repository";
import { requireSession } from "./session";

// Session changes can invalidate a REPEATABLE READ snapshot while its authority
// check waits for the session row lock. Retry that known rolled-back read once
// with a fresh snapshot, so the current generation/revocation check can decide.
// This helper stays private: commands and paid work must never be replayed here.
async function snapshot<T>(read: (client: PoolClient) => Promise<T>): Promise<T> {
  const deadline = performance.now() + TRANSACTION_TIMEOUT_MS;
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error("Database observation deadline exceeded");
    try {
      return await transaction(async client => {
        await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        return read(client);
      }, remaining);
    } catch (error) {
      if (attempt !== 0 || !error || typeof error !== "object" || !("code" in error) || error.code !== "40001") throw error;
      diagnoseSnapshotRetry();
    }
  }
}

export function readApplicationSnapshot(token: string | undefined, generation: string) {
  return snapshot(async client => readWorkspace(client, await requireSession(client, token, generation)));
}

export function readAgentSnapshot(token: string | undefined, generation: string, runId: string | null = null, after = 0) {
  return runId ? snapshot(client => observeRunEvents(client, token, generation, runId, after)) : snapshot(client => observeAgent(client, token, generation));
}
