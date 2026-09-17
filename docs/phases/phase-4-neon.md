# Phase 4 — Neon application persistence

**Started:** September 15, 2026  
**Status:** Approved — awaiting the user’s Phase 5 checkpoint  
**Baseline:** Approved Phase 3 working tree, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md#phase-4--neon-application-persistence)  
**Findings:** F1/F2 durable ownership, F9 demo server boundary, and F10 in the [architecture review](../architecture-review.md)

## Current synthesis

- The independent reviewer approved **P4-A1–P4-A8**, including the final
  documentation read. No unresolved in-phase finding or required work remains;
  the exact decision is transcribed below.
- The user-configured `dev` branch runs actual Neon Postgres 18.6. Verified TLS,
  direct ordered migrations, and pooled application commands use the approved
  server-only `pg` 8 path. Private configuration has not been exposed. Hosted
  wiring/deployment has not occurred.
- Final candidate 5 runtime is archived under `/tmp/ufd-phase4-neon/candidate5`,
  build `7DGiXxg-81-9PtS_a9xUl`. All 137 final source entries were reconciled; only
  the database-test backend-PID observation differs from the production build.
  Application runtime is unchanged.
- Evidence includes 92 independently passing unit/UI/pure tests, permanent pooled
  Neon SQL9/9, independent Neon service/migration/quota probes, coordinator and
  complementary production browsers, actual CLI fault recovery, and actual app
  process restart with session/content retention. All twelve review findings are
  resolved. The bounded export addition is accepted without changing literal A6.
- The app/test server is stopped, local Postgres remains stopped, and generated
  reviewer CLI/export namespaces were cleaned. Preserved artifacts identify exact
  candidates and earlier failures. Final independent approval is recorded; Phase 5
  still requires the user's next checkpoint.

## Scope and roles

The phase covers namespace/session ownership, schema and ordered migrations,
project/work-item/run/finding/saved-draft persistence, validated server operations,
client acknowledgement/recovery, explicit legacy import, and documented local/
Heroku configuration. Conversations and execution ownership remain Phase 5 unless
the agreed scope explicitly changes; Phase 5 still requires a new user checkpoint.

Retained agent threads now serve these Phase 4 roles:

- **Implementer:** `phase3_implementer`, Phase 4 source and tests.
- **Reviewer / approver:** `phase3_reviewer`, independent Phase 4 acceptance.
- **Scribe:** `phase2_reviewer`, solely Phase 4 documentation; no source/test edits
  or approval role.
- **Coordinator:** primary agent, scope/configuration coordination, independent
  baseline/integration/browser evidence, and user checkpoint.

Thread reuse preserves reviewed context and avoids the earlier thread cap. No
agent approves its own implementation. Historical Phase 1, 2, and 3 journals stay
unchanged; current status is maintained in the plan and this journal.

## Acceptance ledger

