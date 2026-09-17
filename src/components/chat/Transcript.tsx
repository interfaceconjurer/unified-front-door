"use client";
import { memo } from "react";
import { FrontDoor } from "@/components/front-door/FrontDoor";
import { SparklesIcon } from "@/components/icons";
import { activeRun, type RunView, type AgentCommand } from "@/lib/agent/contracts";
import type { Message, ConversationStore } from "@/lib/chat/conversation";
import type { ReturningWork } from "@/lib/workspace/returning-work";
import styles from "./AgentPanel.module.css";
import { StreamingText } from "./StreamingText";
type Props = {
  messages: Message[]; startIndex: number; total: number; sessionKey: string; isHome: boolean;
  presentation: ReturnType<ConversationStore["getSnapshot"]>["presentation"];
  runs: readonly RunView[]; suggestions: readonly string[];
  seedPrompt: (prompt: string) => void; resumeWork: (work: ReturningWork) => void;
  send: (text: string) => void; command: (command: AgentCommand) => void;
};
export const Transcript = memo(function Transcript({ messages, startIndex, total, sessionKey, isHome, presentation, runs, suggestions, seedPrompt, resumeWork, send, command }: Props) {
  return <>{messages.map((message, visibleIndex) => {
            const index = startIndex + visibleIndex;
            const run = message.role === "agent" && message.runId ? runs.find(run => run.id === message.runId) : null;
            const pending = presentation?.sessionKey === sessionKey && presentation.phase !== "revealing" && message.id > presentation.afterId;
            return <div aria-hidden={pending || undefined} inert={pending} data-pending={pending || undefined} key={`${sessionKey}:${message.id}`} className={styles.entry} data-message-id={message.id} data-kind={message.role}>
            {message.role === "today" ? <article className={styles.todaySection} aria-label="Today briefing">
              <header className={styles.todayHeader}>
                <span><SparklesIcon width={15} height={15} aria-hidden="true" /><strong>Today</strong></span>
                <time dateTime={message.snapshot.capturedAt} title={new Date(message.snapshot.capturedAt).toLocaleString()}>
                  {new Date(message.snapshot.capturedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}{new Date(message.snapshot.capturedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </time>
              </header>
              <FrontDoor snapshot={message.snapshot} active={isHome && index === total - 1} onSeedPrompt={seedPrompt} onOpenWork={resumeWork} />
            </article> : message.role === "context" ? <div className={styles.contextMarker}><span>{message.text}</span></div>
              : <div className={`${styles.message} ${styles[message.role]}`}><div className={styles.bubble}>{run ? <StreamingText key={`${run.id}:${run.turnId}`} text={message.text} active={activeRun(run.status)} /> : message.text}{run && <div className={styles.runStatus} data-run-id={run.id} data-run-status={run.status}>
                <span role="status">{run.status === "pending" ? "Waiting for agent…" : run.status === "running" ? "Preparing reply…" : run.status === "streaming" ? "Replying…" : run.status === "completed" ? "Completed" : run.status === "cancelled" ? "Cancelled" : "Could not complete"}</span>
                {run.execution?.provider === "anthropic" && <p>Anthropic · {run.execution.model} · reasoning from captured demo data</p>}
                {run.execution?.provider === "demo" && <p>Demo · simulated reply</p>}
                {!!((run.execution?.omittedFindings ?? 0) + (run.execution?.omittedHistoryMessages ?? 0)) && <p>Some older messages or findings were omitted to fit the request limit.</p>}
                {run.error && <p>{run.error.message}</p>}
                {run.error?.providerCost === "unknown" && run.error.code !== "model_outcome_unknown" && <p>This request may have been charged. Retrying creates a new paid request.</p>}
                {activeRun(run.status) && <button type="button" onClick={() => { void command({ kind: "cancel", requestId: crypto.randomUUID(), runId: run.id }); }}>Cancel reply</button>}
                {(run.status === "cancelled" || run.status === "failed" && run.error?.retryable) && run.error?.effects !== "unknown" && <button type="button" onClick={() => { void command({ kind: "retry", requestId: crypto.randomUUID(), runId: run.id }); }}>{run.error?.providerCost === "unknown" ? "Retry with a new paid request" : "Retry reply"}</button>}
              </div>}</div></div>}
            {index === total - 1 && message.role !== "today" && <>
              <div className={styles.suggestions} aria-label="Suggested prompts">
                {suggestions.map((prompt) => <button key={prompt} type="button" onClick={() => send(prompt)}>{prompt}</button>)}
              </div>
              <p className={styles.prototypeNote}>Replies use captured workspace data. Suggestions need human review; no changes are executed.</p>
            </>}
          </div>})}</>;
});
