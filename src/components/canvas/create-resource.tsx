"use client";

/**
 * The "Create a Resource" wizard — what a fresh canvas opens into (the ＋ by the
 * tabs), and what the project Overview's "Add resource" action launches.
 *
 * It walks three beats:
 *   1. **Launch** — the canvas presents the single "Create a Resource" action.
 *   2. **Kind** — pick what to build (Flow, Page, Dashboard, Agent, …), grouped
 *      by category (see resource-kinds).
 *   3. **Project** — pick which project to scope it to.
 * Then it hands back the chosen kind + project via `onBuild`; the canvas swaps
 * itself into that kind's builder (see canvas-context / resource-builder).
 *
 * Launched from a project, the project is already known: `presetProject` skips
 * both the launch beat and the project beat, so it opens straight on the kind
 * picker and builds as soon as you choose one.
 *
 * Self-contained: it takes a preset project (optional) and the `onBuild`
 * callback, so it never reaches into the canvas context — that keeps it a leaf
 * of the import graph, the same shape ProjectWorkspace uses.
 */
import { useState, type ReactNode } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  PlusIcon,
  SparklesIcon,
} from "@/components/icons";
import { ActionButton, CanvasHeader, CanvasView, CardGrid, type CardItem } from "./canvas-kit";
import { projectList, type Project } from "./projects-data";
import { resourceKindsByCategory, type ResourceKind } from "./resource-kinds";
import styles from "./create-resource.module.css";

type Step = "launch" | "kind" | "project";

export function ResourceWizard({
  presetProject,
  onBuild,
}: {
  /** When set (launched from a project), the project beat is skipped and a chosen
   *  kind builds straight into this project. */
  presetProject?: Project;
  /** Hand-off: the wizard is done, build this kind scoped to this project. */
  onBuild: (kind: ResourceKind, project: Project) => void;
}) {
  // From a project we already know the target, so open on the kind picker;
  // otherwise open on the launch action.
  const [step, setStep] = useState<Step>(presetProject ? "kind" : "launch");
  const [kind, setKind] = useState<ResourceKind | null>(null);

  const chooseKind = (next: ResourceKind) => {
    // With a preset project there's nothing left to ask — build immediately.
    if (presetProject) {
      onBuild(next, presetProject);
      return;
    }
    setKind(next);
    setStep("project");
  };

  const chooseProject = (project: Project) => {
    if (kind) onBuild(kind, project);
  };

  if (step === "launch") {
    return <LaunchStep onStart={() => setStep("kind")} />;
  }

  if (step === "kind") {
    return (
      <KindStep
        presetProject={presetProject}
        onBack={presetProject ? undefined : () => setStep("launch")}
        onPick={chooseKind}
      />
    );
  }

  // step === "project" (only reachable without a preset, so kind is set)
  return <ProjectStep kind={kind} onBack={() => setStep("kind")} onPick={chooseProject} />;
}

/* ── Launch ───────────────────────────────────────────────────────────────
 * A fresh "Create a Resource" canvas's single action. A centered hero so a new
 * tab reads as an invitation rather than an empty placeholder. */
function LaunchStep({ onStart }: { onStart: () => void }) {
  return (
    <CanvasView>
      <div className={styles.launch}>
        <span className={styles.launchIcon} aria-hidden="true">
          <SparklesIcon width={30} height={30} />
        </span>
        <h1 className={styles.launchTitle}>Create a Resource</h1>
        <p className={styles.launchBlurb}>
          Add a flow, page, dashboard, agent, and more — then scope it to one of your projects.
        </p>
        <button type="button" className={styles.launchAction} onClick={onStart}>
          <PlusIcon width={18} height={18} />
          <span>Create a Resource</span>
        </button>
      </div>
    </CanvasView>
  );
}

/* ── Kind picker ──────────────────────────────────────────────────────────
 * The "list of options" — every creatable kind, grouped by category. */
function KindStep({
  presetProject,
  onBack,
  onPick,
}: {
  presetProject?: Project;
  onBack?: () => void;
  onPick: (kind: ResourceKind) => void;
}) {
  const groups = resourceKindsByCategory();
  return (
    <CanvasView>
      <CanvasHeader
        Icon={LayersIcon}
        title="Create a Resource"
        subtitle={
          presetProject
            ? `Choose what to add to ${presetProject.name}.`
            : "Choose what you want to create."
        }
        action={onBack && <BackButton onClick={onBack}>Back</BackButton>}
      />
      {presetProject ? (
        <ScopeNote project={presetProject} />
      ) : (
        <Stepper current="kind" />
      )}
      {groups.map((group) => (
        <section key={group.category} className={styles.group}>
          <h2 className={styles.groupHead}>{group.label}</h2>
          <CardGrid
            cards={group.kinds.map<CardItem>((k) => ({
              id: k.id,
              Icon: k.Icon,
              title: k.label,
              subtitle: k.blurb,
              onSelect: () => onPick(k),
            }))}
          />
        </section>
      ))}
    </CanvasView>
  );
}

/* ── Project picker ───────────────────────────────────────────────────────
 * Only reached from the ＋ flow (a project launch skips it). Reuses the same
 * project cards the Projects canvas shows, so the choice reads as familiar. */
function ProjectStep({
  kind,
  onBack,
  onPick,
}: {
  kind: ResourceKind | null;
  onBack: () => void;
  onPick: (project: Project) => void;
}) {
  return (
    <CanvasView>
      <CanvasHeader
        Icon={kind?.Icon}
        title={kind ? `New ${kind.label}` : "New Resource"}
        subtitle="Choose the project to scope it to."
        action={<BackButton onClick={onBack}>Back</BackButton>}
      />
      <Stepper current="project" />
      <CardGrid
        cards={projectList.map<CardItem>((p) => ({
          id: p.id,
          Icon: p.Icon,
          title: p.name,
          subtitle: p.subtitle,
          meta: p.meta,
          status: p.status,
          onSelect: () => onPick(p),
        }))}
      />
    </CanvasView>
  );
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

/** The two-beat progress indicator for the ＋ flow (Kind → Project). */
function Stepper({ current }: { current: "kind" | "project" }) {
  const steps: { id: "kind" | "project"; label: string }[] = [
    { id: "kind", label: "Choose type" },
    { id: "project", label: "Choose project" },
  ];
  return (
    <ol className={styles.stepper}>
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={styles.stepperItem}
          data-state={s.id === current ? "current" : i === 0 ? "done" : "todo"}
        >
          <span className={styles.stepperNum} aria-hidden="true">
            {i + 1}
          </span>
          <span className={styles.stepperLabel}>{s.label}</span>
          {i < steps.length - 1 && (
            <ChevronRightIcon className={styles.stepperSep} width={14} height={14} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** A quiet "adding to X" line for the project-launched flow, standing in for the
 *  project-picker step that gets skipped. */
function ScopeNote({ project }: { project: Project }) {
  return (
    <p className={styles.scopeNote}>
      <span className={styles.scopeNoteIcon} aria-hidden="true">
        <project.Icon width={15} height={15} />
      </span>
      Adding to <strong>{project.name}</strong>
    </p>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <ActionButton Icon={ChevronLeftIcon} onClick={onClick}>
      {children}
    </ActionButton>
  );
}
