"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { surfaceApps, type SurfaceApp } from "@/components/front-door/app-catalog";
import styles from "./TopBar.module.css";

type TopBarProps = {
  currentApp: SurfaceApp | undefined;
};

/**
 * The common wayfinder shared by the front door and every purpose-built app.
 * It always provides a direct path home, an app switcher, and current location.
 * The agent no longer lives here — it stands as a persistent panel inside each
 * surface — so the bar stays focused on navigation.
 */
export function TopBar({ currentApp }: TopBarProps) {
  const router = useRouter();

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link href="/" className={styles.homeLink} aria-label="Front Door home">
          <span className={styles.logo} aria-hidden="true">
            U
          </span>
          <span className={styles.brandName}>Front Door</span>
        </Link>

        <span className={styles.divider} aria-hidden="true" />

        <label className={styles.appPickerLabel}>
          <span className={styles.srOnly}>Switch application</span>
          <select
            className={styles.appPicker}
            value={currentApp?.href ?? ""}
            onChange={(event) => {
              if (event.target.value) router.push(event.target.value);
            }}
          >
            <option value="" disabled>
              Apps
            </option>
            {surfaceApps.map((surface) => (
              <option key={surface.id} value={surface.href}>
                {surface.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.location} aria-label="Current location">
          <span className={styles.locationSeparator} aria-hidden="true">
            /
          </span>
          {currentApp ? (
            <>
              <span className={styles.appName}>{currentApp.label}</span>
              <span className={styles.locationSeparator} aria-hidden="true">
                /
              </span>
              <span className={styles.pageName}>Overview</span>
            </>
          ) : (
            <span className={styles.pageName}>Home</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.helpButton} aria-label="Help">
          ?
        </button>
        <button type="button" className={styles.avatar} aria-label="User profile">
          JW
        </button>
      </div>
    </header>
  );
}
