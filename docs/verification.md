# Verification

[← README](../README.md)

For idle-worker query counts, wake/recovery latency, lifecycle checks, feature
retention and the remaining Neon suspension limits, see [worker idle verification](worker-idle.md).
The scheduler and browser inactivity suites run in the shared pure gate; durable
queue checks extend the agent database suite. `idle-suspension` is registered in
the shared browser registry used by PR shards and the full release gate.

Use Node **22.23.2**, as declared in `.nvmrc` and `package.json`:

```bash
npm run test:persistence
npm run test:domain
npm run test:navigation
npm run test:onboarding
npm run test:conversation
npm run test:application
npm run test:cli
npm run test:agent
npm run test:client-reliability
npm run test:operations
npm run test:worker-idle
npm run lint
npm run build
```

The database suite requires an explicit `DATABASE_TEST_URL` for an isolated,
already-migrated development/test target:

```bash
npm run test:database
npm run test:agent-database
```

It exercises actual SQL commands, transactions, revisions, ownership, import,
concurrency, and timeout recovery using fresh test namespaces. It cleans up those
namespaces. Run migrations against that same intended target before testing;
setting the test URL does not migrate it automatically. Local Postgres results are
supplemental; the phase also requires this behavior verified against isolated Neon.
Standalone database test entry points replace the inherited runtime direct URL
with `DATABASE_TEST_URL_UNPOOLED`, or clear it when absent; they do not pair a
test runtime URL with the main database's direct URL.

The persistence suite covers storage failure/recovery, conflict choices, events,
legacy data, stable snapshots, and save-status component markup. The domain suite
covers historical migration, catalog-independent snapshots, run/draft/command
identity, bounded history, planning-project ownership, and canvas contracts and
recovery. Compile-only canvas assertions also verify required per-kind fields
during type checking/build. The navigation suite covers explicit context, captured
scope, URL identity/validation, internal sign-in continuation, closed-draft
integrity, migration, and superseded navigation. The onboarding
suite covers assessment scope/lifecycle,
profile isolation, and duplicate project creation; the conversation suite covers
conversation behavior. The application suite exercises command validation,
acknowledged saves, preserved command identity after uncertain outcomes,
stale-response/session isolation, conflict recovery, protected pending buffers,
and legacy import validation. The CLI unit test checks atomic replacement of its
private session file. Actual seed/reset/lost-response CLI journeys have separate
independent Neon evidence in the Phase 4 journal; the unit test does not replace
those integrations or browser checks. The agent pure suite checks replaceable
adapter/tool contracts and client request recovery. The agent database suite uses
the explicit `DATABASE_TEST_URL` for actual submission/replay, ownership,
cancellation, worker fencing, and effect reconciliation. Independent process-kill,
concurrency, and production-browser probes are recorded separately in the
[Phase 5 journal](../docs/phases/phase-5-agent-interfaces.md). Browser checks and review decisions are recorded
separately in the [Phase 1 journal](../docs/phases/phase-1-persistence.md),
[Phase 2 journal](../docs/phases/phase-2-domain-identities.md), and
[Phase 3 journal](../docs/phases/phase-3-navigation.md). Current database/client review
and its separate Neon evidence gate are in the
[Phase 4 journal](../docs/phases/phase-4-neon.md).
The client-reliability suite covers coalesced edits, synchronous recovery,
flush timing, uncertain-request identity, edits during discard, scoped
subscriptions, tab capacity, and timestamp normalization. Phase 6 production
keyboard, injected-fault, and baseline/final client measurements are tracked
separately in the [Phase 6 journal](../docs/phases/phase-6-ui-reliability.md);
the phase is independently approved.

After building, run the HTTP entrypoint checks independently with:

```bash
node scripts/web-runtime.mjs
node scripts/web-runtime.mjs --dev
```

These launch and stop their own processes, force demo mode, and remove the
provider key from child environments. They check authentication, upgrades,
challenge/retry, request limits, disconnect recovery, and in-flight shutdown;
the development run also verifies authenticated hot reload. The production run
is included in the complete gate's runtime-smoke stage. Results are written
under `.release/http-production` and `.release/http-development`, or the specified
`BROWSER_TEST_OUTPUT` directory.

### Complete release gate

The shared gate in `scripts/verify-release.mjs` runs a locked `npm ci`, the full
dependency audit (blocking moderate, high, and critical advisories), all pure
suites, lint, type generation/checking, web/worker
production build, migration/status checks, both database suites, positive and
negative runtime smoke, browser regression/fault checks, two live-database browser
journeys, worker crash/restart recovery, and the performance protocol. Tests that
need server-only module conditions run separately from browser/SSR tests.

