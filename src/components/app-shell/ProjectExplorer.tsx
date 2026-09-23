"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, CodeIcon, FolderIcon, GitBranchIcon, SearchIcon } from "@/components/icons";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { useAssessment } from "@/components/onboarding/use-assessment";
import { projectFiles, projectFileCanvas, projectFileTree, type FileTree, type ProjectFile } from "@/lib/workspace/project-files";
import styles from "./ProjectExplorer.module.css";

function FileNodes({ nodes, selected, searching, openFile }: { nodes: FileTree[]; selected?: string; searching: boolean; openFile: (file: ProjectFile) => void }) {
  return <ul className={styles.files}>{nodes.map(original => {
    // Compact directory chains so force-app/main/default doesn't consume the
    // entire sidebar width before we reach an actual file.
    let node = original, label = node.name;
    while (!node.file && node.children.length === 1 && !node.children[0]!.file) {
      node = node.children[0]!; label += `/${node.name}`;
    }
    return <li key={node.path}>{node.file
      ? <button type="button" className={styles.file} aria-current={selected === node.file.path ? "page" : undefined} title={node.file.path}
        aria-label={`Open file ${node.file.path}`} onClick={() => openFile(node.file!)}>
        <CodeIcon width={14} height={14} aria-hidden="true" /><span>{node.name}</span>
        {node.file.modified && <small aria-label="Modified">M</small>}
      </button>
      : <details open={searching || node.path === ".project" || node.path === "force-app/main/default" || undefined} className={styles.folder}>
        <summary title={label}><FolderIcon width={14} height={14} aria-hidden="true" /><span>{label}</span></summary>
        <FileNodes nodes={node.children} selected={selected} searching={searching} openFile={openFile} />
      </details>}
    </li>;
  })}</ul>;
}

export function ProjectExplorer({ onBack }: { onBack: () => void }) {
  const { activeProject, activeWorktree, target, destination } = useWorkspace();
  const { profile } = useDemoProfile();
  const { openCanvas } = useNavigationActions();
  const { state: assessment } = useAssessment();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  if (!activeProject || !profile) return null;
  const allFiles = projectFiles(profile.id, target, assessment.projects);
  const files = allFiles.filter(file => query.toLowerCase().trim().split(/\s+/).every(term => file.path.toLowerCase().includes(term)));
  const selected = destination.kind === "available" && destination.destination.canvas?.kind === "project-file" ? destination.destination.canvas.params.path : undefined;
  return <div className={styles.explorer}>
    <button className={styles.back} type="button" onClick={onBack} autoFocus><ChevronLeftIcon width={16} height={16} aria-hidden="true" />All projects</button>
    <header className={styles.header}>
      <h2>{activeProject.name}</h2>
      {activeWorktree && <p><GitBranchIcon width={13} height={13} aria-hidden="true" />{activeWorktree.branch}</p>}
    </header>
    {allFiles.length ? <>
      <div className={styles.search}><SearchIcon width={14} height={14} aria-hidden="true" />
        <input ref={input} aria-label="Find project files" placeholder="Find files…" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Clear file search" onClick={() => { setQuery(""); input.current?.focus(); }}>×</button>}
      </div>
      <p className={styles.caption}>{files.length} {files.length === 1 ? "file" : "files"} · {allFiles.some(file => file.source === "saved-project") ? "Project context" : "Sample repository"}</p>
      <nav className={styles.scroll} aria-label="Project files">
        {files.length ? <FileNodes key={query ? "search" : "browse"} nodes={projectFileTree(files)} searching={!!query.trim()} selected={selected}
          openFile={file => openCanvas(file.surfaceId, projectFileCanvas(file, target))} />
          : <p className={styles.empty}>No files match “{query}”.</p>}
      </nav>
    </> : <p className={styles.empty}>No files yet. Files and metadata will appear here when this project has a repository or generated content.</p>}
  </div>;
}
