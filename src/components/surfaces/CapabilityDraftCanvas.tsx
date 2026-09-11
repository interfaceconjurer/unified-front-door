"use client";

import { useId } from "react";
import { ChevronRightIcon, FolderIcon } from "@/components/icons";
import type { CanvasSpec } from "@/lib/surface-canvas/model";
import type { SurfaceId } from "@/lib/workspace/model";
import {
  capabilitiesForSurface, TOOLKIT_SECTIONS,
  type CapabilityField, type SurfaceCapability,
} from "./surface-capabilities";
import { useSurfaceCanvases } from "./surface-canvas-context";
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
                className={field.id === "source" ? styles.source : undefined}
                placeholder={field.placeholder}
                value={draft[field.id] ?? ""}
                onChange={(event) => onChange(field.id, event.target.value)}
                spellCheck={field.id === "source" ? false : undefined}
              />
            ) : (
              <input id={id} type="text" placeholder={field.placeholder} value={draft[field.id] ?? ""} onChange={(event) => onChange(field.id, event.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CapabilityDraftCanvas({ surfaceId, capability, spec }: {
  surfaceId: SurfaceId;
  capability: SurfaceCapability;
  spec: CanvasSpec;
}) {
  const { openCanvas, updateDraft } = useSurfaceCanvases(surfaceId);
  const toolkitSection = capability.id === "toolkit"
    ? TOOLKIT_SECTIONS.find((section) => section.id === spec.params?.section)
    : undefined;
  const isToolkitHome = capability.id === "toolkit" && !toolkitSection;
  const title = toolkitSection?.label ?? capability.label;
  const description = toolkitSection?.description ?? capability.description;
  const Icon = toolkitSection?.Icon ?? capability.Icon;
  const draft = spec.draft ?? {};
  const hasDraft = Object.values(draft).some((value) => value.trim());
  const needsProject = surfaceId === "code" && ["apex", "query", "tests"].includes(capability.id);

  function startProject() {
    const project = capabilitiesForSurface("code").find((item) => item.id === "sfdx-project")!;
    openCanvas("code", { kind: "capability", title: project.label, params: { surface: "code", capability: project.id } });
  }

  return (
    <article className={styles.canvas}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true"><Icon width={23} height={23} /></span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>

      {isToolkitHome ? (
        <section aria-labelledby="toolkit-sections-heading">
          <h2 id="toolkit-sections-heading" className={styles.sectionHeading}>Add to your toolkit</h2>
          <ul className={styles.toolkitGrid}>
            {TOOLKIT_SECTIONS.map((section) => {
              return (
                <li key={section.id}>
                  <button className={styles.toolkitCard} type="button" onClick={() => openCanvas(surfaceId, {
                    kind: "capability", title: section.label,
                    params: { surface: surfaceId, capability: "toolkit", section: section.id },
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
              <span role="status">{hasDraft ? "Draft saved locally" : "New draft"}</span>
            </div>
            <DraftFields
              fields={toolkitSection?.fields ?? capability.fields}
              draft={draft}
              onChange={(id, value) => updateDraft(surfaceId, spec.id, { [id]: value })}
            />
          </section>
          <p className={styles.note}>This is a configuration draft. Changes stay in this browser; no files, commands, or connections are created.</p>
        </>
      )}
    </article>
  );
}
