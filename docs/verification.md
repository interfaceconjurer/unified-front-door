# Verification

[← README](../README.md)

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
| Four expansion scenarios: sample work, Today, palette, resource access, surface switcher and blocked direct routes; old assessment links/tabs and live Today compatibility | `expansion-profiles.mjs`, `assessment-canvas.mjs`, `org-sign-in.mjs` | `demo-profiles.test.mjs`, `assessment-canvas.test.mjs` |
| All profiles choose a connected org at sign-in; required choice, retry, first agent target, reload, profile switching, matching saved links and mobile layout | `org-sign-in.mjs`, `profile-reset.mjs` | `navigation.test.mjs`, `profile-reset.test.mjs` |
| Sign-out and profile changes have one navigation owner; session/workspace outages show loading or retry UI; slow reads cannot be starved by polling; stale reads cannot restore or bootstrap an old session | `session-recovery.mjs`, `org-sign-in.mjs`, `profile-reset.mjs` | `profile-reset.test.mjs`, `client-reliability.test.mjs` |
| Every fresh/cleared profile starts on centered Today with no panels; used profiles restore canvas and panel choices across reload, sign-in and profile switching; explicit links/changed orgs take precedence | `profile-start.mjs`, `org-sign-in.mjs`, `chat-layout.mjs` | `navigation.test.mjs`, `persistence.test.mjs` |
| Starter cards open scoped canvases and seed without submitting | `starter-canvases.mjs` | `starters.test.mjs` |
| Assessment scope, captured findings, rescan and retry | `assessment-canvas.mjs` | `assessment-canvas.test.mjs` |
| Project templates, saved intent, brief-to-project creation on all profiles, visible creation action, explicit scoped planning action with retained composer draft, sidebar/reload/reopen, second project, delayed navigation, retry recovery and assessment creation | `project-creation.mjs`, `project-create-end-to-end.mjs`; `project-create-database.mjs` in the database browser gate | `project-creation.test.mjs`, `database.test.mjs` (atomic creation, ownership, duplicate retries), `model-context.test.mjs` |
| Clear data deletes brief-created projects without assessment runs, including after sign-in/reload; other profiles/namespaces and projects created after an acknowledged reset survive retry | `profile-reset.mjs`; `project-create-database.mjs` in the database browser gate | `database.test.mjs` (direct workspace ownership, scoped reset, rollback, receipt replay and all-profile reset) |
| Planning stays in chat; explicit agent navigation preserves scope and ignores stale handoffs | `agent-navigation.mjs` (handoffs) | `navigation-intent.test.mjs`, model context/provider/worker tests (no-tool planning and saved-catalog validation) |
| Project links reveal the sidebar parent without changing scope; persistent Start project footer on all profiles; Sessions only lists chats | `project-panel.mjs` | Navigation tests |
| Project/worktree explorer drill-down and double-click, folders/search, keyboard file opening in scoped surfaces, return focus, saved `.project` context and work items, downloads, reload, deletion, narrow layout and no file writes | `project-explorer.mjs` | `project-explorer.test.mjs` (profile/branch isolation, inherited base files, portable context, identity, availability and mutation rejection); `model-context.test.mjs` (agent intent/evidence) |
| Default All navigator search, projects/resources/sessions/orgs/surfaces ordering with ranked matches within each category, ALM project-file results with preserved global/workspace scope, explicit Projects-tab entry with intact worktree trees, org pill/category filters, clear search and restricted profiles | `unified-search.mjs`, `interactions.mjs`, `org-resources.mjs` | `palette-search.test.mjs`, `navigation.test.mjs` |
| Build & Setup org browsers: objects, permissions and features; explicit org, captured tabs, global/project scope, no draft writes, all profiles and narrow/light layout | `org-setup.mjs`, `org-resources.mjs` | `org-resources.test.mjs` |
| Independent Home/project/worktree tab sets and active tabs; reload/close isolation, legacy preference migration, explicit global inspection with shared draft ownership | `workspace-tabs.mjs`, `global-home.mjs`, `project-surface-scope.mjs` | `navigation.test.mjs`, `client-reliability.test.mjs` |
| Deployed apps open in ALM; legacy URLs and drafts survive | `alm-app-migration.mjs` | `alm-app-migration.test.mjs` |
| Project preview launch, captured worktree/org, global inspection and explicit entry, sample interactions, responsive viewer, new tab and reload | `project-preview.mjs` | `navigation.test.mjs` (scope, identity, availability and mutation rejection) |
| Attention cards reach the correct work and retain historical Today | `attention-scenarios.mjs` | Domain and conversation tests |
| Work canvases distinguish type, project, worktree and branch; explicit global entry retains the current canvas, captured target, draft and history | `work-project-entry.mjs` | Navigation tests |
| Global file browsing preserves chat/org and file ownership; only explicit project actions enter a project | `global-home.mjs`, `attention-scenarios.mjs` | Navigation and agent database tests |
| Today keeps its active appearance until it scrolls offscreen, including interrupted scrolling and reduced motion; history retains faint container fills/outlines, layout and disabled controls in light and dark themes | `today-departure.mjs`, `global-home.mjs` | — |
| Home reuses trailing Today after project activity, including the first return carrying a different org; explicit org selections stay logged and intervening global content earns one new card | `global-home.mjs` | `conversation.test.mjs`, `agent-database.test.mjs` |
| Today surface links do not replay their reveal on focus changes; surface entry and global surface-to-Today preserve sharp chat, while project/worktree/global context changes retain the dissolve | `today-departure.mjs`, `global-home.mjs` | — |
| Instant same-surface canvas/overview selection and closing, rapid keyboard/focus and retained drafts; whole-surface transitions and reduced motion | `canvas-motion.mjs` | Navigation tests |
| Surface label opens overview; separate chevron opens dropdown; keyboard/dismissal, profile access, scoped canvas restoration | `surface-switcher.mjs` | Navigation tests |
| Project/worktree-contained work lists and tabs; project-wide app ownership; global navigation | `project-surface-scope.mjs`, `global-home.mjs` | Navigation tests |
| Chat activity beside Agent, spinner/reduced motion, narrow layout and request recovery | `chat-latency.mjs` | Client reliability tests |
| Chat/composer alignment, immediate live resize across breakpoints, panel motion, reply presentation and reveal timing | `chat-layout.mjs` | Conversation tests |

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
