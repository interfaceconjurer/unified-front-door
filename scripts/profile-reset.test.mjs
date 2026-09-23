import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testModules } from "./test-modules.mjs";

const modules = testModules(); after(modules.cleanup);
const { applicationClient } = modules.load("lib/application/client");
const { EMPTY_APPLICATION } = modules.load("lib/application/remote-store");
const originalFetch = globalThis.fetch;
const clients = [];
afterEach(() => {
  for (const client of clients.splice(0)) { client.workspace?.deactivate(); client.canvases?.dispose(); client.agent?.deactivate(); }
  globalThis.fetch = originalFetch;
  delete globalThis.window; delete globalThis.localStorage;
});

function storage(disk = new Map()) {
  return { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, String(value)), removeItem: key => disk.delete(key), key: index => [...disk.keys()][index] ?? null, get length() { return disk.size; } };
}
function harness({ profileId = null, blockedStorage = false, loseFirstAck = false } = {}) {
  const sessionDisk = new Map(), localDisk = new Map(), sessionStorage = storage(sessionDisk), localStorage = storage(localDisk);
  globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  Object.defineProperty(window, "sessionStorage", { get() { if (blockedStorage) throw Error("Session storage denied"); return sessionStorage; } });
  globalThis.localStorage = localStorage;
  const state = { session: { namespaceId: randomUUID(), profileId, generation: randomUUID(), expiresAt: "2099-01-01T00:00:00.000Z", ...(profileId ? { workspaceEpoch: randomUUID() } : {}) }, clears: 0, savedWork: "Original saved work" };
  const posts = [], receipts = new Map();
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/session" && options.method === "GET") return Response.json({ session: state.session });
    if (path === "/api/session" && options.method === "POST") {
      const command = JSON.parse(options.body); posts.push(command);
      assert.equal(command.action, "reset-profile");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.headers["x-ufd-mutation"], "1");
      const existing = receipts.get(command.commandId);
      if (existing) assert.deepEqual(command, existing, "Retry must preserve the complete original command");
      else {
        assert.equal(command.generation, state.session.generation);
        receipts.set(command.commandId, structuredClone(command)); state.clears++; state.savedWork = "";
      }
      if (loseFirstAck && posts.length === 1) throw Error("Response lost after server commit");
      return Response.json({ session: state.session });
    }
    if (String(path).startsWith("/api/application?") && options.method === "GET") return Response.json({ ...structuredClone(EMPTY_APPLICATION), session: state.session });
    if (String(path).startsWith("/api/agent?") && options.method === "GET") return Response.json({ conversations: [], runs: [] });
    throw Error(`Unexpected test request: ${options.method} ${path}`);
  };
  const connect = async () => {
    const client = new applicationClient.constructor(); clients.push(client);
    await client.reconnect();
    assert.deepEqual(client.getSnapshot().session, state.session);
    if (client.workspace) await client.workspace.load();
    return client;
  };
  return { state, posts, sessionDisk, localDisk, connect, key: target => `ufd.profile-reset.v1.${state.session.namespaceId}.${target}` };
}

test("lost clear acknowledgement survives reload and retries the same receipt after new work and a new generation", async () => {
  const h = harness({ loseFirstAck: true }), first = await h.connect();
  const uncertain = await first.clearProfile("sp", h.state.session.namespaceId);
  assert.equal(uncertain.ok, false); assert.equal(uncertain.retryable, true);
  assert.equal(h.state.clears, 1);
  const original = structuredClone(h.posts[0]);
  assert.deepEqual(JSON.parse(h.sessionDisk.get(h.key("sp"))), original);
  h.state.savedWork = "Saved after the first clear";
  h.state.session = { ...h.state.session, generation: randomUUID() };
  const reloaded = await h.connect();
  assert.deepEqual(await reloaded.clearProfile("sp", h.state.session.namespaceId), { ok: true });
  assert.deepEqual(h.posts, [original, original]);
  assert.equal(h.state.clears, 1);
  assert.equal(h.state.savedWork, "Saved after the first clear");
  assert.equal(h.sessionDisk.has(h.key("sp")), false);
  assert.deepEqual(reloaded.getSnapshot().session, h.state.session);
});

test("blocked session storage keeps the exact uncertain clear command for an in-tab retry", async () => {
  const h = harness({ blockedStorage: true, loseFirstAck: true }), client = await h.connect();
  assert.equal((await client.clearProfile("jw", h.state.session.namespaceId)).retryable, true);
  const original = structuredClone(h.posts[0]);
  h.state.savedWork = "Keep work added after uncertain clear";
  assert.deepEqual(await client.clearProfile("jw", h.state.session.namespaceId), { ok: true });
  assert.deepEqual(h.posts, [original, original]);
  assert.equal(h.state.clears, 1);
  assert.equal(h.state.savedWork, "Keep work added after uncertain clear");
});

