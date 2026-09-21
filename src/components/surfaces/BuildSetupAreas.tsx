"use client";

import { ChevronRightIcon } from "@/components/icons";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { SETUP_AREAS, resourceBelongsToArea } from "@/lib/org-resources/setup";
import { resourcesForOrg } from "@/lib/org-resources/catalog";
import { capabilityForCanvas } from "./surface-capabilities";
import styles from "./OrgSetup.module.css";

export function BuildSetupAreas() {
  const { activeOrg } = useWorkspace();
  const { openCanvas, capabilityScope } = useNavigation();
  const resources = activeOrg ? resourcesForOrg(activeOrg.id) : [];
  return <section className={styles.areas} aria-labelledby="org-setup-heading">
    <div className={styles.sectionHeading}><h2 id="org-setup-heading">Configure your org</h2><span>{activeOrg?.label ?? "Choose an org to explore"}</span></div>
    <div className={styles.cards}>{SETUP_AREAS.map(area => {
      const Icon = capabilityForCanvas("build", area.id)!.Icon;
      const count = resources.filter(resource => resourceBelongsToArea(area, resource.resourceType)).length;
      return <button type="button" className={styles.card} key={area.id} onClick={() => openCanvas("build", { kind: "capability", title: area.title, params: { ...capabilityScope, surface: "build", capability: area.id } })}>
        <span className={styles.icon} data-area={area.id}><Icon width={22} height={22} aria-hidden="true" /></span>
        <strong>{area.label}</strong><span className={styles.description}>{area.description}</span>
        <span className={styles.cardFooter}>{area.id === "object-manager" ? "Open Object Manager" : activeOrg ? `${count} resources` : "Explore configuration"}<ChevronRightIcon width={15} height={15} aria-hidden="true" /></span>
      </button>;
    })}</div>
  </section>;
}
