# Worker idle behavior

The worker waits on the existing web process while the durable queue is empty.
That wait does not connect to Postgres. An hourly recovery scan prevents a missed
HTTP hint from stranding work. Browser background reads stop after one minute
without input. Together these changes permit gaps longer than Neon's five-minute
idle suspension threshold. This is suspension-compatible behavior, not a claim
that the hosted database has already suspended or that total usage is free.
Jordan approved the hourly recovery tradeoff on September 23, 2026.

## Execution and wake path

1. Web commands still persist conversations, agent runs/events and idempotency
   receipts in the original transaction. Chat submissions and explicit retries
   use `createAgentRun`; assessment commands use `syncAssessmentExecution`.
   There is no new queue table, schema migration, broker or notification SQL.
2. The existing authenticated Node web server holds a process-local activity
   timestamp. Session, application and agent API requests extend it for 60 seconds,
   both on arrival and response completion. The second hint covers slow commits.
   It is only a hint: it conveys neither work payload nor execution authority.
3. Independent workers long-poll authenticated `GET /api/worker/wake` using existing
   `APP_ORIGIN` and Basic Auth. Inactivity holds the response up to 20 seconds and
   returns `active:false`; workers wait another second before reconnecting.
   Recent activity returns `active:true`, wakes the worker, and permits another
   HTTP check after five seconds. Multiple workers can all receive activity.
   The endpoint, connections to it and its timeout perform **no database work**.
4. Each worker scans immediately on startup. While processing work or receiving
   activity hints, it retains the 500 ms cadence with a ten-second warm period.
   Before sleeping, an additional `EXISTS` query checks for all pending/running/
   streaming runs, including future-ready steps and other workers' live leases.
   If any remain, frequent scans continue even after all browsers close.
5. An empty queue sleeps until the next UTC-hour boundary, interrupted by hints
   or shutdown. Common boundaries keep multiple workers' recovery scans together
   instead of spreading wakeups across the hour. A lost hint, direct DB submission,
   web restart or unavailable wake endpoint is covered by the next scan, within
   one hour plus execution/connection time. This bound assumes a healthy worker
   and database; unavailable infrastructure can extend it. New work is never
   dependent on successful notification delivery.
6. HTTP errors retry after 5–60 seconds without waking Postgres. Database scan
   failures back off exponentially from 500 ms to an hour. `worker.wake` reports
   `available`/`unavailable` on transitions. HTTP calls time out after 25 seconds,
   reject redirects and abort on shutdown. Busy ticks are awaited; workers still
   execute one run at a time.

Postgres LISTEN/NOTIFY is deliberately not used: connecting or reconnecting to a
suspended compute wakes it, and session subscriptions do not survive suspension.
The previous 30-second database-polling draft was superseded because it could not
meet the clarified sleep requirement.

## Durability and ownership retained

The original claim transaction, ordered locks, readiness/lease checks, session
ownership/generation/expiry, workspace epoch, fence increments, recovery limits
and publication guards are unchanged. A broadcast may wake competing workers;
Postgres determines who can claim and publish. Hints cannot authorize execution.
Demo checkpoints retain their durable `ready_at` (350 ms chat, 1,400 ms assessment).
A recovering worker observes outstanding leases at the original fast cadence.

Model execution retains its 30-second lease and five-second renewal inside the
active tick, independent of idle scheduling. Progress publication remains fenced
and bounded to once per 500 ms. Cancellation invalidates the run/fence as before;
active streams observe it through progress/heartbeat validation. Uncertain tool
outcomes and durable paid-dispatch intent are not automatically replayed. Safe
explicit retries still create new durable runs. SIGTERM/SIGINT abort execution
and both wait loops before closing the database pool. Web shutdown releases its
HTTP waiters. Restart scans immediately, including work submitted without hints.

## Browser and other activity

