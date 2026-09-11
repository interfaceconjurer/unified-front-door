"use client";

import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useSurfaceCanvases } from "@/components/surfaces/surface-canvas-context";
import { workCanvasInput, type ReturningWork } from "@/lib/workspace/returning-work";
import { useWorkspace } from "./workspace-context";
import styles from "./RecentWorkList.module.css";

export function useOpenWork() {
  const router = useRouter();
  const { setActiveProject, setActiveWorktree } = useWorkspace();
  const { openCanvas } = useSurfaceCanvases("code");
  return (work: ReturningWork) => {
    setActiveProject(work.projectId);
    setActiveWorktree(work.worktreeId, work.projectId);
    openCanvas(work.surfaceId, workCanvasInput(work));
    router.push(surfaceAppById(work.surfaceId).href);
  };
}

export function WorkStatusBadge({ work }: { work: ReturningWork }) {
  return <span className={styles.status} data-status={work.status}>
    <span className={styles.dot} aria-hidden="true" />{work.statusLabel}
  </span>;
}

export function RecentWorkList({ items }: {
  items: readonly ReturningWork[];
}) {
  const { projects } = useWorkspace();
  const openWork = useOpenWork();
  return (
    <ul className={styles.list}>
      {items.map((work) => {
        const surface = surfaceAppById(work.surfaceId);
        const project = projects.find((candidate) => candidate.id === work.projectId);
        return <li key={work.id}>
          <button className={styles.row} type="button" onClick={() => openWork(work)} aria-label={`Resume ${work.title}`}>
            <span className={styles.icon} data-surface={work.surfaceId} aria-hidden="true"><surface.Icon width={18} height={18} /></span>
            <span className={styles.copy}>
              <strong>{work.title}</strong>
              <span>{work.kind} · {project?.worktrees.find((tree) => tree.id === work.worktreeId)?.branch ?? work.worktreeId}</span>
            </span>
            <span className={styles.meta}><WorkStatusBadge work={work} /><span className={styles.updated}>{work.updated}</span></span>
            <ChevronRightIcon className={styles.arrow} width={15} height={15} aria-hidden="true" />
          </button>
        </li>;
      })}
    </ul>
  );
}
