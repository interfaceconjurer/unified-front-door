# Phase 5 — Agent/assessment application interfaces

**Started:** September 15, 2026  
**Status:** Approved — awaiting the user's Phase 6 checkpoint  
**Approved:** September 16, 2026  
**Authorization:** The user replied “lets do it” after independent Phase 4 approval.  
**Baseline:** Approved Phase 4 working tree, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md#phase-5--agentassessment-application-interfaces)  
**Findings:** F5, F9 integration contracts, and F10 in the [architecture review](../architecture-review.md)

## Current synthesis

- Phase 5 is authorized under ratified P5-A1–P5-A8. **All sixteen findings are
  closed:** candidate 6 original two-tab browser passes three records/errors `[]`,
  alongside R16 original/fixed SQL and queue recovery probes. Candidate 6 planning
  passes four records/errors `[]`. After the final documentation read, the reviewer
  approved **100% of P5-A1–P5-A8**, with no unresolved finding or waived criterion.
  The exact decision is recorded below.
- Candidate 6 build `15T7t4qKdNxu-Q1IMvqKh` passes: runtime 138 stable across
  build, source 162/worker 30 archived, nine historical immutable files unchanged,
  and 71 client files/zero configured-secret matches. All 30 worker files are
  byte-identical to candidate 5, retaining its exact crash/restart proof.
- Independent pure **104** and full type/lint pass. Final candidate 6 actual-Neon
  SQL **22/22** passes (13 agent plus 9 retained tests), both exit 0 with cleanup hooks and
  empty exact namespace journals, no transport errors. Earlier connection-timeout
  failures remain preserved with unresolved cause.
- Production evidence includes candidate 6 planning/history 4, candidate 4 parity
  3/lifecycle 5/import 7/buffer 4, original ACK-race and full recovery passes.
  Final compiled-worker SIGKILL/restart passes two records. Reviewer closures
  retain original failures and exact candidate boundaries.
- Applied migration 006 is independently accepted and immutable; Phase 1–4
  journals/prior migrations stay byte-identical. Existing private Neon setup and
  portable `pg`/ordered-SQL path carry forward without repeated user setup.
- Assessment tools remain read-only; fake write/reconciliation tests use chat.
  Real provider/private-resource integration remains Phase 8. Phase 5 is approved;
  no deployment or commit occurred. Phase 6 requires a new user checkpoint.
- Official `npm run worker` completes the acknowledged turn with browser closed
  and web stopped; a restarted web process/new browser observes the same turn and
  one user message. Reviewer independently accepts the lifetime scripts/artifacts.
  Final runtime138/worker30 hashes match; only README/plan/this journal differ.
  All browser/web/worker test processes are stopped.

## Roles and baseline

- **Implementer:** `phase5_implementer`, application source and tests.
- **Reviewer / approver:** `phase5_reviewer`, independent acceptance and review.
- **Scribe:** `phase5_scribe`, this journal, README, and current plan status.
- **Coordinator:** primary agent, acceptance/design coordination, baseline and
  independent build/Neon/browser evidence, and user checkpoint.

No agent approves its own implementation. Existing dirty and untracked source is
approved prior-phase work, not disposable baseline noise. Phase 1–4 journals stay
byte-identical; their historical checkpoint wording records the decision at that
time, while this journal and the plan carry the current handoff. The installed
Next version is **16.3.5**; relevant installed guides must be read before framework
source changes.

## Acceptance ledger

