// Opt-in verification child: only the owned run is eligible for dispatch.
import { createRequire } from "node:module";
const [runId, mode] = process.argv.slice(2);
if (process.env.MODEL_LIVE_VERIFICATION !== "authorized" || !process.env.DATABASE_TEST_URL
  || !/^[a-f0-9-]{36}$/.test(runId ?? "") || !["assessment", "model", "terminal"].includes(mode)) throw Error("Explicit live verification configuration is required.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const require = createRequire(import.meta.url);
const { workerTick } = require("../.worker/lib/server/agent-worker.js");
const { databasePool } = require("../.worker/lib/db.js");
const { demoAdapter } = require("../.worker/lib/agent/demo.js");
const { completeModel } = require("../.worker/lib/server/model-provider.js");
const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());
let calls = 0;
try {
  const adapter = { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === "progress" ? { ...result, delayMs: 0 } : result; } };
  const model = { async complete(prompt, policy, signal, dependencies = {}) {
    if (mode !== "model") { process.send?.({ unexpectedDispatch: true }); throw Error("Live verification dispatch limit exceeded."); }
    return completeModel(prompt, policy, signal, { ...dependencies, fetch: async (...request) => {
      if (++calls > 1) { process.send?.({ unexpectedDispatch: true }); throw Error("Live verification dispatch limit exceeded."); }
      const pending = fetch(...request);
      process.send?.({ dispatchStarted: true });
      return pending;
    } });
  } };
  for (let i = 0; i < (mode === "assessment" ? 12 : 1); i++) {
    if (!await workerTick({ runId, adapter, model, signal: controller.signal })) break;
  }
  process.send?.({ dispatches: calls });
} catch { process.exitCode = 1; process.send?.({ failed: true }); }
finally { await databasePool().end(); }
