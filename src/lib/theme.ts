export const THEME_STORAGE_KEY = "clara-theme";

export type ClaraTheme = "light" | "dark";

/**
 * Roda no `<head>` antes da primeira pintura.
 * Sem preferência salva, segue `prefers-color-scheme`.
 */
export const THEME_BOOT_SCRIPT = `(()=>{try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.classList.toggle("light",!d);r.style.colorScheme=d?"dark":"light"}catch(e){}})();`;

export function systemTheme(): ClaraTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Preferência salva, ou o tema do sistema quando ainda não há escolha. */
export function readClaraTheme(): ClaraTheme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemTheme();
}

export function applyClaraTheme(theme: ClaraTheme) {
  const dark = theme === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function subscribeClaraTheme(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) onStoreChange();
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStorage);
  window.addEventListener("clara-preferences", onStoreChange);
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("clara-preferences", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}
