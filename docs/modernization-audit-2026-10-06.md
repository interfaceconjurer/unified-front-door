# Current architecture audit

**Reviewed:** October 6, 2026. **Source snapshot:** `666793ebd5375dd5bae0bf1bafd863d2430cf088` before this PR's changes. This is the current assessment; [the September architecture review](architecture-review.md) and [its phase plan](architecture-plan.md) remain historical records of earlier code.

## Scope and method

The audit swarm divided the tracked repository into product/UI, state and domain, server/database/worker, and verification/operations/dependencies. The inventory covers 394 tracked files: 216 under `src`, 119 under `scripts`, nine SQL migrations, 34 under `docs`, plus deployment, configuration, and public assets. We traced the front door, shell, navigation, catalog, persisted state, command and session APIs, agent queue, production startup, migrations, browser registry, CI, and release/deploy scripts. We reviewed existing tests and documentation against the code. Findings below distinguish a source-demonstrated issue from a scaling hypothesis or choice that still needs measurement. The audit is a code review, not proof that every runtime path or hosted environment is defect-free.

The product remains a **demo**: Salesforce org data and metadata actions are simulated. Application work, assessment history, drafts, and conversations are persisted to Postgres; the separate worker advances agent runs. New environments use the demo agent unless explicitly configured for Anthropic. Those are deliberate product boundaries, not refactor defects.

## What is already sound

| Area | Verified strength |
| --- | --- |
| Ownership and writes | Session token lookup, namespace/profile scoping, revisioned commands, idempotent receipts, and transaction boundaries are present in `src/lib/server/`, `src/lib/application/`, and the SQL schema. |
| Data recovery | Local pending buffers, explicit legacy import, captured finding/project evidence, storage-failure handling, and saved-draft conflict paths have dedicated tests. |
| Agent execution | Web and worker are separate; durable runs have leases/fencing, cancellation, retry/reconciliation states, and bounded model requests. |
| UI composition | Catalogs and typed canvas identities provide an extension path; the shell preserves the conversation across routes; motion, idle, and draft behavior have browser checks. |
| Release controls | The shared browser registry feeds PR shards and the complete release gate. The gate checks merge integrity, tests, build, database journeys, browser behavior, performance, and exact-source deployment attestation. |
| Capacity boundaries | The demo enforces explicit count/byte ceilings in `src/lib/server/quota.ts` and pages rendered transcript entries. |

These strengths argue for targeted refactoring and measured evolution rather than a wholesale rewrite.

## Source-demonstrated findings

| ID | Finding and evidence | Effect | Disposition |
| --- | --- | --- | --- |
| F1 | Cross-project app and plan launchers construct a canvas through `openCanvas` in `WorkspacePanel.tsx` and `CommandPalette.tsx`; `NavigationProvider.tsx` rejects a canvas whose project differs from the current workspace through `canvasVisibleInWorkspace`. | A visible entry can fail to open until its project is selected separately. | Fix in this PR with one explicit project/canvas entry command; register browser behavior. |
| F2 | `Workbench.tsx` derives its identity label with `canvasTarget(input, currentWorkspaceTarget)`. Navigation carries a separate captured `canvasTarget` in `src/lib/navigation/model.ts`. | A view can show the current org instead of its captured org after context changes. The saved target must remain authoritative. | Fix in this PR; check cross-org and cross-project navigation. |
| F3 | `CommandPalette.tsx` nests an interactive button within each `role="option"` in a listbox. The [WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) does not support interactive descendants in options. | Assistive-technology focus and selection semantics can diverge from keyboard behavior. | Make each result one coherent accessible control and exercise keyboard/screen-reader-facing attributes. |
| F4 | `AppShell.tsx` owns the only `<main>` and marks it hidden/inert when the surface is closed; `src/app/page.tsx` returns `null`. | Home has no exposed main landmark. | Give Home an exposed main landmark without disturbing the persistent chat/surface layout. |
| F5 | `applicationOrigin()` accepts public `http:` in production. The session route therefore permits a nonsecure cookie for such an origin, and the worker wake path sends Basic Auth to the configured origin. | A production misconfiguration can carry credentials and sessions over cleartext HTTP. | Require HTTPS for non-loopback production origins and cover startup and request behavior. |
| F6 | `demo_sessions` records `expires_at`, but no scheduled namespace retention cleanup exists. Related rows remain after session expiry unless a test or manual reset removes them. | Demo data grows indefinitely and its retention is undefined. | Implement the user-selected policy: remove a demo namespace **30 days after its latest session expiry**, with dry run/reporting and isolated database tests. Never shorten this clock because a token is revoked; protect active worker leases, remove per-namespace budget rows and preserve global model budget accounting. A cleanup CLI needs a scheduler or operator runbook to enforce the cadence. |

