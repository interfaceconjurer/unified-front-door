import assert from "node:assert/strict";
import { after, test } from "node:test";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup);
const { hasExplicitNavigationIntent, requestedSurface } = modules.load("lib/agent/navigation-intent");
const { recommendSurface, demoReply } = modules.load("lib/agent/demo");
const { demoProfileById } = modules.load("lib/demo-profiles");

test("direct requests and polite prefixes can offer navigation without resolving a destination from keywords", () => {
  for (const text of ["/build", "/code", "/govern", "/alm", "Open the Account object.", "Please show me Account", "Could you please take me to Code?",
    "I want to open the release plan", "I’d like you to bring up Lead Assignment", "Go to Build & Setup", "Switch to Govern and Observe", "Navigate to ALM", "View the Account layout",
    'Open "Account"', "Show Build surface", "Open the release-plan canvas", "Show me the release plan canvas"]) {
    assert.equal(hasExplicitNavigationIntent(text), true, text);
  }
  assert.equal(requestedSurface("Could you please take me to Code?"), "code");
  assert.equal(requestedSurface("Open Account object"), null);
  assert.equal(requestedSurface("Go to Build & Setup"), "build");
  assert.equal(requestedSurface("Switch to Govern and Observe"), "govern");
});

test("planning, instructional text, quotations and negative requests do not offer navigation tools", () => {
  for (const text of ["Build a React app", "Help me plan a release pipeline", "We need better permissions", "Code", "Open", "Open !!!",
    "Show me how to open Account", "Show me why Code helps", "Show what a release plan should contain", "Show me a plan for the rollout",
    '"Open Account object"', "`Open Account object`", "> Open Account object", "An example is: open Account object", "Please explain 'open Account'",
    "Don't open Account", "Please do not open Code", "Open Account, but don't navigate", "Open Code? No, stay here",
    "View Account without leaving chat", "Open Account, not yet", "Open ALM but keep the conversation in this chat",
    "Show me code for a React app", "Show me the steps to deploy", "Show me the plan", "Show me a deployment plan",
    "Open Account, but not now", "Open Account after we finish planning"]) {
    assert.equal(hasExplicitNavigationIntent(text), false, text);
  }
});

test("demo adapter preserves chat for topics and cannot substitute another surface for a denied one", () => {
  const context = { profile: demoProfileById("kf"), surface: "home", hasProjects: false, target: { projectId: null, worktreeId: null, orgId: null } };
  assert.equal(recommendSurface("Help me build a React app", context), null);
  assert.equal(recommendSurface("Open Code", context), null);
  assert.equal(recommendSurface("Open an unknown tool", context), null);
  assert.equal(recommendSurface("Open ALM", context), "alm");
  const reply = demoReply({ kind: "chat", text: "Help me build a React app", context, destination: null });
  assert.match(reply, /Who is this for/); assert.match(reply, /demo planning reply/i); assert.doesNotMatch(reply, /opened|created a project/i);
});
