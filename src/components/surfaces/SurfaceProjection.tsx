"use client";

import { surfaceAppById } from "@/components/front-door/app-catalog";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import type { SurfaceId } from "@/lib/workspace/model";
import { SurfaceLauncher } from "./SurfaceLauncher";
import { ReturningSurface } from "./ReturningSurface";
import styles from "./SurfaceProjection.module.css";

/** First visits introduce the tools; established workspaces center current work. */
export function SurfaceProjection({ surfaceId, children }: {
  surfaceId: SurfaceId;
  children?: React.ReactNode;
}) {
  const surface = surfaceAppById(surfaceId);
  const { profile } = useDemoProfile();
  if (profile?.workspaceExperience === "established") {
    return <ReturningSurface surfaceId={surfaceId}>{children}</ReturningSurface>;
  }
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
