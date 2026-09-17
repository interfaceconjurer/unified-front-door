# Architecture implementation plan

**Started:** September 15, 2026  
**Baseline:** `4e52aa1`  
**Scope:** A dependable prototype running locally and on Heroku, Neon-backed application persistence, and explicit boundaries for a real agent. Preserve the existing product experience while addressing every finding in the [architecture review](architecture-review.md).

## Working agreement

The user requested one holistic plan, phased implementation, and three agents for each phase:

- **Implementer:** owns application code and tests; responds to each review finding with a change or evidence.
- **Reviewer / approver:** independently inspects the implementation, tests the acceptance criteria, and issues either `CHANGES REQUESTED` or `APPROVED — 100% of this phase's acceptance criteria satisfied`.
- **Scribe:** owns the phase journal, finding dispositions, validation evidence, and plan status; follows the implementer/reviewer conversation and records changes as they happen.

The primary agent coordinates scope, performs independent checks as needed, and presents the result. Implementer and reviewer send substantive exchanges to each other, the scribe, and the primary agent. If either becomes idle while work remains, the primary agent resumes that agent with the next bounded task. No agent approves its own implementation.

“100%” means all agreed acceptance criteria have evidence and no unresolved findings remain within the phase. It is not a guarantee of freedom from every possible defect. A blocked required check prevents approval; a review finding cannot be silently moved to a later phase. A change to phase scope must be recorded and must not weaken an acceptance criterion to obtain approval.

**Stop after every approved phase and check in with the user before beginning the next.** The initial request authorized planning and Phase 1. After Phase 1 approval, the user authorized Phase 2 with “Let's do it same drill baby.” After Phase 2 approval, the user authorized Phase 3 with “lets go.” After Phase 3 approval, the user authorized Phase 4 with “lets do it.” After Phase 4 approval, the user authorized Phase 5 with “lets do it.” After Phase 5 approval, the user authorized Phase 6 with “move to phase 6.” After Phase 6 approval, the user authorized Phase 7 with “phase7 time.” After Phase 7 approval and an explanation of the real-agent integration step, the user authorized Phase 8 with “lets go” and selected Anthropic. No automatic deployment, publication, paid service provisioning, or destructive data migration is included in a phase checkpoint unless specifically agreed there.

## Target decisions

