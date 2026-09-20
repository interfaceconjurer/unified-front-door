# Phased UI restoration state

Current as of September 20, 2026. The user authorized a swarm to assess and adapt
the seven remaining behaviors from `f6313a2`, one at a time. This is a selective
restoration into the current architecture, not a blanket merge. The completed
work is being published on `org-exploration`; main and the hosted deployment
remain unchanged.

**Handoff: Review.** All seven phases have passed their implementation,
independent review, and focused validation gates. The local preview remains at
`http://127.0.0.1:3000`; its worker was reloaded after the final runtime changes.
No phase is pending. The completed result remains ready for Jordan's review.
Model checks used mocked providers, with no paid Anthropic calls.

The historical evidence is in [the UI history audit](ui-history-audit.md).
The real agent's current authority and navigation contract are in
[agent runtime](agent-runtime.md).

## Owners and phase gate

| Role | Owner | Responsibility |
| --- | --- | --- |
| Coordinator | Root agent | Set phase scope, resolve integration choices, run acceptance checks, and advance one phase at a time. |
| Implementer | Implementer agent | Inspect current owners, adapt the behavior, and add focused verification. |
| Reviewer | Reviewer agent | Independently assess architecture, correctness, preservation of newer behavior, and test gaps. |
| Scribe | Scribe agent | Maintain this ledger, update the history audit after verified restoration, and keep the Hive task/project handoff current. |

Each phase passes through architecture assessment, adaptation/implementation,
independent review, focused validation, and a recorded result before the next
phase starts. A dependency may remain assigned to a later phase, but must be
named explicitly. “Verified” means the team's stated checks passed; it does not
mean user approval, merge, or deployment. The overall task remained In Progress
until all seven phases had a reviewed outcome, and is now Review.

## Architecture constraints

- Server-owned conversations, agent runs, assessment findings, project commands,
  revisions, and acknowledged drafts remain authoritative. Do not restore the
  old local-only conversation or assessment stores.
- Navigation goes through the current controller and explicit captured
  project/worktree/org targets. Keep project isolation, org continuity, Home
  behavior, saved tab identities, and existing draft ownership.
- Today is global only. Historical Today keeps its recognizable layout with
  disabled actions, static history, and no repeated entrance reveal.
- Real Anthropic execution uses the existing bounded navigation tools. Partial,
  failed, cancelled, historical, or superseded replies cannot automatically
  navigate. Do not introduce a second client planner or fabricated agent replies.
- Use shared capability definitions and current permissions. Canvas availability
  must agree across UI, destination validation, and the agent's captured catalog.
- Preserve reduced motion, keyboard operation, request idempotency, revision
  guards, and active project/worktree resumption.
- Planning records are not proof of a provisioned repository, connected private
  org, executed deployment, or live discovery. UI language must remain truthful.
- Read the installed Next.js guides before changing related framework behavior.
  Keep each change bounded; do not broaden a feature into a legacy-tree rewrite.

## Phase ledger

