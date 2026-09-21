"use client";

import Link from "next/link";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useId } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import { canAccessSurface, type DemoProfile } from "@/lib/demo-profiles";
import { surfaceApps } from "./app-catalog";
import { todayRow } from "./today-reveal";
import styles from "./SurfaceNav.module.css";

export function SurfaceNav({ revealOrder, readOnly = false, profile: capturedProfile }: { revealOrder?: number; readOnly?: boolean; profile?: DemoProfile } = {}) {
  const { profile: liveProfile } = useDemoProfile();
  const profile = capturedProfile ?? liveProfile;
  const headingId = useId();
  const { hrefForSurface, navigateSurface } = useNavigation();

  return (
    <nav className={styles.nav} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading} {...(revealOrder === undefined ? {} : todayRow(revealOrder))}>Explore surfaces</h2>
      <div className={styles.links} {...(revealOrder === undefined ? {} : todayRow(revealOrder + 1))}>
        {surfaceApps.filter((surface) => profile && canAccessSurface(profile, surface.id)).map((surface) => {
          const content = <>
            <surface.Icon className={styles.surfaceIcon} width={16} height={16} aria-hidden="true" />
            <span>{surface.label}</span>
            <ChevronRightIcon className={styles.arrow} width={16} height={16} aria-hidden="true" />
          </>;
          return readOnly ? <span key={surface.id} className={styles.link} data-today-container aria-disabled="true">{content}</span> : <Link
            key={surface.id}
            href={hrefForSurface(surface.id)}
            scroll={false}
            onNavigate={(event) => { event.preventDefault(); navigateSurface(surface.id); }}
            className={styles.link}
            data-today-container
            title={surface.description}
          >
            {content}
          </Link>
        })}
      </div>
    </nav>
  );
}
