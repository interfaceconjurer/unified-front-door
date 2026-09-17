import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const output = mkdtempSync(join(tmpdir(), "ufd-conversation-test-"));
const source = readFileSync(new URL("../src/lib/chat/conversation.ts", import.meta.url), "utf8");
writeFileSync(join(output, "conversation.js"), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { ConversationStore } = createRequire(import.meta.url)(join(output, "conversation.js"));
after(() => rmSync(output, { recursive: true, force: true }));

const first = { capturedAt: "2026-09-14T10:00:00Z", projectName: "CRM", branch: "main", assessment: { status: "running", step: 1 } };
const second = { ...first, capturedAt: "2026-09-14T11:00:00Z" };
const home = (snapshot = first) => ({ type: "today", snapshot });
const build = { type: "surface", scopeKey: "build", label: "Build & Setup", reply: "What would you like to build?" };
const messages = (store, key = "crm:main") => store.getSnapshot().sessions[key].messages;

test("Today survives exploration, messages, and the return home in chronological order", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", build);
  store.dispatch("crm:main", { type: "send", text: "Build a routing agent", reply: "Let’s define its instructions." });
  store.dispatch("crm:main", home(second));
  assert.deepEqual(messages(store).map((message) => message.role), ["today", "context", "agent", "user", "agent", "today"]);
  assert.equal(messages(store)[0].snapshot, first);
  assert.equal(messages(store).at(-1).snapshot, second);
  assert.equal(new Set(messages(store).map((message) => message.id)).size, 6);
});

test("repeated Home clicks refocus without replacing or duplicating the latest briefing", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", home(second));
  assert.equal(messages(store).length, 1);
  assert.equal(messages(store)[0].snapshot, first);
  assert.equal(store.getSnapshot().scrollRevision, 2);
});

test("route arrival does not duplicate a work-specific response or a sent prompt", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", { ...build, reply: "I’ve opened your routing agent.", force: true });
  store.dispatch("crm:main", build);
  assert.equal(messages(store).length, 3);
  assert.equal(messages(store).at(-1).text, "I’ve opened your routing agent.");
  store.dispatch("crm:main", home(second));
  store.dispatch("crm:main", { type: "send", text: "Help me build", reply: "Let’s start in Build & Setup.", destination: { key: "build", label: "Build & Setup" } });
  store.dispatch("crm:main", build);
  assert.deepEqual(messages(store).slice(-3).map((message) => message.role), ["user", "context", "agent"]);
});

test("project and worktree sessions retain independent histories", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", build);
  const original = messages(store);
  store.dispatch("crm:release", home({ ...first, branch: "release" }));
  store.dispatch("storefront:main", home({ ...first, projectName: "Storefront" }));
  store.dispatch("crm:main", build);
  assert.equal(messages(store), original);
  assert.equal(messages(store, "crm:release")[0].snapshot.branch, "release");
  assert.equal(messages(store, "storefront:main")[0].snapshot.projectName, "Storefront");
});

test("assessment progress updates only the current Today and never scrolls or rewrites history", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  const completed = { status: "complete", step: 5 };
  const revision = store.getSnapshot().scrollRevision;
  store.recordAssessment("crm:main", completed);
  assert.equal(messages(store)[0].snapshot.assessment, completed);
  assert.equal(first.assessment.status, "running");
  assert.equal(store.getSnapshot().scrollRevision, revision);
  store.dispatch("crm:main", build);
  store.recordAssessment("crm:main", { status: "running", step: 0 });
  assert.equal(messages(store)[0].snapshot.assessment, completed);
});

test("opening a surface directly seeds a usable thread and first Home visit appends Today", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", build);
  store.dispatch("crm:main", build);
  assert.deepEqual(messages(store).map((message) => message.role), ["context", "agent"]);
  store.dispatch("crm:main", home());
  assert.deepEqual(messages(store).map((message) => message.role), ["context", "agent", "today"]);
});

test("navigation stages new entries while preserving the visible Today and route arrival keeps the sequence", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", build, { deferReveal: true });
  const pending = store.getSnapshot().presentation;
  assert.equal(pending.phase, "layout");
  assert.equal(pending.afterId, messages(store)[0].id);
  assert.equal(pending.scopeKey, "build");
  store.dispatch("crm:main", build, { deferReveal: true });
  assert.equal(store.getSnapshot().presentation, pending);
  store.advancePresentation(pending.revision, "scrolling");
  assert.equal(store.getSnapshot().presentation.phase, "scrolling");
  store.advancePresentation(pending.revision, "revealing");
  assert.equal(store.getSnapshot().presentation.phase, "revealing");
  store.advancePresentation(pending.revision, "complete");
  assert.equal(store.getSnapshot().presentation, null);
});

test("superseded motion cannot reveal or complete a newer navigation", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", build, { deferReveal: true });
  const earlier = store.getSnapshot().presentation;
  store.advancePresentation(earlier.revision, "scrolling");
  store.dispatch("crm:main", home(second), { deferReveal: true });
  const latest = store.getSnapshot().presentation;
  store.advancePresentation(earlier.revision, "complete");
  assert.equal(store.getSnapshot().presentation, latest);
  assert.equal(latest.scopeKey, "home");
  assert.equal(latest.afterId, earlier.afterId);
});

test("a new navigation does not hide context that is already being revealed", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", build, { deferReveal: true });
  store.advancePresentation(store.getSnapshot().presentation.revision, "revealing");
  const lastVisible = messages(store).at(-1).id;
  store.dispatch("crm:main", home(second), { deferReveal: true });
  assert.equal(store.getSnapshot().presentation.afterId, lastVisible);
});
