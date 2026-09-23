import type { DemoProfileId } from "../demo-profiles";
import { demoProfileById } from "../demo-profiles";
import type { CanvasSpecInput } from "../surface-canvas/model";
import type { WorkspaceTarget } from "./context";
import { projectsForProfile, workForProfile } from "./demo-workspace";
import type { SurfaceId } from "./model";
import type { SavedProject } from "../projects/model";
import { projectContextFiles } from "../projects/context-files";
import type { ReturningWork } from "./returning-work";

export type ProjectFile = {
  path: string;
  surfaceId: SurfaceId;
  language: string;
  content: string;
  /** Explicit sample comparison when its prior revision is not a listed file. */
  baseContent?: string;
  modified?: boolean;
  source?: "saved-project";
};
const metadataRoot = "force-app/main/default";
const projectMetadata: Record<string, { object: string; flow: string; permission: string }> = {
  "trailblazer-crm": { object: "Lead", flow: "Lead_Routing", permission: "Lead_Routing_User" },
  "acme-storefront": { object: "Account", flow: "Account_Onboarding", permission: "Storefront_User" },
  "customer-onboarding": { object: "Onboarding_Task__c", flow: "Customer_Welcome", permission: "Customer_Success" },
  "service-operations": { object: "Case", flow: "Priority_Case_Routing", permission: "Service_Agent" },
  "revenue-insights": { object: "Opportunity", flow: "Forecast_Refresh", permission: "Revenue_Analyst" },
  "integration-hub": { object: "Order", flow: "Order_Sync", permission: "Integration_User" },
};

export function workFilePath(work: ReturningWork): string {
  const filename = work.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  return work.kind === "Apex class" ? `${metadataRoot}/classes/${filename}`
    : work.kind === "Agent" ? `agents/${work.id}/instructions.md`
    : work.kind === "Release plan" ? `releases/${work.id}.md`
    : work.surfaceId === "code" ? `tests/${filename}.md` : `docs/${work.id}.md`;
}

/** A bounded sample repository, separate from the org-wide resource inventory.
 * A branch inherits base files; only its own work adds changed files. This is
 * prototype content, never a claim that a connected Git repository was read. */
