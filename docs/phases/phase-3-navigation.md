# Phase 3 — Workspace and navigation ownership

**Started:** September 15, 2026  
**Status:** Approved — awaiting the user's Phase 4 checkpoint  
**Baseline:** Approved Phase 2 working tree, originating at `4e52aa1`  
**Plan:** [Architecture implementation plan](../architecture-plan.md)  
**Findings:** F3, F6, and the navigation portion of F10 in the [architecture review](../architecture-review.md)

## Scope and roles

The user authorized Phase 3 after the Phase 2 checkpoint with “lets go.” This phase
makes workspace context and draft scope explicit, gives active navigation one
owner, supports shareable destinations and browser history, and resolves the
dormant implementation inventory. Neon persistence remains Phase 4.

- **Implementer:** `phase3_implementer`, application code and tests.
- **Reviewer / approver:** `phase3_reviewer`, independent review and acceptance.
- **Scribe:** retained `phase2_reviewer` thread, now serving solely as Phase 3 scribe;
  README, plan status, and this journal. It has no Phase 3 approval role.
- **Coordinator:** primary agent, scope coordination, independent checks,
  production build/browser evidence, and user checkpoint.

The retained scribe thread avoids the session's agent-thread cap. The role change
does not combine implementation and approval. Phase 1 and Phase 2 journals remain
unchanged historical records. Substantive exchanges are copied to the coordinator
and scribe; only the independent Phase 3 reviewer can approve this phase.

“100%” means supported acceptance criteria and no unresolved in-phase finding; it
does not promise that no other defect exists. Phase 4 requires a new user
checkpoint after this phase is approved.

## Acceptance ledger

