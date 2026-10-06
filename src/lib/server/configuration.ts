import "server-only";
import { ApplicationError } from "../application/contracts";
import { databaseConfiguration } from "./database-target";
import { authConfiguration } from "./http-auth";

export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  try { return databaseConfiguration(env).runtimeUrl!; }
  catch { throw new ApplicationError("unavailable", "Configure matching PostgreSQL runtime and direct database URLs on the server.", 503); }
}
export function applicationOrigin(env: Record<string, string | undefined> = process.env): string {
  const value = env.APP_ORIGIN ?? (env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  let parsed: URL; try { parsed = new URL(value); } catch { throw new ApplicationError("unavailable", "Set APP_ORIGIN to the application's public HTTP or HTTPS origin.", 503); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new ApplicationError("unavailable", "APP_ORIGIN must be one HTTP or HTTPS origin without a path.", 503);
  // URL parsing canonicalizes aliases such as 127.1 into 127.0.0.1. Only the
  // literal loopback hosts may use HTTP in production; public origins use TLS.
  if (env.NODE_ENV === "production" && parsed.protocol === "http:"
    && !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/.test(value))
    throw new ApplicationError("unavailable", "Production APP_ORIGIN must use HTTPS or an exact loopback HTTP origin.", 503);
  return parsed.origin;
}

export function basicAuth(env: Record<string, string | undefined> = process.env): { user: string; password: string } {
  try { return authConfiguration(env); }
  catch { throw new ApplicationError("unavailable", "Configure valid Basic Auth credentials on the server.", 503); }
}

export function validateRuntimeConfiguration(env: Record<string, string | undefined> = process.env): void {
  basicAuth(env); applicationOrigin(env); databaseUrl(env);
}
