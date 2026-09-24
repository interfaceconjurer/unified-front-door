"use client";

import { useState } from "react";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { resourcesForOrg } from "@/lib/org-resources/catalog";
import { RESOURCE_TYPES, resourceKey, searchResources, type ResourceType } from "@/lib/org-resources/model";
import { SETUP_AREAS, setupAreaForId, resourceBelongsToArea } from "@/lib/org-resources/setup";
import type { CanvasOf } from "@/lib/surface-canvas/model";
import { RESOURCE_ICONS } from "./resource-icons";
import styles from "./OrgSetup.module.css";

export function OrgSetupCanvas({ spec }: { spec: CanvasOf<"capability"> }) {
  const { orgs } = useWorkspace();
  const { openCanvas, openResource } = useNavigation();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const area = setupAreaForId(spec.params.capability)!;
  const org = orgs.find(org => org.id === spec.params.orgId && org.connection === "connected");
  const inventory = org ? resourcesForOrg(org.id).filter(resource => resourceBelongsToArea(area, resource.resourceType)) : [];
  const resources = searchResources(inventory, query, type);
  function openArea(id: string, orgId = org?.id) {
    const next = setupAreaForId(id)!;
    openCanvas("build", { kind: "capability", title: next.title, params: { ...spec.params, capability: id, orgId } });
  }

  return <article className={styles.browser} aria-label={area.title}>
    <div className={styles.scope}>
      <label>Source org<select aria-label="Setup org" value={org?.id ?? ""} onChange={event => openArea(area.id, event.target.value)}>
        <option value="" disabled>Choose an org</option>{orgs.filter(org => org.connection === "connected").map(org => <option value={org.id} key={org.id}>{org.label}</option>)}
      </select></label><span>Demo metadata</span>
    </div>
    <header className={styles.header}><p className={styles.eyebrow}>Build & Setup · {area.label}</p><h2>{area.title}</h2><p>{area.description}</p></header>
    <nav className={styles.areaLinks} aria-label="Org setup areas">{SETUP_AREAS.map(item => <button type="button" key={item.id} aria-current={item.id === area.id ? "page" : undefined} onClick={() => openArea(item.id)}>{item.label}</button>)}</nav>
    {org ? <>
      <p className={styles.scopeNote}>{spec.params.scope === "project" ? "Org configuration, viewed in this project. " : "Configuration for your connected org. "}{area.id === "org-settings" ? "Feature enablement applies to the org. This preview shows settings for review." : "Browse a resource to see its details and related configuration."}</p>
      <div className={styles.filters}>
        <label className={styles.search}><SearchIcon width={17} height={17} aria-hidden="true" /><input type="search" aria-label={`Search ${area.title}`} placeholder={`Search ${area.id === "object-manager" ? "objects, fields, and layouts" : area.id === "access-permissions" ? "permissions and access" : "settings and features"}…`} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select aria-label="Setup resource type" value={type} onChange={event => setType(event.target.value as ResourceType | "all")}><option value="all">All types</option>{area.resourceTypes.map(type => <option key={type} value={type}>{RESOURCE_TYPES[type].plural}</option>)}</select>
      </div>
      <div className={styles.sectionHeading}><h3>{area.id === "object-manager" ? "Objects & configuration" : area.id === "access-permissions" ? "Access configuration" : "Features & connections"}</h3><span role="status">{resources.length} {resources.length === 1 ? "resource" : "resources"}</span></div>
      {resources.length ? <ul className={styles.resources}>{resources.map(resource => {
        const kind = RESOURCE_TYPES[resource.resourceType], Icon = RESOURCE_ICONS[kind.group];
        return <li key={resourceKey(resource)}><button type="button" onClick={() => openResource(resource)} aria-label={`Open ${resource.label}`}>
          <span className={styles.resourceIcon}><Icon width={19} height={19} aria-hidden="true" /></span>
          <span className={styles.resourceText}><strong>{resource.label}</strong><small>{kind.label} · {resource.apiName}</small><span>{resource.summary}</span></span>
          <span className={styles.status} data-enabled={resource.status === "Enabled"}>{resource.status}</span><ChevronRightIcon width={16} height={16} aria-hidden="true" />
        </button></li>;
      })}</ul> : <div className={styles.empty}><h3>{inventory.length ? "No matching resources" : "No captured resources"}</h3><p>{inventory.length ? "Try another search or resource type." : "This demo org has no metadata in this area yet."}</p>{(query || type !== "all") && <button type="button" onClick={() => { setQuery(""); setType("all"); }}>Clear filters</button>}</div>}
    </> : <div className={styles.empty}><h3>Choose a connected org</h3><p>Select a target org above to explore its configuration. Your project and conversation stay in place.</p></div>}
  </article>;
}