Pull requests run these same stage implementations in seven parallel jobs:
code checks, database/browser persistence plus worker recovery, four browser
regression shards, and performance. Each runtime job owns its production build
and disposable Postgres service, so browser timing measurements do not compete
with other suites on the same runner. `scripts/browser/suites.mjs` is the shared
suite registry; `scripts/verification-plan.test.mjs` checks that the workflow
matrix covers every release stage and every browser suite exactly once across
the browser shards. Browser suites still exercise their existing motion modes.

Each job reports phase durations in its summary and prints individual browser
suite timings. The jobs finish independently even if one fails, revealing all
failures in one run. New commits cancel superseded PR runs. The required `verify`
check succeeds only when merge integrity and every applicable job succeed.
Main/manual release verification still runs the complete gate and produces the
exact-source deployment attestation; partial PR groups cannot produce one.
Production deployments remain serialized and are never cancelled by a PR push.

To reproduce one PR group locally against the isolated test database:

```bash
npm run verify:release -- --working-tree --group database
npm run verify:release -- --working-tree --group browser-1
```

Group results and phase timings are saved in `.release/group-verification.json`
and `.release/timings.json`. CI preserves those and the failing phase record,
including on failure, without uploading raw server logs or credentials.
The live-database browser journey builds its navigation URLs from the signed-in
profile; cross-profile URLs are intentionally rejected by the app.

Configure `DATABASE_TEST_URL` for an explicitly disposable, isolated target and
`DATABASE_TEST_URL_UNPOOLED` for the same remote database's direct endpoint. The
runner overrides both runtime URLs together, chooses a local port, and generates
its own Basic Auth password. It starts/stops its own production server and creates
test-owned data. It applies the repository migrations to that target. Do not aim
the gate at shared or production data.

```bash
# Validate current changes; this cannot produce a deployable attestation.
npm run verify:release -- --working-tree

# In a clean checkout, replace FULL_SHA with the complete commit hash.
npm run verify:release -- --revision FULL_SHA
```

Exact-revision mode requires a clean checkout at that commit and verifies the
source fingerprint again after all checks. A passing run records Node version,
revision/tree, lockfile/archive digests, build ID, and completed checks in
`.release/verification.json`, with its source archive beside it. A failed stage
produces no release attestation. Working-tree mode records `releasable: false`
and does not create the release archive. Editing source afterward invalidates the
evidence for that new source. The deployment script rejects incomplete, stale
(over 24 hours), or mismatched attestations before remote effects.

Artifacts/logs are in ignored `.release/`. Do not publish raw runtime output or
test credentials. The GitHub workflow uses this same gate with an isolated
Postgres service; a local run against the configured Neon test branch supplies
separate Neon evidence. CI Postgres success is not Neon-hosted verification.
On SIGINT/SIGTERM, the verifier terminates its active child process group and
stops its production server. If interruption prevents a suite's database cleanup,
retain its namespace journal (in the test output directory or system temp
directory), confirm the exact test target, and reconcile only those owned
namespaces. An interrupted run is not evidence of successful cleanup.

The September 16 Phase 7 run passed all 14 stages: 166 tests, 29 browser groups,
two four-check Neon journeys, three worker checks, and 15 performance samples.
This was an exact-source temporary Git fixture; the user's working branch remains
uncommitted, and its generated fixture attestation is not authorization to deploy
that branch. Both earlier failed attempts remain in the verification artifact.
Final logs also contain 11 Next aborted/ECONNRESET uncaught-error blocks of
unconfirmed origin and two caught agent-read 503s followed by successful reads.
The passing journeys and cleanup do not establish the cause of those diagnostics
or a timing-speedup claim. See the artifact for exact limits and provenance.

For focused runtime smoke against an already running local production server:

```bash
BROWSER_TEST_ORIGIN=http://localhost:3000 node --env-file-if-exists=.env.local scripts/runtime-smoke.mjs
```

It checks private pages/static assets/readiness, rejected credentials, startup
configuration failures, missing-auth HTTP responses, and an unavailable database.
`npm run test:runtime` uses the same script when those variables are already
exported. `npm run test:worker-recovery` exercises actual worker termination and
restart against the explicit test database; it is not a provider integration.

### Production browser checks

Browser harnesses live in `scripts/browser` and use Node 22 and pinned Playwright 1.63.0.
Install its Chromium browser with `npx playwright install chromium`, then start
the production build against the intended environment. Set `BROWSER_TEST_ORIGIN`
to its URL and supply matching `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` through the
environment. `BROWSER_TEST_OUTPUT` selects the artifact directory (default:
`/tmp/ufd-browser-results`).

