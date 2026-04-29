"use client";

import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";
const KEY = "ph_theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  /* Read from localStorage + apply class on mount */
  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "light";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Listen for Ctrl+D keyboard shortcut event dispatched by KeyboardShortcutsOverlay
  useEffect(() => {
    const handler = () => toggle();
    window.addEventListener("ph:toggle-theme", handler);
    return () => window.removeEventListener("ph:toggle-theme", handler);
  }, [toggle]);

  return { theme, toggle, isDark: theme === "dark" };
}
