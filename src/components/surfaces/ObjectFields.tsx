"use client";

import { useId, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import type { OrgResource } from "@/lib/org-resources/model";
import { OBJECT_FIELD_TYPES, objectFieldProblem, parseObjectFields, suggestedFieldApiName, type ObjectField } from "@/lib/org-resources/object-fields";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./OrgResourceCanvas.module.css";

export function ObjectFields({ resource, spec }: { resource: OrgResource; spec: CanvasOf<"org-resource"> }) {
  const { updateDraft, persistence } = useSurfaceCanvasActions();
  const [adding, setAdding] = useState(false), [label, setLabel] = useState("");
  const [apiName, setApiName] = useState<string | null>(null), [type, setType] = useState<ObjectField["type"]>("Text");
  const [problem, setProblem] = useState(""), [notice, setNotice] = useState("");
  const id = useId(), addButton = useRef<HTMLButtonElement>(null);
  const fields = parseObjectFields(resource, spec.draft ?? {}) ?? [];
  const reset = () => { setLabel(""); setApiName(null); setType("Text"); setProblem(""); };
  return <section className={styles.section} aria-label="Fields">
    <div className={styles.sectionHeading}><h3>Fields</h3><button ref={addButton} className={styles.addField} type="button" aria-expanded={adding}
      onClick={() => { reset(); setAdding(true); setNotice(""); }}><PlusIcon width={14} height={14} aria-hidden="true" />Add field</button></div>
    {adding && <form className={styles.fieldForm} aria-label="New field" onSubmit={event => {
      event.preventDefault();
      const field = { label: label.trim(), apiName: (apiName ?? suggestedFieldApiName(label)).trim(), type };
      const error = objectFieldProblem(resource, field, fields);
      if (error) { setProblem(error); return; }
      if (Object.keys(spec.draft ?? {}).length >= 100 && !Object.hasOwn(spec.draft ?? {}, field.apiName)) { setProblem("This object has reached its workspace field limit."); return; }
      updateDraft("build", spec.id, { [field.apiName]: JSON.stringify(field) });
      setNotice(`${field.label} added to your workspace changes.`); reset(); setAdding(false); addButton.current?.focus();
    }}>
      <h4>New field</h4>
      <div className={styles.fieldInputs}>
        <label>Field label<input autoFocus required maxLength={80} value={label} placeholder="Customer region" onChange={event => { setLabel(event.target.value); setProblem(""); }} /></label>
        <div className={styles.fieldInput}><label htmlFor={`${id}-api`}>API name</label><input id={`${id}-api`} aria-describedby={`${id}-api-hint`} required maxLength={80} value={apiName ?? suggestedFieldApiName(label)} placeholder="Customer_Region__c" onChange={event => { setApiName(event.target.value); setProblem(""); }} /><small id={`${id}-api-hint`}>Custom field names end in __c.</small></div>
        <div className={styles.fieldInput}><label htmlFor={`${id}-type`}>Type</label><select id={`${id}-type`} value={type} onChange={event => setType(event.target.value as ObjectField["type"])}>{OBJECT_FIELD_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>
      </div>
      {problem && <p role="alert" className={styles.fieldError}>{problem}</p>}
      <div className={styles.formActions}><button type="button" onClick={() => { setAdding(false); reset(); addButton.current?.focus(); }}>Cancel</button><button type="submit" className={styles.primary}>Add to Account</button></div>
    </form>}
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Fields table">
      <table><thead><tr><th scope="col">Field</th><th scope="col">API name</th><th scope="col">Type</th><th scope="col"><span className={styles.srOnly}>Workspace change</span></th></tr></thead>
        <tbody>
          {resource.section?.rows.map(row => <tr key={row[1]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}<td /></tr>)}
          {fields.map(field => <tr key={field.apiName} className={styles.addedRow}><td>{field.label}</td><td>{field.apiName}</td><td>{field.type}</td><td><div className={styles.fieldChange}><span>Added</span><button type="button" aria-label={`Remove ${field.label}`} onClick={() => {
            updateDraft("build", spec.id, { [field.apiName]: "" }); setNotice(`${field.label} removed from your workspace changes.`);
          }}>Remove</button></div></td></tr>)}
        </tbody>
      </table>
    </div>
    <div className={styles.fieldNote}><p>Field additions are saved in your workspace for review.</p>{!!Object.keys(spec.draft ?? {}).length && <PersistenceStatus store={persistence} hasContent={!!fields.length} />}</div>
    {notice && <p className={styles.fieldNotice} role="status">{notice}</p>}
  </section>;
}
