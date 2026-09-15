# Unified Front Door

A React prototyping environment that mimics the Salesforce Lightning look using
the **SLDS 2 (Salesforce Cosmos)** design language, with **Neon serverless
Postgres** as the data backend.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **@salesforce-ux/design-system-2** — SLDS 2 Cosmos theme, loaded CSS-only in
  `src/app/layout.tsx`. Apply `slds-*` blueprint classes in JSX.
- **@neondatabase/serverless** — server-only Neon client in `src/lib/db.ts`.

Fonts: Arial is used as the SLDS-supported fallback (Salesforce Sans is
license-restricted to Salesforce-hosted apps).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Local development (`npm run dev`) skips the browser's Basic Auth prompt when
`BASIC_AUTH_PASSWORD` is unset. If a password is configured, development requires
the same credentials as production. Choose a demo profile on the sign-in screen.

Production requires `BASIC_AUTH_PASSWORD` in the server environment. Set it to
your chosen password; the username defaults to `guest` (`BASIC_AUTH_USER`
overrides it). The app refuses access if the production password is missing.

## Day zero: org assessment

Choose **Sam Patel — Day zero · Org assessment** on sign-in, or switch to Sam
from the avatar menu. The agent automatically starts a simulated read-only
assessment of the connected orgs in Sam's demo workspace.
Sam's workspace offers **Build & Setup**, **Govern & Observe** for assessment
details and scope, and **ALM** for project creation and plans.

The front door and surfaces share one persistent agent panel and composer. When
opening a surface, the welcome content fades out with a strong 24px blur over
500ms. Only then does the composer move with the narrowing panel for 440ms, followed
by the chat header and conversation fading into focus over 500ms. Returning home
uses the same sequence in reverse. The composer stays sharp throughout. Draft
text, text selection, and session conversations survive
client-side navigation home and back. Reduced-motion preferences skip the transitions.

Only user prompts appear in speech bubbles. New agent replies stream in as plain
text after the navigation and scroll finish, with suggestions appearing when the
reply completes. Completed replies stay readable in the conversation history;
reduced-motion preferences show the full reply immediately.

Typing or sending an idea from Today keeps the current chat layout and panels.
The agent helps clarify the audience, desired outcome, and constraints before
drafting a point of view and first steps. Planning answers remain with that
project/worktree conversation. Topic words such as “build,” “code,” or “release”
do not navigate. A direct request such as “Open Build & Setup” or a surface/canvas
action opens that workspace; requesting an unavailable surface keeps the chat
in place. This guided planning flow uses prototype responses. Day-zero profiles
keep assessment guidance and project-specific plans in both Today and surfaces.

Earlier Today briefings keep the same mounted content, grid, spacing, and
typography. Backgrounds, borders, shadows, and calls to action fade away over
the shared 500ms timeline as all text dims. Transparent borders and hidden
actions retain their space, so archiving never collapses or reflows the layout.
Surface navigation keeps faint backgrounds and borders to read as disabled tiles.
History is read-only and keeps its captured assessment state. Returning home
appends a fresh interactive briefing; reduced motion skips the styling fade.

Switching between surfaces uses a separate 500ms canvas swap: the incoming surface
lands in front while the outgoing surface recedes, blurs, and fades away. The agent
and composer stay in place. Next's experimental view-transition integration captures the outgoing
canvas without keeping a second live surface mounted; browsers without support and
reduced-motion users get an immediate swap. Browser Back/Forward currently restores
the saved surface instantly. The home transition remains separate.

Canvas tabs use that same recede/land animation within the right-hand canvas
container. The chat, composer, and tab strip stay still. Tab selection changes
only the canvas; explicit project/worktree navigation owns the workspace dissolve.
Each project's tab list is separate, including newly opened tools and their
drafts. Switching projects retains the other project's saved canvases without
showing them in the current tab strip. Older unowned tool tabs are assigned once
to the current project, preserving their drafts. Run `npm run test:surface-canvas`
for project scoping, draft isolation, and legacy tab migration checks.

Canvas content shares `src/components/canvas/CanvasLayout.tsx`: responsive gutters
and a left-aligned inner column capped at 72rem. `SurfaceCanvasHost` supplies it
once for every overview and launched tab, so canvas bodies provide content without
their own outer padding, centering, or width limits. The older canvas kit uses the
same layout through `CanvasView`; its explicit `wide` and `full` variants accommodate
a project side rail and builders with their own toolbar, respectively.

The agent header and surface tab strip share a 56px height and divider treatment.
Surface content sits in an inset container with rounded corners, a slightly raised
background, and a soft shadow in both light and dark themes.

The command palette puts the current surface, project/worktree, session, or org first
in its tab and highlights that row on opening or switching tabs. One Down press
selects another destination. Search filters normally and resets the highlight to
the first match; clearing it returns the highlight to the current destination.
Opening and closing use the front-door chat's 500ms fade and 24px blur. A selection
takes effect after dismissal completes, and reopening during dismissal reverses
the transition and cancels the pending selection. Reduced motion skips the dissolve.

