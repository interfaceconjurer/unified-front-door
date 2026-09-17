// Only launched by the isolated database suite. No real provider transport.
process.env.AGENT_PROVIDER = "demo";
import { testModules } from "./test-modules.mjs";
if (!process.env.DATABASE_TEST_URL || !process.send) throw new Error("An isolated database test parent is required.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const [runId, budgetScope] = process.argv.slice(2);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
if (!uuid.test(runId ?? "") || !budgetScope?.startsWith("test:") || !uuid.test(budgetScope.slice(5))) throw new Error("An owned run and isolated test budget scope are required.");
const modules = testModules();
const { MODEL_POLICY } = modules.load("lib/server/model-provider");
const { workerTick } = modules.load("lib/server/agent-worker");
try {
  const claimed = await workerTick({ runId, model: {
    budgetScope, settings: () => ({ policy: MODEL_POLICY, globalDailyCalls: 10, namespaceDailyCalls: 5 }),
    complete: async () => { process.send({ type: "provider-entered" }); await new Promise(() => {}); },
  } });
  process.send({ type: "finished", claimed });
} catch { process.send({ type: "failed" }); process.exitCode = 1; }
finally { await modules.load("lib/db").databasePool().end(); modules.cleanup(); }
