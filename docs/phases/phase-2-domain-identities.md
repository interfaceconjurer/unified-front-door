# Phase 2 — Domain history and identities

**Started:** September 15, 2026  
**Status:** Approved — awaiting the user's Phase 3 checkpoint  
**Baseline:** Phase 1 approved working tree, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md)  
**Findings:** F2, F4, and domain portions of F3/F5 in the [architecture review](../architecture-review.md)

## Scope and roles

The user authorized this phase after the Phase 1 checkpoint with “Let's do it same
drill baby.” This phase separates project ownership and historical evidence from
the onboarding simulation, defines stable run/draft/canvas identities, and preserves
existing browser records through migration. Neon persistence remains Phase 4.

- **Implementer:** `phase2_implementer`, application code and tests.
- **Reviewer / approver:** `phase2_reviewer`, independent review and acceptance.
- **Scribe:** `phase2_scribe`, this journal, plan status, and README.
- **Coordinator:** primary agent, scope coordination, independent checks, production build/browser evidence, and user checkpoint.

Substantive implementation/review exchanges are copied to the scribe and
coordinator. The reviewer must approve final documentation and all eight criteria
before the coordinator stops for the user's Phase 3 checkpoint. No agent approves
its own implementation. “100%” means supported acceptance criteria and no unresolved
in-phase finding; it is not a promise that no other defect exists.

## Acceptance ledger

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P2-A1 | Independent project/work-item domain ownership; planning projects have no fabricated repository/worktree in active consumers | Reviewer source/domain tests pass; final production browser confirms planning creation/navigation without fabricated worktrees |
| P2-A2 | Structural historical parsing preserves identity, copied findings/evidence/provenance, unavailable references, and truthful legacy recovery across catalog/connection changes | Independent history/graph/codec probes pass; final legacy and idle/running/paused/complete scope-recovery browser checks pass |
| P2-A3 | Runs permit recurring findings; commands are idempotent; drafts capture origin and use targeted field updates preserving unrelated edits | Independent rescan/origin/replay/revision/field/runtime tests pass; final origin/recurrence/scope-preserving creation browser flow passes |
| P2-A4 | Domain-owned Today/conversation types and copied bounded historical snapshots, independent of live changes and full-store size | Independent cap/mutation/live-completeness probes and final historical production-browser flow pass |
| P2-A5 | Shared exhaustive surfaces, discriminated type/runtime canvas contracts, collision-free canonical IDs independent of labels | Domain tests and negative type assertions pass; work ownership/surface guards independently verified |
| P2-A6 | Active/open/closed legacy migration preserves content including ambiguous identities; Phase 1 contracts and existing flows survive | Migration/collision/archive/sole-copy probes and 20 persistence tests pass; final actual archive download/manual Apex recovery/canonical reopen browser pass; accepted unaffected Phase 1 browser regressions retained |
| P2-A7 | Focused and existing suites, lint/build on Node 22, and meaningful production-browser affected-flow checks | Independent 58 tests, lint/diff, final Node 22.23.2 build, and all required final/retained browser checks pass; reviewer directly inspected and accepted final artifacts and source checksums |
| P2-A8 | README, plan, decisions, review rounds, evidence, limits, and exact explicit reviewer approval | Reviewer accepted final README/plan/journal evidence and limits, issued full approval recorded below; Phase 3 remains user-gated |

