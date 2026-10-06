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
| P2 | Dependency refresh | Verify available versions/advisories from upstream, upgrade Node patch and React/TypeScript/tooling in compatible slices, and run the full release gate on the declared runtime. | Separate PR after compatibility inventory. |
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
| A5 | Retention deletes saved chats/projects with their namespace only when its latest session expired over 30 days ago; blocks active worker leases, handles stale statuses, deletes exact namespace dispatch slots and per-namespace budget rows, and preserves global budget reservations. The operator CLI defaults to dry run; a daily manual runbook is documented. Hosted automation is inactive pending a protected scheduler and exact-target dry-run verification. | Dry-run/report evidence; isolated PostgreSQL tests for eligibility, cascades, concurrency, repeatability and interruption. |
| A6 | No merged product behavior disappears without disposition; gate and PR evidence refer to the final source and current main. | Fetched-main SHA, final content diff and behavior map; required checks and reviewer approval. |

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
| Dependency upgrade | Check upstream release notes and lockfile/advisory paths. Read installed Next docs for affected APIs. Test Node runtime, TypeScript worker output, React UI and Playwright browser compatibility independently before combining upgrades. |
| Pagination | Measure `readWorkspace()` and response sizes at quota ceilings and plausible real workloads. Define stable ordering, cursor identity, concurrent-update behavior and authorization; add database/browser checks before replacing full snapshots. |
| Service/auth expansion | Require real-user identity, authorization, secret handling and Salesforce write policy before replacing the demo gate or adding live org operations. |

## Review loop record

The first logical commit, `02666ca` (`fix: require HTTPS for public production origin`), superseded an unpushed earlier candidate. That candidate passed 16/16 focused operations tests, but the reviewer found that `scripts/start.mjs` validated configuration before setting the effective production mode, so startup could bypass the guard when `NODE_ENV` was absent. The initial slice approval was withdrawn. After the correction and added runtime checks, the reviewer independently confirmed that web and worker startup both exit before spawning with an unset parent `NODE_ENV`, and **reapproved A4**. Full runtime smoke subsequently passed; its first invocation failed because the chosen temporary output directory did not yet exist. The full PR review remains pending.

The scribe will update this plan and [the audit](modernization-audit-2026-10-06.md) with final reviewer evidence and current-main retention dispositions before the PR is opened.
