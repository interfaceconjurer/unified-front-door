# UI behavior and merge history

Assessed September 19, 2026 against the **current local worktree**, including the
Home, resource browsing, project isolation, and Today fixes. This assessment
covers the UI changes introduced by `f6313a2` and identifies the larger legacy
component tree separately. It is not a pixel comparison of every screen.

Updated September 20: all seven user-authorized restoration phases are
implemented, independently reviewed, and locally verified. The complete result
is ready for review and is being published on `org-exploration`; main and the
hosted deployment remain unchanged. See the
[phase ledger](ui-restoration-state.md) for decisions and exact evidence.

## Why merged work went missing

The earlier remote check found all 16 remote branch tips already in main's
ancestry; the worktree base was `d34da16`, matching remote main at that check.
Subsequent restoration is recorded below and in the phase ledger.

`f6313a2` (**Refine Today planning, project canvases, and workspace transitions**)
entered main through PR #14 at `4a81973`. Reconciliation merge `ad8cded` then
retained the durable architecture prototype, omitting parts of the planning UI.
Its parents are `fb63e63` and `4a81973`; PR #15 brought that result into main at
`d34da16`. An ancestor commit does not guarantee its behavior survived a merge.

The compact Today summary was a subsequent local change, not another missing
branch. It is now removed: historical Today uses the same layout with disabled
controls, static surface tiles, subdued colors, and no repeated entrance reveal.
Cards retain their borders and shape. This preserves the older layout contract
while following the latest request to keep the cards recognizable.

## Already restored or retained

| Behavior in the earlier UI | Current status |
| --- | --- |
| Project/worktree blur, independent conversations and drafts | Adapted through the current navigation controller and React view transitions; global Home participates too. |
| Today row reveal: 500ms with 75ms stagger | Restored. History is static and reduced motion skips it. Today now belongs only to global Home. |
| Historical Today retains its layout and becomes read-only | Restored in this change. The shared fieldset disables controls; surface links become static tiles. |
| Canvas-tab recede/land animation | Approved and restored through the current React navigation transitions. Only the canvas body animates; chat, composer, and tabs remain sharp. Project/Home dissolve takes precedence. |
| Plain agent replies and completion-timed suggestions | Approved and restored. User messages retain bubbles; agent prose is unframed. Suggestions wait for successful run completion, preserving streaming, status/recovery controls, and scroll following. |
| 1200px chat/composer width and panel-aware alignment | Approved and restored. Both center only when both panels are closed, otherwise align left. Geometry participates in the panel timeline; new turns use the configured scroll inset. |
| Project-scoped canvas tabs and retained drafts | Restored with captured project identities. Global browsing can display all projects. |
| Aligned 56px headers, inset canvas frame, shared canvas gutters | Restored. The main canvas layout and surface-to-surface swap already exist. |
| Broad top-bar navigator | Restored with the newer resource search, Home selection, and project/branch badge. |
| Current destination in the command palette; dismissal and panel motion | Retained. The newer project grouping also keeps the selected worktree attached to its parent. |
| Project introduction and separate project history | Implemented by server-owned visits. Projects resume their saved view; they do not receive Today cards. |
| Starter cards open their specific tool canvas and seed the composer | Adapted and verified through scoped capabilities without submitting. Agent, React app, pipeline, existing-project, and dedicated ALM project entry points are restored; phase 3 replaced the temporary work planner. |
| Dedicated assessment/scope/finding canvas in Govern & Observe | Adapted and verified using owned server snapshots and existing commands. Explicit run/finding views retain captured evidence; no-run overview follows latest. Sam has Govern access. Execution controls act only on the current run; historical views do not silently retarget model evidence. |
| New-project canvas in ALM and consistent empty-state actions | Adapted and verified through one shared capability. General profiles save truthful planning briefs; Sam's finding-backed drafts use existing acknowledged creation commands. Home/close retains drafts and captured findings; duplicate/edit and late-navigation guards preserve the current architecture. |
| Home planning stays in chat until an explicit navigation request | Adapted through `workspace-planner-v3`, completed durable history, current-request tool gating, and saved-catalog worker validation. Demo policy also uses explicit surface requests. Queued v1/v2 behavior is preserved. Ambiguous/content requests remain in chat. |
| Project-name links focus the selected project in the sidebar | Restored through shell presentation state: overview links open Projects, reveal/focus the parent, and retain the active worktree and destination. Top-bar project badge continues to open the palette. |
| Deployed-app operations move to ALM | Restored with legacy URL replacement and saved tab/draft/target compatibility. Original pending payloads, receipt hashes, and queued model catalogs remain unchanged; owned older work visits normalize at application boundaries. Release progress selects the actual Release plan. |
| Attention items across demo projects and worktrees | Restored hotfix review, Acme performance, and Acme release approval with consistent waiting sessions and scoped destinations. New Today captures show five attention items; historical snapshots and absolute timestamps remain unchanged. |

## Restoration outcome

“Restore” means adapt the behavior to current owners, rather than copy the old
browser-only implementation. The user-authorized swarm completed all seven
remaining behaviors sequentially; there are no pending phases in that scope.
See the [current-state ledger](ui-restoration-state.md) for architecture decisions,
review gates, and verification. No blanket merge or deployment was performed
during restoration. The separate legacy component tree below was not part of
this restoration.

## Keep the current architecture and newer decisions

