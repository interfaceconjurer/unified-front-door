"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { CloseIcon, SendIcon, SparklesIcon } from "@/components/icons";
import styles from "./AgentDrawer.module.css";

type DrawerMessage = {
  id: number;
  role: "agent" | "user";
  text: string;
};

type AgentDrawerProps = {
  open: boolean;
  contextLabel: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
};

const initialMessages: DrawerMessage[] = [
  {
    id: 1,
    role: "agent",
    text: "I’m available across every app. Ask me about the work here, or ask me to help you move to another workspace.",
  },
];

export function AgentDrawer({
  open,
  contextLabel,
  composerRef,
  onClose,
}: AgentDrawerProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text },
      {
        id: Date.now() + 1,
        role: "agent",
        text: `This is a prototype response scoped to ${contextLabel}. In the complete experience, I would keep this context while helping you cross into another app.`,
      },
    ]);
    setDraft("");
  }

  return (
    <aside
      id="global-agent-panel"
      className={styles.drawer}
      data-open={open || undefined}
      aria-hidden={!open}
      aria-label="Agent panel"
      inert={!open ? true : undefined}
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              <SparklesIcon width={18} height={18} />
            </span>
            <div>
              <div className={styles.title}>Agent</div>
              <div className={styles.context}>Working in {contextLabel}</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close agent panel"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className={styles.transcript} role="log" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${styles[message.role]}`}
            >
              <div className={styles.bubble}>{message.text}</div>
            </div>
          ))}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className={styles.srOnly} htmlFor="drawer-agent-composer">
            Message the agent
          </label>
          <textarea
            ref={composerRef}
            id="drawer-agent-composer"
            className={styles.input}
            rows={2}
            value={draft}
            placeholder={`Ask about ${contextLabel}…`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button
            type="submit"
            className={styles.send}
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <SendIcon width={18} height={18} />
          </button>
        </form>
      </div>
    </aside>
  );
}
