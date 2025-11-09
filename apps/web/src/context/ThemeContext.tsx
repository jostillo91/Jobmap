"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  // Resolve theme based on current setting
  const resolveTheme = (currentTheme: Theme): "light" | "dark" => {
    if (currentTheme === "system") {
      return getSystemTheme();
    }
    return currentTheme;
  };

  // Apply theme to document
  const applyTheme = (newTheme: "light" | "dark") => {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setResolvedTheme(newTheme);
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const initialTheme = stored || "system";
    setThemeState(initialTheme);
    const resolved = resolveTheme(initialTheme);
    applyTheme(resolved);
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = resolveTheme("system");
      applyTheme(resolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    const resolved = resolveTheme(newTheme);
    applyTheme(resolved);
  };

  const toggleTheme = () => {
    if (!mounted) {
      // If not mounted yet, default to dark (since default is light)
      setTheme("dark");
      return;
    }
    const currentResolved = resolvedTheme;
    setTheme(currentResolved === "light" ? "dark" : "light");
  };

  // Always provide context, but use safe defaults before mounting
  const contextValue: ThemeContextType = {
    theme,
    resolvedTheme: mounted ? resolvedTheme : "light",
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
