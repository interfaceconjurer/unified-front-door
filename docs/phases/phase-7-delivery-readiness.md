# Phase 7 — Delivery and operational readiness

**Started:** September 16, 2026  
**Status:** Approved — awaiting the user’s Phase 8 checkpoint  
**Approved:** September 16, 2026  
**Authorization:** The user replied “phase7 time” after independent Phase 6 approval.  
**Baseline:** Approved Phase 6 working tree, build `vOQRs6yqFvz3Jt_Sp2pHs`, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md#phase-7--delivery-and-operational-readiness)  
**Findings:** F8 and cross-phase verification of F1–F10 in the [architecture review](../architecture-review.md)

## Current synthesis

- The unchanged corrected candidate passed all **14 release-gate stages** on
  Node 22.23.2: **166 tests**, **29 browser regression groups**, two **4-check
  live-Neon journeys**, **3 worker recovery checks**, and **15 performance
  samples**. Build `c8qB1_jslOkD9xnNaT7N1`; completion
  `2026-09-16T21:32:39.539Z`. Reviewer `phase7_reviewer` has independently
  approved all P7-A1–P7-A8; R1–R5 are closed with no waived requirement.
- Keep both unsuccessful full-gate attempts visible: candidate 1 exposed and led
  to correction of the checked-out-client lifetime/error defect R5; candidate 2's
  first run failed a transaction deadline followed by physical connection
  acquisition timeouts of unconfirmed cause. Its same-source retry passed without
  relaxing deadlines, waits, or assertions. Intentional negative verification
  independently proves failure produces no release manifest/archive.
- The clean exact-SHA gate ran in a disposable fixture at
  `fcdb8db8464f7530cdf74179b43ea8644005110d`; it did not commit the user's dirty
  branch or authorize deployment. Runtime/tool source matches the working tree;
  later documentation/evidence-only changes are reconciled separately. The
  [permanent verification artifact](phase-7-verification.json) preserves source
  hashes, attempt attribution, counts, cleanup, and limitations.
- Full and production dependency audits report zero advisories. Four owned
  namespace journals are empty, no fixture processes remain, all 13 historical
  artifacts match, and the user's HEAD is unchanged. Coordinator's final
  private-value scan includes the durable artifact: 269 source/evidence file
  entries checked against six private values, with zero matching files.
- Production output contains **11** Next-labeled aborted/ECONNRESET uncaught-error
  blocks of unconfirmed origin, plus two caught/redacted agent-read 503s that
  recover. No Postgres fatal marker is observed in the successful run. Do not
  describe these logs as clean or infer a harmless/client-cancellation cause.
- Hosted runtime remains unverified. Read-only inventory found missing hosted
  database/origin/worker and GitHub smoke/protection setup; no deployment,
  provisioning, remote workflow dispatch, or real-provider integration occurred.
  Phase 8 remains gated on a separate user checkpoint.

## Roles and baseline

- **Implementer:** `phase7_implementer`, application, automation, and tests.
- **Reviewer / approver:** `phase7_reviewer`, independent inspection, evidence,
  finding dispositions, and final acceptance.
- **Scribe:** the reused `phase6_implementer` thread, now documentation-only for
  Phase 7. Its previous implementation role is complete; it owns this journal,
  current plan, and README, and does not approve Phase 7 code.
- **Coordinator:** primary agent, scope ratification, baseline capture, test
  coordination, and the user's phase checkpoint.

The coordinator owns the complete source baseline. The scribe separately recorded
13 historical journal/measurement/migration hashes before editing documentation
at `/tmp/ufd-phase7-scribe/historical.sha256`. New implementation must preserve
these artifacts and existing dirty work. No agent approves its own changes.

## Acceptance ledger

The independent reviewer has accepted P7-A1–P7-A8 against the final source and
evidence. Earlier chronology entries retain their original pending states; the
ledger below is the final disposition.

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P7-A1 | Inspect current full and production dependency audits, remediate applicable findings, and repeat the audit with exact scope and remaining limitations. | Accepted: current full/production audits fall from 26/2 to 0/0; final locked-install gate passes. |
| P7-A2 | One locked-install Node 22 gate verifies the exact release revision across all suites, lint, types, production build, and production browsers; automated and manual release paths use it, and an intentional failure demonstrably blocks deployment. | Accepted: actual negative verifier blocks artifacts; final exact-SHA gate and artifact/source proof pass with one auto/manual path. |
| P7-A3 | Preserve fail-closed authentication; expose only minimal protected database/schema readiness and verify healthy plus missing/invalid-configuration runtime smoke cases. | Accepted: independent readiness/transaction protocol regressions and positive/negative production smoke pass; R1/R5 closed. |
| P7-A4 | Migrations/releases have bounded execution, explicit ordering, backup assumptions, failed-release handling, and rollback compatibility supported by meaningful tests. | Accepted: migration orchestration 4, six live migrations/status, bounded failures and explicit backup/rollback limits. |
| P7-A5 | Structured request/run diagnostics provide useful correlation using allowlisted fields and tested redaction; secrets and arbitrary submitted content are excluded. | Accepted: diagnostic/redaction and final runtime evidence pass; 11 unattributed Next disconnect blocks and two recovered 503s remain explicit limitations. |
| P7-A6 | Repeated isolated Neon, worker, and production-browser journeys verify preserved cross-phase behavior, including failure/cancellation/recovery and cleanup. | Accepted: 166 tests, 29 browser groups, 2 × 4 Neon checks, 3 worker checks, 15 samples; four empty owned journals and no fixture processes. |
| P7-A7 | Local and Heroku runbooks describe actual commands, environment separation, release/recovery steps, and verified limits; hosted status remains explicitly unverified without authorization and evidence. | Accepted: final runbook/documentation read complete; hosted setup/protection gaps and unverified deployment/restore remain explicit. |
| P7-A8 | Plan/README/journal record all decisions, findings, exact evidence and limitations; historical artifacts remain intact and the independent reviewer explicitly approves every in-phase criterion. | Accepted: final docs/artifact clarification, hash consistency, privacy/cleanup and exact independent approval recorded; no unresolved in-phase findings. |

