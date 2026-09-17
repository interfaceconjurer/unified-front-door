# Phase 1 — Reliable browser persistence

**Started:** September 15, 2026  
**Status:** Approved — awaiting the user's Phase 2 checkpoint  
**Baseline:** `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md)  
**Finding:** F1 in the [architecture review](../architecture-review.md)

## Scope and roles

This phase repairs browser storage integrity, save acknowledgement, synchronization,
and recovery while keeping the local/Heroku prototype usable. Application records
will move to Neon in Phase 4, with an isolated development branch for the local app
and a separate hosted-demo branch for Heroku. A real provider/agent integration is
conditional Phase 8 work, after its capability and access model are selected.

- **Implementer:** `phase1_implementer`, application code and tests.
- **Reviewer / approver:** `phase1_reviewer`, independent review and acceptance.
- **Scribe:** `phase1_scribe`, this journal, plan status, and README.
- **Coordinator:** primary agent, scope coordination, independent checks, and user checkpoint.

Implementer and reviewer copy substantive exchanges to the scribe and coordinator.
The reviewer must review final documentation as well as implementation before full
approval. Approval means every criterion below has evidence and no unresolved
in-phase finding; it does not guarantee that no other defect exists.

## Acceptance ledger

| ID | Required result | Evidence / status |
| --- | --- | --- |
| P1-A1 | Successful state and later edits survive read/write failures; initially blocked storage behaves consistently in all four stores | Reviewer independently passed the parameterized failure/recovery tests across workspace, canvas, assessment, and profile |
| P1-A2 | Capability, work, and assessment/project save UI distinguishes acknowledged saves from unavailable/unsaved state and recovery | Static status-component checks and mounted production-browser capability, work notes, assessment draft, and project-status failure/recovery pass; historical snapshots expose no live save controls |
| P1-A3 | Retry detects divergent external data and preserves local edits under an explicit conflict policy | Reviewer independently passed focused conflict tests and assessment preflight/refresh regression probe; production browser confirms two-tab retry does not overwrite and explicit keep synchronizes |
| P1-A4 | Same-key external change, removal/clear, and other-instance writes notify; unrelated events are ignored; listeners are released | Reviewer independently passed focused event/filtering/listener-cleanup test |
| P1-A5 | Existing keys/raw data, profile isolation, open/closed drafts, profile selection, and intentional reset survive; invalid/unsupported data is protected | Reviewer independently passed invalid/future-byte, legacy/isolation, and explicit reset tests; browser verifies Sam reset, Alex notes retained after profile switching, and sign-out removing the profile key |
| P1-A6 | Stable browser-independent server snapshots and unchanged data identity; no render notification loops or profile leakage | Reviewer independently passed stable-snapshot, no-notification-on-read, and decode-once tests; mounted capability failure/recovery/reload completes with no page errors |
| P1-A7 | Focused persistence tests, existing suites, lint, production build on Node 22, and meaningful save-status UI evidence pass | 38/38 tests, lint (one existing warning), production build, and both production-browser scripts pass on Node 22.23.2; reviewer accepted all validation evidence |
| P1-A8 | Decisions, review rounds, evidence, limitations, README policy/commands, and final reviewer approval are recorded | Reviewer approved final README, plan, and journal; explicit full decision recorded below; Phase 2 remains user-gated |

## Design decisions

The approved implementation follows these decisions:

1. Share a small plain browser persistence store below domain-specific workspace,
   canvas/draft, assessment, and profile stores. Keep domain parsing and commands
   separate; preserve stable data and separate persistence-status snapshots.
2. Read existing raw payloads at their current keys. Write a versioned envelope
   only for deliberate writes. Reading alone must not migrate or overwrite
   invalid JSON, an unrecognized top-level record shape, or an unsupported future
   envelope version. Recognized record fields still use the existing domain
   sanitizers; malformed fields may default/be omitted. In particular, the F2
   catalog/connection-dependent assessment parser is unchanged until Phase 2.
3. Failed reads/writes retain the latest cached state and local edits. An initial
   failed read leaves the saved baseline unknown; recovery may save directly only
   if storage is absent, otherwise it requires explicit conflict resolution.
4. Adopt external changes/removal when local state is clean. If local edits are
   unsaved and stored data diverges from the original baseline, block automatic
   overwrite. Retry checks that baseline. Explicit **Keep my changes** overwrites
   the saved value; **Use saved version** discards local edits only after a valid
   read. Invalid/unsupported saved bytes remain untouched unless the user explicitly
   chooses to replace them with local data.
5. Listen to browser `storage` events and same-window custom events with subscription
   cleanup. Ignore unrelated keys and storage areas. Do not notify from render-time
   snapshot reads. Subscribe separately to persistence status for honest save UI.
6. Preserve profile selection's server/hydration sentinel and the deliberate
   day-zero scenario reset. Assessment/domain redesign and single-owner execution
   are outside this phase.

## Review rounds

### Round 0 — Design and acceptance alignment

- **Implementer:** proposed the shared store, deliberate versioned writes, baseline
  conflict detection, explicit recovery choices, and lifecycle-bound events above.
- **Reviewer:** requested independent read-only/write-only failure cases across all
  four stores; unknown-baseline retry; malformed/future byte protection; legacy
  profile/raw/reset compatibility; the undefined profile SSR sentinel; event key
  and storage-area filtering; same-runtime notification; listener teardown;
  render-time purity; separate status subscription; and truthful Capability, Work,
  ProjectReview, and ImprovementProject save rendering.
- **Disposition:** aligned with P1-A1–A8; proceeded to implementation review.

### Round 1 — Cache and command integrity (resolved)

- **Reviewer:** the initial dirty-state/baseline conflict path appears sound;
  **Use saved version** correctly retains local edits when saved bytes are invalid
  or unsupported. Requested caching decoded payloads so unchanged data/status
  snapshot reads do not repeatedly parse the assessment project/catalog graph.
- **Reviewer:** assessment commands computed a full next value before the shared
  update refreshed storage again. An intervening external value could therefore
  become the acknowledged baseline and then be overwritten by stale computed
  state. Requested commands based on the refreshed current value, or an observed
  baseline guard, plus an adversarial getter test. This is a Phase 1 adapter
  integrity issue; Phase 2's broader draft-command ownership remains separate.
- **Reviewer evidence:** an independent Node 22 temporary transpilation/probe
  changed saved assessment scope to `['uat']` at the read inside `update.refresh`
  after `start()` computed its value. The command persisted the older
  `['prod', 'uat', 'sit']` scope and reported `saved`. Expected: start the run while
  retaining the newly read `['uat']` scope. App files were not changed by the probe.
- **Implementer response:** added an unchanged-raw cache shortcut; converted
  assessment's internal commands to functional updates based on the refreshed
  current state. Added a shared save/recovery component to capability/work drafts,
  assessment/project views, and profile/workspace recovery notices.
- **Implementer evidence:** reported the Node 22 onboarding suite (9/9) and
  `tsc --noEmit` passing before full validation and independent regression checks.
- **Reviewer confirmation:** inspected the raw-cache shortcut and independently
  reran the assessment probe on Node 22. An external scope change at the command
  refresh was preserved as `['uat']` in the saved running state (one write). A
  change at the later preflight read produced `conflict` (zero writes) and left
  external bytes unchanged.
- **Disposition:** both initial findings resolved. This early inspection is not a
  phase approval.

### Round 2 — Historical snapshot recovery controls (resolved)

- **Coordinator / reviewer:** the first save-status integration rendered live-store
  recovery controls above the disabled fieldset in a historical Today snapshot.
  ProjectReview could also show the live store's save acknowledgement for old
  snapshot content. A historical view must not expose actions that replace or
  discard current records, or imply its old content has just been saved.
- **Requested fix:** render these live status/recovery controls only when no
  historical snapshot is being displayed, with focused historical-rendering evidence.
- **Reviewer confirmation by source inspection:** the outer DayZeroHome status is
  guarded by `!snapshot`, and ProjectReview receives `live={!snapshot}` and only
  mounts live status when that value is true. Historical views still subscribe to
  the live assessment hook; broader subscription separation remains Phase 6 work.
- **Reviewer browser confirmation:** inspected the corrected historical script and
  results. During a failed live draft write, the historical draft remained disabled
  and showed no persistence controls; the live view showed two honest failure
  notices and saved bytes remained unchanged. Project status stayed `in-progress`
  in memory after a failed write, then persisted through retry/reload. Page errors:
  `[]`.
- **Disposition:** resolved by source inspection and production-browser regression
  evidence.

### Implementation handoff for full review

- **Implementer:** submitted the implementation and 19-test persistence suite for
  independent review. Reported all 37 tests, lint, and type checking passing on
  Node 22.23.2. Coordinator owns the production build and browser checks.
- **Scribe:** README now describes actual browser data ownership, recovery choices,
  format compatibility, memory-only limitations, day-zero reset, the persistence
  command, and planned Neon integration without claiming it is connected.

### Round 3 — Explicit reset/sign-out intent (resolved)

- **Implementer self-review / reviewer:** the no-op update optimization skipped
  explicit reset/sign-out when initially blocked storage left the cache equal to
  its default/null value. Once storage recovered, an old saved value could then be
  re-adopted without a conflict, losing the user's reset/sign-out intent.
- **Agreed fix:** preserve explicit user intent for reset/profile selection even
  when the value equals the cache; keep simulated timer no-ops as no-ops.
- **Implementer response:** added a narrow force-intent option for explicit domain
  reset/profile selection. Nonempty saved data now produces a conflict after
  blocked-storage recovery, retaining the local reset until an explicit choice.
- **Test iteration:** the new test initially failed a deep equality assertion
  because the existing canvas decoder adds `closedDrafts: undefined`. The test now
  compares serializable content, matching the persistence contract. Implementer
  reports the expanded persistence suite passing 20/20.
- **Reviewer confirmation:** independently reran all suites on Node 22.23.2:
  20/20 persistence, 9/9 onboarding, and 9/9 conversation tests passed. Inspected
  the force flag's restriction to explicit reset/profile selection and the new
  regression coverage across all four stores. Lint remains clean except for its
  existing warning.
- **Disposition:** resolved by code inspection and regression tests. Earlier
  19-test results describe the candidate before this fix.

### Documentation review — Codec policy precision

- **Reviewer:** requested narrowing README's initial statement that all malformed
  data blocks writes. The shared codec protects invalid JSON, unrecognized
  top-level records, and unsupported envelope versions; existing field sanitizers
  still handle recognized record shapes and retain F2's catalog dependence.
- **Scribe response:** corrected README and the design decision above to state
  this boundary explicitly. No application change was requested.
- **Reviewer confirmation:** README accurately documents the codec policy,
  verification commands, browser ownership versus planned Neon, recovery choices,
  and non-atomic multi-tab limitations. Final journal and plan review subsequently
  passed as part of the explicit phase approval below.

### Production browser verification (complete)

- **Coordinator:** six capability scenarios passed against the final production
  build: saved baseline; failed writes retaining mounted Apex draft edits with an
  honest status; remote-tab change producing conflict; retry preserving both
  versions; explicit local replacement synchronizing tabs; and read failure,
  recovery, and reload retaining the intended draft. Captured page errors: `[]`.
- **Reviewer:** inspected the capability script and result artifact directly and
  accepted these results as evidence.
- **Harness corrections:** an initial launcher locator matched a chat suggestion;
  the coordinator narrowed only the test locator. The reviewer spotted the wrong
  storage key in the separate historical probe (`ufd.assessment.v1.sp` instead of
  `ufd.org-assessment.v1.sp`) and requested a non-null saved-data assertion. These
  are test-harness corrections, not application regression findings.
- **Reviewer:** accepted corrected `history.mjs` / `history-results.json` evidence
  after checking the actual assessment key and non-null saved-data assertion.
  Historical and live save controls, disk preservation under failure, and project
  status retry/reload all passed with no page errors.
- **Coordinator final expansion:** WorkCanvas notes remained editable through a
  failed write and persisted after retry/reload. Switching to Sam reset its
  projects/draft; switching back to Alex retained its notes; sign-out removed the
  profile key. The expanded historical script passed with page errors `[]`.
  Coordinator also visually inspected the failed-write screenshot.
- **Reviewer final confirmation:** directly inspected the expanded historical
  script and results, including work notes, both personas' reset/isolation, and
  sign-out. Accepted all application/build/browser evidence with no unresolved
  findings.
- **Disposition:** both production-browser scripts pass against the final build
  and their evidence is accepted. The coordinator stopped the temporary server
  after checks and reports a final clean `git diff --check`.

## Validation evidence

| Stage | Runtime / command | Result and limit |
| --- | --- | --- |
| Baseline, before implementation | Node `22.23.2`; `npm run test:conversation` and `npm run test:onboarding` with `/home/omarchy/.local/share/mise/installs/node/22.23.2/bin` first in `PATH` | Coordinator reports all 18 existing tests passed. This is baseline evidence, not validation of changed code. |
| Initial changed implementation | Node 22; `npm run test:onboarding` and `tsc --noEmit` | Implementer reports 9/9 onboarding tests and type checking passed. Superseded by final-candidate checks below. |
| Assessment concurrency regression | Node 22; reviewer temporary adversarial-read probe | External change at command refresh is retained; change at preflight becomes conflict without writing. Both cases passed after functional-update fix. |
| Implementer full test handoff | Node `22.23.2`; `npm run test:persistence`, `npm run test:onboarding`, `npm run test:conversation` | Implementer reports 19/19 + 9/9 + 9/9 passing. Persistence UI check renders the actual status component to static markup; it is not a mounted interaction/hydration test. |
| Implementer static checks | Node `22.23.2`; `npm run lint`; `npx tsc --noEmit` | Both pass; lint has the existing `src/app/layout.tsx:36` `no-css-tags` warning and zero errors. |
| Independent reviewer, pre-Round-3 candidate | Node `22.23.2`; all three test commands, `npm run lint`, `git diff --check` | 19/19 persistence + 9/9 onboarding + 9/9 conversation tests passed; zero lint errors, same existing warning; diff whitespace clean. Superseded by the reset-intent fix and final-candidate retest below. |
| Implementer, reset-intent fix | Node `22.23.2`; `npm run test:persistence` | Expanded suite passes 20/20; subsequently confirmed by reviewer. |
| Implementer, final candidate checks | Node `22.23.2`; `npm run test:onboarding`, `npm run test:conversation`, `npm run lint`, `git diff --check` | Existing suites pass 9/9 each; lint has zero errors and its existing stylesheet warning; diff whitespace check passes. |
| Independent reviewer, reset-intent fix | Node `22.23.2`; `npm run test:persistence`, `npm run test:onboarding`, `npm run test:conversation`, `npm run lint` | 20/20 + 9/9 + 9/9 tests pass (38 total); lint passes with the same one existing layout warning. |
| Final production build | Node `22.23.2`; `NEXT_TELEMETRY_DISABLED=1 npm run build` | Coordinator reports post-reset-fix build passed (exit 0). |
| Capability production browser | Node `22.23.2`, Chromium `152.0.7977.75`, temporary `playwright-core` `1.63.0`; command below | Coordinator's six scenario checks pass with no page errors. Reviewer inspected script and results directly. |
| Historical/project/work/profile production browser | Same Node/Chromium/Playwright runtime; `/tmp/ufd-phase1-browser/history.mjs` and `history-results.json` | Final expanded script passes: frozen snapshot has no live save controls, failed live writes preserve disk, project status and work notes recover through retry/reload, Sam reset and Alex isolation survive profile switching, and sign-out removes the profile key; no page errors. Reviewer directly inspected and accepted the final script/results. |
| Final whitespace check | `git diff --check` | Coordinator reports pass after final browser checks. Temporary production server stopped. |

Browser invocations (temporary tooling, no repository dependency change):

```bash
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase1-browser/config XDG_CACHE_HOME=/tmp/ufd-phase1-browser/cache node /tmp/ufd-phase1-browser/smoke.mjs
env PATH=/home/omarchy/.local/share/mise/installs/node/22.23.2/bin:$PATH XDG_CONFIG_HOME=/tmp/ufd-phase1-browser/config XDG_CACHE_HOME=/tmp/ufd-phase1-browser/cache node /tmp/ufd-phase1-browser/history.mjs
```

The scripts target the final production server on loopback port `3481` behind
temporary Basic Auth. Results are in `/tmp/ufd-phase1-browser/results.json` and
`/tmp/ufd-phase1-browser/history-results.json`; these temporary artifacts are not a
committed repeatable browser suite. They exercise mounted production UI and reload,
with captured page errors, and complement the static-markup/status contract tests.
They do not constitute general accessibility, performance, multi-browser, or
Heroku verification.

## Remaining work and handoff

- Phase 1 is complete and approved. No in-phase work remains. A user checkpoint
  is required before any next-phase work.
- **Phase 2:** catalog/connection-independent history (F2), typed canvas identity
  (F4), and related domain ownership remain open.
- **Phase 4:** actual Neon configuration, migrations, namespace isolation,
  browser-data import, database evidence, and the environment template remain open.
- **Phase 5:** one logical assessment/run owner across tabs remains open. Storage
  event synchronization does not make browser timers a distributed executor.
- **Phases 6–8:** remaining UI/capacity, release, and conditional real integration
  findings remain governed by the plan. No deployment or database provisioning is
  part of this phase.

## Approval and user checkpoint

**Reviewer decision — `phase1_reviewer`, September 15, 2026:**

> APPROVED — 100% of Phase 1 acceptance criteria P1-A1 through P1-A8 satisfied.

The reviewer completed final README, plan, and phase-journal review and reported
no unresolved in-scope findings. Approval covers the independently executed
38-test Node 22 suite, lint and diff checks, the adversarial assessment probe,
production build evidence, and both inspected production-browser scripts/results.
The raw-cache, stale assessment update, historical live controls, reset/sign-out
intent, and codec-documentation findings are resolved.

The reviewer accepted the documented limits: non-atomic browser writes; unsaved
in-memory state lost on reload; existing F2 field sanitization/catalog coupling;
Phase 5 timer ownership; and temporary single-Chromium browser probes. This phase
does not claim Heroku, Neon, or real-agent deployment verification.

**User checkpoint:** Phase 2 remains gated on the user's response. Its next
deliverable is independent project/assessment history and typed identities. No
later phase has started.
