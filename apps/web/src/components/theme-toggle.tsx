"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="panel flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[var(--foreground)] transition hover:-translate-y-0.5"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle color theme"
    >
      {isDark ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
    </button>
  );
}

