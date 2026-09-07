"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, SendIcon, SparklesIcon } from "@/components/icons";
import {
  AGENT_CANVAS,
  AGENT_READY,
  FLOW_CANVAS,
} from "@/components/capabilities/capability-fixtures";
import { useControlPlane } from "@/components/control-plane/ControlPlaneProvider";
import {
  RESUME_FIXTURES,
  RETURNING_PROJECTS,
} from "@/components/control-plane/control-plane-fixtures";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { WorkObjectCard } from "./WorkObjectCard";
import styles from "./AgentWorkstage.module.css";

const JOBS = [
  "Qualify and route sales leads",
  "Automate a business process",
  "Fix a deployment issue",
  "Plan a release",
  "Review access",
  "Understand an org",
] as const;

const SCENARIO_BY_QUERY = {
  stale: "stale-resume",
  external: "external-fallback",
  unavailable: "agent-unavailable",
  preparation: "preparation-error",
  context: "context-error",
} as const;

export function AgentWorkstage() {
  const { state, activeCanvas, dispatch } = useControlPlane();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const { setActiveProject, setActiveWorktree } = useWorkspace();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rawFixture = new URLSearchParams(window.location.search).get("fixture");
    if (rawFixture === "returning") {
      dispatch({ type: "SHOW_RETURNING" });
      return;
    }
    const fixture = rawFixture as keyof typeof SCENARIO_BY_QUERY | null;
    if (fixture && SCENARIO_BY_QUERY[fixture]) {
      dispatch({ type: "SHOW_SCENARIO", phase: SCENARIO_BY_QUERY[fixture] });
    }
  }, [dispatch]);

  useEffect(() => {
    if (!["flow-ready", "flow-pending", "flow-acknowledged", "closed"].includes(state.phase)) return;
    const frame = requestAnimationFrame(() => {
      const transcript = transcriptRef.current;
      if (!transcript) return;
      transcript.scrollTo({
        top: transcript.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.phase]);

  function begin(value = draft) {
    if (!value.trim()) return;
    dispatch({ type: "BEGIN_WORK" });
    setDraft("");
  }

  function openCanvas(canvasId: string) {
    dispatch({ type: "OPEN_CANVAS", canvasId, userInitiated: true });
    requestAnimationFrame(() => document.getElementById(`canvas-heading-${canvasId}`)?.focus());
  }

  if (state.presentation.mode === "focus") {
    return (
      <section className={`${styles.workstage} ${styles.dock}`} aria-label="Agent">
        <button type="button" onClick={() => dispatch({ type: "EXIT_FOCUS" })} aria-label="Restore Agent and exit Focus">
          <SparklesIcon width={18} height={18} aria-hidden="true" />
          <span>Agent</span>
          <ChevronRightIcon width={15} height={15} aria-hidden="true" />
        </button>
      </section>
    );
  }

  if (state.homeView === "returning" && state.presentation.mode === "chat-only") {
    return <ReturningHome />;
  }

  if (state.phase === "fresh") {
    return (
      <section className={`${styles.workstage} ${styles.fresh}`} aria-labelledby="workstage-heading">
        <div className={styles.hero}>
          <span className={styles.heroMark} aria-hidden="true"><SparklesIcon width={22} height={22} /></span>
          <h1 id="workstage-heading">What would you like to make easier?</h1>
          <p>Describe the outcome in your own words.</p>
          <Composer draft={draft} setDraft={setDraft} onSubmit={begin} inputRef={composerRef} large />
        </div>
        <div className={styles.freshOptions}>
          <details className={styles.startSection}>
            <summary>Or start with a common job</summary>
            <div className={styles.jobGrid}>
              {JOBS.map((job) => <button key={job} type="button" onClick={() => begin(job)}>{job}</button>)}
            </div>
          </details>
          <details className={styles.explore}>
            <summary>Explore capabilities</summary>
            <CapabilityLinks />
          </details>
        </div>
      </section>
    );
  }

  const agentCanvas = state.canvases[AGENT_CANVAS.id];
  const flowCanvas = state.canvases[FLOW_CANVAS.id];
  const connected = state.acknowledgedCorrelationIds.includes("corr-flow-sample-01");
  const normalJourney = !["stale-resume", "external-fallback", "preparation-error", "context-error", "agent-unavailable"].includes(state.phase);

  return (
    <section className={styles.workstage} aria-labelledby="workstage-heading">
      <header className={styles.threadHeader}>
        <span className={styles.smallAvatar} aria-hidden="true"><SparklesIcon width={17} height={17} /></span>
        <div><p>Agent Workstage</p>{state.presentation.mode === "chat-only" ? <h1 id="workstage-heading">Qualify and route leads</h1> : <h2 id="workstage-heading">Qualify and route leads</h2>}</div>
      </header>
      <div ref={transcriptRef} className={styles.transcript} role="log" aria-live="off">
        <div className={styles.userMessage}><span>You</span><p>Help our sales team respond faster by qualifying high-value leads and routing them to the right owner.</p></div>
        {!agentCanvas && <div className={styles.agentMessage}><span>Agent</span><p>Before I prepare a draft, confirm where this work belongs.</p></div>}

        {normalJourney && !flowCanvas && (
          <article className={`${styles.planCard} ${agentCanvas ? styles.planCardReady : ""}`} aria-labelledby="working-plan-heading">
            <p className={styles.eyebrow}>{agentCanvas ? "Agent draft ready" : "Draft plan · No changes made"}</p>
            <h2 id="working-plan-heading">Qualify and route high-value leads</h2>
            {!agentCanvas && <>
              <ul>
                <li><CheckIcon width={15} height={15} aria-hidden="true" /> Check company fit and annual revenue</li>
                <li><CheckIcon width={15} height={15} aria-hidden="true" /> Ask when evidence is missing</li>
                <li><CheckIcon width={15} height={15} aria-hidden="true" /> Route qualified leads to Enterprise Queue</li>
              </ul>
              <fieldset className={styles.contextDecision}>
                <legend>Target context</legend>
                <p>{state.context ? state.context.label : "Project and org"}</p>
                <button
                  type="button"
                  aria-pressed={Boolean(state.context)}
                  onClick={() => {
                    setActiveProject("trailblazer-crm");
                    setActiveWorktree("lead-routing", "trailblazer-crm");
                    dispatch({ type: "CONFIRM_CONTEXT", projectRef: "trailblazer-crm", orgRef: "uat", label: "Trailblazer CRM · UAT" });
                  }}
                >
                  {state.context ? "Trailblazer CRM · UAT confirmed" : "Confirm Trailblazer CRM · UAT"}
                </button>
              </fieldset>
            </>}
            <button
              key="prepare-agent"
              type="button"
              className={styles.primaryAction}
              data-canvas-invoker={AGENT_CANVAS.id}
              disabled={!agentCanvas && !state.context}
              onClick={() => {
                if (!agentCanvas) dispatch({ type: "CAPABILITY_READY", canvas: AGENT_CANVAS, ready: AGENT_READY, autoOpen: true });
                else document.getElementById(`canvas-heading-${AGENT_CANVAS.id}`)?.focus();
              }}
            >
              {agentCanvas ? "Review Agent Studio draft" : "Prepare Agent Studio draft"}
            </button>
          </article>
        )}

        {agentCanvas && activeCanvas?.id !== agentCanvas.id && (
          <WorkObjectCard
            canvas={agentCanvas}
            active={activeCanvas?.id === agentCanvas.id}
            closed={agentCanvas.lifecycle === "closed"}
            onOpen={() => openCanvas(agentCanvas.id)}
            onRefine={() => { setNote("Agent draft kept in conversation for refinement."); composerRef.current?.focus(); }}
          />
        )}

        {flowCanvas && (
          <div className={styles.suggestionGroup}>
            {activeCanvas?.id !== flowCanvas.id && <div className={styles.agentMessage}><span>Agent</span><p>The routing Flow is ready to review. Open it when you’re ready.</p></div>}
            {activeCanvas?.id !== flowCanvas.id && <WorkObjectCard
              canvas={flowCanvas}
              active={activeCanvas?.id === flowCanvas.id}
              closed={flowCanvas.lifecycle === "closed"}
              onOpen={() => openCanvas(flowCanvas.id)}
              onRefine={() => { setNote("We’ll keep discussing the routing here."); composerRef.current?.focus(); }}
            />}
          </div>
        )}

        {state.phase === "flow-pending" && <StatusCard tone="pending" title="Checking sample…">Waiting for Build to acknowledge the result.</StatusCard>}
        {connected && <StatusCard tone="success" title="Sample result acknowledged">Edge Communications took the Yes path to Enterprise Queue. Sample only · nothing was saved or run.</StatusCard>}
        {state.phase === "closed" && <StatusCard tone="neutral" title="Canvas closed">Your conversation and drafts are still here.</StatusCard>}
        {state.phase === "preparation-error" && <RecoveryCard title="Agent Studio could not prepare the draft" detail="The conversation is intact and no empty canvas opened." />}
        {state.phase === "context-error" && <RecoveryCard title="Confirm the target context" detail="Trailblazer CRM · UAT and Acme Storefront · SIT are different contexts. Choose or change context before launch." />}
        {state.phase === "stale-resume" && <StaleResume />}
        {state.phase === "external-fallback" && <ExternalFallback />}
        {state.phase === "agent-unavailable" && <AgentUnavailable />}
        {note && <p className={styles.inlineNote} role="status">{note}</p>}
      </div>
      <div className={styles.composerArea}>
        <Composer draft={draft} setDraft={setDraft} onSubmit={() => { setNote("Direction captured in this prototype conversation."); setDraft(""); }} inputRef={composerRef} />
        <p>Prototype · sample data · nothing is saved or run.</p>
      </div>
    </section>
  );
}

function Composer({ draft, setDraft, onSubmit, inputRef, large = false }: { draft: string; setDraft: (value: string) => void; onSubmit: () => void; inputRef: React.RefObject<HTMLTextAreaElement | null>; large?: boolean }) {
  return (
    <form className={`${styles.composer} ${large ? styles.composerLarge : ""}`} onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className={styles.srOnly} htmlFor={large ? "fresh-composer" : "agent-composer"}>Message the agent</label>
      <textarea id={large ? "fresh-composer" : "agent-composer"} ref={inputRef} rows={large ? 3 : 2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={large ? "For example, help our sales team respond faster…" : "What would you like to do next?"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} />
      {large && <div className={styles.contextTools}><button type="button">+ Add project context</button><button type="button">Attach</button></div>}
      <button type="submit" className={styles.send} disabled={!draft.trim()} aria-label="Send message"><SendIcon width={18} height={18} /></button>
    </form>
  );
}

function ReturningHome() {
  const { dispatch } = useControlPlane();
  const { setActiveProject, setActiveWorktree } = useWorkspace();
  const attention = RESUME_FIXTURES.filter((item) => item.kind === "attention").slice(0, 3);
  const recent = [...RESUME_FIXTURES].filter((item) => item.kind === "recent").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  function resume(id: string) {
    const record = RESUME_FIXTURES.find((item) => item.id === id);
    if (record?.resumeState === "stale") dispatch({ type: "SHOW_SCENARIO", phase: "stale-resume" });
    else {
      const canvas = record?.canvasId === FLOW_CANVAS.id ? FLOW_CANVAS : AGENT_CANVAS;
      if (!record) return;
      setActiveProject(record.projectRef);
      setActiveWorktree(record.worktreeRef, record.projectRef);
      dispatch({
        type: "RESUME_EXACT",
        canvas,
        resumeRef: record.resumeRef,
        context: { projectRef: record.projectRef, orgRef: record.orgRef, label: record.context },
      });
      requestAnimationFrame(() => document.getElementById(`canvas-heading-${canvas.id}`)?.focus());
    }
  }
  return (
    <section className={`${styles.workstage} ${styles.returning}`} aria-labelledby="returning-heading">
      <div className={styles.returningLead}><h1 id="returning-heading">What needs to move forward?</h1><button type="button" onClick={() => dispatch({ type: "START_NEW" })}>Describe a new outcome <span>↑</span></button></div>
      <HomeList title="Needs you" records={attention} onResume={resume} />
      <div className={styles.returningColumns}>
        <HomeList title="Recent work" records={recent} onResume={resume} />
        <section className={styles.homeSection} aria-labelledby="projects-heading"><h2 id="projects-heading">Projects</h2><ul>{RETURNING_PROJECTS.slice(0, 3).map((project) => <li key={project.id}><div><strong>{project.name}</strong><span>{project.detail}</span></div><button type="button">Open</button></li>)}</ul><Link href="/?fixture=returning">Browse all projects</Link></section>
      </div>
      <details className={styles.explore}><summary>Explore capabilities</summary><CapabilityLinks /></details>
    </section>
  );
}

function HomeList({ title, records, onResume }: { title: string; records: typeof RESUME_FIXTURES; onResume: (id: string) => void }) {
  const id = title.toLowerCase().replaceAll(" ", "-");
  return <section className={styles.homeSection} aria-labelledby={`${id}-heading`}><h2 id={`${id}-heading`}>{title}</h2><ul>{records.map((record) => <li key={record.id}><div><strong>{record.title}</strong><span>{record.status} · {record.context}</span><small>{record.owner}</small></div><button type="button" onClick={() => onResume(record.id)}>Resume</button></li>)}</ul></section>;
}

function CapabilityLinks() {
  const { dispatch } = useControlPlane();
  return <div className={styles.capabilityLinks}><Link href="/build">Build & Setup</Link><Link href="/code">Code</Link><Link href="/govern">Govern & Observe</Link><Link href="/alm">ALM</Link><button type="button" onClick={() => dispatch({ type: "SHOW_SCENARIO", phase: "external-fallback" })}>External fallback</button><button type="button" onClick={() => dispatch({ type: "SHOW_SCENARIO", phase: "preparation-error" })}>Preparation failure</button><button type="button" onClick={() => dispatch({ type: "SHOW_SCENARIO", phase: "context-error" })}>Context recovery</button><button type="button" onClick={() => dispatch({ type: "SHOW_SCENARIO", phase: "agent-unavailable" })}>Agent unavailable</button></div>;
}
function StatusCard({ tone, title, children }: { tone: "pending" | "success" | "neutral"; title: string; children: React.ReactNode }) { return <article className={`${styles.statusCard} ${styles[tone]}`}><p>{tone === "success" ? "Result" : "Capability activity"}</p><h2>{title}</h2><div>{children}</div></article>; }
function RecoveryCard({ title, detail }: { title: string; detail: string }) { const { dispatch } = useControlPlane(); return <article className={styles.errorCard} role="alert"><h2>{title}</h2><p>{detail}</p><div><button type="button" onClick={() => dispatch({ type: "BEGIN_WORK" })}>Retry preparation</button><Link href="/build">Open directly</Link></div></article>; }
function StaleResume() { const { dispatch } = useControlPlane(); return <article className={styles.errorCard}><p>Resume reference expired</p><h2>Release validation recovery is no longer at this revision</h2><p>Nothing was substituted. Choose how to continue.</p><div><button type="button" onClick={() => dispatch({ type: "SHOW_SCENARIO", phase: "external-fallback" })}>Open latest</button><button type="button" onClick={() => dispatch({ type: "START_NEW" })}>Start new</button><Link href="/alm">Open directly</Link></div></article>; }
function ExternalFallback() { return <article className={styles.externalCard}><p>ALM · External capability</p><h2>Release validation recovery</h2><p>This capability does not advertise embedded presentation. Continue in ALM and return here when ready.</p><Link href="/alm">Open ALM directly <ChevronRightIcon width={15} height={15} /></Link><span>Conversation return point preserved · no fake embedded canvas</span></article>; }
function AgentUnavailable() { return <article className={styles.errorCard} role="alert"><p>Agent temporarily unavailable</p><h2>Your deterministic paths still work</h2><p>No conversation or work was lost. Use Work, Projects, capabilities, or the command palette.</p><div><Link href="/build">Build & Setup</Link><Link href="/code">Code</Link><Link href="/govern">Govern & Observe</Link><Link href="/alm">ALM</Link></div></article>; }
