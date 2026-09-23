// Real worker modules, separate process, disposable test DB only. IPC records
// actual claim scans/query calls without querying the database to observe idle.
import { createRequire } from 'node:module';
import pg from 'pg';
if (!process.env.DATABASE_TEST_URL) throw Error('An explicit disposable test database is required');
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? '';
process.env.AGENT_PROVIDER = 'demo';
const require = createRequire(import.meta.url);
const { workerTick, workerHasWork } = require('../.worker/lib/server/agent-worker.js');
const { databasePool } = require('../.worker/lib/db.js');
const { runWorkerLoop, WorkerWake } = require('../.worker/lib/server/worker-loop.js');
const { watchWorkerActivity } = require('../.worker/lib/server/worker-wake.js');
const controller = new AbortController(), wake = new WorkerWake();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => controller.abort());
let queries = 0;
const query = pg.Client.prototype.query;
pg.Client.prototype.query = function (...args) { queries++; process.send?.({ event: 'query', at: Date.now() }); return query.apply(this, args); };
const tick = async () => {
  const before = queries;
  const worked = await workerTick({ signal: controller.signal });
  process.send?.({ event: 'scan', at: Date.now(), worked, queries: queries - before });
  return worked;
};
let listener;
try {
  if (process.argv[2] === 'baseline') {
    while (!controller.signal.aborted) { await tick(); await wake.wait(500, controller.signal); }
  } else {
    if (process.argv[2] !== 'missed') listener = watchWorkerActivity({ signal: controller.signal, wake,
      onState: outcome => process.send?.({ event: 'wake', outcome }) });
    await runWorkerLoop({ signal: controller.signal, wake, tick, hasWork: workerHasWork, onError: () => process.send?.({ event: 'error' }) });
  }
} finally { controller.abort(); await listener; await databasePool().end(); }
