"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, ChevronRightIcon, CloseIcon, FileIcon, GitBranchIcon, LayersIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { applicationClient } from "@/lib/application/client";
import { EMPTY_APPLICATION } from "@/lib/application/remote-store";
import { primaryWorktree } from "@/lib/workspace/model";
import { planChangeTransfer } from "@/lib/workspace/change-transfer";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { workspaceChanges } from "@/lib/workspace/changes";
import styles from "./WorkspaceChanges.module.css";

const emptySubscribe = () => () => {};
const emptySnapshot = () => EMPTY_APPLICATION;
const loading = () => "loading" as const;
const statusLabels = { A: "Added", M: "Modified", D: "Deleted" };

export function WorkspaceChanges() {
  const { profile } = useDemoProfile();
  const { activeProject, activeWorktree, projects, target } = useWorkspace();
  const { openCanvas, openCanvasInProject, openProjectCreationForChanges, captureIntent } = useNavigationActions();
  useSyncExternalStore(applicationClient.subscribe, applicationClient.getSnapshot, applicationClient.getServerSnapshot);
  const remote = applicationClient.workspace;
  const snapshot = useSyncExternalStore(remote?.subscribe ?? emptySubscribe, remote?.getSnapshot ?? emptySnapshot, emptySnapshot);
  const persistence = useSyncExternalStore(remote?.subscribe ?? emptySubscribe, remote?.getPersistenceSnapshot ?? loading, loading);
  const changes = useMemo(() => profile ? workspaceChanges(profile.id, target, snapshot.assessment.projects, snapshot.canvases) : [], [profile, target, snapshot.assessment.projects, snapshot.canvases]);
  const visible = target.projectId !== null || changes.length > 0;
  const totals = changes.reduce((sum, file) => ({ additions: sum.additions + file.additions, deletions: sum.deletions + file.deletions }), { additions: 0, deletions: 0 });
  const [open, setOpen] = useState(false), [assigning, setAssigning] = useState(false), [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false), [problem, setProblem] = useState("");
  const [existing, setExisting] = useState(false);
  const sources = changes.flatMap(change => change.draft ? [{ sourceId: change.draft.id, sourceRevision: change.draft.revision }] : []);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), popover = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false), active = useRef(true), id = useId();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!open || !visible) return;
    popover.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open, visible]);

  async function trackChanges() {
    const project = projects.find(project => project.id === projectId);
    if (!project || !profile || !remote || inFlight.current || persistence !== "saved") return;
    if (!sources.length) return;
    const current = captureIntent();
    inFlight.current = true; setSaving(true); setProblem("");
    try {
      const plan = planChangeTransfer(sources, remote.getSnapshot().canvases, projectId, primaryWorktree(project)?.id ?? null);
      const result = await remote.enqueue({ kind: "changes.transfer", projectId, sources });
      if (result && active.current && current()) openCanvasInProject(plan[0]!.destination.surface, plan[0]!.destination.canvas);
    } catch (error) {
      if (active.current) setProblem(error instanceof Error ? error.message : "The changes could not be transferred.");
    } finally { inFlight.current = false; if (active.current) setSaving(false); }
  }

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const countLabel = `${changes.length} changed ${changes.length === 1 ? "file" : "files"}`;
  if (!visible) return null;
  return <div className={styles.root} ref={root} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className={styles.trigger} data-changed={!!changes.length}
      aria-label={`Changes, ${countLabel}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      title={`${countLabel} · +${totals.additions} −${totals.deletions}`} onClick={() => setOpen(value => !value)}>
      <GitBranchIcon width={15} height={15} aria-hidden="true" />
      <span className={styles.triggerLabel}>Changes</span><span className={styles.count}>{changes.length}</span>
      {!!changes.length && <span className={styles.triggerStats} aria-hidden="true"><span className={styles.additions}>+{totals.additions}</span><span className={styles.deletions}>−{totals.deletions}</span></span>}
    </button>
    {open && <div ref={popover} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} className={styles.popover}>
      <header className={styles.header}>
        <div><h2 id={`${id}-title`}>Changes</h2><p>{activeProject?.name ?? "Global workspace"}{activeWorktree ? ` · ${activeWorktree.branch}` : ""}</p></div>
        <button type="button" className={styles.close} aria-label="Close changes" onClick={close}><CloseIcon width={15} height={15} aria-hidden="true" /></button>
      </header>
      {changes.length ? <>
        <div className={styles.summary}><span>{countLabel}</span><span className={styles.stats} aria-label={`${totals.additions} additions, ${totals.deletions} deletions`}><span className={styles.additions}>+{totals.additions}</span><span className={styles.deletions}>−{totals.deletions}</span></span></div>
        <ul className={styles.files}>{changes.map(file => <li key={file.id}>
          <button type="button" className={styles.file} aria-label={`Open changed file ${file.path}`} title={file.path} onClick={() => { close(); openCanvas(file.surface, file.canvas); }}>
            <FileIcon width={16} height={16} aria-hidden="true" />
            <span className={styles.fileName}><strong>{file.path.split("/").at(-1)}</strong><small>{file.path.slice(0, file.path.lastIndexOf("/")) || "."}</small></span>
            <span className={styles.stats} aria-label={`${file.additions} additions, ${file.deletions} deletions`}><span className={styles.additions}>+{file.additions}</span><span className={styles.deletions}>−{file.deletions}</span></span>
            <span className={styles.status} data-status={file.status} aria-label={statusLabels[file.status]} title={statusLabels[file.status]}>{file.status}</span>
          </button>
        </li>)}</ul>
        <p className={styles.note}>{changes.some(file => file.source === "sample") ? "Sample branch changes" : changes.some(file => file.source === "project") ? "New project files" : "Draft files"} · {persistence === "saved" ? "Saved in your workspace" : "Saving status shown in workspace"}</p>
      </> : <div className={styles.empty}><CheckIcon width={20} height={20} aria-hidden="true" /><strong>No changes</strong><p>{activeProject ? "Changed files will appear here as you work." : "Changes you make outside a project will appear here."}</p></div>}
      {!activeProject && !!changes.length && <footer className={styles.footer}>
        {assigning ? <div className={styles.assignment}>
            <strong>Track in a project</strong>
            <p>Move these changes into a project. They will leave global Home after the transfer.</p>
            <button type="button" className={styles.primary} disabled={saving || persistence !== "saved"} onClick={() => { close(); openProjectCreationForChanges(sources); }}>Create a new project</button>
            {!!projects.length && <button type="button" className={styles.textButton} disabled={saving} aria-expanded={existing} onClick={() => setExisting(value => !value)}>Use an existing project</button>}
            {existing && <><label htmlFor={`${id}-project`}>Choose a project</label>
              <select id={`${id}-project`} autoFocus value={projectId} disabled={saving} onChange={event => { setProjectId(event.target.value); setProblem(""); }}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              {!!projectId && <button type="button" className={styles.primary} disabled={saving || persistence !== "saved"} onClick={() => { void trackChanges(); }}>{saving ? "Transferring…" : "Transfer changes"}</button>}</>}
            {persistence !== "saved" && remote && <PersistenceStatus store={remote} label="Changes" />}
            <button type="button" className={styles.textButton} disabled={saving} onClick={() => { setAssigning(false); setProblem(""); }}>Cancel</button>
          </div> : <button type="button" className={styles.track} onClick={() => setAssigning(true)}><LayersIcon width={15} height={15} aria-hidden="true" />Track in a project<ChevronRightIcon width={13} height={13} aria-hidden="true" /></button>}
        {problem && <p className={styles.problem} role="alert">{problem}</p>}
      </footer>}
    </div>}
  </div>;
}
