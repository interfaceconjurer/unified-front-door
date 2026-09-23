import assert from "node:assert/strict";
import { after, test } from "node:test";
import { testModules } from "./test-modules.mjs";

const modules = testModules();
after(modules.cleanup);
const { demoProfileById } = modules.load("lib/demo-profiles");
const { startersForProfile, starterLaunch, isStarterPrompt } = modules.load("lib/agent/starters");
const { canvasId, canvasTarget } = modules.load("lib/surface-canvas/model");
const { destinationHref, resolveDestination } = modules.load("lib/navigation/model");

test("developer starters resolve to real canvases while retaining captured org and worktree scope", () => {
  const profile = demoProfileById("am");
  const targets = [
    { projectId: null, worktreeId: null, orgId: null },
    { projectId: null, worktreeId: null, orgId: "uat" },
    { projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" },
  ];
  const expected = {
    project: ["alm", "project"], agent: ["build", "agent"], app: ["code", "react-app"],
    pipeline: ["alm", "pipeline"], "existing-project": ["code", "sfdx-project"],
  };
  for (const target of targets) {
    const scope = target.projectId
      ? { scope: "project", ...target }
      : { scope: "unbound", ...(target.orgId ? { orgId: target.orgId } : {}) };
    for (const [id, [surface, capability]] of Object.entries(expected)) {
      const launch = starterLaunch(id, profile, scope);
      assert.ok(launch, id);
      assert.equal(launch.starter.surfaceId, surface);
      assert.equal(launch.canvas.params.capability, capability);
      assert.deepEqual(canvasTarget(launch.canvas, target), target);
      const decision = resolveDestination(destinationHref({ version: 1, owner: profile.id, target, surface, canvas: launch.canvas }), profile.id, profile.surfaceAccess, {});
      assert.equal(decision.kind, "available");
      assert.ok(isStarterPrompt(launch.starter.prompt));
    }
  }
});

test("restricted builder has a truthful experience starter and cannot launch Code-only source projects", () => {
  const profile = demoProfileById("kf"), scope = { scope: "unbound", orgId: "uat" };
  const starters = startersForProfile(profile);
  assert.ok(starters.every(starter => profile.surfaceAccess.includes(starter.surfaceId)));
  const app = starterLaunch("app", profile, scope);
  assert.equal(app.starter.title, "Build an app experience");
  assert.equal(app.starter.surfaceId, "build");
  assert.equal(app.canvas.params.capability, "experience");
  assert.doesNotMatch(`${app.starter.title} ${app.starter.description} ${app.starter.prompt}`, /react/i);
  assert.ok(isStarterPrompt(app.starter.prompt));
  assert.equal(starterLaunch("existing-project", profile, scope), null);
  assert.equal(starterLaunch("app", { ...profile, surfaceAccess: ["alm"] }, scope), null);
});

test("starter identity isolates global drafts for different orgs and project worktrees", () => {
  const profile = demoProfileById("jw");
  const scopes = [
    { scope: "unbound" },
    { scope: "unbound", orgId: "uat" },
    { scope: "unbound", orgId: "prod" },
    { scope: "project", projectId: "trailblazer-crm", worktreeId: "main", orgId: "uat" },
    { scope: "project", projectId: "trailblazer-crm", worktreeId: "lead-routing", orgId: "uat" },
  ];
  const ids = scopes.map(scope => {
    const { canvas } = starterLaunch("agent", profile, scope);
    return canvasId(canvas.kind, canvas.params);
  });
  assert.equal(new Set(ids).size, scopes.length);
  assert.equal(starterLaunch("unknown", profile, scopes[0]), null);
});
