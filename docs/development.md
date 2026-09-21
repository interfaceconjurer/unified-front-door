# Development

[← README](../README.md)

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
[.env.example](../.env.example) if you do not already have a local file. Preserve any
existing configuration and fill in the database and Basic Auth values in the
[configuration reference](operations.md#database-configuration). Do not put
credentials in source or browser-prefixed environment variables.

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
start `npm run worker` in another terminal. In development, `localhost`,
`127.0.0.1`, and `[::1]` are interchangeable on the configured origin's protocol
and port, provided the request matches its browser host. In production,
`APP_ORIGIN` must match the browser origin exactly. Production startup rejects missing/blank authentication, invalid
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
checks are in the [Phase 9 journal](../docs/phases/phase-9-operations.md).

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
[Phase 3 journal](../docs/phases/phase-3-navigation.md#dormant-import-graph-inventory).
The shared `CanvasLayout` and server-only database seam remain.

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
