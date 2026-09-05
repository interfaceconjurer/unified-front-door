"use client";

import { usePathname } from "next/navigation";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { surfaceAppForPath } from "@/components/front-door/app-catalog";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * The shared chrome. The agent is the constant: a persistent left panel that
 * never unmounts, so it's the same agent everywhere and its context follows you.
 * The top bar and the right half are what change — the app launcher on the front
 * door, a purpose-built surface everywhere else.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentApp = surfaceAppForPath(pathname);

  return (
    <div className={styles.shell}>
      <TopBar currentApp={currentApp} />
      <div className={styles.body}>
        <AgentPanel />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
