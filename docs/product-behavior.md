# Product behavior and saved data

[← README](../README.md)

## Global Home and project resumption

Home (including a bare `/` URL, the Home icon, and the platform wordmark) is
global: it leaves the project and branch while retaining the selected org.
Today summarizes accessible work across projects and branches, showing
attention items first and labeling each work item with its project and branch.
The returning developer's briefing uses the existing demo work and session data.
The Home icon is blue while in global context, including global surface browsing.
Clicking it on the active Today card does nothing. Returning from a surface or
project closes the surface and appends a fresh Today; existing history and the
selected org remain. Retrying that request does not duplicate the card.

Global resource browsing shares one conversation and composer draft across orgs.
Changing the target org appends a context marker without replacing the thread;
accepted agent work keeps its captured target. Earlier org-specific threads remain
available under **Earlier conversation** in the global transcript.
Leaving Today for a surface or canvas keeps its headings, cards, surface tiles,
and recent-work rows in the same layout. Colors become subdued, controls are
disabled, surface links become static tiles, and the conversation continues below
the captured briefing. History stays readable and does not replay the entrance
animation. Responsive wrapping still follows the chat column width.
Active Today content reveals in reading order with overlapping 500ms blur/rise
animations staggered by 75ms. The reveal pauses while the transcript is hidden or
a page transition is active. Historical briefings stay static, keyboard focus
reveals its target immediately, and reduced motion disables the animation.

Project/worktree rows and session rows resume that line of work's last surface,
canvas, and org. Destinations are browser preferences scoped to the signed-in
namespace, profile, and workspace epoch; they survive reload and are independent
per worktree. Explicit links and browser Back/Forward keep their own destinations.
With no remembered view, existing conversation context or the latest demo work
provides the starting point; a new planning project opens its ALM plan.

Project conversations retain their messages and reading position instead of
appending Today on re-entry. Old project Today entries remain stored but are
hidden in the project transcript. An empty project thread gets a one-time
introduction based on its saved plan or existing work. No GitHub synchronization
is claimed: project records do not yet include a repository connection.

Canvas tabs in a project include only that project's work, apps, resources, and
drafts. Selecting or closing a tab cannot switch to another project. Global
surface browsing can show tabs from multiple projects; selecting one enters its
captured context. Tabs hidden by project scope and their drafts stay saved.

## Day zero: org assessment

Choose **Sam Patel — Day zero · Org assessment** on sign-in, or switch to Sam
from the avatar menu. The agent automatically starts a simulated read-only
assessment of the connected orgs in Sam's demo workspace.
Sam's workspace offers **Build & Setup** and **ALM**, matching Karen's simpler navigation.

The front door and surfaces share one persistent agent panel and composer.
Switching projects/worktrees, or navigating between Home and a surface, dissolves
the outgoing conversation and canvas with a strong 24px blur, then brings the new
content into focus over a combined 500ms. The composer's 440ms layout movement
runs alongside it; its text stays sharp and the input remains mounted. Draft text,
text selection, and session conversations survive client-side navigation home and
back. Org-only changes keep the continuous transcript without a dissolve.
Reduced-motion preferences skip the transitions.

The transcript and composer share a 1200px maximum width. They center when both
workspace and surface panels are closed, and align to the left of the available
chat area when either panel is open. Width and alignment animate on the panel
timeline, preserving the mounted composer and its selection. New turns wait for
that geometry to settle and scroll to the transcript's configured top inset.
Narrow layouts remain full width; reduced motion applies layout changes immediately.

Agent replies render as plain text; user messages keep their bubbles. Suggested
prompts appear after a successful reply completes, together with all received
text. Pending, preparing, and streaming replies keep suggestions hidden; failed
or cancelled replies retain their status and recovery controls. Static greetings
and completed history appear immediately, without simulated streaming. Long
replies follow into view until the reader scrolls away.

Switching between surfaces uses a separate 500ms canvas swap: the incoming surface
lands in front while the outgoing surface recedes, blurs, and fades away. The agent
and composer stay in place. Next's view-transition integration captures the outgoing
canvas without keeping a second live surface mounted; browsers without support and
reduced-motion users get an immediate swap. Browser Back/Forward restores the
addressed workspace destination without replaying the surface animation. The home
transition remains separate.

