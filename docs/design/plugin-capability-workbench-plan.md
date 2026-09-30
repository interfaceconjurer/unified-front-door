# Plugin → capability → workbench: integration plan

[← Agentic harness study](agent-harness-prototype.md)

Status: implemented on branch `plugin-model`. Baseline: fetched `origin/main`
`69a0e635a6fad34ecc84df89f597aca421589c49` (includes PR #22).

## Decisions (approved)

1. The four surfaces become first-party plugins whose ids are the old surface
   ids: `build` (Build & Setup), `code` (Code), `govern` (Govern & Observe),
   `alm` (ALM). Routes `/build`, `/code`, `/govern`, `/alm` stay and mean “the
   plugin of the active workbench view”.
2. No pinned Overview tab and no surface switcher. Each plugin’s former
   overview becomes an ordinary closable view (“<Plugin> overview”). A bare
   plugin route opens that view. The palette replaces the switcher.
3. Access is per plugin: `surfaceAccess` keeps its values per profile and is
   read as plugin access. Capability access follows plugin access; server
   checks are unchanged.
4. Canvas ids, destination links, `canvas_drafts.surface_id`, conversation
   `scopeKey`, and agent destination ids are unchanged. The only migration is
   browser tab preferences: per-surface slices become one workbench list.
5. Plugin install is simulated per profile in browser storage. Accessible
   plugins start installed; plugins outside a profile’s access cannot be
   installed. Uninstalling hides that plugin’s capabilities and closes its
   views; drafts and captured targets are retained and return on reinstall.
6. Every view kind has an owning plugin and a named capability (table below).
7. The “Front Door” palette row is removed with the Surfaces tab; the Home icon
   and wordmark still return home.
8. Stage tags follow the capability table below.
9. An empty workbench (toggle pressed with no open views) shows a state that
   prompts the user to choose a capability and opens the palette’s
   Capabilities tab.

## Mapping

### Plugins

| Plugin id | Name | Publisher | Version | Access (unchanged) |
| --- | --- | --- | --- | --- |
| `build` | Build & Setup | Salesforce Platform | 1.0.0 | sp, kf, jw, am |
| `alm` | ALM | Salesforce DevOps | 1.0.0 | sp, kf, jw, am |
| `govern` | Govern & Observe | Salesforce Trust | 1.0.0 | jw, am |
| `code` | Code | Salesforce Developer Experience | 1.0.0 | am |

Descriptions reuse the existing `app-catalog` copy.

### Capabilities (existing definitions, plus ALM stage tags)

| Plugin | Capability id → name | Stages |
| --- | --- | --- |
| build | `object-manager` Object Manager | Building, Observing |
| build | `access-permissions` Access & Permissions | Building, Observing |
| build | `org-settings` Org Settings & Features | Building, Observing |
| build | `data-model` Model your data | Planning, Building |
| build | `automation` Build an automation | Building |
| build | `agent` Create an agent | Building |
| build | `experience` Build an experience | Building |
| code | `sfdx-project` Start an SFDX project | Planning, Building |
| code | `react-app` Build a React app | Building |
| code | `apex` Write Apex | Building |
| code | `query` Query your data | Building, Observing |
| code | `tests` Create & run tests | Testing |
| code | `agent` Create an agent | Building |
| code | `toolkit` Your toolkit | Building |
| govern | `security` Review security | Observing |
| govern | `health` Monitor platform health | Observing |
| govern | `policies` Define a policy | Planning, Releasing |
| govern | `agent-activity` Observe agent activity | Observing |
| alm | `project` Start a project | Planning |
| alm | `work` Plan your work | Planning |
| alm | `pipeline` Set up a pipeline | Releasing |
| alm | `validation` Validate a change | Testing, Releasing |
| alm | `release` Prepare a release | Releasing |

Capability identity stays `(plugin, capability)`, so Build’s and Code’s
`agent` remain distinct. Every plugin also contributes an **Overview**
capability (`overview`) presenting its former overview content.

### Other view kinds (decision 6)

These already exist; they now name their plugin and capability in the view
header. Their surface assignment is today’s `canonicalCanvasSurface` result.

| Canvas kind | Plugin | Capability shown |
| --- | --- | --- |
| `org-resource` | per `RESOURCE_TYPES[type].surface` (build or code/govern) | Browse org resources |
| `org-assessment` | build | Assess your org |
| `work-item-change` | build | Change a work item |
| `preview` | build | Preview project |
| `project-file` | per file’s surface | Browse project files |
| `work` | per work item’s surface | Continue work |
| `app` | alm | Deployed app |
| `improvement-project` | alm | Project plan |
| `capability` | `params.surface` | the capability’s own name |

Every view shows: plugin name, capability name, and context chips (org,
project/worktree or Unbound, target where captured).

## Data migration (browser preferences only)

Today: `ufd.canvas-preferences.v3.<owner>.<conversationKey>` stores
`Record<SurfaceId, { canvases, activeCanvasId, closedDrafts, targets, recovery }>`.

The migration is additive, in the same key. Per-plugin slices stay exactly as
they are, so their drafts, captured targets, recovery records and per-plugin
last view keep their current semantics and code paths. One optional field is
added:

```
workbench?: {
  views: string[];        // workbench order: "<plugin>:overview" or a canvas id
  active: string | null;  // one active view across plugins
}
// Panel visibility stays in the selection store (`surfacePanelOpen`).
```

- Missing `workbench` (all existing data): derive `views` from the slices in
  plugin order (build, code, govern, alm), then each slice’s tab order. The
  route’s own plugin contributes its `<plugin>:overview` view first when its
  slice’s `activeCanvasId` is `overview`; other slices’ overviews are not
  opened. `active` is the route plugin’s active view.
- Opening a canvas appends to `views` (or focuses it); closing removes it and
  closes the slice tab through the existing `closeCanvas`, so drafts persist
  as closed drafts exactly as today.
- Older builds ignore the extra field, so a rollback still reads every slice.
- Original legacy bytes are never rewritten or deleted.
- `OPEN_CANVAS_LIMIT` (20) keeps applying per plugin, as today.
- Legacy v2 and older inputs continue through the existing parse path first.

URLs: unchanged. A destination with `surface: X` and no canvas now means
“open X’s overview view” (it previously meant “show X’s pinned overview”).

## Feature-retention table

| Existing behavior | Disposition | Replacement check |
| --- | --- | --- |
| Palette tab order all, surfaces, projects, sessions, orgs, resources | Adapted → All, Capabilities, Projects, Sessions, Orgs, Resources, Plugins | `unified-search`, new `plugin-workbench` |
| Surfaces palette tab (Front Door + 4 surfaces) | Adapted → Capabilities (overview capabilities included). The “Front Door” palette row is removed; the Home icon and wordmark remain | `unified-search`, `interactions`, `expansion-profiles` |
| All ordering projects/resources/sessions/orgs/surfaces | Adapted → projects/resources/sessions/orgs/capabilities/plugins | `unified-search`, `palette-search.test` |
| Pinned surface tab returns to overview | Adapted → overview is a view opened from Capabilities, Today or a bare route | `workbench-switching` (replaces `surface-switcher`) |
| Surface switcher chevron + menu keyboard | Removed (approved, decision 2); keyboard coverage moves to workbench tabs and palette | `plugin-workbench`, `workbench-switching` |
| Per-surface open-tab sets, per workspace | Adapted → one workbench list per workspace; home/project isolation retained | `workspace-tabs`, `project-surface-scope` |
| Tab close keeps draft, neighbor selection, Delete/Backspace, arrows | Retained | `canvas-motion` |
| Whole-surface swap animation | Adapted → plays when the active view’s plugin changes | `canvas-motion` |
| Top-bar Show/Hide surfaces toggle (⌘⇧B) | Adapted → “Workbench”, pressed state, same shortcut | `profile-start`, `org-sign-in`, `plugin-workbench` |
| Toggle with no surface navigates to Build | Adapted → toggles the workbench; with no views it prompts to choose a capability (opens Capabilities) | `plugin-workbench` |
| Today “Explore surfaces” links | Adapted → “Explore capabilities”, links open plugin overviews | `global-home`, `today-departure`, `session-chat` |
| Login surface chips | Adapted → plugin chips | `org-sign-in` |
| Chat header surface badge | Retained (label = active view’s plugin) | `chat-latency` |
| Agent `open_surface` / `open_canvas`, starters, demo surface replies | Retained (ids unchanged; labels say plugin) | `agent-navigation`, `starter-canvases` |
| Access by profile, blocked direct routes | Retained | `expansion-profiles`, `demo-profiles.test` |
| Saved drafts, open tabs, links, legacy aliases | Retained through migration | new migration unit tests; `alm-app-migration`, `workspace-tabs` |
| Project/Global scoping of views | Retained | `project-surface-scope`, `global-home` |
| Plugins tab, install/uninstall, capability→plugin links, stage filter | New | `plugin-workbench` |

## Behavior proof order

1. Add `scripts/browser/plugin-workbench.mjs` and register it. It fails on main:
   palette tabs, Plugins tab, workbench toggle label, view header.
2. Add unit tests for the preference migration and plugin catalog
   (`test:navigation` / `test:persistence`), failing before implementation.
3. Implement; update the suites listed above through the same UI.
4. Run targeted unit suites, affected browser suites against a local production
   build, `npm run lint`, `git diff --check`.

Browser suites mock `/api/session`, `/api/agent` and `/api/application`. The
local production server for them runs with a deliberately unreachable local
`DATABASE_URL`, not the shared Neon URL, so no browser check can write to
shared data. Database suites are not run without an isolated test database.

## Out of scope

Database schema changes, real package installation, per-capability access
lists, and removing the `/build`–`/alm` routes.

## Verification record

Run against a local production build started with demo agent mode and a
deliberately unreachable local `DATABASE_URL` (no shared Neon access). Browser
suites mock the session, agent and application APIs.

- `plugin-workbench` (new, registered) failed on main at its first product
  assertion (the surfaces toggle still existed) and passes on this branch:
  16 check groups in normal and reduced motion, legacy migration and a
  restricted profile.
- All 47 registered browser suites pass; `surface-switcher` is replaced by
  `workbench-switching` with the same guarantees for workbench views.
- Pure suites (persistence, domain, navigation incl. `plugins.test.mjs`,
  onboarding, conversation, application, cli, agent, client-reliability,
  operations, worker-idle, model, and the unregistered-script tests): 339 tests
  pass. `npm run lint` has 0 errors (one existing warning on main), `tsc
  --noEmit` passes, `git diff --check` is clean.
- Not run: database and agent-database suites, the live-database browser
  journeys, worker recovery, and the performance protocol (they need an isolated
  `DATABASE_TEST_URL`). No migration, deployment or provider call was made.
