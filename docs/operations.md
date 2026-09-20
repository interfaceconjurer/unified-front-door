# Database and operations

[← README](../README.md)

The hosted preflight and first-release status below describe the recorded
Phase 9 checkpoint. Confirm the current release and configuration before
using the runbook.

## Database configuration

Use an isolated Neon development/test branch for the local app. This setup uses
an existing `dev` branch; create a separate `heroku-demo` branch before hosted
wiring. The local Next server connects directly to Postgres;
a local database service is optional. Local Postgres can exercise the same driver
and migrations, but Phase 4 acceptance also requires actual Neon evidence.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server runtime connection; use the Neon pooled URL for the selected branch. Keep TLS verification enabled. |
| `DATABASE_URL_UNPOOLED` | Direct connection to the same database for migrations/status; required for remote targets. Only local Postgres may fall back to `DATABASE_URL`. |
| `DATABASE_TEST_URL` | Explicit isolated development/test database for the database integration suite; never inferred from the runtime URL. |
| `DATABASE_TEST_URL_UNPOOLED` | Direct connection to that same disposable test database; required for a remote release-gate run. |
| `APP_ORIGIN` | Exact externally visible origin, including the local port or hosted HTTPS origin. Used for mutation-origin checks. |
| `BASIC_AUTH_USER` | Browser gate username; defaults to `guest`. |
| `BASIC_AUTH_PASSWORD` | Browser gate password. |
| `AGENT_PROVIDER` | `demo` by default; `anthropic` explicitly enables the optional text-reasoning path. |
| `ANTHROPIC_API_KEY` | Server-only provider credential, required in Anthropic mode. Keep it out of Git, browser variables, and database records. |
| `ANTHROPIC_MODEL` | Optional pinned-model setting; when provided, it must be `claude-sonnet-5`. |
| `ANTHROPIC_WORKSPACE_ID` | Optional provider workspace identifier (`wrkspc_…`); this is separate from the app's demo namespace. |
| `AGENT_GLOBAL_DAILY_CALLS` | Application-wide attempted-call allowance per UTC day: default `10`, range `1`–`100`. |
| `AGENT_NAMESPACE_DAILY_CALLS` | Attempted-call allowance per namespace per UTC day: default `5`, range `1`–`20`. |

Attempt limits can decrease within a UTC day; raising configuration does not
raise an already-recorded allowance for that day. They do not represent a hard
dollar cap. Ordinary automated verification forces demo mode and uses simulated
provider transports; paid acceptance requires its separate explicit opt-in.

