import type { SavedProject } from "./model";

/** Portable project context, derived from the saved record rather than a second
 * editable copy. Keep command receipts and other persistence internals out. */
export function projectContextFiles(project: SavedProject) {
  const definition = {
    schemaVersion: 1,
    id: project.id,
    name: project.name,
    projectType: project.projectType ?? "standard",
    goal: project.goal,
    context: project.context ?? "",
    owner: project.owner,
    repository: project.repository ?? null,
    targetOrgId: project.targetOrgId,
    scopeOrgIds: project.scopeOrgIds,
    createdAt: project.createdAt,
  };
  const work = {
    schemaVersion: 1,
    projectId: project.id,
    workItems: [...project.workItems].sort((a, b) => a.id.localeCompare(b.id)).map(item => ({
      id: item.id, title: item.title, priority: item.priority, status: item.status,
      findingId: item.findingId, finding: item.finding,
    })),
  };
  return [
    { path: ".project/project.json", content: JSON.stringify(definition, null, 2) + "\n" },
    { path: ".project/work-items.json", content: JSON.stringify(work, null, 2) + "\n" },
  ];
}
