# Unified Front Door

A React prototyping environment that mimics the Salesforce Lightning look using
the **SLDS 2 (Salesforce Cosmos)** design language. Application records persist in
**Neon Postgres** through a server-owned application API. Phase 4 is independently
approved after Neon integration, recovery, CLI, production, and documentation
checks. See the
[Phase 4 journal](docs/phases/phase-4-neon.md) for exact evidence and limits.
Phase 5 is independently approved, including agent/assessment contracts, durable
worker lifetime, recovery, and documentation. Exact evidence is tracked in the
[Phase 5 journal](docs/phases/phase-5-agent-interfaces.md).
Phase 6 is independently approved, including accessible interactions, feature
recovery, recovery-safe edit coalescing, and measured client limits. See the
[Phase 6 journal](docs/phases/phase-6-ui-reliability.md).
Phase 7 is independently approved for delivery and operational readiness. The
[journal](docs/phases/phase-7-delivery-readiness.md) and
[verification artifact](docs/phases/phase-7-verification.json) retain exact
source/evidence and failed attempts. This phase has not deployed or verified the
hosted application.
Phase 8 adds bounded Anthropic `claude-sonnet-5` reasoning that explains findings
and proposes plans over captured application data. The complete local release
gate and actual-provider acceptance pass, and Phase 8 is independently approved.
The local environment now enables Anthropic chat. Follow the
[Phase 8 journal](docs/phases/phase-8-real-agent.md) and
[verification record](docs/phases/phase-8-verification.json) for evidence and
limits. Private-org tools and external writes remain outside this scope.

Phase 9's shared HTTP authentication/startup boundary, request lifetime, and
concurrent session reads pass the full 14-stage gate and 205 tests. The independent
reviewer approved all six criteria; the read-only Heroku preflight is complete. See the
[Phase 9 journal](docs/phases/phase-9-operations.md). That checkpoint did not include
hosted deployment or additional paid provider calls; the later manual verification
below used the user's existing $5 verification allowance.

Manual testing before Phase 10 has removed developer recovery/import controls
from the product UI. Replies now display received text in small increments, accept
valid Anthropic completion metadata, and preserve the final buffered text on
provider failure. Backend, database, browser, and one controlled live Anthropic
verification pass; the local worker is running for another manual test.
The [manual testing log](docs/manual-testing.md) separates those changes from the
approved Phase 9 source; a hosted release requires fresh source verification.
At the user's request, login also offers **Clear data** beside each profile to
[restore that profile's demo starting state](docs/manual-testing.md#clear-data-from-login)
after confirmation. Phase 10 remains paused for local manual testing.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **@salesforce-ux/design-system-2** — SLDS 2 Cosmos theme, loaded CSS-only in
  `src/app/layout.tsx`. Apply `slds-*` blueprint classes in JSX.
- **pg** — one server-only Postgres pool in `src/lib/db.ts`, with ordered SQL
  migrations shared by local Postgres and Neon.

Fonts: Arial is used as the SLDS-supported fallback (Salesforce Sans is
license-restricted to Salesforce-hosted apps).

## Getting started

Use Node **22.23.2**, pinned in `.nvmrc` and `package.json`. Install the locked
dependencies, then create `.env.local` from
[.env.example](.env.example) if you do not already have a local file. Preserve any
existing configuration and fill in the database and Basic Auth values described
below. Do not put credentials in source or browser-prefixed environment variables.

```bash
npm ci
npm run db:migrate
npm run db:status
npm run dev          # http://localhost:3000
```

Run the agent worker in a second terminal using the same environment:

```bash
npm run build:worker
npm run worker
```

Rebuild and restart the worker after changing its source. `npm run build` compiles
both the production web app and worker. The web app accepts and observes durable
jobs; the worker advances them. Jobs remain pending while the worker is stopped.

The migration command loads `.env.local` when present; Next loads it for the app.
The browser's Basic Auth username defaults to `guest` (`BASIC_AUTH_USER` overrides
it). Set `BASIC_AUTH_PASSWORD`, pass that gate, then choose a demo profile.

For local production behavior, run `npm run build`, then `npm run start`, and
start `npm run worker` in another terminal. `APP_ORIGIN` must match the browser
origin exactly. Production startup rejects missing/blank authentication, invalid
origin/database configuration, and an unsupported Node version. Worker startup
also checks database schema readiness. A successful web process start alone does
not establish database or worker readiness.

Development and production use the same HTTP entrypoint, `scripts/web.mjs`,
through the validated startup wrapper. `npm run dev` first rebuilds the worker
modules required by that wrapper. Basic Auth runs before Next handles the original
request and protects pages, static files, APIs, unknown routes, and every HTTP
method. Production rejects HTTP upgrades with 426 after authentication;
development permits only the authenticated Next hot-reload endpoint. Use these
package commands so local, test, and hosted startup share this boundary.

The HTTP server allows 10 seconds for incomplete headers, 15 seconds for an
incomplete request, and 5 seconds of keep-alive idleness. Timeout enforcement
polls every second. Shutdown waits up to 20 seconds before closing remaining
connections and exiting unsuccessfully; the parent process has a 25-second kill
fallback. Application request-size and same-origin mutation checks remain in
force. Phase 9 validates this startup change; its current evidence and any pending
checks are in the [Phase 9 journal](docs/phases/phase-9-operations.md).

### Provider credentials, worktrees, and hosted configuration

Keep `ANTHROPIC_API_KEY` in the ignored `.env.local` for local development. Give
that file owner-only read/write permissions (`chmod 600 .env.local`), and do not
prefix the key with `NEXT_PUBLIC_`. The server reads the key to authenticate HTTPS
requests directly to Anthropic. Application code does not save the key in Neon
or send it to the browser. Neon holds application records; selected workspace
context, conversation history, and prompts are sent to Anthropic when reasoning
is enabled. File permissions protect local access; the file itself is plaintext.

