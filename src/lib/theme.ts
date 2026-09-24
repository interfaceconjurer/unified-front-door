export type Theme = "light" | "dark";
const THEME_KEY = "ufd.appearance.v1";
const THEME_EVENT = "ufd-theme-change";

// Run before the first paint so a saved choice also themes the loading screen.
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;document.documentElement.style.setProperty('--app-color-scheme',t)}}catch{}`;

export function currentTheme(): Theme {
  const selected = document.documentElement.dataset.theme;
  return selected === "light" || selected === "dark" ? selected
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: string | null) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.setProperty("--app-color-scheme", theme);
  } else {
    delete root.dataset.theme;
    root.style.removeProperty("color-scheme");
    root.style.removeProperty("--app-color-scheme");
  }
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep the choice for this page if storage is blocked. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(listener: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    applyTheme(event.newValue);
    listener();
  };
  media.addEventListener("change", listener);
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", listener);
    window.removeEventListener(THEME_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const serverTheme = (): Theme => "light";