```bash
npm run test:browser -- candidate
npm run test:browser:performance -- candidate
```

The first command checks product behavior, interactions, agent-client recovery,
UI budgets, and injected feature/chunk failures. The release gate runs this same
browser registry. Restored behaviors have these checks:

| Behavior | Registered browser suite | Supporting pure checks |
| --- | --- | --- |
| Untouched visible/hidden tabs stop background reads; input/focus resumes; active runs retain progress | `idle-suspension.mjs`, `streaming.mjs`, `session-recovery.mjs` | `browser-idle.test.mjs`, `agent.test.mjs` |
| Four expansion scenarios: sample work, Today, palette, resource access, surface switcher and blocked direct routes; old assessment links/tabs and live Today compatibility | `expansion-profiles.mjs`, `assessment-canvas.mjs`, `org-sign-in.mjs` | `demo-profiles.test.mjs`, `assessment-canvas.test.mjs` |
| All profiles choose a connected org at sign-in; required choice, retry, first agent target, reload, profile switching, matching saved links and mobile layout | `org-sign-in.mjs`, `profile-reset.mjs` | `navigation.test.mjs`, `profile-reset.test.mjs` |
| Sign-out and profile changes have one navigation owner; session/workspace outages show loading or retry UI; slow reads cannot be starved by polling; stale reads cannot restore or bootstrap an old session | `session-recovery.mjs`, `org-sign-in.mjs`, `profile-reset.mjs` | `profile-reset.test.mjs`, `client-reliability.test.mjs` |
| Every fresh/cleared profile starts on centered Today with no panels; used profiles restore canvas and panel choices across reload, sign-in and profile switching; explicit links/changed orgs take precedence | `profile-start.mjs`, `org-sign-in.mjs`, `chat-layout.mjs` | `navigation.test.mjs`, `persistence.test.mjs` |
| Starter cards open scoped canvases and seed without submitting | `starter-canvases.mjs` | `starters.test.mjs` |
| Selected-org assessment scope, captured findings, rescan and retry; interrupted post-commit refresh replays the same rescan without creating another run | `assessment-canvas.mjs` (fixture receipts retain command identity) | `assessment-canvas.test.mjs` |
| Sam’s first assessment starts automatically for the connected org; other unassessed orgs offer Run assessment, switching back restores their findings, active workers retain captured scope, assigned opportunities leave Today, optional deployment targets do not change the connection on project entry or reload | `org-assessment-scope.mjs`, `assessment-startup.mjs` | `onboarding.test.mjs`, `project-creation.test.mjs`, `navigation.test.mjs`; `agent-database.test.mjs` verifies worker/history scope and nullable targets |
| Sam's selected opportunity cards remain visible and stationary while Shape a project saves its draft; acknowledged ALM handoff retains normal Start a project title/icon, secondary assessment context, Back to Today and draft resumption, including reduced motion and narrow layout | `assessment-project-transition.mjs` | `project-creation.test.mjs` (acknowledged drafts and source retention) |
| Project templates, saved intent, brief-to-project creation on all profiles without the assessment promotion panel, visible creation action, explicit scoped planning action with retained composer draft, sidebar/reload/reopen; Start project leaves the current project/worktree for global ALM with its org retained, Back preserves the original context and new draft, and successful creation enters the new project; delayed navigation, retry recovery and assessment creation | `project-panel.mjs`, `project-creation.mjs`, `project-create-end-to-end.mjs`; `project-create-database.mjs` in the database browser gate | `project-creation.test.mjs`, `database.test.mjs` (atomic creation, ownership, duplicate retries), `model-context.test.mjs` |
| Clear data shows pending progress inside its disabled confirmation button with a stable label and no extra modal text; deletes brief-created projects without assessment runs, including after sign-in/reload; other profiles/namespaces and projects created after an acknowledged reset survive retry | `profile-reset.mjs`; `project-create-database.mjs` in the database browser gate | `database.test.mjs` (direct workspace ownership, scoped reset, rollback, receipt replay and all-profile reset) |
| Planning stays in chat; explicit agent navigation preserves scope and ignores stale handoffs | `agent-navigation.mjs` (handoffs) | `navigation-intent.test.mjs`, model context/provider/worker tests (no-tool planning and saved-catalog validation) |
| Project links reveal the sidebar parent without changing scope; persistent Start project footer on all profiles; Sessions only lists chats | `project-panel.mjs` | Navigation tests |
| Project/worktree explorer drill-down and double-click, folders/search, keyboard file opening in scoped surfaces, return focus, saved `.project` context and work items, downloads, reload, deletion, narrow layout and no file writes | `project-explorer.mjs` | `project-explorer.test.mjs` (profile/branch isolation, inherited base files, portable context, identity, availability and mutation rejection); `model-context.test.mjs` (agent intent/evidence) |
| Header changes beside the project selector, viewport-centered search/shortcut without overlap at 390–1920px: added `.project` files and line counts, file opening/reload, global unassigned drafts with the indicator hidden at zero and visible after editing, project-only scope, global-only tracking CTA, creation-first tracking and existing-project transfers removing global changes while rejecting existing targets, keyboard dismissal and narrow/light/dark layout | `workspace-changes.mjs` | `workspace-changes.test.mjs` (line diffs, current exports, empty drafts, profile/project/branch isolation, sample comparisons and restored source) |
| Default All navigator search, projects/resources/sessions/orgs/surfaces ordering with ranked matches within each category, ALM project-file results with preserved global/workspace scope, explicit Projects-tab entry with intact worktree trees, org pill/category filters, clear search and restricted profiles | `unified-search.mjs`, `interactions.mjs`, `org-resources.mjs` | `palette-search.test.mjs`, `navigation.test.mjs` |
| Build & Setup org browsers: objects, permissions and features; explicit org, captured tabs, global/project scope, browsing without draft writes, all profiles and narrow/light layout | `org-setup.mjs`, `org-resources.mjs` | `org-resources.test.mjs` |
| Account field additions with label/API name/type, duplicate validation and removal; modified object file in global changes, hidden at zero, editor/reload/org isolation, project creation with atomic transfers retaining org and removing global originals; no transfer-summary or draft-copy panels on creation; preventing overwrite | `object-field-changes.mjs` | `object-fields.test.mjs` and `change-transfer.test.mjs` (command boundary, object diffs, scope isolation, batch preflight and receipt recovery); `database.test.mjs` (merged validation, copying, atomic transfers/creation, stale edits and replay) |
| Independent Home/project/worktree tab sets and active tabs; reload/close isolation, legacy preference migration, explicit global inspection with shared draft ownership | `workspace-tabs.mjs`, `global-home.mjs`, `project-surface-scope.mjs` | `navigation.test.mjs`, `client-reliability.test.mjs` |
| Deployed apps open in ALM; legacy URLs and drafts survive | `alm-app-migration.mjs` | `alm-app-migration.test.mjs` |
| All profiles share a general ALM overview with project, work, pipeline, validation and release tools visible on entry/reload; starter navigation preserves connection and composer without submitting, Today retains assessment guidance, saved project plans and scoped releases/apps remain available | `alm-overview.mjs`, `project-surface-scope.mjs`, `alm-app-migration.mjs`, `project-creation.mjs` | Shared browser registry checks |
| Saved project work items other than the focused permissions workflow open their own editable Build & Setup change canvas; plan/evidence, independent saved edits, return to ALM, reload/close/reopen, current connection and global/project scope are retained; unavailable work items cannot open or save changes | `work-item-changes.mjs` | `navigation.test.mjs`, `application.test.mjs`, `database.test.mjs` (ownership, persistence, retry and source/status retention) |
| Service Reps assessment finding opens a focused per-user access canvas; chat guidance, manual autosave followed by bulk remaining-user updates, persistent row/all undo, tracked assignment diffs inside/outside projects, org isolation and project-tracking entry | `permissions.mjs` | `permissions.test.mjs` (bounded intent, values, transfer and diffs), `agent-database.test.mjs` (shared write boundary, ownership/revision checks, atomic edit+conversation+receipt, replay and rollback). The generic work-item suite retains all earlier findings. |
| Project preview launch, captured worktree/org, global inspection and explicit entry, sample interactions, responsive viewer, new tab and reload | `project-preview.mjs` | `navigation.test.mjs` (scope, identity, availability and mutation rejection) |
| Attention cards reach the correct work and retain historical Today | `attention-scenarios.mjs` | Domain and conversation tests |
| Work canvases distinguish type, project, worktree and branch; explicit global entry retains the connected org, current canvas, separate captured target, draft and history | `work-project-entry.mjs` | Navigation tests |
| Global file browsing preserves chat/org and file ownership; only explicit project actions enter a project | `global-home.mjs`, `attention-scenarios.mjs` | Navigation and agent database tests |
| Today keeps its active appearance until it scrolls offscreen, including interrupted scrolling and reduced motion; history retains faint container fills/outlines, layout and disabled controls in light and dark themes | `today-departure.mjs`, `global-home.mjs` | — |
| Home reuses trailing Today after project activity, including the first return carrying a different org; explicit org selections stay logged and intervening global content earns one new card | `global-home.mjs` | `conversation.test.mjs`, `agent-database.test.mjs` |
| Today surface links do not replay their reveal on focus changes; surface entry and global surface-to-Today preserve sharp chat, while project/worktree/global context changes retain the dissolve | `today-departure.mjs`, `global-home.mjs` | — |
| Instant same-surface canvas/overview selection and closing, rapid keyboard/focus and retained drafts; whole-surface transitions and reduced motion | `canvas-motion.mjs` | Navigation tests |
| Surface label opens overview; separate chevron opens dropdown; first physical click works during surface motion, including Sam’s assessment-to-project flow; keyboard/dismissal, profile access, scoped canvas restoration | `surface-switcher.mjs` | Navigation tests |
| Project/worktree-contained work lists and tabs; project-wide app ownership; global navigation | `project-surface-scope.mjs`, `global-home.mjs` | Navigation tests |
| Chat activity beside Agent, spinner/reduced motion, narrow layout and request recovery | `chat-latency.mjs` | Client reliability tests |
| Chat/composer alignment, immediate live resize across breakpoints, panel motion, reply presentation and reveal timing | `chat-layout.mjs` | Conversation tests |
| Lazy canvas loading/chunk retry, canvas render failure/recovery with buffered edits and a usable Changes header, navigation escape, transcript failure isolation and preserved composer node/text/selection | `faults.mjs` (render fault targets the canvas draft projection without breaking header string operations) | — |

