import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { request as playwrightRequest } from "playwright";
import { freePort, startProduction, startDevelopment, waitForServer } from "./production-process.mjs";

// Real process/transport checks, with an intentionally unavailable local DB and
// no provider key. Use --dev separately to exercise the same gate around HMR.
const dev = process.argv.includes("--dev"), output = resolve(process.env.BROWSER_TEST_OUTPUT ?? ".release", dev ? "http-development" : "http-production");
await mkdir(output, { recursive: true });
const port = await freePort(), origin = `http://127.0.0.1:${port}`, password = randomUUID(), basic = "Basic " + Buffer.from(`guest:${password}`).toString("base64");
const env = { ...process.env, NODE_ENV: dev ? "development" : "production", NEXT_TELEMETRY_DISABLED: "1", AGENT_PROVIDER: "demo", BASIC_AUTH_USER: "guest", BASIC_AUTH_PASSWORD: password, APP_ORIGIN: origin,
  DATABASE_URL: "postgres://test:test@127.0.0.1:1/unused", DATABASE_URL_UNPOOLED: "postgres://test:test@127.0.0.1:1/unused" };
delete env.ANTHROPIC_API_KEY;
const log = join(output, "server.log"), server = (dev ? startDevelopment : startProduction)(port, env, log);
const result = { mode: dev ? "development" : "production", passed: false, checks: [], cleanup: false };
let context, hmr;
const headers = { authorization: basic, origin, "x-ufd-mutation": "1", "content-type": "application/json" };
async function post(body, patch = {}) { const response = await fetch(origin + "/api/session", { method: "POST", headers: { ...headers, ...patch }, body, signal: AbortSignal.timeout(20000) }); await response.text(); return response; }
async function upgrade(authorization) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(origin + "/_next/hmr", { headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": Buffer.alloc(16, 1).toString("base64"), ...(authorization ? { authorization } : {}) } });
    const timer = setTimeout(() => { req.destroy(); reject(Error("Upgrade did not settle")); }, 5000);
    req.on("error", error => { clearTimeout(timer); reject(error); });
    req.on("response", response => { response.resume(); response.on("end", () => { clearTimeout(timer); resolve({ status: response.statusCode }); }); });
    req.on("upgrade", (response, socket) => { clearTimeout(timer); socket.on("error", () => {}); resolve({ status: response.statusCode, socket }); }); req.end();
  });
}
async function partial(bytes, action, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1"), started = performance.now(); let data = "";
    const timer = setTimeout(() => { socket.destroy(); reject(Error("Partial request exceeded transport deadline")); }, timeout);
    socket.on("error", error => { if (error.code !== "ECONNRESET") reject(error); });
    socket.on("data", chunk => { data += chunk; });
    socket.on("close", () => { clearTimeout(timer); resolve({ status: Number(data.match(/^HTTP\/1\.1 (\d+)/)?.[1] ?? 0), durationMs: Math.round(performance.now() - started) }); });
    socket.once("connect", () => { socket.write(bytes); action?.(socket); });
  });
}
try {
  await waitForServer(origin, server);
  assert.equal((await upgrade()).status, 401);
  assert.equal((await upgrade(basic)).status, 426);
  result.checks.push("Upgrades authenticate before the first Next request; unsupported upgrades receive 426.");
  for (const path of ["/", "/api/session", "/_next/static/missing.js", "/unknown"]) {
    for (const method of ["GET", "POST", "OPTIONS"]) {
      const response = await fetch(origin + path, { method, ...(method === "POST" ? { body: "invalid" } : {}) });
      assert.equal(response.status, 401); assert.match(response.headers.get("cache-control"), /no-store/); await response.text();
    }
  }
  result.checks.push("Pages, static files, API, unknown routes and non-GET methods all require Basic Auth.");
  context = await playwrightRequest.newContext({ httpCredentials: { username: "guest", password } });
  for (let i = 0; i < 10; i++) {
    // Default send=unauthorized intentionally exercises the former clone bug.
    const response = await context.post(origin + "/api/session", { headers: { origin, "x-ufd-mutation": "1" }, data: { action: "invalid" } });
    assert.equal(response.status(), 400);
  }
  result.checks.push("Ten automatic POST Basic Auth challenge/retry cycles retain correct application responses.");
  assert.equal((await upgrade()).status, 401); assert.equal((await upgrade("Basic invalid")).status, 401);
  if (!dev) assert.equal((await upgrade(basic)).status, 426);
  result.checks.push("Next's initialized upgrade listener cannot bypass authentication; production upgrades remain closed.");
  assert.equal((await post("{}", { origin: "https://other.invalid" })).status, 403);
  assert.equal((await post("{}", { "x-ufd-mutation": "0" })).status, 403);
  assert.equal((await post("{" )).status, 400);
  assert.equal((await post("x".repeat(4500001))).status, 400);
  const chunked = await new Promise((resolve, reject) => {
    const req = httpRequest(origin + "/api/session", { method: "POST", headers }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    req.on("error", reject); req.write("x".repeat(4500001)); req.end();
  });
  assert.equal(chunked, 400);
  result.checks.push("Same-origin mutation checks and declared/chunked 4.5 MB body limits remain enforced.");
  for (const authorized of [false, true]) {
    await partial(`POST /api/session HTTP/1.1\r\nHost: localhost\r\n${authorized ? `Authorization: ${basic}\r\n` : ""}Origin: ${origin}\r\nX-Ufd-Mutation: 1\r\nContent-Type: application/json\r\nContent-Length: 9999\r\n\r\n{`, socket => setTimeout(() => socket.destroy(), 100));
  }
  assert.equal((await post('{"action":"invalid"}')).status, 400);
  result.checks.push("Client disconnects during both rejected and authenticated POST bodies leave the server usable.");
  const page = await fetch(origin + "/login", { headers: { authorization: basic } }); assert.equal(page.status, 200);
  const html = await page.text(), asset = html.match(/(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))/)?.[1];
  assert(asset, "The actual page references a static asset");
  const staticResponse = await fetch(origin + asset, { headers: { authorization: basic } }); assert.equal(staticResponse.status, 200); await staticResponse.arrayBuffer();
  result.checks.push("Authenticated page rendering and its actual static asset work through the same server.");
  if (dev) {
    const upgraded = await upgrade(basic); assert.equal(upgraded.status, 101); hmr = upgraded.socket;
    result.checks.push("Authenticated development HMR completes the WebSocket handshake.");
  } else {
    const [incompleteHeaders, incompleteBody] = await Promise.all([
      partial("GET / HTTP/1.1\r\nHost: localhost\r\nX-Unfinished: ", null, 13000),
      partial(`POST /api/session HTTP/1.1\r\nHost: localhost\r\nAuthorization: ${basic}\r\nOrigin: ${origin}\r\nX-Ufd-Mutation: 1\r\nContent-Type: application/json\r\nContent-Length: 9999\r\n\r\n{`, null, 18000),
    ]);
    assert.equal(incompleteHeaders.status, 408); assert.equal(incompleteBody.status, 408);
    result.transportDeadlines = { incompleteHeaders, incompleteBody };
    result.checks.push("Incomplete headers and bodies time out within the configured deadlines plus the one-second polling interval.");
  }
  await context.dispose(); context = null;
  const drainBody = '{"action":"invalid"}'; let drainingRequest;
  const drained = new Promise((resolve, reject) => {
    drainingRequest = httpRequest(origin + "/api/session", { method: "POST", headers: { ...headers, "content-length": Buffer.byteLength(drainBody) } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    drainingRequest.on("error", reject); drainingRequest.write(drainBody.slice(0, 1));
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  const stopped = performance.now(), stopping = server.stop();
  setTimeout(() => drainingRequest.end(drainBody.slice(1)), 100);
  assert.equal(await drained, 400, "An in-flight request completes after SIGTERM before Next closes");
  await stopping; result.shutdownMs = Math.round(performance.now() - stopped);
  const exit = await server.exited; assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert(result.shutdownMs < 5000, "Normal shutdown including HMR must complete without forced termination");
  result.cleanup = true;
  result.checks.push("SIGTERM drains an authenticated in-flight request before completing shutdown.");
  const text = await readFile(log, "utf8");
  assert.doesNotMatch(text, /uncaughtException|unhandledRejection|Error: aborted|shutdown_timeout/);
  assert(!text.includes(password)); assert(!text.includes("postgres://"));
  result.checks.push("Shutdown is graceful; logs contain no unhandled exceptions, framework abort blocks or credentials.");
  result.passed = true;
} finally {
  hmr?.destroy(); await context?.dispose(); await server.stop();
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
}
console.log(JSON.stringify(result, null, 2));
