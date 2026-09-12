"use client";

/**
 * Workspace provisioning gate — the beat between clicking a project and its
 * workspace appearing.
 *
 * Opening a project stands up somewhere to *do* the work: imagine a separate
 * service that schedules a Kubernetes pod, mounts the workspace filesystem,
 * boots a runtime, syncs the project's metadata, and opens an agent session.
 * We simulate that as a checklist — each step spins, then checks off — and only
 * reveal the real ProjectWorkspace once every step is done. It's a prototype, so
 * the "service" is just staged timers; the point is the interaction.
 *
 * Provisioning runs once per open tab. `alreadyProvisioned` (read from a set the
 * canvas context keeps) lets a tab that's been provisioned and then revisited —
 * switching tabs remounts the body — skip straight to the workspace. Closing the
 * tab clears that flag, so reopening the project spins it up afresh.
 */
import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, ServerIcon } from "@/components/icons";
import type { Project } from "./projects-data";
import { CanvasLayout } from "./CanvasLayout";
import styles from "./project-provisioner.module.css";

type ProvisionStep = { label: string; detail: string; duration: number };

// Broad steps that read as "what it takes to stand up a workspace." The detail
// line enumerates the sub-work each step folds in. Durations vary so the
// cascade feels like real provisioning rather than a uniform metronome.
const STEPS: ProvisionStep[] = [
  {
    label: "Allocating compute",
    detail: "Scheduling Kubernetes pod · 4 vCPU · 8 GiB",
    duration: 750,
  },
  {
    label: "Mounting workspace filesystem",
    detail: "Attaching persistent volume · restoring cache",
    duration: 1050,
  },
  {
    label: "Starting execution substrate",
    detail: "Container runtime · language toolchain",
    duration: 900,
  },
  {
    label: "Syncing project",
    detail: "Connecting org · pulling metadata · indexing source",
    duration: 1150,
  },
  {
    label: "Launching agent session",
    detail: "Opening secure channel · loading context",
    duration: 800,
  },
];

// A short beat on the all-green state before the workspace takes over, so the
// completion registers instead of flashing past.
const READY_BEAT = 550;

export function ProjectProvisioner({
  project,
  alreadyProvisioned,
  onProvisioned,
  onAgentSessionChange,
  children,
}: {
  project: Project;
  alreadyProvisioned: boolean;
  onProvisioned: () => void;
  /** Reports the agent session's liveness so the chat panel can reveal its
   *  session in lockstep: `false` when a fresh spin-up begins, `true` the
   *  instant the "Launching agent session" step checks off. */
  onAgentSessionChange: (live: boolean) => void;
  children: ReactNode;
}) {
  // Number of completed steps. The step at index `completed` is the active one;
  // when `completed === STEPS.length` every step has checked off.
  const [completed, setCompleted] = useState(0);
  const [ready, setReady] = useState(alreadyProvisioned);

  useEffect(() => {
    if (alreadyProvisioned) {
      // Revisiting an already-built workspace: the session is already live, so
      // tell the chat immediately — its reload beat resolves to a quick blink.
      onAgentSessionChange(true);
      return;
    }
    // Fresh spin-up: the session is not live yet. The chat holds its beat until
    // the launch step below reports it live.
    onAgentSessionChange(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STEPS.forEach((step, i) => {
      elapsed += step.duration;
      const isLaunchStep = i === STEPS.length - 1;
      timers.push(
        setTimeout(() => {
          setCompleted(i + 1);
          // The final step *is* the agent session coming up — the moment it
          // checks off, the chat reveals its session in the same beat.
          if (isLaunchStep) onAgentSessionChange(true);
        }, elapsed),
      );
    });
    // Reveal the workspace a beat after the last step checks off. Marking the
    // tab provisioned here (not earlier) means leaving mid-flight re-provisions
    // on return — you never left with a half-built workspace behind you.
    timers.push(
      setTimeout(() => {
        onProvisioned();
        setReady(true);
      }, elapsed + READY_BEAT),
    );
    return () => timers.forEach(clearTimeout);
    // Run exactly once per mount: this schedules the staged provisioning timers,
    // so re-running would clear them and restart the whole cascade from step one
    // (and re-announce the session as not-live). The values it closes over are
    // intentionally excluded from the deps — `alreadyProvisioned` is fixed for a
    // mount, and `onProvisioned` / `onAgentSessionChange` are stable for a given
    // tab. Don't add them; a changed callback identity must not re-provision a
    // workspace that's already up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready) return <div className={styles.reveal}>{children}</div>;

  const allDone = completed >= STEPS.length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const activeStep = STEPS[completed];

  return (
    <CanvasLayout>
      <div className={styles.screen} aria-label="Provisioning workspace" aria-busy={!allDone}>
        <div className={styles.card}>
          <div className={styles.head}>
            <span className={styles.headIcon} data-done={allDone || undefined} aria-hidden="true">
              {allDone ? <CheckIcon width={24} height={24} /> : <ServerIcon width={24} height={24} />}
            </span>
            <div className={styles.headText}>
              <h2 className={styles.title}>
                {allDone ? "Workspace ready" : "Provisioning workspace"}
              </h2>
              <p className={styles.subtitle}>
                {project.name} · {project.subtitle}
              </p>
            </div>
          </div>

          <div className={styles.meter} data-done={allDone || undefined} aria-hidden="true">
            <span className={styles.meterFill} style={{ width: `${pct}%` }} />
          </div>

          <ul className={styles.steps}>
            {STEPS.map((step, i) => {
              const state = i < completed ? "done" : i === completed ? "active" : "pending";
              return (
                <li key={step.label} className={styles.step} data-state={state}>
                  <span className={styles.indicator} aria-hidden="true">
                    {state === "done" ? (
                      <CheckIcon className={styles.check} width={15} height={15} />
                    ) : state === "active" ? (
                      <span className={styles.spinner} />
                    ) : (
                      <span className={styles.dot} />
                    )}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.stepLabel}>{step.label}</span>
                    <span className={styles.stepDetail}>{step.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className={styles.footnote}>
            {allDone
              ? "Opening your project…"
              : "Spinning up an isolated, ephemeral workspace for this project."}
          </p>
        </div>

        {/* Single, quiet live region — announces the current step rather than
            re-reading the whole list on every tick. */}
        <p className={styles.srOnly} role="status" aria-live="polite">
          {allDone
            ? `Workspace ready for ${project.name}.`
            : `Provisioning ${project.name}: ${activeStep?.label}.`}
        </p>
      </div>
    </CanvasLayout>
  );
}