ALM overview adaptation (September 23, 2026; reviewed against fetched main
`bda0165230fce19a53ea7cf8ab8f1a149fd2cee0`): the assessment-specific global ALM
introduction and its redundant assessment-return action are replaced, as requested,
by the shared ALM identity and visible creation tools. Assessment-to-project
guidance remains on Today. Following review, saved projects appear in a compact
Your projects table with type and progress. The selected workspace filters its
rows; global browsing lists all saved projects. Rows open the dedicated project
canvas while retaining the current workspace and connected org. Detailed plans,
work-item controls and evidence appear only in those canvases, not inline on ALM
home. Existing releases, work, deployed apps and their
navigation are retained. Other surfaces retain their existing starter disclosure.
`alm-overview` is registered in the PR/release registry, and
`project-surface-scope` replaces the old assessment-headline/hidden-starter
expectations while retaining project isolation checks. Its follow-up checks cover
both assessment and brief-created project rows, dedicated-canvas navigation,
reload, global/project scope and a narrow table layout. No tests were deleted by
this change.

Focused validation passed: five browser suites (`alm-overview`,
`project-surface-scope`, `alm-app-migration`, `project-creation`, and
`assessment-project-transition`) with 19 check groups, both registry contract
tests, production/worker build, and lint with only the existing layout stylesheet
warning. The new suite covers all four profiles, normal/reduced motion, reload,
light/dark themes and a narrow layout. Browser APIs are mocked; the complete
release gate and live database/provider integration were not run for this UI edit.

