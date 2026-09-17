process.env.AGENT_PROVIDER = "demo";
import { createRequire } from "node:module";
if (!process.env.DATABASE_TEST_URL || !/^[a-f0-9-]{36}$/.test(process.argv[2] ?? "")) throw new Error("An isolated database and owned run are required.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const require = createRequire(import.meta.url), { workerTick } = require("../.worker/lib/server/agent-worker.js"), { databasePool } = require("../.worker/lib/db.js"), { demoAdapter, deterministicAdapter } = require("../.worker/lib/agent/demo.js");
const mode = process.argv[3], runId = process.argv[2];
const adapter = mode === "pause" ? { async step() { process.send?.({ leased: true }); return new Promise(() => {}); } }
  : mode === "fail" ? deterministicAdapter({ fail: true })
  : { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === "progress" ? { ...result, delayMs: 0 } : result; } };
try {
  for (let i = 0; i < 12; i++) if (!await workerTick({ runId, adapter })) break;
} finally { await databasePool().end(); }