| Phase | Behavior | Status | Acceptance criteria and dependencies | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Direct starter canvases and prompt seeding | Complete — reviewed and verified locally | Agent, React-app, and pipeline cards open the appropriate available canvas, preserve selected org/project scope, and seed without submitting. Permission fallback remains valid. Historical cards stay disabled. Phase 3 has now upgraded the interim first-project destination to the dedicated ALM project capability. | Independent reviewer approved; 24 navigation/starter tests passed; seven `starter-canvases.mjs` browser cases passed; TypeScript and lint passed. |
| 2 | Govern assessment, scope, and findings canvas | Complete — reviewed and verified locally | Scope/evidence actions capture run ID, optional finding ID, and current scope in Govern. Explicit run/finding destinations stay pinned; no-run overview follows latest. Only the current run offers execution controls. Sam's Govern access is consistent across UI/server validation. | Reviewer approved; 29 navigation tests, 48 model tests, 52 application/domain/onboarding/resource tests, six focused browser checks, typecheck, lint, and worker build passed. |
| 3 | ALM project creation and empty-state actions | Complete — reviewed and verified locally | Shared ALM project capability is reachable from starter, ALM, palette, and sidebar. General profiles save an honest planning brief via existing `canvas.save`; only Sam's finding-backed draft uses `project.create`. Acknowledged drafts survive Home/close and retain `draft.runId`; queue and same-tick guards prevent duplicates/edit races. Late acknowledgements respect newer navigation. | Reviewer approved and independently ran 24 project/domain tests; implementer reported 79 focused tests plus typecheck/lint/worker build; four root browser groups passed with no page errors. |
| 4 | Conversational Home planning and explicit navigation | Complete — reviewed and verified locally | `workspace-planner-v3` uses existing durable chat and only exposes navigation tools for explicit navigation in the current request. The model chooses a scoped ID; the worker checks its saved catalog. Exact queued v1/v2 behavior is preserved. Demo surface navigation also requires an explicit request. Ambiguous/content requests stay in chat. | Reviewer independently passed 54 intent/model tests and four byte-identical v1/v2 comparisons; root passed 22 mocked-model DB tests and six browser navigation/replay cases with no errors. No paid calls. Runtime worker reload confirmed. |
| 5 | Project overview links focus the sidebar parent | Complete — reviewed and verified locally | Overview project links open the workspace panel, select ephemeral Projects filter, reveal/focus the parent, and retain selected worktree and URL/target. Top-bar badge continues to open the palette. Keyboard re-open works after switching the filter. | Source reviewer approved; typecheck/lint passed; root browser groups passed normal/reduced motion, selected-worktree aria-current, focus/filter behavior, unchanged navigation, top-bar palette, and no errors. |
| 6 | Deployed-app operations in ALM and release selection | Complete — reviewed and verified locally | Deployed-app operations route to ALM, while Build retains builders/resource configuration. Legacy app/work URLs replace to ALM; tabs, closed drafts, targets, active selection, receipts, and queued model catalog bytes remain compatible. Conflicts have recovery. Release progress selects Release plan by kind. | Reviewer independently passed 64 tests and approved; implementer reported 84 focused tests plus typecheck/lint/worker build; root DB coverage passed after one overbroad new assertion was corrected, and three ALM migration browser groups passed with no errors. |
| 7 | Demo attention across projects and worktrees | Complete — reviewed and verified locally | Hotfix code review, Acme performance, and Acme release approval scenarios and waiting sessions are restored. New global Today shows five attention items and one working agent. Historical snapshots and absolute timestamps stay unchanged; links open matching scoped work. | Reviewer approved with 52 independent tests and final 22 domain tests; implementer reported 49 tests plus typecheck/lint/worker build; root DB aggregation/project behavior and three attention browser cases passed without errors. |

## Decisions and verification log

### September 19 — swarm initialized

- Root coordinates architecture and integration; separate implementer, reviewer,
  and scribe responsibilities cover each phase sequentially.
- Phase 1 starts with currently available capability canvases. The first-project
  starter depends on phase 3's dedicated ALM project workflow; an interim planner
  must not imply that a project has been created or a GitHub repository synced.
- Phase 3 should integrate the existing draft/create authority, not resurrect
  legacy local project provisioning. Its review must cover draft identity,
  revision conflicts, repeated submit, Home/close persistence, and transition to
  the newly saved project conversation.
- Root and reviewer agreed that phase 1's first-project starter opens ALM work
  planning until phase 3 replaces it with the shared ALM project capability.
  General profiles save a planning brief through `canvas.save`; Sam's valid
  finding-backed draft may invoke `project.create`. Keep the requirement for at
  least one finding, without inventing assessment evidence or provisioning.
- Phase 2 assessment destinations capture `runId`, optional `findingId`, and
  current scope. Historical run identity stays stable, with pause/resume only on
  the current run. The existing workspace snapshot already includes owned runs
  and findings, so this does not require a new endpoint. Phase 3 must preserve
  `liveAssessmentView`'s existing protection: reviewing a draft after rescan uses
  the draft's captured run, not the latest assessment's findings. Domain tests
  already cover that behavior; it is not a confirmed current bug.
- At initialization, no new phase had passed review or validation. Earlier restored animations,
  Today behavior, panel-aware layout, resource routing, and real-agent navigation
  remain the baseline to preserve.

### September 19 — phase 1 passed; phase 2 started

- Direct starter launches now use scoped capabilities and seed the composer
  without submitting. The first-project card opens ALM work planning until
  phase 3 adds the dedicated project workflow.
- The reviewer independently approved the change and ran 24 passing
  navigation/starter tests covering scoped destinations, permission fallback and
  denial, and isolated org/worktree identities.
- Root ran seven passing cases in `scripts/browser/starter-canvases.mjs`:
  developer project planning, agent, React app, pipeline, existing project,
  builder fallback, and normal-motion/focus behavior. Assertions cover retained
  org, custom-draft append versus starter replacement, one continuous
  conversation, disabled historical Today, no submitted message, and no page
  errors. Implementer reported passing TypeScript and changed-source lint.
- Phase 2 is implementing the Govern assessment/scope/finding canvas. Overall
  restoration remains In Progress; no commit or deployment has occurred.

### September 19 — phase 2 passed; phase 3 started

