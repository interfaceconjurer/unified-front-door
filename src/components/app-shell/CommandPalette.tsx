"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, type IconComponent } from "@/components/icons";
import { surfaceApps } from "@/components/front-door/app-catalog";
import styles from "./CommandPalette.module.css";

type Destination = {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: IconComponent;
};

// The front door plus every surface, as jump targets. This is the same set the
// old top-bar <select> offered, now reachable from a Spotlight-style palette.
const DESTINATIONS: readonly Destination[] = [
  {
    id: "home",
    label: "Front Door",
    description: "Start from an outcome and let the agent route you.",
    href: "/",
    Icon: HomeIcon,
  },
  ...surfaceApps.map((surface) => ({
    id: surface.id,
    label: surface.label,
    description: surface.description,
    href: surface.href,
    Icon: surface.Icon,
  })),
];

/**
 * A Spotlight/Raycast-style command palette for surface navigation. Opened with
 * ⌘⇧P (the shell owns the shortcut and only mounts this while open, so its state
 * starts fresh each time), it overlays a search box over the whole app: type to
 * filter destinations, ↑/↓ to move, ↵ to go, esc to dismiss. It replaces the
 * top-bar app switcher as the primary way to move between the front door and the
 * surfaces without returning home first.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q),
    );
  }, [query]);

  // Derived, not stored: `active` can point past the end after filtering, so we
  // clamp it here rather than correcting state in an effect.
  const safeActive = results.length ? Math.min(active, results.length - 1) : 0;

  function go(destination: Destination | undefined) {
    if (!destination) return;
    onClose();
    if (destination.href !== pathname) router.push(destination.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(results.length ? (safeActive + 1) % results.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(results.length ? (safeActive - 1 + results.length) % results.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[safeActive]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        // Dismiss only on backdrop clicks, not clicks that start inside the panel.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Go to a surface"
      >
        <div className={styles.searchRow}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            // The palette exists only to receive typing; focus it on mount.
            autoFocus
            className={styles.input}
            type="text"
            placeholder="Go to a surface…"
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={results[safeActive] ? `cmd-${results[safeActive].id}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        <ul className={styles.results} id="command-palette-results" role="listbox">
          {results.length === 0 && <li className={styles.empty}>No surfaces match “{query}”.</li>}
          {results.map((destination, index) => {
            const isActive = index === safeActive;
            const isCurrent = destination.href === pathname;
            return (
              <li key={destination.id} role="option" id={`cmd-${destination.id}`} aria-selected={isActive}>
                <button
                  type="button"
                  className={`${styles.result} ${isActive ? styles.resultActive : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(destination)}
                >
                  <span className={styles.resultIcon} aria-hidden="true">
                    <destination.Icon width={18} height={18} />
                  </span>
                  <span className={styles.resultCopy}>
                    <span className={styles.resultLabel}>{destination.label}</span>
                    <span className={styles.resultDescription}>{destination.description}</span>
                  </span>
                  {isCurrent ? (
                    <span className={styles.currentTag}>Current</span>
                  ) : (
                    isActive && <span className={styles.enterHint} aria-hidden="true">↵</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className={styles.footer}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
