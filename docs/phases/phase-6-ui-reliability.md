# Phase 6 — UI reliability and measured client scale

**Started:** September 16, 2026  
**Status:** Approved — awaiting the user’s Phase 7 checkpoint  
**Approved:** September 16, 2026  
**Authorization:** The user replied “move to phase 6” after independent Phase 5 approval.  
**Baseline:** Approved Phase 5 working tree, build `15T7t4qKdNxu-Q1IMvqKh`, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md#phase-6--ui-reliability-and-measured-client-scale)  
**Findings:** F7 and F10 in the [architecture review](../architecture-review.md)

## Current synthesis

- All six Phase 6 findings are independently closed. Final candidate 4 build
  `vOQRs6yqFvz3Jt_Sp2pHs` passes Next/worker, four timestamp-display checks, and
  HTTP 200 checks for login/session. Runtime 134 and historical 11 hashes match.
  The final independent documentation read is complete: **all P6-A1–P6-A8 are
  approved**, with no unresolved findings or waived criteria.
- Independent **120 checked-in tests**, queue **5**, and historical-provider
  isolation **4** pass. TypeScript/lint pass with one inherited stylesheet
  warning. Candidate 3 build `rEjMUuj5TBpt6E8MfaYYo` passes Next/worker and all
  **25 grouped functional browser checks**. The independent six-click modal
  replay restores the exact trigger in both motion modes.
- Actual-Neon client checks pass **4/4**, with errors `[]`, successful cleanup,
  and an empty owned-namespace journal. Reviewer accepts that evidence.
- Reviewer accepts measured C3's **15 successful samples** versus baseline 14
  successes plus one retained drain timeout. For the measured fixtures, 100
  edits use 5–8 save requests versus 100, and 128-entry history mounts 40 messages
  versus 128. Shared-host contention prevents a precise timing-speedup claim.
  The [permanent artifact](phase-6-client-measurements.json) records C3 provenance;
  the reviewer accepts reuse for C4 after verifying the exact four-file
  presentation/comment delta, absent from the measured rendered workload.
- Four buffered C3 `aborted`/`ECONNRESET` diagnostics have an unconfirmed cause;
  the process survived later passing checks. Fresh C4 ordinary-navigation output
  has no such diagnostics or uncaught exception, and only the inherited pg
  future-major SSL-mode warning. All team-owned test processes are stopped.
- Phase 1–5 journals remain byte-identical; existing private Neon setup and
  approved persistence/navigation/worker guarantees carry forward. No commit,
  deployment, provisioning, or real-provider integration occurred. Phase 7
  requires a new user checkpoint after independent Phase 6 approval.

## Roles and baseline

- **Implementer:** `phase6_implementer`, application source and meaningful tests.
- **Reviewer / approver:** `phase6_reviewer`, independent inspection, validation,
  finding dispositions, and final acceptance.
- **Scribe:** `phase6_scribe`, this journal, current plan status, and README.
- **Coordinator:** primary agent, scope/design ratification, baseline and
  independent checks, coordination, and the user's phase checkpoint.

Existing dirty/untracked work is approved prior-phase work. No agent approves
their own implementation. The installed Next guides must be read before relevant
framework code changes. The scribe captured Phase 1–5 journal checksums at
`/tmp/ufd-phase6-scribe/historical-journals.sha256` before documentation edits.

## Acceptance ledger

The coordinator ratified P6-A1–P6-A8 with reviewer agreement. Planned evidence is
not a passing result. Concrete budgets, measurement fixtures, and implementation
design must be agreed and recorded before claiming acceptance.

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P6-A1 | Palette modality, keyboard operation, Tab/Shift+Tab containment, Escape, focus/caret restoration, reduced motion, and rapid reopen have one reliable interaction owner. | Reviewer accepts complete modal/interactions and six-click focus replay; R4/R5 closed and final source reconciled. |
| P6-A2 | Agent and active canvas have local error/loading containment, recovery or navigation away, preserved draft state, and deliberate lazy module boundaries. | Independent original faults plus complete C3 checked-in fault5 pass, preserving exact composer node/text/selection. |
| P6-A3 | Stable actions and selected subscriptions avoid unrelated updates; coalesced edits retain immediate UI and explicit flush/ack/error/recovery semantics without silent eviction. | Reviewer accepts new16 within120 tests, queue5, actual-Neon4, C3 comparison, R1/R3 resolutions, and final C4 source reconciliation. |
| P6-A4 | Historical snapshots have no live subscriptions; transcript/render/retention/tab/draft work has explicit bounded budgets and actual timestamps. | Reviewer accepts historical no-provider4, source/R2 tests, budget6/history measurements, and final C4 timestamp4; R6 closed. |
| P6-A5 | Existing navigation, visual timing, motion, composer selection/drafts, profile isolation, persistence, and captured-context guarantees remain intact. | Reviewer accepts retained120, functional25, live-Neon profile/reload/command-order4, and final source reconciliation. |
| P6-A6 | Representative baseline-versus-final typing/transcript measurements support specific performance claims and documented capacity limits. | Reviewer accepts baseline14+retained timeout versus measured C3 fifteen successes, exact counts/limits, permanent rows/hashes, and final C4 presentation-only delta/provenance. |
| P6-A7 | Meaningful Node 22 tests, TypeScript, lint, production build, and production keyboard/fault/performance/regression browser checks pass with exact candidate evidence. |120 tests, queue5, historical4, static checks, functional25/live-Neon4/measurement15, C4 build/timestamp4/HTTP health, runtime134/historical11 pass and independently accepted. |
| P6-A8 | README/plan/journal accurately record behavior, decisions, all findings and responses, exact validation and limitations, and independent final approval with no unresolved in-phase criterion. | R1–R6 closed; exact evidence/limits/provenance and clean final handoff recorded. Final documentation read and exact independent approval are complete. |

No criterion or finding may be silently weakened or moved to a later phase to
obtain approval. “100%” means all agreed phase criteria have evidence and no
unresolved in-phase findings; it is not an unlimited-scale or defect-free claim.

## Design and review chronology

### Round 0 — Authorization and scope proposal

- **User:** “move to phase 6,” following the Phase 5 approval checkpoint.
- **Coordinator:** assigned implementer, independent reviewer, and scribe;
  proposed P6-A1–P6-A8 and requested concrete design/measurement ratification.
- **Scribe:** initialized this journal and updated current plan status; recorded
  authorization and preserved prior journals. README behavior changes will
  describe implemented outcomes once evidence exists.
- **Disposition:** acceptance/design ratification pending. Phase 7 remains gated;
  no commit, deployment, or paid provisioning is authorized by this checkpoint.

### Round 1 — Acceptance ratification and pre-edit design review

- **Reviewer:** agreed to P6-A1–P6-A8. Requested representative baseline/final
  fixtures with 1 and 20 drafts, 100 field changes, serialization/command/render
  counts and latency; transcript fixtures must stay within the declared cap and
  measure mounted work/timing. Flagged two design risks: historical `DayZeroHome`
  and nested `ProjectReview` both subscribe to live assessment state; remounting
  all of `AgentPanel` after an error would discard its unsent draft/selection.
  These are design cautions, not numbered implementation findings.
