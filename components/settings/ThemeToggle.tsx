"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle — Warm theme picker for the Settings page.
 *
 * Renders two side-by-side buttons with a preview swatch of each theme.
 * Persists the choice via next-themes (localStorage under the hood).
 *
 * The component waits for mount before rendering theme-dependent state
 * to avoid a hydration mismatch (server renders default, client swaps in
 * the persisted preference on mount).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme : "dark";

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={activeTheme === "light"}
        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
          activeTheme === "light"
            ? "border-primary bg-primary/5 shadow-[var(--shadow-soft)]"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div
          className="flex h-16 w-full items-center justify-center rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, #FFF8F2 0%, #FFF3E9 60%, #FFFFFF 100%)",
            border: "1px solid #F0E4D6",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full"
              style={{ background: "#F26E52" }}
            />
            <div
              className="h-6 w-6 rounded-full"
              style={{ background: "#F5A445" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-primary">Light</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={activeTheme === "dark"}
        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
          activeTheme === "dark"
            ? "border-primary bg-primary/5 shadow-[var(--shadow-soft)]"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div
          className="flex h-16 w-full items-center justify-center rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, #17141A 0%, #221E27 60%, #2A252F 100%)",
            border: "1px solid #382E36",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full"
              style={{ background: "#FF8B70" }}
            />
            <div
              className="h-6 w-6 rounded-full"
              style={{ background: "#FFB865" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-primary">Dark</span>
        </div>
      </button>
    </div>
  );
}
