"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

/**
 * App-wide branded loading spinner ("Comet Ring" motion) — a dark rounded
 * box with a blue spinning ring + glow, and a white brand icon that
 * counter-rotates slowly inside. The box has a solid dark fill so it reads
 * consistently on any page background, light or dark.
 */
export function BrandLoader({
  label,
  icon: Icon = Sparkles,
}: {
  label?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-20 animate-fade-in-up">
      <div
        className="h-12 w-12 rounded-2xl flex items-center justify-center animate-spin"
        style={{
          background: "#12152c",
          border: "3px solid rgba(59,130,246,0.22)",
          borderTopColor: "#3b82f6",
          boxShadow: "0 0 16px -2px rgba(59,130,246,0.5)",
        }}
      >
        <Icon
          className="h-5 w-5 text-white"
          style={{ animation: "spin 1s linear infinite reverse" }}
        />
      </div>
      {label && <p className="text-sm font-medium text-slate-400">{label}</p>}
    </div>
  );
}
