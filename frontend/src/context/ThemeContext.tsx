import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemePreference } from "@/types";

const STORAGE_KEY = "fm-theme";
const ACCENT_KEY = "fm-accent";

/** Accent palettes defined in index.css (`[data-accent="…"]`). `swatch` is the 500 shade, for pickers. */
export const ACCENTS = [
  { value: "teal", label: "Teal", swatch: "#14a394" },
  { value: "orange", label: "Orange", swatch: "#f97316" },
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "forest", label: "Forest", swatch: "#2f8468" },
  { value: "rose", label: "Rose", swatch: "#f43f5e" },
] as const;

export type Accent = (typeof ACCENTS)[number]["value"];

interface ThemeState {
  theme: ThemePreference;
  resolved: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* ignore */
  }
  return "light";
}

function readAccent(): Accent {
  try {
    const value = localStorage.getItem(ACCENT_KEY);
    if (ACCENTS.some((a) => a.value === value)) return value as Accent;
  } catch {
    /* ignore */
  }
  return "teal";
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);
  const [prefersDark, setPrefersDark] = useState(systemDark);
  const [accent, setAccentState] = useState<Accent>(readAccent);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, accent, setAccent }),
    [theme, resolved, setTheme, accent, setAccent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
