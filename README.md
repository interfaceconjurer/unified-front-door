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

- Pause/resume the assessment, or open the org scope to choose connections and rerun it.
- Use the bottom-right status-bar org switcher from first login to choose among all connected orgs, independently of the assessment scope. The selected org persists across reloads.
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
