import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deployHeroku } from "./deploy-heroku.mjs";
import { REQUIRED_CHECKS } from "./release-contract.mjs";

const buildId = "11111111-1111-1111-1111-111111111111";
const releaseId = "22222222-2222-2222-2222-222222222222";
const slugId = "33333333-3333-3333-3333-333333333333";
const secret = "secret-marker-must-never-be-logged";
const origin = "https://example.herokuapp.com";
function fixture() {
  const source = Buffer.from("verified source archive fixture");
  const expected = { revision: "a".repeat(40), treeSha: "b".repeat(40), lockSha256: "c".repeat(64),
    sourceSha256: createHash("sha256").update(source).digest("hex") };
  const manifest = { version: 1, ...expected, verified: true, releasable: true,
    nodeVersion: "22.23.2", completedAt: new Date().toISOString(), buildId: "local-build", checks: [...REQUIRED_CHECKS] };
  return { source, manifest, expected, app: "example", token: secret, username: "guest", password: secret, origin };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function platform(overrides = {}) {
  const calls = [], logs = [];
  const input = fixture();
  const release = { id: releaseId, current: true, status: "succeeded", slug: { id: slugId } };
  let releaseReads = 0;
  async function fetch(url, options) {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (overrides.fetch) {
      const response = await overrides.fetch(url, options, calls);
      if (response) return response;
    }
    if (url === `${origin}/api/ready`) {
      if (!options.headers.Authorization) return json({ error: "unauthorized" }, overrides.authBypass ? 200 : 401);
      return json({ ready: true }, overrides.readinessStatus ?? 200);
    }
    if (url === `${origin}/login`) return new Response('<html><script src="/_next/static/chunk.js"></script></html>', { headers: { "content-type": "text/html" } });
    if (url === `${origin}/_next/static/chunk.js`) return new Response("fixture();", { status: options.headers.Authorization ? 200 : 401, headers: { "content-type": "application/javascript" } });
    if (url.startsWith("https://upload.example/")) {
      assert.equal(options.headers.Authorization, undefined);
      assert.deepEqual(options.body, input.source);
      return new Response("");
    }
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(options.redirect, "error");
    if (path === "/apps/example/") return json({ web_url: origin });
    if (path.endsWith("/config-vars")) return json({ APP_ORIGIN: origin, BASIC_AUTH_PASSWORD: secret,
      DATABASE_URL: "postgresql://fixture:fixture@db.example/test", DATABASE_URL_UNPOOLED: "postgresql://fixture:fixture@db.example/test" });
    if (path.endsWith("/formation")) return json([{ type: "web", quantity: 1 }]);
    if (path === "/sources") return json({ source_blob: { put_url: `https://upload.example/source?token=${secret}`, get_url: `https://download.example/source?token=${secret}` } });
    if (path.endsWith("/builds")) {
      assert.equal(JSON.parse(options.body).source_blob.version, input.manifest.revision);
      assert.equal(JSON.parse(options.body).source_blob.checksum, `SHA256:${input.manifest.sourceSha256}`);
      return json({ id: buildId });
    }
    if (path.endsWith(`/builds/${buildId}`)) return json({ id: buildId, status: overrides.buildStatus ?? "succeeded",
      source_blob: { version: overrides.wrongRevision ? "d".repeat(40) : input.manifest.revision }, release: { id: releaseId }, slug: { id: slugId } });
    if (path.endsWith(`/releases/${releaseId}`)) {
      releaseReads++;
      return json({ ...release, status: overrides.releaseStatus ?? "succeeded", current: overrides.notCurrent ? false : !(overrides.replaced && releaseReads > 1) });
    }
    if (path.endsWith("/dynos")) return json((overrides.noWorker ? ["web"] : ["web", "worker"]).map((type) =>
      ({ type, state: "up", release: { id: releaseId } })));
    throw new Error(`Unexpected fixture request: ${path}`);
  }
  return { input, calls, logs, dependencies: { fetch, log: (event) => logs.push(event), sleep: async () => {}, maxPolls: 2, requestTimeout: 100 } };
}

test("verified deployment waits for release, same-release processes, private readiness, page and protected static asset", async () => {
  const f = platform();
  const result = await deployHeroku(f.input, f.dependencies);
  assert.equal(result.stage, "complete");
  assert.equal(result.releaseId, releaseId);
  assert.equal(f.calls.filter((c) => c.options.method === "POST" && c.url.endsWith("/builds")).length, 1);
  assert(!JSON.stringify(f.logs).includes(secret));
});
test("incomplete, stale, mismatched and nonreleasable verification makes no API call", async () => {
  const mutations = [
    (i) => { i.manifest.releasable = false; },
    (i) => { i.manifest.checks.pop(); },
    (i) => { i.manifest.checks.push("extra"); },
    (i) => { i.manifest.completedAt = "2020-01-01T00:00:00Z"; },
    (i) => { i.manifest.revision = "f".repeat(40); },
    (i) => { i.manifest.nodeVersion = "24.0.0"; },
    (i) => { i.source = Buffer.from("different archive"); },
    (i) => { i.expected.treeSha = "e".repeat(40); },
    (i) => { i.expected.lockSha256 = "e".repeat(64); },
  ];
  for (const mutate of mutations) {
    const f = platform(); mutate(f.input);
    await assert.rejects(deployHeroku(f.input, f.dependencies));
    assert.equal(f.calls.length, 0);
  }
});
test("failed build or release, wrong revision, superseded release and absent worker never pass smoke", async () => {
  for (const scenario of [ { buildStatus: "failed" }, { releaseStatus: "failed" }, { wrongRevision: true }, { notCurrent: true }, { noWorker: true } ]) {
    const f = platform(scenario);
    await assert.rejects(deployHeroku(f.input, f.dependencies));
    assert(!f.calls.some((c) => c.url.startsWith(origin)));
    assert(!f.logs.some((e) => e.event === "deployment.succeeded"));
  }
});
test("pending build and readiness are bounded; no automatic retry or rollback mutations", async () => {
  for (const scenario of [ { buildStatus: "pending" }, { readinessStatus: 503 } ]) {
    const f = platform(scenario);
    await assert.rejects(deployHeroku(f.input, f.dependencies), /timeout-reconcile/);
    assert.equal(f.calls.filter((c) => c.url.endsWith("/builds") && c.options.method === "POST").length, 1);
    assert(!f.calls.some((c) => c.options.method === "DELETE" || c.url.includes("rollback")));
  }
});
test("auth bypass and competing release during smoke fail the deployment result", async () => {
  for (const scenario of [{ authBypass: true }, { replaced: true }]) {
    const f = platform(scenario);
    await assert.rejects(deployHeroku(f.input, f.dependencies));
    assert(!f.logs.some((e) => e.event === "deployment.succeeded"));
  }
});
test("remote errors and signed URLs never enter deployment output", async () => {
  const f = platform({ fetch: async (url) => url.endsWith("/builds") ? new Response(secret, { status: 500 }) : null });
  await assert.rejects(deployHeroku(f.input, f.dependencies), { message: "platform-http-failure" });
  assert(!JSON.stringify(f.logs).includes(secret));
  assert(f.logs.some((e) => e.event === "deployment.failed"));
});
test("network and response-body stalls abort within the request deadline", async () => {
  for (const bodyStall of [false, true]) {
    let signal;
    const f = platform({ fetch: async (_url, options) => {
      signal = options.signal;
      if (bodyStall) return new Response(new ReadableStream({ start() {} }));
      return new Promise(() => {});
    } });
    f.dependencies.requestTimeout = 15;
    await assert.rejects(deployHeroku(f.input, f.dependencies), /timeout-reconcile/);
    assert.equal(signal.aborted, true);
    assert.equal(f.calls.length, 1);
  }
});
test("missing hosted config fails before remote mutations", async () => {
  const f = platform({ fetch: async (url) => url.endsWith("/config-vars") ? json({}) : null });
  await assert.rejects(deployHeroku(f.input, f.dependencies), /invalid-url/);
  assert(f.calls.every((c) => c.options.method === "GET"));
});
test("runtime and migration database mismatch stops before source upload", async () => {
  for (const direct of ["postgresql://owner:secret@other.example/test", "postgresql://owner:secret@db.example/other",
    "postgresql://owner:secret@db.example:5433/test", "postgresql://owner:secret@db.example/test?host=other.example"]) {
    const f = platform({ fetch: async (url) => url.endsWith("/config-vars") ? json({ APP_ORIGIN: origin,
      BASIC_AUTH_PASSWORD: secret, DATABASE_URL: "postgresql://runtime:secret@db.example/test", DATABASE_URL_UNPOOLED: direct }) : null });
    await assert.rejects(deployHeroku(f.input, f.dependencies), /hosted-database-config-invalid/);
    assert(f.calls.every((c) => c.options.method === "GET"));
  }
});
