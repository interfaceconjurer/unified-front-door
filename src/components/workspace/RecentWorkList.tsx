"use client";

import { SampleTimestamp } from "@/components/workspace/SampleTimestamp";

import { useCallback } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { surfaceAppById } from "@/components/front-door/app-catalog";
import { todayRow } from "@/components/front-door/today-reveal";
import { useNavigationActions } from "@/components/navigation/NavigationProvider";
import { workCanvasInput, type ReturningWork } from "@/lib/workspace/returning-work";
import { useWorkspace } from "./workspace-context";
import styles from "./RecentWorkList.module.css";

export function useOpenWork() {
  const { openCanvas } = useNavigationActions();
  return useCallback((work: ReturningWork) => {
    openCanvas(work.surfaceId, workCanvasInput(work));
  }, [openCanvas]);
}

export function WorkStatusBadge({ work }: { work: ReturningWork }) {
  return <span className={styles.status} data-status={work.status}>
    <span className={styles.dot} aria-hidden="true" />{work.statusLabel}
  </span>;
}

export function RecentWorkList({ items, onOpenWork, branch, showProject = false, revealFrom }: {
  items: readonly ReturningWork[]; onOpenWork?: (work: ReturningWork) => void; branch?: string; showProject?: boolean; revealFrom?: number;
}) {
  return onOpenWork ? <WorkRows items={items} openWork={onOpenWork} revealFrom={revealFrom} branchFor={work => [showProject ? work.projectName ?? work.projectId : null, branch ?? work.branch ?? work.worktreeId].filter(Boolean).join(" · ")} />
    : <LiveWorkRows items={items} />;
}
function LiveWorkRows({ items }: { items: readonly ReturningWork[] }) {
  const { projects } = useWorkspace();
  const openWork = useOpenWork();
  return <WorkRows items={items} openWork={openWork} branchFor={work => projects.find(project => project.id === work.projectId)?.worktrees.find(tree => tree.id === work.worktreeId)?.branch ?? work.worktreeId ?? ""} />;
}
function WorkRows({ items, openWork, branchFor, revealFrom }: { items: readonly ReturningWork[]; openWork: (work: ReturningWork) => void; branchFor: (work: ReturningWork) => string; revealFrom?: number }) {
  return (
    <ul className={styles.list} data-today-container>
      {items.map((work, index) => {
        const surface = surfaceAppById(work.surfaceId);
        return <li key={work.id} {...(revealFrom === undefined ? {} : todayRow(revealFrom + index))}>
          <button className={styles.row} type="button" onClick={() => openWork(work)} aria-label={`Resume ${work.title}`}>
            <span className={styles.icon} data-surface={work.surfaceId} aria-hidden="true"><surface.Icon width={18} height={18} /></span>
            <span className={styles.copy}>
              <strong>{work.title}</strong>
              <span>{[work.kind, branchFor(work)].filter(Boolean).join(" · ")}</span>
            </span>
            <span className={styles.meta}><WorkStatusBadge work={work} /><span className={styles.updated}><SampleTimestamp value={work.updated} /></span></span>
            <ChevronRightIcon className={styles.arrow} width={15} height={15} aria-hidden="true" />
          </button>
        </li>;
      })}
    </ul>
  );
}
