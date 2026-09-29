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
- `#working-set` (also `#desk` or `#working-set-summary`): the capability working set,
  opening on the agent's summary of the related artifacts.
- `#working-set-expanded`: the working set with its artifacts expanded.
- `#beside`: a dedicated capability surface alongside the conversation.
- `#model`: the plugin contribution model over the same harness UI with generic
  placeholder content.

The working-set example opens on its summary: the gathered artifacts and a Review
together action. Review together expands them in the conversation.
View more opens the same artifact in the workbench and collapses the review
card; Review together closes the workbench and expands the collection again.
Earlier conversation messages and the shared draft remain intact. Editing the
draft invalidates its sample checks until evaluation runs again.

A workbench icon button at the end of the harness top bar is the only control
that opens and closes the workbench panel; its pressed state shows whether the
panel is open. The panel has no close or Open capability controls of its own, and
the conversation has no separate toolbar or Expand working set action — Review
together expands the working set. The workbench lists only surfaces opened during
the task, using titles supplied by their capabilities. Capabilities chosen from
the top bar's palette and related artifacts open views in it. Views can be
switched or closed in any order, and closing a view preserves its shared
artifact. Closing the last view returns space to the conversation; hiding the
workbench preserves its open views.
Evidence, Draft, Checks, and Review are no longer fixed workbench tabs. The
routing story remains sample content illustrating the generic host; each
capability owns the controls and workflow inside its own surface.

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
The section label, choice cards, and harness preview share one left edge, with
spacing on a single 4px scale. On narrow screens the cards stack vertically.
The outer study frames are removed. A faint grid covers the page background. The
harness, palette, and dialogs are plain sheets on it, separated by thin outlines and
a soft lift. Corners follow one radius scale — 3px for chips and marks, 6px for
controls and cards, 10px for sheets — so nested curves step down. Everything is
drawn in one ink at three weights — full ink for headings and actions, a lighter ink
for supporting copy, and pale rules for inner structure.

Five subtle surface tones carry the hierarchy: the desk (page), sheets (frames and
palette), chrome (header, filter, and card head/foot bars), insets (working areas
such as the working set, workbench, palette preview, and prior-behavior wells), and
raised cards (surface cards, inputs, and buttons). Section labels
run into dimension lines; dotted rules divide rows, dashed outlines mark prior or
placeholder states, and a left rule marks callouts. Selection is a light ink wash
rather than an inverted fill; primary actions stay solid. The command palette lifts
above a softened view of the page. All text keeps at least 4.5:1 contrast.

Light and dark appearances share every token. Light is monochromatic orange:
burnt-orange ink (`#7a2f0b`) on warm paper (`#f4ece2`), with every tone, rule, and
wash drawn from that one hue. Dark is a classic blueprint, pale lines on deep blue
(`#0f1f37`). The page
follows the system appearance until the reader uses the sun/moon toggle in the
study header; that choice is saved only in this browser. Printing always uses the
light appearance.
Each choice card leads with its icon in a tile on the left, vertically centered
against the copy; the ordinal (01, 02, 03) prefixes the eyebrow. Selection fills the
tile with ink. Inside each icon, the part being called out is solid and the
surrounding conversation is faded — for 03, the full-height workbench panel.
Plugin model and Harness integration render the same harness UI: one top bar,
conversation, composer, workbench panel, palette, and footer. Plugin model fills
it with generic placeholders. When Surface is selected, its workbench panel
carries the same emphasis as the selected card: an ink-tinted pane with a heavy
ink divider, a "03 · Surface" tag, and a double-weight outline around the
domain-owned interaction, while the agent session's placeholders recede. Status marks in trace and check rows are drawn icons centered
in their circles rather than text glyphs.
Both harness previews share one height: 720px, or 560px on narrow screens. Plugin
model's palette fits inside that frame and scrolls within itself.
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
palette/plugin discovery, compact card consistency, shared left edges, text contrast in light and dark appearances, appearance
persistence, text size, keyboard access, mobile containment, and links to the
downloadable/current/historical studies.
