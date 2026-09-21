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

## Day Zero assessment startup with older browser data

September 17, 2026: Sam's assessment could remain idle while the card displayed
**Analyzing**. The automatic runner still waited for a legacy-browser import
decision after those developer controls had been removed from the product UI.
An old assessment or canvas record therefore prevented any execution job from
being queued.

The runner now starts from the saved server workspace independently of optional
legacy imports. Original browser bytes remain untouched; no import is performed.
An idle assessment displays **Ready to start** with a **Start assessment** action.
Paused and completed assessments retain their existing lifecycle behavior.

Reproduced against the local development app: a clean browser completed, while
a browser with an older assessment record remained idle with no queued job.
After the fix, both isolated browser sessions completed through the running
worker with no browser errors, and their test namespaces were removed. The
user's existing assessment also reached step 5 / complete after hot reload.

The new `scripts/browser/assessment-startup.mjs` suite passes six checks covering
older assessment records, canvas records, unreadable source bytes, preserved
sources, pause/resume, and reload behavior. It is included in `test:browser`.
TypeScript passed; lint passed with the existing stylesheet warning in
`src/app/layout.tsx`. These were focused development checks; no paid model calls
or deployment were performed.

## Project preview

As Alex, select Trailblazer CRM's lead-routing worktree and click **Preview** in
the top bar. Check the branch and target org above the sample CRM. Route a sample
lead, reset the demo, switch between Desktop/Mobile, and open the preview in a new
tab. Reload should retain the preview target. Switch to Acme Storefront to try its
shopping bag and confirm the Trailblazer preview tab is hidden.

From global Today, open the lead-routing approval, then **Preview** in its Work
context. Home must stay selected and the global org must stay unchanged while the
preview displays the worktree's captured org. **Open worktree** explicitly enters
that worktree; Back returns to global inspection. These are sample experiences,
not live builds or org updates. Automated: `scripts/browser/project-preview.mjs`.

## Org resources and visible project scope

The search launcher and ⌘⇧P / Ctrl+Shift+P now start on **All**. Type Account,
lead routing, Code, a project name, or an org name without choosing a category.
Check that exact names rank first, worktrees remain attached to their projects,
and each result identifies its type and owning context. Enter on a matching
worktree should enter that worktree, not its parent branch. Surface/resource
selection must preserve the current project; project/session selection explicitly
enters the chosen context. The All org pill opens Orgs with an empty query,
without closing the navigator or changing workspace context. Resource org
filtering within Resources must not navigate until a result is opened. Category
tabs retain the query; All ignores a Resources-only type filter. Clear search
restores the current tab's results, retains org/type filters, and focuses the
input. With no org selected, the pill prompts the user to choose an org.
Automated: `scripts/browser/unified-search.mjs`, `interactions.mjs`,
`org-resources.mjs`, and `scripts/palette-search.test.mjs`.

September 18, 2026: Added a Resources tab to the command palette with connected-org
selection, resource-type filtering, and search across 25 metadata types. Resource
canvases show demo details and related resources in Build & Setup, Code, or
Govern & Observe. Their identities capture org, type, API name, and project/branch
when present; tab titles
include the org. Browsing metadata persists local tab preferences and does not
create server-owned editable drafts.

The top bar now has a wide search launcher and a clickable project badge showing
the current project and branch. The badge opens Projects and follows navigation,
Back, and reload. Opening resources preserves project/branch scope. A Home icon
to the badge's left explicitly returns to the global front door and clears the
project and branch selection while retaining the org. On mobile, the search launcher uses a second row.

Verified against the local preview with isolated browser API fixtures:

- `scripts/browser/org-resources.mjs`: org/type/API-name search, unavailable and
  empty results, keyboard scrolling, related-resource routing, profile access,
  reload/Back, tab deduplication, close/reopen, distinct org tabs, no resource
  draft writes, project switching, and desktop/mobile layout.
