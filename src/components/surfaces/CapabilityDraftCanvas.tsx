"use client";

import { CANVAS_FIELD_CHARACTER_LIMIT } from "@/lib/surface-canvas/model";

import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useId, useState, useSyncExternalStore } from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { primaryWorktree } from "@/lib/workspace/model";
import { ChevronRightIcon, FolderIcon } from "@/components/icons";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  capabilitiesForSurface, TOOLKIT_SECTIONS,
  type CapabilityField, type SurfaceCapability,
} from "./surface-capabilities";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./CapabilityDraftCanvas.module.css";

function DraftFields({ fields, draft, onChange }: {
  fields: readonly CapabilityField[];
  draft: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  const formId = useId();
  return (
    <div className={styles.fields}>
      {fields.map((field) => {
        const id = `${formId}-${field.id}`;
        return (
          <div key={field.id} className={styles.field}>
            <label htmlFor={id}>{field.label}</label>
            {field.type === "select" ? (
              <select id={id} value={draft[field.id] ?? field.options?.[0] ?? ""} onChange={(event) => onChange(field.id, event.target.value)}>
                {field.options?.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                id={id}
                rows={field.id === "source" ? 10 : 5}
                maxLength={CANVAS_FIELD_CHARACTER_LIMIT}
                aria-describedby={`${id}-limit`}
                className={field.id === "source" ? styles.source : undefined}
                placeholder={field.placeholder}
                value={draft[field.id] ?? ""}
                onChange={(event) => onChange(field.id, event.target.value)}
                spellCheck={field.id === "source" ? false : undefined}
              />
            ) : (
              <input id={id} type="text" maxLength={CANVAS_FIELD_CHARACTER_LIMIT} aria-describedby={`${id}-limit`} placeholder={field.placeholder} value={draft[field.id] ?? ""} onChange={(event) => onChange(field.id, event.target.value)} />
            )}
            {field.type !== "select" && <small id={`${id}-limit`}>Maximum 16,000 characters{(draft[field.id]?.length ?? 0) > CANVAS_FIELD_CHARACTER_LIMIT ? " · Your longer saved value is preserved; shorten it before adding more." : "."}</small>}
          </div>
        );
      })}
    </div>
  );
}

export function CapabilityDraftCanvas({ surfaceId, capability, spec }: {
  surfaceId: SurfaceId;
  capability: SurfaceCapability;
  spec: CanvasOf<"capability">;
}) {
  const { copyToSelectedScope } = useNavigation();
  const { projects, orgs } = useWorkspace();
  const [assignmentProject, setAssignmentProject] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const { openCanvas, updateDraft, persistence } = useSurfaceCanvasActions();
  const persistenceState = useSyncExternalStore(persistence.subscribe, persistence.getPersistenceSnapshot, persistence.getServerPersistenceSnapshot);
  const toolkitSection = capability.id === "toolkit"
    ? TOOLKIT_SECTIONS.find((section) => section.id === spec.params?.section)
    : undefined;
  const isToolkitHome = capability.id === "toolkit" && !toolkitSection;
  const title = toolkitSection?.label ?? capability.label;
  const description = toolkitSection?.description ?? capability.description;
  const Icon = toolkitSection?.Icon ?? capability.Icon;
  const captured = spec.params.scope === "project" ? spec.params : null;
  const draft = spec.draft ?? {};
  const hasDraft = Object.values(draft).some((value) => value.trim());
  const needsProject = surfaceId === "code" && ["apex", "query", "tests"].includes(capability.id);

  function startProject() {
    const project = capabilitiesForSurface("code").find((item) => item.id === "sfdx-project")!;
    openCanvas("code", { kind: "capability", title: project.label, params: { scope: "unbound", surface: "code", capability: project.id } });
  }

  return (
    <article>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true"><Icon width={23} height={23} /></span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>

      <aside aria-label="Draft scope" className={styles.connectionNote}>
        {spec.params.scope === "unbound" ? <div><strong>Unbound draft</strong><p>This draft has no project or org target.</p>
          {!!projects.length && <><label>Assign a copy to project <select value={assignmentProject} onChange={(event) => setAssignmentProject(event.target.value)}><option value="">Choose a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button type="button" disabled={!assignmentProject || persistenceState !== "saved"} onClick={async () => {
            const project = projects.find((item) => item.id === assignmentProject);
            if (!project) return;
            const worktree = primaryWorktree(project);
            const input = { kind: "capability" as const, title: spec.title, params: { ...spec.params, scope: "project" as const, projectId: project.id, ...(worktree ? { worktreeId: worktree.id } : {}), orgId: project.defaultOrgId } };
            setAssignmentMessage(await copyToSelectedScope(surfaceId, spec.id, input) ? "A project copy was created. The unbound draft is preserved." : "The copy was not saved. Review the workspace message and retry. Your original draft is preserved.");
          }}>Copy draft to project</button></>}
          {persistenceState !== "saved" && <p>Save or recover this draft before copying it to a project.</p>}
          {assignmentMessage && <p role="status">{assignmentMessage}</p>}
        </div> : <div><strong>Captured draft scope</strong><p>Project: {projects.find((item) => item.id === captured?.projectId)?.name ?? captured?.projectId} · Worktree: {captured?.worktreeId ?? "None"} · Org: {orgs.find((item) => item.id === captured?.orgId)?.label ?? captured?.orgId ?? "None"}</p><p>Changing workspace selection does not retarget this draft.</p></div>}
      </aside>
      {isToolkitHome ? (
        <section aria-labelledby="toolkit-sections-heading">
          <h2 id="toolkit-sections-heading" className={styles.sectionHeading}>Add to your toolkit</h2>
          <ul className={styles.toolkitGrid}>
            {TOOLKIT_SECTIONS.map((section) => {
              return (
                <li key={section.id}>
                  <button className={styles.toolkitCard} type="button" onClick={() => openCanvas(surfaceId, {
                    kind: "capability", title: section.label,
                    params: { ...spec.params, surface: surfaceId, capability: "toolkit", section: section.id },
                  })}>
                    <section.Icon width={20} height={20} aria-hidden="true" />
                    <strong>{section.label}</strong>
                    <span>{section.description}</span>
                    <span className={styles.toolkitAction}>
                      Open canvas
                      <ChevronRightIcon width={15} height={15} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <>
          {needsProject && (
            <aside className={styles.connectionNote} aria-label="Workspace connection">
              <FolderIcon width={18} height={18} aria-hidden="true" />
              <div>
                <strong>{capability.id === "query" ? "Connect a Salesforce org to run queries" : "Connect a project to create files and run tests"}</strong>
                <p>You can prepare your draft below while you plan your workspace.</p>
              </div>
              <button type="button" onClick={startProject}>Plan a project <ChevronRightIcon width={14} height={14} aria-hidden="true" /></button>
            </aside>
          )}
          <section className={styles.draft} aria-label={`${title} draft`}>
            <div className={styles.draftHeading}>
              <h2>{toolkitSection ? `${toolkitSection.label} draft` : "Your starting point"}</h2>
              <PersistenceStatus store={persistence} hasContent={hasDraft} />
            </div>
            <DraftFields
              fields={toolkitSection?.fields ?? capability.fields}
              draft={draft}
              onChange={(id, value) => updateDraft(surfaceId, spec.id, { [id]: value })}
            />
          </section>
          <p className={styles.note}>This is a configuration draft. No files, commands, or connections are created.</p>
        </>
      )}
    </article>
  );
}
