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
const { ConversationStore, updateConversation } = createRequire(import.meta.url)(join(output, "conversation.js"));
after(() => rmSync(output, { recursive: true, force: true }));

const profile = { id: "am", name: "Alex Morgan", firstName: "Alex", initials: "AM", role: "Developer", experience: "returning", workspaceExperience: "established", surfaceAccess: ["build", "code", "govern", "alm"] };
const first = { profile, capturedAt: "2026-09-14T10:00:00Z", projectName: "CRM", branch: "main", assessment: { status: "running", step: 1 } };
const second = { ...first, capturedAt: "2026-09-14T11:00:00Z" };
const home = (snapshot = first) => ({ type: "today", snapshot });
const build = { type: "surface", scopeKey: "build", label: "Build & Setup", reply: "What would you like to build?" };
const messages = (store, key = "crm:main") => store.getSnapshot().sessions[key].messages;

test("target-org changes append context without replacing history and survive surface and send events", () => {
  const store = new ConversationStore(), org = { type: "org", orgId: "uat", label: "UAT Sandbox" };
  store.dispatch("global", { type: "org", orgId: null, label: null });
  store.dispatch("global", home());
  store.dispatch("global", org); store.dispatch("global", build);
  store.dispatch("global", { type: "send", text: "Keep working", reply: "Working in UAT" });
  const before = store.getSnapshot().sessions.global;
  store.dispatch("global", org);
  assert.equal(store.getSnapshot().sessions.global, before);
  store.dispatch("global", { type: "org", orgId: "prod", label: "Production" });
  assert.deepEqual(messages(store, "global").slice(0, -1), before.messages);
  assert.equal(messages(store, "global").at(-1).text, "Target org · Production");
  assert.equal(store.getSnapshot().sessions.global.targetOrgId, "prod");
  assert.equal(messages(store, "global").filter(message => message.text === "Target org · UAT Sandbox").length, 1);
  store.dispatch("global", home());
  assert.equal(store.getSnapshot().sessions.global.targetOrgId, "prod");
});

test("project opening seeds an empty or legacy Today-only thread once and resumes existing work verbatim", () => {
  const store = new ConversationStore(), introduction = { type: "project", label: "CRM", reply: "Your project is ready for planning." };
  store.dispatch("new", introduction);
  assert.deepEqual(messages(store, "new").map(message => message.role), ["context", "agent"]);
  store.dispatch("new-with-org", { type: "org", orgId: "uat", label: "UAT Sandbox" });
  store.dispatch("new-with-org", introduction);
  assert.deepEqual(messages(store, "new-with-org").map(message => message.role), ["context", "context", "agent"]);
  assert.equal(messages(store, "new-with-org").at(-1).text, introduction.reply);
  store.dispatch("new-with-org", introduction);
  assert.equal(messages(store, "new-with-org").length, 3);
  store.dispatch("crm:main", home());
  store.dispatch("crm:main", introduction);
  assert.deepEqual(messages(store).map(message => message.role), ["today", "context", "agent"]);
  assert.deepEqual(messages(store)[0].snapshot, first, "legacy briefing remains stored");
  store.dispatch("crm:main", build);
  const before = store.getSnapshot().sessions["crm:main"];
  store.dispatch("crm:main", introduction);
  assert.equal(store.getSnapshot().sessions["crm:main"], before, "returning to the project must not append a new entry or change its scope");
});

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

test("Home reuses trailing Today across project visits and legacy forced returns, retaining its timestamp", () => {
  const store = new ConversationStore();
  store.dispatch("global", home(first));
  const original = store.getSnapshot().sessions.global;
  store.dispatch("project", { type: "project", label: "CRM", reply: "Your project is ready." });
  store.dispatch("project", { type: "send", text: "Plan this project", reply: "Here is the plan." });
  store.dispatch("global", { ...home(second), force: true });
  assert.equal(store.getSnapshot().sessions.global, original);
  assert.equal(messages(store, "global").at(-1).snapshot.capturedAt, first.capturedAt);
  const restored = updateConversation({ ...original, scopeKey: "build" }, home(second));
  assert.equal(restored.scopeKey, "home"); assert.equal(restored.messages, original.messages);
});

test("Home appends Today only after intervening global messages or context, then reuses it", () => {
  for (const event of [build, { type: "send", text: "Hello", reply: "How can I help?" }, { type: "org", orgId: "uat", label: "UAT Sandbox" }]) {
    const firstVisit = updateConversation(undefined, home(first));
    const intervening = updateConversation(firstVisit, event);
    const returned = updateConversation(intervening, home(second));
    assert.equal(returned.messages.length, intervening.messages.length + 1);
    assert.equal(returned.messages[0], firstVisit.messages[0]);
    assert.equal(returned.messages.at(-1).snapshot, second);
    assert.equal(updateConversation(returned, { ...home(first), force: true }), returned);
  }
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