Switching canvas tabs within the same surface and conversation uses the same
recede/land effect on the canvas body alone. The tab strip, chat, and composer
stay sharp and stationary. Selecting the current tab does not replay it; rapid
keyboard selection advances from the focused tab. Project/worktree changes take
precedence and use the conversation dissolve. Reduced motion skips the effect,
and Back/Forward restores the selected canvas without replaying it.

Canvas content shares `src/components/canvas/CanvasLayout.tsx`: responsive gutters
and a left-aligned inner column capped at 72rem. `SurfaceCanvasHost` supplies it
once for every overview and launched tab, so canvas bodies provide content without
their own outer padding, centering, or width limits.

The command palette puts the current surface, project group, session, or org first
in its tab. Projects keep their worktrees nested and connected, with the current
worktree highlighted in place when opening or switching tabs. One Down press
selects another destination. Search filters normally and resets the highlight to
the first match; clearing it returns the highlight to the current destination.
Opening and closing use the front-door chat's 500ms fade and 24px blur. A selection
takes effect after dismissal completes, and reopening during dismissal reverses
the transition and cancels the pending selection. Reduced motion skips the dissolve.
The palette uses a shared native-dialog interaction owner. Tab/Shift+Tab stay
inside it, Escape works throughout the dialog, and closing restores trigger focus.
Left/Right move between palette tabs when a tab has focus; in the search input
they retain normal text-caret behavior.

The top bar provides a wide **Search workspace** launcher on every surface
(⌘⇧P / Ctrl+Shift+P). When a project is selected, a project badge shows its name
and branch; clicking it opens the palette's Projects tab. A Home icon to its left
returns to the global front door, clearing project and branch while retaining the org.
Existing tabs remain available; switching surfaces keeps the current scope,
while explicitly selecting an existing tab restores that tab's captured scope.
On narrow screens,
the search launcher occupies a second row so project context stays visible.

The **Resources** palette tab browses a connected org's demo metadata without
requiring a project. Choose an org, filter by resource type, and search names,
API names, descriptions, or categories. The catalog includes standard/custom
objects, fields, flows, access configuration, interface metadata, integrations,
Apex, Lightning components, reports, and dashboards. Surface access filters
both search results and related-resource links.

Selecting a resource opens a read-only canvas in its applicable surface:
configuration in Build & Setup, code in Code, and sharing rules/analytics in
Govern & Observe. Details, fields, flow steps, and related resources support
traversal. Each canvas captures its org, resource type, API name, and current
project/branch when present; reopening
focuses the existing tab, while the same resource in another org gets a separate
tab labeled with its org. Resource and related-resource navigation preserve the
active project and branch, including when choosing another org in the palette.
Resources opened globally stay global; older org-only links retain that scope.
The metadata is
explicitly marked as demo data; this does not query a live Salesforce org or
save an editable resource draft.

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

Historical Today cards render compact summaries of their captured snapshots without
interactive actions or live assessment, workspace, or agent subscriptions.
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
[Phase 6 journal](../docs/phases/phase-6-ui-reliability.md) records behavior, exact
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

Opening a capability captures the selected project, worktree, and org. A pre-project
draft is **Unbound** and retains the selected org when present. Legacy globally keyed
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

While signed in, choose **Sign out** in the profile menu to return to the user
selection screen. Data clearing is available there beside each profile, with a
confirmation naming the user whose saved data will be removed.
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
the [durable execution boundary](agent-runtime.md). Unsent composer drafts survive client
navigation in this page only.
Navigation acknowledgements include the updated conversation, so the page does
not wait for another history fetch. The Agent header shows a waiting state during
updates, a longer-wait message after five seconds, and reconnecting feedback for
temporary interruptions. Entries fade in as scrolling begins. See the
[chat integrity and latency review](chat-performance-review.md).
The page holds at most 16 nonempty unsent composer drafts, each at most 8,000
characters. An additional draft is visibly rejected without removing existing
text; sending an acknowledged message or clearing a draft frees its slot.
Capability/work canvas text controls allow up to 16,000 characters per field.
Longer previously saved values stay intact and can be shortened; the server's
65,536-byte UTF-8 aggregate field limit still applies. Copying an unbound draft
to a project requires its save/recovery to finish first.

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
