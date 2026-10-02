/**
 * Light/dark theme with persistence.
 *
 * The choice is stored in localStorage; on first visit the OS preference wins.
 */

const STORAGE_KEY = "theme";

/** Applies a theme to the document and syncs the toggle's accessible state. */
function apply(theme) {
  document.documentElement.dataset.theme = theme;

  const button = document.getElementById("theme-toggle");
  if (!button) return;

  const isDark = theme === "dark";
  button.setAttribute("aria-pressed", String(isDark));
  button.setAttribute("aria-label", isDark ? "Activer le theme jour" : "Activer le theme nuit");
}

/** Restores the stored theme and wires the toggle button. */
export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  apply(stored ?? (prefersDark ? "dark" : "light"));

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  });
}