To get the two Neon URLs, first create a Neon account at
[the Neon Console](https://console.neon.tech) and create the `unified-front-door`
project if you have not done so. Enable **Postgres**; leave **Object storage**,
**Functions**, **AI gateway**, and **Neon Auth** off. This app currently uses only
Postgres. Select the intended development/test branch (`dev` in this setup):

1. Open your project in the Neon Console and choose **Connect**.
2. Select that **dev** branch and **Connection string** format.
3. Turn **Connection pooling** on and copy the URL into `DATABASE_URL`.
4. Turn pooling off and copy the direct URL into `DATABASE_URL_UNPOOLED`.

Keep the branch, database, and role the same for both URLs. Copy only the
`postgresql://…` value, without a surrounding `psql` command, into the local file.
See [Neon's connection-pooling guide](https://neon.com/docs/connect/connection-pooling).

Keep local credentials in the ignored `.env.local`; use Heroku configuration
variables for the hosted app. Both database URLs in one environment must address
its intended branch. Never use a shared or production target for disposable test
fixtures or demo resets.

`npm run db:migrate` applies numbered files in `db/migrations` atomically and
records checksums in `schema_migrations`. An advisory lock serializes competing
migrations; matching history is skipped, while changed, reordered, or unknown
history is rejected. Add new migrations instead of editing applied ones. Limits
are 5 seconds to connect or acquire the migration lock, 30 seconds per SQL
statement, and 120 seconds for the migration process. `npm run db:status` checks
exact current migration history read-only, with a 20-second process deadline.

On connection loss or timeout, the result can be uncertain even if the command
exits unsuccessfully. Run `npm run db:status` against the intended direct target
and inspect the recorded state before deciding whether to retry. Do not assume
the transaction rolled back, blindly replay a release, or edit checksums to make
the check pass. Runtime/direct URLs must select the same endpoint/database/port;
runtime and migration roles may differ.
The application owns tables in the `public` schema. Runtime, readiness, and
migration transactions pin `search_path` to `public`; connection-string routing
or schema overrides are rejected. Custom per-connection schemas are unsupported.

### Readiness and diagnostics

`GET /api/ready` requires the same Basic Auth as pages and static assets. It
returns only `200 {"ready":true}` or `503 {"ready":false}` with `no-store` and a
generated `X-Request-ID`. Invalid credentials return 401; missing/blank gate
configuration fails closed with 503. The probe compares the migration manifest
and checks required columns in a read-only transaction. Its connection acquisition
is bounded at 5 seconds and connected probe at 10 seconds; failed/uncertain
connections are destroyed. This verifies selected schema requirements and
database access, not every constraint or worker/provider health.

Ordinary application transactions have a 20-second connected lifetime, separate
from the 5-second connection-acquisition limit. Connection errors are contained
during pool handoff and active work; failures/timeouts destroy the uncertain
connection. Commands and paid work do not automatically replay a transaction after failure.
If a commit acknowledgement is lost, use the existing command receipt/retry
protocol to determine its result rather than assuming the write did not happen.

Server diagnostics emit allowlisted JSON events for requests, operation errors,
worker lifecycle, and run progress. Response request IDs correlate request/error
events; a hashed command key connects HTTP operations and worker runs. Raw request
IDs supplied by clients, commands, prompts, credentials, connection strings, and
arbitrary error messages are excluded. Use the response `X-Request-ID`, event
type, status, duration, run ID, and safe error code when investigating failures.

Observational workspace, agent, and run-event reads retry a known rolled-back
serialization conflict (`40001`) once with a fresh snapshot and fresh session
checks. Commands, model requests, and paid work never use this retry path. The
attempts share a 20-second database-work budget; final connection acquisition may
add up to five seconds. A correlated `database.snapshot_retry` event records the
retry. Error events use allowlisted categories to distinguish serialization,
locking, cancellation, authentication, capacity, and transport failures without
printing raw database errors. The HTTP entrypoint separately records bounded
transport categories such as `request_reset`, `request_cancelled`, and
`handler_failed`; these describe observations without attributing every reset to
the client.

### Heroku release runbook

**Hosted status:** this architecture work has not deployed or verified the new
runtime on Heroku. Read-only inspection at **2026-09-17 01:55 UTC** (September 16
in the workspace's Eastern timezone) found `unified-front-door` at successful
current release `v11` on `heroku-24`/`us`, with one Basic web dyno running and no
running worker. Database URLs, `APP_ORIGIN`, `AGENT_PROVIDER`, and
`ANTHROPIC_API_KEY` are absent; the Basic Auth password is present. The GitHub
`heroku` environment exists with `HEROKU_API_KEY`, but the matching smoke password
secret is absent, and no required-reviewer or deployment-branch protection is
configured. The public repository supports those environment protections; their
absence is a setup gap, not an established platform limitation. See
[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
and the [Phase 9 release preflight](../docs/phases/phase-9-operations.md#hosted-release-preflight).

Before an authorized first release:

1. **Before publishing or merging the intended release to `main`, configure
   required reviewers and a main-only deployment policy for the `heroku` GitHub
   environment.** The workflow automatically deploys eligible pushes to `main`;
   installing protections after that push is too late. Set the matching
   `HEROKU_BASIC_AUTH_PASSWORD` environment secret and optional
   `HEROKU_BASIC_AUTH_USER` variable (default `guest`). Confirm the workflow's app
   name/origin match.
2. Configure a separate `heroku-demo` database and its matching pooled/direct
   `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, the app's exact HTTPS `APP_ORIGIN`, and
   Basic Auth in Heroku. Preserve the disposable development/test branch.
   If the approved release enables Anthropic reasoning, set its provider config
   vars there too, preferably with a separate hosted `ANTHROPIC_API_KEY`; do not
   upload a local `.env.local`. Confirm the intended daily attempt allowances
   (defaults: 10 application-wide, 5 per namespace); these are not dollar caps.
3. Record the intended commit, current release, schema version, and a verified
   recovery point before applying new migrations. Confirm the backup/restore
   retention available for the hosted database and rehearse restore to an
   isolated target; this repository does not configure backups automatically.
4. Use the repository workflow for the approved revision. Pull requests only
   verify; main pushes and manual dispatch on main use merge-integrity checking
   → verification → this run's source artifact → deployment. Manual dispatch
   requires `base_revision`: supply the full SHA of the previously verified
   release being advanced. It must be a distinct ancestor of the requested
   revision. The workflow checks that ancestry; the operator is responsible for
   selecting an actually verified baseline. Manual dispatch on another branch
   does not deploy. Do not bypass this path with an unchecked direct push/build
   API call. See the [integration incident](ui-integration-incident.md) for the
   guard's scope and the separate branch-protection requirement.
5. `Procfile` runs `release: npm run db:migrate` before the new web/worker
   formation starts. For the first compatible slug, an operator must explicitly
   activate the worker; the deploy script does not change formation or billing.
   Until matching web and worker dynos are running and smoke checks pass, treat
   the first release as incomplete even if the build succeeded.

After the release exposes the worker process type, select and approve a suitable
dyno plan, then an authorized operator can activate one worker:

```bash
heroku ps:scale worker=1 --app unified-front-door
```

This is a future hosted setup action, not a command executed by this phase or by
the deploy script. Verify the resulting worker and its matching release afterward.
At the September 16, 2026 preflight, Basic pricing is **$7 per month per dyno**:
one candidate Basic worker adds about **$7 per month**, or **$14 per month** for
the existing web plus worker, before Neon, Anthropic, and taxes. This is a cost
estimate, not a capacity recommendation or approved purchase. Confirm the plan
and current price before activation. [Heroku pricing](https://www.heroku.com/pricing/)

The deploy script verifies source/attestation hashes before remote effects,
checks the configured database target and origin, and confirms both the current
release and matching web/worker dynos. It then checks authenticated readiness,
login, and a static asset. Requests have 30-second limits, status polling is
bounded to 120 five-second intervals, and the script has a 15-minute deadline.
It does not print raw remote responses or signed URLs. GitHub's deployment job
has its own 20-minute limit. These are configured safeguards; hosted success
requires an actual separately authorized run.

### Failed releases, backups, and rollback

Record build/release identity and inspect status after a failure or timeout
before retrying: a lost response does not prove the remote operation failed.
A successful build can still have a failed release. Heroku normally keeps the
old formation when release tasks fail, but a config-var-triggered failure leaves
the changed configuration in place. Reconcile configuration as well as release
and schema state. See [Heroku release phase](https://devcenter.heroku.com/articles/release-phase).

Prefer a forward code/schema fix using the same verification gate. This app has
no automatic down migrations, and readiness conservatively rejects migration
history newer than the running code knows. An older slug is therefore usable
only after proving its schema compatibility and readiness; an app rollback does
not roll back Neon data. Heroku rollback also restores prior config values, so
verify database targets again. See [Heroku rollback behavior](https://devcenter.heroku.com/articles/releases#rollback).

For actual data recovery, stop new writes and workers under an approved incident
plan, restore the verified backup/recovery point into an isolated database, and
validate schema plus application journeys before any target switch. Account for
writes after that recovery point; do not silently discard them. Switch the paired
runtime/direct URLs together only after approval. Backup provisioning, retention,
recovery objectives, and a hosted restore drill remain operator responsibilities;
none is established merely by a passing migration or this local release gate.

Configuring a connection alone does not import browser records. The explicit
legacy import and durable-client checks have passed against Neon. The
[Phase 4 journal](../docs/phases/phase-4-neon.md) records exact evidence and the
independent approval decision.

### Seed and reset a command-line demo workspace

Start the app first and set `APP_ORIGIN`/Basic Auth for that running instance.
The CLI uses the same authenticated session API as the browser. Its private session
file owns a separate demo namespace; it does not select an existing browser's
namespace. Use an absolute path outside the repository:

```bash
npm run demo:seed -- --session-file "$HOME/.ufd-demo-session.json" --profile sp
npm run demo:reset -- --session-file "$HOME/.ufd-demo-session.json" --profile sp --confirm-reset
```

`sp` selects Sam and is the default; the other profile IDs are `jw`, `kf`, and `am`.
Seed is repeatable and does not delete saved data. Reset requires an existing
private session file plus `--confirm-reset` and clears only the selected profile's
records in that namespace. The file contains authentication state and must remain
mode 600; do not share it or commit it. If a command outcome is uncertain, rerun
the same action/profile/session file so its pending command identity is recovered.
Independent seed/reset/lost-response CLI verification is recorded in the Phase 4
journal.

### Demo capacity limits

Each namespace/profile has explicit limits. Crossing one rejects the operation;
existing records are not evicted to make room. Editing an existing draft remains
possible at the draft-count limit when its content stays within the byte limit.

| Limit | Maximum |
| --- | --- |
| Assessment runs / projects / saved canvas drafts | 64 each |
| Captured findings / project work items | 512 each, across the workspace |
| Saved canvas fields | 65,536 bytes for the complete serialized fields object, measured as UTF-8 |
| New input in a canvas text field | 16,000 characters; longer saved values retained |
| Distinct imported sources | 16 |
| Import source / recovery record representation | 4,500,000 bytes each; the request body has its own overall bound |
| Workspace response | 16 MiB |
| Shared open canvases per surface | 20, plus Overview; existing over-cap tabs retained; one URL-only view may show an already captured/saved draft |
| Mounted transcript entries | 40 per page; Older/Newer/Latest controls retain access to history |
| Nonempty unsent composer drafts in one page | 16, each at most 8,000 characters |

Additional per-record and command-result limits are defined in
[`src/lib/server/quota.ts`](../src/lib/server/quota.ts). Preserve/export pending data
when an operation exceeds capacity. Whole-workspace reads are still a bounded demo
interface. Transcript pagination limits mounted UI entries; it does not paginate
the network snapshot or discard fetched history. Full responses retain their
16 MiB application and 24 MiB agent bounds. Existing tabs over the new-tab limit
remain readable, selectable, and closable; a rejected new tab does not evict a
draft. A page may also keep one URL-only view of an already captured/saved draft
when another browser tab closes that shared tab and fills the shared slots.
Unknown new destinations, new tabs, and new copies are still rejected at capacity.
The fixed Overview tab does not count toward the 20 shared canvases.
The limits are not a throughput or production-scale benchmark.

Agent history has additional limits. Reaching one rejects new work rather than
silently deleting saved history:

| Agent limit | Maximum |
| --- | --- |
| Conversations / execution attempts per namespace/profile | 16 / 128 |
| Messages per conversation | 128 |
| Serialized conversation / captured input | 512 KiB / 128 KiB |
| Agent snapshot response | 24 MiB |
| Submitted message text | 8,000 characters |
| Events returned per cursor page | 128 |

These limits are defined in `src/lib/agent/contracts.ts` and the server query
boundary. The current client refreshes a bounded agent snapshot; it does not claim
unlimited transcript rendering or production-scale throughput.

### Database records

| Records | Ownership and purpose |
| --- | --- |
| Namespaces, sessions, workspaces | Server-authenticated demo ownership, persona/generation, and assessment revision/cursor. |
| Assessment runs/findings | Historical snapshots and finding identity, scoped to namespace and profile. |
| Project drafts, projects, work items | Origin run, revision, allocation, and status; relational keys enforce project/run/finding consistency. |
| Saved canvas drafts | Typed identity, captured target, saved fields, and revision independently of browser tab lifetime. |
| Command/session receipts | Stable command identity and payload matching for retries and conflicting reuse. |
| Agent conversations, runs, events, receipts | Durable thread/message history, captured execution attempts, ordered lifecycle events, replay receipts, worker leases/fences, and recorded effect uncertainty. |
| Import receipts/sources | Source identity, acknowledgement, and provenance for explicit legacy imports. |
| Schema migrations | Applied migration names, checksums, and timestamps. |

Immutable historical records keep their validated domain snapshots; foreign keys
and revisions enforce ownership and command invariants. Fixture catalog changes
do not recreate missing historical evidence or authorize an expired org.
