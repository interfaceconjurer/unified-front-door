"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canAccessSurface } from "@/lib/demo-profiles";
import { surfaceApps } from "./app-catalog";
import styles from "./SurfaceNav.module.css";

export function SurfaceNav() {
  const { profile } = useDemoProfile();

  return (
    <nav className={styles.nav} aria-labelledby="explore-surfaces-heading">
      <h2 id="explore-surfaces-heading" className={styles.heading}>Explore surfaces</h2>
      <div className={styles.links}>
        {surfaceApps.filter((surface) => profile && canAccessSurface(profile, surface.id)).map((surface) => (
          <Link
            key={surface.id}
            href={surface.href}
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
