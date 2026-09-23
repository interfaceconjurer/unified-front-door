# Agent conversations and execution

[← README](../README.md)

See [worker idle behavior](worker-idle.md) for HTTP activity hints, hourly durable
recovery, browser inactivity, measurements and Neon suspension tradeoffs.

The default agent uses fixture-backed demo behavior. Typed contracts in
`src/lib/agent/contracts.ts` separate submission, observation, cancellation, and
retry from React rendering. `demo.ts` owns reply/recommendation policy, assessment
fixture interpretation, and simulated progress. Tests inject delayed, failing, and
alternate-policy adapters through these same contracts; the HTTP API cannot select
a test adapter or enable an unconfigured real provider.

The optional Phase 8 Anthropic path explains captured findings and proposes a
plan and can open existing surfaces and canvases through scoped navigation tools.
It has no private-org access or tools for modifying workspace data. The server
captures the provider policy, owned project or completed assessment evidence, and
acknowledged conversation history when accepting a message. Standalone findings
follow the selected org; a project's own findings can originate in production
even when its destination is a sandbox. Captured source/target provenance keeps
that distinction explicit. History must match the captured target and workspace
epoch. Local database and actual-provider acceptance pass; Phase 8 is independently
approved. See the [Phase 8 journal](../docs/phases/phase-8-real-agent.md).

The current `workspace-planner-v3` policy keeps planning in the existing
conversation, building on completed history and asking focused questions about
the goal, audience, success criteria, or constraints only when useful context is
missing. Discussing code, releases, or permissions does not itself navigate. The
server only captures navigation tools when the current request explicitly asks
to open or view a destination. The bounded intent detector leaves ambiguous
follow-ups, deferred navigation, quoted examples, and content requests in chat.
The demo policy likewise requires an explicit surface request instead of routing
from topic keywords. No second client-side planner is introduced.

When available, `open_surface` and `open_canvas` select a server-captured
destination ID. The catalog contains allowed surface overviews, capability
canvases, selected-org demo resources, and work in the current project/worktree.
It uses the same capability definitions as the UI. The model cannot supply URLs,
change project scope, or invent resources. Queued `workspace-explainer-v1`
requests retain their text-only contract; queued `workspace-navigator-v2`
requests retain their prior navigation policy and serialized provider requests.

These tools are terminal UI handoffs: one provider request may return text and at
most one navigation action. Tool JSON is assembled privately and validated only
after the complete response, usage and stop reason arrive. The worker verifies the
action against its captured context and the saved request catalog, then saves it with the completed reply under
the existing lease and transaction. No extra model request or database migration
is needed. Failure, cancellation or an incomplete stream cannot publish an action.

A completion automatically opens only for a submit/retry issued by this mounted
browser view, while its original navigation intent and target remain current.
A later navigation wins. History and reload never replay automatic navigation;
the persisted **Open** button remains available. It uses the normal navigation
controller and tab limits, and cannot leave a different project/worktree. Opening
a saved action explicitly can restore its captured org within the same thread.
This navigates the prototype's existing canvases; it does not inspect a live org.

The v3 planning/navigation change passed focused intent/provider/worker tests,
the mocked-model database suite, and browser navigation/replay checks. Four
pre-change v1/v2 requests were independently compared byte for byte. This
validation did not include a paid live-model call; the deterministic gate and
durable execution checks do not establish the quality of every model reply.

