"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import { type ThemeMode, getStoredTheme, setStoredTheme } from "./themeStorage";

/**
 * De themakeuze is externe state: hij leeft in localStorage en in de `dark`
 * class op <html>, niet in React. Daarom leest hij via useSyncExternalStore
 * in plaats van via een effect dat state zet — dat laatste gaf een extra
 * render en dus een zichtbare flits van het verkeerde thema.
 *
 * De class zelf wordt al vóór de eerste verf gezet door het scriptje in
 * app/layout.tsx. Dit component houdt hem daarna alleen in sync.
 */

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Donker is de huisstijl; licht is de uitzondering die je zelf kiest. */
const DEFAULT_MODE: ThemeMode = "dark";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Een tweede tabblad dat het thema omzet hoort hier ook door te komen.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ThemeMode {
  return getStoredTheme() ?? DEFAULT_MODE;
}

function getServerSnapshot(): ThemeMode {
  return DEFAULT_MODE;
}

function applyMode(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  setStoredTheme(mode);
  for (const listener of listeners) listener();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((next: ThemeMode) => applyMode(next), []);
  const toggle = useCallback(
    () => applyMode(getSnapshot() === "dark" ? "light" : "dark"),
    [],
  );

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