The workspace panel slides in and out from the left over 500ms, preserving its
content width and filter selection. It reserves space on desktop and overlays the
content as a drawer on mobile. Closed controls are inert, and reduced motion skips
the slide.

Project names on the returning Build, ALM, and Govern overviews open the left
panel's Projects view and focus the current project without changing its branch.
The front door, transcript, agent replies, and composer share a 1200px maximum
width. With both panels closed, the content is centered. Opening either panel
aligns it to the left of the remaining agent space, beside the workspace panel
when it is open or at the viewport's left edge when only the surface is open.
Content width and alignment animate with the panel's timing and easing; navigation
waits for that movement before scrolling and revealing the next reply.

Switching projects or worktrees dissolves the outgoing transcript and visible
canvas using the same 500ms fade and 24px blur. The selection changes while the
content is hidden, then the incoming workspace comes into focus. Navigation and
the composer stay sharp; each workspace retains its own conversation and draft.
Quick selections resolve to the latest request, and reduced motion skips the fade.

Front-door briefings reveal their rows from top to bottom, staggered by 75ms.
Each row fades into focus over 500ms with a subtle lift and scale pop. The cascade
runs on first arrival, after scrolling back to Today, and when loading another
project or worktree. Historical briefings stay still; reduced motion shows every
row immediately.

Alex's returning experience includes attention items in both projects and every
worktree: CRM access review, lead-routing approval, hotfix code review, and Acme's
search performance review and UAT release approval. Each card opens its related
work in the appropriate surface. Run `npm run test:workspace` for fixture coverage
and atomic, persisted workspace selection checks.

- Pause/resume the assessment, or open the org scope to choose connections and rerun it.
- The status bar shows the project followed immediately by the org. Click either to open the command palette's Projects or Orgs tab with the current selection first and highlighted. Orgs are available from first login, independently of project creation or assessment scope; org selection persists across reloads. Closing the palette returns focus to its trigger.
- Review prioritized findings, their sample evidence, proposed approaches, and success criteria.
- Select opportunities and choose **Start a new project** to open a **New project** canvas in ALM. Edit the goal, sandbox, and included work items there; returning to Today or closing the canvas keeps the draft.
- Choose **Create project** to open the saved project in ALM, inspect each implementation plan, and track work item status.
- Creating a project uses the same dissolve as switching projects: the outgoing chat and canvas fade away before the project is saved and selected. ALM stays open, revealing the project plan and a fresh chat. The agent then streams a welcome naming the project, its goal, work items, and sandbox, and asks what to do next. Earlier conversations and unsent drafts stay with their original project.
- Reopen projects from home, the workspace panel, the command palette, or ALM. Drafts, assessment progress, projects, and work item status persist per profile in this browser.

Today launches work into specific canvases: starter cards open their matching
tools, recent work and attention cards open their saved work, and day-zero scope
and opportunity details open in Govern & Observe. Explore surfaces opens the
chosen surface's overview canvas. Opportunity selection and assessment pause/resume
remain available in the briefing.

Deployed apps live in ALM. App rows in the workspace panel, ALM's deployed-app
list, and app entries in recent work all open ALM canvases. Existing saved app
tabs and their drafts move from Build & Setup to ALM when loaded.

This is a product prototype: Salesforce authentication, org discovery, live
assessment queries, model calls, and execution are not connected. The domain,
permissions, usage metrics, and findings are fixtures. A domain login in a real
integration must be followed by discovery of explicitly granted org connections;
it does not imply access to every org in the company. Project creation and status
changes save local planning data and do not modify an org.

The implementation lives in `src/lib/onboarding` (demo adapter, domain data, and
persisted state) and `src/components/onboarding` (assessment, guided project review,
and ALM plans). Workspace context projects the saved projects into the existing
navigation; the surface canvas registry opens their persistent tabs. The other
demo profiles retain their existing first-visit and returning experiences.

Run `npm run test:onboarding` for scope, lifecycle, persistence, profile isolation,
duplicate creation, malformed data, and unavailable-storage checks. Run
`npm run test:auth` for the development bypass and credential gate checks.
Run `npm run lint` and `npm run build` for the app checks.

The app runs without a database. To connect Neon:

```bash
cp .env.example .env.local   # then paste your Neon connection string
```

## Project structure

```
src/
  app/
    layout.tsx       # root layout — imports SLDS 2 Cosmos CSS
    page.tsx         # home content is hosted by AppShell / FrontDoor
    globals.css      # minimal base (lets SLDS own the look)
  lib/
    db.ts            # server-only Neon client (getSql())
    onboarding/      # day-zero org assessment and saved improvement projects
    workspace/       # shared projects, orgs, selections, and fixtures
  components/
    onboarding/      # assessment home and ALM project plans
db/
  schema.sql         # CRM schema (empty for now)
```

## Conventions

- Query Neon only from **Route Handlers**, **Server Actions**, or **Server
  Components** — never from client code. `src/lib/db.ts` is guarded by
  `server-only`.
- Keep `globals.css` lean; prefer SLDS classes and styling hooks over hardcoded
  values.