Main integration (September 23, 2026): fetched and fast-forwarded from
`6732e78e9850274864ce2aa14d27a80e3b801e41` to
`fdf1c85ab5826ccb4c2fe818ba0b26a746d79699`, then restored the local product
changes. PR #18's idle-worker and browser suspension behavior and PR #19's
workspace changes, object field editing and atomic project transfer behavior
are retained. All incoming browser registry entries and tests are retained.
Assessment replay coverage is adapted to the selected-org Run assessment action;
project creation retains global entry, Back/draft preservation and transfers
while the local optional deployment-target behavior remains in place. No feature
or test file is removed by this integration. The final content diff against
fetched main has no deleted files; its 39 registered browser suites remain,
alongside the four local assessment/ALM/work-item suites.
Validation passed after integration: 326 non-database tests, 69 application/
worker/model tests against a disposable local PostgreSQL cluster, production and
worker builds, and 12 focused browser suites (54 check groups). The persistence
suite runs without the server-component condition, as required by its React
rendering checks. Browser coverage includes assessment replay, selected-org
scope, transition stability, ALM overview/table, work-item edits, both creation
paths, project navigation, workspace changes/transfers, Account fields and idle
suspension. Lint has zero errors and the existing layout stylesheet warning.
The preview and worker were restarted and readiness returned 200. This was not
the full release gate or a live-provider test.

