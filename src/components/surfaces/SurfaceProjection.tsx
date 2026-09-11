"use client";

import { surfaceAppById } from "@/components/front-door/app-catalog";
import type { SurfaceId } from "@/lib/workspace/model";
import { SurfaceLauncher } from "./SurfaceLauncher";
import styles from "./SurfaceProjection.module.css";

/** Introduce each surface through tools that open editable canvas drafts. */
export function SurfaceProjection({ surfaceId }: {
  surfaceId: SurfaceId;
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  return <div className={styles.surface}>
    <section className={styles.workspace} aria-labelledby="surface-heading">
      <header className={styles.header}>
        <div className={styles.headingText}>
          <h1 id="surface-heading"><surface.Icon className={styles.titleIcon} width={26} height={26} aria-hidden="true" />{surface.label}</h1>
          <p className={styles.lead}>{surface.workspaceDescription}</p>
        </div>
      </header>
      <SurfaceLauncher surfaceId={surfaceId} />
    </section>
  </div>;
}