- Govern now shows scope and findings from owned server snapshots. Explicit
  run/finding destinations retain captured identity across reload and rescan;
  the no-run overview intentionally follows the latest assessment. Viewing a
  historical canvas does not automatically retarget model evidence.
- Sam's Govern access is enabled consistently. Current-run pause/resume and
  failed/queued/cancelled execution feedback use existing durable commands. The
  reviewer raised and verified the failed-state retry path before signing off.
  The project agent catalog resolves the improvement's captured run.
- Root's `scripts/browser/assessment-canvas.mjs` passed six checks: scoped
  launch with expired org disabled; finding reload; old evidence after rescan;
  pause/resume; failed-state retry to queued; and missing-run unavailability.
  Checks found no editable writes, model submissions, or page errors.
- Independent review passed with 29 navigation tests. Implementer reported 48
  model tests and 52 application/domain/onboarding/resource tests passing, plus
  typecheck, lint, and worker build.
- Phase 3 is implementing the dedicated ALM project capability and consistent
  entry points, using the agreed planning-brief versus finding-backed creation
  boundary. Overall task remains In Progress; no extra feature scope was added.

### Architecture notes recorded ahead of implementation

- For phase 4, the reviewer recommends a new `workspace-planner-v3` policy while
  retaining v1/v2 request serialization for queued work. Explicit requests to
  open/show/switch may navigate; plan/build/improve discussions remain in chat,
  progressively clarifying goal, audience, success, and constraints through
  existing completed history. A narrow explicit-request helper can serve the
  demo path; do not layer the old client planning state machine over real runs.
  Root adopted this direction for phase 4 after the phase 3 gate, with a
  current-request navigation gate and worker validation against the saved catalog.
- For phase 6, the review map includes sidebar/overview app launchers, the
  `storefront-app` returning-work fixture, agent catalog, destination validation,
  tab/draft persistence, server `canvasCommand`, repository projection/import,
  and resume URLs. Prefer shared canonical app/work surface mapping that retains
  IDs, fields, revisions, and targets. Old Build destinations must reach ALM;
  release progress must select `work.kind === "Release plan"`, not array order.
  The command parser must accept old Build payloads without rewriting them:
  `executeCommand` hashes parsed input before receipt lookup, so rewriting there
  would break uncertain-acknowledgement retries. Canonicalize validation/writes
  and read/projection boundaries instead, and verify legacy receipt replay.
  This read-only map preceded implementation; phase 6 subsequently verified
  these compatibility boundaries before acceptance.

### September 20 — phase 3 passed; phase 4 started

- The dedicated ALM project capability replaces phase 1's temporary work planner
  and unifies starter, ALM, palette, and sidebar entry points. General profiles
  save a truthful scoped planning brief; Sam's valid finding-backed draft uses
  existing acknowledged draft/create commands. No repository or org provisioning
  is implied.
- Root's four browser groups passed: generic brief save/Home/reload; Sam's
  acknowledged begin/Home/Continue and old-run review followed by one project
  creation in its own conversation; late begin/create acknowledgement navigation
  protection; and frozen fields during creation. No page errors were recorded.
- Independent review caught and verified the create/edit race protection:
  creating-only fieldset freeze, same-tick guards, and shared queue-backed
  begin/create predicates cover Home/back/remount while commands are pending.
  Reviewer independently passed 24 project-creation/domain tests. Implementer
  reported 79 focused tests plus typecheck, lint, and worker build passing.
- Phase 4 now adapts Home planning to the real agent's existing durable history
  using `workspace-planner-v3`, preserving exact queued v1/v2 policy behavior.
  Explicit current-request navigation gates the captured tool catalog; the model
  still chooses the scoped destination and the worker validates the saved
  catalog. Demo policy replaces topic routing with explicit surface requests.
  Validation will use mocked provider responses, with no paid call planned.

### September 20 — phase 4 passed; phase 5 started

- Home planning now uses `workspace-planner-v3` and completed durable history.
  Tools are only captured for explicit navigation in the current request; the
  model selects a scoped destination, and worker validation rejects actions
  absent from that saved catalog. Demo topic routing also gives way to explicit
  surface requests. Queued v1/v2 behavior remains intact.
- Reviewer independently passed 54 intent/model context/provider/worker tests
  and confirmed four pre-change v1/v2 requests are byte-identical. Review refined
  the bounded detector's content-request and deferred-navigation exclusions.
  Ambiguous follow-ups intentionally stay in chat; this is not an unrestricted
  natural-language intent classifier.
- Root passed all 22 mocked-model database tests, including two-turn planning
  with completed history and no tools, an explicit resource action, rejection of
  unsolicited scoped actions, and queued v2 compatibility. Six browser
  navigation/replay cases passed without page errors. No paid model calls were
  made. The runtime worker reload was underway at this gate.
