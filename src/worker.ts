import { assertReadiness } from "./lib/server/readiness";
import { diagnoseWorker, diagnoseWorkerWake } from "./lib/server/diagnostics";
import { databasePool } from "./lib/db";
import { workerTick, workerHasWork } from "./lib/server/agent-worker";
import { runWorkerLoop, WorkerWake } from "./lib/server/worker-loop";
import { watchWorkerActivity } from "./lib/server/worker-wake";

const active = new AbortController();
process.on("SIGTERM", () => active.abort());
process.on("SIGINT", () => active.abort());
async function main() {
  await assertReadiness(); diagnoseWorker("started");
  const wake = new WorkerWake();
  const listener = watchWorkerActivity({ signal: active.signal, wake, onState: diagnoseWorkerWake });
  try {
    await runWorkerLoop({ signal: active.signal, wake, tick: () => workerTick({ signal: active.signal }), hasWork: workerHasWork, onError: () => diagnoseWorker("unavailable") });
  } finally {
    active.abort(); await listener;
    await databasePool().end(); diagnoseWorker("stopped");
  }
}
void main().catch(async () => { diagnoseWorker("unavailable"); process.exitCode = 1; try { await databasePool().end(); } catch { /* Invalid configuration may prevent pool creation. */ } });
