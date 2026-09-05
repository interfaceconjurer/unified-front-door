"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, LayersIcon, SearchIcon, type IconComponent } from "@/components/icons";
import { surfaceApps } from "@/components/front-door/app-catalog";
import { useWorkspace } from "@/components/workspace/workspace-context";
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

type Tab = "surfaces" | "projects";

const TAB_ORDER: readonly Tab[] = ["surfaces", "projects"];
const TAB_LABEL: Record<Tab, string> = { surfaces: "Surfaces", projects: "Projects" };

// A row in the results list, normalized across tabs so keyboard nav and
// rendering don't need to branch on what kind of thing is selected. Surfaces
// navigate; projects re-project the current surface in place.
type PaletteItem = {
  id: string;
  label: string;
  description: string;
  Icon: IconComponent;
  isCurrent: boolean;
  select: () => void;
};

/**
 * A Spotlight/Raycast-style command palette for switching what you're looking
 * at. Opened with ⌘⇧P (the shell owns the shortcut and only mounts this while
 * open, so its state starts fresh each time), it overlays a search box over
 * the whole app. Two tabs: Surfaces (the purpose-built destinations — picking
 * one navigates) and Projects (the shell-level workspace noun — picking one
 * calls `setActiveProject` and re-projects the current surface instead of
 * navigating). Type to filter within the active tab, ↑/↓ to move, ←/→ to
 * switch tabs, ↵ to select, esc to dismiss.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, setActiveProject } = useWorkspace();
  const [tab, setTab] = useState<Tab>("surfaces");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (label: string, description: string) =>
      !q || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

    if (tab === "surfaces") {
      return DESTINATIONS.filter((d) => matchesQuery(d.label, d.description)).map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        Icon: d.Icon,
        isCurrent: d.href === pathname,
        select: () => {
          onClose();
          if (d.href !== pathname) router.push(d.href);
        },
      }));
    }

    return projects
      .filter((p) => matchesQuery(p.name, p.description))
      .map((p) => ({
        id: p.id,
        label: p.name,
        description: p.description,
        Icon: LayersIcon,
        isCurrent: p.id === activeProject.id,
        // Project is shell-level, not a route — switch it in place and stay put.
        select: () => {
          setActiveProject(p.id);
          onClose();
        },
      }));
  }, [tab, query, pathname, projects, activeProject.id, router, onClose, setActiveProject]);

  // Derived, not stored: `active` can point past the end after filtering or a
  // tab switch, so we clamp it here rather than correcting state in an effect.
  const safeActive = items.length ? Math.min(active, items.length - 1) : 0;

  function switchTab(next: Tab) {
    setTab(next);
    setActive(0);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(items.length ? (safeActive + 1) % items.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(items.length ? (safeActive - 1 + items.length) % items.length : 0);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Horizontal caret movement isn't meaningful in a single-line filter, so
      // ←/→ switch tabs instead — but only when there's actually a tab to move
      // to, so a stray ArrowLeft/Right at the edge doesn't eat the keystroke.
      const currentIndex = TAB_ORDER.indexOf(tab);
      const nextIndex = event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab) {
        event.preventDefault();
        switchTab(nextTab);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[safeActive]?.select();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const placeholder = tab === "surfaces" ? "Search surfaces…" : "Search projects…";

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
        aria-label="Switch surfaces or projects"
      >
        <div className={styles.tabs} role="tablist" aria-label="Palette section">
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              className={`${styles.tab} ${t === tab ? styles.tabActive : ""}`}
              // Prevent the mousedown from moving DOM focus onto this button —
              // the ↑/↓/↵/←/→ handler lives on the search input, so a mouse
              // click on a tab would otherwise strand focus here and kill
              // keyboard nav until the user clicks back into the input.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => switchTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div className={styles.searchRow}>
          <SearchIcon className={styles.searchIcon} width={18} height={18} />
          <input
            // The palette exists only to receive typing; focus it on mount.
            autoFocus
            className={styles.input}
            type="text"
            placeholder={placeholder}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={items[safeActive] ? `cmd-${tab}-${items[safeActive].id}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        <ul className={styles.results} id="command-palette-results" role="listbox">
          {items.length === 0 && (
            <li className={styles.empty}>
              No {tab} match “{query}”.
            </li>
          )}
          {items.map((item, index) => {
            const isActive = index === safeActive;
            return (
              <li key={item.id} role="option" id={`cmd-${tab}-${item.id}`} aria-selected={isActive}>
                <button
                  type="button"
                  className={`${styles.result} ${isActive ? styles.resultActive : ""}`}
                  onMouseMove={() => setActive(index)}
                  onClick={() => item.select()}
                >
                  <span className={styles.resultIcon} aria-hidden="true">
                    <item.Icon width={18} height={18} />
                  </span>
                  <span className={styles.resultCopy}>
                    <span className={styles.resultLabel}>{item.label}</span>
                    <span className={styles.resultDescription}>{item.description}</span>
                  </span>
                  {item.isCurrent ? (
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
            <kbd>←</kbd>
            <kbd>→</kbd> switch tabs
          </span>
          <span>
            <kbd>↵</kbd> {tab === "surfaces" ? "open" : "switch"}
          </span>
          <span>
            <kbd>esc</kbd> dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
