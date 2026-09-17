"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal } from "@/components/interaction/Modal";
import type { ProfileResetResult } from "@/lib/application/client";
import { normalizeDestinationHref } from "@/lib/navigation/model";
import { DEMO_PROFILES } from "@/lib/demo-profiles";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, clearData, resolved } = useDemoProfile();
  const [confirmation, setConfirmation] = useState<{ name: string; clear: () => Promise<ProfileResetResult> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; retryable: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [signInProblem, setSignInProblem] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  function dismiss() { if (!busy) { setConfirmation(null); setProblem(null); } }
  async function confirmClear() {
    if (!confirmation || busy) return;
    setBusy(true); setProblem(null); setNotice("");
    try {
      const result = await confirmation.clear();
      if (result.ok) {
        setNotice(`Clear data completed for ${confirmation.name}.`);
        setConfirmation(null);
      } else setProblem(result);
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-labelledby="login-heading">
        <div className={styles.brand} aria-label="Unified Platform">
          <span aria-hidden="true">U</span>
        </div>
        <h1 id="login-heading">Sign in</h1>

        <div className={styles.accounts}>
          {DEMO_PROFILES.map((profile) => (
            <div className={styles.accountRow} key={profile.id}>
            <button
              key={profile.id}
              type="button"
              className={styles.account}
              disabled={!resolved || busy}
              onClick={async () => {
                setBusy(true); setSignInProblem("");
                try {
                  if (!await signIn(profile.id)) { setSignInProblem("We couldn’t sign in. Please try again."); return; }
                  router.replace(normalizeDestinationHref(new URLSearchParams(window.location.search).get("returnTo")) ?? "/");
                } finally { setBusy(false); }
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
            <button type="button" className={styles.clear} disabled={!resolved || busy}
              aria-label={`Clear data for ${profile.name}`}
              onClick={() => { setNotice(""); setProblem(null); setConfirmation({ name: profile.name, clear: () => clearData(profile.id) }); }}>
              Clear data
            </button>
            </div>
          ))}
        </div>

        <p className={styles.note}>Demo environment</p>
        {signInProblem && <p className={styles.notice} role="alert">{signInProblem}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </section>
      {confirmation && <Modal open onDismiss={dismiss} onExited={() => {}} initialFocus={cancelRef}
        label={`Clear data for ${confirmation.name}?`} className={styles.dialog}>
        <div className={styles.dialogContent}>
          <h2>Clear data for {confirmation.name}?</h2>
          <p>This permanently deletes their saved chats, assessments, projects, and drafts in this demo workspace, then restores their original starting state.</p>
          <p>Starter demo projects stay available. Other users’ data is unchanged.</p>
          {problem && <p role="alert">{problem.message}</p>}
          {busy && <p role="status">Clearing saved data…</p>}
          <div className={styles.dialogActions}>
            <button type="button" ref={cancelRef} onClick={dismiss} disabled={busy}>{problem && !problem.retryable ? "Close" : "Cancel"}</button>
            <button type="button" className={styles.confirmClear} onClick={() => { void confirmClear(); }} disabled={busy || problem?.retryable === false}>
              {busy ? "Clearing…" : problem?.retryable ? "Retry clear" : "Clear data"}
            </button>
          </div>
        </div>
      </Modal>}
    </main>
  );
}