- **Coordinator:** ratified P6-A1–P6-A8 with reviewer agreement. Captured
  `/tmp/ufd-phase6-baseline`: 156 source files with no environment secrets, plus
  11 immutable prior journals/migrations. Require identical feasible workloads
  for baseline and final measurements; Phase 7 remains untouched.
- **Implementer:** proposed a reusable native-dialog modal for focus/Escape/motion
  lifecycle, roving palette tab controls for horizontal arrows, canvas-content
  and transcript feature boundaries that keep the persistent composer mounted,
  and deliberate lazy feature imports. Proposed separating the live Today
  adapter from pure historical views including nested `ProjectReview`, stable
  canvas actions, per-surface subscriptions, and structural sharing.
- **Initial write proposal:** 200 ms debounce with a 1 s maximum flush interval,
  visible memory-only unsaved status before queuing, flush on blur/pagehide/
  profile/navigation and before non-edit commands, and no mutation of uncertain
  attempted requests.
- **Reviewer response:** memory-only staging would regress Phase 4 abrupt-reload
  recovery, which currently captures every edit. Requested a small synchronous
  per-draft recovery patch while coalescing full-queue/server work. Recovery must
  retain the old session/target, ordering/base revision, and exact idempotent
  identity across reload/move. Concrete durability design is **not yet accepted**;
  no criterion is waived.
- **Agreed measurement/limit scope:** transcript pages contain 40 entries within
  the existing 128-message-per-conversation cap; measure 20/80/128 entries rather
  than an unsupported 1,000. New tabs are limited to 20 per surface with visible
  rejection; existing over-cap legacy tabs remain readable, reopenable, and
  closable. No history/draft eviction is permitted. These are design decisions,
  not measured performance results.

### Round 2 — Recovery-safe coalescing design

- **Reviewer:** accepted the revised design in principle: retain the existing
  synchronous single `localStorage` recovery-queue envelope on every edit, cache
  serialization for immutable commands/session, and join cached entries for the
  envelope. Coalesce only a compatible contiguous tail that has never been
  dispatched. Delay network sends by 200 ms with a 1 s maximum interval.
- **Required invariants:** all restored commands are uncertain/immutable;
  dispatched commands are immutable; merging cannot reorder separate fields or
  aggregates, and no completion promise may be lost. Existing recovery format
  remains, so a second patch journal/migration is unnecessary.
- **Measurement limitation:** each edit still writes a full-buffer string,
  proportional to serialized bytes. Serialization caching does not eliminate
  that `localStorage` cost; evidence and documentation must report it honestly.
- **Disposition:** design accepted in principle, not implementation approval.
  This replaces the memory-only staging proposal and preserves Phase 4 recovery
  guarantees without weakening P6-A3.
- **Reviewer documentation caution:** current source/README language promises
  measured data pagination in Phase 6. A 40-entry rendered transcript page does
  not reduce the full bounded network snapshots (16 MiB application / 24 MiB
  agent), fetched history, or memory footprint. Final source/docs must describe
  measured scope accurately, or implement actual data paging if the agreed
  measurements justify it. The scribe relayed the source-comment correction to
  the implementer and owns the corresponding README clarification.
- **Reviewer queue clarification:** add a UI-only `enqueueEdit` coalescing path;
  existing `enqueue` remains immediate. The prohibition on coalescing restored
  or attempted commands concerns payload/command identity, not removal of the
  approved Phase 5 R16 acknowledgement-plus-fresh-load correction for dependent
  tail `expectedRevision` (including restored entries). Preserve explicit Keep
  Local rebase identity policy. Cached serialization follows replacement objects
  so permitted corrections cannot reuse stale encoded content.

### Round 3 — Feature-boundary placement during implementation

- **Reviewer:** inspected the in-progress transcript boundary placement and
  warned that wrapping the JSX result of `thread.map` does not catch errors in
  that map: the parent evaluates it before the boundary renders. Requested a
  transcript child component inside the boundary so mapping errors are contained
  while the persistent composer remains mounted.
- **Disposition:** implementation caution, not a numbered final-review finding.
  Final placement inspection and an injected feature-fault check are required;
  no successful containment result is claimed yet.
- **Later source inspection:** reviewer confirms transcript mapping now executes
  inside the boundary's child, historical `DayZeroHome`/`ProjectReview` are pure,
  historical `SurfaceNav` is omitted, and `ReturningHome` uses pure rows. This
  closes the placement concern at source level; runtime fault/measurement gates
  remain separate.

### Round 4 — P6-R1: preserve edits made during a discard decision

- **Independent reviewer — CHANGES REQUESTED:** reproduced a coalescing race with
  `/tmp/ufd-phase6-reviewer/discard-edit-race.mjs`. An attempted conflicting head
  is followed by a mutable deferred tail. The user chooses **Use saved version**,
  then makes a same-field edit while the fresh-read request is pending. That edit
  merges into the tail's command identity captured by the discard decision; when
  the read resolves, discard removes the newly typed bytes and reports saved.
- **Observed:** pending queue and optimistic projection both become empty;
  expected post-click notes are not retained.
- **Required response:** freeze the reviewed command set against merging, or use
  version-aware discard, and add a meaningful `enqueueEdit` regression covering
  the delayed-read race. This is a confirmed in-phase data-loss defect, not a
  performance tradeoff or a waived requirement.
- **Disposition:** P6-R1 open; implementer response and independent closure
  pending.
- **Fix and independent replay:** source now freezes clicked command identities
  before starting the fresh read. The reviewer's exact original reproduction
  passes with exit 0, retaining post-click notes and conflict status:
  `/tmp/ufd-phase6-reviewer/discard-edit-race-fixed.log`. Reviewer awaits a checked-in
  regression before final closure; P6-R1 remains pending that lasting evidence.

### Round 5 — Independent in-progress queue contracts

- **Reviewer:** five independent queue checks pass against current in-progress
  source in `/tmp/ufd-phase6-reviewer/queue-contracts.mjs` and `.log`: all 100
  merged callers resolve and disk bytes reflect edits immediately; attempted
  heads remain immutable while a following tail can coalesce; reload before the
  debounce recovers edits; continuous editing obeys the maximum delay; and
  commands for different aggregates preserve order.
- **Disposition:** preliminary source-contract evidence only. Source is still
  changing; these checks do not establish a frozen-candidate pass or final
  acceptance.

### Round 6 — Production baseline and measurement protocol

- **Coordinator:** production baseline build `JFIHR0mXQjOKCeNHr9o9m` passes on
  Node 22 from the frozen 156-file Phase 5 source archive, including the worker
  build. Log: `/tmp/ufd-phase6-baseline-build.log`. Eleven historical immutable
  files remain unchanged.
- **First completed sample:** 1 draft, 100 edits, 20 mixed history entries,
  Chromium at 4× CPU slowdown: 100 POSTs; 199 recovery-buffer writes totaling
  3,508,569 bytes; Playwright typing duration 22,228 ms; p95 input-to-next-animation-
  frame latency 223.5 ms. These are a single baseline sample, **not** a final
  comparison, database throughput measure, or generalized performance claim.
