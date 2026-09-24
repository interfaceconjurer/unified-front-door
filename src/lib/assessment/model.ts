/** Assessment history is application data, independent of live catalogs. */
export type Finding = {
  id: string; orgId: string; category: "Access" | "Limits" | "Automation" | "Release readiness" | "Unknown";
  priority: "High" | "Medium" | "Unknown"; title: string; summary: string; metric: string;
  metricLabel: string; effort: string; impact: string; evidence: readonly string[];
  source: string; hypothesis: string; steps: readonly string[]; validation: string;
};
export type FindingSnapshot = Finding & {
  runId: string; sourceFindingId: string; orgLabel: string;
  capturedAt: string | null;
  provenance: { adapter: string; version: string; evidence: "captured" | "legacy-unavailable" };
};
export type AssessmentRun = {
  id: string; startedAt: string | null; completedAt: string | null;
  scopeOrgIds: string[]; findings: FindingSnapshot[];
  source: { adapter: string; version: string };
};
export function captureFindings(runId: string, findings: readonly Finding[], orgs: readonly { id: string; label: string }[], capturedAt: string): FindingSnapshot[] {
  return findings.map((finding) => ({ ...finding, id: JSON.stringify([runId, finding.id]),
    sourceFindingId: finding.id, runId, orgLabel: orgs.find((org) => org.id === finding.orgId)?.label ?? finding.orgId,
    capturedAt, evidence: [...finding.evidence], steps: [...finding.steps],
    provenance: { adapter: "demo-org-assessment", version: "1", evidence: "captured" },
  }));
}
export function legacyFinding(id: string, title: string, priority: Finding["priority"], runId: string): FindingSnapshot {
  return { id: JSON.stringify([runId, id]), runId, sourceFindingId: id, title, priority, orgId: "unknown", orgLabel: "Original org unavailable",
    capturedAt: null, category: "Unknown", summary: "This older record did not save its assessment evidence.",
    metric: "—", metricLabel: "Original measurement unavailable", effort: "Unrecorded", impact: "Original impact was not recorded.",
    evidence: [], source: "Legacy browser record · original evidence unavailable", hypothesis: "Original hypothesis was not recorded.",
    steps: [], validation: "Original validation criteria were not recorded.",
    provenance: { adapter: "legacy-browser", version: "1", evidence: "legacy-unavailable" } };
}
export function orgAvailability(id: string, orgs: readonly { id: string; label: string; connection: string }[]) {
  const org = orgs.find((entry) => entry.id === id);
  return { label: org?.label ?? id, available: org?.connection === "connected", reason: !org ? "Org unavailable" : org.connection !== "connected" ? "Connection expired" : null };
}

export function currentFindings(state: { runs: readonly AssessmentRun[]; currentRunId: string | null }) {
  return state.runs.find((run) => run.id === state.currentRunId)?.findings ?? [];
}