- Keep server-owned conversations, agent runs, assessment findings, project
  commands, revision checks, and draft acknowledgements. The older
  `ConversationProvider`, local assessment persistence, and pre-publish callback
  are superseded by these owners.
- Keep explicit global/project/org identities. The old
  `adoptUnscopedCanvases(projectId)` assigned unowned tools to whichever project
  was active; that conflicts with intentional global drafts and current captured
  targets. Project filtering is already restored without reassignment.
- Keep global-only Today, org continuity, independent project/worktree resumption,
  resource search, and the newer Home behavior. Older project Today and navigation
  resets are superseded by the user's subsequent decisions.
- Keep current Basic Auth behavior. The development auth bypass in `f6313a2` is
  outside this UI restoration.

## Initial suggested restoration sequence

The user has since authorized the seven ordered phases in the
[current-state ledger](ui-restoration-state.md). That completed sequence supersedes
the grouping below, retained as the initial audit recommendation.

1. **Presentation:** canvas-tab motion, plain agent replies, suggestion timing,
   panel-aware chat alignment, and project-parent focus/highlighting.
2. **Creation:** direct starter launches, Govern assessment details, and the ALM
   project-creation canvas, integrated with existing commands and permissions.
3. **Navigation/data:** deployed-app operations in ALM and restored demo attention
   scenarios, including saved destination compatibility.
4. **Planning:** explicit navigation intent and the guided Home conversation,
   designed around the current agent provider and durable history.

These are reviewable groups with distinct checks; no blanket cherry-pick or
replacement of current persistence is recommended.

## Older component tree: a separate question

`f6313a2` also contains a legacy `components/canvas/` tree: metadata explorer,
resource builders, project provisioner/workspace, plus an older LeftNav/ChatPanel.
Those files were **not introduced by this commit**, and are not evidence that its
active AppShell used every old view. They need a separate reachable-flow audit
before being considered for restoration. The current Resources palette and org
resource canvases already cover part of that exploration experience.

## Verification and sources

The Today fix passes TypeScript, changed-source lint, and the Global Home and
session-chat browser suites in normal and reduced motion. Browser assertions
check preserved content, mounted fieldset identity, identical row dimensions at
the same width, disabled historical controls, static history, project/draft
restoration, and scrolling. All seven restoration phases are now locally
verified as described below. Starter launches
pass independent source review, 24 navigation/starter tests, seven focused
browser cases, TypeScript, and changed-source lint. The first-project canvas
upgrade was completed with phase 3 on September 20.

Govern assessment canvases pass independent review, 29 navigation tests, 48
model tests, 52 application/domain/onboarding/resource tests, six focused browser
checks, typecheck, lint, and worker build. Coverage includes pinned evidence after
reload/rescan, permission and expired-org handling, pause/resume, retry, and
missing-run fallback. The [phase ledger](ui-restoration-state.md) records ownership
and the exact acceptance scope.

ALM project creation passes independent review and 24 project/domain tests,
79 implementer-reported focused tests, typecheck, lint, worker build, and four
root browser groups. Those checks cover planning-brief persistence, captured
finding-backed creation, retained drafts, one created-project conversation,
pending edit/duplicate guards, and protection against late navigation.

Home planning passes independent review, 54 intent/model tests, four independent
byte-identical legacy v1/v2 request comparisons, all 22 mocked-model database
tests, and six browser navigation/replay cases with no page errors. No paid
live-model calls were used for this phase; this validates gating and execution
contracts rather than every possible model response. See [agent runtime](agent-runtime.md)
for the current planner and legacy-policy behavior.

Project overview links pass source review, typecheck, lint, and normal/reduced
motion browser groups covering sidebar visibility/filter/focus, retained worktree
and URL, keyboard re-open, and unchanged top-bar palette behavior. No page errors
were recorded.

The ALM app move passes independent review and 64 migration/navigation/domain/
application tests, 84 implementer-reported focused tests, typecheck, scoped lint,
and worker build. Root's 56-case database validation initially passed 55; the
remaining new test had an overbroad wrong-surface assertion that was corrected
to saved work and passed on rerun. Three focused migration browser groups passed
without errors. Compatibility evidence covers URLs, drafts/tabs, conflict
recovery, original receipt/payload identities, and queued model catalog bytes.

The final attention phase passes independent review, 52 conversation/domain/
navigation tests and a final 22-test domain rerun, 49 implementer-reported focused
tests, typecheck, lint, and worker build. Root database checks verify exactly five
attention items and one working agent on Home plus retained project behavior.
Three browser cases verify labels, scope, and immutable disabled historical Today.
The initial assumption that opening work makes no POST was corrected to allow
the existing empty-draft registration; historical snapshots are not rewritten.

Final Global Home acceptance passes all 12 groups in normal and reduced motion
without page errors; its old Build app-tab expectation was updated to ALM.
Whitespace checks pass. The runtime worker was reloaded after final changes,
temporary PostgreSQL was stopped, and the preview remains on port 3000.
Provider validation used mocks and no paid Anthropic calls. The phase counts
overlap and are not a distinct-test total. This is a local review handoff, not
deployment or exhaustive live-model validation.

Reproduce the comparison with:

```sh
git show --stat f6313a2
git diff f6313a2^ f6313a2 -- src/components src/lib/chat src/lib/surface-canvas src/lib/workspace
git show f6313a2:README.md
git show --no-patch ad8cded
git diff ad8cded^2 ad8cded -- src/components
```