test("clearing a different profile preserves selected workspace stores and unsent edits", async () => {
  const h = harness({ profileId: "am" }), client = await h.connect();
  const owned = { workspace: client.workspace, canvases: client.canvases, selection: client.selection, agent: client.agent };
  const edit = client.workspace.enqueueEdit({ kind: "canvas.save", surface: "build", canvas: { kind: "capability", title: "Automation", params: { scope: "unbound", surface: "build", capability: "automation" } }, target: { projectId: null, worktreeId: null, orgId: null }, fields: { notes: "Keep this unsent Alex edit" } });
  const pending = client.workspace.getPending(), buffer = h.localDisk.get(client.workspace.storageKey);
  assert.deepEqual(await client.clearProfile("sp", h.state.session.namespaceId), { ok: true });
  for (const [name, store] of Object.entries(owned)) assert.equal(client[name], store, `${name} must remain the same instance`);
  assert.equal(client.workspace.getPending(), pending);
  assert.equal(h.localDisk.get(client.workspace.storageKey), buffer);
  assert.equal(client.getSnapshot().session.profileId, "am");
  client.workspace.deactivate(); assert.equal(await edit, null);
});

test("a clear dialog from another namespace cannot send a request", async () => {
  const h = harness(), client = await h.connect();
  for (const expected of [undefined, randomUUID()]) {
    const result = await client.clearProfile("sp", expected);
    assert.equal(result.ok, false); assert.equal(result.retryable, false);
  }
  assert.deepEqual(h.posts, []); assert.equal(h.state.clears, 0);
  assert.equal(h.sessionDisk.size, 0);
});

test("malformed saved clear requests retain their bytes and never send a new destructive request", async () => {
  const h = harness();
  const valid = { action: "reset-profile", profileId: "sp", generation: h.state.session.generation, commandId: randomUUID() };
  const invalid = ["", "{not json", "null", "[]", JSON.stringify({ ...valid, profileId: "am" }), JSON.stringify({ ...valid, action: "select" }), JSON.stringify({ ...valid, generation: "" }), JSON.stringify({ ...valid, commandId: "" }), JSON.stringify({ ...valid, namespaceId: randomUUID() })];
  for (const raw of invalid) {
    h.sessionDisk.set(h.key("sp"), raw);
    const client = await h.connect(), result = await client.clearProfile("sp", h.state.session.namespaceId);
    assert.equal(result.ok, false, `Malformed bytes must be refused: ${raw}`);
    assert.equal(result.retryable, false);
    assert.equal(h.sessionDisk.get(h.key("sp")), raw);
  }
  assert.deepEqual(h.posts, []); assert.equal(h.state.clears, 0);
});

test("background reconnect and repeated clicks cannot overtake a pending sign-out", async () => {
  const h = harness({ profileId: "am" }), client = await h.connect(), fetch = globalThis.fetch;
  let release, reads = 0, writes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/session" && options.method === "GET") reads++;
    if (path === "/api/session" && options.method === "POST") {
      writes++; assert.equal(JSON.parse(options.body).action, "signout");
      await gate;
      h.state.session = { ...h.state.session, profileId: null, workspaceEpoch: undefined, generation: randomUUID() };
      return Response.json({ session: h.state.session });
    }
    return fetch(path, options);
  };
  const signout = client.change("signout");
  assert.equal(client.getSnapshot().resolved, true, "Keep the current interface mounted while awaiting an account action");
  await client.reconnect();
  assert.equal(await client.change("select", "sp"), false);
  assert.equal(reads, 0); assert.equal(writes, 1);
  release(); assert.equal(await signout, true);
  assert.equal(client.getSnapshot().session.profileId, null);
  assert.equal(client.workspace, null); assert.equal(client.agent, null);
});

test("failed session changes restore usable stores once a later reconnect succeeds", async () => {
  const h = harness({ profileId: "am" }), client = await h.connect(), fetch = globalThis.fetch, previous = client.workspace;
  globalThis.fetch = async () => { throw Error("Disconnected"); };
  assert.equal(await client.change("signout"), false);
  assert.equal(client.getSnapshot().resolved, false, "Do not expose a deactivated workspace while the account change is uncertain");
  assert.equal(client.getSnapshot().sessionUnavailable, true);
  globalThis.fetch = fetch;
  await client.reconnect();
  assert.notEqual(client.workspace, previous, "A deactivated store must not be reused after reconnect");
  await client.workspace.load();
  assert.equal(client.workspace.isReady(), true);
  assert.equal(client.getSnapshot().session.profileId, "am");
  assert.equal(client.getSnapshot().message, "");
  assert.equal(client.getSnapshot().sessionUnavailable, false);
});

test("a failed first session read stays unresolved and never confirms a sign-out", async () => {
  const h = harness({ profileId: "am" }), fetch = globalThis.fetch;
  const client = new applicationClient.constructor(); clients.push(client);
  globalThis.fetch = async () => Response.json({ error: { code: "unavailable", message: "Try again" } }, { status: 503 });
  await client.reconnect();
  assert.equal(client.getSnapshot().resolved, false);
  assert.equal(client.getSnapshot().sessionUnavailable, true);
  globalThis.fetch = fetch;
  await client.reconnect();
  assert.equal(client.getSnapshot().session.profileId, h.state.session.profileId);
  assert.equal(client.getSnapshot().resolved, true);
  assert.equal(client.getSnapshot().sessionUnavailable, false);
});

