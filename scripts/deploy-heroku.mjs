import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validateVerification } from "./release-contract.mjs";
import databaseTargets from "../src/lib/server/database-target.js";

const API = "https://api.heroku.com";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class DeploymentError extends Error {
  constructor(code) { super(code); this.name = "DeploymentError"; }
}
function requireCondition(condition, code) {
  if (!condition) throw new DeploymentError(code);
}
function secureUrl(value, originOnly = false) {
  try {
    const url = new URL(value);
    requireCondition(url.protocol === "https:" && !url.username && !url.password
      && !url.hash && (!originOnly || (url.pathname === "/" && !url.search)), "invalid-url");
    return originOnly ? url.origin : url.href;
  } catch { throw new DeploymentError("invalid-url"); }
}

// No raw platform errors, response bodies, credentials, or signed URLs reach logs.
// A timeout after a write has an unknown remote outcome. Never automatically
// retry a build POST or roll back: reconcile its state in Heroku first.
export async function deployHeroku(input, dependencies = {}) {
  const { manifest, source, expected, app, token, username, password } = input;
  validateVerification(manifest, expected);
  requireCondition(digest(source) === manifest.sourceSha256, "source-checksum-mismatch");
  requireCondition(/^[a-z][a-z0-9-]{1,29}$/.test(app ?? ""), "invalid-app");
  requireCondition(typeof token === "string" && token.trim() && !/[\r\n]/.test(token), "missing-platform-credential");
  requireCondition(typeof username === "string" && username.trim() && !/[:\x00-\x1f\x7f]/.test(username)
    && typeof password === "string" && password.trim() && !/[\x00-\x1f\x7f]/.test(password), "missing-smoke-credentials");
  const origin = secureUrl(input.origin, true);
  const fetcher = dependencies.fetch ?? fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const log = dependencies.log ?? ((event) => console.log(JSON.stringify(event)));
  const requestTimeout = dependencies.requestTimeout ?? 30_000;
  const maxPolls = dependencies.maxPolls ?? 120;
  const pollDelay = dependencies.pollDelay ?? 5_000;
  const deadline = Date.now() + (dependencies.totalTimeout ?? 15 * 60_000);
  const apiRoot = `${API}/apps/${app}`;
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const evidence = { revision: manifest.revision, buildId: null, releaseId: null, stage: "preflight" };

  async function request(url, { method = "GET", body, platform = false, auth = false, json = true, limit = 1_048_576 } = {}) {
    requireCondition(Date.now() < deadline, "deployment-timeout-reconcile");
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new DeploymentError("request-timeout-reconcile")); }, Math.min(requestTimeout, deadline - Date.now()));
    });
    try {
      return await Promise.race([timeout, (async () => {
        const headers = {};
        if (platform) {
          requireCondition(new URL(url).origin === API, "invalid-platform-target");
          headers.Authorization = `Bearer ${token}`;
          headers.Accept = "application/vnd.heroku+json; version=3";
          if (body !== undefined) headers["Content-Type"] = "application/json";
        }
        if (auth) {
          requireCondition(new URL(url).origin === origin, "invalid-smoke-target");
          headers.Authorization = authorization;
        }
        const response = await fetcher(url, { method, headers, body, signal: controller.signal, redirect: "error" });
        const reader = response.body?.getReader();
        const chunks = [];
        let length = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > limit) { await reader.cancel(); throw new DeploymentError("response-too-large"); }
            chunks.push(Buffer.from(value));
          }
        }
        const text = Buffer.concat(chunks).toString("utf8");
        let data;
        if (json && response.ok) {
          try { data = JSON.parse(text); } catch { throw new DeploymentError("invalid-platform-response"); }
        }
        return { status: response.status, ok: response.ok, data, text, headers: response.headers };
      })()]);
    } catch (error) {
      if (error instanceof DeploymentError) throw error;
      throw new DeploymentError("request-failed-reconcile");
    } finally { clearTimeout(timer); }
  }
  async function api(path, options) {
    const response = await request(path.startsWith("/") ? `${API}${path}` : `${apiRoot}/${path}`, { ...options, platform: true });
    requireCondition(response.ok, "platform-http-failure");
    return response.data;
  }
  async function poll(read, state, label) {
    for (let attempt = 0; attempt < maxPolls; attempt++) {
      const value = await read();
      const status = state(value);
      if (status === "succeeded") return value;
      requireCondition(status === "pending", `${label}-failed`);
      if (attempt + 1 < maxPolls) await sleep(pollDelay);
    }
    throw new DeploymentError(`${label}-timeout-reconcile`);
  }
  try {
    const appInfo = await api("");
    requireCondition(secureUrl(appInfo.web_url, true) === origin, "app-origin-mismatch");
    const configuration = await api("config-vars");
    requireCondition(secureUrl(configuration.APP_ORIGIN, true) === origin && configuration.BASIC_AUTH_PASSWORD === password
      && (configuration.BASIC_AUTH_USER ?? "guest") === username, "hosted-config-mismatch");
    try { databaseTargets.databaseConfiguration(configuration, true); }
    catch { throw new DeploymentError("hosted-database-config-invalid"); }
    const formation = await api("formation");
    requireCondition(Array.isArray(formation) && formation.some((entry) => entry.type === "web" && entry.quantity >= 1), "web-formation-required");

    evidence.stage = "upload";
    const slot = await api("/sources", { method: "POST" });
    const putUrl = secureUrl(slot.source_blob?.put_url);
    const getUrl = secureUrl(slot.source_blob?.get_url);
    const upload = await request(putUrl, { method: "PUT", body: source, json: false });
    requireCondition(upload.ok, "source-upload-failed");

    evidence.stage = "build";
    const started = await api("builds", { method: "POST", body: JSON.stringify({ source_blob: {
      url: getUrl, version: manifest.revision, checksum: `SHA256:${manifest.sourceSha256}`,
    } }) });
    requireCondition(uuid.test(started.id), "invalid-build-id");
    evidence.buildId = started.id;
    log({ event: "deployment.build-started", ...evidence });
    const build = await poll(() => api(`builds/${evidence.buildId}`), (value) => value.status, "build");
    requireCondition(build.source_blob?.version === manifest.revision && uuid.test(build.release?.id)
      && uuid.test(build.slug?.id), "build-provenance-mismatch");
    evidence.releaseId = build.release.id;

    evidence.stage = "release";
    const release = await poll(() => api(`releases/${evidence.releaseId}`), (value) => value.status, "release");
    requireCondition(release.current === true && release.slug?.id === build.slug.id, "release-not-current");

    evidence.stage = "processes";
    // A newly introduced worker type is scalable only after its first release.
    // Give the operator a bounded window to activate it; do not scale/bill here.
    await poll(() => api("dynos"), (dynos) => Array.isArray(dynos) && ["web", "worker"].every((type) =>
      dynos.some((dyno) => dyno.type === type && dyno.state === "up" && dyno.release?.id === evidence.releaseId))
      ? "succeeded" : "pending", "processes");

    evidence.stage = "smoke";
    await poll(async () => {
      const response = await request(`${origin}/api/ready`, { auth: true });
      if (response.status === 503) return { status: "pending" };
      requireCondition(response.status === 200 && response.data?.ready === true, "readiness-failed");
      return { status: "succeeded" };
    }, (value) => value.status, "readiness");
    const denied = await request(`${origin}/api/ready`, { json: false });
    requireCondition(denied.status === 401, "readiness-auth-bypass");
    const page = await request(`${origin}/login`, { auth: true, json: false, limit: 4_194_304 });
    requireCondition(page.status === 200 && /text\/html/.test(page.headers.get("content-type") ?? ""), "page-smoke-failed");
    const asset = page.text.match(/(?:src|href)="(\/_next\/static\/[^"?#]+\.js)(?:\?[^"#]*)?"/);
    requireCondition(asset, "static-asset-missing");
    const assetUrl = new URL(asset[1], origin).href;
    const staticResponse = await request(assetUrl, { auth: true, json: false, limit: 16_777_216 });
    requireCondition(staticResponse.status === 200 && /(?:javascript|ecmascript)/.test(staticResponse.headers.get("content-type") ?? ""), "static-smoke-failed");
    const staticDenied = await request(assetUrl, { json: false });
    requireCondition(staticDenied.status === 401, "static-auth-bypass");
    // Detect a competing release during smoke instead of attributing its health
    // to this build. Workflow concurrency also serializes this repository's runs.
    const finalRelease = await api(`releases/${evidence.releaseId}`);
    requireCondition(finalRelease.current === true && finalRelease.status === "succeeded"
      && finalRelease.slug?.id === build.slug.id, "release-changed-during-smoke");
    evidence.stage = "complete";
    log({ event: "deployment.succeeded", ...evidence });
    return { ...evidence };
  } catch (error) {
    const code = error instanceof DeploymentError ? error.message : "deployment-failed-reconcile";
    log({ event: "deployment.failed", ...evidence, code });
    throw new DeploymentError(code);
  }
}

async function main() {
  const revision = process.env.GITHUB_SHA;
  requireCondition(/^[a-f0-9]{40}$/.test(revision ?? ""), "exact-revision-required");
  const git = (args) => execFileSync("git", args, { timeout: 30_000, maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const source = await readFile(".release/source.tgz");
  const manifest = JSON.parse(await readFile(".release/verification.json", "utf8"));
  // Independently reproduce the committed source; a mutable artifact manifest
  // alone cannot attest which revision its archive contains.
  const expected = { revision, treeSha: git(["rev-parse", `${revision}^{tree}`]).toString().trim(),
    lockSha256: digest(git(["show", `${revision}:package-lock.json`])),
    sourceSha256: digest(git(["archive", "--format=tar.gz", revision])) };
  await deployHeroku({ manifest, source, expected, app: process.env.HEROKU_APP,
    token: process.env.HEROKU_API_KEY, origin: process.env.HEROKU_APP_ORIGIN,
    username: process.env.HEROKU_BASIC_AUTH_USER || "guest", password: process.env.HEROKU_BASIC_AUTH_PASSWORD });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ event: "deployment.stopped", code: error instanceof DeploymentError ? error.message : "verification-or-deployment-failed" }));
    process.exitCode = 1;
  });
}
