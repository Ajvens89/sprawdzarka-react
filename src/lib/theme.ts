const THEME_STORAGE_KEY = "sprawdzarka-theme";

export type AppTheme = "light" | "dark";

export function getStoredTheme(): AppTheme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function initTheme(): AppTheme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
