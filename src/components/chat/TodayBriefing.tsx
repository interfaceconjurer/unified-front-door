"use client";

import { useState, type ComponentProps } from "react";
import { SparklesIcon } from "@/components/icons";
import { FrontDoor } from "@/components/front-door/FrontDoor";
import styles from "./AgentPanel.module.css";

export function TodayBriefing(props: ComponentProps<typeof FrontDoor>) {
  const { snapshot, active } = props;
  // An entry's initial reveal can finish while its styling fades into history.
  // Restored snapshots never replay that entrance animation.
  const [reveal] = useState(active);

  return <article className={styles.todaySection} data-front-door-active={active} data-front-door-reveal={reveal} aria-label="Today briefing">
    <header className={styles.todayHeader} data-front-door-row="0">
      <span><SparklesIcon width={15} height={15} aria-hidden="true" /><strong>Today</strong></span>
      <time dateTime={snapshot.capturedAt} title={new Date(snapshot.capturedAt).toLocaleString()}>
        {new Date(snapshot.capturedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        {" · "}{new Date(snapshot.capturedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </time>
    </header>
    <FrontDoor {...props} />
  </article>;
}
