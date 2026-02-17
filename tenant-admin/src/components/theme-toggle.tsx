"use client";

import { useTheme } from "./theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800">
      <button
        onClick={() => setTheme("light")}
        className={`flex items-center justify-center rounded px-2 py-1.5 transition-colors ${
          theme === "light"
            ? "bg-teal-500 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        }`}
        title="Light mode"
        aria-label="Use light theme"
      >
        <Sun className="h-4 w-4" aria-hidden />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`flex items-center justify-center rounded px-2 py-1.5 transition-colors ${
          theme === "dark"
            ? "bg-teal-500 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        }`}
        title="Dark mode"
        aria-label="Use dark theme"
      >
        <Moon className="h-4 w-4" aria-hidden />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`flex items-center justify-center rounded px-2 py-1.5 transition-colors ${
          theme === "system"
            ? "bg-teal-500 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
        }`}
        title="System preference"
        aria-label="Use system theme"
      >
        <Monitor className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

