"use client";

import { useId } from "react";
import { PROJECT_CONTEXT_LIMIT, PROJECT_TEMPLATES, projectTemplate } from "@/lib/projects/templates";
import styles from "./ProjectIntentFields.module.css";

export function ProjectIntentFields({ value, onChange, goalLimit = 16000 }: {
  value: { projectType?: string; goal?: string; context?: string };
  onChange: (field: "projectType" | "goal" | "context", value: string) => void;
  goalLimit?: number;
}) {
  const id = useId(), selected = projectTemplate(value.projectType);
  return <div className={styles.fields}>
    <fieldset className={styles.types} aria-describedby={`${id}-guidance`}>
      <legend>Project type</legend>
      <div className={styles.grid}>
        {PROJECT_TEMPLATES.map(template => <label key={template.id} className={styles.type}>
          <input type="radio" name={`${id}-type`} value={template.id} checked={selected.id === template.id} onChange={() => onChange("projectType", template.id)} />
          <span><strong>{template.label}</strong><small>{template.description}</small></span>
        </label>)}
      </div>
    </fieldset>
    <p id={`${id}-guidance`} className={styles.guidance} aria-live="polite"><strong>A starting point for {selected.label}</strong>{selected.guidance}</p>
    <div className={styles.field}><label htmlFor={`${id}-goal`}>What should this project achieve?</label>
      <textarea id={`${id}-goal`} required rows={3} maxLength={goalLimit} placeholder={selected.goal} value={value.goal ?? ""} onChange={event => onChange("goal", event.target.value)} />
    </div>
    <div className={styles.field}><label htmlFor={`${id}-context`}>Context for the agent (optional)</label>
      <span className={styles.hint} id={`${id}-context-hint`}>Who is this for? What does success look like? Include constraints, existing systems, or decisions already made.</span>
      <textarea id={`${id}-context`} aria-describedby={`${id}-context-hint`} rows={4} maxLength={PROJECT_CONTEXT_LIMIT} value={value.context ?? ""} placeholder="For example: Our service team needs a first version in two weeks. Use our existing customer data and sign-in. Success means fewer manual handoffs." onChange={event => onChange("context", event.target.value)} />
    </div>
  </div>;
}