Work-item change canvas (September 23, 2026): each expanded saved project work
item now offers Make a change in Build & Setup. A stable project/work-item
identity opens an editable summary, optional file reference and proposed change,
with the item's original plan, acceptance criteria and evidence available beside
the draft. Draft fields use the existing saved-canvas persistence and recovery
path. Opening, editing, returning, reloading and reopening retain the connected
org and the canvas's captured ownership, including global inspection. Neither
work-item status nor source assessment evidence is changed by editing. These are
saved project drafts; repository file application and org deployment are not
implemented. Existing project canvases, work-item controls and other Build tools
are retained. The new UI suite is registered for both PR shards and release
verification; boundary and database checks reject missing, foreign-profile,
foreign-namespace and mismatched-project work items. No schema change is needed.

Validation passed: 74 navigation/application/persistence/registry tests and 19
database tests against a disposable local PostgreSQL cluster, stopped and removed
afterward. Three focused browser suites (`work-item-changes`,
`project-surface-scope`, `project-creation`) passed 15 check groups. These include
all four assessed work items, normal/reduced motion, light/dark and narrow layouts,
field persistence, independent drafts, global inspection with another connection,
and rejection of unavailable links. The browser checks caught and fixed a new
draft fallback that inferred the optional deployment org: initial change drafts
now capture the current connection and later visits retain the saved ownership.
Production/worker build and final lint passed (full lint retains only the existing
layout stylesheet warning). No live Neon/provider test or full release gate was
run for this change.

Org and project scope adaptation (September 23, 2026; main baseline
`6732e78e9850274864ce2aa14d27a80e3b801e41`): per the requested behavior,
new assessments capture one explicit connected org. Sam’s first scan stays
automatic; another unassessed org gets an explicit action. Only one assessment
runs at a time in the UI; switching connections leaves the active worker intact.
Completed per-org runs, older multi-org evidence, project plans, pause/resume,
retry, and immutable earlier Today entries are retained. Worker refresh and
Today departure snapshots use the conversation’s org rather than another org’s
latest scan. Model evidence and assessment links use the selected org’s run.

Project work is described as development and review in version control, with an
optional deployment destination. Assessment creation accepts an unset target;
brief-created projects no longer infer one from their source connection. Existing
explicit targets remain readable. Switching projects/worktrees retains the
connection, while editors, previews, notes, and source evidence retain their
captured ownership; URL validation still rejects other-project/worktree owners.
Assigned opportunity cards are hidden on live Today and remain available through
the project and assessment history. No files are written to Salesforce orgs and
no deployment or repository provisioning was introduced.

Replacement checks adapt the former multi-org picker and automatic project-org
expectations to the explicitly requested behavior. No test files or product
history were removed. `org-assessment-scope` is registered for PR shards and the
full release gate alongside the existing startup, history, project and motion
checks. Domain/application/model/navigation/conversation checks and isolated
PostgreSQL application/worker/model tests cover the command, snapshot, and
persistence changes. Browser fixtures mock APIs; database tests use a disposable
local cluster, not the user’s Neon database. This focused validation is not the
full release gate or a live-provider test.

Workspace read latency (September 23, 2026; retained against main
`fdf1c85ab5826ccb4c2fe818ba0b26a746d79699`): `readWorkspace` batches the seven
record collections after the existing workspace read, reducing eight database
round trips to two. Namespace/profile filters, ordering, revisions, status
overrides, import limits/timestamps, canvas routing and response-size checks are
retained. The workspace lock stays in a separate statement so a waiting command
reads its predecessor's committed records after acquiring the lock. The new
database test exercises that concurrent writer/reader case and guards the round
trip count; the existing snapshot session-change/revocation, import, ownership,
receipt, permissions/undo and worker/model checks remain registered in the
release database jobs. All 73 PostgreSQL checks pass on an isolated local cluster;
TypeScript and changed-file lint pass. No UI behavior or browser checks were
replaced. Read-only comparisons returned identical snapshots for four existing
profile workspaces. Five alternating before/after measurements on the same
development-database connection had median workspace-read times of 467 ms and
134 ms respectively. These isolate the data read and do not measure end-to-end
browser latency; no development data was mutated by the comparison.

Assessment-to-project adaptation (September 23, 2026; main baseline
`6732e78e9850274864ce2aa14d27a80e3b801e41`): initial Today reveals and read-only
history are retained. Focus handling now finishes the existing reveal instead
of restarting it; the saved-draft resume card remains available below the
opportunities and is hidden while preparation is pending. The standard capability
header is shared with assessment project creation, with assessment provenance
secondary and the requested “Back to Today” label. Draft editing, evidence,
source-run retention, validation, discard and acknowledged creation are retained.
No existing checks were removed; the invalid shard-count check now uses the
registry's current size instead of a fixed count. Its two coverage/contract tests
pass. `assessment-project-transition` adds the focus,
stable-layout, matching-header and return/resume checks to the shared registry.
Its browser reproduction failed before the change with card opacity reaching
zero, then passed with opacity one throughout both motion modes. Existing
`project-creation` and `today-departure` checks, 29 onboarding/creation/conversation
tests, TypeScript and production build passed; lint retains the existing
stylesheet warning in `src/app/layout.tsx`. Browser checks used mocked endpoints;
the complete release/database gate was not run for this UI change.

