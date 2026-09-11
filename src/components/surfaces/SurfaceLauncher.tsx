"use client";

import { ChevronRightIcon } from "@/components/icons";
import type { SurfaceId } from "@/lib/workspace/model";
import { capabilitiesForSurface, type SurfaceCapability } from "./surface-capabilities";
import { useSurfaceCanvases } from "./surface-canvas-context";
import styles from "./SurfaceLauncher.module.css";

const HEADINGS: Record<SurfaceId, string> = {
  code: "Start building",
  build: "Start configuring",
  govern: "Start exploring",
  alm: "Start planning",
};

export function SurfaceLauncher({ surfaceId }: { surfaceId: SurfaceId }) {
  const capabilities = capabilitiesForSurface(surfaceId);
  const { openCanvas } = useSurfaceCanvases(surfaceId);

  function launch(capability: SurfaceCapability) {
    openCanvas(surfaceId, {
      kind: "capability",
      title: capability.label,
      params: { surface: surfaceId, capability: capability.id },
    });
  }

  return (
    <section className={styles.launcher} aria-labelledby="surface-launch-heading">
      <div className={styles.heading}>
        <h2 id="surface-launch-heading">{HEADINGS[surfaceId]}</h2>
        <span>Open a canvas and make it yours</span>
      </div>
      <ul className={styles.grid}>
        {capabilities.filter((capability) => !capability.group).map((capability) => (
          <li key={capability.id}>
            <button type="button" className={styles.card} onClick={() => launch(capability)}>
              <span className={styles.icon} aria-hidden="true"><capability.Icon width={20} height={20} /></span>
              <span className={styles.copy}>
                <strong>{capability.label}</strong>
                <span>{capability.description}</span>
              </span>
              <ChevronRightIcon className={styles.arrow} width={16} height={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {capabilities.filter((capability) => capability.group === "toolkit").map((capability) => (
        <button key={capability.id} type="button" className={`${styles.card} ${styles.toolkit}`} onClick={() => launch(capability)}>
          <span className={styles.icon} aria-hidden="true"><capability.Icon width={22} height={22} /></span>
          <span className={styles.copy}>
            <strong>{capability.label}</strong>
            <span>{capability.description}</span>
            <span className={styles.toolkitAction}>Configure your toolkit</span>
          </span>
          <ChevronRightIcon className={styles.arrow} width={16} height={16} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}