- **Environment/protocol:** production app with mocked API responses measures
  client work. Initial telemetry/symlink/cross-device setup issues were resolved
  by copied dependencies and disabled telemetry; loopback server/browser checks
  need sandbox escalation. Initial 30 s typing and 45 s drain allowances proved
  insufficient for baseline workload. The consistent baseline/final protocol
  now allows 180 s typing and 240 s drain; original timeout evidence is retained.
- **Disposition:** measurements remain in progress. Final claims require the
  agreed same-workload sample set and final candidate evidence.

### Round 7 — P6-R2: preserve timestamp meaning across offsets

- **Coordinator/reviewer — CHANGES REQUESTED:** coordinator identified and
  reviewer independently confirmed in source that `SampleTimestamp` labels an
  offset timestamp's original wall-clock time as UTC. For
  `2026-09-14T14:56:00-04:00`, it shows 14:56 UTC instead of the correct 18:56 UTC.
- **Required response:** normalize valid timestamps through `Date.toISOString`,
  define a deliberate policy for timezone-less values, and cover `Z`, explicit
  offsets, and legacy strings. New fixtures using only `Z` do not protect
  existing arbitrary saved `updated` strings.
- **Disposition:** P6-R2 open; fix and independent verification pending.

### Round 8 — Implemented contracts and preliminary source resolutions

- **Implementer:** confirms `enqueueEdit` retains synchronous one-envelope
  recovery durability; caches immutable command/session serialization; coalesces
  only a contiguous current-runtime never-dispatched tail for the same canvas/
  captured target or same draft field/finding; uses 200 ms debounce/1 s maximum;
  and flushes on focusout/pagehide/navigation/profile change or ordinary commands.
  Restored payload/identity remain immutable, Phase 5 acknowledgement-only token
  correction remains, and every merged caller resolves. Full buffer bytes are
  still rewritten for each edit.
- **P6-R1:** implementer checked in the discard-race regression. Reviewer accepts
  the source resolution with both that regression and the independently passing
  original probe, pending final suites.
- **P6-R2:** zoned ISO strings now normalize to UTC; timezone-less and legacy
  relative labels show **At capture**. Checked-in tests cover `Z`, offsets,
  invalid values, and legacy strings. Reviewer accepts the source resolution
  pending independent final execution.
- **Historical purity:** reviewer renders historical front-door snapshots for
  JW/SP/AM without any providers; all three pass in
  `/tmp/ufd-phase6-reviewer/historical-pure.log`. The first harness omitted `.ts`
  component modules and failed module loading; including `.ts` and `.tsx` fixed
  the harness without application changes. This is distinct from a browser
  subscription/render measurement.
- **Implementer checks:** the new `test:client-reliability` suite passed 10 tests
  before the timestamp test was added; execution of that eleventh test/final
  suite remains pending. Transcript page40/new-tabs20 and unchanged snapshot
  quotas are implemented; final browser/capacity evidence is still required.
- **Scribe:** updated README from the implemented source/contracts, added the new
  verification command, and explicitly marked Phase 6 under review. Rendered
  transcript paging is distinguished from full bounded network snapshots; no
  API pagination, unlimited capacity, or performance improvement is claimed.
- **Verification reporting correction:** implementer clarified that an earlier
  “typechecks” report referred to a yielded process with no output yet, not a
  completed passing check. It later completed with three ordinary type errors,
  which the implementer reports fixed. Final typecheck/lint were still running
  at this correction; no completed pass or candidate freeze is claimed. This
  journal had not recorded a Phase 6 typecheck pass.

### Round 9 — Candidate 1 source freeze and explicit edit budgets

- **Implementer:** froze candidate 1 application source for validation. No build
  identity or final test pass accompanies this source-freeze report.
- **Final additional budgets:** 16 nonempty unsent composer drafts per page,
  8,000 characters each, with visible rejection retaining the current draft map;
  clearing or acknowledgement frees a slot. Canvas text inputs use a 16,000-
  character native limit with visible guidance. Existing longer saved values
  remain intact and shrinkable; the independent server aggregate limit remains
  65,536 UTF-8 bytes, with errors recoverable. Copy-to-project is disabled until
  the source draft is saved.
- **Source/documentation:** `quota.ts` now accurately distinguishes client
  rendered pages from full bounded snapshots. README records all implemented
  limits and save-before-copy behavior; no API paging claim remains there.
- **Verification status:** 13 checked-in client-reliability tests now exist;
  only the earlier 10-test execution has a reported pass at this point. The three
  subsequently added tests remain pending. Root-validated browser harnesses are
  intended for `scripts/browser` with pinned Playwright 1.63.0 after baseline
  measurements complete; planned check-in is not a completed result.

### Round 10 — P6-R3: bounded completion ownership for merged edits

- **Implementer/reviewer — CHANGES REQUESTED:** implementer self-review found,
  and independent reviewer accepted, that merged command completion recursively
  invokes the prior resolver. One queued command retains a closure/promise chain
  proportional to edit count; sufficiently long offline typing can overflow on
  resolution or deactivation despite the bounded queue length.
- **Agreed fix:** share one promise/resolver per command identity, remove terminal
  map entries, and transfer unresolved tail completions during explicit Keep
  Local rebasing. Add identity, many-edit, rebase, and deactivation coverage.
- **Disposition:** P6-R3 open. Candidate 1 source freeze reopens; final source
  hashes and tests must be refreshed after the fix. No browser pass or phase
  approval is claimed.
- **Reviewer documentation refinement:** historical cards retain captured-work
  links and starter callbacks while omitting the live `SurfaceNav`. README now
  describes the absent live assessment/workspace/agent subscriptions and explicit
  historical-work callbacks, with **Explore surfaces** on the active card. It
  does not imply removal of all historical navigation.
- **Implementer fix:** coalesced callers share one promise/resolver per command
  identity. Terminal acknowledgement/failure/deactivation cleans maps; explicit
  Keep Local identity rebuilding transfers unresolved tail completion ownership.
  Added a 10,000-edit shared-promise/deactivation test and a Keep Local tail-ACK
  test, and strengthened the original 100-caller case with promise identity.
  Source is re-frozen. The suite now contains 15 tests but has not yet been rerun
  while the coordinator's baseline measurements hold the CPU-work lane. P6-R3
  remains open pending independent evidence.

### Round 11 — Tab budget without breaking captured URL ownership

- **Reviewer:** agreed a precise tab budget: 20 shared open tabs, plus at most
  one URL-only view of an already captured/saved draft. This preserves the Phase
  3 guarantee when another browser tab closes the current shared tab and fills
  all 20 slots. Unknown new URL destinations, new opens, and new copies remain
  rejected at capacity; existing over-cap legacy tabs remain preserved.
- **Required navigation invariant:** a rejected restore must not become the
  controller's recorded current destination, then get captured by later
  navigation away. Commit only an accepted destination and test rejection →
  navigate away → Back so rejected work is never silently created afterward.
- **Documentation:** README distinguishes the shared-tab limit from one existing
  URL-only view. This refinement preserves prior guarantees; it does not waive
  P6-A4. Tests and independent evidence remain required.
