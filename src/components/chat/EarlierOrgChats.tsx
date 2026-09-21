"use client";

import { useState } from "react";
import type { SavedConversation } from "@/lib/agent/contracts";
import type { Org } from "@/lib/workspace/model";
import { FrontDoor } from "@/components/front-door/FrontDoor";
import styles from "./EarlierOrgChats.module.css";

/** Keep pre-continuity org threads available without rewriting their runs or receipts. */
export function EarlierOrgChats({ conversations, orgs }: { conversations: SavedConversation[]; orgs: readonly Org[] }) {
  const earlier = conversations.flatMap(saved => {
    try {
      const key: unknown = JSON.parse(saved.threadKey);
      return Array.isArray(key) && key.length === 2 && key[0] === "unbound-session" && typeof key[1] === "string" && saved.conversation.messages.length
        ? [{ saved, label: orgs.find(org => org.id === key[1])?.label ?? key[1] }] : [];
    } catch { return []; }
  });
  if (!earlier.length) return null;
  return <aside className={styles.archive} aria-label="Earlier org conversations">
    {earlier.map(({ saved, label }) => <EarlierChat key={saved.id} saved={saved} label={label} />)}
  </aside>;
}

function EarlierChat({ saved, label }: { saved: SavedConversation; label: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Earlier conversation · {label}</summary>
    {open && <div className={styles.messages}>
      {saved.conversation.messages.map(message => <div key={message.id}>
        {message.role === "today" ? <FrontDoor snapshot={message.snapshot} active={false} onStart={() => {}} onOpenWork={() => {}} /> : <>
          <strong>{message.role === "user" ? "You" : message.role === "agent" ? "Agent" : "Context"}</strong>
          <p>{message.text}</p>
        </>}
      </div>)}
    </div>}
  </details>;
}
