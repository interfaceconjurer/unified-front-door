# Workspace changes

The header indicator sits immediately after the project selector. In global
scope it occupies the same header area and includes only unassigned drafts,
even when a project canvas is being inspected from Home. The global indicator
stays hidden at zero, appears with the first edit, and hides again if all changes
are cleared. Project scope includes
only that project/worktree's files and drafts. Opening the popover or a file
does not submit an agent request.

The popover lists file status, added/deleted line counts and an action to open
each file or its original editor. Escape returns focus to the trigger; outside
clicks and moving focus outside dismiss it. The narrow layout keeps the compact
count in the header and the popover within the viewport.
The search field and its shortcut stay centered in the viewport, with equal
space reserved for the controls on either side; mobile keeps its full-width
search row.

## What is compared

- Saved project context exports (`.project/project.json` and
  `.project/work-items.json`) are new files. Counts use their current generated
  content, including saved work-item updates, and survive reload.
- Sample branch files use their modeled base content. The AccountSearch sample
  supplies an explicit prior revision; existing displayed file contents stay
  unchanged.
- Edited work source compares with the editor's original source; restoring that
  source removes the edit. Notes and capability fields appear as new `.drafts`
  files. Empty, merely opened drafts are excluded. Capability fields are counted
  as a stable JSON representation, and opening a row returns to its editor.
- Build & Setup → Object Manager → Account supports adding a field with a label,
  API name and Text, Number, Checkbox, Date or Email type. The API name is
  suggested from the label and remains editable. Duplicate names and unsupported
  values are rejected in the form and command boundary; merged fields are also
  checked before server writes. Removing an added field reverses that addition.
- Account additions are scoped overlays on demo metadata, saved through the
  existing revisioned canvas store. Merely browsing or cancelling creates no
  saved draft. `.orgs/{org}/objects/Account.object.json` compares the captured
  fields with current additions; one object remains one modified file even with
  multiple additions. Opening the change returns to that Account editor. These
  JSON representations do not deploy metadata to Salesforce.

These are workspace changes, not a live Git status. There is no connected Git
index, commit/staging operation, filesystem watcher or commit baseline for saved
project exports. Saving a draft does not imply committing it.

## Global tracking

Only global scope offers **Track in a project**. Its primary action is
**Create a new project**. **Use an existing project** reveals a picker; only
selecting a project reveals **Transfer changes**. These actions move the selected
changes out of global scope and into the project's primary worktree (or project
scope when there is no worktree), retaining each file's original org.

Existing-project transfers use one revisioned `changes.transfer` command. The
server checks every source revision and destination before inserting any files,
and clears the original fields in the same transaction. Empty source records
advance their revision so stale editor saves cannot restore transferred changes.
Destination collisions preserve both sides; receipt replay cannot duplicate a
transfer. The client removes global changes only after an acknowledged refresh,
and enters the destination project after success.

New-project creation opens the existing global ALM brief with the selected
source identities/revisions attached. That selection survives reload, and the
**Create project and transfer changes** action creates the project and moves
its files in one transaction. The creation screen omits both the transfer
summary banner and the Unbound draft/copy panel, as requested. Ordinary sidebar
Start project clears any earlier transfer selection, preserving the source files.

Saving/recovery must finish before either transfer action proceeds. Cancelling
or leaving creation does not move files. Explicit copy actions elsewhere retain
their prior copy semantics; the global tracking flow uses transfers.

## Product retention review

Started from main `6732e78e9850274864ce2aa14d27a80e3b801e41` and fetched
current main `bda0165230fce19a53ea7cf8ab8f1a149fd2cee0` before publication.
Integrated that revision with an ordinary content merge. The final content diff
against current main retains PR #18's idle-worker and browser suspension code,
documentation and tests. No existing test files were removed. The shared browser
registry includes both new tracking suites and the upstream idle-suspension suite.

| Affected behavior | Disposition and evidence |
| --- | --- |
| Project selector, centered search/shortcut, Home, palette, preview/profile/panel controls | Retained; equal header side columns keep search viewport-centered while the new indicator stays beside the selector. `workspace-changes.mjs` checks centering and non-overlap from 390–1920px in global/project scope. |
| Project explorer and portable context exports | Retained; shared work-file path construction preserves filenames/content. Existing `project-explorer.mjs` and `project-explorer.test.mjs` remain registered. |
| Project creation, saved draft ownership and assignment | Creation entry adapted: Start project explicitly opens global ALM, retaining the org, then enters the newly created project. `project-panel.mjs` and `project-create-end-to-end.mjs` check leaving a project/worktree, Back, preserved global drafts and new-project entry. Existing saved scopes, commands and schema are retained. Global tracking now moves files as explicitly requested, using atomic transfer/new-project commands and checks for global removal, reload, collision and replay. Explicit editor copy actions remain available outside project creation. |
| Sample repository file contents | Retained; only optional comparison metadata was added. |
| Org metadata browsing and Account fields | Adapted only for explicit Account field additions. Browsing remains free of draft writes, unrelated metadata stays read-only, and captured org/project/worktree scope is retained. `org-setup.mjs` and `org-resources.mjs` remain registered; `object-field-changes.mjs` covers additions, removal, global review and transfer during creation. Existing arbitrary-metadata-write rejection remains checked. |
| Idle-worker release and browser suspension | Retained from current main, including worker wake/recovery, inactivity suspension, measurement tooling and registered checks. The application client combines idle handling with browsing that creates no empty metadata draft. |
| Existing tests | Retained. New browser suite is registered in `scripts/browser/suites.mjs`; pure checks join `test:domain` and the release test discovery. |

The global tracking copy behavior was replaced with moves at the user’s request. The transfer-summary, draft-copy and assessment-promotion panels were removed from project creation on explicit request. Assessment-based creation remains available through Home opportunities and its saved review flow. Existing unrelated behavior and tests are retained; the registered tracking checks now verify transfer semantics.

## Validation

After integrating main:

- All 320 non-database tests passed: 220 pure checks and 100 server-condition
  checks, using the release gate's test discovery and Node 22.23.2. This includes
  the upstream worker-loop and browser-activity checks.
- Production Next.js/worker build and TypeScript passed.
- Lint passed with the existing `src/app/layout.tsx` stylesheet warning.
- Five registered browser suites passed: `workspace-changes`,
  `object-field-changes`, `project-create-end-to-end`, `project-creation` and
  `idle-suspension` (19 check groups, no browser errors). The idle check observed
  zero refresh reads across ten simulated minutes and immediate resumption.
- Merge integrity passed; final content review against the fetched main found
  no removed upstream files or tests.

During implementation, registered `workspace-changes`, `object-field-changes`,
`project-panel`, `project-explorer`, `project-create-end-to-end`,
`project-creation`, `org-setup` and `org-resources` browser suites passed with
isolated fixture data and no model calls. Desktop dark and mobile light layouts
were inspected; tracking checks cover search centering at 390–1920px.

Database-gate checks cover Account field save/copy/replay, merged-name validation,
atomic batch transfer, stale-source rejection, project-creation rollback and
receipt replay. They were not run locally because no isolated test database is
configured and automatic approval review blocked Docker privilege escalation.
The PR database shard runs them with disposable PostgreSQL; the full local
release gate remains unrun.
