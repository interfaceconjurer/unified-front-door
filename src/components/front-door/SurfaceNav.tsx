"use client";

import Link from "next/link";
import { useId } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canAccessSurface } from "@/lib/demo-profiles";
import { surfaceApps, type SurfaceApp } from "./app-catalog";
import styles from "./SurfaceNav.module.css";

export function SurfaceNav({ onExplore, revealOrder, readOnly = false }: { onExplore?: (surface: SurfaceApp) => void; revealOrder?: number; readOnly?: boolean }) {
  const { profile } = useDemoProfile();
  const headingId = useId();

  return (
    <nav className={styles.nav} data-front-door-row={revealOrder} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>Explore surfaces</h2>
      <div className={styles.links}>
        {surfaceApps.filter((surface) => profile && canAccessSurface(profile, surface.id)).map((surface) => (
          <Link
            key={surface.id}
            href={surface.href}
            scroll={false}
            aria-disabled={readOnly || undefined}
            tabIndex={readOnly ? -1 : undefined}
            onClick={(event) => { if (readOnly) event.preventDefault(); }}
            onNavigate={() => { if (!readOnly) onExplore?.(surface); }}
            className={styles.link}
            data-today-surface-link
            title={surface.description}
          >
            <surface.Icon className={styles.surfaceIcon} width={16} height={16} aria-hidden="true" />
            <span>{surface.label}</span>
            <ChevronRightIcon className={styles.arrow} data-today-action width={16} height={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
