# Manual testing before Phase 10

**Status:** Phase 10 remains paused for manual testing. The persistence UI fix
remains approved. The streaming follow-up is implemented and verified with a
real Anthropic call, backend tests, database tests, and browser regressions.
The independent reviewer approved the follow-up with zero open findings.
The updated local worker is running at <http://127.0.0.1:3000/>.

## Product UI

The user asked to remove developer import, recovery, and preserved-source
controls entirely. `ProfileProvider` no longer mounts those controls or the
legacy import block. There is no replacement menu, link, center, or notice.
The developer and assistant handle those operations outside the product UI.
Underlying data, persistence APIs, and safeguards remain unchanged; normal
loading and save/failure feedback remains available.

The original blocks appeared before the `100vh` application shell and pushed the
composer below the viewport. Browser checks now show login and Alex's workspace
without those controls, including when legacy records, a prior pending buffer,
and preserved imports exist. Stored bytes remain unchanged, application writes
are zero, and the header and composer fit the viewport. The independent reviewer
approved this UI checkpoint and the corresponding README corrections.

## Streaming responses

The user reported that the full agent response appeared only after a delay.
The provider request now uses `stream: true` and processes Anthropic text events
as they arrive, following the official
[streaming Messages protocol](https://platform.claude.com/docs/en/build-with-claude/streaming).

- The first available text is saved immediately; subsequent partial writes are
  serialized and coalesced at 500 ms. Each publication checks the session,
  workspace epoch, worker fence, and lease without releasing the active lease.
- The selected active chat reads scoped JSON progress immediately, then on a
  nonoverlapping 500 ms polling schedule. Full snapshots refresh every five
  seconds while progress reads are healthy, with a one-second fallback. There
  is no browser SSE connection. The follow-up below adds a bounded display buffer
  for text already received by the browser.
- Sequence-aware merging preserves newer text and retry state across progress
  reads and full snapshots. Growing responses follow the viewport while
  respecting manual scrolling; an explicit retry retains one response bubble.
- Cancellation or interruption retains saved partial text without marking it
  complete. Completion requires valid terminal provider metadata and usage.
  Existing cancellation, ownership, spending limits, and the prohibition on
  automatically repeating an uncertain paid request remain enforced.

Review also corrected late-fetch cleanup after abort. The parser now rejects
refusal or unsupported stop metadata immediately so later events cannot clear it.
Both corrections have independent regression coverage.

## Initial focused verification

| Check | Result |
| --- | --- |
| Provider, worker, context, and agent unit tests | 46 passed: 32 backend and 14 agent tests. |
| Actual Neon model database suite, simulated provider | 16 passed, including durable partial text with an exclusive retained lease and cancellation rejecting later stale publication. |
| Browser regressions | 33 groups across seven suites passed, with no browser errors. |
| Streaming browser behavior | Partial text before completion, cancellation, scroll behavior, partial reload persistence, and one-bubble explicit retry passed. These groups are included in the 33 above. |
| Persistence UI browser check | Login/workspace controls absent; original storage bytes unchanged; zero application writes; no browser errors; layout fits a 1,000-pixel viewport. |
| Static checks | Full TypeScript passed; repository ESLint had zero errors and one existing stylesheet warning in `layout.tsx`. |
| Worker build and restart | Passed; restarted at `2026-09-17T03:32:15.057Z`. Compiled output enables provider streaming and 500 ms progress updates. |
| Database cleanup and isolation | Zero remaining test namespaces, scopes, attempts, budgets, or dispatch slots; zero application attempts changed while the live worker was paused. |

Evidence is under `/tmp/ufd-manual-streaming/`: `candidate-streaming.json`,
`regression-*.json`, `browser-regressions.log`, `model-database.log`,
`cleanup.json`, and `build-worker.log`. The UI evidence and screenshots are under
`/tmp/ufd-manual-persistence/`. The reviewer independently checked the database,
browser, cleanup, and source-freeze evidence. Final documentation approval is
complete. Approval was recorded at `2026-09-17T03:34:32.973704+00:00` in
the [independent review approval](/tmp/ufd-manual-streaming-review-approval.json).

## Live streaming follow-up

The user reported clunky batches of multiple sentences, a response cut short, and
the status “The model returned an unsupported response.” The earlier approval
covered the focused checks above, including simulated provider traffic; it did
not establish compatibility through a new live Anthropic streaming call.

The reviewer confirmed that the parser rejected valid terminal variants described
by [Anthropic's SDK schema](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/resources/messages/messages.ts):
`delta.container: null` and nullable input/cache usage counters. The
[SDK accumulator](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/lib/MessageStream.ts)
updates those counters only when they are non-null. This establishes a
compatibility defect, but the exact failed event
from the reported live request has not been captured.

Separately, the coordinator inspected twelve durable partial commits roughly
550 ms apart over 10.5 seconds in the live run. Provider streaming was producing
partial output; the browser now smooths its visible delivery as described below.

The provider correction accepts a null container and retains known input/cache
counts when later usage fields are null. It still rejects non-null containers,
positive cache usage, and invalid numeric fields. The 1,024-token request cap is
unchanged. A known truncation is classified as incomplete, including when reported
usage exceeds the cap; an over-cap response reported as complete remains rejected.

Four pre-fix cases reproduced the valid-null rejection in
`/tmp/ufd-streaming-followup/provider-null-repro.log`. The corrected provider passes
23 focused tests, TypeScript, and targeted ESLint; test evidence is in
`/tmp/ufd-streaming-followup/provider-fixed.log`. These checks do not establish the
exact cause of the earlier live failure. Final verification of the corrections
is recorded below.

The worker correction preserves the latest validated text tail in the same fenced
transaction that records a provider failure. Cancellation, ownership loss,
deadline, shutdown, or uncertain progress do not trigger an extra tail write.
If that write is rejected or fails, the worker does not continue publication or
dispatch another request. The implementer reports 15 worker tests passing and
43 combined provider/worker/context tests passing, with TypeScript, targeted
ESLint, and diff checks also passing. Evidence is in
`/tmp/ufd-streaming-followup/worker-tail.log` and `backend-final.log`.

The reviewer independently passed the overlapping 38 provider/worker tests in
`/tmp/ufd-streaming-followup/provider-worker-reviewer.log` and accepted that source.
The browser correction smooths only already-received active prefixes over at
most 450 ms; durable text is unchanged. A queued-scroll race was corrected using
the paused scroll position, with forward-only resumption. The final browser
regression passes 37 checks across seven suites with no errors, including eight
streaming groups. Those cover deliberate scroll-back-down resumption and
cancellation during a normal-motion display backlog with immediate flush and no
later animation frames. Evidence is in
`/tmp/ufd-streaming-followup/candidate*.json`. Targeted ESLint and TypeScript also
pass on the final browser source.

**Controlled live verification passed:** one actual Anthropic dispatch completed
with `container: null` and `end_turn`, 596 input tokens, and 391 output tokens.
The run produced nine durable progress events and 170 distinct visible browser
prefixes, with exact response restoration after reload. Its estimated usage cost
was **$0.005102**. Cleanup completed, while real global budget accounting remained
preserved. Evidence: `.release/model-live-streaming-followup/result.json`.

The verification budget guard accounted for $2.032352 from prior known usage and
the unresolved cancelled-call reserve, plus a $2.02 reservation for the new call:
**$4.052352**, within the user's $5 authorization. This is reserved exposure, not
an exact total charge. The original ledger remains unchanged.

### Final follow-up verification

| Check | Result |
| --- | --- |
| Provider, worker, and context tests | 43 passed; the reviewer separately passed the overlapping 38 provider/worker tests. |
| Actual Neon database tests with a simulated provider | 17 passed, including a PostgreSQL transaction check proving the final buffered text and failed status commit together. |
| Browser regressions | 37 checks across seven suites passed; eight cover streaming, cancellation during a display backlog, reload, and scroll interruption/resumption. |
| Static checks and worker build | TypeScript, targeted ESLint, diff checks, and worker compilation passed. |
| Controlled live call | One completed Anthropic reply, nine durable progress events, 170 visible prefixes, and exact reload restoration. |
| Cleanup | Zero remaining test namespaces, scopes, attempts, budgets, or dispatch slots; live-probe namespace removed; application budget accounting preserved. |
| Local runtime | Worker started at `2026-09-17T03:59:01.586Z`; exactly one worktree worker confirmed; Mac forwarding remains `http://127.0.0.1:3000/`. |

Final evidence is in `/tmp/ufd-streaming-followup/`: `backend-final.log`,
`model-database.log`, `candidate-*.json`, `cleanup.json`, and `runtime.json`.
The earlier scroll-race failure is retained in `scroll-race-before-fix.json`;
the final browser run includes its correction. The independent reviewer approved
the final implementation and documentation with zero open findings at
`2026-09-17T04:08:10.126558+00:00`. See the
[approval record](/tmp/ufd-streaming-followup/review-approval.json).

The controlled live result proves compatibility for that call;
it does not recover the exact failed event from the user's earlier request.

## Clear data from login

The user explicitly requested **Clear data** beside each of the four login
profiles and chose restoration of the original demo starting state. This is a
specific addition to the earlier product UI decision. A confirmation names the
profile and defaults to **Cancel**. Confirming clears that profile's saved chats,
assessments, projects, and drafts in the current browser namespace and restores
starter demo fixtures. The page remains on login; other profiles and any other
selected profile's active work remain intact. Original browser import sources
and provider spending/dispatch accounting are preserved.

A retained command identifier supports explicit retry after a lost response or
reload without repeating a completed reset. Retry requires confirmation; page
load and sign-in never trigger a reset. Resetting the currently selected profile
renews its generation and workspace epoch to exclude stale writes and workers.

Validation passed: **5 client tests**, **5 focused database tests** (four new
cases plus the existing session-expiry case), and **4 browser groups** with no
browser errors. TypeScript, targeted ESLint, and worker build passed. Evidence is under
`/tmp/ufd-profile-reset/`: `client-tests.log`, `database.log`,
`database-other-profile.log`, `candidate-profile-reset.json`, and `cleanup.json`.
Cleanup confirms zero owned test rows. Tests used isolated fixtures; no actual
user data was cleared, no paid provider calls were made, and no deployment ran.
The worker restarted at `2026-09-17T13:38:08.236Z`; the local preview remains
<http://127.0.0.1:3000/>. The independent reviewer approved the implementation
and documentation with zero open findings at `2026-09-17T13:40:20.898376+00:00`;
see the [approval record](/tmp/ufd-profile-reset/review-approval.json).
Phase 10 remains paused for manual testing.

## Limits and release evidence

The initial automated provider verification used simulated traffic and added no
paid API call. The live worker was paused before database checks so it could not
claim simulated test runs. The reopened investigation adds the single controlled
live dispatch recorded above, within the existing verification authorization.

The [Phase 9 journal](phases/phase-9-operations.md) and its artifacts remain
historical evidence for the source approved in that phase. These later changes
have focused checks, but the full release gate has not been rerun. A hosted
release requires fresh verification of the final committed source; no deployment
or hosted acceptance is claimed here.