- Phase 5 is implementing overview project links through shell presentation
  state: reveal/focus the parent, select the ephemeral Projects filter, and retain
  worktree identity. The top-bar badge remains a palette launcher.

### September 20 — phase 5 passed; phase 6 started

- Overview project links now reveal and focus the project parent through shell
  presentation state. They select the ephemeral Projects filter while keeping
  the active worktree, URL, and target unchanged. The top-bar badge still opens
  the palette.
- Source review approved the implementation; typecheck and lint passed. Root's
  normal/reduced-motion browser groups passed panel opening, parent focus,
  selected-worktree `aria-current`, keyboard re-open after the Apps filter,
  unchanged URL/target, and top-bar palette behavior with no page errors.
- The phase 4 worker reload is confirmed successful. It will be reloaded again
  after final runtime changes so the preview runs the completed restoration.
- Phase 6 now moves deployed-app operations to ALM with legacy link, preference,
  database, receipt, and captured-model-catalog compatibility. Release progress
  must select the Release plan item independently of work ordering.

### September 20 — phase 6 passed; phase 7 started

- Deployed-app operations now open in ALM from app/work entry points. Legacy
  Build app/work URLs actually replace to `/alm`; compatibility retains tab
  identities, closed drafts, targets, and active selection. Conflicting saved
  states offer explicit recovery. Owned older work visits normalize after the
  original receipt boundary.
- Original command and agent receipt hashes, uncertain pending payloads, and
  queued model catalog bytes remain unchanged. Canonical routing happens at
  read/apply boundaries. Review caught a saved-work relocation gap after adding
  `surface_id` updates; canonical work surface validation now precedes all row
  operations, with a database rejection check.
- Release progress chooses the actual `Release plan` work item instead of the
  first item, so introducing an app earlier in the list cannot replace the
  release target.
- Implementer reported 84 focused tests, typecheck, scoped lint, and worker
  build passing. Reviewer independently passed 64 migration/navigation/domain/
  application tests and approved. Root exercised 56 database cases: the initial
  run passed 55; the sole new failure was an overbroad wrong-surface assertion
  narrowed to saved work and then passed on rerun. Root's three
  `alm-app-migration` browser groups passed without page errors.
- Phase 7 now restores three actionable demo scenarios and waiting sessions
  across projects/worktrees, retaining absolute timestamps and immutable
  historical Today captures. Overall task remains In Progress until that gate.

### September 20 — phase 7 passed; complete restoration ready for review

- Hotfix review, Acme performance, and Acme release approval are actionable
  again, with consistent waiting sessions and owned destinations. New Today
  captures show five attention items across two projects and three worktrees,
  plus one working agent. Historical snapshots keep their original bytes and
  absolute timestamps. Attention labels use the shared surface definitions.
- Reviewer approved with 52 independent conversation/domain/navigation tests;
  the final 22-test domain rerun includes scenario/session/destination agreement
  and historical Today byte equality. Implementer reported 49 focused tests,
  typecheck, lint, and worker build passing.
- Root verified database Home aggregation with exactly five attention items and
  one working agent, plus retained project behavior. Three attention browser
  cases passed labels, scope, immutable disabled history, and no page errors.
  An initial no-POST test assumption was corrected: opening a work canvas may
  register its existing empty draft; it does not rewrite historical Today.
- Final `global-home` acceptance passed all 12 groups across normal and reduced
  motion without page errors, after updating the older Build app-tab expectation
  to the restored ALM destination. `git diff --check` is clean. Test counts above
  overlap across phases and should not be added into a distinct-test total.
- The worker was gracefully reloaded at `2026-09-20T09:58:41Z` after final runtime
  changes. Disposable PostgreSQL was stopped; the preview remains on port 3000.
  All model validation in this restoration used mocked providers; no paid
  Anthropic call or general live-model quality claim is part of this evidence.
- All seven phase gates are complete. The task and its one Hive board card are
  now Review for Jordan. Prior local work is preserved; no commit or deployment
  has occurred. The older legacy canvas tree remains separate, unrequested scope.

### September 20 — branch publication validation

- The accumulated work is being published on `org-exploration`; push confirmation
  is pending, and main and the hosted deployment remain unchanged. Earlier phase
  gate entries above record their state at the time of each handoff.
- The coordinator passed 259 unique non-database tests across 23 files and
  TypeScript. Lint reported zero errors and one pre-existing stylesheet warning
  at `src/app/layout.tsx:36`. Two stale client-reliability expectations were
  corrected from Build to ALM to match the restored deployed-app routing.
- The full expanded release gate was not rerun. This publication validation is
  additional focused evidence, not a replacement for that complete gate.