- **Implementer clarification:** the fixed Overview tab is additional to the
  20 shared open canvases. The URL-only exception applies only to an already
  captured/saved closed draft; truly new direct URLs/open/copy remain rejected.

### Round 12 — Reproducible browser dependency and audit boundary

- **Implementer:** pins Playwright 1.63.0 in `package.json`; the lockfile adds
  only `playwright` and `playwright-core`, with no existing package version
  changes. This supports checking the validated browser harnesses into the repo.
- **Audit observation:** npm's automatic summary reports four advisories
  (one moderate, three high), without attribution in that summary. No automatic
  fixes were applied. The coordinator assigns detailed advisory triage to Phase
  7's existing release-readiness obligation; this is not a clean audit, a claim
  that Playwright introduced the findings, or a production-only classification.
- **Verification:** final TypeScript/lint checks are running, not yet reported as
  passing. Source/dependency availability does not count as runtime validation.

### Round 13 — Independent candidate 1 source-contract results

- **Reviewer:** frozen-candidate agent suite passes 10/10; independent queue
  probes pass 5/5; historical front-door rendering without any providers passes
  4/4, now including Sam's saved-draft branch.
- **Checked-in new cases:** all 16 client-reliability tests individually pass,
  covering R1's discard race, R2's timestamp cases, R3's 10,000-edit shared
  completion/rebase behavior, and the capacity exception/rejected-URL guard.
  The broader retained-suite process is still running; individual new-test
  results do not imply its aggregate completion.
- **Artifacts:** `/tmp/ufd-phase6-reviewer/candidate1-agent.log`,
  `candidate1-queue.log`, `candidate1-historical.log`, and
  `candidate1-retained.log` in the same directory.
- **Disposition:** reviewer accepts R1–R3 implementation/test resolutions.
  Whole-phase runtime, production build, and measurement gates remain open;
  no phase approval is issued.
- **Aggregate completion:** all four reviewer processes subsequently exit 0.
  Retained plus client suite passes **110/110**, agent **10/10**: **120 checked-in
  tests**, zero failures/skips. Independent queue **5/5** and historical
  no-provider **4/4** also pass. Tested-source manifest:
  `/tmp/ufd-phase6-reviewer/candidate1-tested-source.json`. Typecheck/lint/build,
  production browsers, measurements, and final documentation remain open.

### Round 14 — Completed static checks, browser protocol, and baseline result

- **Implementer:** final TypeScript exits 0 with an empty
  `/tmp/ufd-phase6-implementer-typecheck.log`; full lint exits 0 with no errors and
  one inherited `layout.tsx` stylesheet warning in
  `/tmp/ufd-phase6-implementer-lint.log`. These are completed results.
- **Coordinator:** checked in `scripts/browser` and the `test:browser`,
  `test:browser:performance`, and `test:browser:neon` commands. Harnesses parse,
  but runtime execution was pending at this report. README documents their
  configuration, deterministic-client versus live-Neon scope, and exact fixtures.
- **Completed baseline:** `/tmp/ufd-phase6-browser/baseline-combined.json` has
  14 successful samples (five typing, nine history) and one unsuccessful third
  20-draft typing sample: typing took 139,401 ms, then recovery-queue drain
  exceeded 240 s. The failure remains recorded and must not be converted into a
  passing latency sample or dropped from the report.
- **Measurement limit:** shared-host contention prevents a precise timing
  improvement claim. Final deterministic work counts, same-fixture observations,
  and disclosed timing ranges must remain distinct from a throughput benchmark.
- **Disposition:** coordinator starts candidate production build. No completed
  build or browser result is inferred from that start.

### Round 15 — P6-R4: closing animation must have a finite owner

- **Implementer/reviewer — CHANGES REQUESTED:** implementer source review found,
  and reviewer independently accepted, that the modal waits for all
  descendant animations to finish. Populated Projects/Sessions can contain infinitely
  pulsing `StatusDot` animations, so closing can wait forever and leave the
  native dialog modal.
- **Required response:** await only the modal shell's own closing animations and
  defensively exclude infinite timelines, preserving interrupted-close/reopen.
  The coordinator will add a production regression that supplies an infinite
  child animation and verifies Escape completion and trigger-focus restoration.
- **Disposition:** P6-R4 open; implementer is fixing source. The existing
  candidate 1 build may support unaffected chunk-fault inspection, but cannot
  establish final approval. A corrected build and exact browser regression are
  required.
- **Implementer fix:** `Modal` and `CommandPalette` now wait only dialog-owned
  shell animations explicitly marked `data-modal-motion`, excluding infinite
  end times. Coordinator preserves original candidate 1 and rebuilds. Earlier
  type/lint/pure passes predate this two-file change; final reconciliation remains
  required. Browser proof must establish the infinite child is actually active,
  Escape finishes, focus restores, and reopen cancellation still works.
- **Targeted static check:** lint of both changed R4 files exits 0 in
  `/tmp/ufd-phase6-implementer-modal-lint.log`. Prior checks apply to unchanged
  source; the corrected production build and original/fixed browser proof remain
  pending.
- **Exact original production reproduction:** on build
  `69Flim4xyEkX2cF6UwhA2`, coordinator opens AM's real Sessions tab, confirms an
  active infinite working-status animation, presses Escape, and observes the
  dialog still open with `data-open=false` after more than 5 s. Artifact:
  `/tmp/ufd-phase6-browser/candidate1-r4-modal-working.json`. An earlier fixture
  attempt expected a Projects pulse that was absent; its timeout is retained as
  a harness error, separate from the confirmed Sessions reproduction.

### Round 16 — Original candidate production feature-fault evidence

- **Reviewer:** on original candidate 1 build `69Flim4xyEkX2cF6UwhA2`, held the
  real lazy-loaded chunk and observed the loading state with composer intact;
  aborted both automatic chunk attempts, then verified user retry; injected a
  canvas render failure and retained the pending disk-backed field through retry
  and acknowledgement; navigated away/reopened; and injected a transcript-mapping
  failure contained locally with successful retry. The exact composer DOM node,
  text, and selection survive every case.
- **Harness correction:** first execution stopped on a wrong expected Overview
  label, **Build** instead of actual **Build & Setup**. Correcting that label
  allowed the suffix run to exit 0 without application changes. Preserve the
  first artifact alongside the successful suffix; it is not a single complete
  final-candidate run.
- **Artifacts:** `/tmp/ufd-phase6-reviewer/candidate1-fault-browser.json` and
  `/tmp/ufd-phase6-reviewer/candidate1-suffix-fault-browser.json`.
- **Disposition:** preliminary production containment evidence on the original
  candidate. R4's corrected rebuild and a complete final feature-fault run remain
  required; this does not close the modal issue or approve Phase 6.
- **Coordinator follow-up:** checked the full fault harness into
  `scripts/browser/faults.mjs` and added it to `test:browser`. Candidate 2 build
  with R4 is running; neither a successful build nor a final runtime pass is
  claimed until completion.

### Round 17 — Independent candidate 2 source reconciliation