- Existing `modal-working`, `interactions`, and `timestamps` browser suites:
  normal/reduced motion, native-dialog focus containment/restoration, keyboard
  tabs, dismissal/reopening, composer preservation, and captured timestamps.
- 96 tests across resource, navigation, application, domain, persistence, and
  client reliability suites; TypeScript passed. Lint has only the existing
  stylesheet warning in `src/app/layout.tsx`.

Manual review path: **Search workspace → Resources → choose an org**, then try
`Lead_Routing`, `Project__c`, or a permission set. Select a result and follow a
related-resource link. Use Alex's profile to review the top-bar project badge
and switch projects or branches. The catalog remains demo metadata; live org
discovery and editing are not part of this change.

Follow-up scope fix: 24 focused resource/navigation tests, TypeScript, and lint
for changed files passed. The resource browser suite verifies project/branch
preservation through resource and related-resource navigation, reload, and Back;
Home clears project scope, retains the org, and survives reload; switching surfaces afterward stays global;
opening the same resource globally and within a project keeps their scopes distinct.

## Chat transition latency

- While a conversation loads or updates, its status should appear immediately
  after **Agent**, with a visible spinner. The surface badge stays right-aligned.
  Verify long-wait/reconnect feedback, clearing after completion, a narrow header,
  and a static indicator under reduced motion. Automated: `scripts/browser/chat-latency.mjs`.

- In Trailblazer CRM/main, Code should show the handler and toolkit, with no
  embedded Agent sessions rail or hotfix files. Select hotfix/W-9821 explicitly
  in the global navigator: its tests should replace the main work list and tabs.
  Close/reopen and return to main; each worktree's drafts should remain intact.
  In ALM, open a deployed app: the selected worktree must remain selected through
  reload, surface switching, and close. Global Home retains its aggregate view.
  Automated: `scripts/browser/project-surface-scope.mjs`, `global-home.mjs`.

- With another canvas open, click the pinned surface tab's name: it should open
  the surface overview without a dropdown and preserve scope and drafts. Tab from
  the overview tab to the separate chevron; Enter opens the surface menu.
  Clicking the chevron while another canvas is selected must leave it selected.
  The dropdown should mark the current surface and offer the profile's accessible
  surfaces. Switch across
  Build & Setup, Code, Govern & Observe, and ALM; return to confirm the last canvas
  and drafts remain. Repeat from global Home and a project/worktree with an org
  selected: switching surfaces must preserve that scope. Choose the current
  surface to reach its overview. Escape, Tab, and outside clicks dismiss without
  navigating; Up/Down and Home/End move within the menu. Check a narrow viewport.
  Automated: `scripts/browser/surface-switcher.mjs`.

- On a wide screen, close both panels: transcript and composer center with a
  1200px width cap. Open either panel: both left-align in the remaining chat area.
  Width and margin changes animate together; keyboard toggles retain composer
  focus, selection, and draft. Check both panels, mobile width, and reduced motion.
  With a surface canvas open, continuously resize the window in both directions,
  including across 900px and with the workspace sidebar open. Chat and composer
  should follow the available width immediately without lagging or overshooting.
  Panel toggles should still animate after resizing.
  Automated: `scripts/browser/chat-layout.mjs` and `scripts/browser/session-chat.mjs`.
- Agent replies should be plain text while user messages retain bubbles.
  Suggested prompts stay hidden during pending/running/streaming replies and
  appear after successful completion. Cancelled/failed replies keep recovery
  controls. Long replies follow into view until you scroll up; scrolling back
  down resumes following. Automated: `scripts/browser/streaming.mjs`.
- Canvas tab motion: switch between two canvases in one surface. Only the canvas
  body should recede/blur and land; tabs, chat, and composer remain stationary.
  The current tab is a no-op. Try rapid arrows, Home/End, Delete during motion,
  and browser Back. Selection/focus should agree and drafts remain intact.
  Reduced motion skips the effect. Automated: `scripts/browser/canvas-motion.mjs`.
