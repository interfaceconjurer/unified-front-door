import { decodeAssessment, INITIAL } from "../assessment/state-codec";
import { emptyState, parseState } from "../surface-canvas/persistence";
import { canvasId, canvasTarget, inputFromCanonicalId, type CanvasSpecInput } from "../surface-canvas/model";
import type { Decoded } from "../browser-persistence";
import { SURFACE_IDS } from "../workspace/surfaces";
import { invalid, record, stableJson, type LegacySource, type SavedCanvas } from "./contracts";

function decode<T>(raw: string | null, parser: (v: unknown) => Decoded<T>, initial: T): T {
  if (raw === null) return initial;
  let value: unknown; try { value = JSON.parse(raw); } catch { invalid("The browser source is not valid JSON. Its original bytes were kept."); }
  if (record(value) && "__ufd" in value) { if (value.__ufd !== 1) invalid("The browser source needs a newer importer."); value = value.data; }
  const parsed = parser(value); if ("error" in parsed) invalid("The browser source could not be imported. Its original bytes were kept.");
  return parsed.value;
}
/** Never reads a browser API. Both preview and commit decode the exact explicit source. */
export function decodeLegacy(source: LegacySource) {
  const assessment = decode(source.assessment, decodeAssessment, INITIAL);
  const slices = decode(source.canvases, parseState, emptyState());
  const canvases: SavedCanvas[] = [], recovery: unknown[] = [];
  for (const surface of SURFACE_IDS) {
    const slice = slices[surface]; recovery.push(...(slice.recovery ?? []));
    const ids = new Set([...slice.canvases.map((c) => c.id), ...Object.keys(slice.closedDrafts ?? {}), ...Object.keys(slice.targets ?? {})]);
    for (const id of ids) {
      const open = slice.canvases.find((c) => c.id === id), input = open ?? inputFromCanonicalId(id);
      if (!input || input.kind === "overview") { recovery.push({ id, surface, reason: "The original target cannot be reconstructed." }); continue; }
      const canvas: CanvasSpecInput = { kind: input.kind, title: input.title, params: input.params } as CanvasSpecInput;
      const planId = canvas.kind === "improvement-project" ? canvas.params.projectId : null;
      const plan = assessment.projects.find((project) => project.id === planId);
      if (planId && !slice.targets?.[id] && !plan) {
        recovery.push({ id, surface, original: input, reason: "The historical plan target has no matching project record." }); continue;
      }
      const target = slice.targets?.[id] ?? canvasTarget(canvas, { projectId: null, worktreeId: null, orgId: plan?.targetOrgId ?? null });
      canvases.push({ id: canvasId(canvas.kind, canvas.params), canvas, surface, target, fields: open?.draft ?? slice.closedDrafts?.[id] ?? {}, revision: 1 });
    }
  }
  // Reference validation is structural and historical. Retired org IDs are retained.
  for (const project of assessment.projects) {
    if (project.source === "brief") continue;
    const run = assessment.runs.find((run) => run.id === project.runId);
    if (!run || project.workItems.some((item) => !run.findings.some((f) => f.id === item.findingId))) invalid("A project's historical finding references are inconsistent.");
    if (project.workItems.some((item) => stableJson(item.finding) !== stableJson(run.findings.find((finding) => finding.id === item.findingId)))) invalid("A project's copied evidence differs from its original run. The browser source was kept.");
  }
  if (assessment.draft && !assessment.runs.some((run) => run.id === assessment.draft?.runId)) invalid("The historical project draft has no source run.");
  return { assessment, canvases, recovery };
}