- **Reviewer:** candidate 2 runtime manifest matches current source **134/134**.
  Compared with candidate 1's runtime 134, only `CommandPalette.tsx` and
  `Modal.tsx` change for R4. Compared with the independently tested 119-file
  manifest, only those two components (outside the pure suites) and `package.json`
  browser commands differ; pure-tested implementations/tests and the lockfile
  are identical.
- **Disposition:** retain the 120 passing pure tests for unchanged source; use
  corrected-candidate browser/static/build checks to verify the R4 components.
  Reviewer will reconcile hashes again before final approval. Source equivalence
  does not stand in for the pending runtime gates.

### Round 18 — Corrected production build and exact modal replay

- **Coordinator:** candidate 2 production Next/worker build exits 0 with ID
  `V8BKV1rYPk0i5garjkeWR`. Runtime source 134 hashes match and all 11 historical
  immutable files remain unchanged. Browser-harness lint exits 0 with zero
  warnings/errors.
- **P6-R4 exact replay:** the real Sessions infinite-working-dot regression now
  passes, closing in 1,134 ms on the loaded host and restoring the correct
  trigger. The original build remained open beyond 5 s. Artifact:
  `/tmp/ufd-phase6-browser/candidate2-modal-working.json`. This elapsed value is
  an observed sample, not a new animation timing promise or stable latency bound.
- **Disposition:** full functional browser run is underway. Exact fixed-modal
  evidence is available, while reviewer closure, broader browser checks,
  comparison measurements, and final documentation remain pending.

### Round 19 — Candidate 2 interactions and reduced-motion backdrop failure

- **Coordinator:** real pulsing-dot close, a generic infinite-child animation,
  rapid reopen, keyboard tabs/caret/Escape/focus restoration in both motion
  modes, and normal-motion backdrop/navigation checks pass on candidate 2.
- **Observed failure:** reduced-motion backdrop dismissal does not restore focus
  in `candidate2-interactions.json` (harness line 98). Reviewer is constructing
  a minimal independent reproduction; implementer investigates native mouse
  default-focus ordering. This is a likely new R5, not yet a formally ratified
  finding or a confirmed root-cause claim.
- **Disposition:** aggregate browser command stops in interactions. Remaining
  functional suites, live Neon browser checks, and performance comparisons have
  not run; do not count the aggregate command as passing.
- **Independent P6-R5 — CHANGES REQUESTED:** reviewer reproduces reduced-motion
  dismissal closing the dialog but moving focus to BODY in **3/3 actual mouse
  clicks**; normal motion restores the trigger in **3/3**. Artifacts:
  `/tmp/ufd-phase6-reviewer/candidate2-backdrop-focus.json` and `.log`.
- **Agreed fix:** prevent the native mousedown default only when the backdrop
  itself is the event target, before dismissal. Native default focus racing
  immediate reduced-motion cleanup is the likely mechanism; the observed failure
  is independently confirmed. Candidate 3 must rebuild and pass the same probe
  plus the relevant complete browser gates.
- **Implementer:** applied the minimal backdrop-only `preventDefault` fix while
  preserving inner-dialog native behavior. Targeted lint is running; coordinator
  owns candidate 3 rebuild and reviewer will rerun the same real-click probe.
- **Independent artifact review:** reviewer accepts R4 source plus candidate 2
  behavior after reading the exact real Sessions pulse, generic infinite child,
  and rapid-reopen artifacts; normal transitions retain 0.5 s duration. Final
  candidate 3 rerun remains required. R5's minimal source fix is accepted in
  principle, pending the identical six-click production replay.
- **Completed R5 static check:** targeted `Modal.tsx` lint exits 0 in
  `/tmp/ufd-phase6-implementer-backdrop-lint.log`. Implementer freezes source and
  stops its processes; final production replay remains required.

### Round 20 — Candidate 2 remaining suites and candidate 3 build start

- **Coordinator:** candidate 2 follow-up suites pass **14 checks**, exit 0:
  agent regressions 3, budgets 6, and feature faults 5. The checked-in fault suite
  repeats the independent feature-containment cases successfully. Artifacts:
  `/tmp/ufd-phase6-browser/candidate2-followups-agent-regressions.json`,
  `candidate2-followups-budgets.json`, and
  `candidate2-followups-fault-browser.json`, plus combined log in that directory.
- **Harness refinement:** the final history-anchor check waits for the visible
  total of 121 messages before checking the selected page anchor, replacing a
  fixed sleep. The anchor assertion itself is unchanged.
- **Candidate handoff:** candidate 2 server stopped; candidate 3 runtime source
  manifest captures 134 files and its build starts with the R5 fix. Build start
  and retained candidate 2 passes do not claim final candidate 3 success.

### Round 21 — Independent P6-R5 final-candidate closure

- **Coordinator:** candidate 3 Next/worker production build completes with exit 0,
  ID `rEjMUuj5TBpt6E8MfaYYo`; the complete five-suite browser command is running.
- **Reviewer:** exact original six-click probe exits 0 on candidate 3 build
  `rEjMUuj5TBpt6E8MfaYYo`. All three reduced-motion and all three normal-motion
  backdrop clicks restore the exact trigger BUTTON; the original candidate 2
  reduced-motion failures remain recorded.
- **Artifacts:** `/tmp/ufd-phase6-reviewer/candidate3-backdrop-focus.json` and
  `.log`.
- **Disposition:** reviewer explicitly **CLOSED P6-R5**, accepting source and
  runtime resolution. Full candidate 3 functional, live-Neon, performance, and
  documentation gates remain open; this is a finding closure, not whole-phase
  approval.
- **Evidence retention:** coordinator requested a compact permanent baseline/
  final measurement JSON under `docs/phases` after final metrics arrive. The
  artifact must retain protocol, exact counts, baseline failure, and limitations;
  deterministic fixture data can be recorded without credentials. Final metrics
  are not yet available, so no comparison artifact is claimed.

### Round 22 — Complete final-candidate functional browsers

- **Coordinator:** all five functional browser suites exit 0 on candidate 3,
  **25 grouped checks**: real working-dot modal 1, interactions 10, agent
  regressions 3, budgets 6, and feature faults 5. This is the complete final
  command after R4/R5, rather than stitched partial runs.
- **Fixture reconciliation:** baseline/current deterministic fixture values
  deep-equal for 1/20 drafts and 20/80/128 messages. Normalized source differs
  only in formatter whitespace; the performance protocol is unchanged. Final
  performance results are still pending, so no improvement claim follows yet.
- **Live persistence:** the coordinator has started the separate actual-Neon
  owned-namespace browser test. Running is not a passing result.
- **Independent acceptance:** reviewer inspected all final candidate 3 functional
  artifacts: 25 grouped checks, every error list empty. R4/R5 are explicitly
  **CLOSED** on the final build; A1/A2/A4/A5 browser evidence is accepted. Final
  phase approval still depends on the remaining live persistence, measurement,
  reconciliation, and documentation gates.

### Round 23 — Actual-Neon client and command-order verification

- **Coordinator:** candidate 3 actual-Neon browser suite passes all **four grouped
  checks**, exit 0, errors `[]`, cleanup true, and empty owned-namespace journal:
  acknowledged save/reload; interrupted coalesced edit followed by immediate
  reload and retry of the exact latest field; persona isolation; and immediate
  edited-project creation with the correct revision and exactly one saved plan.
