"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/interaction/Modal";
import type { ProfileResetResult } from "@/lib/application/client";
import { readDestination } from "@/lib/navigation/model";
import { DEMO_PROFILES, PROFILE_SCENARIOS, type DemoProfile } from "@/lib/demo-profiles";
import { SURFACES } from "@/lib/workspace/surfaces";
import { orgsForProfile } from "@/lib/workspace/orgs";
import { useDemoProfile } from "@/components/profile/ProfileProvider";
import styles from "./page.module.css";

export default function LoginPage() {
  const { signIn, clearData, resolved } = useDemoProfile();
  const [selectedProfile, setSelectedProfile] = useState<DemoProfile | null>(null);
  const [orgId, setOrgId] = useState("");
  const [confirmation, setConfirmation] = useState<{ name: string; clear: () => Promise<ProfileResetResult> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; retryable: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [signInProblem, setSignInProblem] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  function dismiss() { if (!busy) { setConfirmation(null); setProblem(null); } }
  function chooseProfile(profile: DemoProfile) {
    setSelectedProfile(profile); setSignInProblem(""); setNotice("");
    const destination = readDestination(new URLSearchParams(window.location.search).get("returnTo") ?? "/");
    const requested = destination.kind === "destination" && destination.value.owner === profile.id ? destination.value.target.orgId : null;
    setOrgId(orgsForProfile(profile.id).find(org => org.id === requested && org.connection === "connected")?.id ?? "");
  }
  async function continueSignIn() {
    if (!selectedProfile || !orgId || busy) return;
    setBusy(true); setSignInProblem("");
    if (!await signIn(selectedProfile.id, orgId)) {
      setSignInProblem("We couldn’t sign in. Please try again."); setBusy(false);
    }
    // AppShell owns the redirect after the selected workspace is ready.
  }
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
        <div className={styles.brand} aria-label="Platform Studio">
          <span aria-hidden="true">P</span>
        </div>
        <h1 id="login-heading">{selectedProfile ? "Choose an org" : "Sign in"}</h1>

        {!selectedProfile && <p className={styles.intro}>Explore how Builder Central can grow into Platform Studio. Choose a scenario, then connect to an org.</p>}

        {!selectedProfile ? <div className={styles.accounts}>
          {DEMO_PROFILES.map((profile) => (
            <div className={styles.accountRow} key={profile.id}>
            <button
              key={profile.id}
              type="button"
              className={styles.account}
              disabled={!resolved || busy}
              onClick={() => chooseProfile(profile)}
            >
              <span className={styles.avatar} data-profile={profile.id} aria-hidden="true">
                {profile.initials}
              </span>
              <span className={styles.accountCopy}>
                <strong>{profile.name}</strong>
                <span>
                  {PROFILE_SCENARIOS[profile.id].label} · {PROFILE_SCENARIOS[profile.id].phase}
                </span>
                <span>{PROFILE_SCENARIOS[profile.id].description}</span>
                <span className={styles.surfaces}>{profile.surfaceAccess.map(surface => <span key={surface} className={styles.surface}>{SURFACES[surface].label}</span>)}</span>
              </span>
            </button>
            <button type="button" className={styles.clear} disabled={!resolved || busy}
              aria-label={`Clear data for ${profile.name}`}
              onClick={() => { setNotice(""); setProblem(null); setConfirmation({ name: profile.name, clear: () => clearData(profile.id) }); }}>
              Clear data
            </button>
            </div>
          ))}
        </div> : <form className={styles.orgForm} aria-busy={busy} onSubmit={event => { event.preventDefault(); void continueSignIn(); }}>
          <p className={styles.notice}>Continue as <strong>{selectedProfile.name}</strong>. Choose the org you want to work in.</p>
          <fieldset className={styles.orgs} disabled={busy}>
            <legend>Connected orgs</legend>
            {orgsForProfile(selectedProfile.id).filter(org => org.connection === "connected").map(org => <label className={styles.orgOption} key={org.id}>
              <input type="radio" name="org" value={org.id} checked={orgId === org.id} onChange={() => setOrgId(org.id)} required />
              <span><strong>{org.label}</strong><small>{org.kind === "devhub" ? "Dev Hub" : org.kind === "production" ? "Production" : org.kind === "sandbox" ? "Sandbox" : "Scratch org"}</small></span>
              <span className={styles.connected}>Connected</span>
            </label>)}
          </fieldset>
          <div className={styles.signInActions}>
            <button type="button" disabled={busy} onClick={() => { setSelectedProfile(null); setOrgId(""); setSignInProblem(""); }}>Back</button>
            <button type="submit" className={styles.continueButton} disabled={!resolved || !orgId || busy}>{busy ? "Opening workspace…" : "Continue"}</button>
          </div>
        </form>}

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
          <div className={styles.dialogActions}>
            <button type="button" ref={cancelRef} onClick={dismiss} disabled={busy}>{problem && !problem.retryable ? "Close" : "Cancel"}</button>
            <button type="button" className={styles.confirmClear} onClick={() => { void confirmClear(); }} disabled={busy || problem?.retryable === false} aria-busy={busy}>
              {busy && <span className={styles.clearSpinner} aria-hidden="true" />}
              {problem?.retryable ? "Retry clear" : "Clear data"}
            </button>
          </div>
        </div>
      </Modal>}
    </main>
  );
}
