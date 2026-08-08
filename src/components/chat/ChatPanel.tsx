"use client";

import { useEffect, useRef, useState } from "react";
import { SparklesIcon, SendIcon } from "@/components/icons";
import { useCanvas } from "@/components/canvas/canvas-context";
import {
  scopeKeyFor,
  scopeMetaFor,
  seedMessagesFor,
  type ChatMessage,
} from "./chat-scopes";
import styles from "./ChatPanel.module.css";

// New messages sent in-session get ids from here — well above the seed ids
// (1..n per scope) so a scope's live history never collides on React keys.
const SENT_ID_BASE = 1000;

// How long the panel shows its "reconnecting" beat when the scope changes, so a
// switch reads as the agent session reloading into the new context.
const RELOAD_MS = 480;

type ChatComposerProps = {
  label: string;
  reloading: boolean;
  onSend: (text: string) => void;
};

function ChatComposer({ label, reloading, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className={styles.composer}>
      <textarea
        className={styles.input}
        rows={1}
        placeholder={reloading ? "Loading session…" : `Message the agent about ${label}…`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        disabled={reloading}
      />
      <button
        type="button"
        className={styles.send}
        onClick={send}
        disabled={reloading || !draft.trim()}
        aria-label="Send message"
      >
        <SendIcon width={18} height={18} />
      </button>
    </div>
  );
}

/**
 * Agentic chat panel — bound to whatever the workspace is currently scoped to.
 *
 * The panel is mounted once for the whole shell, so it persists across tab
 * switches. It reads the active canvas from the canvas context and derives a
 * scope key (`"global"` for any non-project canvas, `"project:<id>"` for a
 * project); each scope has its own conversation. Crossing a scope boundary
 * (global↔project, or project↔project) reloads the panel into that scope's
 * session; switching back restores its history. Interaction is stubbed — sending
 * appends the message and a canned, scope-aware reply — the panel is deliberately
 * not wired to a model yet.
 */
export function ChatPanel() {
  const { canvases, activeId, liveAgentScopes } = useCanvas();
  const active = canvases.find((c) => c.id === activeId) ?? null;
  const scopeKey = scopeKeyFor(activeId);
  const isProjectScope = scopeKey !== "global";
  const meta = scopeMetaFor(scopeKey, active?.title, active?.blurb);

  // Is this scope's agent session live yet? The global session is always up; a
  // project's goes live when its workspace finishes provisioning the "Launching
  // agent session" step. This is what syncs the reveal to that checkmark.
  const sessionLive = scopeKey === "global" || liveAgentScopes.has(scopeKey);

  // Live transcript per scope, seeded lazily from the scope's session. Keeping
  // every scope's history here (rather than one array) is what lets a revisit
  // pick up where it left off.
  const [historyByScope, setHistoryByScope] = useState<Record<string, ChatMessage[]>>({});
  const seedMessages = seedMessagesFor(scopeKey, active?.title);
  const messages = historyByScope[scopeKey] ?? seedMessages;

  const nextId = useRef(SENT_ID_BASE);

  // Reload beat: a scope change starts a minimum "reconnecting" window (a timer
  // flips beatDone), and the panel stays in that state until both the beat has
  // elapsed and the target scope's session is live. `reloading` is derived from
  // those, not synced — so for a project opening fresh, the session's liveness
  // is the gate: the thread reveals the instant its provisioner lands the
  // "Launching agent session" step, not before; an already-live scope just
  // shows the short beat. Guarded on a ref so the window opens on change only —
  // not on first mount, where the session is already up.
  const [beatDone, setBeatDone] = useState(true);
  const prevScope = useRef(scopeKey);
  useEffect(() => {
    if (prevScope.current === scopeKey) return;
    prevScope.current = scopeKey;
    setBeatDone(false);
    const t = setTimeout(() => setBeatDone(true), RELOAD_MS);
    return () => clearTimeout(t);
  }, [scopeKey]);
  const reloading = !beatDone || !sessionLive;

  const send = (text: string) => {
    const userMsg: ChatMessage = { id: nextId.current++, role: "user", text };
    const reply: ChatMessage = {
      id: nextId.current++,
      role: "agent",
      text: `This panel is a wireframe — I'm not wired to a model yet. (Scoped to ${meta.label}.)`,
    };
    setHistoryByScope((prev) => {
      const base = prev[scopeKey] ?? seedMessages;
      return { ...prev, [scopeKey]: [...base, userMsg, reply] };
    });
  };

  return (
    <aside className={styles.panel} aria-label="Agent chat">
      <div className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          <SparklesIcon width={18} height={18} />
        </span>
        <div className={styles.headerText}>
          <div className={styles.title}>Agent</div>
          <div className={styles.subtitle}>Prototype · not wired to a model</div>
        </div>
        <span className={styles.badge}>Wireframe</span>
      </div>

      <div className={styles.scope} data-scoped={isProjectScope || undefined}>
        <div className={styles.scopeHead}>
          <span className={styles.scopeDot} aria-hidden="true" />
          <span className={styles.scopeLabel}>Scoped to</span>
          <span className={styles.scopeValue}>{meta.label}</span>
        </div>
        <span className={styles.scopeBlurb}>{meta.blurb}</span>
      </div>

      <div className={styles.transcript} aria-busy={reloading || undefined}>
        {reloading ? (
          <div className={styles.reloading}>
            <span className={styles.reloadSpinner} aria-hidden="true" />
            <span className={styles.reloadText}>Loading {meta.label} session…</span>
          </div>
        ) : (
          // Keyed by scope so the thread remounts — and replays its fade-in — each
          // time the agent reloads into a new scope.
          <div key={scopeKey} className={styles.thread} role="log">
            {messages.map((m) =>
              m.role === "tool" ? (
                <div key={m.id} className={styles.tool}>
                  <span className={styles.toolLabel}>tool call</span>
                  <code className={styles.toolCode}>{m.text}</code>
                </div>
              ) : (
                <div key={m.id} className={`${styles.msg} ${styles[m.role]}`}>
                  <div className={styles.bubble}>{m.text}</div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ChatComposer key={scopeKey} label={meta.label} reloading={reloading} onSend={send} />
    </aside>
  );
}