The [plan](../architecture-plan.md#acceptance-criteria-p2-a1-through-p2-a8)
contains the full criteria. Criteria cannot be weakened or findings silently
deferred to obtain approval.

## Design decisions

1. Domain separation does not require separate browser-storage writes. A single
   serialized application-state envelope behind an onboarding compatibility facade is
   acceptable while project, run, finding, and draft ownership become explicit.
   One storage write does not provide transactional coordination between browser
   tabs. Actual relational persistence and import are Phase 4 work.
2. Historical records are application-owned facts. Present fixture availability
   and connection status may affect future actions; they must not erase saved
   plans during deserialization. Legacy missing evidence must be labeled honestly.
3. Phase 2 may adapt active workspace consumers to represent planning projects
   without fabricated Git resources. A unified navigation controller, explicit
   capability-draft context assignment, and general workspace-state redesign stay
   in Phase 3.
4. The coordinator owns the final build and browser runs, preventing competing
   `.next` builds. Review/test evidence distinguishes earlier candidates from the
   final approved candidate.
5. The agreed implementation uses pure `src/lib/assessment` and `src/lib/projects`
   domain owners behind the existing browser facade. Schema version 2 separates
   runs/current-run identity from project records. New runs capture finding and
   evidence snapshots, source-version provenance, and org labels; saved work items
   retain their own historical basis.
6. Draft identity, originating run, and revision are explicit. Field commands
   target a draft; project creation deduplicates by command identity rather than
   permanently excluding a finding across runs.
7. Canvas inputs form a per-kind union with runtime validation. Canonical identity
   uses an unambiguous JSON tuple and excludes display labels. Migration updates
   active/open/closed references together and retains ambiguous draft content in
   an archive with visible recovery.
8. An old closed draft stored only by a multi-field delimiter key cannot generally
   recover its identity: old values were unescaped. Do not guess. Preserve that
   content in a visible copy/export archive, even when it looks like an ordinary
   closed capability draft such as Apex. Canonical version-2 identities, uniquely
   matching surviving structured open specs, and safe single-field legacy IDs may
   restore automatically. Competing content must survive as separate records.
9. A rescan retains an existing project draft and its originating run. Draft
   rendering uses that run's findings; creation requires that origin to be complete
   and uses its captured scope. Starting another draft cannot implicitly replace
   the existing one; discard is explicit.
10. Today history has explicit projection budgets: 20 findings, 12 recent projects,
    100 finding references per project, 12 evidence/step entries per finding, and
    2,000 characters per evidence/step or general display-text value. Draft name
    and goal have their own 100/1,500-character display budgets. Identity join keys
    remain intact. Visible totals/truncation notices describe omissions; complete
    domain records and live editing remain uncapped by these history budgets.

## Review rounds

### Round 0 — Scope and acceptance alignment

- **Coordinator:** assigned implementer/reviewer/scribe roles and proposed P2-A1–A8
  covering all existing Phase 2 plan scope. Existing storage keys and Phase 1
  guarantees must survive. Later phases remain gated.
- **Reviewer:** confirmed the criteria. Requested structural catalog-independent
  parsing; truthful treatment of missing legacy evidence; copied, bounded Today
  snapshots; draft/run-targeted commands and explicit idempotency; preservation of
  ambiguous collision drafts; canonical identity independent of labels; and
  planning-project consumers that never invent `main`.
- **Reviewer:** accepted one persistence envelope plus compatibility facade as a
  domain-separation implementation option.
- **Implementer:** proposed the domain modules, schema/run/finding snapshots,
  targeted draft commands, idempotent creation, zero-worktree planning projects,
  bounded Today projections, typed canvas identities, and recovery archive recorded
  above.
- **Reviewer / coordinator:** accepted the concrete design. Reviewer additionally
  requested unsupported inner-schema protection; archive survival through
  reload/write plus visible recovery; work/project/worktree mismatch protection so
  a canvas cannot render one work item while retargeting the shell elsewhere; a
  nullable-worktree audit across palette/workspace/AgentPanel; and captured org
  labels/source versions.
- **Disposition:** scope and implementation design aligned. Implementation and
  acceptance verification remain pending; this is not approval.

### Initial documentation review — Browser write precision

- **Reviewer:** the phrase “atomic application-state envelope” could imply
  transactional coordination between browser commands/tabs that Phase 1 explicitly
  does not provide. Requested “serialized” or an explicit limitation.
- **Scribe:** changed plan/journal wording to “serialized” and stated that one
  storage write does not provide transactional coordination between tabs.
- **Disposition:** wording corrected; no implementation change or scope change.

### Round 1 — Legacy evidence and captured project scope

- **Reviewer:** legacy evidence placeholders assigned the category `Automation`,
  fabricating a source classification that the original record did not retain.
- **Implementer:** changed that classification to `Unknown`.
- **Reviewer confirmation:** verified the corrected category; this finding is
  resolved.
- **Further reviewer precision:** legacy drafts retained finding IDs without
  priorities. Their synthesized run findings must show `Unknown`/unrecorded or
  suppress priority instead of claiming `Medium`. Saved legacy project work items
  did retain priority and must preserve it. Correction/retest pending.
- **Reviewer independent probe:** `/tmp/phase2-review-domain.cjs` exercised a valid
  legacy draft whose migrated run retained scope `['prod', 'uat', 'sit']`. Creating
  a project instead set `project.scopeOrgIds` to `['unknown']` by deriving it from
  unavailable-evidence placeholders.
- **Requested change:** pass the captured originating run scope into project
  planning; unavailable evidence must not erase known scope.
- **Other probe results:** earlier run preservation after rescan, explicit
  creation-command replay, and stale draft-field rejection passed.
- **Reviewer independent retest:** reran `/tmp/phase2-review-domain.cjs` on Node 22
  and verified that project creation now retains the legacy draft's known run
  scope. Run preservation, command replay, and stale-field checks continue to pass.
- **Disposition:** category and captured-project-scope findings resolved; the
  additional legacy-priority precision check remains pending. No full approval.

### Canvas migration policy alignment

- **Reviewer / implementer:** agreed that ID-only legacy multi-field keys are
  ambiguous because delimiter characters were never escaped. A migration must
  retain a visible copy/export recovery record instead of inferring a potentially
  wrong identity.
- **Documentation requirement:** state explicitly that some ordinary closed
  capability drafts also need manual recovery. Automatic restoration is limited to
  canonical version-2 IDs, unique surviving structured open-spec matches, and safe
  single-field legacy IDs. Preserve competing bytes separately.
- **Disposition:** policy agreed; implementation, recovery UI, persistence/reload,
  and collision verification remain pending.

### Round 1 continued — Competing drafts and captured-origin integrity

- **Reviewer independent Node 22 probe:** a valid legacy open query and a closed
  record under the same old ID contained different bytes. Migration left the
  closed bytes hidden; `closeCanvas` then overwrote them, and reload lost them
  (`preserved: false`).
- **Requested change:** move competing content into distinct recovery records
  before any open/closed identity is merged or overwritten.
- **Coordinator / reviewer:** an incidental rescan clearing an edited project
  draft violates captured-origin intent. Requested retaining the draft against its
  prior run, rendering that run's findings, and allowing creation from its completed
  origin independently of the most recent run.
- **Additional reviewer requests:** explicitly whitelist fields when decoding;
  qualify migrated finding IDs by run; validate duplicate identities, positive
  integer revisions, and draft/run references.
- **Implementer response:** accepted origin-bound draft preservation. A rescan
  retains the draft, `draftProjectFindings` resolves its originating run, creation
  validates that origin's completion and uses its scope, beginning a new draft
  refuses replacement, and discard is explicit. Also set Today projection budgets
  to 20 findings / 12 recent projects / 12 evidence rows with a visible truncation
  notice. The competing closed-content archive fix is in progress.
- **Reviewer independent retest:** the Node 22 domain probe now confirms competing
  same-target open/closed bytes are archived and survive close/reload. This
  data-loss finding is resolved.
- **Disposition:** changes accepted for implementation; independent regression
  checks and remaining fixes pending. No criterion was deferred and no approval
  was issued.

### Round 1 continued — Bounded Today projection

- **Coordinator / reviewer:** a retained prior-run draft must project its own
  origin's findings. Identity join keys must remain intact when display text is
  bounded. Slice/select before copying full arrays so a small projection does not
  first duplicate all source data.
- **Requested corrections:** make the truncation flag cover every actual omitted
  count/text value; cap or omit unused recent-work/provenance fields; and move the
  pure `currentFindings` selector out of the browser adapter's runtime dependency.
- **Disposition:** corrections and independent size/mutation probes pending.

### Round 1 continued — Live views and canvas boundary consistency

- **Coordinator:** DayZeroHome reused the bounded historical projection for live
  editing. That could hide findings after the first 20 and older allocation
  references, and clip editable draft text. Required a complete live projection;
  historical snapshot budgets apply only to copied history.
- **Reviewer:** work canvases accepted a mismatch between their declared and
  enclosing surface, allowing WorkCanvas to write to another surface's store. The
  host also applied claimed workspace context before the renderer rejected
  ownership mismatches.
- **Requested change:** enforce consistent resolved-work and surface guards across
  host/render/write boundaries while retaining unavailable legacy content.
- **Disposition:** both corrections and independent verification pending.

### Implementer correction handoff

- **Implementer:** reports legacy category and draft priority now use `Unknown`,
  captured origin scope is retained, competing open/closed content is archived,
  rescan preserves the existing origin-bound draft, and explicit discard is the
  only replacement path.
- **Implementer:** reports one work-identity resolver now guards store/parser,
  rendering, and context. Historical Today projection follows the recorded budgets
  with intact identity keys and visible counts; live editing uses the complete
  view. Strict inner schema/revision/duplicate-identity validation remains underway.
- **Recovery UI:** a **Recovered legacy drafts** details section provides
  **Export recovered drafts** and a read-only original-JSON text area per record
  for manual selection/copy. This preserves content rather than assigning an
  uncertain target.
- **Early checks:** implementer reports one successful type check; test suites are
  running through a new shared transpiler of real modules. These are interim
  results, not final-candidate acceptance evidence.
- **Disposition:** independent review/retests and final validation pending.

### Independent expanded domain verification and remaining UI guards

- **Reviewer:** expanded `/tmp/phase2-review-domain.cjs` on Node 22 passes creation
  from an origin-bound draft while a newer scan runs, preserving the original
  scope. Fixture rename/removal, evidence mutation, and target expiry leave
  reloaded saved plans intact.
- **Reviewer:** history caps 20 findings / 12 projects / 12 evidence entries of
  2,000 characters while the live view retains all 45 findings / 40 projects in the
  probe. A copied snapshot stays unchanged after source mutation. Wrong-surface
  work input is rejected.
- **Measured fixture:** serialized bounded history was 510,439 bytes. This is an
  illustrative adversarial-fixture measurement, not a universal byte cap; stable
  identity keys intentionally remain complete.
- **Coordinator's remaining UI requests:** preserve an expired draft target as an
  explicitly unavailable option/message and disable **Create project**; identify
  a draft that belongs to an earlier scan. The start/save-draft API guard also
  remains under review.
- **Disposition:** listed probe checks pass; UI/command guards, final suites,
  build/browser evidence, and documentation approval remain pending.

### README candidate review

- **Scribe:** updated implemented domain/storage ownership, historical snapshots
  and legacy unknowns, captured-origin draft behavior, planning without fabricated
  worktrees, historical-only display budgets, and exact copy/export recovery
  limitations. Verification commands await the new suite handoff.
- **Reviewer:** inspected the candidate and found the history/storage/manual
  recovery boundaries accurate. “Copied display projections” correctly avoids a
  universal byte-cap or mutation-prevention claim. No README changes requested at
  this stage; final validation/journal review remains pending.

### Round 2 — Complete historical references

- **Coordinator / reviewer:** migrated saved projects referenced synthetic run IDs
  that were absent from the run collection. The Phase 2 records must form a
  complete reference graph before later relational persistence work.
- **Requested correction:** materialize deterministic legacy-provenance runs from
  saved project scope and embedded unavailable-evidence snapshots. Keep unknown
  scan start/completion times `null`; a project's creation time does not establish
  when its assessment ran.
- **Reviewer source confirmation:** deterministic legacy runs are now materialized,
  completing saved project/run references. The new domain suite passes its
  historical migration checks.
- **Disposition:** correction implemented and source/test review passed; final
  candidate validation remains pending.

### Round 2 continued — Captured create-command boundary

- **Reviewer source confirmation:** the stale whole-`saveDraft` API is removed;
  beginning a draft requires its observed run and refuses implicit replacement.
  Unavailable-target and earlier-run notices are implemented.
- **Reviewer independent suite run:** all four Node 22 suites pass: 14 domain,
  20 persistence, 9 onboarding, and 9 conversation tests (52 total).
- **Coordinator / reviewer:** the remaining optional owner-only project-creation
  path could bypass the captured command boundary. Requested a required command
  containing draft ID, command ID, and positive integer expected revision, with
  runtime validation.
- **Disposition:** create-command correction and final retest pending. The 52-test
  result describes the candidate before that correction.

### Final candidate handoff

- **Implementer:** removed `saveDraft`; `beginDraft(observedRunId, fields)` refuses
  replacing an existing draft. `createProject` now requires
  `{ draftId, commandId, expectedRevision }` in both its type and runtime boundary,
  validates a positive integer revision, and returns an already-created result
  safely when its creation command is replayed.
- **Implementer validation:** 15 domain + 20 persistence + 9 onboarding + 9
  conversation tests pass (53 total). Type checking passes, including four
  `@ts-expect-error` canvas-contract assertions. Lint exits 0 with the existing
  layout stylesheet warning; `git diff --check` is clean.
- **Disposition:** source frozen for the coordinator's final build/browser checks
  and independent reviewer retest at handoff. Subsequent self-review below reopened
  two findings; that handoff is not the final approved candidate.

### Round 3 — Missing legacy results and closed-draft ownership

- **Implementer self-review / reviewer:** a completed legacy assessment without a
  draft had no saved historical finding list, but the UI implied zero findings/no
  flagged issues. Required an explicit unavailable-original-results message and
  rescan path. If a migrated unfinished run later completes a real demo scan, its
  provenance must reflect that capture rather than remain legacy-only.
- **Implementer self-review / reviewer:** opening a canonical closed draft copied
  its bytes into the open tab without consuming closed ownership. After editing
  and reload, the stale closed copy could be unnecessarily archived as conflicting
  recovery data. Required ownership transfer on reopen and a regression proving
  normal reopen/edit/reload does not create false recovery records.
- **Reviewer independent probes:** completed graph/reference, codec field
  whitelisting, and revision checks pass.
- **Disposition:** both newly identified corrections and regression checks pending.
  The coordinator's already-running build covers the earlier candidate; a final
  build must follow these fixes.

### Interim build/browser evidence and harness correction

- **Coordinator:** the Node 22 production build passed after the required-command
  fix, before Round 3's self-review corrections. It is superseded and must be rerun.
- **Coordinator browser run:** fresh-flow functional assertions passed for
  history, retained draft origin, rescan/recurrence, failed save, and reload;
  retired-project legacy migration assertions also passed. The final empty-page-
  errors assertion failed because a temporary initialization script touched
  `sessionStorage` on `about:blank`.
- **Harness correction:** restrict the temporary initializer to the application
  origin. No application regression was attributed to this harness error. The
  coordinator will rerun all browser checks after the final build; this initial
  run is not recorded as a passing browser suite.

### Round 3 continued — Consume only after transferring content

- **Reviewer regression probe:** the initial closed-copy consumption fix exposed
  a valid legacy case: an open Apex spec had no draft while a same-old-ID closed
  entry contained `ONLY CLOSED COPY`. Refocusing the already-open tab through
  `openCanvas` removed the sole closed copy; reload lost its content. The independent
  `/tmp/phase2-review-domain.cjs` assertion failed (exit 1).
- **Requested correction:** consume closed ownership only when content actually
  transfers, or hydrate the existing open tab before consumption. Add a regression
  for the sole-copy case while retaining the no-false-recovery case.
- **Disposition:** narrow correction and independent retest pending. Other
  expanded probes still pass; approval remains withheld.

### Corrected candidate handoff

- **Implementer:** completed legacy scans without saved findings now explicitly
  show unavailable results; resumed legacy runs that complete a new demo scan
  record actual demo provenance. README states the unavailable-results behavior.
- **Implementer:** reopening canonical closed drafts consumes the closed copy to
  prevent false recovery. An existing draftless open tab first receives any sole
  closed content before that copy is consumed; added regression coverage.
- **Implementer validation:** latest domain suite passes 18/18. With the existing
  20 persistence / 9 onboarding / 9 conversation tests, the candidate has 56 tests;
  final independent all-suite retest is pending.
- **Product detail:** saved-plan UI uses work-item labels such as **WI-1**, keeping
  internal globally unique identifiers out of normal display.
- **Disposition:** reviewer retests sole-copy integrity before the joint source
  freeze and coordinator's final build/browser run. No approval yet.

### Independent final code review and source freeze

- **Reviewer:** the sole-closed-copy regression now passes. All expanded independent
  probes pass, including legacy project/run references with unknown scan times
  kept `null`, field whitelisting, revisions, catalog-independent history,
  captured-origin draft behavior, bounded historical/complete live views, and
  canvas ownership/migration checks.
- **Reviewer final all-suite command:** Node `22.23.2` runs
  `node --test scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs`:
  56/56 pass (18 domain + 20 persistence + 9 onboarding + 9 conversation).
- **Reviewer static checks:** `npm run lint` exits 0 with the same existing
  `src/app/layout.tsx:36` stylesheet warning; `git diff --check` is clean.
- **Updated illustrative measurement:** the expanded snapshot is 510,464 serialized
  bytes after adding the availability flag. This still describes only that fixture,
  not a universal byte budget.
- **Disposition:** reviewer reports no known open logic findings and agrees to
  source freeze. Full approval waits for the coordinator's final build/browser
  evidence and final documentation review.

### Final production-browser verification in progress

- **Coordinator:** three scripts pass against the final production build with
  exit 0 and page errors `[]`: fresh Phase 2 flows, the Phase 1 capability/two-tab
  persistence regression, and historical/project/work/profile regression.
- **Fresh flows:** history, retained origin draft during rescan, creation preserving
  original scope, recurring findings in a new run, work-item status save failure,
  and reload pass.
- **Persistence regression:** two-tab read/write failures, conflict detection,
  retry without overwrite, explicit keep-local replacement, and reload pass.
- **Profile/history regression:** historical save controls remain read-only;
  project/work failed writes recover through reload; profile isolation, intentional
  reset, and sign-out pass.
- **Runtime:** Node `22.23.2`, Chromium `152.0.7977.75`, temporary `playwright-core`
  `1.63.0`, final server on loopback port `3482` with temporary Basic Auth. Scripts
  and results live under `/tmp/ufd-phase2-browser`.
- **Remaining script:** legacy migration rerun follows an exact-select-label
  locator correction. Application source is unchanged; final legacy browser
  evidence and reviewer acceptance remain pending.
- **Reviewer artifact confirmation:** directly inspected the three scripts and
  `flows-results.json`, `results.json`, and `history-results.json`. Accepted their
  actual assertions and empty page-error results. No new logic findings; the
  corrected full legacy script and final documentation closure remain pending.

### Round 4 — Unavailable-scope recovery

- **Coordinator:** reported all four browser scripts passing after the legacy
  locator correction. The reviewer directly inspected/accepted `legacy-results.json`
  for retired project retention, unknown results, unavailable-target manual choice,
  actual archive export, and manual Apex recovery. This evidence predates Round 4.
- **Coordinator finding / reviewer confirmation:** a migrated assessment scoped
  only to retired orgs offers **Run
  again**, which silently does nothing because no current connected IDs remain.
  Opening the scope chooser also retains hidden unavailable IDs and enables
  **Analyze** from raw array length rather than a valid selection.
- **Requested correction:** open the scope chooser when no current connected
  targets remain; initialize its selection to the accessible intersection and
  require at least one valid selected connection. Preserve old runs/projects while
  recovering.
- **Implementer response:** all scope-chooser entry points now select only the
  accessible intersection; **Run again** opens that chooser when its original
  scope has no connected IDs. **Analyze** stays disabled until a connected
  selection exists. Historical runs/projects remain unchanged until a deliberate
  valid rescan. Implementer reports type checking/lint/diff checks passing.
- **Related implementer self-review / reviewer:** a paused legacy run with only
  retired scope could still **Resume** and reach a false zero-findings completion
  under demo provenance. This is the same historical-availability recovery issue,
  not deferred work. Proposed the chooser path plus an adapter start guard when
  paused scope has no accessible target, preserving normal valid resume behavior.
  Coordinator is aligning the correction before further source edits.
- **Implementer final Round 4 handoff:** completed **Run again** and paused
  **Resume** both open the chooser when scope is inaccessible. `start` retains an
  inaccessible paused state; `advance` pauses an inaccessible running state before
  it could capture false zero results. Two regressions cover paused/running
  retired-only legacy states.
- **Implementer validation:** all four suites pass 58/58 (20 domain + 20
  persistence + 9 onboarding + 9 conversation); type checking/lint pass with the
  existing warning, and whitespace is clean. Source frozen pending reviewer
  confirmation and coordinator build/browser checks.
- **Reviewer independent validation:** Node 22
  `node --test --test-reporter=spec` across all four scripts passes 58/58. Source
  inspection confirms inaccessible paused/start and running/advance guards cannot
  capture false findings.
- **Coordinator's lifecycle-matrix check:** inaccessible idle state safely does
  nothing in the store but still appeared to be analyzing indefinitely. Requested
  one truthful scope-needed heading/status/action for non-complete states and a
  browser matrix covering idle/running/paused/complete, each choosing UAT and
  recovering without losing history. This completes the same Round 4 recovery
  correction; no additional execution-lifetime semantics were introduced.
- **Reviewer final source confirmation:** shared scope-needed UI now shows
  **Waiting for scope** and **Choose org scope** for idle/running/paused states
  without false progress; complete state retains truthful historical results and
  recovery. No known open logic findings. Store code is unchanged since the
  independent 58-test pass; final build/browser/docs remain pending.
- **Disposition:** explicit change request; approval withheld. Coordinator owns
  a before/after browser regression and a new final production build. Previous
  build/browser evidence is valid for its candidate but does not cover this fix.

### Final affected-browser rerun after Round 4

- **Coordinator:** the rebuilt final source passes `flows.mjs`, `legacy.mjs`, and
  `unavailable-matrix.mjs`, each exit 0 with page errors `[]`. Their corresponding
  result files are `flows-results.json`, `legacy-results.json`, and
  `unavailable-matrix-results.json` under `/tmp/ufd-phase2-browser`.
- **All four restored states:** idle/running/paused/complete with retired-only
  scope reach a working chooser with no connected selection. **Analyze** is
  disabled; no saved data changes before deliberate selection, except that an
  inaccessible running state pauses without capturing results. Selecting UAT
  completes one actual demo finding while preserving both old projects and their
  retired targets/scopes.
- **Legacy rerun:** retired-project retention, truthful missing results,
  unavailable target display/manual selection, actual archive download, manual
  Apex recovery, and canonical reopening all pass again.
- **Fresh-flow rerun:** historical briefings, retained origin/recurrence,
  scope-preserving creation, failed saves, recovery, and reload all pass again.
- **Unaffected regression evidence:** prior accepted two-tab persistence and
  historical/project/work/profile scripts remain applicable; Round 4 changes the
  unavailable-scope recovery path and its guards.
- **Disposition:** all required checks now have passing evidence. Final reviewer
  artifact/documentation acceptance and explicit approval remain pending.

## Final finding dispositions

Earlier review-round notes retain what was pending at the time. This table records
the final implementation/evidence disposition. The reviewer accepted final
artifacts/documentation and approved all eight criteria with no unresolved
in-phase findings.

| Finding / request | Resolution and reviewer evidence |
| --- | --- |
| Browser-envelope wording overclaimed transactions | Plan/journal/source wording uses a serialized envelope; no cross-tab transactional guarantee. Reviewer accepted documentation precision. |
| Legacy category/priority/evidence invented facts | Unknown/unavailable placeholders preserve recorded priority only where it existed. Missing completed-scan results show unavailable; new capture updates provenance. Final domain tests and source review pass. |
| Legacy project creation lost known scope | Planning uses captured origin scope, independent of missing evidence placeholders. Independent regression passes. |
| Rescan cleared or retargeted edited drafts | Existing draft retains origin, beginning another refuses replacement, discard is explicit, field commands target draft identity, creation uses the completed origin. Independent probes and domain tests pass. |
| Optional/stale creation command bypass | Required captured draft/command IDs and positive integer expected revision validated at runtime; replay returns the original result. Final suite passes. |
| Codec identity/reference integrity | Structural whitelisted codecs validate revisions/duplicate IDs/references and protect unsupported schemas. Migrated project runs complete the graph with unknown scan times `null`. Independent probes pass. |
| Bounded history mutated/truncated live semantics | Separate complete live view; copied historical display fields sliced before allocation, identity keys intact, origin findings retained, omissions flagged. Independent cap/mutation/live-completeness probes pass. |
| Work canvas/shell ownership or surface mismatch | Shared resolved-work checks guard parsing/store, rendering, and context. Mismatched legacy inputs are archived; unresolved resources remain retained/unavailable, which may be an unavailable tab. Independent wrong-surface/ownership checks pass. |
| Competing legacy open/closed bytes could be overwritten | Migration archives competing content separately; independent close/reload probe passes. |
| Ordinary reopen generated false recovery | Closed ownership transfers to open content and is consumed; canonical reopen/edit/reload regression passes. |
| Sole closed content lost when refocusing draftless open tab | Existing open tab receives the content before consumption; independent sole-copy probe and final domain regression pass. |
| Expired draft target or earlier origin was unclear | UI retains unavailable target option/message, disables creation, and identifies an earlier-run draft; reviewer source confirmation and final production-browser checks pass. |
| Retired-only scope recovery silently stalled or falsely completed | All idle/running/paused/complete states offer truthful scope recovery; start/advance guards prevent false capture. Final four-state browser matrix completes an explicit UAT scan while retaining old projects/history. |
| Browser initializer accessed storage on `about:blank` | Temporary harness restricted to app origin; corrected final runs pass with page errors `[]`. No product regression attributed to the harness error. |

## Validation evidence

| Stage | Runtime / command | Result and limit |
| --- | --- | --- |
| Phase 1 handoff | Node `22.23.2`; previous phase's test/build/browser checks | Approved prior-phase baseline: 38 tests, lint with one existing stylesheet warning, production build, and focused Chromium persistence journeys. This is not validation of Phase 2 changes. |
| Coordinator's Phase 2 baseline | Node `22.23.2`; `npm run test:persistence`, `npm run test:onboarding`, `npm run test:conversation` | Reran before Phase 2 implementation: 20/20 + 9/9 + 9/9 pass, all exit 0. Source/test baseline copied to `/tmp/ufd-phase2-baseline` for independent compatibility probes. |
| Reviewer early regression probe | Node 22; `/tmp/phase2-review-domain.cjs` | After fixes, legacy draft project scope is preserved; competing same-target open/closed content survives close/reload; prior runs, explicit creation replay, and stale-field rejection pass. Other Phase 2 code and final checks remain in progress. |
| Reviewer expanded regression probe | Node 22; `/tmp/phase2-review-domain.cjs` | Origin-bound creation during a newer scan; catalog/evidence/connection-independent reload; historical caps with complete live views; snapshot/source-mutation independence; and wrong-surface work rejection pass. Large fixture history is 510,439 serialized bytes, an illustrative measurement rather than a general byte limit. |
| Reviewer full suites, pre-create-command correction | Node 22 first in `PATH`; `node --test scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs` | 14/14 + 20/20 + 9/9 + 9/9 pass (52 total), all suites in one command. Required captured create-command revision/runtime validation was requested afterward; final-candidate retest remains pending. |
| Implementer final candidate | Node `22.23.2`; all four test commands, `npx tsc --noEmit`, `npm run lint`, `git diff --check` | 15/15 domain + 20/20 persistence + 9/9 onboarding + 9/9 conversation pass (53 total); TypeScript including four negative canvas assertions passes; lint exits 0 with one existing `src/app/layout.tsx:36` stylesheet warning; whitespace check passes. Independent final retest/build/browser pending. |
| Coordinator build, pre-Round-3 candidate | Node `22.23.2`; `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed after required create-command correction. Superseded by missing-legacy-results and canonical closed-copy fixes; final build pending. |
| Coordinator interim browser | Temporary production-browser harness | Fresh-flow and retired-project legacy migration functional assertions passed, but the final page-error check failed on harness access to `sessionStorage` on `about:blank`. Origin guard corrected; full rerun pending, no passing browser-suite claim. |
| Independent reviewer, final frozen source | Node `22.23.2`; `node --test scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs`; `npm run lint`; `git diff --check` | 56/56 pass (18 domain + 20 persistence + 9 onboarding + 9 conversation); zero lint errors, one existing layout stylesheet warning; whitespace clean. Expanded probes including sole closed-copy transfer and complete legacy graph pass. No known open logic findings; build/browser/docs approval pending. |
| Coordinator final frozen-source production build | Node `22.23.2`; `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed (exit 0) after all canonical closed-copy corrections and joint source freeze. This supersedes the earlier production build. |
| Coordinator fresh-flow production browser | Node `22.23.2`, Chromium `152.0.7977.75`, temporary `playwright-core` `1.63.0`; `/tmp/ufd-phase2-browser/flows.mjs` | Exit 0, page errors `[]`; `flows-results.json` records history/origin draft/rescan/scope-preserving creation/recurrence/status-failure/reload assertions. Reviewer directly inspected and accepted script/results. |
| Coordinator persistence production-browser regression | Same runtime; `/tmp/ufd-phase2-browser/persistence-regression.mjs` | Exit 0, page errors `[]`; `results.json` records two-tab read/write failure, conflict, retry, explicit replacement, and reload. Reviewer directly inspected and accepted script/results. |
| Coordinator historical/project/work/profile production-browser regression | Same runtime; `/tmp/ufd-phase2-browser/profile-regression.mjs` | Exit 0, page errors `[]`; `history-results.json` records historical read-only status, project/work save failure/reload, profile isolation/reset/sign-out. Reviewer directly inspected and accepted script/results. |
| Coordinator legacy production browser, pre-Round-4 candidate | Same runtime; `/tmp/ufd-phase2-browser/legacy.mjs` | `legacy-results.json` passed retired-project retention, unknown original results, unavailable target/manual choice, actual archive export, and manual Apex recovery. Reviewer directly inspected/accepted artifacts. Later Round 4 inaccessible-scope recovery requires new build/browser evidence. |
| Reviewer Round 4 final domain/store candidate | Node `22.23.2`; `node --test --test-reporter=spec scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs` | 58/58 pass (20 domain + 20 persistence + 9 onboarding + 9 conversation). Final scope-needed UI was source-reviewed afterward; domain/store code unchanged. Coordinator final build/browser matrix pending. |
| Coordinator Round 4 final production build | Node `22.23.2`; `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed after the shared idle/running/paused/complete scope-recovery UI and final adapter changes. Final source checksums captured in `/tmp/ufd-phase2-browser/source-checksums-final.txt`. This supersedes earlier build evidence. |
| Coordinator final affected-flow/legacy browser reruns | Same Node/Chromium/Playwright runtime; `flows.mjs` and `legacy.mjs` | Both exit 0, page errors `[]` on the final Round 4 build. Reconfirm origin/recurrence/history/create/save recovery plus legacy retention, unavailable target, actual archive download/manual recovery/canonical reopen. Reviewer directly inspected/accepted latest `flows-results.json` and `legacy-results.json`. |
| Coordinator final four-state recovery browser | Same runtime; `unavailable-matrix.mjs` | Exit 0, page errors `[]`; idle/running/paused/complete retired-only scope recovers through explicit connected UAT selection. Analyze disabled without valid selection; no false findings or loss of old project history. Reviewer directly inspected/accepted the script and `unavailable-matrix-results.json`. |
| Final source/documentation verification | Reviewer checksum verification and `git diff --check` | Both pass (exit 0); final tested source matches its checksums. Reviewer accepts README/plan/journal evidence and limits, then issues explicit full approval below. |
| Coordinator cleanup/final check | Source checksums, `git diff --check`, visual screenshot inspection | Checksums match and whitespace is clean. Coordinator visually inspected the retired-project screenshot and stopped the temporary production test server. |

Final-browser commands use temporary tooling, with no repository browser
dependency added:

```bash
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase2-browser/config XDG_CACHE_HOME=/tmp/ufd-phase2-browser/cache node /tmp/ufd-phase2-browser/flows.mjs
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase2-browser/config XDG_CACHE_HOME=/tmp/ufd-phase2-browser/cache node /tmp/ufd-phase2-browser/legacy.mjs
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase2-browser/config XDG_CACHE_HOME=/tmp/ufd-phase2-browser/cache node /tmp/ufd-phase2-browser/unavailable-matrix.mjs
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase2-browser/config XDG_CACHE_HOME=/tmp/ufd-phase2-browser/cache node /tmp/ufd-phase2-browser/persistence-regression.mjs
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase2-browser/config XDG_CACHE_HOME=/tmp/ufd-phase2-browser/cache node /tmp/ufd-phase2-browser/profile-regression.mjs
```

These scripts exercise mounted production UI and reloads with captured page errors
on one Chromium version. Their `/tmp` artifacts are not a committed repeatable
browser suite and do not establish general accessibility, performance,
multi-browser, Heroku, Neon, or real-agent verification. Historical display caps
bound selected counts and text, not identity length or total application storage;
the complete live store still grows with saved runs/projects.

## Remaining work and handoff

- Phase 2 is complete and approved. No in-phase work remains; the reviewer
  accepted implementation, tests, final build/browser artifacts, and documentation.
- Phase 3 workspace/navigation ownership and dormant-path cleanup require a new
  user checkpoint after this phase is approved.
- Neon configuration, migrations, namespace isolation, and legacy browser import
  remain Phase 4. Run execution ownership remains Phase 5. Broader historical
  subscription/performance work remains Phase 6.
- No deployment, database provisioning, or later-phase implementation is included
  in this phase.

## Approval and user checkpoint

**Reviewer decision — `phase2_reviewer`, September 15, 2026:**

> APPROVED — 100% of Phase 2 acceptance criteria P2-A1 through P2-A8 satisfied.

The reviewer reports no unresolved in-phase findings. Approval follows independent
58-test Node 22 validation, lint/diff checks, adversarial domain/identity/migration
probes, final production build evidence, direct inspection of final affected-flow,
legacy recovery, and all-four-state scope-recovery browser artifacts, and retained
accepted Phase 1 browser regressions for unaffected paths. The reviewer verified
final source checksums and accepted README, plan, journal, evidence, and limits.

All historical-data, draft/run/revision, canvas migration/ownership, bounded
projection/live-view, legacy unknown-results, and unavailable-scope findings are
resolved. Manual recovery for ambiguous old draft identities is deliberate and
documented. Browser persistence remains non-transactional across tabs; snapshot
display budgets are not total storage/identity byte limits. Neon, Heroku release,
real-agent execution, and broad performance/accessibility verification remain
governed by later phases.

**User checkpoint:** Phase 3 requires the user's next authorization. Its deliverable
is explicit workspace/navigation ownership and one active extension path. No later
phase has started.
