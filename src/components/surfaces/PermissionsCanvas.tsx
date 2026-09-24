"use client";

import { useState } from "react";
import { ShieldIcon, CheckIcon } from "@/components/icons";
import { PersistenceStatus } from "@/components/persistence/PersistenceStatus";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { permissionUsers } from "@/lib/org-resources/permissions";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { useSurfaceCanvasActions } from "./surface-canvas-context";
import styles from "./PermissionsCanvas.module.css";

export function PermissionsCanvas({ spec }: { spec: CanvasOf<"org-resource"> }) {
  const { updateDraft, persistence } = useSurfaceCanvasActions();
  const { orgs } = useWorkspace();
  const [notice, setNotice] = useState("");
  const users = permissionUsers(spec.draft), changed = users.filter(user => user.changed);
  const org = orgs.find(org => org.id === spec.params.orgId);
  function update(id: string, name: string, canDelete: boolean) {
    updateDraft("build", spec.id, { [id]: canDelete ? "" : "standard" });
    setNotice(`${name}: ${canDelete ? "original access restored" : "Delete Cases removed from planned access"}.`);
  }
  return <article className={styles.canvas} aria-label="Service Reps permissions">
    <p className={styles.context}>Access &amp; Permissions <span>·</span> {org?.label}</p>
    <header className={styles.header}><span className={styles.icon}><ShieldIcon width={25} height={25} aria-hidden="true" /></span><div><h1>Service Reps</h1><p>User access · Cases</p></div></header>
    <div className={styles.summary}><span><strong>{users.length}</strong> members</span><span><strong>{users.filter(user => user.canDelete).length}</strong> with Delete access</span><span><strong>{changed.length}</strong> changed</span></div>
    <div className={styles.heading}><h2>Users &amp; permissions</h2>{changed.length > 0 && <button type="button" onClick={() => {
      updateDraft("build", spec.id, Object.fromEntries(changed.map(user => [user.id, ""]))); setNotice("All permission changes undone.");
    }}>Undo all changes</button>}</div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Service Reps user permissions">
      <table><thead><tr><th scope="col">User</th><th scope="col">Read, create &amp; edit</th><th scope="col">Delete Cases</th><th scope="col">Change</th></tr></thead><tbody>{users.map(user =>
        <tr key={user.id} data-changed={user.changed}><th scope="row"><strong>{user.name}</strong><small>{user.email}</small></th>
          <td><span className={styles.allowed}><CheckIcon width={14} height={14} aria-hidden="true" />Enabled</span><small>Service Reps group</small></td>
          <td><label className={styles.toggle}><input type="checkbox" checked={user.canDelete} aria-label={`Delete Cases for ${user.name}`} onChange={event => update(user.id, user.name, event.target.checked)} /><span>{user.canDelete ? "Allowed" : "Not allowed"}</span></label><small>{user.canDelete ? "Case Delete · direct assignment" : "No remaining Delete grant"}</small></td>
          <td>{user.changed ? <div className={styles.change}><span>Modified</span><button type="button" aria-label={`Undo change for ${user.name}`} onClick={() => update(user.id, user.name, true)}>Undo</button></div> : <span className={styles.muted}>—</span>}</td>
        </tr>)}</tbody></table>
    </div>
    <footer className={styles.footer}><span>{changed.length ? `Changes tracked ${spec.params.projectId ? "in this project" : "outside a project"}.` : "Captured org access."} The org has not been changed.</span>{Object.keys(spec.draft ?? {}).length > 0 && <PersistenceStatus store={persistence} hasContent={changed.length > 0} />}</footer>
    <p className={styles.notice} role="status">{notice}</p>
  </article>;
}
