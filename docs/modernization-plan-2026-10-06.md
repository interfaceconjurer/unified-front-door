# Modernization plan

**Prepared:** October 6, 2026 from the [current architecture audit](modernization-audit-2026-10-06.md). This is the work plan for the present PR and future decisions. The historical [architecture plan](architecture-plan.md) records the earlier implementation phases.

## Direction

Keep the existing product and its scoped, durable architecture. Repair concrete entry, identity, accessibility, and transport issues first. Add the selected demo-data retention rule with observable, explicit execution safeguards. Use measured budgets before redesigning storage, import, rendering or deployment.

## Priority and action matrix

| Priority | Work | Scope and acceptance | Owner/gate |
| --- | --- | --- | --- |
| P0 | Cross-project app/plan entry | Open the intended project/worktree and canvas through one navigation operation; preserve captured org, back/forward behavior and existing project selection. Add registered browser checks. | Implementer; independent reviewer approves evidence. |
| P0 | Captured Workbench context | Display the view's captured target, including org and project/worktree, after current selection changes. Saved draft and URL identity remain stable. Add registered browser check. | Implementer; reviewer validates identity handling. |
| P0 | Palette and Home accessibility | A palette result has coherent focus/selection semantics; search keyboard actions, tabs, mouse choice and dialog close still work. Home exposes a main landmark while the surface is hidden. Add registered browser checks. | Implementer; reviewer checks semantics and regressions. |
| P0 | Production origin guard | Reject non-loopback `http:` origins in production before serving requests or sending wake credentials; retain documented local development behavior. Add configuration/runtime tests. | Implementer; reviewer checks both processes. |
| P1, same PR | Demo retention | User policy: delete a namespace and its saved chats/projects 30 days after its **latest** session expiry. Dry run/report candidate IDs, age and record counts. Execute in bounded transactions, rechecking session eligibility and excluding active worker leases. A stale active run status alone must not retain expired data forever. Remove only the deleted namespace's dispatch slots and per-namespace model budget rows; preserve global budget reservations. Test repeatability, partial failure, and concurrent renewal against isolated PostgreSQL. Document invocation, cadence and recovery. The operator CLI is manual until a protected hosted scheduler is separately configured and verified. | Implementer; reviewer examines exact SQL and test target before approval. |
| P1, same PR | Compatible runtime refresh | Pin the current Node 22 patch, React/React DOM with matching types, Node 22 types, and PostgreSQL driver patch; retain current supported Next and Playwright lines. Recheck the dependency audit and full gate on the declared runtime. | Separate reviewed commit in this PR. |
| P2 | Remaining toolchain refresh | Evaluate TypeScript 7, the large SLDS stylesheet jump, and ESLint/tooling updates in compatible slices with visual and runtime evidence. | Separate PR after compatibility inventory. |
| P2 | Payload/import limits | Establish reproducible maximum accepted import/export and snapshot measurements, then set budgets and profile the current path. | Measurement report precedes design choice. |
| P2 | Server pagination/partial reads | Consider only if measurements exceed agreed budgets or the product's usage model expands beyond demo limits. Define cursor and consistency semantics, then compare with bounded full snapshots. | Architecture decision record and migration plan. |
| P3 | UI/client module extraction | Split pure projection, command coordination and rendering at tested seams during feature work; remove duplication without changing scope or identities. | Feature-specific tests and final retention review. |

## Present PR acceptance

