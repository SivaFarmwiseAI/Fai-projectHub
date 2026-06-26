"use client";

/**
 * "Cycles" — HR / leadership open and manage performance review cycles.
 * Only one cycle is "open" at a time (it's the one self-assessments attach to).
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Plus, Loader2, Play, Square, FileText } from "lucide-react";
import { performanceAssessments, type ReviewCycle } from "@/lib/api-client";
import { fmtDate } from "@/lib/performance";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  open: "text-emerald-700 bg-emerald-50 border-emerald-200",
  draft: "text-slate-600 bg-slate-100 border-slate-200",
  closed: "text-slate-500 bg-slate-50 border-slate-200",
};

export function PerformanceCycles() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    performanceAssessments.cycles().then((r) => setCycles(r.cycles || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    performanceAssessments.cycles().then((r) => { if (alive) setCycles(r.cycles || []); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy("create");
    try {
      await performanceAssessments.createCycle({ name: name.trim(), status: "draft", start_date: start || undefined, end_date: end || undefined });
      setName(""); setStart(""); setEnd(""); setCreating(false);
      load();
    } finally { setBusy(null); }
  };

  const setStatus = async (c: ReviewCycle, status: string) => {
    setBusy(c.id);
    try {
      // Only one open cycle at a time: close any other open cycle first.
      if (status === "open") {
        const other = cycles.find((x) => x.status === "open" && x.id !== c.id);
        if (other) await performanceAssessments.updateCycle(other.id, { status: "closed" });
      }
      await performanceAssessments.updateCycle(c.id, { status });
      load();
    } finally { setBusy(null); }
  };

  if (loading) {
    return <div className="space-y-3 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900">Review cycles</h3>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-3.5 py-2 text-xs font-semibold shadow-glow-blue">
            <Plus className="h-3.5 w-3.5" /> New cycle
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-2xl border p-4 shadow-card space-y-3 animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Label text="Cycle name" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. H1 2026 Review"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div><Label text="Start date" /><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
            <div><Label text="End date" /><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button onClick={create} disabled={!name.trim() || busy === "create"}
              className={cn("inline-flex items-center gap-1.5 rounded-xl text-white px-4 py-2 text-sm font-semibold", name.trim() ? "btn-gradient" : "bg-slate-300 cursor-not-allowed")}>
              {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      {cycles.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl border p-10 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-100"><CalendarRange className="h-6 w-6 text-blue-500" /></div>
          <h3 className="text-sm font-bold text-slate-900">No review cycles yet</h3>
          <p className="text-xs text-slate-500 mt-1">Create and open a cycle so the team can submit their assessments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border p-4 shadow-card flex items-center gap-4 animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", STATUS_STYLE[c.status] || STATUS_STYLE.draft)}>{c.status}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {c.start_date ? fmtDate(c.start_date) : "—"} → {c.end_date ? fmtDate(c.end_date) : "—"}
                  {c.created_by_name ? ` · opened by ${c.created_by_name}` : ""}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {c.self_count ?? 0} self</span>
                  <span>· {c.peer_count ?? 0} peer reviews</span>
                  {(c.peer_pending ?? 0) > 0 && <span className="text-amber-600 font-semibold">· {c.peer_pending} pending</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.status !== "open" && (
                  <button onClick={() => setStatus(c, "open")} disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100">
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Open
                  </button>
                )}
                {c.status === "open" && (
                  <button onClick={() => setStatus(c, "closed")} disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200">
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />} Close
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{text}</label>;
}
