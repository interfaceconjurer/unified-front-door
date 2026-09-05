"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AgentDrawer } from "@/components/chat/AgentDrawer";
import { surfaceAppForPath } from "@/components/front-door/app-catalog";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * Path B's shared chrome. The top bar is the persistent glue across otherwise
 * independent apps; the agent is embedded on the front door and available as
 * an on-demand left panel everywhere else.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentApp = surfaceAppForPath(pathname);
  const isFrontDoor = pathname === "/";
  const [agentPanel, setAgentPanel] = useState({ pathname, open: false });
  const agentOpen = agentPanel.pathname === pathname && agentPanel.open;
  const agentButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (agentOpen) {
      composerRef.current?.focus();
    } else if (wasOpen.current) {
      agentButtonRef.current?.focus();
    }
    wasOpen.current = agentOpen;
  }, [agentOpen]);

  useEffect(() => {
    if (!agentOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAgentPanel({ pathname, open: false });
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [agentOpen, pathname]);

  function handleAgentToggle() {
    if (isFrontDoor) {
      document.querySelector<HTMLTextAreaElement>("#front-door-composer")?.focus();
      return;
    }
    setAgentPanel((current) => ({
      pathname,
      open: current.pathname === pathname ? !current.open : true,
    }));
  }

  return (
    <div className={styles.shell}>
      <TopBar
        currentApp={currentApp}
        isFrontDoor={isFrontDoor}
        agentOpen={agentOpen}
        agentButtonRef={agentButtonRef}
        onToggleAgent={handleAgentToggle}
      />
      <div className={styles.body} data-agent-open={agentOpen || undefined}>
        {!isFrontDoor && (
          <AgentDrawer
            open={agentOpen}
            contextLabel={currentApp?.label ?? "Front Door"}
            composerRef={composerRef}
            onClose={() => setAgentPanel({ pathname, open: false })}
          />
        )}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
