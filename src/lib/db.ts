import "server-only";
import { Pool, type PoolClient } from "pg";
import { databaseUrl } from "./server/configuration";

let pool: Pool | undefined;
export const TRANSACTION_TIMEOUT_MS = 20000;
export type OwnedDatabaseClient = Pick<PoolClient, "query" | "release" | "on" | "removeListener">;

/** Pool error listeners cover idle connections only. Each checked-out client
 * needs its own transport listener and wall-clock deadline until release. */
export async function withOwnedDatabaseClient<C extends OwnedDatabaseClient, T>(client: C, work: (client: C) => Promise<T>, timeoutMs: number): Promise<T> {
  let completed = false, transportError: Error | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTransport: (error: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    rejectTransport = reject;
    timer = setTimeout(() => reject(new Error("Database operation deadline exceeded; its outcome may be uncertain")), timeoutMs);
  });
  const onError = (error: Error) => { transportError = error; rejectTransport(error); };
  client.on("error", onError);
  try {
    const result = await Promise.race([interrupted, work(client)]);
    if (transportError) throw transportError;
    completed = true;
    return result;
  } finally {
    clearTimeout(timer);
    // Destroying a timed-out connection prevents a late callback from querying
    // a client that another request has borrowed. COMMIT is never replayed.
    client.release(!completed);
    client.removeListener("error", onError);
  }
}

export function databasePool(): Pool {
  const connectionString = databaseUrl();
  if (!pool) {
    // URL TLS options are authoritative; never disable certificate verification.
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    // pg removes its idle listener before resolving connect(). A backend can
    // fail in that handoff interval, before our owned-client handler attaches.
    // Install once per connection; query/owned promises still report failure.
    pool.on("connect", client => { client.on("error", () => {}); });
    pool.on("error", () => { /* Requests report availability without logging credentials or SQL. */ });
  }
  return pool;
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>, budgetMs?: number): Promise<T> {
  const started = performance.now();
  const client = await databasePool().connect();
  if (budgetMs === undefined) return runTransaction(client, work);
  const remaining = budgetMs - (performance.now() - started);
  if (remaining <= 0) { client.release(true); throw new Error("Database observation deadline exceeded"); }
  return runTransaction(client, work, remaining);
}
export async function runTransaction<T>(client: PoolClient, work: (client: PoolClient) => Promise<T>, timeoutMs = TRANSACTION_TIMEOUT_MS): Promise<T> {
  return withOwnedDatabaseClient(client, async owned => {
    try {
      await owned.query("BEGIN");
      await owned.query("SET LOCAL search_path=public");
      await owned.query("SET LOCAL statement_timeout='10s'");
      await owned.query("SET LOCAL lock_timeout='5s'");
      await owned.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
      const result = await work(owned);
      await owned.query("COMMIT");
      return result;
    } catch (error) {
      try { await owned.query("ROLLBACK"); } catch { /* A committed receipt resolves an uncertain outcome on retry. */ }
      throw error;
    }
  }, timeoutMs);
}
