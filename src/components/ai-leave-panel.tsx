"use client";

import { useState, useEffect } from "react";
import { Sparkles, Zap, Loader2, ArrowRight } from "lucide-react";
import { ai as aiApi } from "@/lib/api-client";

const sevColor: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#10b981",
};

type Item = { name: string; severity: string; description?: string; action_items: string[] };

/** Org-wide AI leave assessment: burnout / over-reliance and coverage-gap risk.
 *  Loads cached findings on mount; the button regenerates via Gemini. */
export function AiLeavePanel() {
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    aiApi.getLeaveInsights()
      .then(r => setItems(r.insights.map(i => ({
        name: i.user_name || i.title, severity: i.severity, description: i.description, action_items: i.action_items || [],
      }))))
      .catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await aiApi.assessLeave();
      setSummary(r.summary || "");
      setItems((r.findings || []).map(f => ({
        name: f.name, severity: f.severity, description: f.assessment, action_items: f.action_items || [],
      })));
    } catch {
      // AI may be momentarily unavailable
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-100 dark:border-violet-500/20 bg-violet-50/40 dark:bg-violet-500/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">AI Leave Assessment</h4>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          {loading ? "Analysing…" : items.length || summary ? "Refresh" : "Generate"}
        </button>
      </div>

      {summary && <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{summary}</p>}
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <div className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ background: sevColor[it.severity] ?? "#94a3b8" }} />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{it.name}: </span>
              <span className="text-slate-600 dark:text-slate-400">{it.description}</span>
              {it.action_items?.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {it.action_items.slice(0, 2).map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <ArrowRight className="h-2.5 w-2.5 shrink-0 text-violet-400" />{a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {!summary && items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No AI assessment yet — click Generate to analyse burnout and coverage risk.
          </p>
        )}
      </div>
    </div>
  );
}