- **Scope:** the suite's own assessment uses targeted worker execution. It uses
  the existing authorized disposable Neon configuration and cleans only its own
  namespace. It does not claim a Heroku deployment, a new account setup, or a
  rerun of unrelated full SQL suites.
- **Artifacts:** `/tmp/ufd-phase6-browser/candidate3-neon-client.json` and `.log`.
- **Next gate:** coordinator starts all 15 final performance samples, with no
  other team-owned heavy process running. Results remain pending; external
  shared-host contention limitations continue to apply.
- **Independent artifact acceptance:** reviewer accepts the four actual-Neon
  checks, empty error list, successful cleanup, and empty namespace journal.
  All R1–R5 are resolved with no new in-phase findings. Remaining reviewer gates
  are measured comparison/limitations, final docs, and source reconciliation.

### Round 24 — P6-R6: remaining relative scenario summaries

- **Coordinator/reviewer — CHANGES REQUESTED:** final source audit finds two AM
  summaries in `fixtures.ts` still saying **last 4 min** and **no activity in
  25 min**, displayed by Sessions palette/WorkspacePanel. Reviewer confirms they
  violate the explicit timestamp criterion despite normalized timestamp fields.
- **Agreed fix:** change only those two summary literals to fixed UTC scenario
  times, rebuild candidate 4, and verify AM Sessions/WorkspacePanel displays.
- **Evidence reuse:** reviewer explicitly accepts candidate 3 JW performance and
  other behavior evidence only with exact provenance: benchmarks ran on C3, and
  C4 differs solely in those unrelated AM summary strings while JW fixtures stay
  unchanged. Do not relabel C3 benchmark execution as C4, weaken the timestamp
  criterion, or infer unchanged source without the final delta check.
- **Disposition:** P6-R6 open. Nine of 15 C3 measurement samples have completed;
  no partial aggregate improvement claim is recorded.
- **Implementer:** applies two fixed literals matching returning-work fixtures:
  handler last update **2026-09-14 14:56 UTC** and hotfix last activity
  **2026-09-14 14:35 UTC**. Fixture-only lint is running; no completed lint/build/
  display pass follows from this implementation report.
- **Reviewer sweep expansion:** scratch-org expiry still displays **5d left** in
  the palette and **Expires in 5 days** in the returning surface. Both must say
  **At capture: 5 days remaining** because no absolute expiry instant is known.
  Update the legacy-model comment accordingly, without inventing an expiry date.
  This expands the final source delta beyond two summaries and must be reflected
  in the final reconciliation. Reviewer accepts C3 benchmark reuse because the
  measured JW Build fixture does not render these org paths; benchmarks remain
  labeled C3.
- **Final scope ratification:** root/reviewer require both AM summaries and both
  org-label paths in the targeted browser check. Zero remaining days stays
  **Expired**. The model's `updated: string` comment explains zoned-ISO versus
  legacy policy. Final benchmark provenance must enumerate these presentation
  deltas, all absent from the measured JW rendered workload.
- **Final source report:** implementer freezes four changed files: two fixed
  summary literals in `src/lib/workspace/fixtures.ts`; captured-expiry labels in
  `src/components/app-shell/CommandPalette.tsx` and
  `src/components/surfaces/ReturningSurface.tsx`; and a `lastDeployed` policy
  comment in `src/lib/workspace/model.ts`. Four-file targeted lint exits 0 in
  `/tmp/ufd-phase6-implementer-timestamp-lint.log`. Candidate 4 build/display and
  exact source-delta reconciliation remain required.

### Round 25 — Complete measured comparison and independent acceptance

- **Coordinator:** all **15 C3 samples** complete successfully with exit 0,
  errors `[]`, and exact visible/saved 100-character values in every typing
  sample. Use finalized JSON after blur and queue drain; intermediate console
  POST counts precede the final flush and are not the measurement record.
- **Reviewer:** independently inspects both raw artifacts and accepts P6-A6:
  baseline 14 successes plus one retained 240 s drain timeout; measured C3 15/15
  success; exact work counts and mounted-history bounds; timing limitations
  explicitly disclosed. Candidate 4 R6 display/build/provenance and final docs/
  hashes remain open.
- **Permanent artifact:** [Client measurements](phase-6-client-measurements.json)
  preserves the completed numeric samples, protocol, original artifact hashes,
  baseline failure, and measured **C3** build `rEjMUuj5TBpt6E8MfaYYo`. Final C4
  build/provenance fields remain pending until verified. Measurements were not
  executed on C4.
- **Server diagnostic observation:** four buffered C3 server diagnostics report
  `aborted` / `ECONNRESET`. Their cause is unconfirmed; the process survives and
  completes subsequent passing checks. No application failure or speculative
  fix is established. Reviewer requests a bounded fresh C4 server-output and
  HTTP-health check during ordinary AM display verification, with the observation
  retained rather than silently discarded.
- **Independent permanent-artifact verification:** reviewer verifies every
  numeric row against both raw JSON sources and confirms both stored source
  hashes. Sample counts, failure, and timing limitations are accurate. A6/A8
  measurement documentation is accepted pending the final C4 build/provenance
  fields.

### Round 26 — Final candidate 4 build and source provenance

- **Coordinator:** candidate 4 full Next/worker build exits 0 with ID
  `vOQRs6yqFvz3Jt_Sp2pHs`. Current runtime hashes match all 134 entries; the exact
  C3→C4 delta is the reviewed four-file summary/expiry/comment change. R6 source
  lint and new timestamp-harness/runner lint exit 0.
- **Scribe:** fills the permanent measurement artifact's final application build
  and verified four-file delta. Measurements remain explicitly **C3**, not C4.
- **Pending evidence:** AM display tests and fresh-server output/HTTP observation
  are running. Neither final R6 closure nor phase approval is claimed yet.

### Round 27 — Final display/health evidence and independent R6 closure

- **Coordinator:** candidate 4 timestamp suite passes **4/4**, exit 0, errors
  `[]`, covering both AM summaries and both expiry-label paths. Artifact:
  `/tmp/ufd-phase6-browser/candidate4-timestamps.json`. Subsequent login and
  session API checks return HTTP 200, curl exit 0; fresh ordinary-navigation
  server output has zero disconnect/uncaught-exception diagnostics and only the
  inherited pg future-major SSL-mode warning. Observation is recorded in
  `candidate4-http-health.json` in the same directory.
- **Cleanup:** coordinator stops the final server with Ctrl-C, exit 130. Final
  runtime 134/historical 11 hashes and `git diff --check` pass. No team-owned test
  process remains running.
- **Independent reviewer:** inspects final timestamp/HTTP/output artifacts,
  closes R6, verifies runtime **134/134** and immutable **11/11**, and accepts the
  exact C3→C4 four-file presentation/comment delta for evidence reuse. No
  unresolved runtime criterion remains.
- **Final handoff:** scribe completes the permanent artifact's C4 provenance and
  reconciles current synthesis/ledgers/README/plan. Whole-phase approval remains
  explicitly pending the final documentation read and exact reviewer decision.