| ID | Required result | Evidence |
| --- | --- | --- |
| A1 | Cross-project app and plan links enter the intended scope in one action; captured target, Back and existing selection work. | Registered production browser journeys and navigation/domain checks. |
| A2 | Workbench identity uses the view's captured org/project/worktree after context switches. | Registered browser journey covering different orgs and projects. |
| A3 | Palette results expose coherent focus/selection semantics; Home has an exposed main landmark. | Source review plus registered keyboard and accessibility-facing browser checks. |
| A4 | Production rejects a public HTTP `APP_ORIGIN` before web/worker use while local development remains usable. | Operations/runtime checks and independent reviewer diff inspection. |
| A5 | Retention deletes saved chats/projects with their namespace only when its latest session expired at least 720 elapsed hours ago; blocks active worker leases, handles stale statuses, deletes exact namespace dispatch slots and per-namespace budget rows, and preserves global budget reservations. The operator CLI defaults to dry run; a daily manual runbook is documented. Hosted automation is inactive pending a protected scheduler and exact-target dry-run verification. | Dry-run/report evidence; isolated PostgreSQL tests for eligibility, cascades, concurrency, repeatability and interruption. |
| A6 | No merged product behavior disappears without disposition; gate and PR evidence refer to the final source and current main. | Fetched-main SHA, final content diff and behavior map; required checks and reviewer approval. |
| A7 | Compatible dependency refresh updates Node, React, `pg` and runtime types without introducing an unsupported major-version change. | Exact Node 22.23.3 install, lockfile/audit review, build, serial database suites, full browser/performance gate and reviewer approval. |

1. Fetch `origin`, record the current `main` SHA, and review the final **content diff** against it. For each affected feature and any removed test, record retained behavior, adapted replacement check, or explicit user-approved removal. No ancestry-only claim or `git merge -s ours` substitutes for this review.
2. Read the installed relevant Next.js 16.3 guides before changing framework code. Keep the single server-owned command boundary, durable acknowledgement, captured target, and current demo behavior.
3. Add each new UI behavior check to `scripts/browser/suites.mjs`, which drives both PR shards and the complete release gate. Update [Verification](verification.md)'s behavior map when checks are final. Run focused unit, browser, accessibility-facing, build/lint, and runtime checks for the touched areas.
4. Exercise retention against an explicitly isolated PostgreSQL target. Report candidates before deletion; assert live/recent/renewed sessions and active worker leases keep their namespace, stale active statuses do not block eligible cleanup, exact namespace dispatch slots and per-namespace budget rows are removed, global model budget counts remain unchanged, a namespace past the 30-day grace period is removed with its related rows, repeated execution is harmless, and interruptions remain reportable. Never run the cleanup against an unidentified shared target. Verify the scheduler or state that cleanup requires the documented operator runbook.
5. Run the applicable full gate and inspect failures, including dependency audit and browser performance. Record any environment-bound checks separately and state their limits. A green local suite alone is not evidence of feature retention or hosted behavior.
6. Iterate implementer → independent reviewer → scribe until the reviewer explicitly accepts the exact candidate and required criteria. Record findings, fixes and rerun evidence. Approval means the stated criteria passed at that revision; it is not a promise of zero defects.
7. Make logical commits, push the reviewed branch and open a PR with the current-main baseline, behavior disposition, test results and known limits. Do not merge or deploy as part of opening the PR.

## Decisions before larger rewrites

| Decision | Evidence required before implementation |
| --- | --- |
| Retention beyond the demo | Confirm legal/product retention and export requirements before applying the 30-day demo policy to any non-demo user or production integration. For this demo, the chosen policy uses the latest session expiry and a 30-day grace period. |
| Maximum import size | Measure accepted payload, parse/render memory, request duration, database row growth and export recovery on the current limits. Decide a hard maximum and failure message that preserves source bytes. |
| Performance budget | Set device/network/CPU profiles, p50/p95 targets for first usable view, typing latency, snapshot request and DB query, and compare them with the existing `scripts/browser/performance.mjs` protocol. Preserve exact fixture sizes and warm/cold conditions. |
| Further dependency upgrade | The current PR covers a compatible Node/React/driver/type slice. Before TypeScript 7 or the large SLDS update, resolve peer constraints, read installed Next guidance, and compare worker output plus full browser/visual results. |
| Pagination | Measure `readWorkspace()` and response sizes at quota ceilings and plausible real workloads. Define stable ordering, cursor identity, concurrent-update behavior and authorization; add database/browser checks before replacing full snapshots. |
| Service/auth expansion | Require real-user identity, authorization, secret handling and Salesforce write policy before replacing the demo gate or adding live org operations. |