- Navigate between surfaces while keeping text in the composer. The Agent header
  should show **Updating conversation…** while the visit is pending, without hiding
  the current transcript or losing the draft.
- With a delayed response, expect **Still updating…** after five seconds. A
  transient interruption shows **Reconnecting…** until automatic recovery succeeds.
- New entries become visible during scrolling, and the status clears when the
  transition finishes. Reduced motion skips movement and retains the same feedback.
- Rapid navigation should finish at the latest destination without replaying every
  unsent intermediate visit. Submitted messages and explicit work actions retain
  their captured context and ordering.
- Automated check: `scripts/browser/chat-latency.mjs`. See the
  [integrity and latency review](chat-performance-review.md) for the database changes
  and bounded performance measurements.

## Global Today and project resumption

- Open `/` as Alex. The top bar should have no selected project. Today should
  show both the lead-routing approval and integration-access review before recent
  work, including work from Acme Storefront and Trailblazer CRM with branch labels.
- Today should reveal from top to bottom: welcome lines, attention, surfaces,
  then recent-work rows. Return Home to check the reveal follows the page dissolve.
  New-user starter cards also reveal in order. Reduced motion shows content
  immediately; historical summaries remain static and the console stays clean.
- Open a project/worktree, select a resource canvas, and leave an unsent message.
  Go Home and reopen the same project/worktree: its canvas, org, conversation and
  draft should return, without a new Today card or greeting.
- From Home, leave a composer draft, then open an Account resource in Production.
  Today should retain its headings, cards, surface tiles, and recent-work rows.
  Controls become disabled and tiles have no links; the muted briefing stays
  recognizable as the transcript continues below it with the target org and
  surface context. Keyboard navigation must skip its disabled actions.
  Switch to UAT through Orgs: the same conversation and draft should remain, with
  a new target-org marker. Home should retain UAT and show one active Today card.
- If earlier org-specific chats exist, expand **Earlier conversation** to read
  their retained messages. New messages belong to the continuous global thread.
- In global context, Home should be blue, including while browsing a surface.
  Clicking it on active Today should send no request or navigation. Returning
  from a surface or project should close the surface and append one new Today.
- In Trailblazer, open Build & Setup and Lead routing assistant. Acme Storefront
  must not appear among the tabs. Leave a notes draft, visit Home, and open Account
  from Resources. Select Lead routing assistant: Home stays blue, no project badge
  appears, the org and global chat stay selected, and the canvas still shows
  Trailblazer CRM. Editing notes must save to that same project-owned file.
  In global ALM, open Acme Storefront and Lead routing → UAT: both projects' tabs
  remain visible, including after reload and Back/Forward. Explicitly select
  Trailblazer in Projects or the sidebar; its notes and last project view remain.
  Closing its active tab must
  select a neighbor within Trailblazer.
- Once Today becomes history, backgrounds, shadows, and visible borders disappear
  from its cards, tiles, badges, and recent-work list. Text, spacing, and layout
  remain recognizable; controls remain disabled. A new active Today retains its
  normal containers.
- Reload Home and reopen the project to verify the remembered destination. Switch
  worktrees and use browser Back; each line of work should keep its own view.
- With normal motion, switch projects/worktrees and navigate to/from global Home:
  the conversation and canvas should blur out and resolve into the incoming view
  over 500ms. The composer stays mounted and sharp. Org-only changes should not
  dissolve the conversation; reduced motion should skip the effect entirely.
- Create a planning project from Sam's assessment. Its first chat entry should
  identify the project and next planning step, without claiming a GitHub sync.
- Automated checks: `scripts/browser/global-home.mjs` covers both motion modes;
  navigation, conversation and agent database tests cover persistence, aggregation,
  profile isolation, and the one-time project introduction.

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