Protocol references: [Anthropic tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls),
[streaming tool input](https://platform.claude.com/docs/en/build-with-claude/streaming),
and [single-call control](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use).
A handoff ends this model turn; later conversation history carries its text, not
an unfinished tool-use/tool-result exchange.

Each submitted message captures its project, worktree, org, surface, and a
server-validated snapshot. Navigation cannot retarget accepted work. Conversations
are shared by each project's worktree thread across its surfaces. Global browsing
uses one thread across orgs, recording target-org changes in the transcript.
Each accepted command and its model evidence remain scoped to its captured target.
Today/visit entries are server-derived,
and historical briefings keep their captured content. Presentation state such as
scroll position and reveal animations remains local. Reload restores the message
and history page last being read in this tab; a chat without a saved position
opens at its latest turn. Positions are isolated by profile and workspace epoch.

An acknowledged request saves the user message, response placeholder, run, and
receipt in one transaction. Conversation/turn/run/result history survives reload,
browser closure, and web or worker process restart while its demo namespace and
records remain available. One active reply per conversation returns an explicit
busy response to another submission. Each retry gets a new run ID for the same
logical turn; ordered events retain their run identity and sequence.

The UI shows waiting, preparing, replying, completed, failed, and cancelled states.
Use **Cancel reply** to stop further publication, or **Retry reply** for an eligible
cancelled/failed attempt. **Retry message**, shown inside the composer only for
a user request that needs attention, confirms an uncertain HTTP result using
the original request ID, payload, and captured scope; a changed payload cannot
reuse that identity. Submitted request recovery uses this tab's session storage,
separate from unsent composer text. If browser recovery storage is unavailable,
unconfirmed requests may exist only in memory; keep that tab open until confirmed.

Background navigation requests recover automatically using their original IDs;
they never start model work. Connection diagnostics remain in the server logs
and do not render above the app shell or as a persistent composer banner.

If a saved request cannot be parsed, **Recover a saved message** in the composer
offers **Download saved message** to preserve its original text.
**Remove saved message** removes only the exact version displayed for
recovery; changed stored content is preserved for another review. A recovered
connection clears its read error, while a definite request rejection keeps the
composer draft available for correction.

Postgres-backed workers claim execution independently of browser tabs. Demo
execution uses a 10-second lease
and a monotonically increasing fence to reject stale worker results; an interrupted
attempt allows at most three automatic expired-lease recoveries before an explicit
retry is required. Steps use committed checkpoints. Assessment pause/resume keeps
the logical finding run while replacing the execution attempt; rescan starts a
new finding run and preserves older evidence. HTTP reads and browser timers cannot
advance an assessment. Switching persona/signing out cancels prior-generation
active work; reset removes the selected profile's owned history/jobs. Ordinary
navigation leaves work attached to its captured context.

The optional model path uses a 30-second lease, renewed every 5 seconds, with a
60-second provider deadline. A durable intent and allowance reservation precede
the HTTP request. An uncertain paid attempt is not automatically sent again;
an explicit retry creates a new attempt and can incur another charge. Cancellation
fences publication and requests transport abort, but cannot guarantee the remote
provider stopped or incurred no charge. Two durable dispatch slots bound local
dispatch reservations; uncertain/cancelled calls retain their full 60-second slot.
Daily defaults are 10 application-wide attempts and 5 per namespace, preserved
across namespace resets. These are attempt limits, not a dollar-denominated cap.
The request is limited to 32 KiB including its full provider envelope, output to
1,024 tokens, and automatic provider retries are disabled.

Provider text now streams into durable partial responses: the first text is saved
immediately, followed by coalesced updates at 500 ms. The selected active chat
observes scoped JSON progress on a nonoverlapping 500 ms schedule; full snapshots
refresh every five seconds while progress is healthy, with a one-second fallback.
This uses provider SSE and browser polling, with no browser SSE connection.
Already-received active text is displayed through a buffer capped at 450 ms to
smooth visible batches; the durable text is unchanged. Cancellation retains
partial text as incomplete; normal
completion still requires validated provider metadata and usage. The
[manual testing log](../docs/manual-testing.md) records focused simulated-provider,
actual-database, and browser evidence, plus the remaining release limitations.

The accepted local checks include a real grounded reply, saved token usage,
provider/model labels, reload persistence, duplicate submission, and cancellation
without later publication or another dispatch. These results do not establish
hosted operation or error-free server logs: local verification retained bounded
recovered reads and unattributed Next request-abort exception blocks. The
[Phase 8 diagnostic record](../docs/phases/phase-8-real-agent.md#round-27--complete-release-gate-and-final-diagnostic-audit)
keeps their counts and limits separate from the passing functional checks.
Phase 9 reproduces and corrects two relevant failure mechanisms; its final
ordinary production checks have no 5xx, uncaught exceptions, or framework abort
blocks, while safe request-reset and session-change diagnostics remain visible.
The original individual Phase 8 occurrences still cannot be attributed from their
limited logs. See the [Phase 9 evidence](../docs/phases/phase-9-operations.md).

The assessment revision is an optimistic concurrency token for state-changing
interactive application commands. Autonomous worker progress, completion, and failure preserve
that token; run event sequence and worker fences track execution changes. This
lets a saved draft remain actionable while another assessment progresses without
weakening its exact draft identity/revision checks. User commands, explicit
cancellation/retry, and session transitions retain their revision guards. Client
refreshes adopt changed saved snapshots even when the command token is unchanged.
Joining an already-running assessment is a no-op for that token; it still records
its request receipt and attaches a missing legacy execution job when needed.
An acknowledged no-op adjusts only dependent unsent requests in the client queue;
uncertain requests retain their original identity and expected revision.

The server tool registry validates tool names, inputs, and captured scope under
server-owned authority. Model text and browser IDs grant no permission. The
configured demo tool is read-only; private-resource tools remain disabled. The
optional Anthropic text path does not enable that tool registry for the model.
Assessment execution permits read-only tools, including when a test
registry is injected; an attempted write is rejected before dispatch. The fake
write/effect reconciliation tests exercise chat runs. A potentially writing test
tool records a stable effect ID and its tool/input before dispatch. Unknown outcomes require trusted server reconciliation
and prohibit blind retry, even after cancellation. The reconciliation hook is not
exposed over HTTP. Phase 5 verified that boundary with injected tools; it did not
enable product writes or a live provider/private-resource integration. Phase 8
keeps those write/private-resource limits while adding optional reasoning and UI navigation.

`Procfile` declares separate `web` and `worker` processes. A hosted environment must
apply the same ordered migrations and build both entry points, then run both
process types against its intended database branch. Stopping every worker delays
progress without deleting acknowledged jobs. Local actual-Neon and process tests
are recorded in the [Phase 5 journal](../docs/phases/phase-5-agent-interfaces.md);
Heroku deployment and hosted worker verification have not occurred.