| Source | Idle behavior |
| --- | --- |
| Session/workspace and idle agent history | Stop after 60 seconds without pointer, keyboard, input or scroll activity. Focus/visibility/input resumes immediately. Network responses do not renew browser activity. |
| Known active agent runs | Continue progress/fallback reads while visible until terminal; durable execution continues with no browser. Hidden tabs stop background/progress timers and resume on visibility. |
| Pending user writes | Retain existing acknowledgement, recovery and retry handling. Inactivity does not discard writes or cancel jobs. |
| `/api/live` | Authenticated process liveness; no SQL and no activity hint. Appropriate for routine uptime probes. Does not assert DB/worker/provider health. |
| `/api/ready` | Unchanged uncached read-only schema transaction. Frequent authenticated monitoring here still prevents suspension. Keep for deployment/explicit diagnosis. |
| Worker readiness | Queries once on startup, not on a recurring timer. Repeated process restarts can keep the DB awake. |
| Query pools | Idle connections close after 30 seconds; no SQL keepalive or Postgres listener. |
| Deployment/CI | Readiness checks run during deployment; CI Postgres health checks target disposable CI databases. No production periodic readiness schedule was found in repository configuration. External monitor settings were not inspected. |

After the last user input, browser polling may continue for one minute, web hints
for another minute and the worker warm period for ten more seconds. Neon then
needs five query/connection-free minutes: approximately seven minutes after the
last interaction, assuming no active jobs/other clients. An hourly recovery scan
inside that window can restart the five-minute countdown. A closed tab usually
quiets sooner. An active run, DB console, old app instance,
external monitor or another application sharing the compute can extend activity.

## Configuration, rollout and limits

Deploy both web and worker builds, with `APP_ORIGIN` reachable from each worker
and matching Basic Auth. An old/misconfigured web returns a failed wake check;
new workers still recover hourly but prompt idle dispatch is unavailable until
the web is updated. No Neon plan, connection URL, provider budget or schema change
is required. Existing Heroku web and worker processes remain independent.

Activity hints are local to a web process. The current single-web-process
architecture broadcasts to any number of workers. With multiple web processes
behind a load balancer, a worker must reach one that saw recent activity; prompt
wake is not guaranteed. Hourly durable recovery still works. If scaling web
instances, shared non-database signaling or routing affinity must be considered.
Do not introduce database heartbeats to work around that limitation.

This change does not stop Heroku dynos or change their fixed charges. It does not
cap aggregate Neon usage. At 0.25 CU, an hourly scan followed by five minutes until
suspension is roughly **15 CU-hours per 30 idle days**, versus **180 CU-hours** if
continuously active. These are estimates for one compute, excluding cold-start,
scan time, active use, larger compute sizes, other branches, storage and network.
Neon's current Free plan includes 100 CU-hours per project/month; account limits
and actual usage must still be checked. Hourly recovery spends some allowance to
keep missed work recoverable; it does not provide zero idle compute consumption.

