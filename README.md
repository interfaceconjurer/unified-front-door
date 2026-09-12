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

Set `BASIC_AUTH_PASSWORD` in your local environment before starting the app.
The browser's Basic Auth username defaults to `guest` (`BASIC_AUTH_USER` overrides it).
Once through that gate, choose a demo profile on the sign-in screen.

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
and composer stay in place. Next's experimental view-transition integration captures the outgoing
canvas without keeping a second live surface mounted; browsers without support and
reduced-motion users get an immediate swap. Browser Back/Forward currently restores
the saved surface instantly. The home transition remains separate.

Canvas content shares `src/components/canvas/CanvasLayout.tsx`: responsive gutters
and a left-aligned inner column capped at 72rem. `SurfaceCanvasHost` supplies it
once for every overview and launched tab, so canvas bodies provide content without
their own outer padding, centering, or width limits. The older canvas kit uses the
same layout through `CanvasView`; its explicit `wide` and `full` variants accommodate
a project side rail and builders with their own toolbar, respectively.

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

- Pause/resume the assessment, or open the org scope to choose connections and rerun it.
- The status bar shows the project followed immediately by the org. Click either to open the command palette's Projects or Orgs tab with the current selection first and highlighted. Orgs are available from first login, independently of project creation or assessment scope; org selection persists across reloads. Closing the palette returns focus to its trigger.
- Review prioritized findings, their sample evidence, proposed approaches, and success criteria.
- Select opportunities and choose **Shape a project** to edit the goal, sandbox, and included work items.
- Choose **Create project** to open the saved project in ALM, inspect each implementation plan, and track work item status.
- Reopen projects from home, the workspace panel, the command palette, or ALM. Drafts, assessment progress, projects, and work item status persist per profile in this browser.

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
`npm run lint` and `npm run build` for the app checks.

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
