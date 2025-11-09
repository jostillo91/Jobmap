"use client";

import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
      title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
      aria-pressed={resolvedTheme === "dark"}
    >
      {resolvedTheme === "light" ? (
        <span className="text-xl" aria-hidden="true">🌙</span>
      ) : (
        <span className="text-xl" aria-hidden="true">☀️</span>
      )}
    </button>
  );
}



