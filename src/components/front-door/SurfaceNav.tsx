"use client";

import Link from "next/link";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useId } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canAccessSurface } from "@/lib/demo-profiles";
import { surfaceApps } from "./app-catalog";
import styles from "./SurfaceNav.module.css";

export function SurfaceNav() {
  const { profile } = useDemoProfile();
  const headingId = useId();
  const { hrefForSurface, navigateSurface } = useNavigation();

  return (
    <nav className={styles.nav} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>Explore surfaces</h2>
      <div className={styles.links}>
        {surfaceApps.filter((surface) => profile && canAccessSurface(profile, surface.id)).map((surface) => (
          <Link
            key={surface.id}
            href={hrefForSurface(surface.id)}
            scroll={false}
            onNavigate={(event) => { event.preventDefault(); navigateSurface(surface.id); }}
            className={styles.link}
            title={surface.description}
          >
            <surface.Icon className={styles.surfaceIcon} width={16} height={16} aria-hidden="true" />
            <span>{surface.label}</span>
            <ChevronRightIcon className={styles.arrow} width={16} height={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
