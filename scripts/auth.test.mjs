import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const output = mkdtempSync(join(tmpdir(), "ufd-auth-test-"));
const source = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8")
  .replace('"next/server"', JSON.stringify(require.resolve("next/server")));
writeFileSync(join(output, "proxy.js"), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { proxy } = require(join(output, "proxy.js"));
after(() => rmSync(output, { recursive: true, force: true }));

const envKeys = ["NODE_ENV", "BASIC_AUTH_USER", "BASIC_AUTH_PASSWORD"];
let savedEnv;
beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
});
afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const request = authorization => new NextRequest("http://localhost/build", {
  headers: authorization ? { authorization } : {},
});
const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
function assertAllowed(response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
}
function assertChallenged(response) {
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate"), /^Basic /);
  assert.equal(response.headers.get("x-middleware-next"), null);
}

test("development allows requests only without a configured password", () => {
  process.env.NODE_ENV = "development";
  assertAllowed(proxy(request()));
  process.env.BASIC_AUTH_PASSWORD = "";
  assertAllowed(proxy(request()));
});

test("a configured password is enforced even in development", () => {
  process.env.NODE_ENV = "development";
  process.env.BASIC_AUTH_PASSWORD = "demo-password";
  assertChallenged(proxy(request()));
  assertChallenged(proxy(request(basic("guest", "wrong"))));
  assertAllowed(proxy(request(basic("guest", "demo-password"))));
});

test("production and other environments fail closed without a password", () => {
  for (const environment of ["production", "test", undefined]) {
    if (environment) process.env.NODE_ENV = environment;
    else delete process.env.NODE_ENV;
    const response = proxy(request(basic("guest", "demo-password")));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-middleware-next"), null);
  }
});

test("production rejects missing, malformed, and incorrect credentials", () => {
  process.env.NODE_ENV = "production";
  process.env.BASIC_AUTH_PASSWORD = "demo-password";
  for (const header of [undefined, "Bearer token", "Basic !!!", "Basic Z3Vlc3Q=",
    basic("guests", "demo-password"), basic("gues", "demo-password"),
    basic("guest", "demo-password-extra"), basic("guest", "demo-passwor")]) {
    assertChallenged(proxy(request(header)));
  }
  assertAllowed(proxy(request(basic("guest", "demo-password"))));
});

test("custom Unicode credentials and colons in passwords remain supported", () => {
  process.env.NODE_ENV = "production";
  process.env.BASIC_AUTH_USER = "démo";
  process.env.BASIC_AUTH_PASSWORD = "sésame:🔑";
  assertAllowed(proxy(request(basic("démo", "sésame:🔑"))));
  assertChallenged(proxy(request(basic("demo", "sésame:🔑"))));
  assertChallenged(proxy(request(basic("démo", "sésame:🔒"))));
});