Resource browsing checks the connected org selected on entry and explicitly clears
the filter to exercise empty-state recovery. Unified search uses an explicit
no-org destination for that case. Resource navigation also verifies that Home
does not inherit project tabs and that returning to the project restores its
selected canvas. Cross-tab budget checks modify the current workspace-scoped v3
preferences; v2 seeds remain in place to cover legacy migration. Starter and
attention checks assert immediate inertness, then wait for Today to scroll out
before asserting its disabled historical state. The attention journey returns
Home immediately after opening a canvas and still requires deactivation when
batched intersection records place the old Today offscreen.
Navigation checks select the live `Today` group by its accessible name; an
enabled fieldset can still belong to a retiring, inert briefing during scroll.

Browser files live in `scripts/browser`; pure checks live in `scripts`. For a
focused check, run `node scripts/browser/<suite>.mjs candidate` against the same
configured preview. Removing or replacing a behavior check during a refactor
requires an explicit disposition: preserve it, adapt its assertion to the new
owner, or document an approved behavior change. A passing gate over fewer tests
does not establish that the removed behavior survived.

These suites and the performance harness intercept API traffic with deterministic
fixtures; they test production client behavior, not database throughput. The
performance harness uses 4× Chromium CPU slowdown, 1/20 saved drafts with 100
input edits, and 20/80/128 transcript entries, three samples each. Compare the
same protocol and environment; shared-host contention limits timing conclusions.
The recorded Phase 6 comparison uses 5–8 save requests for 100 edits versus 100
in the baseline, and mounts 40 messages for a 128-entry history versus all 128.
The [measurement artifact](../docs/phases/phase-6-client-measurements.json) preserves
all completed samples and the one baseline drain timeout. It identifies the
measured candidate separately from the final application candidate. These counts
describe the tested fixtures; host contention prevents a precise latency-speedup
claim.

For the separate live Neon client check, configure `DATABASE_TEST_URL` for the
authorized disposable database used by that production server, then run:

```bash
npm run test:browser:neon -- candidate
```

That check creates and removes its own namespace, validates the server/database
target match, and exercises saved edits, immediate-reload recovery, and profile
isolation against actual persistence. It uses targeted worker ticks for its owned
test work and has no automatic database fallback. It does not replace the full
SQL suites.

Expansion adaptation: unrestricted browser fixtures now use Alex; Jordan covers the governance phase. Legacy newcomer starter-card coverage remains in `starter-canvases.mjs` using captured earlier briefings. Current profile project creation uses the persistent sidebar action. No saved history or user-created project is removed.

- Profile sample depth: `demo-profiles.test.mjs` checks 0/2/4/6 projects, worktree distribution, sample ownership, project-only draft identities, and agent destinations. `expansion-profiles` checks navigator structure and Karen’s project-level canvas, saved notes, and sessions.

Surface navigation responsiveness (September 23, 2026): the browser’s surface
transition captured the navigation controls together with the content, making
tabs and the menu unavailable to pointer input during active frames. The capture
now wraps only the canvas panel, and the snapshot overlay ignores pointer input.
The live tab strip and dropdown stay outside the capture. Surface content motion,
workspace dissolve, immediate canvas switching, reduced motion, keyboard access,
profile restrictions and draft restoration are retained. No navigation or save
logic is removed. The registered `surface-switcher` suite now shapes a single Sam
assessment opportunity and uses one physical mouse click during deliberately
extended surface motion; it failed before the fix and passes afterward in normal
and reduced motion while retaining project/chat drafts and the connected org.
Validation passed: 43 browser check groups across `surface-switcher`,
`canvas-motion`, `assessment-project-transition` and `global-home`, plus TypeScript,
scoped ESLint and diff checks. Existing transition, keyboard, narrow-layout,
draft persistence and workspace/history checks remain. Browser APIs were mocked;
no live profile data or provider work was changed.

### Service Reps permissions workflow (September 23)

A new `case-access` finding models six service representatives with a direct
`Case_Delete` assignment beyond their documented role. The `Service_Reps` group
provides Read/Create/Edit, and the captured profiles and other grants do not
provide Delete. The focused resource canvas supports per-user edits and durable
row/all undo. It deliberately uses assignment changes rather than group muting:
muting a shared group would not support the requested one-user-at-a-time demo.