The reviewer proposed P5-A1–P5-A8, the implementer agreed, and the coordinator
ratified the criteria and concrete design before releasing source edits. The
[plan](../architecture-plan.md#acceptance-criteria-p5-a1-through-p5-a8) contains the
complete criteria. The agreed operation lifetime includes reload, browser closure,
and process restart, so the original plan's conditional durable-worker requirement
applies. A generic workflow engine and a real provider are not phase requirements.

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P5-A1 | Typed replaceable demo adapters own replies, recommendations, fixture interpretation, and clocks outside React; deterministic delayed/failing alternatives use the same UI contract. | Reviewer accepted: alternate policy, delayed/failing lifecycle, pure contracts and final source inspection pass. |
| P5-A2 | Server-owned scope/epoch and request/conversation/turn/run/attempt/event identity, immutable validated context/snapshots, correlated events, safe errors, foreign-scope and changed-payload replay rejection. | Reviewer accepted: scoped SQL/lifecycle/snapshot/HTTP, R15/R16 probes, C6 planning and SQL22 preserve exact user/draft/import/uncertain-request guards. |
| P5-A3 | Acknowledged conversations/turns/runs/events/results survive reload, browser close, and process restart in Neon; ordered/deduplicated cursors separate durable history from presentation and preserve historical findings. | Reviewer accepted: upgrade/history/scope probes, SIGKILL/restart, official worker with browser closed/web down, then new browser observes identical completed turn and one user message. |
| P5-A4 | One logical active assessment across tabs; worker-only progress; database-clock leases/fences, finite crash recovery, stale-worker rejection, and session/generation/epoch authority at claim and publish. | Reviewer accepted: fenced SQL/crash proofs, R16 original/fixed and queue probes, C6 two-tab3 with one pending run, linked resume, shared completion and zero browser advancement. |
| P5-A5 | Explicit pending/streaming/completed/failed/cancelled UI, safe cancellation/retry/lost-ACK and late/reset/session handling, busy composer retention, no late recommendation navigation, and durable uncertain-effect reconciliation without blind retry. | Reviewer accepted: independent effects/client probes and original production ACK/navigation/recovery/lifecycle/planning/two-tab/lifetime checks; every related finding closed. |
| P5-A6 | Authenticated server registry validates named tools/input/captured resource scope; model text grants nothing, real tools/providers disabled, injected denial/unknown/unconfigured/effect paths tested. | Reviewer accepted: tool denial, uncertainty/child kill/reconcile, read-only assessment denial with zero dispatch/effect journal, and disabled real integrations. |
| P5-A7 | Independent new/prior suites, TypeScript/lint/build on Node 22; actual Neon migration/concurrency/isolation/rollback/worker-kill-restart/lost-ACK/failure/cancel checks and affected production browsers. | Reviewer accepted: independent pure104/type/lint, C6 build/runtime138/worker30 reconciliation, finalSQL22, all designated production/browser/process checks, retained exact-source evidence. |
| P5-A8 | Accurate README worker/local/Heroku lifetimes/limits, complete decisions/findings/exact evidence and independent approval; no unresolved in-phase criteria or findings. | Approved: final README/plan/journal read accepted; all P5-A1–A8 satisfied, R1–R16 closed, exact independent decision recorded below. |

Phase 1 recovery, Phase 2 historical integrity, Phase 3 captured navigation, and
Phase 4 server ownership/acknowledgement remain required. No review finding may be
silently moved to a later phase or acceptance criterion weakened to gain approval.

## Design and review chronology

### Round 0 — Authorization and acceptance draft

- **Coordinator:** relayed the user's Phase 5 authorization and established the
  implementer/reviewer/scribe loop through independent 100% acceptance. Requested
  preservation of the approved source baseline and all historical journals, and
  carry-forward of the approved portable Postgres setup.
- **Scribe:** read the working agreement, existing Phase 5 scope, and Phase 4
  approval synthesis. Confirmed installed Next **16.3.5**, initialized this
  journal and draft ledger, and updated current plan/README handoff. No source,
  database, environment, or historical journal was changed.
- **Disposition:** acceptance and execution-lifetime agreement remain pending.
  The draft is not an implementation approval or a change to scope.

### Round 1 — Durable lifetime and independent design acceptance

- **Reviewer:** proposed precise P5-A1–P5-A8 covering replaceable demo adapters;
  immutable validated context and operation identity; durable conversations,
  events, runs, and results; worker-only progress; observable recovery; server
  tool authorization; actual Neon and production evidence; and documentation.
  The implementer agreed. The proposed lifetime explicitly covers reload, browser
  closure, and web-process restart, making the plan's conditional worker
  requirement applicable.
- **Implementer:** proposed one durable Postgres step worker with a shared local/
  Heroku command, owner-scoped conversations/runs/append-only events, stable
  request receipts, and server-issued conversation/turn/run identities. HTTP
  submit/observe/cancel/retry/visit operations capture validated project/worktree/
  org/surface and immutable fixture/project snapshots; observation is read-only.
  Demo adapters own replies, recommendation/fixture interpretation, delays, and
  deterministic failure alternatives. Acknowledged records survive the declared
  lifetime; unsent composer text retains its separate browser lifetime.
- **Reviewer prerequisites, confirmed by implementer:** database uniqueness makes
  distinct assessment starts converge on one active run; rescan first cancels the
  prior execution. Each conversation permits one active chat run, returns a typed
  busy error, and preserves ordered response placeholders. Mutation lock order is
  session → workspace → conversation → run. Publishing checks the unexpired
  database-clock lease, fence, status, generation, and epoch. Expired-lease
  recovery increments a finite retry counter.
- **Effects and history:** an uncertain-effect marker and stable effect identity
  commit before any potentially effectful dispatch. Injected fake effects and a
  reconciliation hook must exercise that actual branch; an unknown outcome blocks
  blind replay. Stable visit IDs and semantic deduplication prevent duplicate
  entries across tabs; historical Today entries freeze when no longer current.
- **Cancellation and scope:** persona switch/sign-out cancel prior-generation
  active jobs. Resuming an incomplete assessment creates a newly authorized
  attempt linked to the same logical finding run; rescanning creates a new finding
  run. Navigation leaves submitted context unchanged. Reset removes owned records
  through the namespace/profile boundary.
- **Independent reviewer decision:** design **ACCEPTED for implementation** after
  all prerequisites were confirmed. This accepts the design only; no source,
  runtime validation, or Phase 5 final approval is claimed. Coordinator
  ratification was still awaited when this exchange was recorded.

### Ratification and source-work release

- **Coordinator:** ratified reviewer P5-A1–P5-A8 and all accepted design
  prerequisites after capturing `/tmp/ufd-phase5-baseline` with 144 files and
  checksums, including immutable Phase 1–4 journals and approved Phase 4 build ID
  `7DGiXxg-81-9PtS_a9xUl`. No secrets were included in that baseline.
- **Clarifications within the existing criteria:** check session expiry/revocation
  at both claim and publish; evaluate lease expiry with database wall-clock time
  after obtaining locks; retain composer content after busy rejection; prevent
  late recommendation results from navigating after newer selection/navigation;
  derive visits/history on the server; remove browser `assessment.advance` and
  adapt retained Phase 4 assessment checks through the actual worker without
  dropping their assertions.
- **Disposition:** source edits released. `.next`, dependencies, and migrations
  remained held for coordinator/schema coordination at this point. No new service,
  real provider, deployment, or Phase 6 work is included. The acceptance ledger is
  now agreed; no runtime check or final approval has passed merely from this
  ratification.

### Approved-baseline browser and upgrade preparation

- **Coordinator:** representative browser capture against the approved Phase 4
  production build and actual Neon passed three records with no errors: home →
  Build recommendation, CRM/main/UAT reply, and Today chronology. This records
  existing behavior for comparison; it is not a Phase 5 success claim.
- **Upgrade clarification under A3/A7:** an existing Phase 4 running assessment
  has a durable cursor but no Phase 5 job. After migration it must explicitly
  reattach/resume the same logical finding run under current server authority,
  preserving history and never restoring browser execution. The coordinator
  captured the actual pre-migration fixture: a running assessment at step 0, with
  no Phase 5 job. Namespace `59e5cb99-3d38-40cf-aa48-204e693be4a0` contains logical
  run `assessment-8e2532c8-bdf2-4669-aef9-d2ddd7d25774`. The upgrade/resume result
  remains pending.
- **Baseline completion:** the approved-build browser server is stopped and the
  implementation/build hold is released. The private test cookie file is excluded
  from journal/source inspection and copying. An initial fixture harness used
  native-fetch `status()` incorrectly; corrected capture succeeded. This was a
  harness error, not an application failure.

### Round 2 — Early schema and contract review: changes requested

- **P5-R1 — Relational ownership:** independent review found that proposed
  migration 006 gives `agent_runs.session_id` no namespace-scoped foreign key to
  `demo_sessions`, while the logical `assessmentRunId` exists only in JSON without
  an owned foreign key to `assessment_runs`. The reviewer requested scoped session
  and logical-assessment links plus coherence between run kind and input. Existing
  epoch/conversation/retry/event foreign keys and active-run uniqueness looked
  sound in source inspection. The missing links remain an open finding; schema
  acceptance and migration are pending.
- **P5-R2 — Replaceable policy/contracts:** the service directly hardcodes
  `recommendSurface` and visit policy, while `AgentAdapter`/`StepOutcome` contracts
  live in `demo.ts`. The reviewer requested an independent contract boundary and
  an explicitly replaceable local submit/visit policy hook. No external/network
  operation may occur inside a locked transaction. This is an A1 implementation
  finding, not a request to enable a real provider.
- **Identity mapping accepted:** `runId` identifies one execution attempt,
  `turnId` identifies a logical chat turn, input `assessmentRunId` identifies the
  logical finding run, and the fence identifies a worker lease claim. A redundant
  extra `attemptId` is unnecessary. This interpretation satisfies the distinct
  identities in A2 without multiplying identifiers for the same concept.
- **Disposition:** independent review is **CHANGES REQUESTED** for this bounded
  early pass. Source remains in progress; fixes require inspection and relevant
  evidence before either finding closes. Design acceptance did not approve this
  candidate or authorize migration 006.

### Round 3 — Claim, effect, and result authority: changes requested

- **P5-R3 — Claim-time session expiry:** source inspection found that session
  expiry at claim is sampled before a possible lock wait. Publish already checks
  after locks. Claim must also recheck expiry against the current database clock
  after acquiring locks, so waiting cannot turn an expired session into authority.
- **P5-R4 — Effect/cancellation reconciliation:** cancelling a run while an effect
  outcome is unknown changes its status to cancelled, but the trusted
  reconciliation hook accepts failed runs only and no honest uncertainty error is
  exposed. The reviewer also requested durable dispatch tool identity and
  recoverable arguments/intent, with reconciliation using the recorded tool rather
  than an arbitrary caller-selected `toolName`. Cancellation cannot erase an
  uncertain effect or make its reconciliation unreachable.
- **P5-R5 — Published finding scope:** new finding publication checks `runId` but
  does not validate each finding's `orgId` against captured scope. Extra-scope new
  results must be rejected without changing the historical import policy, which
  preserves previously captured evidence independently of current availability.
- **Disposition:** these are independent source-inspection findings on in-progress
  code. All three are open. The reviewer plans original actual-Neon probes after
  schema acceptance; no runtime failure or passing retest has been claimed yet.

### Round 4 — Snapshot consistency and pre-migration verification

- **P5-R6 — Captured project snapshot:** the reviewer independently confirmed the
  coordinator's source observation: under READ COMMITTED, `readWorkspace` can read
  an older project revision and newer work-item statuses if `work.status` commits
  between those reads. The requested correction locks the selected owned project
  `FOR SHARE` before capturing its snapshot; the existing status command's
  `FOR UPDATE` then serializes the reads and writes. A broader isolation redesign
  is unnecessary. The controlled original concurrency probe is pending; this is
  currently source-inspection evidence.
- **Coordinator pre-migration check:** actual Neon migrations 001–005 match source
  checksums, the original Phase 4 running fixture remains at step 0, and
  `agent_runs` is absent. The client's TLS 1.3 socket is encrypted and its
  certificate authorized. The first harness incorrectly required backend
  `pg_stat_ssl = true`, which describes a different link from the Neon client's
  connection. That harness failure is preserved; the corrected client-socket
  verification passes and does not establish an application defect.
- **Implementation progress:** server service/worker/entry point/route and reported
  R1/R4 corrections are written and the schema was handed to the reviewer. UI,
  client, and permanent tests remain in progress. Reported source completion does
  not close findings or establish runtime/schema approval.

### Round 5 — Source corrections, accepted schema, and live migration

- **Implementer corrections, independently observed:** migration 006 adds the
  namespace-scoped session foreign key and generated owned `assessment_run_id`
  foreign key with null-safe object/kind checks (R1). Independent contracts now own
  `AgentAdapter`, `StepOutcome`, and `AgentPolicy`; synchronous injected submit/
  visit policy owns routing and phrases (R2). Claim rechecks database wall-clock
  expiry after locks (R3). Recorded `effect_tool`/`effect_input` and certainty-shape
  constraints precede dispatch; cancelled unknown outcomes retain
  `reconciliation_required`, and the trusted resolver reads that recorded tool and
  input (R4). New results reject uncaptured org IDs (R5), and selected improvement
  projects use `FOR SHARE` before snapshot capture (R6).
- **Reviewer schema decision:** exact 006 **ACCEPTED for migration**, SHA-256
  `7b22b47f2368605f3c32b088a422e9a034ad7c8f6d7cfa53a75e5a25c512181e`.
  The coordinator verified the digest and applied only 006 to actual Neon `dev`,
  exit 0; repeating the migration command was a no-op, exit 0. Applied 006 is now
  immutable; future schema corrections use 007 or later. This accepts/applies the
  schema, not the runtime behavior or final phase.
- **Validation release:** isolated generated-namespace SQL tests and targeted
  worker-seam checks are released. No background worker or web process is running
  for these checks. The implementer reports `tsc --noEmit` and worker compilation
  passing; client request code is written, with AgentPanel wiring and permanent
  tests still underway. These are reported checks, not independent final evidence.
- **P5-R7 — Effect confirmation/publication race:** the reviewer independently
  confirmed the coordinator's source finding that a write-result transaction sets
  the effect to confirmed but ignores `applyStep = false` from a second lease
  check. This can commit confirmation without publishing the result. The
  transaction must roll back when publication is rejected. A forced-expiry probe
  is planned; runtime reproduction and a corrected recheck remain pending.
- **Disposition:** R1–R6 source fixes are observed, but required runtime evidence
  remains open. R7 is an open source finding. Schema acceptance and a passing
  migration do not close these checks.

### Round 6 — First production candidate and independent Neon execution checks

- **Coordinator candidate 1:** build `myqOB6XIpOS4nOmEhDC9F` passes, including the
  worker compilation. `/tmp/ufd-phase5-neon/candidate1` archives 159 source files
  and 29 worker files. Nine immutable Phase 1–4 journal/prior-migration files match;
  71 client outputs contain zero configured-secret matches. Six production HTTP
  groups pass: replayed receipt, busy/payload conflict, owner/context rejection,
  ordered cursor, rejected public assessment advancement, and cancellation.
- **Actual worker restart:** after a committed lease, the coordinator kills the
  child with SIGKILL and starts a fresh compiled targeted worker. The same turn
  finishes exactly once, with one recovery, fence 1 → 3, and pending/running/
  streaming/completed events. The first harness tried importing an HTTP module
  absent from the worker build before any database write; setup was corrected to
  use actual HTTP. That failure is preserved as a harness failure.
- **Upgrade progress:** inspection verifies the original Phase 4 running cursor,
  logical run identity, and step 0 remain intact with no Phase 5 job yet.
  Attachment/resume verification is running; inspection alone does not prove it.
- **Reviewer independent lifecycle:** seven actual-Neon groups pass on Node
  22.23.2, using the configured pooled development connection and generated
  namespaces that are cleaned afterward. Coverage includes lost ACK/dedup/payload
  conflict/busy, foreign observe/cancel, late cancelled completion, reclaimed
  lease fencing/cursor, after-lock session expiry (R3), revocation at publish,
  reset isolation, and alternate-adapter failure with same-turn retry.
- **Reviewer independent effects:** four groups pass after correcting a fixture
  authorizer's order-sensitive `JSON.stringify` equality to structural equality
  after the JSONB round trip. The original run had two passing and two failing
  groups and is retained. The unchanged assertions now verify R4 cancelled unknown
  outcomes and trusted resolution; actual child SIGKILL after fake effect dispatch
  before ACK with no redispatch/retry and successful trusted reconciliation;
  denied/unknown tools with zero execution; and R7 forced expiry between certainty
  update and second lease validation rolling confirmation back. The initial two
  errors are confirmed harness defects, not product defects.
- **Remaining review:** six schema/assessment families are running. Reviewer
  Chromium navigation/motion/surface-context checks target candidate 1's exact
  runtime. Explicit finding closure and final approval remain pending.

### Candidate 2 preparation — Client buffering and acknowledgement corrections

- **Implementer-discovered corrections:** initially blocked `sessionStorage`
  reads now permit memory-only requests without overwriting an unread older
  buffer. Successful manual lost-ACK retry publishes its acknowledged command/
  receipt so original unchanged composer text can clear. A new permanent test
  covers blocked-read/no-write behavior; the retry test verifies ACK identity.
- **Reported checks:** new agent pure suite 6/6, all prior 92 tests, and permanent
  actual-Neon agent SQL 4/4 pass. The prior nine SQL tests are rerunning. Initial
  lint failures involved generated `.worker` CommonJS imports and a render-time
  ref assignment; generated output is excluded and the navigation guard write
  moved into a layout effect. A final lint result has not yet been reported here.
- **Candidate boundary:** these source fixes postdate candidate 1 and require a
  candidate 2 production build. Candidate 1 runtime artifacts are unchanged. The
  scribe does not count tests against different candidates as final acceptance or
  close reviewer findings based only on implementer reports.

### Round 7 — Explicit closures and stale read-tool dispatch finding

- **Reviewer dispositions:** close R1 (actual SQL scoped session/logical-run/kind
  and uniqueness rejection), R2 (alternate policy persists a different
  recommendation and visit), R3 (after-lock expiry), R4 (cancelled uncertainty and
  actual SIGKILL/reconcile), R5 (extra-scope new finding rejection), and R7 (forced
  lease loss rolls certainty back). These closures apply to the tested server
  source; final candidate reconciliation is still required.
- **R6 still pending:** the controlled snapshot group failed an assertion. The
  reviewer is distinguishing a probe problem from a product failure; no conclusion
  or closure is inferred from the source fix.
- **P5-R8 — Stale read-tool dispatch:** two original actual-Neon probes fail:
  cancellation or persona transition while the adapter is delayed still permits
  the resulting read tool to execute. The reviewer requests an authority recheck
  before dispatch, including non-writing tools. Preventing late publication alone
  is insufficient when cancelled work can still invoke a tool.
- **Candidate 1 browsers:** independent navigation six groups and motion three
  groups pass. The surface-context journey first failed a pre-acknowledgement
  timing assertion; the original is retained and recheck is pending. These results
  concern candidate 1, without newer client fixes.

### Round 8 — Client recovery and navigation authority

- **P5-R9 — Request recovery:** independent source review identifies successful
  observer refresh leaving an earlier read error visible, malformed restored
  requests blocking an empty queue without usable recovery, and definitively
  rejected commands remaining queued and preventing later operations. These paths
  need distinct truthful recovery without discarding an uncertain accepted
  command. The scribe assigned R9 at the reviewer's request to avoid ID collisions.
- **P5-R10 — Late recommendation navigation:** the post-ACK guard compares only
  session/target/path/home request values, missing same-context canvas/search
  navigation and an away/back sequence that restores the same values. The reviewer
  requests a monotonic navigation intent token owned by `NavigationController`.
  The coordinator is preparing a production reproduction; this is initially a
  source finding.
- **Implementer-reported corrections:** R8 adds fresh fenced authority before read
  tool execution and keeps nonterminal write outcomes unknown. R9 separates
  definitive rejection, read-error recovery, and uncertain same-ID retry, with
  local export/exact-byte discard for malformed saved bytes; changed bytes refuse
  deletion. R10 introduces controller-owned `captureIntent`, invalidated by
  deliberate same-context/changed/history/away-back navigation but not route ACK,
  and checks it after submit ACK. All require independent recheck.
- **Validation status:** new permanent client/navigation regression tests are
  running in a ten-group pure suite. TypeScript passed before the last navigation
  change and is rerunning. These fixes require the next production build;
  candidate 1 outputs remain unchanged.
- **Scribe:** updated README from implemented source with worker startup/rebuild,
  server conversation ownership versus unsent page-memory drafts, execution and
  recovery boundaries, test commands, local/Heroku process definitions, and actual
  capacity limits. Final acceptance and hosted verification remain pending.

### Round 9 — Snapshot/dispatch closure and upgrade completion

- **R6 closed by reviewer:** a deterministic actual-Neon statement barrier pauses
  capture after project revision is read. The competing `work.status` reaches the
  project lock but cannot settle until capture exits. Captured data is revision 1/
  todo, followed by current revision 2/done. The failed earlier indirect activity
  observations required a better harness, not product changes. The first five
  schema/assessment groups pass separately; this focused probe provides the sixth.
- **R8 closed by reviewer:** both original actual-Neon delayed-read-tool dispatch
  probes pass after the fresh fenced authority check. The original failures remain
  archived. R1–R8 were closed at this point against the reviewed server source;
  the later R7 subcase below has its own failure and retest history.
- **R9 module evidence:** four independent client/source probe groups pass:
  recovered read errors; definitive-rejection versus unknown-outcome queues;
  malformed original bytes/export/changed-source guard/discard; and blocked
  storage with memory-only ACK. Full UI closure remains pending.
- **Upgrade complete:** coordinator inspect/attach/complete checks all pass against
  actual Neon. The original logical assessment is retained and finishes with four
  findings. Retained API boundary coverage also passes eight groups on candidate 1.
- **Candidate 1 surface-context recheck:** all five groups pass after waiting for
  the exact server acknowledgement of the original visit. Its original pre-ACK
  assertion is preserved; the successful recheck keeps that assertion. Candidate 1
  navigation six and motion three groups also remain passing evidence.

### Round 10 — Candidate 2, publication races, and repeated acknowledgement

- **Coordinator candidate 2:** build `F55O5LR3JP0qw83v6R0vw` passes; 138 runtime
  files remain identical across the build. The archive contains 162 source and 30
  worker outputs, nine immutable files match, and 71 client outputs have zero
  configured-secret matches. Five agent-lifecycle production-browser records pass
  with errors `[]`. Independent navigation six, motion three, and surface-context
  five groups all pass with errors `[]`; candidate 1 copies remain archived.
- **R7 reopened for malformed write results:** implementer/root/reviewer audit
  finds that malformed completed output from a write tool can commit
  `effect_state = confirmed` while result validation records failure with
  `effects = none`. This violates the existing certainty/result invariant.
- **P5-R11 — Final publication expiry:** a lease can expire during earlier
  transcript/business writes after the initial guard, while the final publication
  update still commits. The original two-case probe runs against copied immutable
  candidate 2 source so later edits cannot erase the failure. Both cases fail
  (0/2): malformed write output is confirmed and expired-lease publication commits.
- **Correction and explicit closure:** apply/validate the result while the effect
  remains unknown, then confirm only an actually completed row. The final
  publication update predicates live lease/fence/session/epoch and throws on zero
  rows, rolling back previous transcript/findings writes. The original actual-Neon
  probe now passes 2/2; the reviewer closes the R7 extension and R11 against current
  source. Earlier R7 scheduling must follow the new apply-before-confirm order
  while retaining the same no-confirmation-without-usable-result invariant.
- **P5-R12 — Repeated ACK clears a new draft:** candidate 2's client recovery
  browser first passes raw Unicode export, changed-source discard rejection, and
  recovery, then independently reproduces an old acknowledgement clearing newly
  typed identical text. The implementer reports processing each ACK object once
  so observer polls cannot clear that later draft. Original failure is retained;
  candidate 3 production recheck is pending.
- **R10 harness correction:** restoring correct starter policy meant the previous
  arbitrary text no longer generated a recommendation. The coordinator replaced
  it with the exact preexisting starter prompt and asserts actual
  `receipt.destination = build` before checking navigation. The earlier harness
  failure is archived separately; corrected R10 production retest is running.
- **Additional checks/scope:** six implementer agent SQL groups pass in the
  existing log; two new permanent publication regressions bring the next run to
  eight, currently pending. Last reported type/lint pass retains the inherited
  stylesheet warning. Independent final pure/type/lint checks are running. The
  reviewer is resolving whether assessment write tools must be denied because the
  reconciliation hook supports chat outcomes; no deferral or unsupported
  assessment-effect promise is accepted.
- **Candidate boundary:** publication and repeated-ACK fixes postdate candidate 2.
  Its runtime output remains frozen; a new build and appropriate rechecks are
  required before final approval.

### Accepted assessment-tool boundary

- **Implementer/reviewer/coordinator agreement:** assessments accept read-only
  tools only, enforced before dispatch even for injected registries. Fake
  potentially writing tools and effect reconciliation are tested through chat;
  the production registry remains read-only `demo.context`, with no real
  provider/private-resource integration or enabled product writes.
- **Required check:** the permanent denial regression requires zero tool calls,
  `tool_denied` with `effects = none`, and paused assessment cursor. The agent SQL
  suite now contains nine groups; its result remains pending. This records the
  actual supported boundary rather than silently claiming assessment write
  reconciliation that was not implemented.

### Round 11 — Trailing Today must capture the last acknowledged changes

- **P5-R13 — Stale briefing at navigation:** coordinator/reviewer/implementer
  confirm that worker-only Today refresh misses acknowledged draft/pause/status
  changes before navigation appends the next entry. The current trailing Today
  must refresh from the server snapshot before append, then remain immutable once
  historical. Refreshing older entries would violate retained history guarantees.
- **Implementer correction:** `src/lib/server/agent.ts` refreshes only trailing
  `Today.assessment` from the already workspace-locked acknowledged snapshot before
  visit/send appends. A permanent regression creates/edits a draft, navigates,
  verifies the latest acknowledged name froze, edits again, and verifies the older
  history is unchanged. Reviewer original candidate 2/fixed Neon probes are
  forthcoming; source correction is not closure.
- **Reported suite status:** base eight agent SQL groups and the read-only denial
  group pass; the new historical Today group brings the suite to ten distinct
  groups and is still running. No compiled output changed; candidate 3 has not
  been built from these final source changes yet.

### Round 12 — Candidate 3, retained scope, and failed final SQL run

- **Candidate 3:** coordinator build `MjylKXKeIArclIiPokWTG` succeeds and is
  archived under `/tmp/ufd-phase5-neon/candidate3`. All 138 runtime files remain
  identical across build; the archive contains 162 source and 30 worker outputs.
  Nine historical journal/prior-migration files remain unchanged and 71 client
  outputs have zero configured-secret matches. A passing build is not phase
  approval.
- **R10 corrected browser:** the exact starter prompt produces an actual Build
  recommendation receipt, while its delayed ACK cannot replace newer same-path
  Code/`opportunity-handler` canvas navigation. The result contains one passing
  record and errors `[]`. The prior prompt-policy harness failure remains separate.
- **R13 original and retest:** original actual-Neon history probe fails because
  the historical snapshot omits the last acknowledged draft name. The corrected
  probe passes in 23.480 seconds, showing the latest acknowledged draft freezes
  when navigation appends history. Exact reviewer closure/final-candidate
  reconciliation remain to be recorded.
- **P5-R14 — Retained assessment scope:** the original probe finds a legacy
  assessment with unavailable scope still `running` rather than safely `paused`.
  The corrected combined running/paused retained-scope probe passes in 18.299
  seconds without attaching a worker. Reviewer confirmation of the exact covered
  matrix and disposition is pending; a combined label is not treated as broader
  evidence than the actual cases executed.
- **Latest full SQL attempt:** `/tmp/ufd-phase5-final-agent-sql-quiet.log` passes
  nine of eleven tests. Tests 10 (trailing Today) and 11 (legacy unavailable scope)
  fail with `Connection terminated due to connection timeout`; the cleanup hook
  also times out. The log reports post-test asynchronous connection termination
  activity. Earlier focused passes for these behaviors do not turn this failed
  suite into success. Original output is preserved without assuming contention,
  product fault, or provider fault as the cause.
- **Coordination and remaining gates:** implementer diagnoses alone; reviewer and
  coordinator pause DB work. Final candidate client R12/planning/tabs/import/
  buffer/crash and official-worker lifetime checks remain pending. No approval or
  weakening of A1–A8 is inferred from candidate 3 compilation.
- **Coordinator status:** latest unit total 102 and build pass; no repeated Neon
  setup is needed from the user. A production parity harness is prepared to verify
  the approved baseline's exact recommendation, CRM/main/UAT reply, and Today/
  message chronology through the real worker. It has not run yet.

### Round 13 — Explicit history/navigation closure and independent final checks

- **R10 explicitly closed:** the reviewer inspected the production script and
  passing result. It requires an actual Build recommendation, holds the committed
  ACK, selects a different same-path Code work canvas, and verifies the exact URL
  survives both ACK and completion with accessible Cancel/Completed state and the
  actual reply visible. Candidate 3 controller/provider/presentation source
  matches; pure navigation tests also cover away/back invalidation.
- **R13 explicitly closed:** the original candidate 2 missing acknowledged draft
  failure and fixed actual-Neon pass demonstrate latest acknowledged draft content
  freezing before append, plus deep equality of the older Today after later edits
  and another Today entry.
- **R14 explicitly closed, exact independent cases:** running `['removed-org']`,
  paused `['prod', 'scratch-hotfix']` (accessible plus known unavailable fixture),
  and running `[]`. Each preserves exact scope, logical IDs, and history, pauses
  with no execution job, and then permits an explicit `['prod']` rescan producing
  a new logical run/job while preserving the original. The independent mixed case
  is not an unknown identifier; the permanent suite separately uses
  `['prod', 'unknown-org']`.
- **Independent assessment write denial passes:** zero tool execution and effect
  journal, `tool_denied`/`effects = none`, and paused assessment. This verifies the
  accepted read-only boundary rather than adding a scope waiver.
- **Candidate 3 reconciliation:** reviewer runtime 138 and worker 30 hashes match;
  source 162 differs only in the evolving plan/journal, independently confirmed by
  the coordinator. TypeScript with `--noEmit --incremental=false` and lint exit 0;
  one inherited layout stylesheet warning remains. Retained 92/92 and agent 10/10
  pass independently with zero skips.
- **Pure-suite harness history:** the first combined invocation incorrectly
  applied `--conditions=react-server` to the retained browser-render persistence
  suite and caused a module-load failure (82 pass, one failed suite). Original log
  is retained. Running retained suites and agent suites with their documented
  separate flags passes without changing source or assertions and without DB work.
- **Retained browser evidence:** candidate 2 navigation six, motion three, and
  surface-context five groups remain accepted for unchanged controller/provider
  source. Final coordinator UI checks exercise the newer AgentPanel ACK changes.

### Round 14 — SQL stability evidence, successful sequential rerun, and R12 extension

- **Diagnosis facts:** unchanged candidate 3 Postgres wrapper completes 40/40
  transactions through one pooled connection with zero errors over approximately
  94 seconds. Exact journal-owned cleanup removes 12/12 recorded namespaces.
  Reviewer traces the earlier timeout to new-connection establishment rather than
  blocked SQL; its underlying cause remains unresolved. No reviewer database
  cancel/terminate operation or induced downtime occurred. The earlier fake-effect
  child SIGKILL happened long before the connection failures.
- **Full sequential rerun passes:** agent 11/11 in 108.3 seconds, then retained
  application SQL 9/9 in 94.2 seconds, both exit 0 with successful cleanup hooks
  and empty generated namespace journals. Runtime source is unchanged. Earlier
  failure logs remain preserved; no speculative fix or claim about their root
  cause accompanies the 20/20 result.
- **R12 additional source-confirmed path:** ACK subscription clears the original
  composer, but `send()` performs a second equality-based clear after AgentClient's
  awaited refresh. Identical text newly typed between the first clear and delayed
  GET completion can therefore be erased by the older continuation. This remains
  the same finding, not a newly waived edge case. Coordinator is reproducing it
  against candidate 3 before a bounded fix and candidate 4 build.
- **Remaining approval gate:** final candidate 4 client/planning/tabs/import/
  buffer/crash/official-worker lifetime and parity evidence, R9/R12 closure, source
  reconciliation, and documentation. No final approval is issued.

### Round 15 — R12 production reproduction and candidate 4 correction

- **Original candidate 3 failure:** the coordinator holds the explicit post-ACK
  GET, observes the first composer clear, types identical new text, and releases
  the GET; the old `send()` continuation erases the new draft. The result is a
  product assertion failure with browser errors `[]`, independently confirmed by
  reviewer inspection of the harness and failure artifact.
- **Bounded correction:** remove the duplicate post-await `setDrafts` and unused
  `submittedSession` from `AgentPanel.tsx`. The existing ACK subscription becomes
  the sole clearing owner. The reviewer accepts this exact minimal source patch;
  only AgentPanel differs from candidate 3, with no SQL/server/worker change.
- **Checks and candidate boundary:** Node 22 full TypeScript
  `--noEmit --incremental=false`, targeted AgentPanel lint, and `git diff --check`
  pass. Source is frozen and candidate 4 build is running. The reviewer accepts
  reuse of the unchanged-module 102 pure and 20 SQL checks. The original race
  probe and full client recovery must pass against candidate 4 before R12 closes;
  source acceptance alone does not satisfy that gate.
- **Candidate 4 build/reconciliation completes:** build
  `jFxsh96G7jjb9NasAtKyI` passes. Independent runtime 138 and compiled worker 30
  hashes match the archive; source 162 differs only in evolving plan/journal.
  The sole candidate 3 → 4 runtime difference is the reviewed AgentPanel removal,
  supporting reuse of unchanged SQL/pure/server/effect evidence. Final browsers
  are running.

### Round 16 — All findings closed; final client and retained-browser progress

- **R9/R12 explicitly closed:** reviewer independently inspects candidate 4's
  passing original held-post-ACK-GET race (one record, errors `[]`) and full client
  recovery (three records, errors `[]`). Recovery covers exact Unicode export,
  changed-source discard protection, repeated-ACK identical new draft retention,
  and blocked-storage ACK. The independent client 4/4 additionally verifies
  read-error recovery and definitive-rejection versus uncertain-ID handling.
  Candidate 2/3 original product failures remain preserved. All R1–R14 are closed;
  this does not waive remaining phase validation.
- **Candidate 4 independent checks:** full TypeScript and ESLint exit 0; only the
  inherited layout stylesheet warning remains. Source stays unchanged.
- **Lost-ACK reload browser:** one record passes with errors `[]`. The initial
  exact-text locator omitted the button text inside the same alert; a locator-only
  correction preserves the assertions and original failure artifact.
- **Planning-history harness diagnosis:** the original candidate 4 journey fails
  while Playwright's fill has bound an older disabled historical input before the
  newer article becomes accessible. Actual failure DOM shows agent idle, latest
  Today visible/not inert/enabled, historical Today disabled. The reviewer
  reproduces this locator binding in an isolated Chromium `setContent` fixture,
  independently accepts the diagnosis, and approves waiting for the second
  accessible article before the unchanged product assertions. Both original
  failures and DOM/isolated evidence are retained. No application edit or new
  finding is made.
- **Remaining work:** corrected full planning journey and retained import browser
  are running. Other final browser/lifetime/parity checks and final documentation
  review remain pending; no phase approval is issued.

### Round 17 — Retained planning exposes a real revision conflict

- **P5-R15 — Unrelated worker revision blocks captured-draft creation:** the
  planning journey with accepted accessibility-readiness wait passes its first two
  history/rescan assertions, then actual `project.create` returns 409 while the
  rescan worker progresses. The implementer confirms the generic
  `before.assessmentRevision` guard rejects creation even though the separately
  checked captured `draftId` and `draftRevision` are unchanged. Worker progress
  advances the broader assessment revision without changing that draft.
- **Disposition:** this is a product finding distinct from the resolved locator
  harness problem. R15 is open. Reviewer/implementer are agreeing a bounded
  correction and checking draft-edit concurrency; no source edit or passing retest
  is claimed at this point. The original production conflict is preserved.
- **Independent progress:** candidate 4 import/durability passes seven records,
  errors `[]`. Agent-lifecycle and buffer suites are running in their own
  namespaces. Prior R1–R14 closures remain recorded, but the new finding prevents
  final phase acceptance until resolved.

### Round 18 — R15 revision ownership agreement and original/fixed regression

- **Ratified design:** `assessmentRevision` remains the optimistic concurrency
  token for interactive application commands. Autonomous worker progress,
  completion, and failure preserve it; ordered run/event sequence and fencing
  represent execution progress. Existing exact user-command guards, receipts,
  `draftId`, and `draftRevision` checks remain. Explicit cancel/retry/rescan and
  session transitions retain applicable increments. No schema or API change is
  needed.
- **Independent import audit:** preview summarizes the exact source only. Commit
  locks and uses latest state, preserves non-idle current cursor and draft, adds
  historical records, and rejects unequal stable-JSON identity collisions without
  deleting history. Required regression coverage includes import during worker
  progress and rejection of true concurrent human edits.
- **Original permanent SQL:** the new focused group reproduces revision 9 versus
  expected 8 on unchanged candidate 4 runtime after 67.5 seconds; cleanup succeeds.
  This is a real product assertion failure, not a harness defect. An earlier
  no-output suspicion is superseded by this completed result.
- **Correction:** only `agent-worker.ts` runtime behavior changes to preserve the
  command token during autonomous progress/completion/failure; the contracts
  comment documents that ownership. The focused fixed SQL passes 1/1 in 139.3
  seconds, exit 0 with successful cleanup, covering the requested concurrency
  branches. This is implementer evidence; independent original/fixed review is
  underway before closure.
- **Client regression/checks:** the permanent RemoteWorkspaceStore test verifies
  adoption of changed saved snapshots with the same command token. Application
  suite 16/16 passes. Full typecheck, targeted lint, and diff check pass. Runtime
  source is frozen; candidate 5 is building. Reviewer owns the independent DB
  window, then implementer runs final agent 12 and retained SQL 9 sequentially.
- **Independent original R15 evidence:** the reviewer's unmodified two-case probe
  against archived candidate 4 fails 0/2, exit 1: worker-only progress rejects a
  captured draft edit, and worker completion rejects an exact-source import
  command. Cleanup leaves its private namespace journal empty. The same script
  runs against corrected source next; independent runtime closure is pending.
  Independent pure checks now pass retained 93 plus agent 10, total **103**, with
  exit 0/zero skips; the added same-token refresh regression increases the prior
  total of 102 by one.
- **Retained production progress:** candidate 4 exact baseline parity three,
  agent-lifecycle five, import/durability seven, and buffer/session four records
  pass with errors `[]`. Root stops its web/browser/worker processes for the R15
  quiet SQL window. Final candidate planning/tabs/crash/official-worker lifetime
  checks remain pending.
- **Candidate 5 build completes:** `B6mRZa2zvMpCjUePkQHZE`, archived at
  `/tmp/ufd-phase5-neon/candidate5`; 138 runtime files stable across build, 162
  source/30 worker files, nine immutable historical files, 71 client outputs and
  zero configured-secret matches. Coordinator has not started this runtime while
  reviewer/final SQL work owns the database. Remaining production families are
  full planning/history, two-tab assessment, actual worker kill/restart from this
  artifact, and standalone `npm run worker` completion with browser closed/web
  down followed by a new-browser check.

### Round 19 — Independent R15 closure and final planning pass

- **R15 explicitly closed by reviewer:** identical independent two-group probes
  fail against archived candidate 4 (0/2 real conflicts) and pass against frozen
  candidate 5 (2/2, exit 0; 122.778s and 36.128s), with exact cleanup complete.
  The scribe verified the original/fixed result and log filenames on disk.
- **Captured-draft assertions:** draft edit and project creation succeed while a
  rescan still runs; the original project's finding snapshot and newer assessment
  cursor remain intact. Stale human draft edits and stale captured-draft creation
  still return 409. Worker completion preserves the project; pause across progress
  and failure preserves the correct command token and resumes the same logical
  assessment.
- **Import assertions:** read-only source preview followed by worker completion
  and import preserves current cursor/findings. Divergent same-ID history returns
  409, and a human rescan still invalidates a stale import. This verifies that R15
  changes autonomous execution ownership without weakening user-command guards.
- **Full candidate 5 planning/history:** four records pass, errors `[]`, through
  the real targeted worker. Original semantic assertions remain: frozen historical
  draft, rescan origin, creation during scan, status failure/retry/reload, and a
  recurring finding creating a separate plan with distinct IDs. Only the
  independently accepted accessible-article readiness wait changed the harness.
- **Remaining gates:** final permanent agent SQL is 5/12 passing with no errors
  reported, followed by retained SQL 9; it is still running. Two-tab assessment is
  running next, with final-worker crash and standalone lifetime queued. All fifteen
  source findings are closed; final phase approval remains pending.

### Round 20 — Final SQL passes; two-tab Pause exposes R16

- **Final candidate 5 SQL:** agent12/12 in 163.1 seconds and retained9/9 in 94.8
  seconds pass, exit 0, zero skips, successful cleanup hooks, empty exact generated
  namespace journals, and no transport failures. Reviewer reads both final logs.
  Independent immutability check confirms all nine Phase 1–4 journal/migration
  files remain byte-identical and applied 006 retains its accepted SHA-256.
- **Initial two-tab sampling issue:** application and agent state are read
  sequentially; the old readiness check could accept a later run while the earlier
  application snapshot still lacked its logical ID. Reviewer accepts a stricter
  readiness precondition requiring non-null application `currentRunId` and matching
  run `assessmentRunId` before unchanged assertions. The exact original startup
  cause remains inferred; the initial sampling failure is preserved separately.
- **P5-R16 — No-op join invalidates Pause:** after valid matching IDs, both tabs
  see one pending assessment at step 0. Second-tab automatic start/join then causes
  first-tab Pause to return 409 with saved-version-changed, while no worker ran.
  Reviewer confirms source returns an identical domain object for an already
  running `assessment.start`, but the application still increments
  `assessmentRevision`. With no new run/event to trigger refresh, the first tab
  retains a stale token.
- **Proposed bounded correction:** write/increment only when domain state changes,
  while always synchronizing execution and recording the command receipt. This
  must preserve legacy running/no-job attachment and every existing revision guard.
  Root/implementer are reviewing it; source correction and runtime recheck remain
  pending. R16 is a product finding, not the initial sampling harness issue.
- **Operational checks:** coordinator runs the final compiled chat-worker SIGKILL
  proof while the application correction is diagnosed; the global worker remains
  off. A pre-run standalone-lifetime harness declaration typo was caught before
  execution and requires a harness-only correction, with no product finding.

### R16 design agreement and final compiled-worker crash proof

- **Ratified server correction:** identical/no-op domain state keeps the current
  command token, while execution synchronization and receipt persistence always
  occur. Legacy running/no-job attachment remains supported and true user changes
  retain conflict guards.
- **Ratified client queue correction:** only an unsent same-aggregate tail may
  subtract one optimistic revision after a confirmed head ACK reports an unchanged
  token. Head removal and fresh-load adoption occur atomically. An uncertain head
  is never changed, and this is not a blanket rebase against any newer snapshot.
  Original/fixed SQL and queue regression evidence remain pending.
- **Candidate 5 compiled worker:** actual SIGKILL after a committed live lease and
  restart preserve run/turn identity, recover exactly once, advance fence 1 → 3,
  and produce one completion event. Two records pass. The harness's claim wait
  budget increases from six to twenty seconds while separately requiring a live
  lease before kill; no tested invariant is weakened.
- **Coordination:** root stops its server and leaves the DB quiet for R16
  diagnosis/tests. No R16 closure or final phase approval is issued.

### Round 21 — R16 original/fixed SQL, queue integrity, and final two-tab closure

- **Implementation:** `server/application.ts` skips business write/token increment
  for identical reducer state but always synchronizes execution and records the
  receipt. `application/remote-store.ts` corrects only unsent same-aggregate tail
  predictions once, atomically with confirmed head ACK, fresh-load adoption, head
  removal, and persistence. Other aggregates, uncertain head identity, and genuine
  human conflicts remain protected.
- **Independent original/fixed SQL:** archived candidate 5 fails both original
  cases (0/2): captured Pause conflicts after another join, and legacy attachment
  increments token 2 versus expected 1. The identical probe on corrected source
  passes 2/2, exit 0, in 10.702s/5.398s; exact cleanup journals are empty.
- **Independent queue 4/4:** queued Pause with unrelated aggregate retained;
  restored lost-ACK exact head with one tail correction; true human mutation still
  conflicts; failed post-ACK fresh load leaves queue unchanged until retry.
  Implementer application17/17 and independent final pure94+agent10=104 pass.
  An implementer combined invocation again misapplied react-server to the browser
  SSR suite; its preserved module-load failure is corrected by documented separate
  flags without source/assertion changes.
- **Candidate 6:** build `15T7t4qKdNxu-Q1IMvqKh`, runtime138/source162/worker30
  reconciliation, nine immutable files, client71/zero secret matches. Only server
  application and remote store runtime differ from candidate 5; all 30 worker
  outputs match byte-for-byte, retaining final compiled-worker SIGKILL evidence.
  Independent full TypeScript and ESLint pass with the inherited stylesheet
  warning.
- **R16 explicitly closed:** reviewer inspects the original production two-tab
  script and candidate 6 result: three records pass/errors `[]`, one pending logical
  and execution run across tabs, first-tab Pause/second-tab Resume keeps logical
  identity and creates a linked attempt, both see completed findings, and zero
  browser advancement. The stronger matching-ID startup readiness retains all
  original assertions.
- **Remaining gates:** all R1–R16 are closed. Full candidate 6 planning is running,
  permanent agent13/retained9 is running without reported errors, and official
  worker browser-closed/web-down lifetime remains pending. No phase approval is
  issued.

### Final candidate 6 planning and lifetime preparation

- Full planning/history passes four records/errors `[]` against candidate 6,
  retaining original semantics with the accepted readiness wait. The build-specific
  log distinguishes this rerun from the earlier candidate 5 pass.
- Candidate 6 agent SQL13/13 passes in 164.7 seconds, exit 0 with successful
  cleanup and empty exact journal; R16 group passes in 10.33 seconds. RetainedSQL9
  runs next. The combined final22 result is not yet complete.
- Lifetime preparation passes one record/errors `[]`: the accepted turn is saved
  pending before browser closure. Its private browser state remains mode0600 and
  is not copied to documentation. Web is stopped; the official `npm run worker`
  starts only after SQL finishes, followed by web restart and a new-browser
  verification. Preparation does not yet prove browser-closed/web-down completion.

### Final SQL22 completion and official worker observation

- Candidate 6 agent13/13 (164.7s) and retained application9/9 (121.4s) pass,
  both exit0 with successful cleanup hooks, empty exact namespace journals, and no
  transport errors. These are the completed final SQL22 results, separate from
  earlier failed attempts. Source remains frozen.
- After all SQL work stops, root starts the official `npm run worker`. Browser
  and web process remain closed/stopped while the lifetime observer runs. Actual
  completion and new-browser verification are still pending. No phase approval is
  inferred from worker startup.

### Final runtime acceptance and documentation handoff

- **Official lifetime pass:** the normal, unmodified `npm run worker` completes
  acknowledged run `af9f977b-2577-449b-8720-0017e8befb3e` / turn
  `e73ce726-418f-4cdc-8293-d38596c4c949` while browser is closed and web is stopped.
  The observer requires actual web `ECONNREFUSED`, verifies the same turn/result
  and one completion event, and records pending → running → streaming → completed.
  Worker stops gracefully, exit 0. After the same candidate 6 web restarts, a new
  browser verifies identical completed turn and one user message (one record,
  errors `[]`). Preparation also passes one record/errors `[]`.
- **Independent reviewer:** inspects the lifetime scripts/artifacts and accepts
  all runtime A1–A7 evidence. Final reconciliation finds runtime138 and worker30
  unchanged; only README/plan/Phase 5 journal differ. The scribe separately
  rechecks all Phase 1–4 journal hashes and README whitespace with no changes/errors.
- **Handoff:** all test browser/web/worker processes are stopped. No in-phase
  runtime work or finding remains. Current documentation is ready for the final
  A8 read; explicit whole-phase approval has not yet been issued. No Phase 6,
  commit, deployment, or real integration begins from this handoff.

## Findings and dispositions

| ID | Finding | Required disposition | Status / independent evidence |
| --- | --- | --- | --- |
| P5-R1 | Migration 006 lacks namespace-scoped run/session and owned logical-assessment foreign keys; kind/input coherence is not enforced sufficiently. | Add scoped relational links and kind/input coherence, then independently inspect and test their rejection behavior. | Closed by reviewer: actual SQL scoped session/logical-run/kind and uniqueness guards pass; final candidate reconciliation accepted. |
| P5-R2 | Service hardcodes recommendation/visit policy and adapter contracts reside in the demo implementation. | Move contracts to an independent boundary and expose a replaceable local submit/visit policy hook; keep external calls outside locked transactions. | Closed by reviewer: alternate policy persists different recommendation/visit through the same service; final candidate reconciliation accepted. |
| P5-R3 | Claim samples session expiry before a possible lock wait. | Recheck current database-clock expiry after claim locks, matching publish authority. | Closed by reviewer: independent actual-Neon after-lock expiry passes in lifecycle 7/7; final candidate reconciliation accepted. |
| P5-R4 | Mid-effect cancellation makes unknown outcomes unreachable to a failed-only reconciliation hook; dispatch identity/intent is not durably bound to the tool being reconciled. | Preserve honest uncertainty and a usable reconciliation path after cancellation; persist tool/arguments or recoverable intent and reconcile the recorded tool. | Closed by reviewer: effects 4/4 include cancelled unknown outcome, recorded tool resolution, and child SIGKILL/no redispatch; final candidate reconciliation accepted. |
| P5-R5 | New finding publication validates run identity but not finding org membership in captured scope. | Reject extra-scope new results while preserving historical import semantics. | Closed by reviewer: actual-Neon extra-scope new finding rejection passes; final candidate reconciliation accepted. |
| P5-R6 | READ COMMITTED snapshot capture can combine an old project revision with newer work-item statuses across a concurrent `work.status` commit. | Lock the selected owned project `FOR SHARE` before reading the captured snapshot, serializing with the existing status command lock. | Closed by reviewer: deterministic actual-Neon statement barrier proves rev1/todo capture precedes rev2/done update. Initial observer failure was harness-only; final candidate reconciliation accepted. |
| P5-R7 | A write-result transaction can commit confirmation without publication; later audit also finds malformed completed tool output can be confirmed despite invalid result. | Keep certainty unknown during validation/publication and confirm only usable completed output; roll back rejected publication. | Closed, reopened for malformed-output subcase, then explicitly reclosed after original candidate 2 failure and fixed actual-Neon 2/2 retest. Final candidate reconciliation accepted. |
| P5-R8 | A delayed adapter can dispatch a read tool after cancellation or persona transition. | Revalidate current run/session/lease authority immediately before dispatch, including read tools. | Closed by reviewer: original actual-Neon probes now 2/2 pass; original failures retained. Final candidate reconciliation accepted. |
| P5-R9 | Client observer errors, malformed restored requests, and definitive rejections lack distinct usable recovery, potentially blocking later requests. | Clear recovered read errors; preserve uncertain same-ID requests; release definitive rejections without losing draft; expose reviewed malformed-byte export/discard recovery. | Closed by reviewer: independent client 4/4 plus candidate 4 full recovery 3/errors `[]` verifies exact Unicode/export/discard guards and blocked storage. |
| P5-R10 | Value-based post-ACK recommendation guard misses same-context canvas/search navigation and away/back intent changes. | Use controller-owned monotonic navigation intent, checked after ACK, so later intent prevents stale navigation. | Closed by reviewer after independent harness inspection: actual Build recommendation cannot replace later same-path Code canvas through ACK/completion; candidate 3 unchanged source reconciles, pure ABA tests pass. |
| P5-R11 | Lease expiry during prior business/transcript writes can still permit final publication after the initial guard. | Predicate final publication on live lease/fence/session/epoch; rollback all writes when it affects zero rows. | Closed by reviewer: immutable candidate 2 original failure, corrected original actual-Neon publication probe 2/2 passes. Final candidate reconciliation accepted. |
| P5-R12 | Reprocessed ACK can clear retyped identical text; after that fix, `send()` still repeats a clear after delayed refresh and can erase a newer identical draft. | Use one acknowledgement-driven clearing owner that preserves later edits; verify observer-poll and delayed-refresh cases. | Closed by reviewer: candidate 2/3 originals reproduced; candidate 4 exact held-GET race 1 and full recovery 3 pass/errors `[]` after sole ACK clearing owner. |
| P5-R13 | Worker-only trailing Today refresh misses acknowledged draft/pause/status changes before navigation makes the entry historical. | Refresh only current trailing Today from locked server snapshot before visit/send appends, then preserve older history. | Closed by reviewer: original failure, corrected 23.480s actual-Neon pass with older Today deep-equal; final sequential permanent SQL also passes. |
| P5-R14 | A retained running assessment with unavailable captured scope can remain running rather than pause before worker attachment. | Preserve historical scope and records, pause unsupported current execution without attaching a job, and verify actual supported legacy-state cases. | Closed by reviewer: exact running unknown/paused known-unavailable mixed/running empty matrix passes with preserved history and explicit rescan; permanent mixed-unknown case also passes in final SQL. |
| P5-R15 | Unrelated rescan worker progress increments global assessment revision and causes project creation to return 409 despite unchanged captured draft identity/revision. | Keep interactive command token stable through autonomous execution; retain exact command/draft guards and import history; test true concurrent edits and same-token client refresh. | Closed by reviewer: independent original0/2→fixed2/2 with exact cleanup and all draft/user/import guards; full candidate5 planning/history4 also passes. Final candidate 6 SQL22 and planning/history pass. |
| P5-R16 | An already-running no-op assessment.start increments the command revision; another tab's join makes the first tab's Pause conflict without any worker/run change. | Increment/write only on domain change; retain execution/receipts/legacy attach and narrowly correct confirmed no-op unsent-tail predictions. | Closed by reviewer: originalSQL0/2→fixed2/2, independent queue4/4, C6 originaltwo-tab3/errors[] with cross-tab pause/resume/shared completion and no browser advancement. |

Each finding retains the original failure, agreed resolution, and independent
verification. Routine tool events are not transcribed as a full transcript.

## Validation evidence

This table is chronological: earlier rows retain their status at that time. The
current synthesis, acceptance ledger, and remaining-work section identify the
latest completed evidence and actual outstanding gates.

| Check | Exact context | Result / limits |
| --- | --- | --- |
| Installed framework version | `node -p 'require("./node_modules/next/package.json").version'` | `16.3.5`; environment/documentation fact only. |
| Historical journals baseline | `sha256sum docs/phases/phase-1-persistence.md docs/phases/phase-2-domain-identities.md docs/phases/phase-3-navigation.md docs/phases/phase-4-neon.md` | Baseline checksums captured before documentation changes; no historical journal was edited. |
| Coordinator approved-source baseline | `/tmp/ufd-phase5-baseline`; 144 files/checksums; Phase 4 build `7DGiXxg-81-9PtS_a9xUl` | Coordinator reports immutable baseline captured without secrets. Prior-phase reference only; not a Phase 5 runtime result. |
| Coordinator approved-baseline browser | `/tmp/ufd-phase5-browser/baseline-chat-results.json`; approved Phase 4 build with actual Neon | Pass: three records, errors `[]`; home → Build recommendation, CRM/main/UAT reply, Today chronology. Prior behavior reference only. |
| Coordinator pre-migration running-assessment fixture | `/tmp/ufd-phase5-browser/upgrade-before-results.json`; approved Phase 4 build with actual Neon | Captured running logical assessment at step 0, before any Phase 5 job exists. Corrected harness succeeds after native-fetch `status()` typo; no product failure. Phase 5 upgrade/resume verification pending. |
| Reviewer early schema/contract inspection | Proposed migration 006 and in-progress agent service/demo contracts | Changes requested: P5-R1 relational ownership and P5-R2 replaceable policy boundary. Existing scoped conversation/retry/event links and active uniqueness look sound; no migration/runtime approval. |
| Reviewer claim/effect/result inspection | In-progress claim/publish, effect reconciliation, and assessment finding publication | Changes requested: P5-R3 after-lock session expiry, P5-R4 cancellation/recorded-effect reconciliation, P5-R5 captured org scope. Source evidence only; actual-Neon probes pending. |
| Reviewer captured-snapshot inspection | In-progress `readWorkspace`/capture and existing `work.status` transaction | P5-R6 independently confirmed in source: project revision and item statuses can come from different commits. Original concurrency probe pending. |
| Coordinator actual-Neon pre-migration check | `/tmp/ufd-phase5-browser/migration-before-results.json`; original failed expectation in `migration-before-harness-failure.json` | Pass: migrations 001–005 checksum-match source, original assessment step 0 intact, no `agent_runs`, client TLS 1.3 encrypted/certificate-authorized. Initial backend-SSL expectation was a harness error. No changed Phase 5 runtime approval. |
| Independent schema acceptance and root Neon migration | 006 SHA-256 `7b22b47f2368605f3c32b088a422e9a034ad7c8f6d7cfa53a75e5a25c512181e`; `/tmp/ufd-phase5-browser/migration-first.log`, `migration-repeat.log` | Reviewer accepts exact schema; root verifies digest, applies only 006 on actual Neon `dev` (exit 0), repeats as no-op (exit 0). Applied schema is immutable; runtime findings remain open. |
| Implementer compile checks | Reported `tsc --noEmit` and worker compilation, while UI/client/tests remain underway | Reported pass; not independent final validation or a production build. |
| Reviewer effect publication inspection | In-progress write-result transaction and second `applyStep` lease check | P5-R7 independently confirmed in source: confirmed marker may commit without publication. Forced-expiry runtime probe pending. |
| Coordinator candidate 1 build/archive | `/tmp/ufd-phase5-neon/candidate1`; build `myqOB6XIpOS4nOmEhDC9F` | Production/worker build pass; 159 source and 29 worker files archived, nine historical journal/migration files verified unchanged, 71 client outputs with zero configured-secret matches. Newer client fixes are not in this candidate. |
| Coordinator candidate 1 production HTTP | `/tmp/ufd-phase5-browser/agent-http-results.json`; actual Neon | Six groups pass: same receipt, busy/conflict, owner/context denial, cursor, public advance rejected, cancellation. |
| Coordinator post-migration fixture inspection | `/tmp/ufd-phase5-browser/upgrade-inspect-results.json`; actual Neon | Pass: original logical run, running cursor and step 0 retained, no job. Attachment/resume test still running. |
| Coordinator actual compiled-worker SIGKILL/restart | `/tmp/ufd-phase5-browser/process-lease-results.json`; initial error `process-lease-initial-harness-failure.json` | Pass: kill after committed lease, fresh compiled targeted worker, same turn completed once, one recovery/fence 1 → 3, all four lifecycle event states. Initial missing-module harness import failed before DB writes and was corrected to HTTP setup. |
| Reviewer actual-Neon lifecycle | `/tmp/ufd-phase5-reviewer-lifecycle.mjs`; `/tmp/ufd-phase5-reviewer-lifecycle-results.json`; Node 22.23.2, pooled dev, generated namespaces cleaned | 7/7 groups pass, exit 0: replay/busy/isolation/cancel/fence/cursor/after-lock expiry/revoke/reset/alternate failure and retry. Independent service/SQL evidence. |
| Reviewer actual-Neon effects | `/tmp/ufd-phase5-reviewer-effects-results.json`; original `/tmp/ufd-phase5-reviewer-effects-before-harness-fix-results.json` retained | Corrected rerun 4/4, exit 0. Original 2/4 failures were fixture key-order equality errors. R4 cancelled uncertainty/reconcile, actual child SIGKILL after effect/no redispatch, tool denial, and R7 forced-expiry rollback pass. |
| Implementer source follow-up checks | Agent pure 6/6, prior 92 tests, `/tmp/ufd-phase5-agent-database.log` agent SQL 4/4 | Reported pass. Prior SQL 9 rerun and final lint still pending; newer client source requires candidate 2. |
| Reviewer partial schema/assessment results and closures | `/tmp/ufd-phase5-reviewer-schema-assessment-first-results.json`; actual Neon | Scoped SQL ownership/kind/uniqueness, alternate policy, and extra-scope finding rejection pass; reviewer explicitly closes R1/R2/R5 with other suites closing R3/R4/R7. R6 snapshot assertion failed and is under diagnosis; no full six-family pass. |
| Reviewer original stale read-tool dispatch probes | `/tmp/ufd-phase5-reviewer-dispatch-results.json`; actual Neon | Two original probes fail after delayed adapter plus cancel/persona transition; confirmed product finding R8. |
| Reviewer candidate 1 production browsers | `/tmp/ufd-phase5-reviewer-browser/navigation-results.json`, `motion-results.json`; surface-context initial `surface-context-before-ack-wait-results.json` | Navigation 6 and motion 3 pass. Surface-context initial pre-ACK assertion failure retained; recheck pending. Candidate 1 only. |
| Reviewer client/navigation source findings | Current AgentClient recovery paths and AgentPanel post-ACK location guard | R9/R10 confirmed in source, assigned by scribe; source corrections reported, independent runtime/browser rechecks pending. |
| Implementer R8–R10 follow-up checks | New ten-group pure suite and TypeScript rerun after final navigation edit | Running, not passed. Candidate 1 remains the earlier runtime. |
| Reviewer corrected stale dispatch probes | `/tmp/ufd-phase5-reviewer-dispatch-results.json`; original `/tmp/ufd-phase5-reviewer-dispatch-before-results.json` | Actual-Neon 2/2 pass; reviewer explicitly closes R8 for current source. |
| Reviewer client recovery probes | `/tmp/ufd-phase5-reviewer-client-results.json` | Independent 4/4 pass: read recovery, rejected/unknown queue distinction, malformed exact-byte recovery, blocked-storage memory ACK. R9 UI closure remains pending. |
| Reviewer R6 deterministic snapshot probe | `/tmp/ufd-phase5-reviewer-snapshot-results.json` (22.9 seconds); first five groups in `/tmp/ufd-phase5-reviewer-schema-assessment-first-results.json` | Actual-Neon capture rev1/todo blocks competing update until capture exits, then rev2/done; reviewer closes R6. Earlier indirect activity observer assertions were harness-only and required no product changes. |
| Coordinator upgrade/retained API | `/tmp/ufd-phase5-browser/upgrade-*-results.json`; `api-boundaries-results.json` | Upgrade inspect/attach/complete pass with original logical run and four findings; retained API boundary 8 groups pass on candidate 1. |
| Coordinator candidate 2 build/archive | Build `F55O5LR3JP0qw83v6R0vw`; `/tmp/ufd-phase5-neon/candidate2` | Build passes; 138 runtime files identical across build, 162 source/30 worker outputs archived, nine immutable files unchanged, 71 client outputs/zero configured-secret matches. Later publication/ACK fixes excluded. |
| Candidate 2 production browsers | `/tmp/ufd-phase5-browser/agent-lifecycle-results.json`; current `/tmp/ufd-phase5-reviewer-browser/{navigation,motion,surface-context}-results.json` | Coordinator agent-lifecycle 5 records pass/errors `[]`; independent navigation 6, motion 3, surface-context 5 pass/errors `[]`. Candidate 1 reviewer copies archived under `candidate1`. |
| Original publication defects and fixed retest | `/tmp/ufd-phase5-reviewer-publication-before-results.json` against copied candidate 2 source; corrected `/tmp/ufd-phase5-reviewer-publication-results.json` | Original 0/2: malformed write output confirmed, expired-lease final commit accepted. Corrected original 2/2 actual-Neon pass; reviewer closes R7 extension/R11 for current source. |
| Coordinator candidate 2 client recovery | `/tmp/ufd-phase5-browser/client-recovery-candidate2-failed-results.json` | Raw Unicode export, changed-source discard guard, recovery pass; later identical retyped draft is erased by old ACK (R12). Full journey fails; candidate 3 correction/retest pending. |
| Implementer publication regressions | `/tmp/ufd-phase5-agent-database-final.log` existing agent SQL 6 groups; expanded eight-group run | Six reported passing; next eight-group run pending. Last type/lint reported pass with one inherited stylesheet warning. |
| Accepted read-only assessment-tool boundary | Current worker dispatch guard; new permanent denial regression in nine-group agent SQL suite | Source boundary accepted by reviewer/coordinator; expects zero write calls, typed denial/no effects, paused cursor. Final nine-group result pending. |
| Implementer trailing-Today regression progress | Current agent SQL suite now ten groups: base eight, assessment write denial, historical Today | Base eight and denial group reported pass; newest Today group running. Independent scope/history probes and next production build pending. |
| Coordinator candidate 3 build/archive | `/tmp/ufd-phase5-neon/candidate3`; build `MjylKXKeIArclIiPokWTG` | Build passes; 138 runtime files identical across build, 162 source/30 worker files archived, nine historical immutable files unchanged, 71 client outputs/zero configured-secret matches. Final browser/lifetime checks pending. |
| Coordinator corrected R10 production browser | `/tmp/ufd-phase5-browser/late-navigation-results.json`; exact starter receipt destination asserted | One record passes/errors `[]`: delayed submit ACK preserves newer same-path Code/`opportunity-handler` canvas. Prior arbitrary-text prompt harness failure retained separately. |
| Reviewer original/corrected trailing-Today history | `/tmp/ufd-phase5-reviewer-history-before-results.json`, `/tmp/ufd-phase5-reviewer-history-results.json` | Original missing acknowledged draft in historical snapshot fails; corrected probe passes (23.480s). Exact disposition/final reconciliation pending. |
| Reviewer original/corrected retained assessment scope | `/tmp/ufd-phase5-reviewer-legacy-scope-before-results.json`, `/tmp/ufd-phase5-reviewer-legacy-scope-results.json` | Original expected paused/got running fails; corrected combined running/paused unavailable-scope probe passes (18.299s). Exact covered matrix under reviewer reconciliation. |
| Latest quiet permanent actual-Neon agent SQL | `/tmp/ufd-phase5-final-agent-sql-quiet.log`; eleven tests | 9/11 pass; tests 10/11 connection-timeout failures, cleanup-hook timeout, post-test connection termination activity. Failed/incomplete final suite; implementer diagnosing alone, original retained, no assumed cause. |
| Coordinator current units/parity status | Latest 102 unit tests reported; `/tmp/ufd-phase5-browser/chat-parity.mjs` | Unit total reported passing. Baseline-comparison browser harness prepared, not run; no parity result claimed. |
| Independent assessment write denial | `/tmp/ufd-phase5-reviewer-assessment-write-denial-results.json` | Pass: zero execution/effect journal, tool_denied/none, paused cursor. |
| Reviewer candidate 3 independent pure/type/lint | `/tmp/ufd-phase5-reviewer-candidate3-{retained-unit,agent-unit,typecheck,lint}.log`; original wrong-condition `/tmp/ufd-phase5-reviewer-candidate3-unit.log` | Corrected documented flags: retained 92/92 + agent 10/10, exit 0, zero skips; TSC/lint exit 0, inherited stylesheet warning. Initial 82-pass/one-suite failure was react-server condition misuse, corrected without source/assertion edits. |
| Candidate 3 final source reconciliation | Reviewer runtime 138/worker 30 hashes and source 162, coordinator independent SHA comparison | Runtime/worker all match; only evolving plan/journal differ in source. Candidate 2 navigation 6/motion 3/surface-context 5 remain accepted for unchanged source. |
| Unchanged-wrapper longevity and exact cleanup | `/tmp/ufd-phase5-pool-longevity.json`; `/tmp/ufd-phase5-owned-cleanup-results.json` | 40/40 transactions, one connection, zero errors over ~94s; exact journal-owned cleanup 12/12. Earlier new-connection timeout cause remains unresolved. |
| Final sequential permanent actual-Neon SQL | `/tmp/ufd-phase5-final-agent-sql-sequential.log`; `/tmp/ufd-phase5-final-application-sql-sequential.log` | Agent 11/11 (108.3s) then retained 9/9 (94.2s), exit 0, cleanup passes and generated journals empty. No runtime change; failed originals retained. |
| R12 delayed-refresh continuation audit | Candidate 3 AgentPanel `send()` and AgentClient acknowledgement/refresh ordering | Source-confirmed second clear can erase newly typed identical text after first ACK clear. Original production reproduction/fix/candidate 4 retest pending. |
| Original R12 delayed-refresh browser and corrected-source checks | `/tmp/ufd-phase5-browser/ack-refresh-race-candidate3-failed-results.json`, `ack-refresh-race.mjs`; `/tmp/ufd-phase5-candidate4-{typecheck,target-lint}.log` | Candidate 3 product assertion fails/errors `[]`; reviewer verifies reproduction and minimal AgentPanel-only duplicate-clear removal. Full type/targeted lint/diff checks pass. Candidate 4 build and original/full-client UI rechecks pending. |
| Candidate 4 build and independent reconciliation | Build `jFxsh96G7jjb9NasAtKyI`; `/tmp/ufd-phase5-reviewer-candidate4-reconciliation.json` | Build passes; runtime 138/worker 30 match archived manifests; source 162 differs only in evolving plan/journal. Only runtime change from candidate 3 is reviewed AgentPanel duplicate-clear removal. Final browser/lifetime checks running. |
| Candidate 4 original race/full client recovery | `/tmp/ufd-phase5-browser/ack-refresh-race-candidate4-results.json`, `client-recovery-results.json`; originals retained | Race 1 and recovery 3 pass/errors `[]`; reviewer independently closes R9/R12. Exact export/changed-source protection, both identical-retype races, and blocked-storage ACK covered. |
| Reviewer candidate 4 type/lint | `/tmp/ufd-phase5-reviewer-candidate4-{typecheck,lint}.log` | Full TSC/ESLint exit 0; one inherited layout stylesheet warning. |
| Candidate 4 lost-ACK reload | `/tmp/ufd-phase5-browser/lost-ack-reload-results.json`; original `lost-ack-reload-initial-locator-failure.json` | One record passes/errors `[]`. Original alert text locator missed included button; locator-only correction, original retained. |
| Candidate 4 planning locator diagnosis | `/tmp/ufd-phase5-browser/planning-history-candidate4-locator-failure.json`; `/tmp/ufd-phase5-reviewer-role-locator-race-results.json` | Actual DOM shows current Today idle/visible/not inert/enabled; isolated Chromium reproduces early role-locator binding to disabled historical input. Reviewer accepts readiness-only wait before unchanged assertions; full rerun running, no product finding/edit. |
| Candidate 4 corrected planning, real project conflict | `/tmp/ufd-phase5-browser/planning-history-candidate4-project-conflict.json` | First two history/rescan assertions pass, then project.create returns409 during worker progress. Confirmed R15 product defect; original retained, fix/retest pending. |
| Candidate 4 import/durability | `/tmp/ufd-phase5-browser/import-and-durability-results.json` | Seven records pass/errors `[]`. Agent-lifecycle and buffer checks still running separately. |
| Candidate 4 baseline parity/lifecycle/buffers | `/tmp/ufd-phase5-browser/chat-parity-results.json`, `agent-lifecycle-results.json`, `buffer-and-session-results.json` | Parity 3, lifecycle 5, buffer/session 4 records pass/errors `[]`; exact original home prompt, CRM/main/UAT reply, and Today/message chronology retained. Root processes stopped for quiet SQL window. |
| R15 permanent original/fixed focused SQL | `/tmp/ufd-phase5-r15-original-sql.log`; `/tmp/ufd-phase5-r15-fixed-sql.log` | Original product failure revision9 versus8 in67.5s, cleanup passes. Focused correction1/1 in139.3s, exit0/cleanup passes. Independent reviewer original/fixed probes and final suites pending. |
| R15 same-token client and source checks | `/tmp/ufd-phase5-r15-application-unit.log`; `/tmp/ufd-phase5-r15-{typecheck,target-lint}.log` | Application16/16 including changed same-token snapshot adoption passes; type/target lint/diff pass. Runtime frozen, candidate5 build running. |
| Independent R15 original and candidate5 pure checks | `/tmp/ufd-phase5-reviewer-command-revision-original-results.json` and `.log`; `/tmp/ufd-phase5-reviewer-candidate5-{retained-unit,agent-unit}.log` | Archived C4 original0/2 actual conflicts (draft edit after worker progress, exact-source import after completion), exit1/cleanup journal empty; same script fixed rerun running. Independent retained93+agent10=103 pass, exit0/zero skips. |
| Candidate 5 build/archive | `/tmp/ufd-phase5-neon/candidate5`; build `B6mRZa2zvMpCjUePkQHZE` | Pass: runtime138 stable across build, source162/worker30 archived, nine immutable files unchanged, client71/zero configured-secret matches. Not started during isolated SQL window; final browsers/lifetime pending. |
| Independent R15 corrected original probes | `/tmp/ufd-phase5-reviewer-command-revision-original-results.json`, `/tmp/ufd-phase5-reviewer-command-revision-fixed-results.json`, corresponding `.log` files | Original0/2 actual conflicts; fixed2/2 exit0, durations122.778s/36.128s, exact cleanup complete. Reviewer closes R15; captured draft/user conflict and import/history matrices above pass. |
| Candidate 5 original planning/history browser | `/tmp/ufd-phase5-browser/planning-history-results.json` | Four records pass/errors `[]`: immutable history/rescan origin, create during scan, status failure/retry/reload, separate recurring-finding plan identity. Real targeted worker; original semantics retained with accepted readiness-only wait. |
| Final candidate 5 checks in progress | Frozen `B6mRZa2zvMpCjUePkQHZE`; permanent agent SQL followed by retained SQL | Agent5/12 so far/no errors, suite still running; two-tab assessment underway, crash/standalone lifetime queued. No full-suite pass claimed. |
| Candidate 5 full permanent agent SQL | `/tmp/ufd-phase5-candidate5-agent-sql.log` | 12/12 pass in163.1s, exit0, cleanup hook passes and exact namespace journal empty; R15 expanded group47.97s. Retained application9 running next; combined final21 pending. |
| Candidate 5 final complete SQL and historical immutability | `/tmp/ufd-phase5-candidate5-agent-sql.log`, `/tmp/ufd-phase5-candidate5-application-sql.log`; reviewer baseline checksum comparison | Agent12/12 (163.1s) + retained9/9 (94.8s), exit0/zero skips, cleanup/empty journals/no transport errors. All nine historical files match; applied006 keeps accepted digest. |
| Candidate 5 two-tab original attempts | `/tmp/ufd-phase5-browser/assessment-tabs-initial-sampling-failure.json`; `/tmp/ufd-phase5-browser/assessment-tabs-candidate5-pause-conflict.json` | Initial sequential-sampling cause remains inferred; stronger matching-ID readiness accepted. Separate actual same-run/step0/no-worker Pause409 confirms R16; no cross-tab pass claimed. |
| Candidate 5 actual compiled-worker SIGKILL/restart | `/tmp/ufd-phase5-browser/process-lease-results.json` | Two records pass: committed live lease before kill, same run/turn on restart, recovery1/fence1→3, one completion event. Claim wait20s retains separate live-lease assertion. |
| R16 server/client design ratification | No-op token/always-sync+receipt; confirmed-head atomic removal/load with unsent-tail adjustment only | Coordinator/reviewer/implementer agree bounded correction; original/fixed SQL and queue tests pending. No generic rebase or uncertain-request mutation. |
| Independent R16 original/fixed SQL and queue | `/tmp/ufd-phase5-reviewer-noop-start-{original,fixed}-results.json` and corresponding logs; `/tmp/ufd-phase5-reviewer-noop-queue-results.json` | OriginalC5 0/2 actual pause/token conflicts; fixed2/2 exit0 (10.702s/5.398s), cleanup empty. Queue4/4 covers exact restored head/one correction, unrelated aggregates, real conflicts and failed post-ACK load. |
| Candidate 6 build/reconciliation and independent suites | `/tmp/ufd-phase5-neon/candidate6`, build `15T7t4qKdNxu-Q1IMvqKh`; `/tmp/ufd-phase5-reviewer-candidate6-reconciliation.json`; `/tmp/ufd-phase5-reviewer-candidate6-{retained-unit,agent-unit,typecheck,lint}.log` | Runtime138/source162/worker30 match; worker byte-identical C5, immutable9, client71/zero secrets. Independent retained94+agent10=104 exit0/zero skips; type/lint pass with inherited warning. |
| Implementer candidate 6 pure harness correction | `/tmp/ufd-phase5-candidate6-pure-regression.log`; corrected `pure-browser.log` and `pure-agent.log` with same candidate6 prefix | Initial react-server condition causes browser SSR module-load failure; documented modes pass94+10 without product/assertion changes. Independent suites separately pass. |
| Candidate 6 original two-tab browser | `/tmp/ufd-phase5-browser/assessment-tabs-results.json` | Three records/errors[]: one pending run, cross-tab Pause/Resume same logical/new linked attempt, both see completion, zero browser advance. Reviewer explicitly closes R16. |
| Candidate 6 full planning/history | `/tmp/ufd-phase5-browser/planning-history-results.json`; `planning-history-candidate6.log` | Four records/errors[]; original history/rescan/create/status/identity semantics retained, accepted readiness-only wait. |
| Candidate 6 full agent SQL | `/tmp/ufd-phase5-candidate6-agent-sql.log` | 13/13 in164.7s, exit0, cleanup hook passes/exact journal empty; R16 group10.33s. Retained9 running; combined22 pending. |
| Candidate 6 durable-lifetime preparation | `/tmp/ufd-phase5-browser/durable-lifetime-prepare-results.json` | One record/errors[]: acknowledged pending turn before browser closure; private state0600. Web stopped, official worker/new-browser verification pending; no completion claim yet. |
| Candidate 6 final complete actual-Neon SQL | `/tmp/ufd-phase5-candidate6-agent-sql.log`, `/tmp/ufd-phase5-candidate6-application-sql.log` | Agent13/13 (164.7s) + retained9/9 (121.4s), both exit0, cleanup hooks pass/exact namespace journals empty/no transport errors. FinalSQL22 complete; source frozen. |
| Candidate 6 official-worker lifetime and new browser | `/tmp/ufd-phase5-browser/durable-lifetime-{prepare,worker,verify}-results.json` | Prepare1/verify1 records/errors[]; official npm worker completes same acknowledged turn with web ECONNREFUSED/browser closed, one completion event, all lifecycle states. Worker stops exit0; new browser sees same completed turn/one user message. Reviewer independently accepts scripts/artifacts. |
| Final independent runtime reconciliation | `/tmp/ufd-phase5-reviewer-final-reconciliation.json` | Runtime138/worker30 unchanged; README/plan/P5 journal only changes. Reviewer accepts A1–A7. Scribe rechecks original P1–4 hashes unchanged and README whitespace clean. All test processes stopped. |

All designated candidate 6/runtime-compatible tests pass, including planning,
two-tab, SQL22, independent pure104, type/lint, actual worker kill/restart,
official-worker browser-closed/web-down completion, and new-browser recovery.
Final runtime/worker hashes reconcile. The reviewer accepts A1–A8 and has issued
the exact whole-phase approval recorded below. Earlier failed
attempts and unresolved original connection-timeout causes stay documented.

## Remaining work and handoff

Phase 5 is approved with no required work remaining. All sixteen findings and
acceptance criteria are satisfied; earlier failures and later-phase limits remain
documented. All test processes are stopped. Await the user's Phase 6 checkpoint;
no Phase 6 work, commit, or deployment is included.

## Approval and user checkpoint

**Independent reviewer / approver:** `phase5_reviewer`.

> APPROVED — 100% of Phase5 acceptance criteria satisfied.

The reviewer explicitly confirmed all **P5-A1–P5-A8** satisfied after the final A8
documentation read, with **R1–R16 closed**, no unresolved work, no silent deferral,
and no waived criterion. Accepted evidence includes candidate 6 build
`15T7t4qKdNxu-Q1IMvqKh`, 104 independent tests, 22 actual-Neon SQL tests, type/lint/build,
original/fixed adversarial and production journeys, final source reconciliation,
actual worker SIGKILL/restart, and official-worker browser-closed/web-down followed
by new-browser verification. This approval covers the agreed demo/application
phase, not a real provider integration or deployment.

**User checkpoint:** Phase 5 is approved. Phase 6 remains gated until the user
authorizes the next phase.