A saved key alone does not enable paid calls: `AGENT_PROVIDER` defaults to `demo`.
The real integration uses `AGENT_PROVIDER=anthropic` with the configured model
policy. This workspace's private local file explicitly selects Anthropic; a new
environment using `.env.example` starts in demo mode.

An ignored `.env.local` belongs to a **worktree directory**, not a Git branch.
Changing branches in that directory ordinarily leaves it in place. A new
worktree does not inherit it through Git, commits, or merges. Configure the new
worktree explicitly, or privately copy the existing local file and preserve
owner-only permissions. Before starting either process, select the intended
development database and local `APP_ORIGIN`; copying the file also copies its
database target and credentials. The committed `.env.example` contains names and
safe defaults only. There is no automatic shared-secret setup between worktrees.

For a future authorized Heroku deployment, set `ANTHROPIC_API_KEY` in the app's
**Settings → Config Vars**, preferably using a separate hosted key. Heroku exposes
config vars as server environment variables and retains them across deployments
and restarts. They belong to the app and are available to its web and worker
processes; they are not a worker-only secret boundary. Restrict access to the
Heroku app accordingly. See [Heroku config vars](https://devcenter.heroku.com/articles/config-vars).
Configure that app's provider settings and separate `heroku-demo` database there,
rather than uploading `.env.local`. No hosted provider configuration or deployment
has been performed by this phase.

## Day zero: org assessment

Choose **Sam Patel — Day zero · Org assessment** on sign-in, or switch to Sam
from the avatar menu. The agent automatically starts a simulated read-only
assessment of the connected orgs in Sam's demo workspace.
Sam's workspace offers **Build & Setup** and **ALM**, matching Karen's simpler navigation.

The front door and surfaces share one persistent agent panel and composer. When
opening a surface, the welcome content fades out with a strong 24px blur over
500ms. Only then does the composer move with the narrowing panel for 440ms, followed
by the chat header and conversation fading into focus over 500ms. Returning home
uses the same sequence in reverse. The composer stays sharp throughout. Draft
text, text selection, and session conversations survive
client-side navigation home and back. Reduced-motion preferences skip the transitions.

Switching between surfaces uses a separate 500ms canvas swap: the incoming surface
lands in front while the outgoing surface recedes, blurs, and fades away. The agent
and composer stay in place. Next's view-transition integration captures the outgoing
canvas without keeping a second live surface mounted; browsers without support and
reduced-motion users get an immediate swap. Browser Back/Forward restores the
addressed workspace destination without replaying the surface animation. The home
transition remains separate.

Canvas content shares `src/components/canvas/CanvasLayout.tsx`: responsive gutters
and a left-aligned inner column capped at 72rem. `SurfaceCanvasHost` supplies it
once for every overview and launched tab, so canvas bodies provide content without
their own outer padding, centering, or width limits.

The command palette puts the current surface, project/worktree, session, or org first
in its tab and highlights that row on opening or switching tabs. One Down press
selects another destination. Search filters normally and resets the highlight to
the first match; clearing it returns the highlight to the current destination.
Opening and closing use the front-door chat's 500ms fade and 24px blur. A selection
takes effect after dismissal completes, and reopening during dismissal reverses
the transition and cancels the pending selection. Reduced motion skips the dissolve.
The palette uses a shared native-dialog interaction owner. Tab/Shift+Tab stay
inside it, Escape works throughout the dialog, and closing restores trigger focus.
Left/Right move between palette tabs when a tab has focus; in the search input
they retain normal text-caret behavior.

The workspace panel slides in and out from the left over 500ms, preserving its
content width and filter selection. It reserves space on desktop and overlays the
content as a drawer on mobile. Closed controls are inert, and reduced motion skips
the slide.

- Pause/resume the assessment, or open the org scope to choose connections and rerun it.
- The status bar shows the project followed immediately by the org. Click either to open the command palette's Projects or Orgs tab with the current selection first and highlighted. Orgs are available from first login, independently of project creation or assessment scope; org selection persists across reloads. Closing the palette returns focus to its trigger.
- Review prioritized findings, their sample evidence, proposed approaches, and success criteria.
- Select opportunities and choose **Shape a project** to edit the goal, sandbox, and included work items.
- Choose **Create project** to open the saved project in ALM, inspect each implementation plan, and track work item status.
- Reopen projects from home, the workspace panel, the command palette, or ALM. Drafts, assessment progress, projects, and work item status persist in the profile’s server-owned demo workspace.

This is a product prototype: Salesforce authentication, org discovery, live
assessment queries, and org changes are not connected. The domain, permissions,
usage metrics, and findings are fixtures. The optional Anthropic path reasons
over those captured records and has been verified locally with the real provider.
A domain login in a real
integration must be followed by discovery of explicitly granted org connections;
it does not imply access to every org in the company. Project creation and status
changes save planning data in the application database and do not modify an org.

Assessment records and snapshots live in `src/lib/assessment`; project/work-item
models, codecs, and planning commands live in `src/lib/projects`.
`src/lib/onboarding` supplies the demo fixture adapter and legacy import codec.
`src/lib/application` owns validated commands and client adapters; `src/lib/server`
owns authenticated sessions, scoped queries, and transactional operations. `src/components/onboarding` renders the assessment, guided project review,
and ALM plans. Workspace context projects saved planning projects into navigation
without inventing a repository or worktree. The surface canvas registry opens their
persistent tabs. Other profiles retain their first-visit and returning experiences.

## Feature recovery and client work

Canvas content and the conversation transcript have separate feature error
boundaries. A failed view offers retry while shell navigation and the persistent
composer remain mounted. Work, capability, and improvement canvases load through
explicit lazy boundaries with a loading status; retry creates a fresh loader
instance after a failed load. Saved edits and unsent composer text keep their
existing separate lifetimes.

Historical Today cards render their captured snapshots without live assessment,
workspace, or agent subscriptions. Historical work links use explicit callbacks;
**Explore surfaces** stays with the active card and its live adapter. Canvas
actions have stable identities, and selected surface/draft subscriptions avoid
unrelated canvas updates.

The transcript mounts at most 40 entries per page. Older/Newer/Latest controls
make retained entries accessible without removing server history. New fixture
timestamps show a fixed scenario date/time in UTC; explicit-offset timestamps
are normalized to the same instant. Legacy relative or timezone-less strings
retain their original text labeled **At capture**, without inventing an instant.
Scratch-org expiry stored only as a remaining-day count likewise says **At
capture: … days remaining**; zero remains **Expired**. Scenario summaries with
known times use fixed UTC values.

These changes are independently approved under Phase 6. The
[Phase 6 journal](docs/phases/phase-6-ui-reliability.md) records behavior, exact
browser evidence, measured performance, and limitations.

## Project history and draft identity

Each assessment run has its own identity and captures finding text, evidence,
implementation steps, org labels, timestamps, and source-version provenance.
Saved work items copy that historical basis. Renaming/removing a current fixture
or expiring its connection does not remove a saved plan; current org availability
is shown separately. Project creation remains a planning operation and requires an
available sandbox target.

A recurring finding in a later run is a new result. Project creation deduplicates
replayed creation commands and requires the captured draft identity and revision;
a result already allocated from the same run remains allocated. Project drafts
retain their originating run when a new scan starts. Their field edits target that
draft, and creation uses its completed origin and captured scope. Discarding an
existing draft is explicit.

Older browser records did not store complete assessment evidence. Migration keeps
their saved plans, names, goals, work-item statuses, priorities where recorded,
and scope. Missing evidence, timestamps, org attribution, categories, or priorities
are shown as unavailable/unrecorded instead of reconstructed from today's fixtures.
The original bytes are not rewritten just by reading them.
An older completed scan without saved findings is shown as unavailable and offers
a new scan; it is not presented as a scan that found no issues.
If a restored scan has no currently connected orgs, choose a new org scope before
starting or resuming. The chooser enables analysis only for a connected selection;
existing projects and run history remain saved.

Historical Today messages contain copied display projections rather than complete
application-state blobs. They include at most 20 findings, 12 recent project
summaries, 100 finding references per project, and 12 evidence/step entries per
finding. Display text is also bounded and omissions are indicated in the history.
These display budgets do not truncate stored records or the live editing view.

Canvas kinds have required, validated identities. Canonical tab IDs exclude display
labels and encode parameter boundaries, so renames retain identity and delimiter
characters cannot merge different targets. Existing active/open/closed references
migrate together when their identity is unambiguous.

Some older closed drafts stored only an unescaped, multi-field key; their target
cannot be reconstructed reliably. Explicit import preserves those original bytes
and ambiguous recovery records in the database. The developer and assistant can
export the preserved source through the scoped application API and recover the
text into an explicitly scoped new draft. These developer controls are absent
from the product UI. Competing content remains in the
export; no target is guessed. Canonical IDs, unique surviving structured open-tab
matches, and safe single-field legacy keys can import as typed drafts when their
identity is unambiguous.

## Workspace navigation and scope

Workspace context distinguishes loading, no project, planning without a worktree,
ready, and unavailable resources. An app destination in an established project can
also have no selected worktree; that does not make the project a planning project.
Saved references to a removed project/worktree
or expired org remain visible as unavailable; selecting a different context is an
explicit action. Capabilities that only prepare a draft can work without a Git
worktree or live org connection.

Opening a capability captures the selected project, worktree, and org when a
project is selected. A pre-project draft is **Unbound**. Legacy globally keyed
drafts also remain unbound; migration does not assign them to whichever project
happens to be selected. Toolkit sections inherit their parent draft's scope.
An unbound draft offers **Assign a copy to project** and **Copy draft to project**.
This keeps the original and refuses to overwrite an existing draft for that target.
The **Captured draft scope** display shows the context of a bound draft; changing
workspace selection cannot retarget it.

Existing work tabs keep one captured target through close/reopen and use it from
every navigation entry point. Restoring a URL is read-only; a later deliberate
navigation, close, or edit preserves its initial target. A link requesting a
different target from saved work shows a conflict instead of silently changing
its scope.
New planning projects open using the target returned by project creation.
Historical project summaries retain that target identity for their links;
an existing tab's captured target still takes precedence.

Shareable destinations use the surface path and a versioned `destination` query
value containing the demo profile, requested context, and typed canvas input.
Draft text and other saved content are excluded. A valid explicit URL takes
precedence over stored navigation hints; a bare route restores those hints and
receives an explicit destination URL. Back/Forward follows the same resolution
rules. Invalid links, denied surfaces, and a link for another demo profile show
**Destination unavailable**, with **Open my workspace** as recovery. A signed-out
direct link continues through demo sign-in when the chosen profile matches;
choosing another profile leaves the link unavailable. Only normalized internal
destinations are accepted for sign-in continuation. Deliberate profile-menu
switching still opens that profile's home. The demo profile marker is not server
authorization.

Each browser tab owns its URL destination. Shared draft content still synchronizes
under the save/conflict policy below, but another tab's selected project or active
canvas does not navigate this tab. Panel preferences and open-tab records stay in
browser storage rather than being included in a shareable URL. Acknowledged
conversation history is server-owned and survives reload in the same demo
namespace. Unsent composer drafts and text selection remain in the current page's
memory; they survive client navigation but not reload.

## Adding a capability or destination

The active extension path is the surface canvas registry:

1. Define a capability and its fields in
   `src/components/surfaces/surface-capabilities.tsx`. Shared surface IDs live in
   `src/lib/workspace/surfaces.ts`.
2. Use the discriminated inputs and runtime codec in
   `src/lib/surface-canvas/model.ts`. Capture scope explicitly; display labels do
   not establish identity.
3. Render the typed input through
   `src/components/surfaces/canvas-registry.tsx`. `SurfaceCanvasHost` supplies the
   shared layout.
4. Issue navigation through `useNavigation` or `useSurfaceCanvases`; do not add
   component effects that independently rewrite workspace selection.
   `src/lib/navigation/model.ts` owns destination encoding/resolution and the
   controller; `NavigationProvider` connects it to the router and stores.

Planning-project links use `openImprovementProject` with the domain result or
captured summary's `id`, `name`, and `targetOrgId`. The navigation boundary must not
infer a just-created project's target from a rendered workspace list that has not
updated yet.

The earlier detached canvas/provider/chat/builders have been removed. Their finite
inventory and feature dispositions are in the
[Phase 3 journal](docs/phases/phase-3-navigation.md#dormant-import-graph-inventory).
The shared `CanvasLayout` and server-only database seam remain.

## Server ownership and demo lifetime

A server-issued opaque HttpOnly cookie identifies an isolated demo namespace;
Postgres stores its token hash. The namespace has separate workspaces for the demo
profiles. Request bodies, profile IDs, record IDs, and shareable URLs do not grant
access to a namespace. Mutations must pass the server session, current generation,
and same-origin checks.

The cookie lasts 30 days. Profile switching and sign-out keep the same namespace
while changing the active persona/generation. Signing back in resumes that
profile's saved data. Choosing Sam no longer resets saved history automatically.
Missing or expired cookies create a fresh namespace. This is demo ownership,
without a cross-device account or a way to recover a namespace after its cookie
is lost; production identity and org grants remain a later integration boundary.

On login, choose **Clear data** beside the intended profile, review its named
confirmation, and confirm to restore its original demo state. **Cancel** is the
default. This clears that profile's saved chats, assessments, projects, and drafts
in this browser's namespace while keeping starter demo fixtures, other profiles,
and original browser import sources. The page stays on login. A lost response can
be retried explicitly with the same saved command; loading the page or signing in
does not clear data.

While signed in, use the profile menu's **Reset this profile’s demo data**,
review the scope, then choose **Confirm reset of this profile**. Reset removes the
current profile's saved application records in this namespace and seeds its demo
state. Other profiles/namespaces and original browser import sources stay intact.
Session generation changes prevent an older pending operation from silently
acquiring the new workspace's authority.

## Saved application data and pending edits

Assessment runs/findings, project drafts, planning projects/work-item status, and
saved canvas fields/captured targets use the server application API and Postgres.
**Saved to database** means the server acknowledged the command and the client
obtained a fresh saved projection. Project creation waits for that result before
opening the returned project's captured target.

Pending edits remain bound to their original namespace, profile, generation, and
browser queue. **Saving to database…** is not an acknowledgement. **Retry saving**
keeps the original command identity and checks whether an uncertain request already
committed. If browser buffering is unavailable, the UI identifies edits held only
in this tab; work with the assistant to export them before closing or reloading. A successful local buffer
write does not establish a database save.

Typing updates the UI and synchronous browser recovery buffer on every edit.
The UI edit path coalesces only a compatible, never-dispatched tail created in
the current runtime: fields for the same canvas/captured target, or the same
project-draft field/finding. It sends after 200 ms without another edit, or after
at most 1 s of continuous typing. Blur, page hide, navigation, profile change,
and ordinary application commands request an immediate flush; a flush is not a
database acknowledgement. Restored and attempted commands retain their payload
and command identity. Later edits remain separate from a reviewed discard.

Serialization caches immutable commands, but each edit still rewrites the complete
recovery-envelope string to `localStorage`. This reduces repeated serialization
and network commands; it does not remove synchronous storage cost. Recovery uses
the existing buffer format and conflict choices described below.

A revision conflict preserves both saved and pending versions.
**Apply my pending fields to the latest saved version** is available only
for field edits whose original target still exists and matches. It rebases those
fields with new command identities. **Use saved version (discard my changes)**
discards the commands covered by that decision; later edits are kept for review.
Commands that create/import/change lifecycle are not silently rewritten as field
updates.

Recoverable browser buffers, including those from older session generations, stay
available to the underlying recovery APIs. The developer and assistant handle
inspection, export, and reviewed discard outside the product UI. Old session
commands are never replayed automatically into the current workspace. Recovery is
manual text/export recovery, not a transfer of authority to a new namespace.
Unreadable original buffer bytes stay protected until an explicit reviewed discard.
The Phase 4 journal records the independent recovery checks and the exact tested
candidate and approved Phase 4 decision.

Workspace/panel preferences and open tabs remain local. Their save indicators refer
to browser storage. Per-tab URLs still own the visible destination, and another
tab's selection does not navigate this one. Database draft updates are refreshed
without changing captured targets. Acknowledged conversations and agent runs use
the durable execution boundary below. Unsent composer drafts survive client
navigation in this page only.
The page holds at most 16 nonempty unsent composer drafts, each at most 8,000
characters. An additional draft is visibly rejected without removing existing
text; sending an acknowledged message or clearing a draft frees its slot.
Capability/work canvas text controls allow up to 16,000 characters per field.
Longer previously saved values stay intact and can be shortened; the server's
65,536-byte UTF-8 aggregate field limit still applies. Copying an unbound draft
to a project requires its save/recovery to finish first.

## Agent conversations and execution

The default agent uses fixture-backed demo behavior. Typed contracts in
`src/lib/agent/contracts.ts` separate submission, observation, cancellation, and
retry from React rendering. `demo.ts` owns reply/recommendation policy, assessment
fixture interpretation, and simulated progress. Tests inject delayed, failing, and
alternate-policy adapters through these same contracts; the HTTP API cannot select
a test adapter or enable an unconfigured real provider.

The optional Phase 8 Anthropic path explains captured findings and proposes a
plan. It has no model tools, private-org access, or executable output. The server
captures the provider policy, owned project or completed assessment evidence, and
acknowledged conversation history when accepting a message. Standalone findings
follow the selected org; a project's own findings can originate in production
even when its destination is a sandbox. Captured source/target provenance keeps
that distinction explicit. History must match the captured target and workspace
epoch. Local database and actual-provider acceptance pass; Phase 8 is independently
approved. See the [Phase 8 journal](docs/phases/phase-8-real-agent.md).

Each submitted message captures its project, worktree, org, surface, and a
server-validated snapshot. Navigation cannot retarget accepted work. Conversations
are shared by the project's worktree thread across Today and its surfaces;
unbound threads have explicit org context. Today/visit entries are server-derived,
and historical briefings keep their captured content. Presentation state such as
scroll position and reveal animations remains local.

An acknowledged request saves the user message, response placeholder, run, and
receipt in one transaction. Conversation/turn/run/result history survives reload,
browser closure, and web or worker process restart while its demo namespace and
records remain available. One active reply per conversation returns an explicit
busy response to another submission. Each retry gets a new run ID for the same
logical turn; ordered events retain their run identity and sequence.

The UI shows waiting, preparing, replying, completed, failed, and cancelled states.
Use **Cancel reply** to stop further publication, or **Retry reply** for an eligible
cancelled/failed attempt. **Retry request** confirms an uncertain HTTP result using
the original request ID, payload, and captured scope; a changed payload cannot
reuse that identity. Submitted request recovery uses this tab's session storage,
separate from unsent composer text. If browser recovery storage is unavailable,
unconfirmed requests may exist only in memory; keep that tab open until confirmed.

If a saved request cannot be parsed, **Export saved request** preserves its original
text. **Discard unreadable request** removes only the exact version displayed for
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
[manual testing log](docs/manual-testing.md) records focused simulated-provider,
actual-database, and browser evidence, plus the remaining release limitations.

The accepted local checks include a real grounded reply, saved token usage,
provider/model labels, reload persistence, duplicate submission, and cancellation
without later publication or another dispatch. These results do not establish
hosted operation or error-free server logs: local verification retained bounded
recovered reads and unattributed Next request-abort exception blocks. The
[Phase 8 diagnostic record](docs/phases/phase-8-real-agent.md#round-27--complete-release-gate-and-final-diagnostic-audit)
keeps their counts and limits separate from the passing functional checks.
Phase 9 reproduces and corrects two relevant failure mechanisms; its final
ordinary production checks have no 5xx, uncaught exceptions, or framework abort
blocks, while safe request-reset and session-change diagnostics remain visible.
The original individual Phase 8 occurrences still cannot be attributed from their
limited logs. See the [Phase 9 evidence](docs/phases/phase-9-operations.md).

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
keeps those write/private-resource limits while adding optional text reasoning.

`Procfile` declares separate `web` and `worker` processes. A hosted environment must
apply the same ordered migrations and build both entry points, then run both
process types against its intended database branch. Stopping every worker delays
progress without deleting acknowledged jobs. Local actual-Neon and process tests
are recorded in the [Phase 5 journal](docs/phases/phase-5-agent-interfaces.md);
Heroku deployment and hosted worker verification have not occurred.

## Importing older browser data

Legacy import is a developer-assisted operation outside the product UI. Inspect
the selected profile's browser records with the assistant, preview the import
through the application API, and review project/run/draft/recovery counts before
applying it to the intended namespace. Keeping browser data separate requires no
import. Neither sign-in nor adding a database connection automatically imports
old data.

The server validates and imports transactionally, records the source/provenance,
and recognizes repeated sources without reverting later edits. Colliding records
or contradictory historical copies reject the import. Original browser values
stay intact after acknowledgement; missing historical evidence is not recreated
from current fixtures. The scoped export API retrieves original source and ambiguous
records even after local source values are cleared, with a 9,001,024-byte export
cap. The server limits access to the current authenticated workspace/profile;
export does not automatically re-import the data. Exact Neon and browser evidence
is recorded in the Phase 4 journal.

## Verification

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
[Phase 5 journal](docs/phases/phase-5-agent-interfaces.md). Browser checks and review decisions are recorded
separately in the [Phase 1 journal](docs/phases/phase-1-persistence.md),
[Phase 2 journal](docs/phases/phase-2-domain-identities.md), and
[Phase 3 journal](docs/phases/phase-3-navigation.md). Current database/client review
and its separate Neon evidence gate are in the
[Phase 4 journal](docs/phases/phase-4-neon.md).
The client-reliability suite covers coalesced edits, synchronous recovery,
flush timing, uncertain-request identity, edits during discard, scoped
subscriptions, tab capacity, and timestamp normalization. Phase 6 production
keyboard, injected-fault, and baseline/final client measurements are tracked
separately in the [Phase 6 journal](docs/phases/phase-6-ui-reliability.md);
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

The first command checks interactions, agent-client recovery, UI budgets, and
injected feature/chunk failures.
These suites and the performance harness intercept API traffic with deterministic
fixtures; they test production client behavior, not database throughput. The
performance harness uses 4× Chromium CPU slowdown, 1/20 saved drafts with 100
input edits, and 20/80/128 transcript entries, three samples each. Compare the
same protocol and environment; shared-host contention limits timing conclusions.
The recorded Phase 6 comparison uses 5–8 save requests for 100 edits versus 100
in the baseline, and mounts 40 messages for a 128-entry history versus all 128.
The [measurement artifact](docs/phases/phase-6-client-measurements.json) preserves
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

## Database configuration

Use an isolated Neon development/test branch for the local app. This setup uses
an existing `dev` branch; create a separate `heroku-demo` branch before hosted
wiring. The local Next server connects directly to Postgres;
a local database service is optional. Local Postgres can exercise the same driver
and migrations, but Phase 4 acceptance also requires actual Neon evidence.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server runtime connection; use the Neon pooled URL for the selected branch. Keep TLS verification enabled. |
| `DATABASE_URL_UNPOOLED` | Direct connection to the same database for migrations/status; required for remote targets. Only local Postgres may fall back to `DATABASE_URL`. |
| `DATABASE_TEST_URL` | Explicit isolated development/test database for the database integration suite; never inferred from the runtime URL. |
| `DATABASE_TEST_URL_UNPOOLED` | Direct connection to that same disposable test database; required for a remote release-gate run. |
| `APP_ORIGIN` | Exact externally visible origin, including the local port or hosted HTTPS origin. Used for mutation-origin checks. |
| `BASIC_AUTH_USER` | Browser gate username; defaults to `guest`. |
| `BASIC_AUTH_PASSWORD` | Browser gate password. |
| `AGENT_PROVIDER` | `demo` by default; `anthropic` explicitly enables the optional text-reasoning path. |
| `ANTHROPIC_API_KEY` | Server-only provider credential, required in Anthropic mode. Keep it out of Git, browser variables, and database records. |
| `ANTHROPIC_MODEL` | Optional pinned-model setting; when provided, it must be `claude-sonnet-5`. |
| `ANTHROPIC_WORKSPACE_ID` | Optional provider workspace identifier (`wrkspc_…`); this is separate from the app's demo namespace. |
| `AGENT_GLOBAL_DAILY_CALLS` | Application-wide attempted-call allowance per UTC day: default `10`, range `1`–`100`. |
| `AGENT_NAMESPACE_DAILY_CALLS` | Attempted-call allowance per namespace per UTC day: default `5`, range `1`–`20`. |

Attempt limits can decrease within a UTC day; raising configuration does not
raise an already-recorded allowance for that day. They do not represent a hard
dollar cap. Ordinary automated verification forces demo mode and uses simulated
provider transports; paid acceptance requires its separate explicit opt-in.

To get the two Neon URLs, first create a Neon account at
[the Neon Console](https://console.neon.tech) and create the `unified-front-door`
project if you have not done so. Enable **Postgres**; leave **Object storage**,
**Functions**, **AI gateway**, and **Neon Auth** off. This app currently uses only
Postgres. Select the intended development/test branch (`dev` in this setup):

1. Open your project in the Neon Console and choose **Connect**.
2. Select that **dev** branch and **Connection string** format.
3. Turn **Connection pooling** on and copy the URL into `DATABASE_URL`.
4. Turn pooling off and copy the direct URL into `DATABASE_URL_UNPOOLED`.

Keep the branch, database, and role the same for both URLs. Copy only the
`postgresql://…` value, without a surrounding `psql` command, into the local file.
See [Neon's connection-pooling guide](https://neon.com/docs/connect/connection-pooling).

Keep local credentials in the ignored `.env.local`; use Heroku configuration
variables for the hosted app. Both database URLs in one environment must address
its intended branch. Never use a shared or production target for disposable test
fixtures or demo resets.

`npm run db:migrate` applies numbered files in `db/migrations` atomically and
records checksums in `schema_migrations`. An advisory lock serializes competing
migrations; matching history is skipped, while changed, reordered, or unknown
history is rejected. Add new migrations instead of editing applied ones. Limits
are 5 seconds to connect or acquire the migration lock, 30 seconds per SQL
statement, and 120 seconds for the migration process. `npm run db:status` checks
exact current migration history read-only, with a 20-second process deadline.

On connection loss or timeout, the result can be uncertain even if the command
exits unsuccessfully. Run `npm run db:status` against the intended direct target
and inspect the recorded state before deciding whether to retry. Do not assume
the transaction rolled back, blindly replay a release, or edit checksums to make
the check pass. Runtime/direct URLs must select the same endpoint/database/port;
runtime and migration roles may differ.
The application owns tables in the `public` schema. Runtime, readiness, and
migration transactions pin `search_path` to `public`; connection-string routing
or schema overrides are rejected. Custom per-connection schemas are unsupported.

### Readiness and diagnostics

`GET /api/ready` requires the same Basic Auth as pages and static assets. It
returns only `200 {"ready":true}` or `503 {"ready":false}` with `no-store` and a
generated `X-Request-ID`. Invalid credentials return 401; missing/blank gate
configuration fails closed with 503. The probe compares the migration manifest
and checks required columns in a read-only transaction. Its connection acquisition
is bounded at 5 seconds and connected probe at 10 seconds; failed/uncertain
connections are destroyed. This verifies selected schema requirements and
database access, not every constraint or worker/provider health.

Ordinary application transactions have a 20-second connected lifetime, separate
from the 5-second connection-acquisition limit. Connection errors are contained
during pool handoff and active work; failures/timeouts destroy the uncertain
connection. Commands and paid work do not automatically replay a transaction after failure.
If a commit acknowledgement is lost, use the existing command receipt/retry
protocol to determine its result rather than assuming the write did not happen.

Server diagnostics emit allowlisted JSON events for requests, operation errors,
worker lifecycle, and run progress. Response request IDs correlate request/error
events; a hashed command key connects HTTP operations and worker runs. Raw request
IDs supplied by clients, commands, prompts, credentials, connection strings, and
arbitrary error messages are excluded. Use the response `X-Request-ID`, event
type, status, duration, run ID, and safe error code when investigating failures.

Observational workspace, agent, and run-event reads retry a known rolled-back
serialization conflict (`40001`) once with a fresh snapshot and fresh session
checks. Commands, model requests, and paid work never use this retry path. The
attempts share a 20-second database-work budget; final connection acquisition may
add up to five seconds. A correlated `database.snapshot_retry` event records the
retry. Error events use allowlisted categories to distinguish serialization,
locking, cancellation, authentication, capacity, and transport failures without
printing raw database errors. The HTTP entrypoint separately records bounded
transport categories such as `request_reset`, `request_cancelled`, and
`handler_failed`; these describe observations without attributing every reset to
the client.

### Heroku release runbook

**Hosted status:** this architecture work has not deployed or verified the new
runtime on Heroku. Read-only inspection at **2026-09-17 01:55 UTC** (September 16
in the workspace's Eastern timezone) found `unified-front-door` at successful
current release `v11` on `heroku-24`/`us`, with one Basic web dyno running and no
running worker. Database URLs, `APP_ORIGIN`, `AGENT_PROVIDER`, and
`ANTHROPIC_API_KEY` are absent; the Basic Auth password is present. The GitHub
`heroku` environment exists with `HEROKU_API_KEY`, but the matching smoke password
secret is absent, and no required-reviewer or deployment-branch protection is
configured. The public repository supports those environment protections; their
absence is a setup gap, not an established platform limitation. See
[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
and the [Phase 9 release preflight](docs/phases/phase-9-operations.md#hosted-release-preflight).

Before an authorized first release:

1. **Before publishing or merging the intended release to `main`, configure
   required reviewers and a main-only deployment policy for the `heroku` GitHub
   environment.** The workflow automatically deploys eligible pushes to `main`;
   installing protections after that push is too late. Set the matching
   `HEROKU_BASIC_AUTH_PASSWORD` environment secret and optional
   `HEROKU_BASIC_AUTH_USER` variable (default `guest`). Confirm the workflow's app
   name/origin match.
2. Configure a separate `heroku-demo` database and its matching pooled/direct
   `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, the app's exact HTTPS `APP_ORIGIN`, and
   Basic Auth in Heroku. Preserve the disposable development/test branch.
   If the approved release enables Anthropic reasoning, set its provider config
   vars there too, preferably with a separate hosted `ANTHROPIC_API_KEY`; do not
   upload a local `.env.local`. Confirm the intended daily attempt allowances
   (defaults: 10 application-wide, 5 per namespace); these are not dollar caps.
3. Record the intended commit, current release, schema version, and a verified
   recovery point before applying new migrations. Confirm the backup/restore
   retention available for the hosted database and rehearse restore to an
   isolated target; this repository does not configure backups automatically.
4. Use the repository workflow for the approved revision. Pull requests only
   verify; main pushes and manual dispatch on main use verification → this run's
   source artifact → deployment. Manual dispatch on another branch does not
   deploy. Do not bypass this path with an unchecked direct push/build API call.
5. `Procfile` runs `release: npm run db:migrate` before the new web/worker
   formation starts. For the first compatible slug, an operator must explicitly
   activate the worker; the deploy script does not change formation or billing.
   Until matching web and worker dynos are running and smoke checks pass, treat
   the first release as incomplete even if the build succeeded.

After the release exposes the worker process type, select and approve a suitable
dyno plan, then an authorized operator can activate one worker:

```bash
heroku ps:scale worker=1 --app unified-front-door
```

This is a future hosted setup action, not a command executed by this phase or by
the deploy script. Verify the resulting worker and its matching release afterward.
At the September 16, 2026 preflight, Basic pricing is **$7 per month per dyno**:
one candidate Basic worker adds about **$7 per month**, or **$14 per month** for
the existing web plus worker, before Neon, Anthropic, and taxes. This is a cost
estimate, not a capacity recommendation or approved purchase. Confirm the plan
and current price before activation. [Heroku pricing](https://www.heroku.com/pricing/)

The deploy script verifies source/attestation hashes before remote effects,
checks the configured database target and origin, and confirms both the current
release and matching web/worker dynos. It then checks authenticated readiness,
login, and a static asset. Requests have 30-second limits, status polling is
bounded to 120 five-second intervals, and the script has a 15-minute deadline.
It does not print raw remote responses or signed URLs. GitHub's deployment job
has its own 20-minute limit. These are configured safeguards; hosted success
requires an actual separately authorized run.

### Failed releases, backups, and rollback

Record build/release identity and inspect status after a failure or timeout
before retrying: a lost response does not prove the remote operation failed.
A successful build can still have a failed release. Heroku normally keeps the
old formation when release tasks fail, but a config-var-triggered failure leaves
the changed configuration in place. Reconcile configuration as well as release
and schema state. See [Heroku release phase](https://devcenter.heroku.com/articles/release-phase).

Prefer a forward code/schema fix using the same verification gate. This app has
no automatic down migrations, and readiness conservatively rejects migration
history newer than the running code knows. An older slug is therefore usable
only after proving its schema compatibility and readiness; an app rollback does
not roll back Neon data. Heroku rollback also restores prior config values, so
verify database targets again. See [Heroku rollback behavior](https://devcenter.heroku.com/articles/releases#rollback).

For actual data recovery, stop new writes and workers under an approved incident
plan, restore the verified backup/recovery point into an isolated database, and
validate schema plus application journeys before any target switch. Account for
writes after that recovery point; do not silently discard them. Switch the paired
runtime/direct URLs together only after approval. Backup provisioning, retention,
recovery objectives, and a hosted restore drill remain operator responsibilities;
none is established merely by a passing migration or this local release gate.

Configuring a connection alone does not import browser records. The explicit
legacy import and durable-client checks have passed against Neon. The
[Phase 4 journal](docs/phases/phase-4-neon.md) records exact evidence and the
independent approval decision.

### Seed and reset a command-line demo workspace

Start the app first and set `APP_ORIGIN`/Basic Auth for that running instance.
The CLI uses the same authenticated session API as the browser. Its private session
file owns a separate demo namespace; it does not select an existing browser's
namespace. Use an absolute path outside the repository:

```bash
npm run demo:seed -- --session-file "$HOME/.ufd-demo-session.json" --profile sp
npm run demo:reset -- --session-file "$HOME/.ufd-demo-session.json" --profile sp --confirm-reset
```

`sp` selects Sam and is the default; the other profile IDs are `jw`, `kf`, and `am`.
Seed is repeatable and does not delete saved data. Reset requires an existing
private session file plus `--confirm-reset` and clears only the selected profile's
records in that namespace. The file contains authentication state and must remain
mode 600; do not share it or commit it. If a command outcome is uncertain, rerun
the same action/profile/session file so its pending command identity is recovered.
Independent seed/reset/lost-response CLI verification is recorded in the Phase 4
journal.

### Demo capacity limits

Each namespace/profile has explicit limits. Crossing one rejects the operation;
existing records are not evicted to make room. Editing an existing draft remains
possible at the draft-count limit when its content stays within the byte limit.

| Limit | Maximum |
| --- | --- |
| Assessment runs / projects / saved canvas drafts | 64 each |
| Captured findings / project work items | 512 each, across the workspace |
| Saved canvas fields | 65,536 bytes for the complete serialized fields object, measured as UTF-8 |
| New input in a canvas text field | 16,000 characters; longer saved values retained |
| Distinct imported sources | 16 |
| Import source / recovery record representation | 4,500,000 bytes each; the request body has its own overall bound |
| Workspace response | 16 MiB |
| Shared open canvases per surface | 20, plus Overview; existing over-cap tabs retained; one URL-only view may show an already captured/saved draft |
| Mounted transcript entries | 40 per page; Older/Newer/Latest controls retain access to history |
| Nonempty unsent composer drafts in one page | 16, each at most 8,000 characters |

Additional per-record and command-result limits are defined in
[`src/lib/server/quota.ts`](src/lib/server/quota.ts). Preserve/export pending data
when an operation exceeds capacity. Whole-workspace reads are still a bounded demo
interface. Transcript pagination limits mounted UI entries; it does not paginate
the network snapshot or discard fetched history. Full responses retain their
16 MiB application and 24 MiB agent bounds. Existing tabs over the new-tab limit
remain readable, selectable, and closable; a rejected new tab does not evict a
draft. A page may also keep one URL-only view of an already captured/saved draft
when another browser tab closes that shared tab and fills the shared slots.
Unknown new destinations, new tabs, and new copies are still rejected at capacity.
The fixed Overview tab does not count toward the 20 shared canvases.
The limits are not a throughput or production-scale benchmark.

Agent history has additional limits. Reaching one rejects new work rather than
silently deleting saved history:

| Agent limit | Maximum |
| --- | --- |
| Conversations / execution attempts per namespace/profile | 16 / 128 |
| Messages per conversation | 128 |
| Serialized conversation / captured input | 512 KiB / 128 KiB |
| Agent snapshot response | 24 MiB |
| Submitted message text | 8,000 characters |
| Events returned per cursor page | 128 |

These limits are defined in `src/lib/agent/contracts.ts` and the server query
boundary. The current client refreshes a bounded agent snapshot; it does not claim
unlimited transcript rendering or production-scale throughput.

### Database records

| Records | Ownership and purpose |
| --- | --- |
| Namespaces, sessions, workspaces | Server-authenticated demo ownership, persona/generation, and assessment revision/cursor. |
| Assessment runs/findings | Historical snapshots and finding identity, scoped to namespace and profile. |
| Project drafts, projects, work items | Origin run, revision, allocation, and status; relational keys enforce project/run/finding consistency. |
| Saved canvas drafts | Typed identity, captured target, saved fields, and revision independently of browser tab lifetime. |
| Command/session receipts | Stable command identity and payload matching for retries and conflicting reuse. |
| Agent conversations, runs, events, receipts | Durable thread/message history, captured execution attempts, ordered lifecycle events, replay receipts, worker leases/fences, and recorded effect uncertainty. |
| Import receipts/sources | Source identity, acknowledgement, and provenance for explicit legacy imports. |
| Schema migrations | Applied migration names, checksums, and timestamps. |

Immutable historical records keep their validated domain snapshots; foreign keys
and revisions enforce ownership and command invariants. Fixture catalog changes
do not recreate missing historical evidence or authorize an expired org.

## Project structure

```
src/
  app/
    layout.tsx       # root layout — imports SLDS 2 Cosmos CSS
    page.tsx         # home content is hosted by AppShell / FrontDoor
    globals.css      # minimal base (lets SLDS own the look)
  lib/
    db.ts            # server-only Postgres pool and transaction boundary
    application/     # validated commands, legacy codec, and remote client adapters
    agent/           # independent contracts, demo adapters/policy, and request client
    server/          # authenticated sessions, scoped repository, and application service
    assessment/      # run state, historical finding snapshots, and codecs
    projects/        # planning projects, work items, drafts, and commands
    onboarding/      # demo assessment fixtures and legacy import adapter
    chat/            # conversation models and bounded Today snapshots
    navigation/      # destinations, shared resolution, and navigation controller
    surface-canvas/  # typed canvas identities, legacy migration, and local tab preferences
    workspace/       # shared projects, orgs, selections, and fixtures
  components/
    navigation/      # router/store adapter for navigation intents
    onboarding/      # assessment home and ALM project plans
    surfaces/        # capability definitions, typed renderer registry, and tabs
    canvas/          # shared CanvasLayout and its styles
  worker.ts          # separate durable agent-worker process entry point
db/
  migrations/        # ordered application schema changes and recorded checksums
```

## Conventions

- Query Neon only from **Route Handlers**, **Server Actions**, or **Server
  Components** — never from client code. `src/lib/db.ts` is guarded by
  `server-only`.
- Keep `globals.css` lean; prefer SLDS classes and styling hooks over hardcoded
  values.