“100%” means all agreed phase criteria have accepted evidence with no unresolved
in-phase finding. It does not promise unlimited scale or freedom from every
possible defect. Required checks and findings cannot be silently deferred to
obtain approval.

## Finding ledger

| Finding | Required correction | Current disposition |
| --- | --- | --- |
| P7-R1 — Readiness network liveness | Bound the connected query lifetime and destroy uncertain/error connections. | Closed — independent source/probe and final full-gate evidence accepted. |
| P7-R2 — Gate test conditions | Separate server-only tests from suites requiring browser/SSR React conditions. | Closed — separated server/SSR suites and final 144 pure tests independently accepted. |
| P7-R3 — Database target pairing | Require runtime and direct migration URLs to identify the same endpoint/database. | Closed — shared target/public-schema/standalone guards and final gate independently accepted. |
| P7-R4 — Exact Node patch contract | Align package/lock/startup with `.nvmrc` and gate 22.23.2. | Closed — exact 22.23.2 contract and final gate independently accepted. |
| P7-R5 — Runtime database transport lifetime | Bound generic transactions and contain connected-client failures without unsafe automatic retry. | Closed — original/handoff reproductions, fixes, lasting tests and final same-source gate independently accepted; earlier failures retained. |

## Design and review chronology

### Round 0 — Authorization and scope

- **User:** “phase7 time,” following independent Phase 6 approval.
- **Coordinator:** assigned a fresh implementer and independent reviewer. Reused
  the previous implementation thread solely as scribe because the workspace
  agent-thread limit prevents another allocation. Confirmed documentation/code
  ownership and historical immutability.
- **Reviewer:** agreed P7-A1–P7-A8 with the coordinator and implementer. Preventive
  design cautions: do not log arbitrary raw client request IDs; test environment
  overrides must pair pooled and direct database URLs consistently; whitespace
  authentication configuration must fail closed; database readiness must detect
  schema drift.
- **Coordinator:** existing automatic and manual deploy entry points must use the
  gate or be safely replaced; an old bypass cannot remain while claiming gated
  releases.
- **Scribe:** created this journal and updated current plan status. README changes
  will follow implemented behavior and evidence.
- **Disposition:** no numbered implementation finding yet. All acceptance checks
  remain pending; no deployment, provisioning, commit, or Phase 8 work authorized.

### Round 1 — Release gate and runtime design

- **Implementer:** proposed one Node 22 runner using locked dependencies and a
  clean exact commit. The existing push-to-main and manual-dispatch deployment
  paths depend on a verified source artifact and the Heroku environment. Required
  approval protections must be configured separately; later inspection found
  none currently set (Round 9).
  Local working-tree validation is explicitly nonreleasable. Root ratified this
  direction; no remote deployment is being executed in this phase.
- **Ownership:** coordinator temporarily owns dependency remediation and may own
  deployment-script changes; implementer owns runtime and verification-gate
  source. Implementation waits for coordinator baseline capture.
- **Runtime design:** preflight required configuration for web and worker;
  protected read-only readiness checks migration checksums and probes required
  columns; serialized atomic migration execution has explicit bounds;
  request/run diagnostics use allowlisted JSON fields.
- **Reviewer/implementer agreement:** readiness conservatively rejects unknown or
  newer migration history. Rolling back to an older slug requires explicit
  compatible-schema/readiness proof; prefer a forward fix and provide no
  automatic down migrations. Known-column probes with `LIMIT 0` plus migration
  checksums detect practical drift, but do not prove every schema semantic.
- **Timeout interpretation:** migration and status paths need connection/query
  timeouts plus an outer wall-clock deadline. A timeout can leave transaction
  outcome uncertain; reconcile by checking status before any retry, rather than
  assuming rollback or replaying effects automatically.
- **Disposition:** preventive design agreement, not a passing implementation
  review. No numbered finding or accepted runtime evidence yet.

### Round 2 — Preliminary diagnostic inspection

- **Independent reviewer:** four grouped diagnostic probes passed with exit 0:
  concurrent request contexts remain isolated; generated response IDs correlate
  with errors; synthetic secret bytes in error/command/run inputs are excluded;
  emitted statuses and outcomes follow allowlists. Artifact:
  `/tmp/ufd-phase7-reviewer/diagnostics-first-slice.json`.
- **Preventive follow-up:** reviewer asked the implementer to include
  `session_changed` in the allowed outcomes and wrap import-source operations in
  request context. These complete the initial diagnostic slice; no numbered
  final-candidate finding has been assigned.
- **Disposition:** preliminary checks against evolving source. P7-A5 and final
  source reconciliation remain pending; this is not phase approval.

### Round 3 — Concrete operational interfaces

- **Implementer:** specified production web/worker preflight for Node 22,
  authentication, origin, and database configuration; worker startup also checks
  schema readiness. Command wiring and final runtime evidence remain pending.
- **Readiness:** private Basic Auth `GET /api/ready` returns only
  `200 {"ready":true}` or `503 {"ready":false}`, with generated `X-Request-ID`
  and `Cache-Control: no-store`. Its own read-only connection checks exact
  migration history and required-column probes, with a 10 s probe bound and
  separate 5 s pool connection timeout; failed/timed-out connections are
  destroyed. This does not expose schema details or claim exhaustive drift
  detection.
