import { assertReadiness } from "./lib/server/readiness";
import { diagnoseWorker } from "./lib/server/diagnostics";
import { databasePool } from "./lib/db";
import { workerTick } from "./lib/server/agent-worker";

let stopping = false;
const active = new AbortController();
process.on("SIGTERM", () => { stopping = true; active.abort(); });
process.on("SIGINT", () => { stopping = true; active.abort(); });
async function main() {
  await assertReadiness(); diagnoseWorker("started");
  while (!stopping) {
    try { await workerTick({ signal: active.signal }); }
    catch { diagnoseWorker("unavailable"); }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 500));
  }
  await databasePool().end(); diagnoseWorker("stopped");
}
void main().catch(async () => { diagnoseWorker("unavailable"); process.exitCode = 1; try { await databasePool().end(); } catch { /* Invalid configuration may prevent pool creation. */ } });
