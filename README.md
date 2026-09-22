# Unified Front Door

A Salesforce-style workspace prototype for assessing orgs, shaping findings into
projects, and working with a persistent agent across Build & Setup and ALM.

## TL;DR

- **Stack:** Next.js 16, React 19, TypeScript, SLDS 2 (Cosmos), and Neon Postgres.
- **Try it:** sign in as **Sam Patel — Day zero**, review findings,
  then **Shape a project → Create project** to open its plan in ALM.
- **Expansion story:** Sam and Karen have Build & Setup + ALM; Jordan adds
  Govern & Observe; Alex adds Code. [Profile scenarios](docs/product-behavior.md#demo-expansion-scenarios).
- **Real persistence:** chats, assessments, projects, and saved drafts live in
  Postgres. The web app and a separate worker must both run for agent work to progress.
- **Demo orgs:** Salesforce connections, assessments, and findings are simulated.
  Optional Anthropic chat reasons over captured data; it has no live org access
  or ability to change an org. New environments default to the demo agent.

## Run locally

Use **Node 22.23.2** (see [.nvmrc](.nvmrc)). If `.env.local` does not exist,
copy [.env.example](.env.example) to it. Keep it private (`chmod 600 .env.local`)
and configure:

- `DATABASE_URL`: pooled URL for an isolated Neon development database.
- `DATABASE_URL_UNPOOLED`: direct URL for the same database.
- `APP_ORIGIN`: your browser origin, usually `http://localhost:3000`.
- `BASIC_AUTH_PASSWORD`: the browser gate password; the username defaults to `guest`.

```bash
npm ci
npm run db:migrate
npm run db:status
npm run dev
```

In a second terminal, from the same directory:

```bash
npm run build:worker
npm run worker
```

Open [localhost:3000](http://localhost:3000), pass Basic Auth, and choose a demo
profile. Rebuild and restart the worker after changing its source. Each worktree
needs its own `.env.local`; Git does not copy it.

For local production, use `npm run build` followed by `npm run start`, with
`npm run worker` in a second terminal. See the [development guide](docs/development.md)
for startup details and optional Anthropic configuration.

## Working on it

- Read the installed Next.js guides in `node_modules/next/dist/docs/` before
  changing framework code; this version has breaking changes.
- Use SLDS classes and styling hooks. Keep database access server-side.
- Run `npm run lint` and `npm run build`; choose the relevant suites from the
  [verification guide](docs/verification.md). Database tests need an explicit,
  isolated `DATABASE_TEST_URL`.

## Go deeper

| Guide | Contents |
| --- | --- |
| [Development](docs/development.md) | Setup, credentials, adding capabilities, source map, conventions |
| [Product behavior](docs/product-behavior.md) | Demo walkthrough, navigation, saved data, sessions, recovery |
| [Agent runtime](docs/agent-runtime.md) | Conversations, workers, retries, optional Anthropic reasoning |
| [Database and operations](docs/operations.md) | Configuration, migrations, deployment, rollback, capacity limits |
| [Verification](docs/verification.md) | Test suites, browser checks, complete release gate |
| [Implementation history](docs/implementation-history.md) | Phase summaries and links to original evidence |

The [architecture plan](docs/architecture-plan.md) records the implementation
phases; the [manual testing log](docs/manual-testing.md) captures subsequent fixes.
