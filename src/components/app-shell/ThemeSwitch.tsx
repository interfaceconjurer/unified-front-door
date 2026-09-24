"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { currentTheme, serverTheme, setTheme, subscribeTheme } from "@/lib/theme";
import styles from "./TopBar.module.css";

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, serverTheme);
  return (
    <button type="button" role="switch" aria-label="Dark mode" aria-checked={theme === "dark"}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className={styles.themeSwitch}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <SunIcon width={14} height={14} />
      <MoonIcon width={14} height={14} />
    </button>
  );
}