The coordinator and reviewer agreed all eight criteria against the full phase
scope. The [plan](../architecture-plan.md#acceptance-criteria-p4-a1-through-p4-a8)
contains their complete wording. Phase 2 historical integrity and Phase 3 identity/
navigation remain required. Mocks or local Postgres cannot replace real Neon
evidence, and no criterion may be silently weakened or deferred to gain approval.

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P4-A1 | Authorized isolated Neon target, one portable Postgres path, validated server-only configuration, no credential exposure | Reviewer satisfied: authorized dev, pooled/direct TLS and identity checks, validated config/HTTP boundary, 63 client assets with zero configured-secret matches. |
| P4-A2 | Recorded ordered migrations, owner-scoped relational constraints, repeatable seed, limited namespace reset | Reviewer satisfied: actual direct migrations/repeat and independent migration rollback/checksum probes; pooled SQL9/9, relational rejection, scoped repeatable seed/reset, actual CLI. |
| P4-A3 | Server-issued authenticated opaque namespace/session; persona, tamper, expiry, reset and sign-out integrity; client IDs grant no ownership | Reviewer satisfied: independent Neon session/isolation/generation/epoch tests, HTTP/browser/CLI and restart retention. |
| P4-A4 | Same-origin authorized validated commands; transactions, revisions, stable replay/conflicting-reuse rejection, bounded outputs/errors | Reviewer satisfied: validation/stream limits, concurrency/replay/rollback/timeouts, actual Neon quota3 and production fault/retry evidence. |
| P4-A5 | Acknowledged durable truth with safe unsaved buffers/reconciliation/retry/conflicts and preserved per-tab captured scope | Reviewer satisfied: R8/R11/R12 exact regressions, actual-Neon buffer/session/navigation/motion journeys, unknown-COMMIT and restart recovery; targets and pending bytes retained. |
| P4-A6 | Explicit selected-namespace import/preview, validation, idempotency/provenance, source retention and conservative collision handling | Reviewer satisfied: actual Neon import/source/replay/collision/concurrency checks and production import flows. Optional bounded export also accepted; it is not a new literal criterion. |
| P4-A7 | Independent regression/security tests, real isolated Neon integration, and affected production-browser evidence | Reviewer satisfied: independent92, permanent NeonSQL9/9, direct/pooled independent probes, full designated production families/CLI/restart, final source reconciliation. |
| P4-A8 | Complete accurate setup/ownership/reset/import/limits documentation, dialogue/dispositions/evidence and exact approval | Approved: final README/plan/journal read accepted; exact independent decision transcribed below. No required Phase 4 work remains. |

## Initial access and design facts

- **Coordinator:** the existing `@neondatabase/serverless` helper is unused. No
  `DATABASE_URL`/Neon environment configuration or local environment file was found
  in the initial check. `psql` and Docker are available.
- **Coordinator:** applied plugin-management discovery; Neon plugin availability
  returned `DISABLED_BY_ADMIN`/`NOT_AVAILABLE`, so no Neon connector is callable in
  this session. No connector installation or provisioning is claimed.
- **Coordinator:** asked asynchronously whether the user has an existing Neon
  project or wants setup help. A disposable development/test configuration should
  be provided through `.env.local`; credentials are not requested in chat and must
  not be copied into the journal, logs, source, or client output.
- **Boundary:** no paid provisioning or shared-database writes are included
  without an identified target and authorization. Missing access does not prevent
  local code/design work; it prevents claiming real Neon validation or approval.

## Review chronology

### Round 0 — Authorization, roles, and acceptance proposal

- **Coordinator:** user authorized Phase 4; reassigned the three retained threads
  to implementer, independent reviewer, and scribe. Began copying the approved
  Phase 3 baseline.
- **Reviewer:** proposed the eight acceptance areas above and reaffirmed that
  mocks/local Postgres cannot satisfy the real Neon gate. Began reviewing current
  seams and the installed Next guides.
- **Scribe:** updated plan status to Phase 3 approved/user-authorized Phase 4 and
  Phase 4 in progress, created this journal, and left the acceptance ledger open
  until agreement. Historical journals remain untouched.
- **Disposition:** authorized local work and acceptance alignment are underway.
  No Phase 4 technical validation or approval has occurred.

### Acceptance agreement

- **Reviewer:** reported the coordinator's approval of the exact P4-A1–P4-A8
  criteria now recorded in the plan and ledger. These require real Neon evidence,
  authenticated namespace ownership, transactional/revision/idempotency contracts,
  truthful client recovery, and explicit safe legacy import.
- **Scribe:** formalized the ledger after that agreement. All criteria remain
  pending implementation and evidence; no acceptance claim is made.

### Round 1 — Accepted persistence and session design

- **Implementer:** proposed one `pg` Pool and ordered SQL migrations in place of
  the unused Neon HTTP helper, with portable Postgres as the persistence path.
  Server-only commands own relational namespace/session records, persona-specific
  assessment cursors, runs/findings, project drafts/projects/work items, saved
  canvas drafts with stable captured targets, command receipts, and import
  provenance.
- **Session ownership:** a high-entropy opaque HttpOnly token is stored hashed and
  authenticated by server lookup. Server persona and generation checks prevent a
  stale command from acquiring current authority; client persona IDs are not
  authentication. Persona switching, sign-out, and reset have explicit generation
  behavior.
- **Command integrity:** command identity plus payload hash distinguishes replay
  from conflicting reuse. Revisions guard stale edits. Project creation atomically
  consumes the origin draft and creates the project/copied finding work items;
  the client awaits acknowledgement before navigating to the returned domain
  result.
- **Client durability:** pending edits are scoped to namespace/persona/generation;
  only server acknowledgement means durably saved. Stale responses and uncertain
  writes require explicit reconciliation/retry/conflict behavior. Missing database
  configuration must not silently select a browser-backed authority. Old browser
  store classes become import sources rather than a second live authority.
- **Import:** explicit preview and validation preserve historical missing/retired
  identities and source bytes, reject collisions conservatively, and record
  provenance/idempotency before acknowledging completion.
- **Reset lifetime:** choosing Sam or hydrating a session will no longer delete
  durable history. The demo reset becomes an explicit namespace-scoped scenario
  action. Deterministic assessment commands remain demo behavior; a durable
  executor is still Phase 5.
- **Reviewer:** accepted this design before source edits. Requested adversarial
  checks for concurrent duplicates, unknown-COMMIT replay, response loss around
  generation rotation, stale reads/replies, target retention after tab closure or
  save failure, relational run allocation, and retired historical references.
- **Disposition:** no blocking design change requested. Implementation and all
  evidence remain pending; real Neon verification is still required.

### Supplemental local database and driver references

- **Coordinator:** an isolated local Postgres `18.4` instance is ready under
  `/tmp`. Docker's executable exists but OS access is unavailable, so the
  coordinator used temporary native binaries from
  `@embedded-postgres/linux-arm64` `18.4.0-beta.17`. This is temporary test tooling,
  not a repository/system dependency or real Neon evidence.
- **Coordinator:** the approved Phase 3 baseline is copied to
  `/tmp/ufd-phase4-baseline`; existing historical journals remain unchanged.
- **References:** the coordinator supplied
  [Neon connection pooling](https://neon.com/docs/connect/connection-pooling) and
  the official node-postgres documentation. The scribe read the latter: a
  transaction must use one checked-out client throughout, then release it;
  connection pooling and TLS configuration need an explicit lifecycle and
  configuration path. Connection-string SSL options can override an `ssl`
  configuration object. See [transactions](https://node-postgres.com/features/transactions),
  [pooling](https://node-postgres.com/features/pooling), and
  [SSL](https://node-postgres.com/features/ssl). These are implementation reference
  rules, not claims that the application's database path has been verified.
- **Disposition:** local integration can proceed as supplemental evidence. Live
  isolated Neon configuration and verification are still missing and mandatory.

### Initial independent documentation/environment check

- **Reviewer:** accepted the formalized criteria, design record, and mandatory
  Neon gate; no documentation correction requested.
- **Reviewer:** independently connected under Node 22 to the reviewer-only local
  `phase4_review` database on Postgres `18.4`. An initial sandbox loopback
  `ECONNREFUSED` was resolved by authorized escalation. No credentials were printed.
- **Disposition:** supplemental connectivity works. No application migration,
  command, browser, or real Neon evidence is established by this environment check.

### Baseline UI capture for legacy import

- **Coordinator:** generated realistic import fixtures through the approved
  Phase 3 production UI, checking its build ID against the prior approved build.
  No real user record or credential is represented by these demo captures.
- **Sam fixture:** `/tmp/ufd-phase4-browser/legacy-sam-storage.json` contains two
  projects, three runs, and an in-progress work-item status. Capture uses
  `legacy-sam.mjs`; `phase2-flows-results.json` passes with page errors `[]`.
- **Alex fixture:** `legacy-alex-storage.json` in the same directory contains three
  scoped Apex drafts and a closed Query draft. Capture uses `legacy-alex.mjs`;
  `draft-scopes-results.json` passes with page errors `[]`.
- **Coordinator:** supplied fixture paths to implementer/reviewer and stopped the
  baseline server.
- **Disposition:** approved-baseline capture evidence only. Phase 4 preview,
  namespace binding, import acknowledgement, and durability are not yet validated.

### Round 2 — Project/work-item run constraint

- **Reviewer — P4-R1:** schema inspection found separate project and finding/run
  foreign keys do not require a work item's run to equal its project's run. The
  current constraint shape permits a project from run A to allocate a finding
  from run B within the same owner scope.
- **Requested correction:** add a composite owner/project/run foreign key and its
  referenced uniqueness constraint. Domain commands and the relational model must
  enforce the same allocation invariant.
- **Verification ownership:** reviewer owns independent SQL constraint, rollback,
  duplicate-concurrency, and parser/import probes; coordinator owns HTTP/browser
  journeys.
- **Disposition:** changes requested under A2/A4. Independent SQL reproduction and
  corrected-schema retest remain pending; no database acceptance claimed.

### P4-R1 independent SQL reproduction

- **Reviewer:** `/tmp/ufd-phase4-reviewer-schema-probe.mjs` against the captured
  `/tmp/ufd-phase4-reviewer-schema-initial.sql` reports
  `wrongRunInsertAccepted: true`. A project belonging to run A accepts a work item
  referencing an existing finding from run B in the same namespace/persona.
- **Scope:** reviewer-only local `phase4_review` database; the entire probe rolled
  back. This is an actual SQL constraint failure, not application/UI or Neon
  evidence.
- **Disposition:** P4-R1 is independently reproduced; fix and retest pending.

### P4-R1 retest and consistent-read requirement

- **Reviewer:** the original schema probe against ordered migrations `001` + `002`
  now rejects the cross-run insertion: `wrongRunInsertAccepted: false`, SQLSTATE
  `23503`. The probe again fully rolled back in the reviewer-only local database.
  P4-R1's relational constraint correction passes independent retest.
- **Reviewer:** raised a separate design requirement for `readWorkspace`: multiple
  SELECT statements need one consistent transaction snapshot. Default READ
  COMMITTED can combine an earlier revision with later record values. Service
  integration is not complete, so this is an open consistency check rather than
  a confirmed complete-API failure.
- **Disposition:** P4-R1 resolved at the schema-probe level. Migration-runner,
  command, consistent-read, and real Neon evidence remain pending.

### Guided Neon setup

- **User:** “I need help setting up Neon.”
- **Coordinator:** supplied official-console steps for a `unified-front-door`
  project using the Free plan, default Postgres, and AWS `us-east-1`, with separate
  `development` and `heroku-demo` branches before data is added. Requested pooled
  and direct development connection configuration plus confirmation that the
  development target is disposable and the hosted branch is separate.
- **Coordinator:** prepared an ignored mode-600 `.env.local` with blank
  `DATABASE_URL`/`DATABASE_URL_UNPOOLED` and Basic Auth password, plus local origin
  and username defaults. The root/user own that file; credentials are entered
  locally, never into this journal or chat.
- **Disposition:** user setup/configuration and target confirmation remain pending.
  No Neon resource or connection is yet verified.

### Round 3 — Legacy planning-canvas target derivation

- **Reviewer — P4-R2:** independently exercised the actual `decodeLegacy` codec
  through Node 22 `testModules`. Removing only `canvas.targets` from the generated
  Sam fixture models a valid pre-Phase-3 source. Both planning canvases then import
  with a null org, although their projects in that same source declare SIT.
- **Requested correction:** for an uncaptured planning canvas, use its matching
  saved project's authoritative target from the imported source. Preserve explicit
  captures, including meaningful null values, and do not guess unrelated app/work
  orgs from the current catalog.
- **Disposition:** P4-R2 is a reproduced codec-level target inconsistency; fix and
  regression pending. Persisting the null as an immutable capture would repeat the
  Phase 3 planning-target bug. No database or browser import success is implied.


### P4-R2 retest and migration/read progress

- **Reviewer:** the original legacy codec retest now reports saved SIT/imported
  SIT for both plans. Explicit captured targets remain preserved; the additional
  missing-plan recovery case also passes. This closes the reproduced P4-R2 codec
  mismatch; complete import/browser/Neon acceptance remains separate.
- **Reviewer:** actual ordered migrations `001`–`003` apply and repeat successfully
  on the isolated reviewer database. The GET caller now establishes REPEATABLE
  READ before workspace queries, addressing the consistent-snapshot design
  requirement by source inspection. No concurrent-read runtime proof is claimed
  by that inspection.
- **Disposition:** local migration and codec checks pass. Client integration,
  concurrency/recovery, and real Neon verification remain pending.

### Round 4 — Import revision and acknowledgement integrity

- **Reviewer — P4-R3:** actual server/SQL probe
  `/tmp/ufd-phase4-reviewer-import-probe.mjs` accepts `expectedRevision: 999`
  against revision 0. Repeating the same source under a new command then returns
  revision 2 while the database remains at revision 1. Reported fields are
  `staleRevisionAccepted: true`, `repeatReturnedRevision: 2`, and
  `actualRevisionAfterRepeat: 1`.
- **Requested correction:** after receipt lookup, enforce the expected revision
  for a first import. A repeated import must acknowledge the actual persisted
  revision rather than manufacture a new revision for a no-op.
- **Scope:** actual service/SQL evidence in fresh reviewer-only local namespaces,
  cleaned after the probe. This is neither browser nor Neon evidence.
- **Disposition:** P4-R3 changes requested under A4/A6; fix and original-probe
  retest pending.

### Configuration command and uncertainty questions

- **Scribe:** source inspection while preparing setup documentation found that
  `db:migrate` invokes plain Node and the script reads `process.env` directly,
  although guided setup puts configuration in `.env.local`. Asked the implementer
  to provide a supported command that loads that file without manually exporting
  a secret.
- **Scribe:** the migration error currently says no migration was committed even
  when a COMMIT response could have been lost. Asked for truthful outcome/retry
  wording and referred the uncertainty boundary to the reviewer.
- **Disposition:** source-level command/documentation questions, not independent
  runtime reproductions. Implementer/reviewer responses remain pending; no scribe
  application edits were made.


### Round 5 — Populated reset foreign-key failure

- **Reviewer — P4-R4:** `/tmp/ufd-phase4-reviewer-integration.mjs` reaches six
  passing scenario records, then deleting a populated workspace fails with
  SQLSTATE `23503`. Cascading deletion of assessment runs reaches findings before
  the dependent work items are removed; the finding foreign key uses immediate
  NO ACTION. The same deletion is used by `changeSession.reset`.
- **Requested correction:** make the explicitly scoped reset work for populated
  projects without weakening the finding/project ownership constraints, and add
  a service-reset regression.
- **Intermediate evidence:** directed assertions passed for eight concurrent
  duplicate commands, atomic creation/status revisions, rollback plus receipt,
  namespace/persona isolation, transaction timeout settings of 10s/5s/15s, and
  `pg_sleep` cancellation followed by pool reuse.
- **Disposition:** the complete command exits 1, so this is a failed integration
  probe despite its passing intermediate records. Reset correction/retest is
  required. Residual synthetic rows are limited to the reviewer database, with
  cleanup under the same authorized review scope. No Neon evidence is implied.


### Migration CLI documentation corrections

- **Scribe:** subsequent source inspection confirms `db:migrate` now runs Node
  with `--env-file-if-exists=.env.local`, matching the guided local configuration
  path. Hosted environment variables can still supply configuration without that
  local file.
- **Scribe:** the migration catch now reports an unavailable outcome and instructs
  a rerun to verify committed migration history, rather than guaranteeing rollback
  after an uncertain COMMIT response.
- **Disposition:** both source-level documentation/command questions are corrected.
  The supported CLI's exact runtime evidence remains to be reported; no credentials
  were inspected and no application changes were made by the scribe.


### P4-R4 migration correction attempt

- **Reviewer:** the actual migration runner rejects migration `004` and exits 1
  because its SQL names an overlong generated foreign-key constraint that does not
  exist. PostgreSQL's actual name is
  `project_work_items_namespace_id_profile_id_run_id_finding__fkey`.
- **Requested correction:** use the actual constraint identity, then verify fresh
  and repeated migrations before rerunning populated reset.
- **Reviewer:** the runner's observed error output now accurately reports an
  unavailable outcome and rerun verification. This confirms the CLI wording change
  in an actual failure, without claiming uncertain-COMMIT fault injection.
- **Disposition:** P4-R4 remains open; migration 004 has not passed. The earlier
  successful migration evidence covered only 001–003.

### Setup documentation draft

- **Scribe:** README now describes the installed `pg` path, supported local
  environment/migration commands, separate development/hosted branch configuration,
  migration checksum/retry behavior, and the current Phase 4 review gate. It does
  not claim a Neon connection or Heroku deployment.
- **Boundary:** the older browser-persistence section is explicitly identified as
  Phase 3 behavior awaiting the final client handoff. Final README reconciliation,
  exact UI labels, ownership/reset/import limitations, and evidence remain pending.


### Dependency audit applicability review

- **Reviewer:** reviewed the coordinator's audit applicability questions. Reported
  advisories concern inherited Next `16.2.9`/transitive packages; `pg` is clean in
  that audit. Source lacks the particular single-locale i18n/proxy-bypass condition,
  Server Actions, server-side body fetch caching, Windows deployment, and image
  upload/remote-pattern/Next-image callers considered in that review.
- **Reviewer:** the framework's image optimizer is still enabled. Suggested either
  disabling the unused optimizer with HTTP verification, or separately reviewing
  a Next/ESLint upgrade before the final build. Did not claim an audit-clean tree
  or that exploitation is impossible.
- **Disposition:** coordinator decision and exact audit artifact/vendor references
  pending. Dependency remediation/recheck remains an explicit release obligation;
  no Phase 4 acceptance is implied by the applicability discussion.


### Round 6 — Request and configuration boundaries

- **Reviewer — P4-R5:** source review confirms malformed preview values can fall
  through to mutation. Preview must be absent or boolean, with invalid values
  rejected before the database operation. Request parsing must count and bound
  streamed bytes; checking after `request.text()` buffers the entire body first.
- **Reviewer:** configuration must validate a Postgres URL and an explicit HTTP(S)
  `APP_ORIGIN`, require the origin in production, and fail with safe output. The
  coordinator owns actual HTTP verification of these boundaries.
- **Client recovery requirements:** implementer-declared work in progress still
  needs truthful quota/storage messages and accessible recovery/export of edits
  from an old session generation. Retaining raw inaccessible browser keys alone
  does not meet A5. These are reaffirmed requirements, not failures claimed against
  a final client candidate.
- **Disposition:** P4-R5 changes requested. Configuration/request fixes and HTTP
  retests remain pending; client recovery is still under implementation/review.


### Audit evidence and bounded maintenance disposition

- **Coordinator:** `npm audit --omit=dev --json` is saved at
  `/tmp/ufd-phase4-production-audit.json`. It reports five production findings:
  one critical, three high, and one moderate, across `next`, `postcss`, `sharp`,
  `nanoid`, and `baseline-browser-mapping`.
- **Coordinator:** chose to disable the unused image optimizer now, with installed
  documentation/source verification and an actual endpoint-refusal check. A broad
  framework upgrade is outside this active wiring change; dependency remediation
  and re-audit remain explicit Phase 7 release-readiness work.
- **Disposition:** optimizer correction and HTTP verification pending. Neither the
  applicability assessment nor this bounded mitigation makes the audit clean.
  Browser harnesses are prepared but have not yet run.


### Corrected migration 004 on the browser test database

- **Coordinator:** independently ran Node `22.23.2`
  `node --env-file=/tmp/ufd-phase4-postgres/browser.env scripts/database.mjs migrate`
  against isolated local Postgres `18.4`, database `phase4_browser`. Migrations
  `001`–`004` apply successfully, exit 0. No environment values were logged.
- **Coordinator:** syntax checks pass for
  `/tmp/ufd-phase4-browser/api-boundaries.mjs` and `import-and-durability.mjs`.
  Neither runtime browser suite has run; the integrated candidate is still pending.
- **Disposition:** corrected latest migrations apply on the coordinator's local
  test target. P4-R4 still requires the independent populated-reset retest; this
  result does not establish Neon or browser durability.


### P4-R3/P4-R4 independent corrected retests

- **Reviewer:** the original import probe now rejects stale expected revisions:
  `staleRevisionAccepted: false`, `staleCode: conflict`. Repeating a source returns
  revision 1, matching actual database revision 1. P4-R3's reproduced revision and
  acknowledgement defects pass independent retest.
- **Reviewer:** corrected migration `004` applies. Expanded
  `/tmp/ufd-phase4-reviewer-integration.mjs` exits 0 with seven scenario records and
  errors `[]`, recorded at
  `/tmp/ufd-phase4-reviewer-integration-results.json`. Populated reset and isolation
  now pass, closing P4-R4's original failure.
- **Coverage:** eight duplicate commands, five duplicate project creations,
  rollback/receipts, status/generation/persona checks, transaction settings of
  10s/5s/15s, actual SQLSTATE `57014` timeout cancellation, and pool reuse. Synthetic
  namespaces were cleaned after the run.
- **Disposition:** P4-R3/P4-R4 pass independent local service/SQL retests. This is
  local Postgres evidence, not Neon or production-browser acceptance.

### Audit source attribution

The reviewer supplied the primary Next vendor advisories used in the applicability
review: [GHSA-6gpp-xcg3-4w24](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24),
[GHSA-m99w-x7hq-7vfj](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj),
[GHSA-68g3-v927-f742](https://github.com/vercel/next.js/security/advisories/GHSA-68g3-v927-f742),
and [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
The audit counts, bounded mitigation, and remaining release obligation above stay
unchanged; these references do not imply a clean dependency audit.


### Candidate 1 — First production integration and imported-target failure

- **Coordinator:** candidate 1 production build passes. Source, checksums, and
  `BUILD_ID` are archived under `/tmp/ufd-phase4-browser/candidate1`.
- **Actual HTTP evidence:** `api-boundaries-results.json` in that archive passes
  eight records, including malformed-preview HTTP 400 and unused image-optimizer
  HTTP 404. These provide runtime evidence for the bounded request/optimizer
  changes; complete criterion acceptance remains separate.
- **Actual browser finding:** explicit preview/import of four Alex drafts and
  retention of the original browser bytes pass. Opening an imported CRM target
  then incorrectly shows unavailable: JSONB reorders object properties, while the
  client compares targets using `JSON.stringify` equality despite identical values.
- **Implementer:** confirmed the source defect and changed the comparison to
  semantic `sameTarget`. The reviewer assigned **P4-R6** and requires semantic
  field equality plus a reversed-key-order regression. Corrected candidate retest
  remains pending.
- **Disposition:** the whole browser suite exits 1, with page errors `[]`; this is
  an assertion/product failure, not a passing durability suite. See archived
  `import-and-durability-failed-results.json` and its failure screenshot. The server
  is stopped while candidate 2 awaits the target fix. Real Neon remains pending.


### Session lifetime and remaining client handoff

- **Implementer:** confirmed the scribe's source reading: a 30-day opaque cookie
  retains the same browser namespace across sign-out/persona changes; missing or
  expired cookies create a fresh namespace, with no cross-device account recovery.
  README now states these demo identity limits explicitly.
- **Implementer:** Sam reset is explicit review followed by **Confirm reset of
  this profile**; original import sources stay untouched after acknowledgement.
- **Implementer:** the target equality correction is implemented/tested and the
  coordinator is building candidate 2. Recovery/export UI and separation of a
  cloned tab's queue source from its writer identity remain under implementation.
- **Coordinator/implementer:** finite demo storage ceilings with no eviction are
  acceptable in principle; exact quota design/evidence remains under reviewer
  review. Phase 6 still owns pagination. No whole-phase or Neon approval is claimed.


### Candidate 2 — Imported targets and durable draft journeys

- **Coordinator:** candidate 2 production build and the complete import/durability
  browser suite pass: seven records, page errors `[]`, exit 0. Current result is
  `/tmp/ufd-phase4-browser/candidate2/import-and-durability-results.json`; a candidate 2 archive
  now preserves this evidence before later reruns.
- **Coverage:** all three Apex scopes/content now resolve correctly after import,
  explicit preview/import preserves four drafts and original source bytes, a
  closed Query draft reopens, and saved content survives reload plus clearing
  browser preferences. A response lost after COMMIT retries the same command ID
  without an extra revision; unsent edits survive reload/retry; two tabs retain
  distinct targets.
- **Harness corrections:** two earlier candidate 2 attempts selected the chat
  textarea or a generic imported closed title. Corrected selectors passed without
  application changes; failed attempts are archived separately. These were test
  harness issues, distinct from candidate 1's actual target-comparison defect.
- **Disposition:** coordinator browser evidence closes P4-R6's original journey,
  pending reviewer acceptance. Sam planning/history is next. This result does not
  cover real Neon, old-generation recovery, opener/cloned-tab queues, or quotas.


### P4-R5 independent boundary verification

- **Reviewer:** `/tmp/ufd-phase4-reviewer-http-probe.mjs` and its `/tmp/ufd-phase4-reviewer-http-results.json`
  report two passing groups covering configuration/origin validation, streamed
  UTF-8 byte counting/cancellation, and safe errors. Coordinator actual HTTP
  evidence separately covers malformed preview rejection.
- **Disposition:** P4-R5's source/probe requirements pass independent verification;
  final candidate/browser/configuration evidence remains scoped to its recorded run.

### Round 7 — Contradictory imported historical copies

- **Reviewer — P4-R7:** actual importer probe
  `/tmp/ufd-phase4-reviewer-import-edges.mjs` and
  `/tmp/ufd-phase4-reviewer-import-edges-before-results.json` show that a project
  item's embedded finding can contradict the same-ID/same-run finding summary.
  Both preview and COMMIT accept the source, persisting divergent historical copies.
- **Requested correction:** enforce semantic agreement, preserve the conflicting
  content for recovery, or reject the source while retaining its original bytes.
  Import cannot silently acknowledge contradictory history as one consistent fact.
- **Other passing group:** repeating the same source after a later status edit
  preserves the edit; a differing source collision rolls back; the stored original
  source matches exactly.
- **Environment:** incremental migration `005` passes. Early edge-probe attempts
  had temporary cleanup/unapplied-005 problems, corrected before the reported
  evidence. These harness/environment attempts do not replace the reproduced
  importer defect.
- **Disposition:** P4-R7 changes requested under A2/A6; fix and original-probe
  retest pending. These are actual local importer/SQL checks, not Neon evidence.


### Round 8 — Edits made while discarding a conflict

- **Reviewer — P4-R8:** independent client probe
  `/tmp/ufd-phase4-reviewer-client-edges.mjs` reproduces loss of a new edit during
  conflict recovery. **Use saved version** starts a remote read; the user enters
  another field before it resolves; completion clears all pending commands,
  including that newer edit, then incorrectly reports saved.
- **Reported evidence:** `newEditRetained: false`, pending count 0 in the probe's
  results at `/tmp/ufd-phase4-reviewer-client-edges-before-results.json`. This is a
  confirmed client recovery race, not a browser demonstration.
- **Requested correction:** capture the command set being discarded, or explicitly
  disable editing during recovery, with a permanent regression. A later edit must
  not be included implicitly in the earlier discard decision.
- **Disposition:** P4-R8 changes requested under A5; corrected probe/browser
  evidence pending. Independent expired/revoked-session and reset-epoch checks
  are next.


### Independent session expiry, reset epoch, and deferred constraints

- **Reviewer:** `/tmp/ufd-phase4-reviewer-session-edges.mjs` passes three groups,
  recorded at `/tmp/ufd-phase4-reviewer-session-edges-results.json`.
- **Session checks:** expired/revoked tokens reject reads, mutations, and reset;
  replacement bootstrap creates a distinct anonymous namespace. Workspace epoch
  survives persona return, rotates on reset, is retained through lost-response
  GET/replay recovery, and preserves another persona's records.
- **Constraint check:** the deferred finding foreign key still rejects an invalid
  relationship at COMMIT, and rollback leaves prior records intact. An initial
  harness attempt reused fake finding IDs, hitting an unrelated unique constraint;
  distinct IDs corrected the fixture before the accepted deferred-FK evidence.
- **Disposition:** independent actual local service/SQL session and constraint
  checks pass. No real Neon result or whole-phase approval is implied.


### Round 9 — Second created project does not become active

- **Coordinator / reviewer — provisional P4-R9:** the planning/history browser
  acknowledges and persists the second project and its tab, but the active view
  stays on the first project for 30 seconds. The complete journey fails; see
  `/tmp/ufd-phase4-browser/candidate2/planning-history-failed-results.json`.
- **Earlier passing assertions:** first creation, saved SIT target, status retry,
  reload, and immutable history. These partial results do not make the full
  planning/history suite pass.
- **Disposition:** root diagnostics are ongoing. No specific race or cause is
  claimed yet; correction/disposition and complete browser retest remain pending.


### Round 10 — Concurrent import and first canvas save overwrite

- **Reviewer — P4-R10:** actual concurrent service/SQL probe
  `/tmp/ufd-phase4-reviewer-import-race.mjs`, recorded at
  `/tmp/ufd-phase4-reviewer-import-race-before-results.json`, reproduces silent overwrite.
  An import transaction holds the quota lock. A new-canvas save with expected
  revision 0 reads the row as absent, then waits. Import creates that same canvas
  at revision 1 and commits; the waiting save resumes its UPSERT, replaces the
  imported fields at revision 1, and acknowledges success.
- **Requested correction:** revalidate the absent row after serialization, or use
  a conditional insert that returns a conflict without overwriting an intervening
  row. Add a real concurrency regression for this ordering.
- **Disposition:** P4-R10 is independently reproduced under A4/A6. Root and
  implementer were informed; fix and original-concurrency-probe retest pending.
  This is local Postgres evidence, not Neon evidence.


### Round 11 — Recovery export replaces newer in-memory edits

- **Reviewer — P4-R11:** actual recovery/export probe
  `/tmp/ufd-phase4-reviewer-recovery-probe.mjs` and
  `/tmp/ufd-phase4-reviewer-recovery-before-results.json` reproduces loss from the recovery
  presentation. The first edit is buffered on disk; quota failure leaves the next
  edit only in memory. Recovery initially archives both, but the older disk entry
  overwrites the same key, so export contains only the first edit and is labeled
  buffered.
- **Requested correction:** preserve differing versions and accurately identify
  the newest in-memory content rather than replacing it with stale disk bytes.
- **Implementer:** reports R7/R8/R10 corrections landed. Their independent retests
  await the current debug freeze; implementation reports alone do not close them.
- **Disposition:** P4-R11 changes requested under A5, with fix/retest pending.
  Root and implementer were informed. No whole-phase approval is claimed.


### Candidate 3 — Independent R7/R8/R10 corrected retests

- **Reviewer:** all three original Node 22 probes now exit 0. Their original
  failures are preserved as the corresponding `-before-results.json` files; the
  earlier evidence rows above point to those preserved versions.
- **P4-R7:** `/tmp/ufd-phase4-reviewer-import-edges-results.json` reports
  `previewAccepted: false` and `commitAccepted: false` for contradictory historical
  copies. The importer rejects the inconsistent source.
- **P4-R10:** `/tmp/ufd-phase4-reviewer-import-race-results.json` reports a conflict
  for the intervening first save; the imported original fields remain at revision
  1. The original concurrent overwrite no longer occurs.
- **P4-R8:** `/tmp/ufd-phase4-reviewer-client-edges-results.json` preserves the newer
  edit, keeps one pending command, and reports conflict after the earlier discard
  read completes. It no longer clears the post-click edit or falsely says saved.
- **Disposition:** independent corrected probes close R7/R8/R10 at their tested
  boundaries. R9/R11, quotas, final CLI/permanent SQL coverage, and final integrated
  candidate/Neon evidence remain pending.


### Supported seed/reset CLI and recovery handoff design

- **Implementer:** finalizing `demo:seed` and `demo:reset` through the running
  application's authenticated session API. This reuses scoped application commands
  rather than adding a separate reset SQL path. The explicit `--session-file`
  must be private (mode 600); configuration comes from `.env.local` and is not
  printed.
- **Proposed command behavior:** seed creates/selects an isolated demo namespace
  and persona and repeats without deleting records. Reset requires
  `--confirm-reset` and retains the exact command ID for response-loss replay.
  `db:migrate` remains the direct Postgres/ordered SQL path. Exact supported CLI
  invocation and runtime evidence are pending.
- **Recovery UI:** the current labels are **Recover pending edits**, **Export
  pending edits**, and **Review before discarding**. R11's competing memory/disk
  content correction is still in progress; these labels are not proof of recovery
  correctness.
- **Workspace epoch:** server-owned reset epoch preserves local preferences across
  persona switches and permits fresh preferences after an acknowledged or
  reconnected reset. Final browser verification remains pending.
- **Scribe scope check:** Phase 1, 2, and 3 journals exactly match their copies in
  `/tmp/ufd-phase4-baseline`. README/plan/current journal edits pass whitespace check.


### Independent capacity and byte-bound evidence

- **Reviewer:** `/tmp/ufd-phase4-reviewer-quota-probe.mjs` passes three groups,
  recorded at `/tmp/ufd-phase4-reviewer-quota-results.json`.
- **Actual database checks:** 63 saved canvases plus two concurrent first saves
  stop at 64; edits to existing drafts still work at the count limit. Exactly
  65,536 UTF-8 bytes in the serialized fields object are acknowledged; larger
  content is rejected without changing the saved record. A seventeenth distinct
  import is rejected without source loss or assessment revision change.
- **Pure boundary checks:** oversized history, cursor, project draft, canvas
  identity, and provenance representations reject. An early quota fixture used
  invalid empty `{}` legacy input; a valid empty build slice corrected the harness
  before the accepted result.
- **Reviewer:** source-reviewed worst-case workspace output is approximately
  13.6 MiB beneath the 16 MiB guard. This is a bound calculation, not a performance
  measurement or Neon evidence.
- **Scribe:** README now records exact current demo ceilings and no-eviction
  behavior, while leaving measured pagination/growth to Phase 6. R11 recovery
  export and other final browser requirements remain open.


### Independent full migration-runner verification

- **Reviewer:** `/tmp/ufd-phase4-reviewer-migrations-probe.mjs` passes two groups,
  recorded at `/tmp/ufd-phase4-reviewer-migrations-results.json`.
- **Actual runner checks:** fresh migrations `001`–`005` apply in an isolated
  schema; repeating is a no-op; tampering with an applied migration checksum is
  refused. A copied runner/SQL set with a deliberately failing sixth migration
  rolls back all new DDL/history and reports the outcome safely.
- **Scope:** all probe schemas and temporary copies were cleaned. This exercises
  the real migration runner against local Postgres `18.4`, without modifying the
  application's ordered migration files.
- **Disposition:** fresh/repeat/checksum/rollback migration evidence passes locally.
  Seed/reset CLI and real Neon verification remain pending.


### Current client documentation reconciliation

- **Scribe:** replaced README's historical browser-authority section with the
  current server client boundaries: acknowledged saves, stable retry identity,
  conflict review/rebase/discard, manual recovery/export, and explicit previewed
  import. Local preferences and ephemeral conversations remain distinct.
- **Scribe:** documented current UI labels and retained an explicit statement that
  recovery/final browser/Neon verification is still under review. R11 is not treated
  as verified simply because recovery UI exists.
- **Reviewer:** accepted the capacity and local-versus-Neon wording before this
  final client reconciliation; requested changing the journal's baseline present
  tense once the server candidate was wired. That wording is now historical.
- **Disposition:** final candidate documentation review remains pending alongside
  R9/R11, CLI/integration, and real Neon evidence. No exact approval is recorded.


### P4-R9 router investigation and revised dependency decision

- **Coordinator:** the trace shows the central controller pushes the correct
  second project ID, then receives the cached first URL. The upstream change
  addresses requested-search versus rendered-search cache behavior; the installed
  version lacks it. This supports the upgrade investigation but does not establish
  a final framework-cause or closure claim before the original browser retest.
- **Reviewer:** agreed that the R9 navigation failure now justifies a bounded
  upgrade to Next `16.3.5` with matching ESLint configuration. This supersedes the
  earlier decision to leave this dependency's upgrade solely to Phase 7 on audit
  applicability grounds.
- **Evidence:** independently compared the installed `16.2.9` missing-requested-
  search behavior with the primary [Next change #94144](https://github.com/vercel/next.js/pull/94144/files)
  and the production regression. Verified the vendor's
  [stable 16.3.5 release](https://github.com/vercel/next.js/releases/tag/v16.3.5).
- **Disposition:** upgrade implementation is not a passing fix. The original
  planning/history browser reproduction must pass on the rebuilt candidate,
  alongside regression checks and a fresh dependency audit. Phase 7's general
  release audit/remediation obligation remains intact.
- **Coordinator:** stopped the current test server before implementation changes.
  Prepared a generated saved draft and private session context for a real process
  restart check on the next build. Those are preparation artifacts only; process
  restart durability has not passed yet and private context is not copied here.


### P4-R11 core retest and malformed-buffer recovery follow-up

- **Reviewer:** the original recovery probe now passes, recorded at
  `/tmp/ufd-phase4-reviewer-recovery-results.json`. It separately exports the
  latest two-command in-memory version and the older one-command disk version,
  with accurate memory/buffer flags. The original failure is archived at
  `/tmp/ufd-phase4-reviewer-recovery-before-results.json`.
- **Remaining source follow-up:** explicitly discarding a malformed restore-source
  buffer leaves the active store invalid until reload. Requested coherent retry/
  reload recovery UX; this follow-up is source-inspected, not yet browser-confirmed.
- **Disposition:** R11's stale export defect passes its independent core retest.
  Recovery is not fully accepted until the follow-up and final browser/docs checks
  complete. Reviewer navigation/motion/surface-context/capability browser checks
  are being prepared.

### Supported CLI and permanent SQL test documentation draft

- **Scribe:** source inspection now confirms the `demo:seed`/`demo:reset` and
  `test:database` package commands exist. README documents the exact CLI invocations,
  private absolute session-file path, explicit reset/replay behavior, and the
  separate migrated `DATABASE_TEST_URL` requirement.
- **Boundary:** CLI documentation still marks runtime verification pending. The
  SQL suite uses fresh namespaces on an explicitly selected test target and does
  not auto-migrate it. The scribe did not run these mutating commands or inspect
  any private session/environment file.


### User clarification — Where the Neon URLs come from

- **User:** asked where `DATABASE_URL` and `DATABASE_URL_UNPOOLED` values originate.
- **Coordinator:** explained Neon Console project → **Connect**, development
  branch, **Connection string** format, pooling on for runtime and off for direct
  migrations. Both URLs use the same branch/database/role; only the URL is copied,
  without `psql`, into the local environment file.
- **Scribe:** added the same short procedure beside the README environment table,
  linked to [Neon's guide](https://neon.com/docs/connect/connection-pooling). Official
  documentation search corroborates the pooling toggle and connection-string path.
- **Disposition:** setup is still pending. No live Neon target or write is claimed,
  and no credentials were requested in chat or copied into documentation.


### User clarification — Account/project setup comes first

- **User:** clarified that they still need to create a Neon account first.
- **Coordinator:** explained signup at the Neon Console, then creating the
  `unified-front-door` project; the development branch and connection values follow
  from that dashboard.
- **Scribe:** README now starts the connection procedure with account/project
  creation. Current status is account/project not yet created, not merely missing
  connection values.
- **Disposition:** no confirmed remote target exists. All current SQL/integration
  evidence remains local Postgres; Phase 4 cannot be approved without real Neon.


### Candidate 4 — Router, recovery, and CLI handoff

- **Implementer:** pinned Next and matching ESLint configuration to `16.3.5`,
  verified requested-search propagation in the installed code, read the new
  installed guides, and removed temporary debug instrumentation. The original R9
  production regression still needs to pass before closure.
- **Dependency result:** npm reports four advisories (one moderate, three high),
  without claiming a clean audit. A final exact audit command/artifact and release
  disposition remain separate from this install report.
- **Recovery:** latest memory and older disk versions remain separately exportable;
  labels identify original namespace/profile/generation and current/previous
  context. Acknowledged archives clear. Explicit malformed-buffer discard resumes
  editing only when the exact reviewed source is removed; changed bytes remain
  protected. Independent follow-up/browser retests are pending.
- **CLI:** seed/reset reuse the app API with an absolute mode-600 session file,
  default `sp` profile, and explicit reset confirmation. Session-file writes now
  use a temporary file, fsync, and rename; pending command identity is persisted
  before the request. `test:cli` was added.
- **Permanent SQL tests:** added project/run foreign-key rejection and an actual
  waiting barrier for the concurrency regression. The complete test run is in
  progress; no result is yet claimed.
- **Disposition:** candidate 4 implementation handoff only. Coordinator owns
  production and required real Neon evidence; no Phase 4 approval.


### Candidate 4 production-only audit

- **Coordinator:** repeated `npm audit --omit=dev --json` after the Next `16.3.5`
  upgrade; `/tmp/ufd-phase4-production-audit-candidate4.json` reports one moderate
  finding in `baseline-browser-mapping`, with zero high or critical findings.
- **Scope distinction:** the earlier four-advisory npm install summary included
  development dependencies. It must not be reported as four production findings.
  The earlier five production findings describe the pre-upgrade candidate only.
- **Disposition:** one production finding remains, so no audit-clean claim. Phase
  7 still owns final dependency remediation and release re-audit.
- **Setup status:** the user is asking which Neon services to choose; the exact
  page/options have not yet been supplied. No account/project target is confirmed.


### User setup — Actual project-creation form

- **Coordinator:** the user reached a project-creation screen with a blank name,
  AWS US East 2 (Ohio), Postgres enabled, and Object storage/Functions/AI gateway/
  Neon Auth disabled.
- **Coordinator:** advised retaining those service switches, naming the project
  `unified-front-door`, and choosing **Create project**. This application consumes
  Postgres only; additional Neon services are not required for Phase 4.
- **Scribe:** added the service selection to README and updated current setup state
  from account creation pending to project creation in progress.
- **Disposition:** creation is not yet confirmed. No remote target/configuration,
  database write, or Neon acceptance is claimed.


### Candidate 4 source freeze and implementer validation

- **Implementer:** reports 91 unit/UI/pure tests passing, eight actual local
  Postgres tests passing, TypeScript passing, lint with zero errors and the one
  inherited layout stylesheet warning, and a clean whitespace check. A focused
  CLI test also passes after adding parent-directory fsync to atomic writes; this
  rerun is not added as a new distinct suite count.
- **Compatibility correction:** the full suite caught a browser-preference unsaved
  retry-visibility regression. The fix preserves that browser retry action and
  the separate meaning of server pending/saving states; the final reported suite
  passes.
- **Installed framework guide:** Next `16.3.5` removed the experimental
  `viewTransition` configuration flag and documents that no configuration is
  needed. The obsolete flag was removed after reading that guide.
- **Disposition:** source is frozen for the coordinator build. These are
  implementer-reported candidate checks; production R9/browser/CLI journeys,
  independent final review, and actual Neon evidence remain pending. The current
  production-only audit is one moderate finding, separate from npm's broader
  four-advisory install report.


### Round 12 — Reused writer identity can delete an unread buffer

- **Reviewer — P4-R12:** implementer source inspection confirms a cached page ID
  can be reused when the same page allocates another store after a failed session
  action. A storage read throws and only marks buffering unavailable; automatic
  retry then persists an empty queue and deletes that unread same-key value.
- **Accepted correction:** allocate a fresh writer UUID for every store instance,
  preserve the previous source pointer, and use exact-source compare-and-swap
  behavior for cleanup. Add a regression for the failed-read/adoption ordering.
- **Disposition:** P4-R12 changes requested under A5. Implementation and the exact
  regression are pending after the current root build freeze; no browser failure
  is claimed beyond this confirmed source path.

### Proposed durable legacy export — interpretation later corrected

- **Implementer / reviewer, at this point:** treated authenticated namespace/
  generation-bound export of persisted raw source/recovery as required by A6 so it
  could be accessed after browser values were cleared. At the pause checkpoint the
  reviewer corrected this: export was their interpretation, not the literal A6
  criterion. The preservation requirement is met by retaining raw source; the
  added export remains optional pending independent review/scope decision.
- **Proposed bound:** at most 16 import summaries, with a bounded per-import export
  of roughly 9 MB for source/recovery representations. Exact contract, implementation,
  tests, and browser proof remain pending.
- **At-time disposition:** the next candidate was arranged under that interpretation,
  with no verified export claim. The corrected present disposition is optional
  added scope, without automatic import or new cross-namespace authority.


### Candidate 4 — Production regression and restart evidence

- **Coordinator:** production build passes with `BUILD_ID`
  `zG62muTnFs6baGFWzLIh-`. Exact source (135 checksum entries), build ID, results,
  and audit are preserved in `/tmp/ufd-phase4-browser/candidate4`.
- **All five coordinator families pass:** `api-boundaries-results.json` (eight
  groups), `planning-history-results.json` (four),
  `import-and-durability-results.json` (seven), `buffer-and-session-results.json`
  (four), and `process-restart-verified-results.json` (one). Browser page errors
  are `[]`.
- **Original R9 journey:** the second project opens correctly after creation while
  prior status/history remain intact. R11's newest-memory export, opener behavior,
  lost-reset response recovery, and an actual application process restart are
  covered by the appropriate passing families.
- **Disposition:** candidate 4 closes the coordinator's original R9 production
  reproduction and provides real local app restart evidence. R12's unread-buffer
  path and the accepted durable legacy-export user path are upcoming corrections;
  all Phase 4 criteria and real Neon verification are not yet complete.
- **Archive precision:** candidate 2's successful draft import suite and failed
  planning-history evidence are now linked to its preserved archive above.

### User setup — Existing dev branch

- **User:** confirms a newly created Neon project with only one branch, `dev`.
- **Coordinator:** instructed using that existing branch for both pooled and
  direct URLs. `development` was a suggested name, not a required rename. The
  separate `heroku-demo` branch will be created before hosted wiring.
- **Scribe:** README/plan/current status now use the actual development target and
  do not assume a second branch already exists.
- **Disposition:** connection values, readiness, and disposable-target confirmation
  are still pending. No Neon call/write has occurred.


### Candidate 5 source handoff

- **Implementer:** each store allocation now gets a fresh writer UUID, including
  same-page adoption after a failed session action. Unread prior-pointer bytes are
  protected. This is the reported R12 correction; final independent/browser proof
  remains pending.
- **Durable legacy recovery:** **Preserved browser imports** lists at most 16 small
  summaries. **Export original source and recovery** returns persisted raw source
  and ambiguous records after local source removal, scoped by current authenticated
  namespace/persona/generation. The source hash is 64 hexadecimal characters;
  unavailable records use safe 404 responses and private/no-store caching. Export
  is capped at 9,001,024 bytes; it does not automatically re-import the data.
- **Implementer validation:** 92 unit/UI/pure tests and nine actual local Postgres
  tests pass; TypeScript passes; lint has zero errors and the inherited layout
  stylesheet warning; whitespace check passes. Source is frozen.
- **Limit:** candidate 5 is not production-built or independently approved. Its
  R12/export browser, CLI review, and required Neon evidence remain pending.

### User-requested pause — Neon setup only

- **User / coordinator:** requested a good stopping point, exclusive focus on Neon
  setup, then resuming the phase afterward. The coordinator directed all roles to
  preserve the current source and stop unrelated implementation/build/check work.
- **Checkpoint:** candidate 4 has the verified production artifacts; candidate 5
  has the reported source/tests above. These are separate candidates and must not
  be merged into a claim that candidate 5's production journeys passed.
- **Next:** finish account/project connection configuration for the existing `dev`
  branch without exposing credentials. Connection values/readiness/disposable
  confirmation and real Neon tests remain outstanding; no remote write occurred.
- **Disposition:** Phase 4 explicitly paused and unapproved. No criterion is waived,
  and Phase 5 remains gated. Scribe updates checkpoint documentation, then idles.


### Final pause correction — Optional export and exact remaining evidence

- **Reviewer:** corrected their earlier interpretation. Literal A6 requires
  validation/preview, provenance, retained original source until acknowledgement,
  conservative IDs/collisions, selected-namespace binding, and idempotence. It does
  not literally require a user-visible database export. Existing retained raw
  source meets preservation; the newly landed bounded export is optional, awaiting
  independent review and a scope decision when work resumes.
- **Reviewer:** accepts candidate 4's original R9 correction from the coordinator's
  exact planning/history workflow. No complementary navigation/palette/motion/
  capability or actual CLI checks started before the pause. Independent R12,
  candidate 5 production, CLI seed/reset/lost-response, and real Neon remain pending.
- **Coordinator:** archived `/tmp/ufd-phase4-browser/candidate5-source-only`, with
  137 files/checksums and `checkpoint.json`, explicitly no build. Stopped the
  candidate 4 app and local Postgres cleanly; test data remains on disk.
- **Disposition:** implementer/reviewer idle. Documentation checkpoint only, then
  scribe idles. Phase 4 remains paused/unapproved with original criteria intact;
  the optional export is not an added mandatory acceptance criterion.


### User resumed Phase 4 after completing Neon setup

- **User / coordinator:** “ready” resumes Phase 4 after the setup checkpoint. The
  user corrected the initial branch report: the project originally had only
  `production`, then they created `dev` for local development/testing. Pooled/direct
  URLs and the demo password are now in the private ignored local environment file.
- **Coordinator evidence already recorded:** both actual Neon connections use
  verified TLS and match endpoint/database/role. The read-only checks did not run
  migrations or mutate application records; the scribe did not inspect secrets.
- **Authorized next work:** coordinator prepares isolated development migrations,
  Neon integration, and production browsers. Reviewer resumes complementary probes,
  actual CLI checks, and R12 review; implementer handles confirmed corrections.
  No repeated service/setup questions or extra approval ceremony is required.
- **Scope:** optional database export remains an addition under review, not literal
  A6. A separate hosted branch is needed before hosted wiring, not before these
  authorized development checks. Historical phase journals remain untouched.
- **Disposition:** Phase 4 resumed and unapproved. Exact candidate/local-versus-Neon
  evidence must remain distinct, and Phase 5 still requires the user's checkpoint.


### Resumed R12 independent original-graph regression

- **Reviewer:** `/tmp/ufd-phase4-reviewer-buffer-allocation.mjs` passes, with exit
  0 and errors `[]` in
  `/tmp/ufd-phase4-reviewer-buffer-allocation-results.json`.
- **Before/after evidence:** the complete archived candidate 4 library graph
  reproduces reuse of the default writer key and deletion of unread original
  bytes on retry. Candidate 5's fresh writer retains those exact bytes.
- **Disposition:** R12 closes at the independent module/source-regression boundary.
  Final production/browser acceptance remains separate. Optional export's source
  boundary is coherent; runtime evidence is pending. Actual pooled Neon probes
  follow under the user's existing development-test authorization.


### First authorized Neon migrations and pooled SQL progress

- **Implementer relaying coordinator results:** actual Neon direct-connection
  migrations `001`–`005` and a repeated run pass on the authorized disposable `dev`
  target. This is real Neon migration evidence, separate from the earlier local
  runner checks.
- **Implementer:** the permanent nine-test SQL suite is running through the pooled
  development connection, using generated namespaces only. The first three groups
  pass: concurrent replay, atomic creation/rollback/reset, and generation/expiry.
  The complete suite has not yet finished; no full-suite pass is claimed.
- **Source boundary:** candidate 5's 137 checksums remain unchanged and source is
  frozen for the coordinator build. Optional export remains optional review scope,
  not a new A6 requirement.
- **Disposition:** authorized Neon mutation evidence has begun. Exact final suite/
  build/browser results and independent acceptance remain pending.


### Neon skills, actual preflight, and candidate 5 build

- **User / coordinator:** user installed/invoked Neon skills. The coordinator found
  and read the full [Neon skill](/home/omarchy/.agents/skills/neon/SKILL.md) and
  [Neon Postgres skill](/home/omarchy/.agents/skills/neon-postgres/SKILL.md), and
  announced their use. Pooled runtime, direct migrations, branch isolation, and
  schema-as-code guidance align with the approved design. Generic ORM/CLI
  onboarding recommendations do not replace the agreed `pg`/ordered-SQL path or
  restart completed user setup. No new installation/auth/provisioning occurred.
- **Coordinator:** actual Neon preflight reports Postgres `18.6`, with zero public
  tables before migration. Direct migrations `001`–`005` and repeat pass. This
  confirms the earlier relayed result on the authorized development target.
- **Coordinator:** candidate 5 production build passes. Archive/build-ID/runtime
  evidence will follow. The permanent pooled Neon SQL suite is still running;
  no whole-suite result is yet claimed.
- **Reviewer:** R12 original/current regression passes; optional export's source
  boundary is accepted, with runtime evidence pending. The optional addition is
  still not literal A6 or an acceptance waiver.
- **Disposition:** real Neon migration and current production compilation pass;
  final SQL/browser/CLI/independent evidence remains outstanding.


### First pooled Neon SQL suite — Test-observation correction

- **Implementer:** the first permanent Neon suite passes eight of nine tests. The
  failing concurrency test observed the pg client's proxy PID through PgBouncer,
  rather than the actual backend participating in the transaction. No application
  defect is inferred from that observation failure.
- **Coordinator-approved test correction:** select `pg_backend_pid()` inside the
  active transaction and retain the same advisory-lock waiting assertion. The
  original log is archived; the full nine-test rerun is underway.
- **Reviewer:** independently confirms the original R10 concurrency ordering passes
  on actual Neon when observing the real backend PID.
- **Source boundary:** this is a test-only correction; runtime source remains
  unchanged from the candidate 5 production build. The implementer also read the
  invoked Neon skills and retained the approved `pg`/SQL architecture.
- **Disposition:** the first suite is not a full pass. Full corrected permanent
  suite evidence remains pending; the test correction does not weaken the required
  concurrency behavior.


### Permanent pooled Neon SQL suite — Full corrected pass

- **Implementer:** the permanent suite now passes **9/9**, with zero skips,
  exit 0, and reported duration 72.2 seconds. Sanitized evidence is
  `/tmp/ufd-phase4-neon-sql-results.json`; the scribe read its nine named passing
  cases and cleanup/source-boundary fields. Generated namespaces were cleaned.
- **Actual Neon coverage:** repeatable seed/concurrent replay, atomic creation and
  rollback/reset, token expiry/revocation/generation, wrong-run relational rejection,
  exact legacy source/provenance/idempotence, import-versus-save serialization,
  optional export namespace/persona/generation/reset isolation, UTF-8 quota rollback,
  and transaction-local timeout/cancellation with pool reuse.
- **Correction boundary:** the initial 8/9 result remains preserved separately.
  Only `scripts/database.test.mjs` observation changed to use the actual backend
  PID inside its transaction. The actual advisory-wait assertion remains; targeted
  lint/whitespace checks pass. Runtime source is unchanged from candidate 5's build.
- **Disposition:** complete permanent pooled Neon SQL evidence passes. Production
  browsers, actual CLI, complementary independent review, and final approval remain
  separate pending checks.


### Candidate 5 actual Neon production archive and coordinator journeys

- **Coordinator:** current runtime is archived at
  `/tmp/ufd-phase4-neon/candidate5`, `BUILD_ID` `7DGiXxg-81-9PtS_a9xUl`, with
  137 source files/checksums. A scan of 63 client static files finds zero matches
  for configured secret values; no secret values are included in the evidence.
- **Designated passing results:** `api-boundaries-results.json` (eight groups),
  `import-and-durability-results.json` (seven), `planning-history-results.json`
  (four), and `buffer-and-session-results.json` (four), all with errors `[]`.
  The process restart is prepared, not yet verified.
- **Harness correction:** the initial Neon Sam journey read a committed run before
  the UI received acknowledgement. The original harness and
  `planning-history-before-ack-wait-results.json` are preserved. Waiting for the
  exact `assessment.rescan` HTTP 200 acknowledgement yields the full pass, including
  R9; no application change or weakened target/history assertion was needed.
- **Runtime boundary:** comparison since build shows only the database-test PID
  observation changed; runtime source is identical. Actual migration and preflight
  records are `/tmp/ufd-phase4-neon/migration-results.json` and
  `preflight-results.json`.

### Independent Neon services, complementary browsers, and actual CLI

- **Reviewer actual Neon probes:** under `/tmp/ufd-phase4-reviewer-neon`,
  `integration-results.json` passes seven groups; `session-edges-results.json`
  three; `import-edges-results.json` two; `import-race-results.json` one; and direct
  `migrations-results.json` two. These are independent real-Neon results, not local
  Postgres substitutes.
- **Reviewer candidate 5 production browsers:** under
  `/tmp/ufd-phase4-reviewer-browser`, `navigation-results.json` passes six,
  `capabilities-results.json` 23, `motion-results.json` three,
  `surface-context-results.json` five, and `import-export-results.json` three.
  All have errors `[]`; the final file also contains namespace bookkeeping, which
  is not another passing scenario.
- **Actual CLI:** `/tmp/ufd-phase4-reviewer-cli-results.json` passes three groups.
  The permanent atomic private-session-file unit test separately passes one test;
  it is not a full wrapper integration suite.
- **Optional export:** reviewer accepts its bounded scope with actual exact-source/
  recovery export after local clearing, owner/persona/generation isolation, rejection
  of a held stale reply after profile switching, and scoped reset. This accepted
  addition does not change literal A6. R6/R11 final coordinator evidence is accepted.
- **Disposition:** restart/final manifest, running independent Neon quota probe,
  final documentation review, and overall approval remain pending.

### Final README recovery/test attribution correction

- **Reviewer:** the older per-surface **Recovered legacy drafts** description was
  obsolete for active Phase 4 imports. Remote canvas preferences do not receive the
  server's imported recovery records; actual recovery is through **Preserved browser
  imports** → **Export original source and recovery**.
- **Scribe:** rewrote the old identity/import paragraphs around that tested path,
  closed obsolete optional-export/runtime-pending wording, and narrowed the CLI unit
  description to atomic private-file replacement. Actual CLI integration remains
  separately attributed to the three-group Neon artifact above.
- **Disposition:** documentation correction only; no feature/source change or
  overall approval claim.


### Final independent verification and runtime shutdown

- **Reviewer:** all 92 tests pass on Node 22, with zero skips, using
  `node --test scripts/{application,navigation,persistence,domain,onboarding,conversation,private-session-file}.test.mjs`.
  Whitespace check is clean. Actual pooled Neon quota passes three groups at
  `/tmp/ufd-phase4-reviewer-neon/quota-results.json`; cleanup of the four explicitly
  recorded CLI/export namespaces passes at `cleanup-cli-export-results.json` in
  the same directory. No reviewer process remains.
- **Coordinator:** actual Neon process restart now passes at
  `/tmp/ufd-phase4-neon/candidate5/process-restart-verified-results.json`. Saved
  content and the opaque session survive restarting the app and removing browser
  preferences. `final-root-verification.json` and `final-source-checksums.json` in
  the same archive reconcile 137 source entries: only test PID instrumentation
  changed after the production build, with identical runtime source.
- **Reviewer:** independently inspected/accepted the restart/root verification,
  archived API/browser results, 63-file zero-match secret scan, and source checksums.
  P4-A1–P4-A7 are satisfied with no unresolved in-phase technical finding. A8 awaits
  this final documentation read and the exact approval decision.
- **Diagnostics:** deliberate lost-response tests produced abort/ECONNRESET
  transport log pairs. Follow-up/retry checks passed, with no observed process
  crash or secret logs. The first automatic restart approval review timed out;
  the permitted retry succeeded. This was not an unsafe-action rejection or an
  outstanding block.
- **Coordinator:** stopped the final app/test server cleanly; local Postgres remains
  stopped. Test evidence/data remain preserved within their recorded scope. No
  deployment or Phase 5 work occurred.
- **Disposition:** all required technical work is complete. Current ledger and
  findings below are reconciled; historical pending/failure rows remain chronological
  records, not current blockers. Full approval is still pending the final A8 read.

## Current finding dispositions

All technical dispositions below are accepted by the independent reviewer. The
chronology preserves earlier observations, failed candidates, and corrected
interpretations; those are not outstanding work.

| Item | Final technical disposition |
| --- | --- |
| Neon configuration / portability | Authorized dev target, verified TLS/connection identity, one pg8/ordered-SQL path, and real direct/pooled integration pass. Hosted branch remains for future hosted wiring. |
| Domain/session/client/import design | Implemented and verified. Server namespace/persona/generation own durable commands; local preferences/pending recovery and typed per-tab destinations retain their distinct lifetimes. |
| Approved Phase 3 baseline | Copied and preserved; historical journals unchanged, baseline fixture captures retained, all current compatibility suites pass. |
| Workspace read consistency | REPEATABLE READ established before multi-query GET projection; reviewed transaction boundary and final Neon service/browser evidence pass. |
| P4-R1 — project/run foreign key | Composite relationship rejects a finding from another run; independent original probe and permanent actual-Neon SQL pass. |
| P4-R2 — legacy planning target | Same-source saved target retained; explicit captures preserved; original codec and actual import/browser flows pass. |
| P4-R3 — import revision/acknowledgement | Stale first import rejects; repeated source returns truthful persisted revision and preserves later edits. Actual Neon probes pass. |
| P4-R4 — populated reset | Corrected migration/constraint timing permits scoped reset and still rejects invalid relationships at COMMIT. Actual migration/SQL/CLI pass. |
| P4-R5 — request/config validation | Invalid preview rejects before mutation; actual UTF-8 streams bounded; validated server config/origin and safe errors pass. |
| P4-R6 — JSONB target comparison | Semantic equality preserves imported target values despite property order; final actual-Neon production flows accepted. |
| P4-R7 — contradictory imported history | Preview/commit reject conflicting same-ID/run copies; original source remains preserved. Independent and permanent Neon checks pass. |
| P4-R8 — discard/new-edit race | Discard applies to its captured command set; later edit remains pending/conflicted. Exact independent regression and final recovery evidence pass. |
| P4-R9 — second-project navigation | Next16.3.5 requested-search fix passes the original exact workflow; second project opens with prior status/history intact. Final motion/navigation/capability regressions pass. |
| P4-R10 — import/new-save race | Intervening import causes stale first save to conflict, preserving original content. Actual Neon concurrency waiting proof passes. |
| P4-R11 — stale recovery export | Latest memory and older disk versions remain separately recoverable with truthful flags; final recovery flows accepted. |
| P4-R12 — unread source deletion | Fresh writer per allocation and exact prior-source cleanup preserve unread bytes; archived-before/current regression and final independent92 pass. |
| Optional stored import export | Accepted bounded addition: exact source/recovery after local clearing, authenticated owner/persona/generation/reset scope, stale-response rejection. Literal A6 remains unchanged. |
| Quotas / unsaved recovery | Explicit no-eviction capacity/UTF-8 limits pass actual Neon quota3 and production recovery checks; Phase6 measured pagination remains planned. |
| Supported seed/reset CLI | Actual Neon CLI3 and lost-response replay pass; atomic private-file unit1 is separately attributed. No second SQL reset path. |
| Migration command truth | Optional .env.local loading, ordered checksum history, repeat/rollback behavior and truthful uncertain-outcome retry wording verified. |
| Dependency audit | Latest production-only audit has one moderate baseline-browser-mapping finding, zero high/critical. Full install summary includes dev findings; Phase7 release remediation/re-audit remains, without a clean-audit claim. |
| Final status | P4-A1–P4-A8 approved by the independent reviewer. No unresolved in-phase work; Phase 5 awaits the user checkpoint. |

## Validation evidence

This table is chronological. Failed or pending-at-the-time rows preserve the
review history; the current ledger and final rows identify the accepted result.

| Stage | Evidence | Result and limit |
| --- | --- | --- |
| Phase 3 handoff | Historical approved phase evidence | 75 tests, Node 22 type/lint/build, final/retained browser families and recorded limits. Baseline history only; not Phase 4 validation. |
| Phase 4 baseline/configuration check | Coordinator initial inspection | Existing Neon helper unused; no connection configuration found; psql/Docker available. Baseline copy/checks pending. No real database test claimed. |
| Supplemental local database | Coordinator reports isolated Postgres `18.4` under `/tmp`, using temporary native binary package | Database available for local integration; Docker OS access unavailable. No repository/system dependency added; does not satisfy real Neon validation. |
| Reviewer supplemental connectivity | Node 22; separate local `phase4_review` database, Postgres `18.4` | Connection succeeds after authorized loopback access. Environment check only; no migrations/application/Neon verification and no credentials printed. |
| Coordinator baseline import-fixture capture | Approved Phase 3 production UI/build ID; `/tmp/ufd-phase4-browser/legacy-sam.mjs`, `legacy-alex.mjs` | Capture results pass/page errors `[]`: Sam two projects/three runs/status, Alex three scoped Apex drafts/closed Query. Baseline server stopped. Generated import inputs only; no Phase 4 import success claimed. |
| Reviewer initial schema reproduction | Local `phase4_review`; `/tmp/ufd-phase4-reviewer-schema-probe.mjs` with captured initial SQL | P4-R1 reproduced: wrong-run insertion accepted. Probe fully rolled back; SQL-level failure evidence only. Corrected schema and real Neon tests pending. |
| Reviewer P4-R1 original-probe retest | Same isolated local probe/database; ordered migrations 001+002 | Wrong-run insertion rejected, SQLSTATE 23503; full rollback. Constraint fix verified locally; migration runner/application/Neon acceptance not implied. |
| Reviewer legacy-target codec reproduction | Node 22 `testModules`; generated Sam fixture with only canvas target metadata removed | Both uncaptured planning canvases derive null instead of their same-source saved SIT target. Reproduced codec failure; correction/import integration pending. |
| Reviewer P4-R2 original-codec retest | Same actual codec; original and explicit-capture/missing-plan cases | Saved SIT equals imported SIT for both plans; explicit capture and missing-plan recovery cases pass. Codec correction only, not full import/Neon approval. |
| Reviewer ordered migration apply/repeat | Actual migrations 001–003 on isolated local reviewer database | Apply/repeat pass. Supplemental Postgres evidence; real Neon still required. |
| Reviewer workspace read correction | Source inspection of GET transaction setup | REPEATABLE READ begins before queries; runtime concurrent-reader evidence not yet reported. |
| Reviewer P4-R3 service/SQL reproduction | `/tmp/ufd-phase4-reviewer-import-probe.mjs`; fresh isolated local namespaces, cleaned afterward | Stale revision 999 accepted against 0; repeated-source response says 2 while database remains 1. Changes requested; no browser/Neon claim. |
| Reviewer integration probe / P4-R4 | `/tmp/ufd-phase4-reviewer-integration.mjs`; isolated reviewer database | Overall exit 1: populated workspace deletion fails FK 23503. Six earlier scenario records pass (duplicate commands, atomic/revision behavior, rollback, ownership isolation, timeouts/cancellation and pool reuse); not an integration-suite pass. |
| Reviewer attempted migration 004 | Actual migration runner, isolated reviewer database | Exit 1: nonexistent generated constraint name. R4 still open; truthful outcome/rerun error wording observed. Earlier 001–003 success does not cover 004. |
| Coordinator production dependency audit | `npm audit --omit=dev --json`; `/tmp/ufd-phase4-production-audit.json` | Five findings: critical 1, high 3, moderate 1. Bounded optimizer mitigation pending; remaining remediation/re-audit explicitly retained for release readiness. |
| Coordinator local browser database preparation | Node 22.23.2; `node --env-file=/tmp/ufd-phase4-postgres/browser.env scripts/database.mjs migrate`; isolated PG 18.4 `phase4_browser` | Corrected 001–004 apply, exit 0. API/import browser scripts pass syntax checks only; runtime suites and Neon remain pending. |
| Reviewer P4-R3 original import retest | `/tmp/ufd-phase4-reviewer-import-probe.mjs`; isolated local namespaces | Stale revision rejected as conflict; repeated source acknowledges 1, matching database 1. No browser/Neon claim. |
| Reviewer expanded integration / P4-R4 corrected retest | `/tmp/ufd-phase4-reviewer-integration.mjs`; `/tmp/ufd-phase4-reviewer-integration-results.json`; corrected 004 | Exit 0, seven scenario records/errors []. Populated reset/isolation, eight duplicate commands/five duplicate creates, rollback/receipts, status/generation/persona, actual 57014 timeout and pool reuse pass. Synthetic namespaces cleaned; local PG only. |
| Coordinator candidate 1 build / HTTP | `/tmp/ufd-phase4-browser/candidate1` source/checksums/BUILD_ID; `api-boundaries-results.json` | Production build and eight HTTP records pass; preview 400 and disabled image optimizer 404 included. Local PG runtime only. |
| Coordinator candidate 1 browser import/durability | Same archive; `import-and-durability-failed-results.json` | Whole suite exit 1/errors []: four-draft preview/import/source retention pass before imported CRM target falsely unavailable due JSONB property order. Product assertion failure; corrected candidate pending. |
| Coordinator candidate 2 build / draft import and durability | `/tmp/ufd-phase4-browser/candidate2/import-and-durability-results.json` (archived candidate 2 result) | Build and full seven-record browser suite pass/errors [], exit 0: imported target/content, source retention, closed draft, DB reload/preferences clear, unknown-COMMIT same-ID retry, unsent reload, two-tab scopes. Sam history/old generation/opener/quotas/Neon not covered. |
| Reviewer P4-R5 boundary probe | `/tmp/ufd-phase4-reviewer-http-probe.mjs`; `/tmp/ufd-phase4-reviewer-http-results.json` | Two groups pass: configuration/origin, streamed UTF-8 byte bound/cancellation/safe errors. Root HTTP separately covers preview rejection. |
| Reviewer P4-R7 import edges | `/tmp/ufd-phase4-reviewer-import-edges.mjs`; `/tmp/ufd-phase4-reviewer-import-edges-before-results.json`; incremental 005 applied | Contradictory same-ID/run historical copies accepted by preview/COMMIT: reproduced defect. Separate repeat-after-status-edit, collision rollback, exact source-retention group passes. Local PG only. |
| Reviewer P4-R8 client recovery edge | `/tmp/ufd-phase4-reviewer-client-edges.mjs`; `/tmp/ufd-phase4-reviewer-client-edges-before-results.json` | Discard/read race loses a post-click edit, pending count 0, and falsely reports saved. Confirmed module-level client defect; corrected regression pending. |
| Reviewer session/epoch/deferred-FK edges | `/tmp/ufd-phase4-reviewer-session-edges.mjs`; `/tmp/ufd-phase4-reviewer-session-edges-results.json` | Three groups pass: expiry/revocation/replacement namespace; persona/reset/lost-response epoch integrity; deferred FK rejection at COMMIT with rollback. Local service/SQL evidence only. |
| Coordinator planning/history browser / provisional R9 | `/tmp/ufd-phase4-browser/candidate2/planning-history-failed-results.json` | Full journey fails: second project/tab persisted but first stays active for 30s. First creation/SIT/status retry/reload/immutable history assertions passed. Cause under diagnosis; no race claim yet. |
| Reviewer P4-R10 concurrent import/save | `/tmp/ufd-phase4-reviewer-import-race.mjs`; `/tmp/ufd-phase4-reviewer-import-race-before-results.json` | Stale absent-row save resumes after import and overwrites imported revision-1 fields while acknowledging success. Confirmed local concurrency defect; corrected revalidation/insert regression pending. |
| Reviewer P4-R11 recovery/export | `/tmp/ufd-phase4-reviewer-recovery-probe.mjs`; `/tmp/ufd-phase4-reviewer-recovery-before-results.json` | After quota failure, older disk entry replaces newer memory recovery and export omits the later edit while claiming buffered. Confirmed recovery defect; fix/retest pending. |
| Reviewer candidate 3 R7/R8/R10 original-probe retests | `/tmp/ufd-phase4-reviewer-import-edges-results.json`, `import-race-results.json`, `client-edges-results.json` (same reviewer prefix) | Three Node 22 scripts exit 0: contradictory import rejected, concurrent save conflicts/original revision 1 retained, post-discard newer edit remains pending/conflicted. Original failures archived as corresponding `-before-results.json`. |
| Reviewer capacity/byte bounds | `/tmp/ufd-phase4-reviewer-quota-probe.mjs`; `/tmp/ufd-phase4-reviewer-quota-results.json` | Three groups pass: real 63+two concurrent saves caps at 64, existing edit at cap, exact 65,536 UTF-8 fields bytes/oversize rollback, 17th source rejected, pure record/provenance bounds. Local PG and bound calculation only; no benchmark/Neon claim. |
| Reviewer full migration runner | `/tmp/ufd-phase4-reviewer-migrations-probe.mjs`; `/tmp/ufd-phase4-reviewer-migrations-results.json` | Two groups pass: fresh 001–005/repeat/checksum refusal, copied failing sixth migration fully rolls back DDL/history with safe message. Isolated schemas/temp copies cleaned; local PG18.4 only. |
| Reviewer P4-R11 core corrected export | `/tmp/ufd-phase4-reviewer-recovery-results.json`; original `recovery-before-results.json` with same reviewer prefix | Latest two-command memory and older one-command disk versions both export separately with accurate flags. Core pass; malformed restore-source discard UX and final browser recovery remain pending. |
| Coordinator candidate 4 production dependency audit | `npm audit --omit=dev --json`; `/tmp/ufd-phase4-production-audit-candidate4.json` | One moderate baseline-browser-mapping finding, zero high/critical. Four-advisory install report includes dev dependencies; Phase7 release remediation/re-audit remains. |
| Implementer candidate 4 source-freeze checks | 91 unit/UI/pure tests; eight actual local SQL tests; TypeScript/lint/diff; focused CLI rerun | Reported pass; lint retains one inherited layout stylesheet warning. Focused CLI rerun is not a new distinct test count. Exact final independent/build/browser/CLI/Neon evidence pending. |
| Coordinator candidate 4 production integration | `/tmp/ufd-phase4-browser/candidate4`; BUILD_ID `zG62muTnFs6baGFWzLIh-`; 135 source checksums | Build and five designated result families pass: API 8, planning/history 4, import/durability 7, buffers/session 4, actual process restart 1; browser errors []. Original R9 passes. R12/durable export/final independent/Neon pending. |
| Implementer candidate 5 pause checkpoint | `/tmp/ufd-phase4-browser/candidate5-source-only`: 137 files/checksums, checkpoint.json, no build; 92 unit/UI/pure and nine SQL tests reported | Type/lint/diff reported passing with inherited warning. No production build/independent approval. R12, complementary browsers, actual CLI and Neon pending; added export scope/review optional. |
| Coordinator guided Neon setup | Node 22, installed pg client, user-configured pooled/direct URLs; BEGIN READ ONLY, SELECT 1, ROLLBACK on each | Both connect successfully with encryption and verified certificates. URL endpoint/database/role match; password present; env file private and ignored. No secret output, migrations, or data mutations. This proves connectivity only; implementation remains paused and Phase 4 unapproved. |
| Reviewer resumed R12 allocation regression | `/tmp/ufd-phase4-reviewer-buffer-allocation.mjs`; `/tmp/ufd-phase4-reviewer-buffer-allocation-results.json` | Exit 0/errors []: complete candidate4 graph reproduces unread-source deletion; candidate5 fresh writer preserves exact bytes. Module/source regression only, not final production acceptance. |
| Resumed real Neon migration/SQL progress | Coordinator direct dev connection; implementer permanent SQL suite via pooled dev, generated namespaces only | Migrations001–005/repeat reported pass. First three SQL groups pass, suite still running; no complete SQL/build/browser acceptance claimed. Source137-checksum boundary unchanged. |
| Coordinator actual Neon preflight/current build | Neon PG18.6, zero public tables before direct001–005; candidate5 build report | Migrations/repeat and candidate5 production build pass. Build archive/runtime and full pooledSQL/browser/CLI results pending; no final acceptance. |
| Implementer first pooled Neon permanent suite | Actual pooled dev connection; original log archived, exact path pending | Eight of nine pass; concurrency observation used proxy PID. Test-only correction now reads pg_backend_pid() in active transaction with unchanged waiting assertion; full rerun pending. Runtime unchanged. |
| Implementer permanent pooled Neon SQL rerun | `/tmp/ufd-phase4-neon-sql-results.json`; authorized pooled dev; current permanent suite | 9/9 pass, zero skips, exit0; generated namespaces cleaned. Seed/replay/create/rollback/reset/auth/FK/import/concurrency/export-scope/UTF8/timeout coverage. Only test PID observation changed; runtime matches candidate5 build. |
| Coordinator candidate5 actual-Neon runtime | `/tmp/ufd-phase4-neon/candidate5`, BUILD_ID `7DGiXxg-81-9PtS_a9xUl`;137 source entries | API8/import7/planning4/buffer4 pass/errors [];63 client files have zero configured-secret matches. Before-ACK harness failure preserved; exact ACK wait corrected. Runtime unchanged except test PID observation outside runtime. Restart prepared only. |
| Reviewer independent actual-Neon service probes | `/tmp/ufd-phase4-reviewer-neon/{integration,session-edges,import-edges,import-race,migrations}-results.json` | Groups7/3/2/1/2 pass respectively; migrations use direct connection. Independent actual-Neon evidence. |
| Reviewer actual-Neon complementary production browsers | `/tmp/ufd-phase4-reviewer-browser/{navigation,capabilities,motion,surface-context,import-export}-results.json` | Groups6/23/3/5/3 pass respectively/errors [];import-export extra namespace bookkeeping is not a test group. Optional bounded export accepted. |
| Reviewer actual CLI and separate permanent unit | `/tmp/ufd-phase4-reviewer-cli-results.json`; atomic private-file permanent test | Three real-Neon CLI groups pass; one atomic-file unit passes separately. No full-wrapper integration claim from unit alone. |
| Reviewer final independent suites / Neon quota | Node22 test command above; `/tmp/ufd-phase4-reviewer-neon/quota-results.json` and `cleanup-cli-export-results.json` | Independent92 pass/zero skips; actual pooled quota3 pass; four recorded CLI/export namespaces cleaned. No reviewer processes remain. |
| Final candidate5 restart / source reconciliation | `/tmp/ufd-phase4-neon/candidate5/{process-restart-verified-results,final-root-verification,final-source-checksums}.json` | Actual Neon restart/session/content retention passes.137 entries reconciled, sole postbuild difference is test PID instrumentation; runtime identical. Reviewer independently accepts artifacts. App/test server stopped. |

## Remaining work and handoff

Phase 4 is approved with no required work remaining. Await the user's Phase 5
checkpoint before beginning that phase. No deployment has occurred; release audit,
pagination, and real-provider work keep their already agreed later-phase owners.

## Approval and user checkpoint

**Independent reviewer / approver:** `phase3_reviewer` (Phase 4 role).

> APPROVED — 100% of Phase 4 acceptance criteria P4-A1 through P4-A8 satisfied.

The final documentation read, exact Neon/production evidence, all twelve finding
resolutions, unchanged acceptance criteria, and Phase 5 user gate were accepted.

**User checkpoint:** Phase 4 is approved. Phase 5 remains gated until the user
authorizes the next phase.