1. **One modular application.** Keep Next.js, the persistent shell/composer, plain domain models, and the serializable canvas registry. Use named application queries/commands with replaceable demo and server adapters.
2. **Neon Postgres for application records.** Use an isolated Neon development branch for the local app and a separate hosted-demo branch for Heroku. Keep one schema/migration path. A fully offline Postgres environment is optional; a local app can connect to hosted Neon. Neon Local is a cloud-database proxy, not an offline database ([Neon Local](https://github.com/neondatabase/neon_local/blob/main/README.md)).
3. **Explicit storage ownership.** Projects, work items, finding snapshots, saved drafts, and eventually conversations/runs become server-owned. Tabs, panel preferences, filters, and temporary presentation state remain browser-owned. Unsaved edits are recoverable and have honest save status.
4. **Context is captured.** Navigation, draft scope, conversation identity, and operation target are separate typed concepts. A later org/project selection cannot retarget submitted work.
5. **Demo access stays honest.** Shared Basic Auth may continue for fixture-only/model-over-fixture scenarios. Database-backed demo work must have a server-owned namespace/session policy so one visitor's reset does not erase another's work. Demo persona IDs are not real identity or resource grants. Real private-resource integration requires real server-side identity and granted access.
6. **History survives source changes.** Store immutable findings/evidence with run identity and provenance. Availability and permission resolution cannot silently delete historical records during parsing.
7. **Reviewable changes.** Preserve existing browser data through versioned migrations and explicit import/reset policies. Test supported Node 22, read the installed Next 16.3.5 guides before framework code changes, and keep each phase independently runnable.

### Defaults to refine at the relevant phase checkpoint

- New capability drafts created with a selected project should be bound to that explicit context; pre-project drafts remain explicitly unbound until assigned. Existing globally keyed drafts must migrate without being silently assigned to the wrong project.
- Preserve deliberate day-zero demo reset as a scenario action; do not carry it into real sign-in semantics. Database reset must be limited to the requesting demo namespace.
- Retain useful dormant feature designs by deliberately porting them to the active registry when justified. Remove obsolete implementations with Git history as the archive; never delete an entire folder based only on its name.
- Start real-agent integration with fixture-backed conversation or scoped read-only work. The provider, private-resource authentication, execution environment, and cost budget are checkpoint decisions, not invented requirements for Phase 1.

## Phase overview

| Phase | Deliverable | Findings | Status |
| --- | --- | --- | --- |
| 1 | Reliable browser persistence and truthful save state | F1; groundwork for F8/F10 | Approved — user authorized Phase 2 |
| 2 | Independent project/assessment history and typed identities | F2, F4; domain portion of F3/F5 | Approved — user authorized Phase 3 |
| 3 | Explicit workspace/navigation ownership and one active extension path | F3, F6; part of F10 | Approved — user authorized Phase 4 |
| 4 | Neon persistence for projects, findings, and saved drafts | F1/F2 durable ownership; F9 demo server boundary; F10 | Approved — user authorized Phase 5 |
| 5 | Replaceable agent/assessment adapters and explicit run lifecycle | F5, F9 integration contracts, F10 | Approved — user authorized Phase 6 |
| 6 | Accessible interaction, feature recovery, and bounded client work | F7, F10 | Approved — user authorized Phase 7 |
| 7 | Local/Heroku verification and release readiness | F8; end-to-end verification of F1–F10 | Approved — user authorized Phase 8 |
| 8 | First real agent/provider integration under its actual access model | Remaining conditional F9/F10 integration gates | Approved — user authorized Phase 9 |
| 9 | Attribute operational diagnostics and prepare the hosted release | Retained F8/F10 operational follow-up | Approved — awaiting the user checkpoint |

## Phase 1 — Reliable browser persistence

**Approved September 15, 2026:** the reviewer confirmed 100% of P1-A1–P1-A8
satisfied, with no unresolved in-phase findings. Node 22 checks passed: 38 tests,
lint (one existing warning), production build, and focused Chromium persistence/
recovery journeys. The [journal](phases/phase-1-persistence.md) records every review
round, exact evidence, limitations, and the approval. The user's checkpoint
response authorized Phase 2; the Phase 1 journal remains the historical approval
record.

### Implementation

- Introduce a small shared browser-storage mechanism under domain-specific stores. Migrate workspace selection, canvas/drafts, assessment, and demo profile storage onto a consistent failure/subscription policy.
- Distinguish absent, invalid/unsupported, available, and unavailable data. Preserve the latest in-memory state when reads or writes fail. Keep stable server/hydration snapshots and stable data snapshots.
- Expose acknowledged persistence status to affected draft/save UI. Provide a defined explicit retry/recovery path; do not silently overwrite newer external state on recovery.
- Notify subscribers of cross-tab storage changes and same-runtime changes when multiple instances exist. Specify conflict behavior; browser storage remains a demo mechanism, not a collaborative transaction system.
- Preserve existing storage keys and read existing raw payloads. Introduce an explicit versioned envelope or equivalent documented codec/version boundary with compatibility tests. Unsupported data must not be silently overwritten by an automatic read/migration.
- Ensure subscription cleanup; avoid render-time notification loops, gratuitous global state, and unrelated UI redesign.
- Add focused tests and a package command for the persistence contracts. Adapt existing test harnesses if new module boundaries require it.

### Acceptance criteria (P1-A1 through P1-A8)

1. **P1-A1 — Data integrity:** after a successful saved selection/tab/draft, read failure and write failure preserve that state and subsequent edits in memory. Initially blocked storage behaves consistently across all migrated stores.
2. **P1-A2 — Honest save state:** affected capability/work/assessment draft UI never reports a failed write as saved. Success, unavailable/unsaved, and recovery are observable without exposing internal implementation details to users.
3. **P1-A3 — Recovery/conflict policy:** retry handles restored storage, and any divergence from externally updated data follows a documented, tested policy without silently losing local edits.
4. **P1-A4 — Synchronization:** same-key external changes, removal/clear, and relevant other-instance writes notify subscribers; unrelated keys do not alter a store. Subscription teardown releases event listeners.
5. **P1-A5 — Compatibility:** existing demo profile selection, per-profile data, open/closed drafts, and reset behavior remain intact. Existing raw payloads load; malformed/unsupported input follows a documented policy.
6. **P1-A6 — React correctness:** server snapshots are stable and browser-independent; unchanged data snapshots preserve identity; hydration/subscription integration does not introduce loops or cross-profile leakage.
7. **P1-A7 — Validation:** focused persistence tests, existing conversation/onboarding suites, lint, and production build pass on Node 22. Verify save-status rendering with a meaningful UI-level check; report the exact checks rather than claiming broad browser coverage.
8. **P1-A8 — Documentation:** the scribe records design decisions, every review round, resolved findings, tests, residual limitations outside the phase, and explicit final reviewer approval. README describes the persistence/recovery policy and verification command.

### Boundaries

No Neon provisioning, project-history/model redesign, canvas-ID change, navigation redesign, legacy removal, or deployment mutation in this phase. Those items have explicit owners below. The persistence abstraction must remain small enough to keep when business records move to Neon. A multi-tab simulated assessment timer still needs one run owner in Phase 5; this phase ensures store invalidation works and does not claim distributed execution semantics.

**Journal:** [Phase 1 journal](phases/phase-1-persistence.md).

## Phase 2 — Domain history and identities

**Approved September 15, 2026:** the reviewer confirmed 100% of P2-A1–P2-A8
satisfied, with no unresolved in-phase findings. Independent Node 22 checks pass:
58 tests and lint (one existing warning), plus the final production build and
focused Chromium history/migration/recovery journeys. The final four-state scope
recovery matrix passes; retained Phase 1 browser regressions cover unaffected
storage/profile paths. The [journal](phases/phase-2-domain-identities.md) records
all review rounds, exact candidate-specific evidence, limits, and approval.
The user's checkpoint response authorized Phase 3. The Phase 2 journal remains the
historical approval record. Phase 4 was still gated at that checkpoint and has
since received its own authorization, recorded below.

### Implementation

- Extract project/work-item ownership from the onboarding store. Define planning projects without fabricated Git resources.
- Separate assessment runs, immutable finding snapshots, project drafts, and saved plans. Capture timestamps/provenance and source versions. Make repeated findings from distinct runs representable; command idempotency is separate from finding lifetime uniqueness.
- Parse historical records without revalidating them against today's connected-org/fixture catalog; resolve availability separately. Preserve inaccessible/unavailable references according to explicit policy.
- Move Today/conversation read-model types out of component folders and make historical briefings bounded snapshots rather than complete persistence-store copies.
- Define discriminated canvas inputs with required per-kind identities, canonical collision-free IDs, and one exhaustive surface declaration. Migrate active IDs, open tabs, and closed drafts together; preserve legacy content when identity cannot be reconstructed automatically.
- Replace stale full-draft replacement with field commands or versioned edits where applicable.

**Approval evidence:** old payload migration; fixture rename/removal/connection expiry preserves plans; repeated scans preserve old evidence; invalid per-kind inputs fail; ID collisions cannot recur; display renames retain identity; all existing flows and checks pass. The resulting domain records are ready for relational storage.

### Acceptance criteria (P2-A1 through P2-A8)

1. **P2-A1 — Domain ownership:** project and work-item models/commands belong to a project domain independent of onboarding. Planning projects carry no fabricated Git repository or `main` worktree, including in their active navigation/rendering projections.
2. **P2-A2 — Historical integrity:** saved plans and their finding/evidence snapshots, identity, timestamps, and provenance survive current catalog rename/removal and target connection expiry. Parsing is structural; current availability resolves separately. Legacy records retain recoverable content, and missing historical evidence is represented honestly rather than invented.
3. **P2-A3 — Run and command identity:** distinct runs can record recurring findings without rewriting old evidence. Project creation has explicit command idempotency; drafts capture their origin. Field-level updates target the intended draft and preserve unrelated concurrent edits rather than replacing stale whole drafts.
4. **P2-A4 — Bounded read models:** Today/conversation read-model types live outside component folders. Historical briefings contain copied, bounded domain snapshots and remain independent of subsequent live record changes; they do not copy the complete persistence store.
5. **P2-A5 — Canvas contracts:** a shared exhaustive surface declaration and discriminated per-kind inputs enforce required identities at type and runtime boundaries. Canonical IDs cannot collide through delimiter ambiguity and do not change with display labels.
6. **P2-A6 — Migration and compatibility:** legacy migration preserves active identity, open tabs, and closed drafts together. Ambiguous or unreconstructable identities retain their content under an explicit recovery policy. Existing flows and Phase 1 storage integrity, recovery, profile isolation, and version policies continue to hold.
7. **P2-A7 — Validation:** focused domain/identity/migration tests and all existing suites, lint, and production build pass on Node 22. Focused production-browser checks verify affected flows and report exact coverage and limitations.
8. **P2-A8 — Documentation and approval:** README describes implemented ownership/migration behavior and verification commands. The scribe records decisions, review rounds, every change request and resolution, validation evidence, remaining out-of-phase work, and the reviewer's explicit final approval.

### Boundaries

The records may share one serialized browser-persistence envelope behind a compatibility
facade while their domain ownership and commands are separated. Neon provisioning,
schema migrations, and server persistence remain Phase 4. Workspace/navigation
controller changes and capability-draft scope assignment remain Phase 3; run
executor ownership remains Phase 5. Historical live-subscription/performance
measurement work remains Phase 6. None of these boundaries permits loss of legacy
data or removal of an acceptance criterion to obtain approval. One storage write
does not provide transactional coordination between browser tabs.

**Journal:** [Phase 2 journal](phases/phase-2-domain-identities.md).

## Phase 3 — Workspace and navigation ownership

**Approved September 15, 2026:** the independent reviewer confirmed 100% of
P3-A1–P3-A8 satisfied, with no unresolved in-phase findings. Validation includes
75 tests, TypeScript, Node 22 lint (one existing warning), the final production
build, seven final Chromium browser families, and four explicitly retained
unaffected families. Navigation, captured draft/project targets, unavailable
states, direct links/history, and composer continuity have accepted evidence.
The finite cleanup removes 33 dormant files while preserving the shared layout,
database seam, and all 19 capabilities/four toolkit sections. The
[journal](phases/phase-3-navigation.md) records every review round, exact
candidate-specific evidence, limits, and approval. The user's checkpoint response
authorized Phase 4; the Phase 3 journal remains the historical approval record.
Phase 5 remained gated at that checkpoint and has since received its own
authorization, recorded below.

### Implementation

- Represent loading, planning, ready, empty, and unavailable workspace context. Remove silent fallback to an arbitrary connected org as execution context.
- Declare global versus project/worktree/org-bound drafts and migrate existing unbound drafts conservatively.
- Implement one navigation intent/controller used by palette, recent work, project links, tab selection, restoration, and browser history. Define which selections are derived from a bound destination.
- Make shareable work destinations URL-addressable; keep view preferences independent. Test rapid changes and cancellation with the persistent composer intact.
- Inventory the dormant import graph. Port retained features deliberately to the active canvas protocol; remove obsolete provider/chat/builders and stale documentation. Preserve active shared layout and useful pure modules.

**Approval evidence:** destination consistency across every entry point; no-project/no-worktree/no-org cases; expired selected org; scope changes with edited drafts; Back/Forward and direct entry; one documented active extension path; no loss of current product capabilities. An unverified race from the original review is closed through tests or a documented disposition.

### Acceptance criteria (P3-A1 through P3-A8)

1. **P3-A1 — Explicit context:** loading, empty, planning, ready, and unavailable workspace states are represented. Missing selections differ from invalid explicit IDs; neither can silently select an unrelated project, worktree, or org as an execution target.
2. **P3-A2 — Draft scope:** draft identity captures declared bound or unbound context. Scope assignment is explicit; selection changes cannot retarget an existing draft. Legacy open and closed drafts migrate conservatively without losing content or guessing a project assignment.
3. **P3-A3 — Navigation ownership:** one typed navigation controller owns resolution across active palette, recent-work, project-link, tab-selection, and restoration entry points. Bound destinations determine their context through that controller; competing host effects do not rewrite the selected destination.
4. **P3-A4 — URL and restoration:** shareable destinations support direct entry, Back/Forward, and a documented URL/storage restoration precedence. Invalid or unavailable destinations have explicit recovery; profile changes cannot restore a prior profile's destination. View preferences remain independent of shareable identity.
5. **P3-A5 — Interaction continuity:** rapid changes and cancellation preserve the persistent composer's draft, selection, and intended thread identity. The original review's unverified cross-route ordering concern is closed through focused evidence or an explicit supported disposition.
6. **P3-A6 — One extension path:** a finite import-graph inventory records a disposition for dormant implementations. Retained capabilities are ported deliberately where needed; obsolete source and documentation are removed while active capability parity, shared layout, and useful pure modules remain. Contributors have one documented active extension path.
7. **P3-A7 — Validation:** independent focused and existing tests, lint, and production build pass on Node 22. Meaningful production-browser checks cover the affected context, navigation, draft, history, profile, and continuity paths with exact candidate-specific evidence and limitations.
8. **P3-A8 — Documentation and approval:** README describes implemented ownership, scope, migration, extension, and verification behavior. The scribe records substantive dialogue, every change request and disposition, evidence, limits, and the independent reviewer's explicit final approval.

### Boundaries

This phase preserves the approved Phase 1 persistence and Phase 2 domain/history
contracts. Capability context and navigation ownership are application boundaries,
not real server authorization. Neon/schema/server persistence remain Phase 4;
assessment and agent execution ownership remain Phase 5. General accessibility,
feature failure containment, and measured capacity work remain Phase 6. No required
Phase 3 check or finding may be silently deferred to obtain approval.

**Journal:** [Phase 3 journal](phases/phase-3-navigation.md).

## Phase 4 — Neon application persistence

**Started September 15, 2026:** the user authorized Phase 4 with “lets do it.”
**Resumed after setup:** the user replied “ready.” The configured `dev` branch
has verified pooled/direct TLS and actual Neon Postgres 18.6 migration/application
evidence. Candidate 5 build `7DGiXxg-81-9PtS_a9xUl` passes production flows and an
actual app restart. All 92 independent tests, permanent Neon SQL 9/9, service/quota/
migration probes, complementary browsers and actual CLI all pass. 137 source entries
were reconciled; only database-test PID observation changed after build, with
identical application runtime. The app/test server is stopped.

The independent reviewer approved all eight criteria after the final documentation
read, with no unresolved in-phase work:

> APPROVED — 100% of Phase 4 acceptance criteria P4-A1 through P4-A8 satisfied.

The bounded stored-import export is an accepted optional addition, not literal A6.
A separate hosted branch remains for future hosted wiring; no deployment has
occurred. The user authorized Phase 5 with “lets do it” after this approval. The
Phase 4 journal remains the unchanged historical approval record.

### Implementation

- Confirm an accessible Neon project and separate development/demo branches. Use approved connection configuration; never put database credentials in source, logs, or browser code. No paid provisioning or writes to a shared database without an identified target and authorization.
- Keep persistence portable Postgres. The agreed implementation uses one `pg` pool and ordered SQL migrations, replacing the unused Neon HTTP helper; no parallel ORM/driver path is introduced.
- Add ordered migrations, schema history, repeatable seed data, reset commands limited to disposable/demo namespaces, and integration-test setup. Model application-owned records first: demo/workspace namespace, projects, work items, runs/findings, and saved drafts. Use relational constraints and revisions/idempotency where they enforce a real invariant.
- Implement a server application/data layer with runtime validation, scoped demo sessions/namespaces, and safe view-model outputs. Same-origin/state-changing request protection and authorization belong at this boundary. Client persona/record IDs cannot claim ownership.
- Move project creation, status changes, historical findings, and saved drafts onto this layer. Keep unsaved edits and UI preferences local with truthful saving/error/retry behavior.
- Provide an explicit, idempotent import of legacy browser records. Preserve the source until acknowledged, retain IDs where possible, record migration provenance, and avoid automatic import into the wrong demo namespace.
- Add a secret-free `.env.example`, configuration validation, database commands, and local/Heroku setup documentation. Keep environment data isolated and document the intentional demo-reset behavior.

**Approval evidence:** migrations and repeatable seeding against a real isolated Neon development/test branch; project/draft reload persistence; duplicate command handling; transaction rollback; two demo namespaces cannot overwrite/reset each other; invalid/cross-scope IDs denied; database timeout/recovery; legacy import repeated safely; verified credentials absent from client outputs. The reviewer cannot approve Neon connectivity based only on mocked tests. If access is missing, complete local code and keep this phase unapproved pending the required external evidence.

### Agreed ownership design

Server lookup authenticates a high-entropy opaque HttpOnly session token whose
hash is stored in Postgres. Namespace, persona, and generation bind commands and
client pending edits; a browser profile ID is never authority. Transactional
commands use receipts, payload identity, and revisions, and only server
acknowledgement means durable save. Project creation must return before navigation.
Choosing Sam no longer deletes durable records; reset is explicit and scoped.
Legacy import is explicit with preview, source retention, and provenance.
Deterministic assessment execution remains a demo adapter until Phase 5.

### Acceptance criteria (P4-A1 through P4-A8)

1. **P4-A1 — Configuration/portability:** identify an authorized isolated Neon development/test target, one portable Postgres query/driver/migration path, validated server-only secret configuration, and no credential exposure.
2. **P4-A2 — Data model:** ordered recorded migrations and owner-scoped relational constraints for namespaces, runs/findings, projects/work items, and saved drafts; repeatable seed and explicitly limited demo reset.
3. **P4-A3 — Session ownership:** server-issued authenticated opaque demo namespace/session with documented persona transitions, tamper/expiry/reset/sign-out integrity; body/profile/record IDs never grant ownership.
4. **P4-A4 — Command boundary:** runtime-validated same-origin authorized application commands, atomic domain invariants, optimistic revisions, stable idempotent replay/conflicting-reuse rejection, bounded safe outputs/errors.
5. **P4-A5 — Client durability:** server acknowledgement defines durable save; preserve unsaved edits/UI preferences/Phase 3 per-tab captured context; stale/out-of-order/failed/uncertain writes support truthful retry/conflict recovery without retargeting or data loss.
6. **P4-A6 — Legacy import:** explicit selected-namespace-bound idempotent import with validation/preview, provenance, retained original source until acknowledged, conservative IDs/collisions, and no automatic wrong-namespace import.
7. **P4-A7 — Evidence:** independent regression/security tests and actual isolated Neon migrations/seed/rollback/concurrency/isolation/timeout/import/reload integration plus affected production browsers; local Postgres/mocks cannot satisfy the Neon requirement.
8. **P4-A8 — Documentation/approval:** accurate local/Heroku/configuration/schema/reset/import/ownership/limitations documentation, complete dialogue/findings/evidence, no unresolved in-phase criteria, and exact independent approval.

Phase 2 historical evidence and Phase 3 identity/navigation contracts remain
required. Missing Neon configuration does not waive any criterion; local
implementation continues while real integration evidence remains an approval gate.

**Journal:** [Phase 4 journal](phases/phase-4-neon.md).

## Phase 5 — Agent/assessment application interfaces

**Started September 15, 2026:** the user authorized Phase 5 with “lets do it” after
the independent Phase 4 approval. The coordinator ratified P5-A1–P5-A8 and the
independently accepted design. Candidate 6 build `15T7t4qKdNxu-Q1IMvqKh` passes,
with historical journals/migrations unchanged. Independent 104 unit tests,
TypeScript/lint, original/fixed SQL and queue probes, two-tab assessment, full
planning/history, and final actual-Neon SQL22/22 pass with cleanup. The official
worker completes acknowledged work with browser closed/web stopped, and a fresh
browser observes the same completed turn after web restart. All sixteen findings
are closed; the reviewer accepts runtime criteria A1–A7. Final runtime138/worker30
hashes reconcile, and all test processes are stopped. Earlier failures and exact
candidate boundaries are preserved in the journal.

**Approved September 16, 2026:** after the final A8 documentation read, the
independent reviewer confirmed all P5-A1–P5-A8 satisfied, with no unresolved finding
or waived criterion:

> APPROVED — 100% of Phase5 acceptance criteria satisfied.

Existing private Neon development configuration and the portable `pg`/ordered-SQL
path carry forward. Real provider/private-resource integration remains Phase 8.
The user authorized Phase 6 with “move to phase 6.” The Phase 5 journal remains
the unchanged historical approval record. No commit or deployment occurred.

- Extract canned replies, fixture interpretation, recommendation logic, and simulated clocks from React rendering into demo adapters.
- Define submit/observe/cancel contracts with captured context, request/turn/run identity, typed errors, and correlated events. Separate message history and business revisions from scroll/animation state.
- Persist conversations and run/result records through the server repository when their declared lifetime requires it. Render pending, streaming, completed, failed, and cancelled states explicitly.
- Make one authority own an assessment/run lifecycle across tabs. Start with the simplest executor suitable for the agreed operation lifetime; if work must survive HTTP/process lifetimes, implement one durable database-backed job mechanism and a worker process shared by local/Heroku development.
- Require duplicate-request handling, late-result rejection, cancellation semantics, retry policy, and reconciliation of uncertain external side effects. Supply deterministic delayed/failing demo implementations as contract tests.
- Define the server tool registry and authorization seam. Keep unconfigured real provider/tool access disabled; model text is not execution permission.

**Approval evidence:** changing adapters leaves the UI contract intact; two tabs do not create two logical runs; changing selection cannot retarget work; late completion cannot mutate another session; reload/resume satisfies the promised lifetime; retries/cancellation/errors are observable; test fixtures exercise the same application contracts as eventual real providers.

### Agreed lifetime and execution design

Acknowledged conversations, events, runs, and results survive reload, browser
closure, and web/worker-process restart in the current demo namespace. Unsent
composer text has its separate browser lifetime. One durable Postgres step worker
owns progress, using database-clock leases, fencing, finite crash recovery, and
checkpoints. HTTP observation does not execute work. The same worker entry point
serves local and later Heroku configuration; no deployment is part of this phase.
Demo adapters remain replaceable and real provider/private-resource access stays
disabled.

`assessmentRevision` is the state-changing interactive application-command concurrency token.
Autonomous worker progress/completion/failure preserve it; run event sequence and
fencing track execution. Existing user-command receipts/revision and captured
draft checks remain enforced. Changed saved snapshots are adopted even when this
command token is unchanged.
No-op joins preserve it while retaining receipts and missing legacy-job attachment.
After confirmed acknowledgement/fresh load, only dependent unsent queue entries
may adjust their predicted token; uncertain requests remain unchanged.

Assessment tool execution is read-only, enforced even for injected registries.
The writing-tool/effect-reconciliation contract is exercised through fake chat
tools; it does not enable product writes. This accepted boundary makes the actual
supported outcomes explicit while preserving the required authorization and
uncertain-effect tests.

### Acceptance criteria (P5-A1 through P5-A8)

1. **P5-A1 — Replaceable adapters:** demo replies, recommendations, fixture interpretation, and simulated clocks live outside React behind typed replaceable adapters. A deterministic delayed/failing alternative exercises the same application/UI contract.
2. **P5-A2 — Captured contract and identity:** server-owned namespace/persona/epoch and request/conversation/turn/run/attempt/event identities bind operations to immutable validated submitted context and snapshots. Submit/observe/cancel/retry expose correlated events and safe typed errors; foreign scope and replay with a changed payload are rejected.
3. **P5-A3 — Durable history:** acknowledged conversations, turns, runs, events, and results persist in Neon across the declared reload, browser-close, and process-restart lifetime. Cursor ordering/deduplication and separation of message/business history from presentation state preserve historical findings and captured content.
4. **P5-A4 — One execution authority:** distinct tabs/requests converge on one logical active assessment, and only the worker advances runs. Postgres leases/fences provide bounded crash recovery and reject stale-worker publication. Session expiry/revocation and generation/epoch guards apply at claim and publish; lease expiry uses database wall-clock time after locks.
5. **P5-A5 — Observable recovery:** pending, streaming, completed, failed, and cancelled states render explicitly. Documented cancellation/retry policies, safe lost-acknowledgement replay, late-result rejection, and reset/session isolation preserve submitted targets and unsent content. Busy rejection keeps composer text; late recommendations cannot navigate after newer context/navigation. Uncertain external effects persist a reconciliation state and cannot be blindly retried.
6. **P5-A6 — Server tool authority:** an authenticated server tool registry validates tool name, input, and captured resource scope. Model text grants no permission, and real providers/tools remain disabled. Injected fixtures verify denied, unknown, unconfigured, and uncertain-effect/reconciliation paths through the same boundary.
7. **P5-A7 — Independent evidence:** meaningful new and retained regression suites, TypeScript, lint, and production build pass on Node 22. Actual Neon migration/concurrency/isolation/rollback/worker-kill-restart/lost-acknowledgement/failure/cancellation checks and affected production-browser journeys substantiate the promised lifetime and behavior. Prior assessment checks use the real worker while preserving their original assertions.
8. **P5-A8 — Documentation and approval:** README documents actual worker commands, local/Heroku execution lifetime, recovery, and limits; the plan/journal record all findings, decisions, exact evidence, and independent final approval. No in-phase criterion or finding remains unresolved.

Server-derived visits are deduplicated and historical Today entries freeze. One
active chat run per conversation has a typed busy response and ordered response
placeholder. These are agreed implementation details supporting the criteria,
not additional provider integration or a weakening of earlier-phase guarantees.

**Journal:** [Phase 5 journal](phases/phase-5-agent-interfaces.md), including all
sixteen finding dispositions, exact validation evidence, and independent approval.

## Phase 6 — UI reliability and measured client scale

**Started September 16, 2026:** the user authorized Phase 6 with “move to phase 6”
after independent Phase 5 approval. P6-A1–P6-A8 are ratified. All six review
findings are independently closed. After the final documentation read, the
reviewer issued on September 16, 2026:

> APPROVED — 100% of Phase 6 acceptance criteria satisfied.

Final candidate 4 build `vOQRs6yqFvz3Jt_Sp2pHs` passes Next/worker. Independent
120 checked-in tests, queue 5, historical-provider isolation 4, TypeScript/lint
(one inherited warning), 25 grouped functional browser checks, four actual-Neon
client checks with owned-namespace cleanup, and four final timestamp-display
checks pass. Final HTTP checks return 200; fresh ordinary-navigation server output
has no disconnect/uncaught-exception diagnostics. Runtime134 and historical11
hashes match; all test processes are stopped.

The reviewer accepts measured C3's 15 successful samples against baseline 14
successes plus one retained timeout. For the tested fixtures, 100 edits issue
5–8 save POSTs versus 100, and 128-entry history mounts 40 messages versus 128.
Shared-host contention prevents a precise timing-speedup claim. The
[measurement artifact](phases/phase-6-client-measurements.json) preserves samples
and measured C3 versus final C4 provenance. Their exact four-file difference is
scenario-summary/expiry presentation and a model comment, independently accepted
for evidence reuse. Four buffered C3 disconnect diagnostics have an unconfirmed
cause; no application failure was established, and the fresh C4 check is clean.

Phase 1–5 journals remain unchanged. No commit or deployment occurred. The user
subsequently authorized Phase 7 with “phase7 time”; the Phase 6 journal remains
the unchanged historical approval record.

- Fix palette modality, Tab/Shift+Tab containment, Escape throughout the dialog, focus restoration, and normal input caret behavior using one reusable interaction owner.
- Add feature-level error/loading boundaries around active canvases and the agent; users can recover or navigate away from a broken feature. Load substantial feature implementations at appropriate module boundaries.
- Separate stable actions from selected state subscriptions. Decouple immediate edits from whole-application serialization; define flush/save acknowledgement for any coalesced writes.
- Make historical briefings lightweight and independent of live subscriptions. Define transcript/draft/tab retention and size budgets, timestamps rather than permanently relative labels, and pagination/windowing as justified by measured fixtures.
- Preserve existing visual timing, reduced-motion support, composer selection/drafts, keyboard tabs, and transition cancellation.

**Approval evidence:** production-browser keyboard/motion/navigation checks; injected feature error containment; bounded representative-data typing and transcript measurements; baseline-versus-change evidence for performance claims; no silent draft eviction. Record any product volume limits explicitly rather than claiming unlimited scale.

**Journal:** [Phase 6 journal](phases/phase-6-ui-reliability.md), including the
ratified acceptance ledger, decisions, review findings, evidence, and approval
status.

## Phase 7 — Delivery and operational readiness

**Started September 16, 2026:** the user authorized Phase 7 with “phase7 time”
after independent Phase 6 approval. P7-A1–P7-A8 cover dependency remediation,
one exact-revision release gate, protected runtime readiness, bounded release and
recovery policy, safe correlated diagnostics, repeated cross-phase checks,
accurate runbooks, and independent approval. The final same-source gate passes all
14 stages on Node 22.23.2: 166 tests, 29 browser groups, two four-check Neon
journeys, three worker checks, and 15 performance samples. Full/production audits
report zero advisories. On September 16, 2026, the independent reviewer approved P7-A1–P7-A8,
including final documentation and evidence: R1–R5 are closed with no waived
requirement. Approval applies to runtime matching fixture
`fcdb8db8464f7530cdf74179b43ea8644005110d`, build
`c8qB1_jslOkD9xnNaT7N1`, and the reviewed documentation-only updates. The
[journal](phases/phase-7-delivery-readiness.md) and
[permanent artifact](phases/phase-7-verification.json) preserve both earlier gate
failures, exact temporary-fixture provenance, cleanup, and diagnostic limitations.
No user-branch commit or hosted deployment occurred. Eleven unattributed Next
disconnect diagnostics and two caught/recovered 503s preclude a clean-log claim;
the first candidate's database error/lifetime defect is independently corrected.

- Remediate and re-audit remaining production dependency findings before release readiness. Phase 4’s Next 16.3.5 upgrade reduced the then-current production-only audit from five findings to one moderate `baseline-browser-mapping` finding, with no high/critical findings. Phase 6's npm install summary later reported four advisories (one moderate, three high) without package attribution or production/development classification; investigate current scope and remediation in this phase. Neither historical result is a clean audit or a replacement for the release obligation.
- Gate deployment of the exact revision on locked Node 22 install, all domain/integration suites, lint, production build, and focused production-browser checks. Apply the same path to manual releases.
- Add runtime readiness/smoke checks for configured auth, authenticated page/static asset, and database readiness when required. Keep health outputs minimal and avoid accidentally opening protected data.
- Define migration/release ordering, backup/recovery assumptions, deployment timeouts, failed-release handling, and rollback compatibility. Keep the original fail-closed demo gate.
- Add structured operation/error diagnostics with request/run correlation. Define development/demo environment separation and test repeatability. Inspect actual Heroku configuration only with available authorized access.
- Update README, architecture decisions, finding dispositions, and all phase journals. Re-run acceptance journeys spanning persona selection, assessment, saved project, navigation, saved drafts/conversation, cancellation, and failure recovery.

**Approval evidence:** intentional test failure blocks release; missing auth/DB configuration is detected; locally started production build works on Node 22; authorized Heroku smoke checks pass when a release is approved. Staging a deployment definition is separate from deploying it. No green status based solely on compilation.

**Authorization boundary:** existing Neon development checks may use the private
configured test branch. No hosted deployment, provisioning, commit, or real-agent
integration is authorized by this checkpoint. Keep hosted verification explicitly
unperformed until authorized and evidenced. Preserve journals 1–6, Phase 6
measurements, and migrations 001–006; update current status here and in the new
journal. The user subsequently authorized Phase 8 at its separate checkpoint;
the Phase 7 journal/artifact remain unchanged historical approval records.

## Phase 8 — Conditional real integration

**Approved September 16, 2026:** the independent reviewer accepted all P8-A1–P8-A8 and R1–R7 with no remaining in-phase blockers. The user authorized
Phase 8 with “lets go,” selected **Anthropic**, and allowed up to **$5** for live
verification. The scoped capability explains findings and proposes plans over
captured application/demo data using `claude-sonnet-5`, without model tools or
private-org writes. The complete 14-stage local gate passes, including **201
tests**, and the corrected model database suite passes **14/14**. Two actual
provider calls verify grounded output, usage, reload, deduplication, and
cancellation. The completed call's usage estimate is **$0.012352**; cancelled
remote cost remains unknown, with **$4.04** conservatively reserved within the
authorized allowance.

The private local file is ignored, untracked, mode `0600`, and now explicitly sets
`AGENT_PROVIDER=anthropic`. Both Neon connection modes work. All **209
non-documentation files** match the verified temporary fixture; final result docs
are updated separately. Hosted execution remains unverified. Recovered read
failures and unattributed Next request-abort exception blocks are retained as
diagnostic limitations. The [Phase 8 journal](phases/phase-8-real-agent.md) and
[verification record](phases/phase-8-verification.json) preserve original failed
attempts, exact proof, costs, cleanup, limitations, and the explicit final approval. No next phase or hosted deployment begins automatically.

Provider credentials stay in server environment configuration, outside Neon and
browser data. New worktrees require explicit private configuration; Git does not
transfer ignored `.env.local` files. A future authorized Heroku deployment will
use app config vars, preferably a separate provider key, and the separate hosted
database. The [README credential guidance](../README.md#provider-credentials-worktrees-and-hosted-configuration)
records the local and hosted boundaries; no automatic shared-secret mechanism or
hosted deployment has been added.

A model conversation over fixture data may retain the demo gate. This phase's
initial scope has no private-org access, model tools, executable output, or
external writes. Private-resource work would require a separately approved scope
with real identity, org grants, revocation enforcement, audit semantics, and an
appropriate execution environment before enabling it.

Implement the chosen narrow integration through Phase 5's interfaces. Read-only access precedes changes unless explicitly authorized otherwise. Validate provider timeouts, cancellation, duplicate requests, scope/permission changes, and any tool approval policy with the real service.

**Approval evidence:** an actual authorized provider journey must work in local
production, with the exact scope and lifetime promised, alongside the exact-source
regression/release gate. Hosted acceptance is conditional on separately authorized,
configured deployment; otherwise hosted behavior remains explicitly unverified.
No mock-only phase approval or claim of production identity, worker recovery, or
tool isolation for behavior never implemented/tested. Prior journals/artifacts and
migrations 001–006 remain immutable; new schema changes require new migrations.

## Phase 9 — Operational diagnostics and hosted release preparation

**Started September 16, 2026:** the user authorized continuation with “lets
continue” after the approved Phase 8 checkpoint. The implementer, independent
reviewer, and scribe investigate the request-abort exception blocks and recovered
`agent.read` 503s carried forward from prior verification. The coordinator
prepares a concrete Heroku preflight using read-only inspection. No new paid
provider calls, hosted mutations, user-branch commit, or deployment are included.

**Approved September 16, 2026 (Eastern):** the independent reviewer accepted all
six criteria with no remaining in-phase findings. The shared
HTTP entrypoint and one-retry observational snapshots pass the 14-stage gate with
205 Node tests, 29 browser checks, two four-check Neon runs, three worker checks,
and 15 performance samples. The reviewer confirms 210 runtime files match the
tested fixture and all 18 historical files remain unchanged. Final ordinary
traffic has no 5xx, `agent.read` 503s, uncaught exceptions, or framework abort
blocks; eleven safely classified request resets remain visible. Historical
individual errors cannot be attributed retrospectively. The hosted preflight is
complete; its configuration, environment protections, exact committed release,
recovery evidence, and worker activation remain separately authorized steps.

### Acceptance criteria

1. **P9-A1 — Request lifetime:** reproduce and classify request-abort exceptions
   with request/lifecycle correlation; distinguish demonstrated causes from
   historical observations that cannot be attributed retrospectively.
2. **P9-A2 — Read failures:** identify safe error codes and triggers for recovered
   `agent.read` 503s, with honest limits on historical attribution.
3. **P9-A3 — Minimal correction:** fix demonstrated defects with focused regression
   coverage. Do not hide errors through blanket exception/log suppression.
4. **P9-A4 — Preserved contracts:** retain paid-request intent, cancellation,
   publication fencing, ownership, and demo-only ordinary verification.
5. **P9-A5 — Exact evidence:** repeat diagnostic and functional checks on the
   reviewed source; retain original failures and evidence boundaries.
6. **P9-A6 — Reviewable hosted plan:** record actual Heroku preflight facts,
   revision/configuration/worker/migration/budget requirements, and unknowns.
   Keep current docs accurate and obtain explicit independent approval without
   claiming hosted acceptance for an unperformed deployment.

The [Phase 9 journal](phases/phase-9-operations.md) and
[verification record](phases/phase-9-verification.json) track findings, evidence,
and the final decision. Journals/artifacts 1–8 and migrations 001–007 are immutable;
the coordinator captured 18 hashes before Phase 9 edits. Stop at the next user
checkpoint after approval. Any hosted mutation requires a concrete reviewed
release and separate authorization.

## Finding coverage and completion rules

| Finding | Primary closure | Supporting work |
| --- | --- | --- |
| F1 storage integrity/status/sync | Phase 1 | Phase 4 durable data; Phase 6 write granularity |
| F2 history/catalog coupling | Phase 2 | Phase 4 relational storage/import |
| F3 workspace/canvas/operation scope | Phase 3 | Phase 2 types; Phase 5 captured run context |
| F4 canvas contracts/identity | Phase 2 | Phase 3 all navigation entry points |
| F5 simulation/rendering coupling | Phase 5 | Phase 2 domain read models |
| F6 dormant implementation | Phase 3 | Phase 7 architecture documentation |
| F7 palette semantics | Phase 6 | Phase 7 automated release coverage |
| F8 release/setup verification | Phase 7 | Tests each phase; Phase 4 environment template |
| F9 server authority | Phase 4 demo data boundary; Phase 5 tool boundary | Phase 8 real identity/grants for actual private integration |
| F10 lifetimes/capacity/failure recovery | Phases 4–6 | Phase 7 diagnostics/readiness; Phase 8 actual provider limits |

Additional reviewer evidence is included within those rows: stale full-draft writes (2), recurring findings/run identity (2), invalid canvas surface/params and duplicate parsed IDs (2), multiple browser assessment timers (5), static heavy-feature imports/error containment (6), relative timestamps and historical live subscriptions (2/6), and unsupported lifecycle claims (7/8).

Each phase journal must retain acceptance criteria, implementation/review rounds, the exact commands and runtime used, unresolved items, and final approval evidence. The scribe updates this plan's status only after the reviewer has explicitly approved; the next phase remains gated on the user.
