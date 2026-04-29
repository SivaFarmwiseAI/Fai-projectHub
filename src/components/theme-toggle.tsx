"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { isDark, toggle } = useTheme();

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all"
      >
        {isDark
          ? <Sun  className="h-4 w-4 text-amber-300" />
          : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all group"
    >
      <div className="relative h-4 w-4 shrink-0">
        <Sun  className={cn("absolute inset-0 h-4 w-4 text-amber-300 transition-all duration-300", isDark ? "opacity-100 rotate-0" : "opacity-0 -rotate-90")} />
        <Moon className={cn("absolute inset-0 h-4 w-4 transition-all duration-300", isDark ? "opacity-0 rotate-90" : "opacity-100 rotate-0")} />
      </div>
      <span className="text-xs font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
      {/* Toggle pill */}
      <div className={cn(
        "ml-auto h-4 w-7 rounded-full transition-colors duration-300 flex items-center px-0.5",
        isDark ? "bg-amber-400" : "bg-slate-600"
      )}>
        <div className={cn(
          "h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-300",
          isDark ? "translate-x-3" : "translate-x-0"
        )} />
      </div>
    </button>
  );
}
