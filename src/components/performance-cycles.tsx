"use client";

/**
 * "Cycles" — HR / leadership open and manage performance review cycles.
 * Only one cycle is "open" at a time (it's the one self-assessments attach to).
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Plus, Loader2, Play, Square, FileText, RefreshCw, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { performanceAssessments, type ReviewCycle } from "@/lib/api-client";
import { fmtDate } from "@/lib/performance";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";

const STATUS_STYLE: Record<string, string> = {
  open: "text-emerald-700 bg-emerald-50 border-emerald-200",
  draft: "text-slate-600 bg-slate-100 border-slate-200",
  closed: "text-slate-500 bg-slate-50 border-slate-200",
};

export function PerformanceCycles() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState<ReviewCycle | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    performanceAssessments.cycles().then((r) => setCycles(r.cycles || [])).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    performanceAssessments.cycles().then((r) => { if (alive) setCycles(r.cycles || []); }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const resetForm = () => {
    setName(""); setStart(""); setEnd(""); setCreating(false); setEditingId(null);
  };

  const save = async () => {
    if (!name.trim() || !start || !end || end < start) return;
    setBusy("save");
    try {
      if (editingId) {
        await performanceAssessments.updateCycle(editingId, { name: name.trim(), start_date: start || undefined, end_date: end || undefined });
      } else {
        await performanceAssessments.createCycle({ name: name.trim(), status: "draft", start_date: start || undefined, end_date: end || undefined });
      }
      resetForm();
      load();
    } finally { setBusy(null); }
  };

  const startEdit = (c: ReviewCycle) => {
    setCreating(false);
    setEditingId(c.id);
    setName(c.name);
    setStart((c.start_date || "").slice(0, 10));
    setEnd((c.end_date || "").slice(0, 10));
  };

  const doDelete = async (c: ReviewCycle) => {
    setBusy(c.id);
    try {
      await performanceAssessments.deleteCycle(c.id);
      setDeletePending(null);
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
    return <PerfLoader label="Loading cycles…" />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border p-10 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-amber-100"><AlertTriangle className="h-6 w-6 text-amber-500" /></div>
        <h3 className="text-base font-bold text-slate-900">Couldn&apos;t load cycles</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">The service is unreachable — the backend may not be deployed yet, or your session expired.</p>
        <button onClick={() => { setLoading(true); load(); }} className="mt-5 inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2 text-sm font-semibold shadow-glow-blue">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  // Today (local) — used as the `min` so past dates can't be picked.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // End date must be on or after the start date (ISO strings sort correctly).
  const invalidRange = !!(start && end && end < start);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-bold text-slate-900">Review cycles</h3>
        </div>
        {!creating && !editingId && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2.5 text-sm font-semibold shadow-glow-blue">
            <Plus className="h-4 w-4" /> New cycle
          </button>
        )}
      </div>

      {(creating || editingId) && (
        <div className="bg-white rounded-2xl border p-4 shadow-card space-y-3 animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <h4 className="text-sm font-bold text-slate-900">{editingId ? "Edit cycle" : "New cycle"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label text="Cycle name" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. H1 2026 Review"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div><Label text="Start date" /><input type="date" value={start} min={todayStr} onChange={(e) => setStart(e.target.value)} onMouseDown={(e) => { e.preventDefault(); e.currentTarget.showPicker?.(); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
            <div><Label text="End date" /><input type="date" value={end} min={start || todayStr} onChange={(e) => setEnd(e.target.value)} onMouseDown={(e) => { e.preventDefault(); e.currentTarget.showPicker?.(); }} className={cn("w-full rounded-lg border px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2", invalidRange ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-400 focus:ring-blue-100")} /></div>
          </div>
          {invalidRange && (
            <p className="text-[13px] font-medium text-red-600">
              End Date cannot be earlier than the Start Date. Please select a valid date range.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={!name.trim() || !start || !end || invalidRange || busy === "save"}
              className={cn("inline-flex items-center gap-1.5 rounded-xl text-white px-4 py-2 text-sm font-semibold", name.trim() && start && end && !invalidRange ? "btn-gradient" : "bg-slate-300 cursor-not-allowed")}>
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {editingId ? "Save changes" : "Create"}
            </button>
          </div>
        </div>
      )}

      {cycles.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl border p-10 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-100"><CalendarRange className="h-6 w-6 text-blue-500" /></div>
          <h3 className="text-sm font-bold text-slate-900">No review cycles yet</h3>
          <p className="text-sm text-slate-500 mt-1.5">Create and open a cycle so the team can submit their assessments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.filter((c) => c.id !== editingId).map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border p-4 shadow-card flex items-center gap-4 animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-slate-900 truncate">{c.name}</p>
                  <span className={cn("text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border", STATUS_STYLE[c.status] || STATUS_STYLE.draft)}>{c.status}</span>
                </div>
                <p className="text-[13px] text-slate-500 font-medium mt-1">
                  {!c.start_date && !c.end_date ? (
                    <span className="italic text-slate-400">Dates not set</span>
                  ) : (
                    <>
                      {c.start_date ? fmtDate(c.start_date) : (
                        <span className="italic text-slate-400">Start not set</span>
                      )}
                      {" → "}
                      {c.end_date ? fmtDate(c.end_date) : (
                        <span className="italic text-slate-400">End not set</span>
                      )}
                    </>
                  )}
                  {c.created_by_name ? ` · opened by ${c.created_by_name}` : ""}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[13px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {c.self_count ?? 0} self</span>
                  <span>· {c.peer_count ?? 0} peer reviews</span>
                  {(c.peer_pending ?? 0) > 0 && <span className="text-amber-600 font-semibold">· {c.peer_pending} pending</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.status === "draft" && (
                  <>
                    <button onClick={() => startEdit(c)} disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={() => setDeletePending(c)} disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs font-semibold hover:bg-red-100">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
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

      {deletePending && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={() => setDeletePending(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Delete this cycle?</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              <b className="text-slate-900">{deletePending.name}</b> will be permanently deleted. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setDeletePending(null)} className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={() => doDelete(deletePending)} disabled={busy === deletePending.id}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700">
                {busy === deletePending.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{text} <span className="text-red-500">*</span></label>;
}