Sources: [Neon compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle),
[connection activity and suspension](https://neon.com/docs/manage/endpoints/),
[Free plan allowance](https://neon.com/docs/introduction/plans).

## Verification and feature retention

Fetched main baseline: `6732e78e9850274864ce2aa14d27a80e3b801e41`. Content changes
are reviewed against that main tree, including tests; ancestry is not evidence
of retained behavior. No existing feature or test was removed.

| Affected feature | Disposition and checks |
| --- | --- |
| Idle scans | Adapted: HTTP hints and hourly fallback; scheduler clock tests and separate-process SQL measurements |
| Chat/retry/assessment submission | Retained: original transactional submission and agent database suite |
| Ownership, fencing, concurrent claims, delayed work and cancellation | Retained: unchanged claim/execution guards; agent and model database suites plus queue-presence checks |
| Model lease renewal and paid-dispatch protection | Retained: model database heartbeat, competing-worker, cancellation and process-kill recovery tests |
| Startup, shutdown, missed hints and multiple workers | Adapted wait scheduling: unit races/abort/fault checks, aligned-hour test, real HTTP/worker and lease-restart measurements |
| Browser freshness | Adapted to human activity: `browser-idle.test.mjs` and registered `idle-suspension` browser suite. Existing session recovery, streaming/cancel/retry checks retained. |
| Authentication, HTTP transport and readiness | Retained; new DB-free liveness/wake routes additionally covered by production `web-runtime.mjs` |

The shared pure gate discovers `browser-idle.test.mjs`; `worker-loop.test.mjs`
is in its server-condition list. `scripts/browser/suites.mjs` registers the new
browser behavior for PR shards and the full release gate. The shard-boundary
assertion now derives the registry size so adding a suite does not invalidate it.

With Node 22.23.2:

```sh
npm run test:worker-idle
node --test scripts/browser-idle.test.mjs
npm run test:agent-database
npm run test:model-database
npm run build
# Exclusive, empty, migrated disposable DATABASE_TEST_URL; about six minutes:
node --conditions=react-server scripts/worker-idle-measure.mjs
# Existing production preview (deterministic intercepted API fixtures):
node scripts/browser/idle-suspension.mjs candidate
```

The measurement script starts a real production web process and independent
workers on local PostgreSQL. It counts actual query calls by IPC, with no observer
DB polling during idle. If `WORKER_TEST_PG_LOG` points to the disposable server's
`log_statement=all` log, it also counts SQL log entries across all clients, including the web process. It
runs the original 500 ms loop as a baseline, keeps two candidate workers idle for
310 seconds while `/api/live` is requested every five seconds, submits through
real HTTP, then tests leased-run restart recovery without an HTTP watcher.
Cleanup stops owned processes and removes the test namespace.

### Measured results

Node 22.23.2, local PostgreSQL 18.4, September 23, 2026 (UTC):

| Real elapsed-time measurement | Result |
| --- | --- |
| Original loop, one worker, 30 seconds | 59 claim scans / 177 driver query calls: 118 scans/minute |
| New loop, two workers plus web, 310.004 seconds | **Zero worker query calls and zero database SQL log entries**, with wake long polls and five-second liveness probes running |
| First HTTP submission after that idle period | 522 ms from request start through first durable progress, including web commit and worker execution |
| Restart with an outstanding ten-second lease and no HTTP watcher | 10,123 ms to recover; exactly one recovery recorded |
| Shutdown of both candidate workers | 6 ms |

Simulated-clock checks cover lost hints (pickup at the next hourly scan), aligned
recovery across staggered worker starts, future steps/live leases, database and
HTTP failures, wake races, and interruption of waits. Chromium measured **zero
session/workspace/agent reads during ten simulated idle minutes**, then immediate
refresh on input/visibility. Active progress continues without input and stops
while hidden; unit checks cover both selected streaming and fallback reads.

Passed: 98 focused unit tests (counting final versions once), 46 real agent/model
database tests, three browser suites (`idle-suspension`, `session-recovery`,
`streaming`), production HTTP lifecycle checks, and the production web/worker
build with TypeScript. Lint has zero errors and the existing `layout.tsx`
stylesheet warning. The final web-waiter shutdown refinement was checked again
by unit and real HTTP lifecycle tests; it does not change the measured idle/wake
policy. The full release gate and hosted Neon tests were not run.

Results of the current implementation are recorded in
[worker-idle-measurements.json](worker-idle-measurements.json). Browser ten-minute
idle checks and one-hour recovery checks use simulated clocks; SQL idle and
HTTP pickup measurements use real elapsed time. These are individual local
samples, not Neon cold-start latency percentiles. Live Neon suspension, hosted
monitor configuration and current account consumption have **not** been measured.

After deployment, verify the compute becomes Idle in the Neon control-plane
console/API while nobody uses the app, remaining idle until the next hourly scan
or real request. Do not poll SQL or `/api/ready` to observe sleep: that observation
would itself wake the compute. Then measure the first real request after hosted
suspension, including its cold-start delay. Full release verification remains a
separate deployment gate.
