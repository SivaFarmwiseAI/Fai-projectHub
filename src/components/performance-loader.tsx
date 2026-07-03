"use client";

import { Award, Loader2 } from "lucide-react";

/**
 * Shared branded loading state for every Performance Assessment view
 * (My Assessment, My Reviews, My Team, Analysis, Cycles, Org Tree) so the
 * loading experience is consistent across the whole feature.
 */
export function PerfLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="w-full flex items-center justify-center py-24 animate-fade-in-up">
      <div className="flex flex-col items-center gap-5">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
        >
          <Award className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {label}
        </div>
      </div>
    </div>
  );
}
