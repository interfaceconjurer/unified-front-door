# Phase 9 — Operational diagnostics and hosted release preparation

**Started:** September 16, 2026  
**Status:** Approved — all six acceptance criteria satisfied; stop at the user checkpoint.  
**Authorization:** The user's “lets continue” after Phase 8 approval.  
**Plan:** [Architecture implementation plan](../architecture-plan.md#phase-9--operational-diagnostics-and-hosted-release-preparation)  
**Evidence:** [Phase 9 verification record](phase-9-verification.json)

## Current synthesis

- The reviewer accepted the source freeze after the four demonstrated defects
  below were corrected. Focused evidence includes 10 production and 10 development
  HTTP groups, six actual-Neon concurrency scenarios, and 14 operations tests.
- The full **14-stage gate passes, including 205 Node tests**, on temporary
  revision `9d8c4db17bad283fce8d25abe480bc35c3e09d2f`, build
  `Us4C1d3BjRMulNOQ2-vMd`. The reviewer verified its archive and all 210 runtime
  files; 18 historical files are unchanged. Final documentation review is complete
  and `/root/phase9_reviewer` explicitly approved all six criteria.
- The ordinary production log has 200 operations: 195 successful 200 responses
  and five session-generation 409 responses; **zero 5xx, `agent.read` 503s,
  uncaught exceptions, or framework abort blocks**. Three snapshot retries and
  eleven safely classified `request_reset` records remain visible. This is not
  an empty-log or universal error-free-operation claim.
- Read-only Heroku preflight is complete. No hosted change, deployment,
  user-branch commit, or paid provider call occurred in this phase.
- Historical logs lack enough detail to attribute each earlier error. New
  reproductions and successful fixes do not remove that limit.

## Scope and roles

Resolve or accurately attribute request-abort exception blocks and recovered
`agent.read` 503s retained from earlier verification. Make minimal supported
corrections, preserve real error visibility, and prepare a concrete hosted release
preflight. No new paid provider calls, hosted configuration changes, deployment,
or user-branch commit are included. Hosted acceptance remains unperformed.

- **Implementer:** `/root/phase9_implementer`, runtime/tests and reproduction.
- **Independent reviewer / approver:** `/root/phase9_reviewer`, evidence and final decision.
- **Scribe:** `/root/phase9_scribe`, current documentation and this record.
- **Coordinator:** `/root`, scope, independent checks, read-only hosted preflight,
  and the user checkpoint.

The user branch begins at `4e52aa1d813d80eef6f1ba88e2d42a3b0e82e8bf` with the
previously approved uncommitted work preserved. Before edits, the coordinator
captured 18 historical file hashes in `/tmp/ufd-phase9/historical-sha256.json`:
Phase 1–8 journals, Phase 6–8 evidence artifacts, and migrations 001–007. These
files are immutable in this phase.

## Acceptance ledger

The coordinator ratified these six criteria with the reviewer before implementation.

| ID | Required outcome | Status |
| --- | --- | --- |
| P9-A1 | Reproduce/classify abort exceptions with request/lifecycle correlation; bound historical attribution. | Approved: correlated reproduction and bounded historical attribution. |
| P9-A2 | Identify recovered `agent.read` 503 safe codes/triggers; separate direct proof from historical inference. | Approved: six real database scenarios and safe failure classification. |
| P9-A3 | Minimal demonstrated-defect correction and focused regression, without blanket suppression. | Approved: focused corrections and frozen full gate. |
| P9-A4 | Preserve paid intent, cancellation/fencing, ownership, and demo-only ordinary verification. | Approved: nine critical files match Phase 8 and retained regressions pass. |
| P9-A5 | Diagnostic and functional outcomes tied to exact reviewed source. | Approved: full gate, archive checksum, 210-file equality, and diagnostic audit. |
| P9-A6 | Concrete read-only Heroku preflight, requirements/unknowns, accurate docs, and explicit independent approval. | Approved: concrete preflight, accurate documentation, and explicit independent decision. |

## Investigation and review

Phase 8 retained three recovered `agent.read` 503s and seven Next
abort/uncaught-exception blocks in the release gate; its separate live server
recorded four abort blocks alongside 58 structured HTTP operations, all 200.
Those counts remain historical observations, not attributed causes. The Phase 8
acceptance, paid-call evidence, and limitations remain unchanged in its journal.

The independent reviewer confirmed that the three original read errors retain
only the safe code `unavailable`, without SQLSTATE. Original abort stacks omit
internal frames and request IDs. A new correlated reproduction can establish a
defect and support its correction, but cannot prove the cause of each historical
occurrence. This limit remains even if subsequent verification is clean.

### Demonstrated findings and focused corrections

| ID | Evidence | Disposition |
| --- | --- | --- |
| P9-R1 — Read transaction conflict | Implementer reproduced SQLSTATE `40001` using a repeatable-read transaction waiting on a session row while a writer commits a generation change. | Focused correction passes: retry a private read snapshot once for `40001`; six database scenarios enforce fresh generation/revocation without stale data. No write/paid replay; historical 503 attribution remains unproved. |
| P9-R2 — Challenged request body lifetime | Five local Playwright invalid-POST Basic Auth challenge/retry calls reproduce multiple uncaught `ECONNRESET` errors without Neon. Safe lifecycle tracing identifies an ended request re-exposed as an unread buffered stream after proxy finalization, with no error listener when the socket closes. | Custom entrypoint correction passes final focused production/development suites, including ten challenge/retry cycles per mode and no monitored uncaught blocks. Historical abort attribution remains unproved. |
| P9-R3 — Unsupported production upgrade lifetime | Independent probe confirms upgrade authentication, but an authenticated production HMR upgrade gives no response for over three seconds; the harness eventually forces shutdown with `SIGKILL` at ten seconds. | Technical correction independently validated: reject unsupported authenticated production upgrades with 426; subsequent shutdown exits normally in 13 ms. Accepted in final phase approval. |
| P9-R4 — Development shutdown lifecycle | Implementer trace shows HTTP and public Next cleanup resolve while development handles keep the process alive. | Technical correction accepted: drain HTTP before framework cleanup, close owned HMR sockets, and exit successfully after cleanup; final development check drains an in-flight request and exits in 4,151 ms. |

Implementer reproduction evidence is under `/tmp/ufd-phase9-implementer/`,
including `playwright-baseline.log` and `reproduce-playwright.mjs`. These are
diagnostic proofs, not corrected-source acceptance. The first database cleanup
attempt hit a foreign-key ordering error (`23503`); cleanup then used the existing
repository order and removed the exact owned namespace. No remaining namespace
was reported. No provider calls or runtime changes were needed for these probes.

All four corrections have focused evidence; the full frozen gate and independent
source/diagnostic audit pass. Final documentation review and explicit phase approval
are complete, with no remaining in-phase findings.

### Selected correction boundary

The coordinator and reviewer agreed to move the uniform Basic Auth gate into a
supported custom Next HTTP entrypoint, before framework routing. This avoids the
demonstrated denied-request body-cloning path without excluding any URL from
authentication or patching framework internals. Focused tests support this
boundary. The installed custom-server guide and
[official Next custom-server documentation](https://nextjs.org/docs/app/guides/custom-server)
were checked; this app does not use the incompatible standalone output mode.

The six acceptance criteria now necessarily cover the changed startup boundary:
development/production/test parity; page, asset, API, and upgrade authentication;
request-size and CSRF protections; disconnect behavior; and bounded shutdown.
No original criterion is removed or weakened.

The reviewer inspected the corrected entrypoint and read helper. Upgrade
authentication runs before all framework upgrade listeners. The read retry has a
shared 20-second snapshot-work budget plus the existing terminal pool-acquisition
allowance of up to five seconds; it is not a strict 20-second wall-clock bound.
The first corrected five-request challenge/retry trace shows normal request
lifetime state and no monitored uncaught blocks. This is preliminary evidence,
not the final regression or release-gate result.

The reviewer then found P9-R3 in `/tmp/ufd-phase9-reviewer/upgrade-review.mjs`:
unauthenticated upgrade checks return the expected rejection before and after
framework initialization, but an authenticated production HMR upgrade hangs.
The original failure is retained in `upgrade-review-before.json` and its log.
After correction, the independent repeat records 401 for missing/invalid upgrade
credentials and 426 for authenticated production upgrades, both before and after
framework initialization. It records no uncaught blocks and normal shutdown in
13 ms, exit 0. Evidence: `/tmp/ufd-phase9-reviewer/upgrade-review.json`. The reviewer
accepts this technical correction as part of final phase approval.

For P9-A4, the reviewer independently compared nine critical source files with
the approved Phase 8 fixture: model provider/context/attempts/worker, agent
worker/runs, session, agent, and HTTP body/CSRF handling are byte-identical.
`/tmp/ufd-phase9-reviewer/phase8-invariants-source.json` records the comparison.
This establishes source preservation for those files; the final complete gate
also passes the retained regression checks.

### Reviewed source and focused validation

The reviewer accepted the source freeze after **10 production and 10 development
HTTP groups** pass. Both cover universal authentication, ten POST challenge/retry
cycles, upgrades before/after Next initialization, CSRF and declared/chunked
4.5 MB limits, disconnect recovery, page/static rendering, and shutdown while an
authenticated POST is in flight. The pending POST returns the expected 400 before
normal exit. Production additionally checks transport deadlines; development
checks an actual authenticated HMR handshake (101), held open through shutdown.

| Mode | Timing evidence | Artifact |
| --- | --- | --- |
| Production | Header/body 408 after **10,740 / 15,751 ms**; shutdown **4,127 ms**, exit 0. | `/tmp/ufd-phase9-implementer/http-production/result.json` |
| Development | HMR 101; shutdown **4,151 ms**, exit 0. | `/tmp/ufd-phase9-implementer/http-development/result.json` |

Both final artifacts report cleanup success and no monitored unhandled exceptions,
framework abort blocks, or credential leakage. TypeScript and whitespace checks
pass. Lint reports zero errors and the existing layout stylesheet warning.
The checked-in production suite is part of `test:runtime`. The exact frozen gate
passes all 14 stages in `/tmp/ufd-phase9-verification` at temporary revision
`9d8c4db17bad283fce8d25abe480bc35c3e09d2f`, build `Us4C1d3BjRMulNOQ2-vMd`, on
Node 22.23.2. Its 230-file source manifest and log are
`/tmp/ufd-phase9/fixture-source.json` and `/tmp/ufd-phase9/release-gate.log`.
Provider keys are excluded and demo mode is forced. This is a temporary-fixture
attestation; the user branch is uncommitted and final result documentation was
updated outside the fixture. The reviewer confirms all 210 non-documentation
source files match and all 18 historical files are preserved.

| Final gate evidence | Result |
| --- | --- |
| Node suites | **205 tests**: 123 client/pure + 45 server/pure + 10 application DB + 27 agent/model DB. |
| Browser regressions | 29 checks across six browser artifacts, no reported errors. |
| Neon browser checks | Two runs of four checks; both clean up their owned data. |
| Worker recovery | Three process checks; cleanup succeeds. |
| Performance | 15 samples; no reported errors. No broader capacity claim. |
| Frozen HTTP regression | 10 groups pass; header/body 408 after 10,746 / 15,757 ms; in-flight shutdown 4,131 ms. |
| Independent audit | Archive checksum valid; 210 runtime and 18 historical files match; all owned namespace/scope journals are empty. |

The independent diagnostic audit separates ordinary application traffic from
intentional HTTP fault injection. Ordinary traffic has 200 structured operations
(195 HTTP 200, five `session_changed` HTTP 409), three snapshot retries, and eleven
`request_reset` events; no 5xx, `agent.read` 503, uncaught, or framework-aborted
blocks occur. The HTTP regression deliberately generates reset/cancel events and
also has zero uncaught/framework-aborted blocks. Evidence:
`/tmp/ufd-phase9-reviewer/final-technical-audit.json` and
`/tmp/ufd-phase9-reviewer/final-cleanup-browser.json`. These observations support
the fixes while retaining real failure visibility; historical attribution limits
still apply.

The coordinator refreshed ignored local build outputs successfully as build
`CMudXc8Qljxc1JX0Q4dEd`, using the same runtime source. This makes normal local
startup current; the release-gate evidence remains tied to `Us4C1d3BjRMulNOQ2-vMd`.
No application server or worker was left running and no credentials were edited.

The first development test used an obsolete hot-reload URL; installed Next 16.3.5
uses `/_next/hmr`. Subsequent shutdown investigation exposed P9-R4; its failed trace
is retained at `/tmp/ufd-phase9-implementer/http-development/fourth-server.log`.
Intermediate nine-group results were superseded by the ten-group runs above;
their mutable artifact paths are not presented as independent retained evidence.

The coordinator's actual-Neon snapshot regression passes six scenarios: agent,
workspace, and run-event reads each race a session-generation change and a
revocation. Each read retries exactly once, then returns the correct 409 or 401
without stale data. One Node test group passes in **11.340 s** (14.328 s total),
exit 0; the owned namespace journal is empty. Evidence:
`/tmp/ufd-phase9/snapshot-database-corrected.log`. Operations tests pass **14/14**
in `/tmp/ufd-phase9/operations.log`.

The first snapshot test run failed its watcher assertion after **5.533 s** because
`pg_stat_activity` was cached inside the writer transaction. The correction changes
only the test observer to live `pg_locks`, preserving assertions and timeouts;
runtime code is unchanged by that correction. The original
`/tmp/ufd-phase9/snapshot-database.log` and its empty cleanup journal are retained.

## Hosted release preflight

Read-only observation at **2026-09-17 01:55 UTC** (September 16 Eastern); source:
`/tmp/ufd-phase9/hosted-preflight.json`. No remote mutation occurred.

| Item | Observed state / release requirement |
| --- | --- |
| App/release | `unified-front-door`, `heroku-24`, region `us`; current successful release `v11`. |
| Processes | `web.1` Basic is up on `v11`; no running worker. This does not establish the currently available process types or future worker readiness. |
| App configuration | Basic Auth password present; both database URLs, `APP_ORIGIN`, `AGENT_PROVIDER`, and `ANTHROPIC_API_KEY` absent. Values were not recorded. |
| GitHub environment | Public repository; `heroku` environment has `HEROKU_API_KEY`, no smoke password secret, no protection rules, and no deployment branch policy. |
| Source | User branch remains uncommitted. An exact committed revision and its fresh passing release attestation are required before deployment. |
| Hosted database | Configure a distinct `heroku-demo` target with matching pooled/direct URLs; confirm schema state, restore retention, and a verified recovery point. Hosted branch existence, backups, and restore readiness are not established by this preflight. |
| Provider/budget | Configure a separate hosted key if enabling Anthropic. Confirm daily attempt allowances: defaults 10 globally / 5 per namespace. These limits do not cap dollars; another paid hosted verification requires authorization. |
| First worker cost | Candidate Basic worker adds about $7/month; existing Basic web plus worker totals about $14/month before Neon, Anthropic, and taxes. Plan/capacity choice and purchase are not approved. |

### Concrete release sequence awaiting authorization

1. **Before publishing or merging the intended release to `main`, configure
   required reviewers and a main-only deployment policy for the `heroku` GitHub
   environment.** The workflow auto-deploys eligible pushes to `main`, so these
   protections must precede that trigger. Configure matching smoke credentials.
2. Select the exact release commit after local verification; retain its attestation,
   current hosted release, schema state, and recovery evidence.
3. Configure the isolated hosted database, exact HTTPS app origin, Basic Auth,
   approved provider settings/key, and agreed allowance policy privately.
4. Use the gated repository workflow for that revision. Its `release` process
   applies migrations before the new web/worker formation starts; a successful
   build alone is not successful release acceptance.
5. After the compatible slug exposes the worker process type, separately approve
   the dyno plan and activate one worker. Verify web and worker use the intended
   release, then check authenticated readiness and the agreed hosted journeys.
   Provider generation needs its own explicit spending allowance.
6. Reconcile release/configuration/schema state after any failure before retrying.
   Code rollback does not roll back database records; the existing recovery
   runbook governs restore and target changes.

Official references checked by the coordinator:
[Heroku release phase](https://devcenter.heroku.com/articles/release-phase),
[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
and [Heroku pricing](https://www.heroku.com/pricing/). Full operational steps are in
the [README release runbook](../../README.md#heroku-release-runbook).

## Final disposition

**APPROVED — all six agreed Phase 9 acceptance criteria are satisfied, with no
open in-phase findings.** `/root/phase9_reviewer` issued this decision at
2026-09-17 02:39:41 UTC after the final documentation read and precise README
clarification that commands and paid work are not automatically replayed. The
reviewed revision is `9d8c4db17bad283fce8d25abe480bc35c3e09d2f`, build
`Us4C1d3BjRMulNOQ2-vMd`; the decision is preserved in the verification record and
`/tmp/ufd-phase9-reviewer/approval.json`.

Stop at the user checkpoint. Individual historical errors remain unattributed;
hosted deployment/acceptance remains unperformed. No paid provider calls, hosted
mutations, or user-branch commit occurred in this phase.
