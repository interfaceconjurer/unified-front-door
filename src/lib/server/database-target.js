/** Parse only PostgreSQL URLs whose authority actually selects the database.
 * Routing overrides in query parameters would defeat target comparison. */
function databaseTarget(value) {
  const parsed = new URL(value ?? "");
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length <= 1 || parsed.hash
    || [...parsed.searchParams.keys()].some(key => ["host", "port", "database", "dbname", "service", "servicefile", "user", "options", "search_path", "schema"].includes(key.toLowerCase()))) throw new Error("Invalid database configuration");
  const neon = parsed.hostname.endsWith(".neon.tech");
  return { host: neon ? parsed.hostname.replace("-pooler.", ".") : parsed.hostname, port: parsed.port || "5432", database: decodeURIComponent(parsed.pathname.slice(1)), local: ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname), pooled: neon && parsed.hostname.includes("-pooler.") };
}
function databaseConfiguration(env, requireDirect = false) {
  const runtime = databaseTarget(env.DATABASE_URL);
  const directUrl = env.DATABASE_URL_UNPOOLED || (runtime.local ? env.DATABASE_URL : undefined);
  if (requireDirect && !directUrl) throw new Error("A direct database URL is required");
  if (directUrl) {
    const direct = databaseTarget(directUrl);
    if (direct.pooled || direct.host !== runtime.host || direct.port !== runtime.port || direct.database !== runtime.database) throw new Error("Runtime and direct URLs must select the same database");
  }
  return { runtimeUrl: env.DATABASE_URL, directUrl };
}
module.exports = { databaseTarget, databaseConfiguration };