The coordinator and reviewer agreed P3-A1 through P3-A8 before implementation.
The [plan](../architecture-plan.md#acceptance-criteria-p3-a1-through-p3-a8) contains
the full criteria. None may be weakened or silently deferred to obtain approval.

| ID | Required outcome | Evidence / disposition |
| --- | --- | --- |
| P3-A1 | Explicit loading/empty/planning/ready/unavailable context; missing versus invalid IDs; no silent fallback target | Reviewer accepts final unavailable/worktree-state evidence: missing/invalid context, established app without worktree, truthful planning labels, saved target/reply/reload/reopen consistency |
| P3-A2 | Captured bound/unbound draft identity, explicit scope assignment, conservative legacy open/closed migration, no retargeting on selection | Reviewer accepts final recovery/restored-target/context evidence, retained draft-scope/toolkit checks, and independent legacy/closed-source regressions |
| P3-A3 | One controller for every active entry point; no competing host selection writes | Reviewer accepts final navigation/context/two-tab and complete planning creation/reload/workspace/Today reopening evidence; one domain target drives every entry point |
| P3-A4 | Shareable URL/direct entry/Back-Forward/restoration precedence, invalid/unavailable recovery, profile isolation, independent view preferences | Reviewer accepts final URL/direct/history/profile/two-tab/unavailable/conflict checks and retained candidate 2 sign-in/denied-surface evidence |
| P3-A5 | Persistent composer draft/selection/thread continuity during rapid or cancelled navigation; original ordering concern disposition | Reviewer accepts final navigation/thread/surface-context checks and retained motion evidence; original unverified race disposition is explicit |
| P3-A6 | Finite dormant import-graph dispositions, active capability parity, deliberate obsolete source/docs cleanup, one extension path | Reviewer accepts 33 finite removals, 19+4 capability parity, independent graph and unchanged catalog evidence, and README's single extension path |
| P3-A7 | Independent focused/existing tests, Node 22 lint/build, meaningful affected production-browser evidence | Reviewer accepts independent 75 tests/TypeScript, Node 22 lint/build, final seven browser families plus four retained candidate 2 families, and matching final source manifest |
| P3-A8 | Faithful README/plan/journal, dialogue and finding dispositions, exact evidence/limits, explicit independent approval | Reviewer accepted final README/plan/journal, ledger/dispositions, archive paths, limits and handoff; exact independent approval is recorded below |

## Design decisions and review questions

1. An explicit unavailable reference must not be resolved by choosing the first
   connected resource. Missing context and invalid requested context need distinct
   semantics in the resolver and UI.
2. New drafts capture their declared context. Existing globally keyed drafts stay
   explicitly unbound until assigned; migration cannot infer ownership from the
   current selection. Both open and closed records need this rule.
3. One controller resolves a destination and its derived selections. Components
   issue intents; a separate tab-restoration effect must not compete with it.
4. Shareable identity and view preferences have different lifetimes. Direct URLs,
   persisted selection, browser history, and profile changes need one explicit
   precedence policy.
5. The original review reported cross-route ordering as an unverified concern,
   not a demonstrated race. The phase must supply evidence and a final disposition
   without rewriting the historical finding as an established defect.
6. Dormant code removal follows a finite import-graph inventory and feature
   dispositions. Active shared layout and useful pure modules must remain;
   directory names alone are not deletion evidence.

Concrete resolver, scope, URL, and controller implementation decisions remain
subject to implementer/reviewer agreement and will be recorded here as they settle.

### Initial implementation proposal

- An explicit nullable workspace resolver supplies the context state.
- A `NavigationProvider`/controller owns selection, tabs, URL state, and
  direct/restored/history destinations, with a guard against superseded routes.
  URL destinations carry a profile-specific token; host reconciliation is removed.
- Capability inputs require captured unbound or project/worktree/org scope.
  Old IDs migrate as unbound with active/open/closed references remapped. Explicit
  assignment copies into the chosen scope while retaining the original and
  refusing to overwrite an existing target draft.
- Empty profiles expose zero fixture projects rather than manufacturing a current
  project. Agent resume messages use the destination session, and the composer
  remembers selection for each session as well as text.
- Dormant source deletions follow the inventory, not precede it.

These are implementer proposals reported before code validation; reviewer
acceptance and final behavior remain pending.

## Review rounds

### Round 0 — Scope, roles, and acceptance alignment

- **Coordinator:** the user authorized Phase 3. Assigned new implementer/reviewer
  roles and reused the former Phase 2 reviewer thread solely as scribe because the
  session could not spawn another fresh thread. No application edits belong to
  the scribe and no Phase 3 approval authority carries over from its earlier role.
- **Reviewer:** proposed A1–A8 covering explicit context, bound/global migration,
  all navigation entry points, URLs/history, composer continuity, dormant graph
  dispositions, exact validation, and documentation/approval.
- **Reviewer:** initial design direction appears sound; requested early attention
  to explicit invalid IDs versus absent/unbound scope, toolkit scope inheritance,
  closed version-2 global drafts, profile changes and URLs, and competing host
  restoration effects. These are checks to resolve, not accepted implementation
  evidence.
- **Coordinator:** confirmed the full P3-A1–A8 criteria recorded in the plan;
  source edits authorized. Copied the approved baseline to
  `/tmp/ufd-phase3-baseline` and began baseline tests and reachability mapping.
- **Scribe:** established this journal and changed current plan status to Phase 2
  approved/user-authorized Phase 3, Phase 3 in progress, and Phase 4+ gated.
- **Disposition:** scope and acceptance aligned. Implementation, exact design
  decisions, and independent validation remain pending.

### Round 1 — Destination session and composer continuity

- **Reviewer:** traced `AgentPanel.resumeWork` in the baseline: reply dispatch
  occurs before `openWork`. Requested that the destination thread own the
  resumed-work message if navigation changes sessions. This source-ordering
  concern requires reachability evidence before it can establish a visible
  wrong-thread bug; see the coordinator's correction below.
- **Reviewer:** baseline composer state remembers per-session text but does not
  retain textarea selection. Requested cross-thread recent-resume tests, returning
  text/selection checks, and proof that cancelling a superseded presentation
  revision cannot rewind committed navigation.
- **Implementer:** proposed destination-session dispatch and per-session selection
  restoration, alongside the controller/scope design above. Source work starts
  after the coordinator's baseline confirmation.
- **Disposition:** destination-session contract changes requested; implementation
  and independent evidence pending. The resume dispatch-ordering concern is
  separate from the original review's still-unverified general cross-route race.

### Round 1 follow-up — Route consistency and optional resources

- **Reviewer:** accepted the journal's criteria and distinction between proposed
  design, baseline evidence, concrete message ownership, and the original
  unverified ordering concern.
- **Reviewer:** asked whether rejecting a superseded route completion also keeps
  the visible pathname/URL consistent with the latest context; ignoring a stale
  context write alone may be insufficient.
- **Reviewer:** asked that app/project destinations with no worktree remain usable
  where the destination does not require a worktree. Explicit missing-resource
  states must not become blanket requirements for capabilities that can work in
  planning context.
- **Disposition:** open design checks while wiring is unsettled; these are not
  yet reproduced implementation defects.

### Interim independent domain/controller probes

- **Reviewer:** `/tmp/ufd-phase3-reviewer-probes.mjs` compiles the current libraries
  through the repository's `testModules` helper and passes under Node 22.
- **Coverage:** loading/empty/planning states; removed project/worktree/org and
  expired org references retained without fallback; bound URLs containing
  punctuation; invalid target mismatches; old canonical version-2 IDs becoming
  unbound; required runtime scope; latest-intent and history-cancellation
  application ordering.
- **Disposition:** interim pure-module evidence only. These checks do not yet
  validate the final candidate, mounted browser integration, or actual pathname
  synchronization. The URL/context agreement question remains open.

### Resume reachability correction

- **Coordinator:** the initial baseline browser probe could not reach the assumed
  cross-project recent-work button from Today. Today captures recent work filtered
  by the active project and worktree, so those cards use the same session.
- **Coordinator:** requested a real reachable differing-session path before
  calling the source dispatch order a confirmed UI wrong-thread bug. The missing
  locator reflects the probe's assumption, not a product failure.
- **Disposition:** retain destination-session ownership as an explicit contract
  check; classify the baseline sequence as a latent hazard until reachability is
  demonstrated. Earlier wording above has been clarified accordingly. Composer
  selection and rapid-navigation checks remain required.

### Baseline browser — Session isolation and selection

- **Coordinator:** ran `/tmp/ufd-phase3-browser/baseline.mjs` against the approved
  Phase 2 production build using Node 22, Chromium 152, and temporary Playwright
  1.63 tooling. The final observation script passes and records results in
  `baseline-session-switch-results.json`.
- **Observed flow:** CRM to Acme, resume a query, return home, then CRM and resume
  a handler. Replies remain isolated to the expected threads, the same textarea
  node remains mounted, and the original draft text returns. Its selection changes
  from offsets 9–12 to 0–0, reproducing the missing selection restoration.
- **Harness corrections:** initial assumptions used the wrong profile key and a
  nonexistent cross-project button. Those probe corrections do not establish
  product failures.
- **Disposition:** current reply isolation and persistent-node/text behavior are
  baseline evidence; selection restoration remains a required Phase 3 fix. This
  result does not approve new controller/browser behavior.

### Baseline browser — Active capability parity

- **Coordinator:** the baseline production-browser script opens all 19 surface
  capabilities and four toolkit sections, edits a field in each, and verifies
  close/reopen preservation. It passes with page errors `[]`.
- **Evidence:** `/tmp/ufd-phase3-browser/capabilities.mjs` with
  `PHASE3_BASELINE=1`, Node 22, Chromium 152, temporary Playwright 1.63;
  `capabilities-before-results.json` records the outcomes. The approved Phase 2
  source checksum manifest matches the baseline (exit 0), production build ID
  `7BOUDIEAL1_aeJgPfgXFU`.
- **Harness correction:** a same-named agent prompt initially matched the
  capability locator; scoping the selector to `main` fixed the probe. This was
  not a capability failure.
- **Disposition:** baseline active capability inventory established for the final
  parity check. Baseline server stopped; Phase 3 browser verification remains
  pending.

### Round 2 — Canonical URL and explicit target validation

- **Reviewer — R2:** found different query encodings in generated versus observed
  URLs: `destinationHref` uses `%20`, while `search.toString()` uses `+` for spaces.
  Requested one canonical navigation identity so equivalent query values cannot
  be treated as different pending/committed destinations.
- **Reviewer — R3:** found malformed explicit workspace targets falling back to
  legacy selection and empty or inconsistent IDs being accepted. Requested a
  shared validated target codec and regressions that preserve the distinction
  between missing legacy data and an invalid explicit target.
- **Reviewer:** independently confirmed the baseline resume correction: current
  Today cards are filtered to the current project/worktree, and no reachable
  differing-session trigger was found. Destination ownership remains a latent
  contract check rather than a demonstrated current UI defect.
- **Reviewer:** independently reproduced R2/R3 with
  `/tmp/ufd-phase3-reviewer-round2.mjs` under Node 22 using transpiled current
  modules. Equivalent decoded URL destinations return `encodingAcknowledged:
  false`; a malformed explicit target is discarded while prior CRM legacy maps
  are returned with status `saved`. The implementer received the exact fixtures.
  This establishes module-level failures, not browser reproduction.
- **Disposition:** R2 and R3 changes requested; implementation and independent
  retest pending.

### Round 3 — One captured target for restored work

- **Reviewer — R4:** source review found surface restoration taking the current
  project's org while explicit tab opening used the destination project's default.
  The same work identity could therefore resolve to different context through
  different entry points.
- **Implementer:** accepted the change request.
- **Reviewer / implementer:** agreed that each existing work identity keeps one
  captured target; this does not require duplicate work identities for different
  orgs. Capability scope remains part of capability identity. Captured work context
  must survive closing and reopening its draft. First legacy capture uses that
  work's project-specific remembered/default context, and a conflicting URL must
  warn without silently retargeting the saved work.
- **Reviewer:** requested closure/reopen and conflicting-URL regressions.
- **Disposition:** design aligned; code and independent evidence pending. Entry
  point consistency cannot be closed solely by matching the first open operation.

### Round 3 implementation handoff — URL, target, and work capture

- **Implementer:** reports R2 now canonicalizes query encoding (including spaces
  and apostrophes), and a late superseded route actively repairs the URL.
- **Implementer:** reports R3 now uses a shared strict target parser; a malformed
  explicit persisted selection is protected instead of falling back to legacy
  maps.
- **Implementer:** reports R4 now stores captured targets independently of the
  open/closed draft lifetime. Tab, surface, and recent-work entry points reuse that
  capture. First legacy capture uses the work's project-specific context once;
  conflicting URLs report a conflict. Planning/app context can have no worktree.
- **Validation reported:** TypeScript passed before the latest captured-target
  metadata patch. Focused tests are being added. Initial existing-suite failures
  involved newly created command fixtures missing the now-required scope; the
  implementer is updating those command inputs while preserving old migration
  payload cases. No final suite success is claimed yet.
- **Disposition:** fixes reported, independent retest pending. Earlier passing
  type checks do not validate the latest metadata patch.

### Round 4 — Retests and destination serialization

- **Reviewer:** reran the original R2/R3 module reproductions. Equivalent `%20`/`+`
  routes now acknowledge the same destination. A malformed explicit target now
  returns status `invalid` with an initial unbound snapshot while preserving the
  saved bytes; it no longer adopts the prior CRM legacy selection.
- **Coordinator — R5:** found a full `CanvasSpec` passed through
  `selectCanvas` → `openCanvas` → destination construction. Without normalization,
  extra `id`/`draft` fields could be serialized into a shareable URL.
- **Reviewer:** agreed R5 requires a normalized/whitelisted destination encoder
  and an adversarial test passing a full object, rather than relying only on the
  narrower TypeScript input annotation.
- **Disposition:** R2/R3 module regressions pass for the current candidate; final
  browser integration remains pending. R5 changes requested. R4 captured-target
  lifetime implementation/retest remains in progress.

### Round 5 — Browser-tab navigation authority

- **Coordinator / reviewer — R6:** source review found shared selection targets
  and active canvas IDs can change through another tab while this tab's URL does
  not. Rendering directly from those shared fields would retarget visible context
  or content despite the claimed URL authority.
- **Reviewer:** requested a committed destination/view owned by each browser tab.
  Shared persisted selection and active IDs may serve as restoration hints;
  shared draft records must still synchronize. Restoring a local destination must
  not create cross-tab writeback loops.
- **Coordinator:** will reproduce and verify the behavior with two production
  browser tabs.
- **Disposition:** R6 changes requested under P3-A3/P3-A4 while preserving Phase 1
  data synchronization contracts. Source evidence exists; mounted two-tab results
  and the implementation are pending.

### Dormant implementation disposition proposal

- **Implementer:** inspected graph reachability and feature exports; proposes
  removing 33 of the 34 unreachable runtime/style files and retaining `lib/db.ts`
  for Phase 4. All 88 baseline-reachable files, shared `CanvasLayout`/CSS, and the
  ambient type input remain.
- **Duplicate paths:** old canvas area/provider/IDs, left navigation, chat, Today,
  and app launcher duplicate the current shell, registry, agent panel, and surface
  launchers.
- **Detached designs:** the old project wizard/provisioner, resource builder,
  metadata explorer/project metadata, old project fixtures, and generic kit are
  earlier prototype designs with no active import or reachable product affordance.
  The proposal deliberately does not port their fabricated execution/project model
  into the current application. Their absence from the live UI differs from
  removing a current capability.
- **Pure-module review:** unused `workspace/projections.ts` produces fixture-shaped
  metrics/insights and has no caller; the implementer found no separate reusable
  invariant to retain.
- **Parity basis:** the current 19 surface capabilities, four toolkit sections,
  planning projects, and returning-work flows remain the active product baseline.
  Final checks must verify that parity after deletion.
- **Disposition:** proposal submitted to the independent reviewer before deletion.
  The inventory below records proposed removals, not completed or approved ones.

### Round 6 — Cleanup acceptance and shared destination resolution

- **Reviewer:** accepted the finite 33-file removal proposal and retention of the
  database seam, shared layout, and ambient type input. This accepts the
  disposition, not final correctness: after-removal graph, active capability
  parity, and build evidence are still required.
- **Reviewer — R7:** found the new URL-derived workspace/canvas projections can
  bypass navigation's captured-target checks. In the reviewed source, saved work
  targeting SIT and a direct URL requesting UAT cause navigation to reject the
  capture, while a separate workspace URL projection selects UAT and the same
  draft remains editable. The three projections do not share one validation
  outcome.
- **Reviewer:** requested one shared resolved-destination decision and browser
  coverage for captured-target conflicts.
- **Disposition:** cleanup scope accepted conditionally on final verification.
  R7 changes requested; implementation and mounted conflict evidence pending.

### First complete implementation candidate

- **Implementer:** reports 70/70 tests pass under Node 22: 12 new navigation tests
  plus 58 existing tests. Current TypeScript passes; the latest lint run exits 0
  with the existing layout stylesheet warning. Test log:
  `/tmp/ufd-phase3-tests.log`.
- **Implementer:** R5 now has a destination whitelist and source/notes/id exclusion
  regression. R6 uses each tab's URL as rendering authority, while shared stores
  retain resume hints and synchronize draft content. R7 uses one
  `resolveDestination` decision for workspace, canvas, and controller validation
  of owner, surface/work access, and captured-target conflicts. Bare-route upgrade
  changes the URL; restoration avoids shared-store mutation.
- **Implementer:** removed the 33 reviewer-accepted dormant files; database helper,
  shared layout, and ambient type input remain. Independent after-graph and final
  browser parity remain pending.
- **Disposition:** first complete candidate handed off for independent review and
  production build/browser verification. Reported test success is not final phase
  approval, and remaining integration findings must still be resolved.

### First candidate independent checks and documentation

- **Reviewer:** independently ran all five suites: 70/70 pass. Lint exits 0 with
  the existing stylesheet warning; whitespace check passes. Two synthetic/read-only
  draft migration edge cases remain under inspection.
- **Scribe / reviewer:** checked whether preserving a URL view after another tab
  closes it breaks closing it locally. The host's own-close path also navigates
  to a neighboring tab (Overview is always present); external close does not run
  that path. Source behavior appears intentional; browser confirmation remains
  pending. No own-close defect is established by this question.
- **Implementer:** froze source; final candidate lint and whitespace checks pass.
  The after-removal graph using an absolute root reports 93 files, 91 reachable,
  and only the expected `lib/db.ts` (34 lines) plus ambient type input (two lines)
  outside the entry graph; no unresolved imports. An earlier relative-root graph
  invocation produced false unresolved paths because the temporary script expects
  an absolute root. That was a harness issue.
- **Scribe:** updated README against this candidate: context states, captured and
  unbound drafts, copy assignment, URL precedence/profile handling, tab-local
  navigation versus shared draft content, active extension path, removed dormant
  path, and the navigation test command. Final reviewer acceptance remains pending.
- **Disposition:** candidate checks and documentation handed off. Coordinator owns
  the production build/browser runs; approval remains pending.

### Round 7 — Closed-draft read, edit, and assignment

- **Reviewer — R8:** reproduced with actual modules in
  `/tmp/ufd-phase3-reviewer-round8.mjs`: a valid open stub without draft fields plus
  a closed copy `{ source: 'class Legacy {}', name: 'LegacyClass' }` projects no
  visible draft. Editing only its name and closing it then leaves only the name,
  losing the original source field.
- **Reviewer:** the same probe shows assigning a closed unbound source to a new
  target returns false because assignment only looks up open records.
- **Reviewer:** requested a visible closed fallback, hydration of existing content
  before partial edits, closed-source assignment support, and focused regressions.
- **Disposition:** R8 is a confirmed module-level data-integrity failure. Changes
  requested; source fixes are coordinated around the first build. The earlier
  70-test candidate does not cover or close these cases.

### Round 8 — Shareable destination through demo sign-in

- **Implementer — R9 self-review:** found signed-out direct entry redirects to
  login, then login replaces the URL with home, losing the requested destination.
- **Reviewer:** agreed this fails P3-A4. Requested preserving a normalized internal
  typed `returnTo` value through sign-in. A matching chosen profile can resume the
  destination; a mismatched profile must reach explicit unavailable/current
  workspace handling. Deliberate profile-menu switching retains its existing
  home/reset behavior.
- **Reviewer:** required rejection of external, protocol-relative, and
  `javascript:` return URLs. The general destination parser alone is not an
  allowlist for a safe internal redirect.
- **Coordinator:** notified to include signed-out direct entry in the browser
  matrix.
- **Disposition:** R9 changes requested for the next candidate; implementation,
  URL validation regressions, and browser evidence pending.

### Candidate 2 self-review — Denied surface recovery

- **Implementer:** found inherited outer/inner AppShell surface access guards
  redirect denied routes to home before the shared unavailable destination can
  render its recovery state.
- **Reviewer:** accepted a required fix: keep the sign-in identity guard, but use
  the shared decision to reject both a bare denied surface and a typed URL
  synchronously, block its feature content, and provide explicit recovery.
- **Reviewer:** requested denied-surface browser coverage and flagged the README's
  unavailable-surface recovery wording as premature for candidate 1.
- **Scribe:** removed that specific README claim until the fix is implemented and
  validated. Other destination/profile recovery wording remains under final review.
- **Disposition:** required candidate 2 fix, alongside R8/R9. Source remains frozen
  while the coordinator collects candidate 1 browser evidence; no fix is claimed
  yet.

### Candidate 1 production-browser evidence

- **Coordinator:** candidate 1 production build passed on Node `22.23.2` with
  `NEXT_TELEMETRY_DISABLED=1 npm run build` (exit 0, session `12320`): Next
  `16.2.9` compilation, type checking, and static routes complete. Source manifest:
  `/tmp/ufd-phase3-browser/source-checksums-candidate1.txt`.
- **Coordinator:** independently reran the after-graph:
  `/tmp/ufd-phase3-graph-after-candidate1.json` confirms 93 files, 91 reachable,
  only the database seam and ambient type input outside the graph, no unresolved
  imports. Source remains frozen during candidate 1 browser collection.
- **Reviewer:** directly inspected and accepted the candidate 1 navigation,
  draft-scope, motion, and capability artifacts under
  `/tmp/ufd-phase3-browser`. All report page errors `[]`.
- **Navigation:** actual keyboard selection offsets 9–12 survive thread switches
  and browser history; destinations retain exact targets; edited draft content is
  absent from URLs; two tabs retain their own views while shared edits synchronize.
- **Draft scopes:** three independent Apex scope identities preserve separate
  content; existing-target collision and storage-write failure behavior pass.
- **Motion:** reopening the palette cancels its pending selection. A delayed Code
  navigation superseded by Build leaves the latest destination active, with the
  same composer node and selection offsets 9–17.
- **Capabilities:** all 19 surface capabilities and four toolkit sections retain
  editable fields through close/reopen, matching the baseline inventory.
- **Harness corrections:** programmed selection did not model actual keyboard
  selection, and an early form read needed a readiness wait. Corrected probes
  passed without attributing those assumptions to product fixes.
- **Disposition:** substantive candidate 1 browser evidence accepted. R8/R9 and
  denied-surface recovery still require candidate 2 changes and relevant reruns;
  these results cannot establish those unimplemented fixes.

### R4 follow-up — First target after read-only restoration

- **Reviewer:** raised a remaining source-level lifetime question: restoration
  intentionally does not persist a first target. A work URL requesting UAT with no
  saved target metadata could be followed by selecting SIT in that project's
  Overview, then reopening the work using remembered SIT instead of its original
  URL target.
- **Reviewer:** asked the implementer to retain the first resolved target on a
  subsequent explicit navigation, close, or edit while keeping mounting/restoring
  read-only. The coordinator can probe the sequence in a browser.
- **Disposition:** open R4 lifetime question, not yet browser-reproduced. Earlier
  captured-target tests do not close this missing-metadata restoration case.

### R4 follow-up design agreement

- **Implementer:** accepted the read-only restoration lifetime gap by inspection.
- **Reviewer / implementer:** agreed the controller retains the resolved
  destination and captures only its outgoing target before a later explicit
  navigation. The provider validates then persists target metadata without
  rewriting outgoing selection or tab state. Restoration itself remains read-only.
  Closing to a neighbor and choosing another org preserve the original target;
  edits already capture it.
- **Reviewer:** requested unit coverage and a browser sequence of direct UAT work,
  explicit SIT selection, then reopening the same work.
- **Disposition:** required R4 correction/design accepted for candidate 2;
  implementation and independent evidence pending.

### Candidate 1 final collection and R4 browser reproduction

- **Coordinator:** all six candidate 1 browser scripts complete with page errors
  `[]`: capability parity; navigation/history/two-tab/keyboard selection; scope
  migration/copy/save failure; motion cancellation/rapid navigation; nine
  unavailable-context cases; and Phase 2 histories/origin/recurrence/project
  creation/status-retry regressions. Artifacts are archived under
  `/tmp/ufd-phase3-browser/candidate1`.
- **Coordinator:** source checksums still match the candidate 1 build; its server
  is stopped. Candidate 2 source work is now released from the build freeze.
- **Coordinator — R4 reproduction:** `restored-target-before-results.json` shows
  direct UAT legacy work, explicit SIT selection, then reopening that tab silently
  changes its target to SIT. Notes survive. This upgrades the read-only lifetime
  concern from source inspection to a reproduced browser defect.
- **Harness-only corrections across the collection:** actual keyboard selection
  replaced a programmed select; scope checks wait for committed `aria-selected`
  state and labels; returning launchers need their disclosure opened; palette
  input uses the searchbox role; duplicate unavailable headings need a specific
  locator. These are test-driver corrections, not additional product fixes.
- **Disposition:** candidate 1 verification retained accurately, with the R4
  failure, R8/R9, and denied-surface correction still outstanding. Candidate 2
  must be built and its affected browser paths retested.

### A5 follow-up — Explore a surface with saved bound work

- **Reviewer:** found `SurfaceNav` calls `AgentPanel.explore`, which dispatches to
  the current session, before `navigateSurface` can restore a different captured
  target. Proposed reachable sequence: Code retains Acme query work, home selects
  CRM, then Explore Code restores Acme while the prompt may be appended to CRM.
- **Reviewer:** unlike the baseline's filtered same-thread resume cards, this
  entry point may cross sessions. Requested a disposition or fix such as letting
  the resolved destination seed its own conversation, or resolving the destination
  before dispatch.
- **Disposition:** source-level A5 question; reachability/browser confirmation and
  implementer response pending. It is not yet recorded as a browser-proven bug.
- **Reviewer:** independently inspected all six candidate 1 browser families and
  the after-graph; reports match the coordinator's evidence: 91 reachable of 93
  files, only the database seam/ambient type input outside the graph, no unresolved
  imports.

### Candidate 2 interim closed-draft and sign-in review

- **Reviewer:** the original independent R8 reproduction now passes: changing a
  name and closing retains the original source field; assignment from a closed
  source succeeds. The stored open stub may still have no draft, intentionally;
  the provider projects its matching closed content without a read-time write.
- **Reviewer:** inspected R9 internal URL normalization and found its source
  behavior sound. Full suite and browser confirmation remain pending.
- **Disposition:** R8 original module regression passes for the interim candidate;
  R9 has source-review evidence only. The Explore destination-session question
  remains open, alongside final validation of candidate 2.

### Candidate 2 complete implementation handoff

- **Implementer:** reports 74/74 tests pass (16 navigation + 58 prior tests),
  TypeScript exits 0, lint exits 0 with the one existing stylesheet warning, and
  whitespace is clean. Log: `/tmp/ufd-phase3-tests-candidate2.log`.
- **Implementer:** R8 hydrates sole closed content before edits and supports safe
  assignment from a closed source while retaining source bytes. R9 preserves only
  normalized internal sign-in destinations; bare/typed denied surfaces now use
  explicit unavailable recovery.
- **Implementer:** R4 captures the outgoing target only at a subsequent explicit
  navigation, close, or edit; restoration remains read-only.
- **Implementer:** removed the pre-navigation Explore dispatch chain so the
  resolved route visit owns its response. Agent surface suggestions open Overview
  while retaining the sender's target instead of implicitly switching to a
  remembered tab's scope. This addresses the source-level differing-session
  concern; independent tests/browser evidence remain required.
- **Maintenance:** duplicate access guards and stale comments removed; the
  `canvasTarget` domain helper moved from navigation to the canvas model.
  After-graph still reports 93 files, 91 reachable, only database seam/ambient type
  input outside the graph, no unresolved imports.
- **Scribe:** updated README for landed read-only restoration/capture timing,
  signed-out continuation, denied-surface recovery, and new regression coverage.
- **Disposition:** complete candidate 2 handed off for independent review, new
  production build, and affected browser reruns. No approval yet.

### Candidate 2 independent checks and source freeze

- **Reviewer:** independently ran the five suites under Node 22: 74/74 pass.
  `npx tsc --noEmit` passes; `npm run lint` explicitly under Node 22 exits 0 with
  the existing layout stylesheet warning; whitespace check is clean.
- **Runtime precision:** a lint command in an earlier shell chain used the default
  runtime. The reviewer immediately reran it with Node 22 explicitly; only that
  corrected rerun is the accepted runtime evidence.
- **Reviewer:** source review of R8/R9, outgoing target capture, and Explore
  ownership finds no known blocker before browser validation. Authorized the
  coordinator to freeze and build this candidate.
- **Disposition:** source/tests accepted for browser handoff, not phase approval.
  Production build, affected browser artifacts, and final documentation acceptance
  remain required.

### Candidate 2 coordinator build handoff

- **Coordinator:** froze source manifest
  `/tmp/ufd-phase3-browser/source-checksums-candidate2.txt` and started the same
  Node 22 production build (session `18492`). Result pending.
- **Coordinator:** feature-catalog comparison against the baseline exits 0,
  confirming the 19 capability and four toolkit definitions are unchanged.
- **Coordinator:** prepared focused `recovery-edges`, `signin-links`,
  `restored-target`, and `surface-context` browser scripts for the candidate 2
  fixes. Final passing artifacts will supersede candidate 1 evidence only after
  completion; no passing result is inferred from starting a build or script.

### Nullable-worktree presentation self-review

- **Implementer:** found an A1 consumer issue after source freeze: a CRM app
  destination legitimately has no worktree, but AgentPanel decides to show a
  worktree from the project's worktree count. A reply can therefore include
  `· undefined`; StatusBar can show an empty branch chip, and Today labels an
  established app context as `Planning`.
- **Reviewer:** requires a small presentation fix before approval. The current
  source freeze stays in place while candidate 2 browser evidence is collected.
- **Reviewer:** requested a final rebuild and focused CRM app/no-worktree
  reply/status checks alongside an actual planning project. Unaffected candidate 2
  results may be retained; this does not require an indiscriminate browser rerun.
- **Disposition:** confirmed source consumer issue; changes and final affected
  evidence pending. Earlier “no known blocker” statements describe the prior
  review point, not the current approval status.

### Candidate 2 production build and accepted edge checks

- **Coordinator:** Node 22 production build session `18492` exits 0 using the
  previously recorded command. Candidate 2 recovery/sign-in/restored-target/
  surface-context scripts pass, plus navigation, capability, and unavailable
  reruns. Scope/motion/Phase 2 regression scripts were still completing at this
  handoff.
- **Reviewer:** directly inspected `recovery-edges-results.json` (four cases,
  including recovery to a saved tab after a target conflict),
  `signin-links-results.json` (five cases), `restored-target-results.json` (UAT
  remains captured), and `surface-context-results.json` (five exact-context and
  original-thread-preservation cases). All have page errors `[]`.
- **Reviewer:** these close R4/R7/R8/R9, denied-surface recovery, and Explore
  browser questions for candidate 2. Only the nullable-worktree presentation fix
  remains a known code finding; final build/targeted browser/docs remain pending.
- **Harness precision:** the surface-context probe initially read before URL
  normalization, then selected a project before Home committed and legitimately
  visited Code. Waiting for the URL and committed Home state corrected the probe;
  the final script passes. These were not application fixes.
- **Disposition:** retain accepted candidate 2 edge evidence for unaffected paths.
  Candidate 3 will require a new build and focused nullable app/planning checks.

### Candidate 2 collection complete

- **Coordinator:** all ten browser families pass with page errors `[]`:
  `capabilities`, `navigation`, `unavailable`, `draft-scopes`, `motion`,
  `phase2-flows`, `recovery-edges`, `signin-links`, `restored-target`, and
  `surface-context`. This includes the last scope/motion/Phase 2 reruns.
- **Coordinator:** source checksums match, the production server is stopped,
  and candidate artifacts are copied to `/tmp/ufd-phase3-browser/candidate2`.
- **Next candidate boundary:** only AgentPanel/StatusBar nullable-worktree guards
  and truthful Today labeling are planned. No navigation, storage, or migration
  change is planned. The reviewer permits retaining unaffected candidate 2 matrix
  evidence alongside a new build and targeted CRM app/planning verification.
- **Disposition:** candidate 2 matrix complete. Approval still waits for the
  known presentation fix, final affected checks, and documentation acceptance.

### Candidate 3 nullable-worktree patch handoff

- **Implementer:** froze the limited patch: AgentPanel and StatusBar require an
  actual active worktree before showing a branch label or including it in a reply.
  Today distinguishes a planning project from an established project with no
  selected worktree and an unbound context with no selected project.
- **Implementer:** Node 22 TypeScript and lint exit 0 with the existing stylesheet
  warning; whitespace check is clean.
- **Scribe:** README now explicitly distinguishes an app destination without a
  selected worktree from a project that is still in planning.
- **Disposition:** known A1 fix implemented; final production build and targeted
  worktree-state, motion, and Phase 2 flow checks pending. Unaffected candidate 2
  browser evidence is retained as agreed with the reviewer.

### Candidate 3 independent source boundary

- **Reviewer:** inspected the three changed expressions: branch/reply guards now
  require an actual worktree, and Today distinguishes **Planning**, **No worktree
  selected**, and **No project selected**.
- **Reviewer:** a candidate 2 checksum audit shows only AgentPanel and StatusBar
  differ. Retaining the ten-family candidate 2 matrix is therefore justified;
  final worktree-state/motion/Phase 2 flow checks cover the affected presentation.
- **Disposition:** no other known in-phase code finding. Final build, targeted
  browser artifacts, documentation acceptance, and exact approval remain pending.

### Final production build

- **Coordinator:** final candidate production build passes, exit 0, under Node 22
  using the same `NEXT_TELEMETRY_DISABLED=1 npm run build` command (session
  `56556`). This is the final build evidence, superseding the earlier candidates'
  builds for the completed source.
- **Coordinator:** froze `/tmp/ufd-phase3-browser/source-checksums-final.txt` and
  started targeted `worktree-states.mjs` browser verification. Result pending.
- **Disposition:** final build passes; targeted browser and final review/approval
  remain pending. Starting the script is not a passing browser result.

### Targeted browser finding — Newly created planning target

- **Coordinator:** the established-project app/no-worktree case passes. The next
  planning-creation case fails: the saved plan's Work environment is SIT, but its
  destination URL has `orgId: null` and the footer shows **No connected org**.
  Artifact: `/tmp/ufd-phase3-browser/worktree-states-failed-results.json`.
- **Coordinator:** proposed a stale-render cause for investigation:
  `targetForCanvas` reads `workspace.projects` from before synchronous project
  creation and `openProject`. The implementer/reviewer must diagnose the cause;
  it is not classified as a harness error.
- **Disposition:** real target-consistency browser failure, diagnosis/fix pending.
  The preceding build passed its candidate, but cannot support phase approval with
  this known failure. Planning navigation and final affected checks must be closed
  before final approval.

### Planning creation target — Confirmed cause and fix agreement

- **Reviewer / implementer:** confirmed a real create-then-open bug. The domain
  creation result contains `targetOrgId`, but the old helper narrows it to ID/name;
  generic navigation then reads the React project projection from before creation
  and captures a null org.
- **Proposed fix:** route a dedicated typed domain-result entry through the same
  central controller, retaining any existing captured-target precedence. Do not
  reconstruct a newly created target from a stale rendered projection.
- **Coordinator:** preserved candidate 3 evidence as
  `/tmp/ufd-phase3-browser/source-checksums-candidate3.txt`,
  `build-id-candidate3.txt`, and `planning-target-before-results.json`.
- **Disposition:** cause confirmed and correction agreed; source change and
  regression evidence pending. The first nullable established-project case passed,
  but the full targeted planning run failed and does not count as approved.

### Planning target correction — Independent test and compiler follow-up

- **Reviewer:** independently confirmed the failed planning artifact represents
  saved SIT context versus a null URL/footer target.
- **Reviewer:** inspected the dedicated plan destination factory and regression
  using the actual `AssessmentStore.createProject` result. The factory preserves
  existing captured-target precedence and retired IDs. All 75 tests independently
  pass for this candidate.
- **Compiler follow-up:** full TypeScript checking exposed a missing `targetOrgId`
  in the bounded `ProjectSummary` path. The implementer is carrying that field
  through the summary constructors so historical/read-model project entry points
  satisfy the same target contract.
- **Disposition:** creation regression passes; full compile/build and seven
  affected browser families remain required after the read-model correction. No
  final acceptance is inferred from the test pass while compilation is unfinished.

### Planning target correction — Complete source handoff

- **Implementer:** introduced `openImprovementProject` and pure
  `improvementProjectDestination` using authoritative `id`, `name`, and
  `targetOrgId`. Existing captured context takes precedence; worktree remains
  explicitly null. Workspace/palette plan links use the same entry point, and
  uncaptured plan restoration uses its declared target.
- **Implementer:** complete live/historical `ProjectSummary` constructors copy
  `targetOrgId` as an identity field. They do not reconstruct a historical target
  from the current catalog.
- **Reviewer:** independently accepted the five-file correction and permanent
  assertions that full created records and both live/historical summaries produce
  the same destination. Reran all 75 tests and Node 22 TypeScript: exit 0.
- **Implementer:** final lint exits 0 with the existing stylesheet warning;
  whitespace check is clean. Source frozen for the coordinator's new build.
- **Scribe:** README records authoritative planning-project entry and captured
  summary targets, including the dedicated extension entry point.
- **Disposition:** no known source blocker remains. New build, seven agreed
  affected browser families, and final documentation/approval are still pending.

### Candidate 4 final build and browser boundary

- **Coordinator:** froze candidate 4 and completed the Node 22 production build
  (session `47263`, exit 0): compilation, TypeScript, and static routes pass.
  `/tmp/ufd-phase3-browser/source-checksums-final.txt` now identifies candidate 4.
- **Source boundary:** five files differ from candidate 3: navigation provider,
  planning-project hook, destination factory, Today summary target identity, and
  navigation regression. Together with the two nullable presentation files, the
  reviewer accepts the seven-file difference from candidate 2.
- **Coordinator / reviewer:** seven affected browser families will run on the
  final build. Only four unaffected candidate 2 families are retained for final
  acceptance: capabilities, draft scopes, motion, and sign-in links. The other
  candidate 2 results remain historical evidence pending their final reruns.
- **Coordinator:** strengthened `worktree-states` to check equality with the saved
  target, an actual reply, reload, and reopening through workspace and Today links.
- **Disposition:** final build passes; seven browser families and documentation/
  approval remain pending. The earlier narrower candidate 3 retention decision is
  superseded by this explicit final source boundary.

### Final six browser families accepted

- **Coordinator / reviewer:** final `navigation`, `phase2-flows`,
  `surface-context`, `restored-target`, `recovery-edges`, and `unavailable` scripts
  pass with page errors `[]`. The reviewer independently inspected and accepted
  all six current result artifacts.
- **Targeted progress:** `worktree-states` passes its existing-project/no-worktree
  checks and the planning flow's saved SIT/URL/footer equality, no fabricated
  branch, real reply, retained target after reload, and workspace reopening. Full
  Today reopening assertions are still running; partial success is not a complete
  browser-suite pass.
- **Harness corrections:** the workspace row was inside a normally collapsed
  panel. The script now reads `aria-expanded`, uses the real disclosure toggle,
  and selects the specific saved-project row, without forced clicks. A later
  Today locator selected an older disabled historical card; it now chooses the
  enabled live action, preserving Phase 2's read-only history contract. The
  reviewer accepted both corrections. `planning-today-harness-results.json` is
  separate diagnostic evidence from the original saved-SIT/null target failure.
- **Reviewer:** final README planning-result/summary-target wording and extension
  seam match the source; no wording changes requested. Source manifest matches;
  the full final worktree rerun remains pending.
- **Disposition:** the planning mismatch is fixed in candidate 4. Approval still
  waits for the complete worktree result, final ledger review, and the independent
  reviewer's exact decision.

### Final artifact acceptance and documentation handoff

- **Coordinator:** all seven final browser families pass, exit 0/page errors
  `[]`. The complete `worktree-states` run verifies saved SIT, matching URL/footer,
  actual reply, reload, and both workspace/Today reopening. Final build remains
  session `47263`.
- **Reviewer:** independently inspected and accepted all three worktree-state
  records, completing the seven-family final set. A1–A7 are satisfied with the
  independent 75 tests/TypeScript, lint/build, final seven families, four retained
  candidate 2 families, source manifest, and graph/parity evidence.
- **Reviewer:** visually inspected both final screenshots. Established CRM app
  context shows **No worktree selected**, CRM/UAT footer, and no blank branch.
  The planning canvas shows Work environment SIT and matching SIT footer without
  a fabricated branch.
- **Coordinator:** final successes, targeted script, screenshots, manifest, and
  build ID are archived under `/tmp/ufd-phase3-browser/candidate4`. Checksums still
  match, whitespace is clean, and the production server is stopped.
- **Scribe:** independently checked the seven designated result counts/error
  fields and final source manifest; all match. Compared Phase 1/2 journals with
  the Phase 3 baseline copy: both remain unchanged. Consolidated the present
  ledger, every finding disposition, archive paths, verification limits, and
  next-phase handoff for the reviewer's last read.
- **Disposition:** no unresolved in-phase code finding or technical check remains.
  Final documentation acceptance, exact independent approval and its mechanical documentation transcription are
  the only remaining steps. Phase 4 remains user-gated.

### Baseline validation and import graph

- **Coordinator:** ran the four existing suites from the copied Phase 3 baseline
  under Node `22.23.2`: 58/58 pass, exit 0. The first copied-tree invocation could
  not resolve TypeScript; linking the installed `node_modules` fixed the test
  harness's module lookup. This was not a product failure.
- **Coordinator:** the corrected entry graph reports 123 source/style/type files,
  88 reachable files, and 34 unreachable runtime/style files totaling 8,157 lines.
  One additional unimported two-line ambient declaration is compiled type input,
  not dormant runtime code. No unresolved imports are reported. A naming collision
  in the first temporary graph harness reported zero reachable files; that harness
  was corrected before this accepted inventory.
- **Coordinator:** `CanvasLayout` is reachable and must stay. The unused `db.ts`
  helper remains an intentional Phase 4 integration seam.
- **Scribe:** inspected `/tmp/ufd-phase3-graph-before.json`; counts and finite file
  list match the report. Deletion/retention/port dispositions remain pending.
- **Limit:** reachability identifies maintenance ambiguity; it does not measure
  client bundle size, runtime performance, or capacity.

## Final finding dispositions

Earlier round notes preserve what was pending at that time. The table below records
the final disposition; all in-phase code findings are resolved with accepted
evidence. The independent reviewer's final approval is recorded below.

| Finding / review question | Status |
| --- | --- |
| Explicit unavailable IDs versus missing/unbound context | Resolved through explicit resolver/strict codec; independent module tests and accepted unavailable-context browser evidence |
| Toolkit context inheritance and legacy closed global draft scope | Resolved through inherited captured scope/conservative unbound migration; module tests and accepted scope/toolkit browser checks |
| Profile-safe URL restoration and competing host writes | Resolved through shared decision/per-tab URL authority; accepted history/profile/two-tab/sign-in evidence |
| R2: generated/observed URL query encodings differ | Resolved; original module reproduction and accepted URL/history integration checks pass |
| R3: malformed explicit targets fall back or accept inconsistent IDs | Resolved; strict shared codec protects bytes with invalid status, independent tests and unavailable recovery evidence pass |
| R4: surface restoration and explicit work open resolve different orgs | Resolved; outgoing capture preserves UAT through explicit SIT selection and reopen; reviewer accepted candidate 2 browser regression |
| R5: full canvas object may serialize draft content into a shareable URL | Resolved through whitelisted encoding; independent full-object regression and accepted browser URL-content exclusion pass |
| R6: shared navigation hints retarget another tab while its URL stays fixed | Resolved; per-tab URL authority/shared draft synchronization passes independent two-tab browser checks |
| R7: separate URL projections bypass the navigation target-conflict decision | Resolved through shared destination decision; reviewer accepted candidate 2 conflict rejection/saved-tab recovery browser evidence |
| R8: open stub hides sole closed fields; partial edit loses source; closed assignment fails | Resolved; original module retest and accepted candidate 2 read/edit/closed-assignment browser evidence preserve source |
| R9: signed-out direct entry loses destination through login | Resolved; normalized internal continuation and matching/mismatched profile browser cases accepted for candidate 2 |
| Denied-surface guards redirect home before shared recovery | Resolved; shared rejection blocks feature with recovery; candidate 2 browser evidence accepted |
| Superseded route completion leaves URL/context agreement intact | Resolved; URL repair and latest-intent/cancellation module tests plus directed production motion checks pass |
| App/project destinations without worktrees remain usable when valid | Resolved; core context and final established-app/planning browser checks support absent worktrees without fabricated resources or misleading labels |
| Nullable app worktree renders undefined/empty branch or misleading Planning | Resolved; reviewer accepted final three-state worktree browser and both screenshots: no undefined reply/blank branch and correct planning versus no-worktree labels |
| Newly created planning project has saved SIT target but URL/footer no org | Resolved; final domain-result/live/history factory, 75 tests, and complete saved-SIT/reply/reload/workspace/Today browser regression accepted |
| Original unverified cross-route ordering concern | Closed by explicit controller ownership and directed rapid/cancel evidence; the original baseline race was not demonstrated and is not retroactively claimed |
| Resume dispatch occurs before navigation; differing-session reachability unproven | Dispositioned as latent baseline contract hazard: current baseline cards are same-session, source ownership tightened, accepted browser reply isolation; no confirmed baseline UI bug claimed |
| Explore dispatch precedes restoration of a possibly different bound target | Resolved by route-owned response/sender-scope suggestions; reviewer accepted candidate 2 exact-context/original-thread browser checks |
| Composer selection is not retained per session | Resolved; baseline loss reproduced, accepted final navigation and retained candidate 2 motion evidence preserve composer text/selection/thread under the reviewed source boundary |
| Dormant implementation inventory and capability parity | Resolved; reviewer accepted finite removals, independent graph/build and candidate 2 19+4 capability parity/unchanged catalog |

## Dormant import-graph inventory

The baseline graph follows the eight app/proxy entry files and reports no unresolved
imports. Each row names all files in its group; counts total the 34 unreachable
runtime/style files. The reviewer accepted these removals after source/feature
review; candidate 1 graph, capability parity, and build checks confirm those
removals. Later source changes still require their own final validation.
Reachability alone was not deletion evidence.

| Group | Files under `src/` | Count | Disposition |
| --- | --- | --- | --- |
| Legacy left navigation | `components/app-shell/LeftNav.tsx`, `LeftNav.module.css`, `nav-items.tsx` | 3 | Accepted removal — detached duplicate of current shell navigation; removed, candidate 1 graph/parity/build pass |
| Legacy canvas area and Today view | `components/canvas/CanvasArea.tsx`, `CanvasArea.module.css`, `TodayBrief.tsx`, `TodayBrief.module.css` | 4 | Accepted removal — current host/front door own these active flows; removed, candidate 1 graph/parity/build pass |
| Legacy provider and registry | `components/canvas/canvas-context.tsx`, `canvas-ids.ts`, `canvases.tsx`, `canvas-views.tsx` | 4 | Accepted removal — superseded by active typed canvas registry/provider; removed, candidate 1 graph/parity/build pass |
| Legacy canvas kit and ALM descriptors | `components/canvas/canvas-kit.tsx`, `canvas-kit.module.css`, `alm-surfaces.tsx` | 3 | Accepted removal — supports only detached designs; active shared layout retained; removed, candidate 1 graph/parity/build pass |
| Legacy creation and provisioning | `components/canvas/create-resource.tsx`, `create-resource.module.css`, `project-provisioner.tsx`, `project-provisioner.module.css` | 4 | Accepted removal — detached earlier project/execution demos, no current affordance; removed, candidate 1 graph/parity/build pass |
| Legacy metadata and project workspace | `components/canvas/metadata-explorer.tsx`, `metadata-explorer.module.css`, `project-metadata.tsx`, `project-workspace.tsx`, `project-workspace.module.css` | 5 | Accepted removal — detached earlier designs, no current affordance; removed, candidate 1 graph/parity/build pass |
| Legacy builder and fixture models | `components/canvas/resource-builder.tsx`, `resource-builder.module.css`, `resource-kinds.tsx`, `projects-data.tsx` | 4 | Accepted removal — old fabricated execution/project model is not ported; removed, candidate 1 graph/parity/build pass |
| Legacy chat | `components/chat/ChatPanel.tsx`, `ChatPanel.module.css`, `chat-scopes.tsx` | 3 | Accepted removal — current AgentPanel/conversation path retained; removed, candidate 1 graph/parity/build pass |
| Dormant app launcher | `components/front-door/AppLauncher.tsx`, `AppLauncher.module.css` | 2 | Accepted removal — detached duplicate of active surface navigation/launcher; removed, candidate 1 graph/parity/build pass |
| Database seam | `lib/db.ts` | 1 | Retain — coordinator identifies intended Phase 4 server integration seam |
| Workspace projections | `lib/workspace/projections.ts` | 1 | Accepted removal — unused fixture metric/insight generator, no distinct pure invariant identified; removed, candidate 1 graph/parity/build pass |

`components/canvas/CanvasLayout.tsx` and its active dependencies are reachable and
outside this removal inventory. `types/react-canary.d.ts` is a two-line ambient
compiler input, not a dormant runtime implementation. Neither is a deletion target
based on this graph.

## Validation evidence

| Stage | Runtime / command | Result and limit |
| --- | --- | --- |
| Phase 2 handoff | Prior phase's Node 22 test/lint/build and focused Chromium checks | Approved baseline: 58 tests and documented domain/migration/recovery checks. Historical evidence only; not Phase 3 validation. |
| Coordinator Phase 3 baseline suites | Node `22.23.2`, working directory `/tmp/ufd-phase3-baseline`, installed dependencies linked; `NEXT_TELEMETRY_DISABLED=1 node --test scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs` | 58/58 pass, exit 0. Approved baseline rerun only; Phase 3 changes require new validation. |
| Coordinator baseline import graph | `/tmp/ufd-phase3-graph.cjs`; `/tmp/ufd-phase3-graph-before.json` | 123 files, 88 reachable; 34 unreachable runtime/style files at 8,157 lines plus one two-line ambient declaration; no unresolved imports. Scribe inspected output. Reachability evidence only, not a bundle/performance measurement. |
| Reviewer interim module probes | Node 22; `/tmp/ufd-phase3-reviewer-probes.mjs`, using `testModules` to compile current libraries | Pass: context states/unavailable IDs, punctuation URLs, target mismatches, old unbound migration, required scope, latest-intent/history cancellation ordering. Interim pure-library evidence; final/browser pathname synchronization remains pending. |
| Reviewer Round 2 reproductions | Node 22; `/tmp/ufd-phase3-reviewer-round2.mjs`, transpiling actual modules | R2 and R3 reproduced: equivalent decoded URL not acknowledged; malformed explicit target silently removed in favor of legacy maps with saved status. Expected failure evidence, not a passing final check or browser result. |
| Coordinator baseline session browser | Approved Phase 2 production build; Node 22, Chromium 152, temporary Playwright 1.63; `/tmp/ufd-phase3-browser/baseline.mjs` | Observation script passes: reply isolation, same composer node, and draft text retained; selection loss 9–12 → 0–0 reproduced. Artifact: `baseline-session-switch-results.json`. Final Phase 3 selection/history/navigation checks pending. |
| Coordinator baseline capability browser | Same approved build/runtime; `PHASE3_BASELINE=1` with `/tmp/ufd-phase3-browser/capabilities.mjs` | 19 capabilities + four toolkit sections pass editable-field and close/reopen checks, page errors `[]`; `capabilities-before-results.json`. Baseline source checksum matches; build ID `7BOUDIEAL1_aeJgPfgXFU`. Final Phase 3 parity pending. |
| Implementer interim type/test handoff | TypeScript check before latest captured-target metadata patch; existing suites being adapted to required command scope | TypeScript passed for the earlier candidate. Existing command-fixture failures and focused regression additions remain in progress; old migration payload coverage is retained. No latest-candidate validation claim. |
| Reviewer R2/R3 original-reproduction retest | Node 22; original Round 2 module fixtures against current source | Pass: equivalent query encodings acknowledge the destination; malformed explicit target yields invalid status/unbound initial snapshot and preserves bytes. Module evidence only; final browser integration pending. |
| Implementer first complete candidate | Node 22; five test suites, TypeScript, latest lint; `/tmp/ufd-phase3-tests.log` | 70/70 tests pass (12 navigation + 58 existing); current TypeScript passes, latest lint exits 0 with one existing layout stylesheet warning. R5/R6/R7 changes and 33 deletions reported; independent candidate validation and final browser/build pending. |
| Reviewer first complete candidate | Node 22; all five test suites, lint, whitespace check | Independently 70/70 pass; lint exits 0 with the existing stylesheet warning; whitespace clean. Remaining migration edge review and production browser/build pending. |
| Implementer after-removal graph | Absolute-root invocation; `/tmp/ufd-phase3-graph-after-implementer.json` | 93 files, 91 reachable, only database seam/ambient type input outside graph, no unresolved imports. Earlier relative-root harness result discarded. Final independent graph/parity/build still required. |
| Reviewer R8 reproduction | Node 22; `/tmp/ufd-phase3-reviewer-round8.mjs`, actual modules | Reproduces hidden sole closed content, source loss after partial edit/close, and failed assignment from closed source. Expected failure evidence; R8 fix/retest pending. |
| Coordinator candidate 1 production build | Node `22.23.2` first in `PATH`; `NEXT_TELEMETRY_DISABLED=1 npm run build`; exec session `12320` | Exit 0; Next `16.2.9` compile/types/static routes pass. Source manifest `/tmp/ufd-phase3-browser/source-checksums-candidate1.txt`. Candidate 2 fixes require a new build. |
| Coordinator candidate 1 after-graph | `/tmp/ufd-phase3-graph-after-candidate1.json` | Independently confirms 93 files, 91 reachable, only database seam/ambient type input outside graph, no unresolved imports. Agrees with implementer report; no performance claim. |
| Candidate 1 production navigation browser | Archived `/tmp/ufd-phase3-browser/candidate1/navigation-results.json`; script/results reviewer-inspected | Pass, page errors `[]`: actual keyboard selection 9–12 through sessions/history, exact destination context, URL excludes edited content, two-tab independent views/shared edits. Candidate 2 affected reruns pending at that handoff. |
| Candidate 1 production scope browser | Archived `/tmp/ufd-phase3-browser/candidate1/draft-scopes-results.json`; reviewer inspected | Pass, page errors `[]`: three isolated Apex scopes, target collision preservation, write-failure handling. Candidate 2 closed-source assignment/read regressions pending at that handoff. |
| Candidate 1 production motion browser | Archived `/tmp/ufd-phase3-browser/candidate1/motion-results.json`; script/results reviewer-inspected | Pass, page errors `[]`: palette reopen cancellation and delayed Code → Build latest-intent outcome, same composer/selection 9–17. Candidate-specific evidence, not exhaustive timing proof. |
| Candidate 1 production capability browser | Archived `/tmp/ufd-phase3-browser/candidate1/capabilities-results.json`; reviewer inspected | All 19 capabilities + four toolkit sections pass editable-field and close/reopen parity, page errors `[]`. Candidate 2 relevant regressions remained required. |
| Coordinator candidate 1 unavailable and Phase 2 browser regressions | Archived with all six script results under `/tmp/ufd-phase3-browser/candidate1` | Nine unavailable-context cases pass; Phase 2 historical/origin/recurrence/create/status-retry paths pass; page errors `[]`. Source checksums match and server stopped. R4/R8/R9 and denied-surface changes remain unvalidated. |
| Coordinator R4 lifetime browser reproduction | Archived `/tmp/ufd-phase3-browser/candidate1/restored-target-before-results.json` | Reproduces UAT direct work → explicit SIT selection → reopen work silently targeting SIT; notes preserved. Expected failure evidence requiring candidate 2 correction. |
| Reviewer candidate 2 R8 original-reproduction retest | Original `/tmp/ufd-phase3-reviewer-round8.mjs` against interim candidate 2 | Pass: partial edit/close retains source and closed-source assignment succeeds. Open stub remains unchanged until an edit; provider projects closed content read-only. Full final suite/browser checks pending. |
| Implementer candidate 2 | Node 22; five suites, TypeScript, lint, whitespace, after-graph; `/tmp/ufd-phase3-tests-candidate2.log` | 74/74 pass (16 navigation + 58 prior); TypeScript/lint exit 0 with one existing stylesheet warning; whitespace clean; graph remains 93 total/91 reachable, database seam/ambient type only, no unresolved imports. Independent final review/build/browser pending. |
| Reviewer candidate 2 | Explicit Node 22; `node --test scripts/navigation.test.mjs scripts/domain.test.mjs scripts/persistence.test.mjs scripts/onboarding.test.mjs scripts/conversation.test.mjs`; `npx tsc --noEmit`; `npm run lint`; whitespace check | Independently 74/74 pass; TypeScript and explicit Node 22 lint exit 0 with the existing stylesheet warning; whitespace clean. No known source blockers before browser handoff. Final build/browser/docs acceptance pending. |
| Coordinator candidate 2 handoff | `/tmp/ufd-phase3-browser/source-checksums-candidate2.txt`; Node 22 build session `18492`; baseline feature-catalog comparison | Source frozen; build running. Catalog comparison exits 0 for unchanged 19 capability/four toolkit definitions. Final edge/browser results pending. |
| Coordinator candidate 2 production build | Node 22, same `NEXT_TELEMETRY_DISABLED=1 npm run build`; session `18492` | Exit 0. Supersedes candidate 1 build for candidate 2 changes; nullable-worktree patch requires another build. |
| Reviewer accepted candidate 2 edge browsers | Archived under `/tmp/ufd-phase3-browser/candidate2/`: `recovery-edges-results.json`, `signin-links-results.json`, `restored-target-results.json`, `surface-context-results.json` | Four recovery cases, five sign-in cases, retained-UAT regression, five exact-context/original-thread cases; all page errors `[]`. Closes R4/R7/R8/R9/denied/Explore for candidate 2; nullable presentation remained pending. |
| Coordinator complete candidate 2 browser matrix | Ten result families archived under `/tmp/ufd-phase3-browser/candidate2` | All ten families pass, page errors `[]`; source checksums match and server stopped. Reviewer permits retained unaffected evidence after the limited nullable-worktree presentation patch; new build/targeted app/planning checks still required. |
| Implementer candidate 3 presentation patch | Explicit Node 22 TypeScript/lint and whitespace check | TypeScript/lint exit 0 with the existing stylesheet warning; whitespace clean. AgentPanel/StatusBar branch/reply guards and accurate Today labels implemented; final build/targeted browser pending. |
| Reviewer candidate 3 source boundary | Source review and comparison against candidate 2 checksum manifest | Only AgentPanel/StatusBar changed; guarded branch/reply and three honest Today states accepted. Unaffected ten-family browser evidence retained; final build/targeted browser pending. |
| Coordinator candidate 3 production build | Node 22; `NEXT_TELEMETRY_DISABLED=1 npm run build`; session `56556` | Exit 0. Preserved manifest `/tmp/ufd-phase3-browser/source-checksums-candidate3.txt` and `build-id-candidate3.txt`. Passed build was followed by the planning-target failure; a new final build is required. |
| Coordinator candidate 3 targeted browser | Preserved `/tmp/ufd-phase3-browser/planning-target-before-results.json` | Established app/no-worktree case passes; newly created planning project fails target consistency (saved SIT versus URL null/footer no org). Cause confirmed; fix/rebuild/retest required. This is a product failure, not a harness error. |
| Reviewer planning-target correction tests | Node 22; all five suites, including actual createProject → destination regression | Independently 75/75 pass; factory preserves captured override and retired IDs. Full TypeScript identified ProjectSummary target propagation still being completed; final compile/build/seven affected browser families pending. |
| Final planning-target source handoff | Reviewer: all five suites and explicit Node 22 TypeScript; implementer: lint/whitespace | Final 75/75 tests and TypeScript pass after complete live/history target propagation; lint exits 0 with existing stylesheet warning, whitespace clean. Five-file correction source-reviewed; new build/seven affected browsers pending. |
| Coordinator candidate 4 final production build | Node 22; `NEXT_TELEMETRY_DISABLED=1 npm run build`; session `47263` | Exit 0, compile/types/static routes pass. Final manifest now identifies candidate 4. Reviewer accepts seven changed files versus candidate 2; seven affected browser families pending, four named unaffected families retained. |
| Final six affected browser families | Archived under `/tmp/ufd-phase3-browser/candidate4/`: `navigation-results.json`, `phase2-flows-results.json`, `surface-context-results.json`, `restored-target-results.json`, `recovery-edges-results.json`, `unavailable-results.json` | All exit 0/page errors `[]`; reviewer independently inspected/accepted. Final complete worktree evidence follows below. |
| Final complete worktree browser and visual check | `/tmp/ufd-phase3-browser/candidate4/worktree-states-results.json`, targeted script, `project-without-worktree.png`, `planning-project.png` | Three records/page errors `[]`; saved SIT matches URL/footer through reply/reload/workspace/Today; established no-worktree and planning presentation correct. Reviewer inspected artifacts and both screenshots. |
| Final source/artifact integrity and shutdown | `/tmp/ufd-phase3-browser/candidate4/source-checksums-final.txt`, `BUILD_ID`; final manifest check and whitespace check | Coordinator and scribe confirm matching source checksums; whitespace clean; temporary server stopped. Original Phase 1/2 journals unchanged; reviewer accepted final documentation and issued the approval below. |

### Designated final candidate 4 browser artifacts

The final accepted files below live under `/tmp/ufd-phase3-browser/candidate4/`.
Each has page errors `[]`; the reviewer inspected substantive evidence, and the
scribe checked each recorded scenario count. Four unaffected candidate 2 families
listed in the following table complete the agreed validation boundary.

| Result file | Recorded scenarios |
| --- | ---: |
| `worktree-states-results.json` | 3 |
| `phase2-flows-results.json` | 4 |
| `navigation-results.json` | 6 |
| `surface-context-results.json` | 5 |
| `restored-target-results.json` | 1 |
| `recovery-edges-results.json` | 4 |
| `unavailable-results.json` | 9 |

### Designated candidate 2 passing browser artifacts

Passing historical files live under `/tmp/ufd-phase3-browser/candidate2/`. This table
identifies the ten successful result files and their final-candidate use; counts are recorded scenarios, not a
count of every assertion. Each has top-level page errors `[]`. The archive also
contains baseline and `failed`/`before` diagnostic files copied during collection;
those are not part of the passing matrix. The scribe independently checked the
designated files' counts/error fields; the reviewer inspected substantive browser
evidence and scripts.

| Result file | Recorded scenarios | Final-candidate use |
| --- | ---: | --- |
| `capabilities-results.json` | 23 | Retained unaffected evidence |
| `draft-scopes-results.json` | 4 | Retained unaffected evidence |
| `motion-results.json` | 3 | Retained unaffected evidence |
| `navigation-results.json` | 6 | Superseded by accepted final rerun |
| `phase2-flows-results.json` | 4 | Superseded by accepted final rerun |
| `recovery-edges-results.json` | 4 | Superseded by accepted final rerun |
| `restored-target-results.json` | 1 | Superseded by accepted final rerun |
| `signin-links-results.json` | 5 | Retained unaffected evidence |
| `surface-context-results.json` | 5 | Superseded by accepted final rerun |
| `unavailable-results.json` | 9 | Superseded by accepted final rerun |

## Verification limits

- Committed automated suites cover domain, navigation, migration, persistence,
  assessment, and conversation contracts. Production-browser scripts and captured
  artifacts under `/tmp/ufd-phase3-browser` are temporary tooling, not a committed
  repeatable browser suite or new repository dependency.
- Browser evidence uses one Chromium version with focused journeys, keyboard
  selection, delays/cancellation, storage failure, and two tabs. It does not
  establish broad accessibility, cross-browser coverage, or exhaustive timing
  correctness. The original unverified race is closed by explicit ownership and
  directed checks, not by claiming it was reproduced in the baseline.
- Reachability counts establish a finite maintenance cleanup. They are not a
  bundle-size, rendering-performance, or production-capacity measurement.
- Profile markers and client destination validation express demo context, not
  server authorization. Browser persistence remains non-transactional across
  tabs; conversations/composer drafts remain local to the active session.
- Neon, database migration/import, real-agent execution, Heroku release readiness,
  and broader accessibility/capacity work remain in their later phases. This
  phase does not claim those integrations or deployments were verified.

## Remaining work and handoff

- Phase 3 is approved with no outstanding in-phase work. Final evidence and the exact
  reviewer decision are recorded in this journal.
- Stop for the user's Phase 4 checkpoint. No later phase has started.
- Neon configuration, schema, and server persistence remain Phase 4; execution
  ownership remains Phase 5; general accessibility and measured capacity remain
  Phase 6. No later phase or deployment has been authorized by this checkpoint.

## Approval and user checkpoint

**Reviewer decision — `phase3_reviewer`, September 15, 2026:**

> APPROVED — 100% of Phase 3 acceptance criteria P3-A1 through P3-A8 satisfied.

The independent reviewer reports no unresolved in-phase finding or required check.
Approval follows 75 tests and TypeScript, Node 22 lint/build, seven final browser
families plus four explicitly retained unaffected families, matching source
checksums, finite cleanup/parity evidence, and final documentation review. The
limitations above remain part of that evidence; this is not a claim of complete
production, Neon, Heroku, or real-agent readiness.

**User checkpoint:** Phase 4 requires the user's next authorization. Its deliverable
is Neon application persistence, including the isolated database target, schema,
server ownership, and explicit legacy import. No later phase has started.