export function projectFiles(profileId: DemoProfileId, target: WorkspaceTarget, savedProjects: readonly SavedProject[] = []): ProjectFile[] {
  // The caller supplies only the signed-in workspace's owned saved records.
  const saved = savedProjects.find(project => project.id === target.projectId);
  if (saved) return target.worktreeId === null ? projectContextFiles(saved).map(file => ({ ...file, surfaceId: "alm", language: "JSON", source: "saved-project" })) : [];
  const project = projectsForProfile(profileId).find(project => project.id === target.projectId);
  if (!project || (project.worktrees.length ? !project.worktrees.some(tree => tree.id === target.worktreeId) : target.worktreeId !== null)) return [];
  const profile = demoProfileById(profileId), metadata = projectMetadata[project.id];
  if (!metadata) return [];
  const baseTree = project.worktrees.find(tree => tree.isPrimary)?.id ?? null;
  const files: ProjectFile[] = [
    { path: "README.md", surfaceId: "alm", language: "Markdown", content: `# ${project.name}\n\n${project.description}\n\n## Working agreement\n\nReview changes in a sandbox before promoting them to production.\n` },
    { path: "sfdx-project.json", surfaceId: "build", language: "JSON", content: JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }], namespace: "", sourceApiVersion: "66.0" }, null, 2) },
    { path: "manifest/package.xml", surfaceId: "build", language: "XML", content: `<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>${metadata.object}</members>\n    <name>CustomObject</name>\n  </types>\n  <version>66.0</version>\n</Package>` },
    { path: `${metadataRoot}/objects/${metadata.object}/${metadata.object}.object-meta.xml`, surfaceId: "build", language: "XML", content: `<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">\n  <description>${project.description}</description>\n  <enableActivities>true</enableActivities>\n</CustomObject>` },
    { path: `${metadataRoot}/flows/${metadata.flow}.flow-meta.xml`, surfaceId: "build", language: "XML", content: `<Flow xmlns="http://soap.sforce.com/2006/04/metadata">\n  <label>${metadata.flow.replaceAll("_", " ")}</label>\n  <processType>AutoLaunchedFlow</processType>\n  <status>Draft</status>\n</Flow>` },
    { path: `${metadataRoot}/permissionsets/${metadata.permission}.permissionset-meta.xml`, surfaceId: "build", language: "XML", content: `<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">\n  <label>${metadata.permission.replaceAll("_", " ")}</label>\n  <hasActivationRequired>false</hasActivationRequired>\n</PermissionSet>` },
  ];
  if (project.id === "acme-storefront" && profile.surfaceAccess.includes("code")) files.push(
    { path: "package.json", surfaceId: "code", language: "JSON", content: JSON.stringify({ name: "acme-storefront", private: true, scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" } }, null, 2) },
    { path: "src/App.tsx", surfaceId: "code", language: "TSX", content: 'export default function App() {\n  return <main><h1>Acme Storefront</h1><p>Browse your accounts and orders.</p></main>;\n}\n' },
    { path: "src/components/AccountSearch.tsx", surfaceId: "code", language: "TSX", modified: target.worktreeId === "search-refresh", content: 'export function AccountSearch() {\n  return <input type="search" aria-label="Search accounts" placeholder="Find an account…" />;\n}\n',
      baseContent: 'export function AccountSearch() {\n  return <input type="search" aria-label="Search accounts" />;\n}\n' },
  );
  for (const work of workForProfile(profileId).filter(work => work.projectId === project.id && (work.worktreeId === target.worktreeId || work.worktreeId === baseTree))) {
    const filename = work.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
    const isApex = work.kind === "Apex class";
    const path = workFilePath(work);
    const content = isApex ? `public with sharing class ${filename.replace(/\.cls$/, "")} {\n    // Sample implementation for ${project.name}.\n}\n`
      : work.source ?? `# ${work.title}\n\n${work.summary}\n\n${work.details.map(detail => `- ${detail.label}: ${detail.value}`).join("\n")}\n`;
    files.push({ path, surfaceId: work.surfaceId, language: isApex ? "Apex" : "Markdown", content, modified: work.worktreeId === target.worktreeId && target.worktreeId !== baseTree });
  }
  return files.filter(file => profile.surfaceAccess.includes(file.surfaceId)).sort((a, b) => a.path.localeCompare(b.path));
}

export function projectFileCanvas(file: ProjectFile, target: WorkspaceTarget): Extract<CanvasSpecInput, { kind: "project-file" }> {
  if (!target.projectId) throw new TypeError("A project file needs a project");
  return { kind: "project-file", title: file.path.split("/").at(-1)!, params: { projectId: target.projectId, worktreeId: target.worktreeId, path: file.path, ...(target.orgId ? { orgId: target.orgId } : {}) } };
}
export function fileForCanvas(profileId: DemoProfileId, params: { projectId: string; worktreeId: string | null; path: string; orgId?: string }, savedProjects: readonly SavedProject[] = []) {
  return projectFiles(profileId, { ...params, orgId: params.orgId ?? null }, savedProjects).find(file => file.path === params.path);
}

export type FileTree = { name: string; path: string; children: FileTree[]; file?: ProjectFile };
export function projectFileTree(files: readonly ProjectFile[]): FileTree[] {
  const roots: FileTree[] = [];
  for (const file of files) {
    let nodes = roots, path = "";
    const parts = file.path.split("/");
    parts.forEach((name, index) => {
      path = path ? `${path}/${name}` : name;
      let node = nodes.find(node => node.name === name);
      if (!node) { node = { name, path, children: [] }; nodes.push(node); }
      if (index === parts.length - 1) node.file = file;
      nodes = node.children;
    });
  }
  const sort = (nodes: FileTree[]): FileTree[] => nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name)).map(node => ({ ...node, children: sort(node.children) }));
  return sort(roots);
}
