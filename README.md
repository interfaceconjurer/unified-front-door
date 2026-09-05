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

The app runs without a database. To connect Neon:

```bash
cp .env.example .env.local   # then paste your Neon connection string
```

## Project structure

```
src/
  app/
    layout.tsx       # root layout — imports SLDS 2 Cosmos CSS
    page.tsx         # blank home page
    globals.css      # minimal base (lets SLDS own the look)
  lib/
    db.ts            # server-only Neon client (getSql())
db/
  schema.sql         # CRM schema (empty for now)
```

## Conventions

- Query Neon only from **Route Handlers**, **Server Actions**, or **Server
  Components** — never from client code. `src/lib/db.ts` is guarded by
  `server-only`.
- Keep `globals.css` lean; prefer SLDS classes and styling hooks over hardcoded
  values.