## Measured client work

Same deterministic API fixtures, 80 ms per save, Node 22/Playwright 1.63.0,
Chromium 153.0.8010.12, 1440×1100 viewport, 4× CPU slowdown. Each completed typing
sample includes 100 edits, blur, and full queue drain. Baseline has three completed
1-draft and two completed 20-draft samples; C3 has three of each. Both history
sets have three samples per size. Values below are ranges across completed
samples, not estimates for unmeasured production traffic.

| Workload / metric | Phase 5 baseline | Measured C3 |
| --- | --- | --- |
| 1 draft: save POSTs for 100 edits | 100 | 5–8 |
| 20 drafts: save POSTs for 100 edits | 100 | 6–8 |
| 1 draft: recovery writes / bytes | 199 / 3,508,569–3,633,397 | 104–107 / 84,892–87,342 |
| 20 drafts: recovery writes / bytes | 199 / 3,491,016–3,537,875 | 105–107 / 83,364–92,897 |
| 20 history entries: mounted messages / briefings / DOM nodes | 20 / 3 / 607 | 20 / 3 / 493 |
| 80 history entries: mounted messages / briefings / DOM nodes | 80 / 10 / 1,662 | 40 / 5 / 729 |
| 128 history entries: mounted messages / briefings / DOM nodes | 128 / 16 / 2,556–2,558 | 40 / 5 / 729 |

| Timing observation | Phase 5 baseline | Measured C3 |
| --- | --- | --- |
| 1 draft: typing duration | 22.228–29.718 s | 19.197–22.007 s |
| 20 drafts: typing duration, completed samples only | 37.772–75.075 s | 19.595–22.492 s |
| 1 draft: p95 input → next animation frame | 223.5–280.9 ms | 136.8–169.6 ms |
| 20 drafts: p95 input → next animation frame | 429.7–1,055.7 ms | 158.5–194.9 ms |
| 20 history entries: ready time | 20.469–42.950 s | 13.365–13.625 s |
| 80 history entries: ready time | 14.349–19.290 s | 14.363–18.854 s |
| 128 history entries: ready time | 28.217–60.642 s | 16.208–18.437 s |

**Limits:** the unsuccessful third baseline 20-draft sample typed for 139.401 s
then exceeded the 240 s drain allowance; it remains a failed sample rather than
being omitted or counted as a completed timing. Unrelated shared-host CPU work
confounds timing, so these observations support **no precise latency speedup**.
The work counts support fewer save requests/recovery writes and a 40-entry
mounted-history bound for these fixtures. Full recovery-envelope strings are
still written synchronously per edit; API snapshots remain bounded whole reads
(16 MiB application / 24 MiB agent). These are not database-throughput, Heroku-load,
or unlimited-scale measurements. Raw request/task/heap and all sample values are
retained in the compact linked JSON.

## Review finding ledger

| ID | Finding | Required disposition | Status / independent evidence |
| --- | --- | --- | --- |
| P6-R1 | Deferred same-field coalescing lets **Use saved version** discard edits typed after the click while refresh is pending. | Protect the reviewed command set/version; retain later edits and cover `enqueueEdit` delayed-read race. | Resolved/independently accepted: clicked identities freeze before GET; original probe and checked-in candidate regression pass. |
| P6-R2 | `SampleTimestamp` mislabels an explicit-offset wall-clock time as UTC. | Normalize valid zoned timestamps, define timezone-less/legacy policy, and test all three cases. | Resolved/independently accepted: zoned ISO normalized, unknown instant retains At capture text; checked-in cases pass. |
| P6-R3 | Merged completion recursively retains a promise/resolver chain proportional to edit count, risking overflow after long offline editing. | Share bounded completion ownership per command; clean terminal entries; transfer unresolved tails during Keep Local rebase; test long edit/rebase/deactivation. | Resolved/independently accepted: 10,000-edit/shared-promise/rebase/deactivation cases pass on reconciled pure-tested source. |
| P6-R4 | Modal dismissal waits for infinite descendant status-dot animations and can remain modal forever. | Await only shell-owned closing animations; verify production infinite-child Escape/focus restoration and reopen on corrected build. | Independently CLOSED on final C3: complete real Sessions/generic infinite-child close/focus/reopen checks pass; original hangs beyond5s. |
| P6-R5 | Reduced-motion backdrop dismissal closes dialog but native focus ends on BODY instead of trigger. | Prevent backdrop-only mousedown default before dismissal; same real-click probe and full relevant gates on rebuilt candidate. | Independently CLOSED on C3 build`rEjMUuj5TBpt6E8MfaYYo`: exact6-click probe exit0,3/3 reduced+3/3 normal restore exact trigger. Full phase gates remain separate. |
| P6-R6 | Two AM summaries and two scratch-org expiry displays retain permanently relative scenario wording. | Use fixed known UTC summary times; label unknown expiry as At capture; rebuild C4 and verify displays; reconcile C3 JW measurement provenance. | Independently CLOSED: four-file fix/lint, final C4 build/timestamp4, exact delta and accepted C3 provenance. |

## Validation evidence