Edits automatically use the revisioned canvas persistence and Changes projection
in either project or unassigned scope. The tracked `Service_Reps.assignments.json`
file represents desired assignment state, not deployable PermissionSet metadata.
A live Salesforce assignment executor and Git synchronization are not implemented.
Chat guidance sits beside the state-oriented canvas. Explicit supported requests
can remove remaining Delete grants or restore captured assignments. Local edits,
conversation output, effect audit and retry receipt commit together; unsupported
permissions/qualified requests do not silently change access. Ordinary navigation
and unrelated model reasoning remain available, with captured permission state.

The browser registry includes `permissions`; its four normal/reduced-motion
checks cover manual-then-chat changes, automatic tracking, reload, undo, scoped
orgs, global project-tracking entry and narrow/light/dark presentation. Existing
`work-item-changes` retains its four original findings and generic draft coverage;
the new permissions work item has its focused check. Existing API, routing,
storage and release findings, object-field editing and change transfer are
retained. Main was fetched and verified at
`fdf1c85ab5826ccb4c2fe818ba0b26a746d79699`; no existing test was removed.

### Light/dark switch (September 23)

The top-bar Help placeholder is replaced with an accessible Dark mode switch,
as requested. It follows the system appearance until a choice is made, then
stores that choice locally and applies it before paint on subsequent loads.
Chat, canvas, menus, native controls and login styles use the selected scheme;
the preview sample application's deliberately light styling is retained.
Existing navigation, profile controls, draft persistence and reduced-motion
behavior remain. The switch is also available on narrow screens.

The registered `theme-switch` browser suite starts in both system themes and
checks live OS preference changes before selection, manual overrides across all
visible app elements, keyboard operation, work preservation, reload/navigation
and narrow layout. Both journeys pass, with light/dark screenshots reviewed.
TypeScript and registry coverage checks pass; changed-file lint has only the
existing layout stylesheet warning. Browser APIs are mocked. The Help placeholder
removal is explicitly authorized; no existing test or functional help flow was
removed against the recorded main baseline above.

Follow-up: literal system/light/dark rules on the document root restore the CSS
compiler's generated `light-dark()` fallback variables. A variable-only scheme
declaration had left the attention-card fill, border and status color invalid.
The existing registered `attention-scenarios` suite now checks these actual
rendered colors in both appearances, in addition to its unchanged work-opening
and read-only-history checks. All five groups pass; reviewed both card screenshots
and reran the two theme-switch journeys successfully.

### Profile sign-in handoff (September 23)

Once a profile's workspace is ready, AppShell keeps the connection screen mounted
while the login route redirects. It previously remounted the login page in that
interval, briefly showing its reset profile list. The registered `org-sign-in`
suite delays workspace reads and route responses and observes the full DOM
handoff for all four profiles. It reproduced the flash before the fix and passes
afterward, along with the existing failure/retry, org selection, profile switching,
reload and matching/mismatched saved-destination checks (six groups total).
TypeScript, changed-file lint and diff checks pass. Authentication, destination
selection and recovery behavior are retained; no existing test is removed. All
browser requests used fixtures rather than modifying live sessions.

### Publication review against main

Reviewed the final content against fetched main
`fdf1c85ab5826ccb4c2fe818ba0b26a746d79699`. No test files or registered browser
suites are removed.

| Affected behavior | Retention and replacement checks |
| --- | --- |
| Assessment and project creation | Adapted to the connected org, optional deployment target and dedicated project canvas; `org-assessment-scope`, `assessment-project-transition`, `project-creation` and `project-create-end-to-end` cover the new flow. Original findings and captured evidence remain. |
| ALM overview | Inline project content is replaced, as requested, by starter actions and a projects table; `alm-overview` checks opening the retained dedicated project canvas. |
| Build & Setup changes | Existing editors, generic work-item drafts and project transfer remain; `work-item-changes`, `permissions`, `org-setup` and existing transfer suites cover scoped autosave and undo. |
| Navigation and agent polling | Connected org and captured canvas scope are independent; existing isolation, history, progress and idle checks remain. Polling fixtures now include the required run context consumed by canvas-change refreshes. |
| Appearance and sign-in | The unused Help placeholder is replaced by the requested theme switch. `theme-switch`, `attention-scenarios` and `org-sign-in` cover appearance and the loading handoff; existing authentication and recovery checks remain. |
| Workspace reads | Batched record reads retain tenant/profile filtering, locking, ordering, quotas and response shape; application, agent and model database suites retain persistence and isolation coverage. |
