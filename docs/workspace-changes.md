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

Fetched main baseline: `6732e78e9850274864ce2aa14d27a80e3b801e41`.
The branch's initial content matched that baseline.

During the project-creation navigation follow-up, main advanced to
`bda0165230fce19a53ea7cf8ab8f1a149fd2cee0` (PR #18, idle workers/browser
suspension). Those upstream changes are not yet integrated into this worktree.
The current-main comparison therefore shows missing upstream idle-worker files
and tests; this UI patch does not remove them or authorize their removal. Retain
PR #18 through normal integration before publishing the branch. Local UI
verification below does not establish parity with that newer main.

| Affected behavior | Disposition and evidence |
| --- | --- |
| Project selector, centered search/shortcut, Home, palette, preview/profile/panel controls | Retained; equal header side columns keep search viewport-centered while the new indicator stays beside the selector. `workspace-changes.mjs` checks centering and non-overlap from 390–1920px in global/project scope. |
| Project explorer and portable context exports | Retained; shared work-file path construction preserves filenames/content. Existing `project-explorer.mjs` and `project-explorer.test.mjs` remain registered. |
| Project creation, saved draft ownership and assignment | Creation entry adapted: Start project explicitly opens global ALM, retaining the org, then enters the newly created project. `project-panel.mjs` and `project-create-end-to-end.mjs` check leaving a project/worktree, Back, preserved global drafts and new-project entry. Existing saved scopes, commands and schema are retained. Global tracking now moves files as explicitly requested, using atomic transfer/new-project commands and checks for global removal, reload, collision and replay. Explicit editor copy actions remain available outside project creation. |
| Sample repository file contents | Retained; only optional comparison metadata was added. |
| Org metadata browsing and Account fields | Adapted only for explicit Account field additions. Browsing remains free of draft writes, unrelated metadata stays read-only, and captured org/project/worktree scope is retained. `org-setup.mjs` and `org-resources.mjs` remain registered; `object-field-changes.mjs` covers additions, removal, global review and transfer during creation. Existing arbitrary-metadata-write rejection remains checked. |
| Existing tests | Retained. New browser suite is registered in `scripts/browser/suites.mjs`; pure checks join `test:domain` and the release test discovery. |

The global tracking copy behavior was replaced with moves at the user’s request. The transfer-summary, draft-copy and assessment-promotion panels were removed from project creation on explicit request. Assessment-based creation remains available through Home opportunities and its saved review flow. Existing unrelated behavior and tests are retained; the registered tracking checks now verify transfer semantics.

## Validation

- Production Next.js/worker build and TypeScript passed on Node 22.23.2.
- Lint passed with the existing `src/app/layout.tsx` stylesheet warning.
- 41 domain checks passed (37 existing checks plus four new changes checks).
- Registered `workspace-changes` and existing `project-explorer` browser suites
  passed against the local preview with isolated fixture data and no model calls.
- Reviewed desktop dark, mobile light and global assignment screenshots in
  `/home/omarchy/.cache/omarchy-herdr/build-tmp/ufd-browser-results/tracking-changes-*.png`.
- Final main refresh remained at the baseline above; content review removed no
  features or tests at the initial changes-indicator handoff. The later main
  advancement is recorded above. The full database/release gate was not run.
- Project-creation navigation follow-up: production/worker build, 39 navigation
  and project-creation pure checks, and registered `project-panel`,
  `project-create-end-to-end`, and `project-creation` browser suites passed.
  Lint has only the existing stylesheet warning.
- Global zero-state follow-up: the registered `workspace-changes` browser suite
  passed, including hidden-at-zero, first-edit appearance, clearing edits and
  returning to Home. Centered search, project files and tracking checks also
  passed. Targeted lint and whitespace checks passed.
- Account fields follow-up: production/worker build and TypeScript, 63 focused
  domain/application/navigation checks (including reruns after correction), and
  registered `object-field-changes`, `workspace-changes`, `org-setup` and
  `org-resources` browser suites passed. Lint has only the existing stylesheet
  warning; later edited files pass targeted lint. Desktop dark and mobile light
  form screenshots were reviewed. Browser data used isolated fixtures.
- Added a database-gate check for field save/copy/replay and merged-name
  validation. It was not run locally: no isolated test database is configured,
  and automatic approval review blocked Docker privilege escalation. The full
  database/release gate remains outstanding.
- Refetched current main for the Account follow-up: still
  `bda0165230fce19a53ea7cf8ab8f1a149fd2cee0`. Reviewed its content/test diff;
  the upstream idle-worker integration caveat above still applies. This follow-up
  retains the existing tests and adds registered coverage for Account editing.
- Transfer and creation-screen follow-up: 67 focused pure/application/navigation
  checks, the registered changes and Account-field browser suites, and existing
  project-panel and project-create-end-to-end browser suites passed. The final
  Account flow recheck confirms both requested panels are absent while transfer
  selection survives reload. Production/worker build and TypeScript passed;
  lint has only the pre-existing stylesheet warning. Database-gate checks now
  include atomic batch transfer, stale-source rejection, creation rollback and
  receipt replay; they remain unrun locally for the limitation above.
- Refetched/reviewed main again at `bda0165230fce19a53ea7cf8ab8f1a149fd2cee0`;
  the upstream integration caveat is unchanged. Global tracking's former copy
  expectations were replaced with the user-requested move behavior; no unrelated
  checks were removed.
- Assessment-promotion panel removal: registered `project-create-end-to-end`
  and `project-creation` browser suites passed, including all-profile creation
  without the panel and retained assessment-based creation from Home. Targeted
  lint and whitespace checks passed. Reviewed the component diff against the
  recorded main baseline; only the explicitly requested panel is removed.