| Check | Artifact / candidate | Exact result and limits |
| --- | --- | --- |
| Independent recovery/coalescing adversarial probe | `/tmp/ufd-phase6-reviewer/discard-edit-race.mjs`; in-progress candidate | Confirmed P6-R1 data loss after discard click and same-field edit during delayed fresh read. Failing evidence, not final acceptance. |
| Independent exact P6-R1 fixed replay | `/tmp/ufd-phase6-reviewer/discard-edit-race-fixed.log`; subsequent in-progress candidate | Exit 0; retains post-click notes and conflict status. Checked-in permanent regression later passes in candidate120; reviewer accepts implementation/test resolution. |
| Independent queue contracts | `/tmp/ufd-phase6-reviewer/queue-contracts.{mjs,log}`; in-progress source | 5/5 pass: 100 caller resolutions/immediate buffer, attempted-head immutability, reload before debounce, maximum delay, cross-aggregate order. Not frozen-candidate evidence. |
| Frozen Phase 5 production baseline build | `JFIHR0mXQjOKCeNHr9o9m`; `/tmp/ufd-phase6-baseline-build.log`; source156 | Node 22 `npm run build` passes, including worker. Historical immutable11 unchanged. Baseline-only result. |
| First baseline client-work sample | 1 draft / 100 edits / 20 mixed history entries; 4× CPU slowdown; mocked API | 100 POSTs, 199 recovery writes / 3,508,569 bytes, 22,228 ms Playwright typing, p95 input→next RAF 223.5 ms. Single sample; no final comparison claim. |
| Independent historical-provider isolation | `/tmp/ufd-phase6-reviewer/historical-pure.log`; in-progress source | JW/SP/AM historical render without providers passes (3 personas). Initial omitted `.ts` module was a harness-only load failure; corrected harness includes `.ts`/`.tsx`. Not a browser subscription count. |
| Implementer preliminary new suite | `npm run test:client-reliability`; in-progress source before timestamp regression | Initial10-case run passes; historical preliminary evidence superseded by independent final16-case coverage within candidate120. |
| Independent candidate 1 source contracts | `/tmp/ufd-phase6-reviewer/candidate1-{agent,queue,historical,retained}.log` | Agent10/10, queue5/5, historical4/4, and all16 checked-in client cases pass. Reviewer accepts R1–R3 implementation/test resolutions. |
| Independent candidate 1 aggregate completion | Same four logs; `/tmp/ufd-phase6-reviewer/candidate1-tested-source.json` | All exit0. Retained/client110 + agent10 =120 checked-in tests,0 failures/skips; independent queue5/5 and historical4/4 also pass. Static/build/full functional gates subsequently pass; unchanged pure-tested source reconciled. |
| Completed candidate static checks | `/tmp/ufd-phase6-implementer-{typecheck,lint}.log` | Both exit0. TypeScript emits no errors; lint has one inherited stylesheet warning,0 errors. |
| Completed baseline sample set | `/tmp/ufd-phase6-browser/baseline-combined.json` | 14 successes:5 typing +9 history. Third20-draft typing took139,401ms then timed out draining at240s; retained failure. Shared-host contention limits timing claims. |
| Independent original-candidate feature faults | Build`69Flim4xyEkX2cF6UwhA2`; `/tmp/ufd-phase6-reviewer/candidate1-{fault-browser,suffix-fault-browser}.json` | Original+suffix fault cases pass, exact composer retained. Initial incorrect Overview label corrected without app change. Complete C3 fault5 subsequently passes and reviewer accepts final evidence. |
| Exact original P6-R4 production reproduction | Build`69Flim4xyEkX2cF6UwhA2`; `/tmp/ufd-phase6-browser/candidate1-r4-modal-working.json` | Real AM Sessions working dot has an active infinite animation; Escape leaves dialog open with closing state beyond5s. Confirms defect. Earlier wrong Projects-pulse fixture timeout preserved separately. |
| Independent candidate 2 source reconciliation | Candidate2 runtime134 and reviewer tested-source119 manifests | Current runtime134/134 matches. Only Modal/CommandPalette differ from C1 runtime; package browser scripts also differ from pure-tested manifest. All pure-tested code/tests/lockfile unchanged, retaining120pass; final C4 runtime134/immutable11 hashes independently verified. |
| Corrected candidate 2 build/static reconciliation | Build`V8BKV1rYPk0i5garjkeWR`; runtime134 / historical11 | Next+worker build exits0; runtime134 hashes match; historical11 unchanged; browser-harness lint0errors/0warnings. |
| Exact fixed P6-R4 production replay | `/tmp/ufd-phase6-browser/candidate2-modal-working.json`; build`V8BKV1rYPk0i5garjkeWR` | Real Sessions infinite-dot Escape closes/restores trigger (1,134ms observed). Complete C3 replay subsequently passes; reviewer closes R4. |
| Candidate 2 interactions | `/tmp/ufd-phase6-browser/candidate2-interactions.json` | Infinite-child/reopen/keyboard/caret/Escape both-motion and normal backdrop/navigation pass; reduced-motion backdrop fails. Original aggregate stops; C2 follow-ups and corrected complete C3 run subsequently pass. |
| Independent original P6-R5 real-click probe | `/tmp/ufd-phase6-reviewer/candidate2-backdrop-focus.{json,log}` | Reduced-motion backdrop3/3 loses focus to BODY; normal-motion3/3 restores trigger. Original confirmed failure retained; exact C3 replay passes and R5 closes. |
| Candidate 2 follow-up browser suites | `/tmp/ufd-phase6-browser/candidate2-followups-{agent-regressions,budgets,fault-browser}.json` and combined log | All14 checks pass/exit0: agent3,budgets6,faults5. Complete C3 replay subsequently passes after R5. |
| Independent final-candidate P6-R5 closure | Build`rEjMUuj5TBpt6E8MfaYYo`; `/tmp/ufd-phase6-reviewer/candidate3-backdrop-focus.{json,log}` | Exact original probe exit0; reduced3/3 and normal3/3 restore exact trigger. Reviewer explicitly closes R5; final C4 delta accepted for reuse. |
| Complete candidate 3 functional command | Build`rEjMUuj5TBpt6E8MfaYYo`; five checked-in browser suites | Exit0,25 grouped checks: modal1,interactions10,agent3,budgets6,faults5; all errors[]. Reviewer accepts A1/A2/A4/A5 browser evidence and closes R4/R5. Live-Neon4 and comparison subsequently pass; final C4 delta accepted. |
| Candidate 3 actual-Neon browser | `/tmp/ufd-phase6-browser/candidate3-neon-client.{json,log}` | 4 grouped checks pass/exit0/errors[]: save+reload, interrupted-coalesced immediate reload+retry, persona isolation, correct-revision immediate project creation with one plan. Cleanuptrue, owned-namespace journal[]; reviewer independently accepts evidence. |
| Completed measured comparison | `/tmp/ufd-phase6-browser/candidate3-performance.json`; [permanent compact artifact](phase-6-client-measurements.json) | Measured C3 fifteen successful samples/exit0/errors[]; baseline14 successes+retained timeout. Reviewer independently accepts A6 counts/limits. Final C4 delta/build provenance independently accepted; no precise timing-speedup claim. |
| Final candidate 4 build/provenance | Build`vOQRs6yqFvz3Jt_Sp2pHs`; runtime134 | Full Next+worker build0, runtime134 match, exact reviewed4-file C3→C4 delta; source/harness lint0. Measurement artifact filled with final build while preserving measuredC3. Displays4/HTTP200/clean ordinary-server observation subsequently pass; final independent approval recorded below. |
| Final C4 timestamp displays and ordinary-server health | `/tmp/ufd-phase6-browser/candidate4-{timestamps,http-health}.json` | Timestamp4/4 exit0/errors[]; login/session HTTP200 and clean fresh output except inherited pg future-major warning. Reviewer closes R6, verifies runtime134/immutable11, and accepts evidence reuse. Server stopped by coordinator, exit130. |

Baseline measurements and historical intermediate results are distinguished from
final evidence. All technical gates pass and the reviewer independently accepts
R1–R6 resolutions, final source reconciliation, and retained-evidence provenance.
The final documentation read is complete and the whole-phase approval is recorded
below. No criterion or finding remains unresolved.

## Remaining work

Phase 6 is complete. No required implementation, validation, or documentation work
remains. Stop for the user's Phase 7 checkpoint; no next-phase work, commit, or
deployment is included.

## Approval and user checkpoint

**Independent reviewer decision — September 16, 2026:**

> APPROVED — 100% of Phase 6 acceptance criteria satisfied.

The reviewer completed the final README/plan/journal/measurement-provenance read,
accepted all P6-A1–P6-A8, and closed R1–R6. Final build
`vOQRs6yqFvz3Jt_Sp2pHs`, runtime134, and immutable11 are independently verified.
Measured C3 results and the exact accepted C4 presentation/comment delta remain
explicit; the baseline timeout, timing limits, and original failure evidence are
preserved. No approval relies on an unexecuted check or waived criterion.

**User checkpoint:** Phase 6 is approved. Phase 7 requires the user's next
checkpoint response. No commit or deployment occurred; all test processes are
stopped.