test("focus and polling share a slow session read instead of starving session resolution", async () => {
  const h = harness({ profileId: "am" }), fetch = globalThis.fetch;
  const client = new applicationClient.constructor(); clients.push(client);
  let release, reads = 0;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (path, options) => {
    if (path === "/api/session") { reads++; await gate; }
    return fetch(path, options);
  };
  const pending = [client.reconnect(), client.reconnect(), client.reconnect()];
  assert.equal(reads, 1);
  release(); await Promise.all(pending);
  assert.equal(client.getSnapshot().resolved, true);
  assert.equal(client.getSnapshot().session.profileId, h.state.session.profileId);
});

test("startup recovery loads saved data while preserving pending or unreadable edit buffers", async () => {
  for (const malformed of [false, true]) {
    const h = harness({ profileId: "am" }), fetch = globalThis.fetch, session = h.state.session;
    const key = `ufd.pending.v1.${session.namespaceId}.${session.profileId}.${session.generation}.previous`;
    const command = { kind: "assessment.pause", commandId: randomUUID(), expectedRevision: 0 };
    const raw = malformed ? "{unreadable" : JSON.stringify({ session, commands: [command] });
    h.localDisk.set(key, raw);
    h.sessionDisk.set(`ufd.pending-pointer.v1.${session.namespaceId}.${session.profileId}.${session.generation}`, "previous");
    let unavailable = true;
    globalThis.fetch = (path, options = {}) => {
      if (String(path).startsWith("/api/application") && (unavailable || options.method === "POST"))
        return Promise.resolve(Response.json({ error: { code: "unavailable", message: "Try again" } }, { status: 503 }));
      return fetch(path, options);
    };
    const client = new applicationClient.constructor(); clients.push(client);
    await client.reconnect(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(client.workspace.isReady(), false);
    unavailable = false;
    await client.reconnect();
    assert.equal(client.workspace.isReady(), true);
    assert.equal(h.localDisk.get(key), raw, "Recovery never erases the source buffer");
    if (malformed) assert.equal(client.workspace.getPersistenceSnapshot(), "invalid");
    else assert.deepEqual(client.workspace.getPending(), [command]);
    client.workspace.deactivate();
  }
});

test("a late session read cannot bootstrap or restore the previous account after sign-out", async () => {
  const h = harness({ profileId: "am" }), client = await h.connect(), fetch = globalThis.fetch;
  let release, posts = 0;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (path, options = {}) => {
    if (path === "/api/session" && options.method === "GET") { await gate; return Response.json({ session: null }); }
    if (path === "/api/session" && options.method === "POST") {
      posts++; assert.equal(JSON.parse(options.body).action, "signout");
      h.state.session = { ...h.state.session, profileId: null, generation: randomUUID() };
      return Response.json({ session: h.state.session });
    }
    return fetch(path, options);
  };
  const pending = client.reconnect();
  assert.equal(await client.change("signout"), true);
  release(); await pending;
  assert.equal(posts, 1);
  assert.equal(client.getSnapshot().session.profileId, null);
  assert.equal(client.workspace, null);
});

test("sign-in chooses an org before workspace entry and remembers each profile's own selection", async () => {
  const h = harness(), client = await h.connect(), fetch = globalThis.fetch;
  const selections = [];
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/session' && options.method === 'POST') {
      const command = JSON.parse(options.body); selections.push(command);
      h.state.session = { ...h.state.session, profileId: command.profileId, generation: randomUUID(), workspaceEpoch: `epoch-${command.profileId}` };
      return Response.json({ session: h.state.session });
    }
    return fetch(path, options);
  };
  assert.equal(await client.change('select', 'kf', 'scratch-hotfix'), false);
  assert.equal(await client.change('select', 'sp', 'acme-devhub'), false);
  assert.equal(selections.length, 0, 'Reject unavailable orgs before changing the signed-in session');
  assert.equal(await client.change('select', 'kf', 'sit'), true);
  assert.deepEqual(client.selection.getSnapshot().target, { projectId: null, worktreeId: null, orgId: 'sit' });
  assert.equal(await client.change('select', 'am'), true);
  assert.equal(client.selection.getSnapshot().target.orgId, 'uat');
  assert.equal(await client.change('select', 'kf'), true);
  assert.equal(client.selection.getSnapshot().target.orgId, 'sit', 'Switching profiles retains their own connected org');
  client.selection.setTarget({ projectId: null, worktreeId: null, orgId: 'scratch-hotfix' });
  assert.equal(await client.change('select', 'kf'), true);
  assert.equal(client.selection.getSnapshot().target.orgId, 'uat', 'Expired remembered orgs fall back to a connected starting org');
});
