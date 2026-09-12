"use client";

import { useRouter } from "next/navigation";
import { DEMO_PROFILES } from "@/lib/demo-profiles";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useDemoProfile();

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-labelledby="login-heading">
        <div className={styles.brand} aria-label="Unified Platform">
          <span aria-hidden="true">U</span>
        </div>
        <h1 id="login-heading">Sign in</h1>

        <div className={styles.accounts}>
          {DEMO_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={styles.account}
              onClick={() => {
                signIn(profile.id);
                router.replace("/");
              }}
            >
              <span className={styles.avatar} data-profile={profile.id} aria-hidden="true">
                {profile.initials}
              </span>
              <span className={styles.accountCopy}>
                <strong>{profile.name}</strong>
                <span>
                  {profile.onboarding ? "Day zero · Org assessment" : `${profile.experience === "returning" ? "Returning" : "New"} ${profile.role.toLowerCase()}`}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className={styles.note}>Demo environment</p>
      </section>
    </main>
  );
}
