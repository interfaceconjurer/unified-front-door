"use client";

import { ChevronRightIcon, DatabaseIcon } from "@/components/icons";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { canAccessSurface } from "@/lib/demo-profiles";
import { findResource } from "@/lib/org-resources/catalog";
import { RESOURCE_TYPES, resourceKey } from "@/lib/org-resources/model";
import { isEditableObject } from "@/lib/org-resources/object-fields";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { SURFACES } from "@/lib/workspace/surfaces";
import { RESOURCE_ICONS } from "./resource-icons";
import { isEditablePermissions } from "@/lib/org-resources/permissions";
import { PermissionsCanvas } from "./PermissionsCanvas";
import { ObjectFields } from "./ObjectFields";
import styles from "./OrgResourceCanvas.module.css";

export function OrgResourceCanvas({ spec }: { spec: CanvasOf<"org-resource"> }) {
  const { orgs } = useWorkspace();
  const { profile } = useDemoProfile();
  const { openResource } = useNavigation();
  const org = orgs.find(org => org.id === spec.params.orgId && org.connection === "connected");
  const resource = org && findResource(spec.params);
  if (!resource || !org) return <article className={styles.canvas}><h2>Resource unavailable</h2><p>This resource is no longer available in its connected org.</p></article>;
  if (isEditablePermissions(spec.params)) return <PermissionsCanvas key={spec.id} spec={spec} />;
  const type = RESOURCE_TYPES[resource.resourceType], Icon = RESOURCE_ICONS[type.group];
  const related = resource.related.flatMap(reference => {
    const item = findResource({ ...reference, orgId: org.id });
    return item && profile && canAccessSurface(profile, RESOURCE_TYPES[item.resourceType].surface) ? [item] : [];
  });

  return <article className={styles.canvas} aria-label={`${resource.label} resource`}>
    <div className={styles.scope}><span><DatabaseIcon width={14} height={14} aria-hidden="true" />{org.label}</span><span>Demo metadata</span></div>
    <header className={styles.header}>
      <span className={styles.icon} aria-hidden="true"><Icon width={24} height={24} /></span>
      <div className={styles.heading}><p className={styles.eyebrow}>{type.label}</p><h2>{resource.label}</h2><code>{resource.apiName}</code></div>
      <span className={styles.status}>{resource.status}</span>
    </header>
    <p className={styles.summary}>{resource.summary}</p>
    <section className={styles.section} aria-label="Resource details">
      <h3>Details</h3>
      <dl className={styles.facts}>
        {[{ label: "Resource type", value: type.label }, { label: "Opens in", value: SURFACES[type.surface].label }, ...resource.facts].map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>
    </section>
    {isEditableObject(resource) ? <ObjectFields key={spec.id} resource={resource} spec={spec} /> : resource.section && <section className={styles.section} aria-label={resource.section.title}>
      <h3>{resource.section.title}</h3>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${resource.section.title} table`}>
        <table><thead><tr>{resource.section.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{resource.section.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>}
    {resource.code && <section className={styles.section} aria-label="Source preview"><h3>Source preview</h3><pre tabIndex={0}><code>{resource.code}</code></pre></section>}
    {related.length > 0 && <section className={styles.section} aria-label="Related resources"><h3>Related resources</h3><div className={styles.related}>
      {related.map(item => {
        const kind = RESOURCE_TYPES[item.resourceType], RelatedIcon = RESOURCE_ICONS[kind.group];
        return <button type="button" key={resourceKey(item)} onClick={() => openResource(item)}>
          <RelatedIcon width={18} height={18} aria-hidden="true" /><span><strong>{item.label}</strong><small>{kind.label} · {SURFACES[kind.surface].label}</small></span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </button>;
      })}
    </div></section>}
  </article>;
}
