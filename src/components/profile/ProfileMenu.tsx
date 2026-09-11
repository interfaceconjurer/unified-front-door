"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_PROFILES, type DemoProfileId } from "@/lib/demo-profiles";
import { useDemoProfile } from "./ProfileProvider";
import styles from "./ProfileMenu.module.css";

export function ProfileMenu() {
  const router = useRouter();
  const { profile, signIn, signOut } = useDemoProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!profile) return null;

  const alternateProfiles = DEMO_PROFILES.filter((candidate) => candidate.id !== profile.id);
  const experienceLabel = profile.experience === "returning" ? "Returning user" : "New user";

  function switchUser(profileId: DemoProfileId) {
    signIn(profileId);
    setOpen(false);
    router.replace("/");
  }

  function logout() {
    signOut();
    setOpen(false);
    router.replace("/login");
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.avatar}
        data-profile={profile.id}
        aria-label={`User menu for ${profile.name}`}
        aria-expanded={open}
        aria-controls={open ? "profile-menu" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {profile.initials}
      </button>

      {open && (
        <div id="profile-menu" className={styles.menu}>
          <div className={styles.profile}>
            <span className={styles.profileCopy}>
              <strong>{profile.name}</strong>
              <small>
                {profile.role} · {experienceLabel}
              </small>
            </span>
          </div>

          <div className={styles.people}>
            {alternateProfiles.map((alternateProfile) => <button key={alternateProfile.id} type="button" onClick={() => switchUser(alternateProfile.id)}>
              <span className={styles.personCopy}>
                <strong>Switch to {alternateProfile.name}</strong>
                <small>
                  {alternateProfile.role} · {alternateProfile.experience === "returning" ? "Returning user" : "New user"}
                </small>
              </span>
            </button>)}
          </div>

          <div className={styles.logout}>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
