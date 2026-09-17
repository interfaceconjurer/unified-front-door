import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { freePort, startProduction, waitForServer } from "./production-process.mjs";

const origin = process.env.BROWSER_TEST_ORIGIN;
if (!origin || !process.env.BASIC_AUTH_PASSWORD) throw new Error("Explicit smoke origin and Basic Auth are required.");
const auth = "Basic " + Buffer.from(`${process.env.BASIC_AUTH_USER ?? "guest"}:${process.env.BASIC_AUTH_PASSWORD}`).toString("base64");
async function request(path, authorization = auth, at = origin) { return fetch(at + path, { headers: authorization ? { authorization } : {}, redirect: "manual", signal: AbortSignal.timeout(15000) }); }
for (const path of ["/", "/api/ready", "/api/session"]) {
  assert.equal((await request(path, null)).status, 401);
  assert.equal((await request(path, "Basic " + Buffer.from("wrong:wrong").toString("base64"))).status, 401);
}
const page = await request("/"); assert.equal(page.status, 200);
const html = await page.text(), asset = html.match(/(?:src|href)="([^"?]+\/_next\/static\/[^"?]+\.(?:js|css))/)?.[1] ?? html.match(/(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))/)?.[1];
assert(asset, "Rendered production page references a static asset");
assert.equal((await request(asset, null)).status, 401);
assert.equal((await request(asset)).status, 200);
const ready = await request("/api/ready"); assert.equal(ready.status, 200); assert.deepEqual(await ready.json(), { ready: true });
assert.match(ready.headers.get("cache-control"), /no-store/); assert.match(ready.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
for (const override of [{ BASIC_AUTH_PASSWORD: "" }, { BASIC_AUTH_PASSWORD: "   " }, { BASIC_AUTH_USER: " " }, { DATABASE_URL: "" }, { APP_ORIGIN: "not-an-origin" }]) {
  const result = spawnSync(process.execPath, ["--conditions=react-server", "scripts/start.mjs", "web"], { env: { ...process.env, ...override }, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 1, "Invalid configuration prevents process startup");
  assert(!result.stdout.includes("Ready"));
}
const port = await freePort(), brokenOrigin = `http://127.0.0.1:${port}`;
const server = startProduction(port, { ...process.env, APP_ORIGIN: brokenOrigin, DATABASE_URL: "postgres://test:test@127.0.0.1:1/missing", DATABASE_URL_UNPOOLED: "postgres://test:test@127.0.0.1:1/missing" }, join(process.env.BROWSER_TEST_OUTPUT ?? ".release", "unavailable-database.log"), true);
try {
  await waitForServer(brokenOrigin, server);
  const unavailable = await request("/api/ready", auth, brokenOrigin);
  assert.equal(unavailable.status, 503); assert.deepEqual(await unavailable.json(), { ready: false });
  assert.equal((await request("/api/session", auth, brokenOrigin)).status, 503);
} finally { await server.stop(); }
const closedPort = await freePort(), closedOrigin = `http://127.0.0.1:${closedPort}`;
const closed = startProduction(closedPort, { ...process.env, APP_ORIGIN: closedOrigin, BASIC_AUTH_PASSWORD: " " }, join(process.env.BROWSER_TEST_OUTPUT ?? ".release", "missing-auth.log"), true);
try {
  await waitForServer(closedOrigin, closed);
  for (const path of ["/", "/api/ready", "/api/session", asset]) {
    const response = await request(path, auth, closedOrigin);
    assert.equal(response.status, 503); assert.equal(await response.text(), "Site unavailable.");
  }
} finally { await closed.stop(); }
console.log("Runtime smoke passed: private page/static/readiness, configuration rejection, and unavailable database.");
await import("./web-runtime.mjs");
