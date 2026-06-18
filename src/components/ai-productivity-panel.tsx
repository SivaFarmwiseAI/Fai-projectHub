"use client";

import { useState, useEffect } from "react";
import { Sparkles, Zap, Loader2, ArrowRight } from "lucide-react";
import { ai as aiApi } from "@/lib/api-client";

const sevColor: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#10b981",
};

type Item = { title: string; severity: string; description?: string; action_items: string[] };

/** Context-grounded AI productivity assessment for one team member.
 *  Loads the cached assessment on mount; the button regenerates it via Gemini. */
export function AiProductivityPanel({ userId }: { userId: string }) {
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    aiApi.getProductivity(userId)
      .then(r => setItems(r.insights.map(i => ({
        title: i.title, severity: i.severity, description: i.description, action_items: i.action_items || [],
      }))))
      .catch(() => {});
  }, [userId]);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await aiApi.assessProductivity(userId);
      setSummary(r.summary || "");
      setItems((r.people || []).map(p => ({
        title: p.name, severity: p.severity, description: p.assessment, action_items: p.action_items || [],
      })));
    } catch {
      // AI may be momentarily unavailable; leave existing content in place
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-card overflow-hidden" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#6366f108" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">AI Productivity Assessment</h2>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {loading ? "Analysing…" : items.length || summary ? "Refresh" : "Generate"}
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {summary && <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>}
        {items.map((it, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100">
            <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: sevColor[it.severity] ?? "#94a3b8" }} />
            <div className="flex-1 min-w-0">
              {it.description && <p className="text-sm text-slate-700">{it.description}</p>}
              {it.action_items?.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {it.action_items.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <ArrowRight className="h-3 w-3 shrink-0 text-indigo-400" />{a}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${sevColor[it.severity] ?? "#94a3b8"}18`, color: sevColor[it.severity] ?? "#94a3b8" }}>
              {it.severity}
            </span>
          </div>
        ))}
        {!summary && items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No AI assessment yet — click Generate to analyse this member&apos;s workload, throughput, reliability and morale.
          </p>
        )}
      </div>
    </div>
  );
}
