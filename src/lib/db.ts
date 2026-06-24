import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Server-only Neon (serverless Postgres) client.
 *
 * IMPORTANT: never import this from a Client Component. The `server-only`
 * package throws at build time if this module is pulled into the browser
 * bundle, which keeps DATABASE_URL out of client code.
 *
 * Usage (in a Route Handler / Server Action / Server Component):
 *
 *   import { getSql } from "@/lib/db";
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM accounts WHERE id = ${id}`;
 *
 * The tagged-template form auto-parameterizes values (safe from injection).
 */
let _sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your " +
        "Neon connection string (Neon dashboard → Connect)."
    );
  }

  _sql = neon(url);
  return _sql;
}
