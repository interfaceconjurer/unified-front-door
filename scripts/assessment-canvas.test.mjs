import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { testModules } from "./test-modules.mjs";

const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { assessmentCanvas, assessmentCanvasView } = modules.load("lib/assessment/canvas");
const { canvasId, canvasTarget, parseCanvasInput, inputFromCanonicalId, isReadOnlyCanvas } = modules.load("lib/surface-canvas/model");
const { SurfaceCanvasStore } = modules.load("lib/surface-canvas/persistence");
const { destinationHref, readDestination, resolveDestination } = modules.load("lib/navigation/model");
const { parseCommand } = modules.load("lib/application/contracts");
const { captureFindings } = modules.load("lib/assessment/model");
const { ASSESSMENT_FINDINGS, ASSESSMENT_ORGS } = modules.load("lib/onboarding/assessment");
const { INITIAL } = modules.load("lib/assessment/state-codec");
const { demoProfileById } = modules.load("lib/demo-profiles");
const { navigationOptions, navigationMatchesContext, resolveNavigationCall } = modules.load("lib/agent/navigation");
const scope = { scope: "unbound", orgId: "uat" };
const run = id => ({ id, startedAt: "2026-09-19T12:00:00Z", completedAt: "2026-09-19T12:01:00Z", scopeOrgIds: ["prod", "uat"],
  findings: captureFindings(id, ASSESSMENT_FINDINGS, ASSESSMENT_ORGS, "2026-09-19T12:01:00Z"), source: { adapter: "demo-org-assessment", version: "1" } });
const original = run("original"), latest = run("latest");
const state = { ...INITIAL, status: "running", currentRunId: latest.id, scopeOrgIds: ["sit"], runs: [original, { ...latest, completedAt: null, findings: [] }] };
const destination = canvas => ({ version: 1, owner: "sp", surface: "build", canvas, target: canvasTarget(canvas, { projectId: null, worktreeId: null, orgId: null }) });

test("assessment canvas identity captures run, finding and scope without mutable evidence", () => {
  const input = assessmentCanvas(scope, original.id, original.findings[0]), id = canvasId(input.kind, input.params);
  assert.deepEqual(inputFromCanonicalId(id).params, input.params);
  assert.equal(isReadOnlyCanvas(input), true);
  assert.equal(parseCanvasInput({ ...input, params: { scope: "unbound", findingId: original.findings[0].id } }), null);
  assert.equal(parseCanvasInput({ ...input, params: { runId: original.id } }), null);
  assert.notEqual(id, canvasId(input.kind, assessmentCanvas(scope, latest.id, latest.findings[0]).params));
  assert.notEqual(id, canvasId(input.kind, assessmentCanvas({ scope: "project", projectId: "plan-1", orgId: "uat" }, original.id, original.findings[0]).params));
  assert.deepEqual(canvasTarget(input, { projectId: "ignored", worktreeId: "ignored", orgId: "ignored" }), { projectId: null, worktreeId: null, orgId: "uat" });
  assert.equal(assessmentCanvas(input.params, latest.id).params.findingId, undefined, "Leaving a finding does not carry its identity into another run");
  assert.equal(parseCanvasInput(assessmentCanvas(scope)).kind, "org-assessment", "Scope is available before the first run");
});

test("old-run evidence and scope remain exact after rescan, with no current-run controls or fallback", () => {
  const view = assessmentCanvasView(assessmentCanvas(scope, original.id, original.findings[0]).params, state);
  assert.equal(view.kind, "available"); assert.equal(view.current, false); assert.equal(view.status, "complete");
  assert.equal(view.finding.runId, original.id); assert.deepEqual(view.finding.evidence, original.findings[0].evidence);
  assert.deepEqual(view.scopeOrgIds, original.scopeOrgIds);
  assert.equal(assessmentCanvasView(assessmentCanvas(scope, "missing").params, state).kind, "unavailable");
  assert.equal(assessmentCanvasView(assessmentCanvas(scope, original.id, latest.findings[0]).params, state).kind, "unavailable");
  assert.equal(assessmentCanvasView(assessmentCanvas(scope, latest.id).params, state).current, true);
  assert.equal(assessmentCanvasView(assessmentCanvas(scope).params, INITIAL).status, "idle");
});

test("assessment navigation is Build-only, scoped, and restricted to the onboarding profile", () => {
  const input = assessmentCanvas(scope, original.id), value = destination(input), href = destinationHref(value);
  assert.deepEqual(readDestination(href), { kind: "destination", value });
  assert.equal(resolveDestination(href, "sp", demoProfileById("sp").surfaceAccess, {}).kind, "available");
  assert.equal(readDestination(destinationHref({ ...value, surface: "code" })).kind, "invalid");
  assert.equal(readDestination(destinationHref({ ...value, target: { ...value.target, orgId: "sit" } })).kind, "invalid");
  assert.equal(resolveDestination(destinationHref({ ...value, owner: "am" }), "am", demoProfileById("am").surfaceAccess, {}).kind, "unavailable");
});

test("assessment tabs survive reload but cannot persist editable evidence or copy drafts", () => {
  const disk = new Map(); global.window = { localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) }, addEventListener() {}, removeEventListener() {} };
  const store = new SurfaceCanvasStore("assessment-test"), input = assessmentCanvas(scope, original.id, original.findings[0]), id = canvasId(input.kind, input.params);
  store.captureTarget("build", id, destination(input).target); store.openCanvas("build", input);
  const restored = new SurfaceCanvasStore("assessment-test");
  assert.deepEqual(restored.getSnapshot(), store.getSnapshot());
  assert.throws(() => restored.openCanvas("code", input), /Invalid canvas/);
  assert.equal(restored.copyDraft("build", id, input), false);
  const base = { commandId: "attempt-write", expectedRevision: 0, surface: "build", canvas: input, target: destination(input).target };
  assert.throws(() => parseCommand({ ...base, kind: "canvas.save", fields: { evidence: "Changed" } }));
  assert.throws(() => parseCommand({ ...base, kind: "canvas.copy", sourceId: id, sourceRevision: 1 }));
});

test("agent destinations use captured owned assessment references and revalidate against those exact references", () => {
  const context = { profile: demoProfileById("sp"), target: destination(assessmentCanvas(scope)).target, surface: "build", improvement: null,
    assessmentNavigation: { runId: original.id, findings: [{ id: original.findings[0].id, title: original.findings[0].title }] } };
  const options = navigationOptions(context), finding = options.find(option => option.id === `finding:${original.findings[0].id}`);
  assert.ok(finding); assert.equal(finding.destination.canvas.params.runId, original.id);
  assert.deepEqual(finding.destination.target, context.target);
  const action = resolveNavigationCall(options, { id: "toolu_assessment", name: "open_canvas", input: { destinationId: finding.id } });
  assert.ok(navigationMatchesContext(action, context));
  assert.equal(navigationMatchesContext(action, { ...context, assessmentNavigation: { runId: latest.id, findings: [] } }), false);
  for (const profile of [demoProfileById("am"), demoProfileById("kf")]) assert.equal(navigationOptions({ ...context, profile }).some(option => option.destination.canvas?.kind === "org-assessment"), false);
  assert.equal(navigationOptions({ ...context, assessmentNavigation: undefined }).some(option => option.destination.canvas?.kind === "org-assessment"), false, "Older captured runs keep their original catalog");
});