## Review loop record

The first logical commit, `02666ca` (`fix: require HTTPS for public production origin`), superseded an unpushed earlier candidate. That candidate passed 16/16 focused operations tests, but the reviewer found that `scripts/start.mjs` validated configuration before setting the effective production mode, so startup could bypass the guard when `NODE_ENV` was absent. The initial slice approval was withdrawn. After the correction and added runtime checks, the reviewer independently confirmed that web and worker startup both exit before spawning with an unset parent `NODE_ENV`, and **reapproved A4**. Full runtime smoke subsequently passed; its first invocation failed because the chosen temporary output directory did not yet exist. The full PR review remains pending.

The reviewer approved A1–A3 on commit `97f4ded` after the new registered
cross-project suite passed three checks. An existing Home motion suite then
reproduced a test race: the next navigation began while the prior document
transition was active. It now waits for that transition to settle while keeping
both blur assertions; the focused Home suite passed 20 checks. All 48 registered
browser suites passed on the pre-refresh runtime.

The reviewer approved A5 on `40c344c` after migration 010, nine isolated
PostgreSQL 17 retention tests, a real CLI dry run and target-confirmation
smoke. That approval was temporarily withdrawn when final gate review found
the new SQL test would run among pure tests before migrations. Commit `b2b37da`
places it after migration and serializes it with the application SQL suite;
the reviewer reapproved A5. No production cleanup ran, and hosted scheduling
is inactive pending operator setup.

Commit `33481fb` updates Node 22.23.3, React/React DOM 19.3.0, `pg` 8.23.1,
and matching React/Node type packages. The reviewer approved its source and
lockfile diff. Clean install, dependency audit, lint, typecheck, production
build, 28 focused tests and 32 serial PostgreSQL tests passed on exact Node
22.23.3. A7 and final A6 approval await the full exact-revision gate.

## Current-main feature retention review

`origin/main` was fetched again on October 6 and remains
`666793ebd5375dd5bae0bf1bafd863d2430cf088`. The final content diff is
43 files with **no deleted file or test**. The table records affected behavior
against that fetched tree; the exact-version gate will verify the final source
revision after the documentation commit.

| Affected behavior | Disposition against current main | Verification |
| --- | --- | --- |
| Cross-project app and plan entry, selected worktree/org, global Home inspection, Back and saved drafts | Adapted so one action enters the intended scope or preserves global inspection; existing selected context and conversation are retained. | New registered `cross-project-accessibility.mjs`; existing `work-project-entry.mjs`, `project-surface-scope.mjs`, `global-home.mjs` and related navigation checks. |
| Workbench view identity | Adapted to display the captured target while retaining the URL and underlying saved canvas ownership. | New registered cross-project suite checks distinct selected/captured orgs and worktree identity; existing org/resource and tab suites pass. |
| Palette keyboard, mouse, tabs and dialog close; Home layout and motion | Adapted listbox option semantics and exposed Home main landmark; result locators updated without removing checks. | `cross-project-accessibility.mjs`, `unified-search.mjs`, `interactions.mjs`, `global-home.mjs`, `chat-layout.mjs` and the full 48-suite pre-refresh run. |
| Production web/worker startup, Basic Auth, local development | Retained with a public-origin HTTPS guard; loopback HTTP remains available for local work. | Operations tests and production runtime smoke, including unset parent `NODE_ENV`. |
| Session, workspace, chat/project persistence and worker/model accounting | Retained while adding the user-selected 720-hour deletion eligibility; active leases and later sessions prevent cleanup, and global reservations survive. | Nine isolated retention SQL tests, 32 serial application/retention tests after the driver refresh, CLI smoke, existing database/agent suites in the final gate. |
| Node/React/driver/toolchain and release checks | Retained with compatible pins and matching types; SQL suites now run after migrations in the shared gate. | Clean install, type/build/audit/focused checks on Node 22.23.3; full exact-revision gate pending. |

No feature or test is intentionally removed. Remaining measured scaling and
larger toolchain decisions are recorded above; they are not inferred feature
removals.
