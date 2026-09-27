# Agentic harness and plugin model study

Open `/prototypes/agent-harness.html` on a running Unified Front Door server.
The page is self-contained HTML with sample data and simulated actions. It can
also be served from `public/` with a static HTTP server. It makes no model,
database, Salesforce, or external service calls. Palette preferences are saved
only in this browser.

## Review paths

- The default view is Plugin model, with Plugin selected and the Plugins palette open.
- Harness integration follows Plugin model in the study navigation.
- `#thread`: one capability in the conversation; no working-set nudge.
- `#desk` or `#working-set`: the expanded capability working set.
- `#working-set-summary`: the agent's invitation to review the related artifacts.
- `#beside`: a dedicated capability surface alongside the conversation.
- `#model`: the plugin contribution model and generic harness schematic.

The working-set example opens expanded. Collapse to summary reveals its nudge.
View more opens the same artifact in the workbench and collapses the review
card; Review together closes the workbench and expands the collection again.
Earlier conversation messages and the shared draft remain intact. Editing the
draft invalidates its sample checks until evaluation runs again.

## Contribution and discovery model

A plugin packages a team's domain. It contributes discoverable capabilities,
which may present interactive surfaces. A capability can return a result without
UI; several capabilities can share a surface. Specialist agents are optional.

Capabilities and Plugins are separate palette tabs. The tab order is All,
Capabilities, Projects, Sessions, Orgs, Resources, Plugins. Installing a sample
plugin makes its actions available in Capabilities; source links lead back to
its package. Planning, Building, Testing, Releasing, and Observing categorize
capabilities across plugins. Personal visibility and pinning affect discovery.

Both study tabs use one shared compact card renderer and stylesheet: the same
spacing, 14px headings, 13px base text, selection/focus behavior, harness preview,
and bottom controls. The contribution diagram keeps arrow-only connectors;
its metadata appears in the existing detail section below the schematic.
Padding separates the choice cards from the preview in both views, with the card
row inset from the preview's left and right edges. On narrow screens the cards
stack vertically.
The outer study frames are removed. Both views, palettes, and dialogs use only
blueprint blue (`#285288`) and warm paper (`#f7f4eb`), with thin outlines instead
of shadows or gradients. Double outlines, dashed result borders, and inverted
controls distinguish selection and focus without introducing more colors.
The Harness integration section label is "Plug-in capability presentation layers".
Twelve-pixel text is permitted only sparingly; this version needs no exceptions.

The linked [earlier navigation study](../../public/prototypes/navigation-study.html)
is retained as historical context. Its return link leads to the current study.
Download HTML exports the current self-contained page. Neither study changes
production navigation, agent behavior, persistence, or authentication.

## Verification and main retention

This worktree started from fetched `origin/main`
`5372e0e79e78ac443db6d8d7d0750aaf087f173a`. The content diff adds design artifacts,
documentation, and the registered `agent-harness-prototype` browser suite.
Existing application code and tests are retained; no product feature is replaced
or removed. The suite runs through the existing PR shards and full release gate.

Against a running server:

```bash
BROWSER_TEST_ORIGIN=http://127.0.0.1:3000 node scripts/browser/agent-harness-prototype.mjs candidate
```

The suite covers presentation defaults and transitions, shared artifact state,
palette/plugin discovery, compact card consistency, two-color rendering, text
size, keyboard access, mobile containment, and links to the
downloadable/current/historical studies.