F1–F5 are source-traced findings awaiting final browser/runtime verification in this PR. F6 is a confirmed absence and a new product policy, not an observed outage.

## Scaling risks and maintainability candidates

These are reasons to measure or make an explicit choice; they are not claims of current production failure.

| Area | Current evidence | Decision to make later |
| --- | --- | --- |
| Client payload and cache | `readWorkspace()` aggregates runs, findings, projects, items, canvases and imports into one snapshot; `DEMO_LIMITS.snapshotBytes` is 16 MiB. Browser rendering is paged in places, but the server response is still whole-workspace. | Measure payload size, hydration, query plans and task time at realistic p50/p95 sizes. Introduce cursor pagination and partial reads only when a budget is exceeded or a real non-demo scale target requires it. Preserve captured identities and conflict semantics. |
| Historical import | Legacy source/recovery and export allowances reach several MiB. Import keeps original source for safety. | Measure maximum accepted payload, browser memory, request duration and DB storage. Choose a bounded export/import protocol before increasing limits. Confirm no silent truncation or loss. |
| UI module size | `CommandPalette.tsx` is 623 lines, `AgentPanel.tsx` 460, `AppShell.tsx` 336; catalog, navigation and rendering concerns meet in these files. | Extract focused pure selectors/view models and presentation units when changing those flows. Keep one navigation authority and current behavior checks. File length alone is not a defect. |
| Client/server data work | `src/lib/application/client.ts` coordinates session adoption, import, pending commands and reconnect; `src/lib/server/repository.ts` rebuilds relationships from JSON aggregates. | Add profiling and contract-level checks before splitting APIs or persistence. Avoid two competing authorities for identity or write acknowledgement. |
| Type/runtime/toolchain | `tsconfig.json` is strict, but targets ES2017 and `@types/node` is `^20` while runtime is Node 22. CI uses PostgreSQL 17; hosted Neon verification is separately documented. | Upgrade in a dedicated compatibility PR after reading installed Next.js guides and running all gate stages. Align runtime types only after checking worker and Next compatibility. |
| Deployment model | A Heroku web process plus worker and PostgreSQL suits the demo; shared Basic Auth is a demo gate, not per-user product identity. | Require a product/security decision before multi-user access, real Salesforce writes, or a new service topology. Do not infer those needs from current module size. |

## Dependency and security snapshot

The lockfile at this review pins Next.js 16.3.8, React/React DOM 19.2.4, TypeScript 5.9.3, Playwright 1.63.0, PostgreSQL driver `pg` 8.23.0, SLDS 2.0.2, and ESLint 9.39.4. The app pins Node 22.23.2 in `.nvmrc` and `package.json`. [Next.js's September security release](https://nextjs.org/blog/september-2026-security-release) identifies 16.3.8 as the Active LTS patched line. The [React 19.3 release](https://react.dev/blog/2026/09/09/react-19-3), [Node 22.23.3 release](https://nodejs.org/en/blog/release/v22.23.3), and [TypeScript 6.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) show candidates newer than the locked versions. Playwright's [release notes](https://playwright.dev/docs/release-notes) describe the pinned 1.63 line. This is a dated comparison, not a claim that each dependency is on its latest published patch.

`npm audit --omit=dev --json` reported zero production advisories on October 6. Full `npm audit --json` reported five high entries along one development-only ESLint chain rooted in `braces@3.0.3`; the gate's existing narrow exception is documented in [Verification](verification.md). A complete `npm outdated` check from this sandbox was blocked by the registry network policy, so the audit has no reliable full-package upgrade matrix. Recheck registry metadata and advisories when preparing a dependency PR; do not auto-apply a downgrade suggested by an advisory without validating the Next/ESLint pair and release gate.

## Evidence boundary

This document does not replace the registered browser checks, database tests, isolated Neon evidence, performance measurements, or a final diff against freshly fetched `main`. [Modernization plan](modernization-plan-2026-10-06.md) defines those gates. Historical phase approvals describe their exact earlier revisions; they do not approve new code by inheritance.