- **Database commands:** `db:migrate` uses one transaction/advisory lock, 5 s lock
  and 30 s statement limits, and a 120 s process deadline. New `db:status` checks
  exact history read-only with a 20 s process deadline. Remote targets require
  direct `DATABASE_URL_UNPOOLED`; local Postgres retains runtime-URL fallback.
  The gate uses separate `DATABASE_TEST_URL` and direct
  `DATABASE_TEST_URL_UNPOOLED`, overriding both runtime URLs consistently.
- **Scribe source check:** migration/status source and readiness route are
  present; package-script wiring is still in progress. Runbooks will describe the
  completed interface after source reconciliation.
- **Official operational constraints:** Heroku can report a successful build
  while its release fails. A failed config-var-triggered release leaves the
  changed config value in place. App rollback restores the slug/configuration,
  not external database state. These distinctions must remain explicit in the
  runbook and release verification. Sources:
  [Heroku release phase](https://devcenter.heroku.com/articles/release-phase),
  [Heroku releases](https://devcenter.heroku.com/articles/releases).
- **Disposition:** implementation/design record only; P7-A2–P7-A4 remain pending
  independent final runtime and failure evidence.

### Round 4 — Current dependency remediation and read-only hosted inventory

- **Coordinator:** current initial audit reported 26 full-install advisories
  (24 high, 2 moderate) and 2 production advisories (both moderate). These are
  current results, separate from prior phases' historical npm summaries.
- **Remediation:** targeted transitive lockfile updates include
  `baseline-browser-mapping` 2.10.38 → 2.11.24, `brace-expansion` 1.1.15 → 1.1.21
  and 5.0.6 → 5.0.12, `browserslist` 4.28.4 → 4.29.0, and `js-yaml` 4.2 → 4.3.2,
  plus related metadata dependencies. No major application package version
  change or override was introduced.
- **Result:** coordinator's repeated full and production audits both report
  **zero advisories**. Raw JSON evidence is in
  `/tmp/ufd-phase7-audit/{full,production,full-after,production-after}.json`.
  Independent final review and release-gate reconciliation remain pending.
- **Read-only hosted inventory:** existing app `unified-front-door` is on
  `heroku-24` in region `us`, current release `v11`, with `web.1` Basic running
  and no worker. Safe configuration inspection is pending. This describes the
  existing deployment; it is not a Phase 7 deployment or hosted readiness result.
- **Disposition:** no unresolved advisory is reported by these two current
  audits; P7-A1 is awaiting reviewer acceptance and final gate evidence. Hosted
  changes remain outside this phase's authorization.

### Round 5 — P7-R1: readiness deadline under a database blackhole

- **Independent reviewer — CHANGES REQUESTED:** original `assertReadiness`
  delegated to the generic transaction path. Pool acquisition had a 5 s timeout
  and SQL a server-side 10 s statement timeout, but a connected socket that
  stopped responding could hold the request/pool client indefinitely. A
  server-side statement timeout cannot resolve that network blackhole.
- **Correction:** dedicated `probeDatabaseSchema` owns its client and races a
  10 s deadline. Deadline/error releases use `release(true)` to destroy the
  connection; the pool receives a reusable client only after confirmed `COMMIT`.
  Pool acquisition retains its separate 5 s bound. The implementer landed the
  correction before the independent probe compiled.
- **Executed evidence:** an actual local fake-Postgres server completed one
  handshake and accepted one query, then stopped responding. The real
  `assertReadiness` rejected after 10,526 ms, destroyed its owned connection,
  and cleaned up with process exit 0. Artifact:
  `/tmp/ufd-phase7-reviewer/readiness-blackhole-fixed.json`.
- **Disposition:** reviewer accepts the source correction and fixed probe;
  observed evidence covers corrected source only, with no pre-fix executed
  reproduction claim. P7-R1's final freeze/test reconciliation and overall
  P7-A3 acceptance remain pending.

### Round 6 — P7-R2: release-gate test environment compatibility

- **Independent reviewer — CHANGES REQUESTED:** the initial pure-test gate ran
  every suite with `--conditions=react-server`, but `persistence.test.mjs`
  imports `react-dom/server`. An independent direct import under that flag exits
  1 with `react-dom/server is not supported in React Server Components.` The
  gate must separate server-only suites from browser/SSR suites, preserving the
  existing cross-phase test environment requirements.
- **Preventive runtime follow-up:** checking only the startup wrapper's negative
  exit is insufficient for missing-auth HTTP behavior. Reviewer requested the
  actual raw Next/proxy response with missing configuration to return 503.
- **Disposition:** coordinator assigned P7-R2; implementer response and
  independent closure are pending. This is an in-phase
  gate correction, not a reason to drop retained tests.

### Round 7 — Safe hosted configuration inventory and gate wiring

- **Coordinator:** read-only Heroku configuration inspection completed without
  printing or changing credentials. Existing release `v11` has
  `BASIC_AUTH_PASSWORD` present; `BASIC_AUTH_USER` is absent, so the guest default
  applies. `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `APP_ORIGIN` are absent.
  The existing formation has only the running Basic web dyno and no worker.
- **Hosted disposition:** these settings are insufficient for the new runtime.
  A future authorized first release requires a separate `heroku-demo` database,
  its two runtime connection variables, the hosted origin, a matching GitHub
  smoke credential, and worker activation after the first compatible slug.
  No values, remote mutations, deployment, or workflow dispatch occurred.
- **Automation:** coordinator wrote gated main-push/manual release and
  pull-request verification paths. Implementation and independent verification
  remain in progress; merely writing a workflow is not a passing release gate.

### Round 8 — P7-R3: pooled and direct URLs must address one target

- **Independent reviewer — CHANGES REQUESTED:** `deployHeroku` validated each
  Postgres URL's syntax and the direct URL's non-pooler requirement separately,
  but did not prove both URLs identify the same target. Runtime could use branch
  or database A while the release migrated B. If both schemas were current,
  readiness alone could pass and leave this environment mismatch hidden.
- **Required correction:** compare canonical endpoint, database name, and
  compatible port using a shared helper; remove only Neon's exact pooler marker
  for endpoint matching. Migration/runtime roles and passwords may intentionally
  differ, so secret equality is not required and values must not be logged.
- **Ownership/disposition:** implementer owns the shared helper and coordinator
  integrates it into deployment validation. No original or fixed execution
  evidence has yet been reported. P7-R3 remains open.

### Round 9 — Independent automation slice and final runbook preparation

- **Independent reviewer:** deployment first slice passed 8/8 with exit 0 in
  `/tmp/ufd-phase7-reviewer/deployment-first-slice.log`. Workflow inspection
  confirms exact event-SHA checkout, verification dependency, this run's source
  artifact, the same gate for main automatic/manual releases, and no deployment
  for pull requests or non-main dispatches. Audit JSON independently confirms
  26 full / 2 production advisories before and 0 / 0 after remediation.
- **Preventive corrections:** reviewer requested the package Node engine match
  `.nvmrc`/runner 22.23.2 and process recovery use the compiled worker artifact.
  Package inspection now confirms the exact Node engine pin; final full-gate
  evidence remains pending.
- **Later independent slice:** operations 7 plus deployment 9 passed **16/16**,
  exit 0 in 30.46 s. Artifact:
  `/tmp/ufd-phase7-reviewer/operations-deployment-candidate1.log`.
- **R3 progress:** the shared helper now restricts Neon pooler normalization and
  has endpoint/port/database/pooler/role/routing-override coverage. R3 remains
  open: standalone test entry points replace the runtime database URL but retain
  an inherited main direct URL. They must use the test direct URL or clear the
  inherited direct value. The full gate's overrides mask this standalone path;
  a passing gate would not replace the fix.
- **Coordinator read-only GitHub inspection:** the `heroku` environment has
  `HEROKU_API_KEY`, lacks `HEROKU_BASIC_AUTH_PASSWORD`, and currently has neither
  required reviewers nor a deployment branch policy. The runbook must not call
  this environment protected or approved. These settings were not changed.
- **Settled interfaces:** `verify:release -- --working-tree` is nonreleasable;
  `--revision FULL_SHA` requires a clean exact snapshot. Added commands include
  `db:status`, `test:runtime`, and `test:worker-recovery`. Deployment request
  limits are 30 s, polling is 120 × 5 s, and the script deadline is 15 minutes;
  matching current web/worker dynos and private readiness/page/static smoke are
  required. Worker activation remains an explicit operator action after the
  first compatible slug; the script does not change formation or billing.
- **Scribe:** prepared the full operational README, including locked local
  startup, paired test/runtime targets, exact-revision versus working-tree
  evidence, readiness/diagnostics, required hosted setup, backup assumptions,
  uncertain outcomes, and compatibility-limited rollback. Documentation will
  pause during the full gate because its source fingerprint includes these
  files; later evidence-only updates require explicit reconciliation.

### Round 10 — Schema ownership and final verification strategy

- **Coordinator/reviewer refinement:** the application explicitly owns the
  `public` schema. Runtime, readiness, and migration transactions pin
  `SET LOCAL search_path=public`; URL routing/schema overrides, including
  `options`, `search_path`, and `schema`, are rejected. The README records this
  supported boundary instead of implying arbitrary schema configuration.
- **Migration tests:** pure orchestration coverage is being added for exact
  history, advisory serialization, atomic failure rollback, and commit behavior.
  No new migration or change to migrations 001–006 is involved.
- **Agreed final strategy:** first run the real verifier through locked install,
  audit, and pure tests in a disposable temporary source repository containing
  one deliberately failing test. Then refresh a clean temporary fixture and run
  the full exact-SHA gate. Compare every runtime/tool/package/migration source
  hash with the user's working tree to establish provenance. Temporary-fixture
  commits are test setup only; the user's branch stays dirty and uncommitted.
- **Evidence scope:** this replaces a redundant full working-tree run. The
  nonreleasable working-tree rejection remains covered by contract tests. Neither
  planned gate has passed yet. Documentation records these refinements and then
  pauses again; implementation is not yet frozen.

### Round 11 — Target/cleanup reconciliation and migration checks

- **Implementer:** standalone test entry points now replace inherited
  `DATABASE_URL_UNPOOLED` with `DATABASE_TEST_URL_UNPOOLED`, or clear it if absent.
  Verifier SIGINT/SIGTERM handling terminates its active owned process group and
  stops its owned server. Interrupted test cleanup may leave namespace journals;
  these are retained for scoped reconciliation, not treated as cleanup success.
- **Independent reviewer:** migration orchestration **4/4** passed, exit 0 in
  0.76 s; `/tmp/ufd-phase7-reviewer/migrations-candidate1.log`. Source pins the
  public schema in runtime/readiness/migrations and correctly handles standalone
  test direct URLs. Reviewer accepts R3 source follow-ups pending the full gate.
- **Worker/gate inspection:** reviewer accepts use of the compiled worker in the
  subprocess test, assertions for exactly one completion/reply, and verifier
  signal cleanup. One smoke-harness follow-up remains: the unavailable-database
  case must override both URLs so it exercises actual network failure instead
  of failing earlier on target mismatch.
- **Coordinator negative gate in progress:** the actual verifier reached locked
  install and a zero-advisory audit; the deliberate pure test has failed. Other
  child tests are still finishing, so final exit and absence of release artifacts
  are not yet confirmed. The full positive clean-fixture run remains pending.
- **Documentation:** coordinator authorized these final pre-snapshot updates.
  README now describes standalone direct overrides and interrupted cleanup;
  a sanitized permanent `phase-7-verification.json` will be created after final
  results with source provenance, counts, and cleanup, excluding environment
  values. Documentation pauses again before the gate snapshot.

### Round 12 — Real negative-gate proof and candidate provenance

- **Independent reviewer:** accepted the actual negative verifier run in
  disposable fixture commit `d30d0af477a237fe03b6dec6f135427411e366e0`. Locked
  install succeeded, the full audit returned zero advisories, and pure tests
  reported 120 total: 119 passing plus the one deliberate failure. The verifier
  exited 1 with **no verification manifest and no source archive**. This combines
  with the workflow's verification dependency and deployment invalid-attestation
  tests to establish fail-stop behavior. Artifacts:
  `/tmp/ufd-phase7-fixture/negative.log` and `negative-result.json`.
- **Positive candidate 1:** refreshed fixture commit
  `ea5d0c0c719386878b845ab85b291a3a80261346`, tree
  `88d5bf78be9087da724719f95f5da66fa1da2df7`. Coordinator confirmed all 210 source
  files match the user working tree. Reviewer independently confirmed 195
  runtime/tool/config hashes and all 13 historical artifacts unchanged.
  Evidence: `/tmp/ufd-phase7-fixture/candidate1-provenance.json`,
  `/tmp/ufd-phase7-reviewer/candidate1-reconciliation.json`, and
  `history-candidate1.json`. Fixture commits do not commit the user's branch.
- **P7-R4:** coordinator assigned the Node contract mismatch its own identifier.
  Package engines initially allowed all 22.x while the gate/CI pinned 22.23.2.
  Reviewer confirms package/lock, `.nvmrc`, startup, and gate now agree on exact
  22.23.2, and the correction was already included in the frozen candidate.
- **Pre-gate implementer checks:** operations/migrations 11/11, TypeScript,
  lint (one inherited stylesheet warning), and whitespace checks exit 0.
  Artifacts include `/tmp/ufd-phase7-operations-final.log` and
  `/tmp/ufd-phase7-implementer-typecheck.log`. These do not replace the full gate.

### Round 13 — P7-R5: first full gate exposes transport lifetime failure

- **Candidate 1 completed stages:** locked install, zero-advisory full audit,
  140 pure tests (123 + 17), lint with the inherited stylesheet warning,
  typecheck, production build `FZqFoQUzseryw7Qii925s`, and migration/status checks
  for all six migrations. A separate final production audit also reports zero
  across all severities. Later database/runtime stages reached browser execution.
- **Browser regression slice:** six families pass 29 grouped checks with empty
  error arrays: working-modal 1, interactions 10, agent recovery 3, budgets 6,
  feature faults 5, and timestamps 4. Raw artifacts remain under
  `/tmp/ufd-phase7-verification/.release`.
- **Full gate outcome:** failed at `browser-database`. The first live-Neon
  journey records zero completed checks, one error, and `cleanup: true` in
  `release-1-neon-client.json`. No verification manifest/archive was produced;
  worker/performance/final-source completion had not been reached.
- **Exact failing step:** the editor initially appeared and its save was
  acknowledged. After `p.reload()`, the Name textbox did not become available
  before the first grouped check could be appended. This is a reload hydration
  failure; zero completed grouped checks does not mean initial editor load or
  writes failed. HTTP logs show successful writes before the pending session
  request. Original artifacts are preserved at
  `/tmp/ufd-phase7-fixture/candidate1-artifacts`.
- **Observed runtime defect:** reviewer found a Postgres fatal transport error
  (`08P01`, server connection failure) and a raw uncaught exception. A
  `session.read` remained pending for 281,629 ms before 503; a later request
  returned 200 after roughly 14 seconds. Readiness already had a bounded owned
  probe, but the generic application transaction did not have equivalent
  connected-network lifetime/error containment.
  The cause of the provider connection loss remains unknown; the established
  application defect is unbounded/uncaught checked-out-client error handling.
- **Required correction:** implementer reproduces the DOM/API failure and adds
  per-client error handling, a transaction deadline, and destruction of uncertain
  connections. Do not automatically retry effects whose commit outcome is
  unknown. Reviewer is preparing independent old/new fake-Postgres probes.
- **Disposition:** P7-R5 open. Preserve candidate 1's passing slices and failed
  gate separately; none establishes release readiness. This is a substantive
  runtime finding, not a selector workaround or accepted intermittent test error.

### Round 14 — Independent reproduction of P7-R5 on original source

- **Reviewer original fatal probe:** a local fake-Postgres peer acknowledged
  `BEGIN`, then sent fatal `08P01` in the same packet. The operation rejected in
  246 ms, but an uncaught error included the synthetic marker. A monitor kept the
  probe alive solely to capture that exception; this is not evidence the original
  production process would contain it. Artifact:
  `/tmp/ufd-phase7-reviewer/original-fatal.json`.
- **Reviewer original blackhole probe:** after connecting, the fake peer ignored
  the query and the transaction remained pending at an observer configured for
  12.5 s. The observer actually ran after 129,010 ms of wall time; its scheduling
  or clock discrepancy has not been explained, so this does not establish a
  precise original timeout. Teardown after the still-pending observer also produced an uncaught error; the
  exception monitor preserved capture rather than establishing production
  containment. Artifact:
  `/tmp/ufd-phase7-reviewer/original-blackhole.json`.
- **Scope:** both are independent actual protocol probes against original
  source, with no Neon access. Reproduction script:
  `/tmp/ufd-phase7-reviewer/transaction-transport-probe.mjs`.
- **Agreed correction:** own each checked-out transaction client, attach error
  handling, and enforce a 20 s transaction lifetime with destruction on failure;
  readiness retains its 10 s bound. Do not replay an uncertain transaction.
  Corrected-source probes and final gate remain pending; P7-R5 is open.

### Round 15 — R5 correction under review

- **Implementer:** a shared client-owner helper now combines a 5 s acquisition
  bound, 20 s active transaction deadline, checked-out client error handling, and
  destruction on failure. Readiness reuses it with 10 s; the migration client
  also has its own error listener. No automatic replay is added; uncertain commit
  outcomes retain the existing receipt/idempotent retry policy.
- **Current checks:** implementer reports operations 10/10 and TypeScript exit
  0. It also reports the reviewer's corrected protocol probes passing around
  20.1 s for a blackhole and 76 ms for fatal error, without uncaught exceptions.
  Exact independent artifacts/disposition will follow from the reviewer. A pool
  handoff listener gap remains under investigation before source freeze.
- **Separate live diagnostic:** the implementer's fresh first-load attempt hit
  its 30 s `goto` timeout. Its owned namespace cleanup succeeded and server
  stopped. This was not the original post-save reload reproduction and does not
  establish either recovery or recurrence of the same defect.
- **Disposition:** P7-R5 remains open while the pool-handoff check and final
  independent/full-gate evidence are pending. Do not attribute the provider
  connection-loss cause from these symptoms.

### Round 16 — R5 original probes pass; handoff race remains

- **Independent reviewer:** corrected original probes pass. `fixed-blackhole.json`
  reports rejection after 20,070 ms (20,104 ms monotonic); `fixed-fatal.json`
  reports 76 ms. Both record `uncaught: []`. Artifacts are in
  `/tmp/ufd-phase7-reviewer`.
- **Additional confirmed race:** coordinator identified the interval during
  connection handoff, before the transaction owner attaches its listener. The
  reviewer independently reproduced it by sending handshake `ReadyForQuery`
  and fatal error in one packet: uncaught `08P01` before any query, in 49 ms.
  Artifact: `handoff_before-handshake_fatal.json` in the same directory.
- **Required follow-up:** add a neutral per-connection error listener covering
  that handoff interval while retaining the operation owner's failure handling.
  The implementer has the finding. P7-R5 remains open; passing the first two
  corrected probes does not close the newly reproduced interval.

### Round 17 — R5 handoff correction and lasting regression

- **Implementer:** added one neutral error listener per pool connection at
  connect time, retaining the owned transaction's deadline/error listener. This
  covers `ReadyForQuery` plus fatal-error delivery before the connection promise
  continuation attaches operation-specific handling.
- **Checked-in regression:** an actual local Postgres-protocol socket sequence
  exercises handshake fatal → healthy new connection → fatal between queries on
  a borrowed client → healthy replacement. It asserts three connections and no
  uncaught errors.
- **Implementer evidence:** operations **11/11**, exit 0, in
  `/tmp/ufd-phase7-transaction-operations-final.log`; focused lint/types are
  running. Reviewer is independently replaying the exact original handoff probe.
- **Disposition:** source response and lasting test are present; independent
  replay, static completion, new freeze, and full gate remain pending.
- **Independent replay:** the reviewer's exact original same-packet handoff probe
  now rejects after 24 ms with zero queries and `uncaught: []` in
  `handoff_fixed-handshake_fatal.json`. Reviewer also inspected the checked-in
  failed-handshake/healthy-replacement/failed-reuse/third-connection regression
  and accepts the source/mechanism correction. Final static/runtime gate and
  source reconciliation are still required before R5 closure.

### Round 18 — Documentation frozen for candidate 2

- **Coordinator:** authorized final pre-candidate README updates after the R5
  source correction: ordinary transactions have a 20 s connected lifetime plus
  the separate 5 s acquisition bound; pool-handoff/active errors are contained
  and uncertain effects are not replayed automatically.
- **Policy clarification:** the gate's full `npm audit` blocks moderate/high/
  critical findings; low findings would be reported without failing that
  threshold. Current observed full and production audits have zero findings at
  every severity.
- **Future hosted setup:** README now gives the explicit operator command
  `heroku ps:scale worker=1 --app unified-front-door`, after the first compatible
  release exposes the worker type and an appropriate dyno plan is approved.
  Neither this phase nor the deploy script executes that billing/formation
  change.
- **Disposition:** documentation is frozen for the corrected candidate snapshot.
  P7-R5 remains open pending the full gate and final independent reconciliation.
  Later journal/evidence updates will be coordinated as documentation-only deltas.

### Round 19 — Corrected candidate 2 provenance and SQL gate failure

- **Source freeze:** corrected fixture commit
  `fcdb8db8464f7530cdf74179b43ea8644005110d`, tree
  `f5a5a8c81443d1ce2567612e2d4ad83c3178f5dc`. Coordinator and reviewer confirm all
  210 source files match the working tree/fixture; the user branch's HEAD remains
  `4e52aa1`. Reviewer reconciled 195 runtime/tool/config files, with exactly five
  expected implementation changes from candidate 1. Evidence:
  `/tmp/ufd-phase7-reviewer/candidate2-source-sha256.json` and
  `candidate2-reconciliation.json`.
- **Narrow changes:** `db.ts`, `readiness.ts`, `database.mjs`,
  `operations.test.mjs`, and `browser/neon-client.mjs`. The browser change records
  the failing stage and at most 40 API pathnames/statuses/generated request IDs;
  it does not change waits or assertions. Reviewer accepts both those diagnostics
  and final README refinements. Operations 11/11, typecheck, focused/harness
  lint, and whitespace checks passed before this freeze.
- **Secret handling:** coordinator's initial scan covered 247 source/evidence
  files against six configured private values, finding no matches; no private
  values were printed. Final durable evidence still needs its own final scan.
- **Full gate failure:** independent reviewer confirms SQL suite 9 total,
  **4 pass / 5 fail / 0 skipped**, 291,624 ms. Test 5 reached the owned transaction
  deadline; tests 6–9 failed connection acquisition. The gate stopped at
  `database-tests`, with no attestation. This candidate did not reach later agent
  database/browser/worker/performance stages.
- **Cleanup and artifact attribution:** coordinator confirms the owned namespace
  journal is `[]`. Raw evidence is preserved in
  `/tmp/ufd-phase7-fixture/candidate2-artifacts`. That directory also contains
  later-stage files left over from candidate 1; those files must not be counted
  as candidate 2 evidence.
- **Host observation, not diagnosis:** a local read-only scheduling sample of
  thirty nominal 100 ms sleeps took 4,049 ms (median 110 / p95 223 / max 458 ms),
  with CPU pressure `avg60` 43.64%. This shows contention but does not establish
  the cause of the database failures. Reviewer artifacts:
  `candidate2-host-observation.json` and `candidate2-local-scheduling.json`.
- **Disposition:** the source/mechanism correction is accepted provisionally;
  the required full gate is not passing, R5 final closure and Phase 7 approval
  remain pending, and no failure is waived or relabeled as successful evidence.

### Round 20 — Availability observation and unchanged retry

- **Implementer investigation:** the candidate 2 failure text identifies fresh
  physical connection timeout, not pool queue exhaustion. Three later read-only
  fresh `pg.Client` probes, bypassing the application pool, all passed: connect
  4,487 / 1,315 / 1,440 ms and `SELECT 1` 133 / 78 / 96 ms, total 8,323 ms,
  exit 0 (`/tmp/ufd-phase7-db-availability.json`). This small sample does not
  identify a provider/host cause for the earlier failure.
- **Coordinator/reviewer decision:** preserve the failed attempt and retry the
  same frozen exact revision without changing timeout, wait, or test assertions.
  Documentation remained outside the frozen fixture. Candidate 2's stale
  candidate-1 outputs are explicitly classified in
  `/tmp/ufd-phase7-fixture/candidate2-artifact-provenance.json` and excluded from
  its executed prefix.

### Round 21 — Full gate success and independent final evidence

- **Command:** Node **22.23.2**, from the clean disposable fixture,
  `node scripts/verify-release.mjs --revision fcdb8db8464f7530cdf74179b43ea8644005110d`,
  using private explicit disposable Neon test URLs. The successful same-source
  retry exited **0** after all **14 stages** and completed at
  `2026-09-16T21:32:39.539Z`. Build: `c8qB1_jslOkD9xnNaT7N1`. Log:
  `/tmp/ufd-phase7-fixture/candidate2-retry-1.log`; manifest and test artifacts:
  `/tmp/ufd-phase7-verification/.release`.
- **Exact test totals:** pure/SSR 123, server-only pure 21, application database
  9, and agent database 13 = **166 passing / 0 failing / 0 skipped**. Locked
  install, full zero-advisory audit, lint (one inherited stylesheet warning),
  typecheck, web/worker production build, six migrations/status checks, and
  positive/negative runtime smoke pass. Separate production audit is also zero.
- **Runtime/browser evidence:** **29** grouped regressions (modal 1, interactions
  10, agent recovery 3, budgets 6, faults 5, timestamps 4); two independent
  **4-check** live-Neon journeys with empty error arrays and successful cleanup;
  **3** actual compiled-worker kill/restart/cancellation/retry checks with cleanup.
- **Performance:** **15** samples, no errors, 4× CPU throttle. All six typing
  samples preserved the complete 100-character value while issuing 10–13 save
  requests. Transcript samples mount 20 of 20, and 40 of 80/128 messages. These
  measured counts do not replace Phase 6's historical comparison or establish a
  precise timing improvement on the contended host.
- **Independent source proof:** reviewer confirms all 195 runtime/tool/config
  hashes unchanged; all 13 historical artifacts unchanged; all 210 archive files
  exactly match with no extras; lock/archive/Git archive digests, fixture
  revision/tree/build, clean checkout, and unchanged user HEAD agree. Artifacts:
  `/tmp/ufd-phase7-reviewer/candidate2-final-source-proof.json` and
  `candidate2-final-evidence.json`.
- **Cleanup:** coordinator confirms four owned namespace journals empty
  (application, agent, browser, worker), no remaining processes with fixture cwd,
  no runtime changes, intact historical files, and user HEAD unchanged.
  `/tmp/ufd-phase7-fixture/final-coordinator-reconciliation.json` and
  `final-process-check.json` retain the checks. Final private-value scan, including the durable artifact, finds
  zero matching files across 269 source/evidence file entries checked against six
  private values. No values were printed.
- **Disposition:** independent reviewer accepts **R1–R5 implementation and
  evidence**. P7-A8 final documentation/evidence review and the exact overall
  approval statement remain pending. No user-branch commit, deployment, remote
  dispatch, provisioning, or real-provider integration occurred.

### Round 22 — Runtime diagnostics retained as a limitation

- **Independent successful-run observation:** 11 Next-labeled
  `uncaughtException: aborted` / `ECONNRESET` blocks, all with the same
  ignore-listed frame form. Source/cause is unconfirmed. This diagnostic class
  also appeared in Phase 6, but that does not prove a common cause or that it is
  harmless. No Postgres fatal marker is observed in this successful run.
- **Structured request observations:** 257 HTTP 200s, 7 generation-related 409s,
  and two caught/redacted `agent.read` 503s (492 and 1,734 ms), followed by
  successful reads. Maximum recorded operation was 4,301 ms. Reviewer observation:
  `/tmp/ufd-phase7-reviewer/candidate2-retry-server-observation.json`.
- **Acceptance scope:** the actual journeys, continued service, bounded caught
  failures, and cleanup support the implemented guarantees. They do not identify
  the unexplained disconnect cause or justify a clean-server-log claim. Both
  earlier full-gate failures remain visible in the durable record.

## Validation record

| Scope | Candidate / result | Evidence / limitation |
| --- | --- | --- |
| Diagnostic isolation and redaction | Evolving first slice; four grouped checks pass, exit 0. | `/tmp/ufd-phase7-reviewer/diagnostics-first-slice.json`; preliminary at that slice; follow-ups and final-source reconciliation completed by the accepted final gate. |
| Current dependency audit | Coordinator: before full 26 / production 2; after full 0 / production 0 advisories. | `/tmp/ufd-phase7-audit/{full,production,full-after,production-after}.json`; targeted transitive lockfile update, independent/final gate reconciliation subsequently completed. |
| Readiness blackhole deadline | Reviewer: real probe rejects after 10,526 ms, destroys connection, cleanup exit 0. | `/tmp/ufd-phase7-reviewer/readiness-blackhole-fixed.json`; corrected source at that slice; final reconciliation subsequently completed. |
| Deployment first slice | Reviewer: 8/8, exit 0. | `/tmp/ufd-phase7-reviewer/deployment-first-slice.log`; evolving source, followed by expanded slice. |
| Operations + deployment slice | Reviewer: 7 + 9 = 16/16, exit 0, 30.46 s. | `/tmp/ufd-phase7-reviewer/operations-deployment-candidate1.log`; R3 standalone follow-up was open at that slice; subsequently corrected and independently closed. |
| Migration orchestration | Reviewer: 4/4, exit 0, 0.76 s. | `/tmp/ufd-phase7-reviewer/migrations-candidate1.log`; subsequently reconciled by the accepted final gate. |
| Real negative release gate | Exit 1; locked install/audit pass, 119/120 pure tests with one deliberate failure; no manifest/archive. | `/tmp/ufd-phase7-fixture/negative-result.json`; independently accepted fail-stop proof in a disposable fixture. |
| Candidate 1 full gate | **Failed** at `browser-database`; build and 29 grouped browser regressions passed before failure. | Fixture `ea5d0c0c…`, build `FZqFoQUzseryw7Qii925s`; P7-R5 was open at that failed slice (no release artifacts); subsequently corrected and independently closed. |
| R5 original transport reproduction | Fatal packet leaks uncaught synthetic error; connected blackhole remains pending at observer. | `original-fatal.json` / `original-blackhole.json` in reviewer artifacts; local fake protocol, no Neon. Observer scheduling discrepancy prevents a precise original-latency claim. |
| R5 first correction | Original fatal and blackhole probes pass without uncaught errors; handshake handoff race still reproduces. | `fixed-fatal.json`, `fixed-blackhole.json`, `handoff_before-handshake_fatal.json`; R5 was open at that slice; handoff correction and final gate subsequently independently accepted. |
| Candidate 2 full gate | **Failed** at `database-tests`: 4 pass / 5 fail / 0 skipped, 291,624 ms; no attestation. | Fixture `fcdb8db8…`; owned namespace journal empty, later-stage C1 leftovers excluded. Cause remains unconfirmed; unchanged same-source retry subsequently passes. |
| Same-source candidate 2 retry | **Passed**, exit 0, all 14 stages; 166 tests, 29 browser groups, 2 × 4 live checks, 3 worker checks, 15 samples. | Fixture `fcdb8db8…`, build `c8qB1_jslOkD9xnNaT7N1`; independent exact archive/source proof and cleanup accepted. Final phase documentation approval subsequently issued; all P7-A1–P7-A8 accepted. |

The sanitized [permanent artifact](phase-7-verification.json) retains the final
manifest fields, source hashes, exact summaries, failures, protocol evidence,
cleanup, and limitations without environment values. Its fixture `releasable`
field records a successful gate in the disposable test repository; it is not a
deployable committed revision of the user's dirty branch or deployment approval.

Subsequent entries will identify the candidate, exact command/runtime, outcome,
artifacts, and any accepted evidence reuse. Phase 6's accepted results remain
historical evidence, not a substitute for Phase 7's required release checks.

## Final disposition

On September 16, 2026, independent reviewer **`phase7_reviewer`** issued:

> FINAL INDEPENDENT APPROVAL: P7-A1, P7-A2, P7-A3, P7-A4, P7-A5, P7-A6, P7-A7, and P7-A8 are approved. All agreed in-phase criteria have accepted evidence; R1–R5 closed, no waived requirement. Final documentation/artifact clarifications and hash/data consistency are accepted.

The approval applies to runtime matching temporary fixture
`fcdb8db8464f7530cdf74179b43ea8644005110d`, build
`c8qB1_jslOkD9xnNaT7N1`, and the reviewed documentation-only updates. The permanent
artifact records the complete reviewer statement and updated final-document
hashes. All failed-attempt, diagnostic, hosted, and provenance limitations remain.

No deployment, user-branch commit, or Phase 8 was authorized. Hosted runtime
remains unverified. Stop here and return to the user for the next checkpoint.
