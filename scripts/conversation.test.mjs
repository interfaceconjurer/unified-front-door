import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const output = mkdtempSync(join(tmpdir(), "ufd-conversation-test-"));
for (const name of ["conversation", "planning", "surface-intent"]) {
  const source = readFileSync(new URL(`../src/lib/chat/${name}.ts`, import.meta.url), "utf8");
  writeFileSync(join(output, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const { ConversationStore } = require(join(output, "conversation.js"));
const { nextPlanningTurn, planningSuggestions } = require(join(output, "planning.js"));
const { requestedSurface } = require(join(output, "surface-intent.js"));
after(() => rmSync(output, { recursive: true, force: true }));

const first = { capturedAt: "2026-09-14T10:00:00Z", projectName: "CRM", branch: "main", assessment: { status: "running", step: 1 } };
const second = { ...first, capturedAt: "2026-09-14T11:00:00Z" };
const home = (snapshot = first) => ({ type: "today", snapshot });
const build = { type: "surface", scopeKey: "build", label: "Build & Setup", reply: "What would you like to build?" };
const messages = (store, key = "crm:main") => store.getSnapshot().sessions[key].messages;

test("ideas, technical topics, and incidental surface mentions do not navigate", () => {
  for (const prompt of [
    "Help me build an agent that routes leads",
    "Build a React app for our customers",
    "Help me set up my first release pipeline",
    "I want to write code to automate this",
    "I want to use code to automate manual steps",
    "Review my org’s security posture",
    "Our deployment failed; help me make a plan",
    "Start a new project",
    "Should I open Build & Setup?",
    "Don't open Build; let's plan first",
    "Before we go to ALM, help me understand the problem",
    "We might use the Code surface later",
    "Open code examples for inspiration",
  ]) assert.equal(requestedSurface(prompt), null, prompt);
});

test("direct requests for a named surface navigate", () => {
  for (const [prompt, surface] of [
    ["Open Build & Setup", "build"],
    ["Please open the Build surface.", "build"],
    ["Can you please take me to Code?", "code"],
    ["I'd like to go to Govern and Observe", "govern"],
    ["Let’s switch to ALM", "alm"],
    ["Move my plan to the ALM workspace", "alm"],
    ["I want to work in Build and Setup", "build"],
    ["Use the Code surface to review this", "code"],
    ["Open Code and help me build an app", "code"],
    [" /build ", "build"], ["/code", "code"], ["/govern", "govern"], ["/alm", "alm"],
  ]) assert.equal(requestedSurface(prompt), surface, prompt);
});

test("planning collects the user's context and produces a point of view and actionable outline", () => {
  const goal = "Improve lead routing";
  const initial = nextPlanningTurn(undefined, goal);
  assert.match(initial.reply, /Who is this for/);
  assert.match(initial.reply, /handoff/);
  assert.ok(planningSuggestions(initial.planning).includes("Draft a first plan"));
  const audience = nextPlanningTurn(initial.planning, "Our sales team loses time on unassigned leads");
  assert.match(audience.reply, /successful first version/);
  const outcome = nextPlanningTurn(audience.planning, "Every lead gets an owner within five minutes");
  assert.match(outcome.reply, /constraints/);
  const final = nextPlanningTurn(outcome.planning, "Use Salesforce and pilot with one region");
  assert.equal(final.planning.phase, "review");
  for (const value of [goal, audience.planning.audience, outcome.planning.outcome, final.planning.constraints]) {
    assert.ok(final.reply.includes(value));
  }
  assert.match(final.reply, /Point of view[\s\S]+First steps/);
  assert.equal(initial.planning.audience, undefined, "earlier turns remain immutable");
  const tasks = nextPlanningTurn(final.planning, "Break this into tasks");
  assert.ok(tasks.reply.includes(final.planning.outcome));
  assert.ok(tasks.reply.includes(final.planning.constraints));
  assert.match(tasks.reply, /walkthrough/);
});

test("planning shortcuts ask for a goal before drafting, refining, or splitting tasks", () => {
  const reset = nextPlanningTurn(undefined, "Start a new plan").planning;
  for (const current of [undefined, reset]) {
    for (const command of ["Draft a first plan", "Refine the goal", "Break this into tasks"]) {
      const result = nextPlanningTurn(current, `  ${command.toUpperCase()}!  `);
      assert.deepEqual(result.planning, { goal: "", phase: "goal" });
      if (current) assert.equal(result.planning, current, "a shortcut does not change an empty plan");
      assert.match(result.reply, /accomplish first/);
      const next = nextPlanningTurn(result.planning, "Improve lead routing");
      assert.equal(next.planning.goal, "Improve lead routing");
      assert.equal(next.planning.phase, "audience");
    }
  }
});

test("an early draft leaves unknowns open, and users can refine or restart their plan", () => {
  const initial = nextPlanningTurn(undefined, "Improve releases");
  const early = nextPlanningTurn(initial.planning, "Draft a first plan");
  assert.equal(early.planning.phase, "review");
  assert.equal((early.reply.match(/Still to confirm\./g) ?? []).length, 3);
  const refined = nextPlanningTurn(early.planning, "Pilot with one small team");
  assert.match(refined.reply, /Refinements\n• Pilot with one small team/);
  assert.equal(early.planning.refinements, undefined);
  const editing = nextPlanningTurn(refined.planning, "Refine the goal");
  const revised = nextPlanningTurn(editing.planning, "Shorten release reviews");
  assert.equal(revised.planning.goal, "Shorten release reviews");
  assert.equal(revised.planning.phase, "audience");
  const reset = nextPlanningTurn(revised.planning, "Start a new plan");
  assert.deepEqual(reset.planning, { goal: "", phase: "goal" });
  const newPlan = nextPlanningTurn(reset.planning, "Improve support");
  assert.equal(newPlan.planning.goal, "Improve support");
  assert.equal(newPlan.planning.refinements, undefined);
});

test("planning stays in the home conversation, survives surface visits, and belongs to its workspace", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  const turn = nextPlanningTurn(undefined, "Build a routing agent");
  store.dispatch("crm:main", { type: "send", text: turn.planning.goal, ...turn });
  assert.equal(store.getSnapshot().sessions["crm:main"].scopeKey, "home");
  assert.deepEqual(messages(store).map(message => message.role), ["today", "user", "agent"]);
  store.dispatch("crm:main", { type: "send", text: "Open Build", reply: "Let's continue in Build.", destination: { key: "build", label: "Build & Setup" } });
  const navigated = messages(store);
  store.dispatch("crm:main", build);
  assert.equal(messages(store), navigated, "route arrival preserves the planning handoff");
  store.dispatch("crm:main", home(second));
  assert.equal(store.getSnapshot().sessions["crm:main"].planning, turn.planning);
  for (const workspace of ["crm:release", "new-project:main"]) {
    store.dispatch(workspace, home());
    assert.equal(store.getSnapshot().sessions[workspace].planning, undefined);
  }
  assert.equal(store.getSnapshot().sessions["crm:main"].planning.goal, turn.planning.goal);
});

test("a new project starts a fresh chat and draft while retaining the original conversation", () => {
  const store = new ConversationStore();
  const source = "no-project::main";
  const target = "new-project::main";
  const alm = { type: "surface", scopeKey: "alm", label: "ALM", reply: "Let’s plan your project." };
  const welcome = { ...alm, reply: "I’ve created your project. What would you like to do next?" };
  store.dispatch(source, home());
  store.dispatch(source, alm);
  store.dispatch(source, { type: "send", text: "Keep the existing integration.", reply: "We’ll include that constraint." });
  store.setDraft(source, "Also consider peak traffic.");
  const original = messages(store, source);
  store.dispatch(target, welcome);
  const created = messages(store, target);
  assert.deepEqual(created.map(message => message.role), ["context", "agent"]);
  assert.equal(created.at(-1).text, welcome.reply);
  assert.equal(store.getSnapshot().drafts[target] ?? "", "");
  const revision = store.getSnapshot().scrollRevision;
  // Arrival in ALM must keep the creation welcome, without a generic greeting.
  store.dispatch(target, alm);
  assert.equal(messages(store, target), created);
  assert.equal(store.getSnapshot().scrollRevision, revision);
  store.dispatch(target, { type: "send", text: "New project follow-up", reply: "Next steps." });
  store.setDraft(target, value => `${value}Add load tests.`);
  assert.equal(messages(store, source), original);
  assert.equal(store.getSnapshot().drafts[source], "Also consider peak traffic.");
  assert.equal(store.getSnapshot().drafts[target], "Add load tests.");
  store.dispatch(source, alm);
  assert.equal(messages(store, source), original);
});

test("the new project's welcome replaces an outgoing stream without changing its history", () => {
  const store = new ConversationStore();
  store.dispatch("planning", home());
  store.dispatch("planning", build, { deferReveal: true });
  const original = messages(store, "planning");
  const reply = store.getSnapshot().streamingReply;
  store.dispatch("created", { type: "surface", scopeKey: "alm", label: "ALM", reply: "I’ve created your project." });
  const welcome = store.getSnapshot().streamingReply;
  assert.equal(store.getSnapshot().presentation, null);
  assert.equal(welcome.sessionKey, "created");
  store.completeReply("planning", reply.messageId);
  assert.equal(store.getSnapshot().streamingReply, welcome);
  assert.equal(messages(store, "planning"), original);
  store.completeReply("created", welcome.messageId);
  assert.equal(store.getSnapshot().streamingReply, null);
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

test("new replies stream once and route arrival cannot replay completed text", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", home());
  assert.equal(store.getSnapshot().streamingReply, null);
  store.dispatch("crm:main", build, { deferReveal: true });
  const streaming = store.getSnapshot().streamingReply;
  assert.deepEqual(streaming, { sessionKey: "crm:main", messageId: messages(store).at(-1).id });
  store.dispatch("crm:main", build, { deferReveal: true });
  assert.equal(store.getSnapshot().streamingReply, streaming);
  store.completeReply(streaming.sessionKey, streaming.messageId);
  store.dispatch("crm:main", build);
  assert.equal(store.getSnapshot().streamingReply, null);
  assert.equal(messages(store).at(-1).text, build.reply);
});

test("sending or navigating supersedes typing without letting an old completion stop the new reply", () => {
  const store = new ConversationStore();
  store.dispatch("crm:main", build);
  const old = store.getSnapshot().streamingReply;
  store.dispatch("crm:main", { type: "send", text: "Plan the next step", reply: "Here is the plan." });
  const latest = store.getSnapshot().streamingReply;
  assert.notDeepEqual(latest, old);
  store.completeReply(old.sessionKey, old.messageId);
  assert.equal(store.getSnapshot().streamingReply, latest);
  store.dispatch("crm:main", home());
  assert.equal(store.getSnapshot().streamingReply, null);
  assert.equal(messages(store).at(-2).text, "Here is the plan.");
});

test("switching to an existing session completes hidden typing and does not replay it on return", () => {
  const store = new ConversationStore();
  store.dispatch("crm:release", build);
  store.dispatch("crm:main", build);
  const main = store.getSnapshot().streamingReply;
  store.completeReply("crm:release", main.messageId);
  assert.equal(store.getSnapshot().streamingReply, main, "message IDs can repeat across sessions");
  store.dispatch("crm:release", build);
  assert.equal(store.getSnapshot().streamingReply, null);
  store.dispatch("crm:main", build);
  assert.equal(store.getSnapshot().streamingReply, null);
  assert.equal(messages(store).at(-1).text, build.reply);
});
