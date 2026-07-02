"use client";

/**
 * "My Reviews" — the peer-review inbox for a nominated reviewer.
 * Lists reviews colleagues have asked the current user to complete, opens a
 * focused peer-review form, and shows reviews written about the user.
 */

import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, PenLine, CheckCircle2, X, Star, ShieldCheck, Pencil } from "lucide-react";
import { performanceAssessments, type PeerReviewAssignment, type ReviewReceived } from "@/lib/api-client";
import { bandColor, bandForScore, fmtScore, fmtDate, PEER_COMPETENCIES } from "@/lib/performance";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";

interface PeerData { competencies?: Record<string, number>; strengths?: string; improvements?: string; comment?: string }

export function PerformanceReviews() {
  const [reviews, setReviews] = useState<PeerReviewAssignment[]>([]);
  const [received, setReceived] = useState<ReviewReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PeerReviewAssignment | null>(null);
  const [editInitial, setEditInitial] = useState<PeerData | undefined>(undefined);

  const openWrite = (r: PeerReviewAssignment) => { setEditInitial(undefined); setActive(r); };
  const openEdit = async (r: PeerReviewAssignment) => {
    try {
      const res = await performanceAssessments.get(r.id);
      setEditInitial((res.assessment.data as PeerData) || {});
    } catch {
      setEditInitial(undefined);
    }
    setActive(r);
  };

  const load = useCallback(() => {
    Promise.all([
      performanceAssessments.myReviews(),
      performanceAssessments.myAssessments(),
    ])
      .then(([a, b]) => { setReviews(a.reviews || []); setReceived(b.reviews_received || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([performanceAssessments.myReviews(), performanceAssessments.myAssessments()])
      .then(([a, b]) => { if (alive) { setReviews(a.reviews || []); setReceived(b.reviews_received || []); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <PerfLoader label="Loading your reviews…" />;
  }

  const pending = reviews.filter((r) => r.status === "pending");
  const done = reviews.filter((r) => r.status === "submitted");

  return (
    <div className="space-y-6">
      {/* Pending */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900">Reviews to complete</h3>
          {pending.length > 0 && (
            <span className="flex items-center justify-center h-6 min-w-[24px] rounded-full bg-amber-500 text-xs font-bold text-white px-1.5">{pending.length}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <Empty icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} title="You're all caught up" body="No peer reviews are waiting on you right now." />
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border p-4 shadow-card flex items-center gap-3 animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <Avatar name={r.subject_name} color={r.subject_color} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{r.subject_name}</p>
                  <p className="text-[13px] text-slate-400 font-medium truncate">
                    {r.subject_role || "—"}{r.subject_department ? ` · ${r.subject_department}` : ""}
                    {r.cycle_name ? ` · ${r.cycle_name}` : ""}
                    {r.nominated_by_name ? ` · asked by ${r.nominated_by_name}` : ""}
                  </p>
                </div>
                <button onClick={() => openWrite(r)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2.5 text-sm font-semibold shadow-glow-blue">
                  <PenLine className="h-4 w-4" /> Write review
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed */}
      {done.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900">Completed</h3>
          </div>
          <div className="space-y-2">
            {done.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <Avatar name={r.subject_name} color={r.subject_color} small />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{r.subject_name}</p>
                  <p className="text-[12px] text-slate-400">Submitted {fmtDate(r.submitted_at || r.created_at)}</p>
                </div>
                {r.rating_band && <Band band={r.rating_band} />}
                <span className="stat-number text-sm font-bold text-slate-700 w-10 text-right">{fmtScore(r.total_score)}</span>
                <button onClick={() => openEdit(r)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-slate-500 px-3 py-2 text-[13px] font-semibold hover:bg-slate-50 hover:text-slate-700">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews about me */}
      {received.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900">Reviews about you</h3>
          </div>
          <div className="space-y-3">
            {received.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border px-5 py-4 flex items-center gap-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <Avatar name={r.author_name} color={r.author_color} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-800 truncate">{r.author_name || "Peer reviewer"}</p>
                  <p className="text-[13px] text-slate-400">{r.status === "submitted" ? `Submitted ${fmtDate(r.submitted_at || r.created_at)}` : "Pending"}</p>
                </div>
                {r.status === "submitted" ? (r.rating_band && <Band band={r.rating_band} />) : (
                  <span className="text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full">Awaiting</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {active && <PeerReviewForm assignment={active} initial={editInitial} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />}
    </div>
  );
}

// ── Peer review form ──────────────────────────────────────────────────────────
function PeerReviewForm({ assignment, initial, onClose, onDone }: { assignment: PeerReviewAssignment; initial?: PeerData; onClose: () => void; onDone: () => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>(initial?.competencies ?? {});
  const [strengths, setStrengths] = useState(initial?.strengths ?? "");
  const [improvements, setImprovements] = useState(initial?.improvements ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rated = PEER_COMPETENCIES.filter((c) => ratings[c.key] != null);
  const avg = rated.length ? rated.reduce((s, c) => s + ratings[c.key], 0) / rated.length : null;
  const complete = rated.length === PEER_COMPETENCIES.length && strengths.trim().length > 0;

  const submit = async () => {
    if (!complete || avg == null) { setError("Rate every competency and add at least the strengths."); return; }
    setSaving(true);
    setError("");
    try {
      await performanceAssessments.update(assignment.id, {
        data: { competencies: ratings, strengths: strengths.trim(), improvements: improvements.trim(), comment: comment.trim() },
        total_score: Number(avg.toFixed(2)),
        rating_band: bandForScore(avg),
        status: "submitted",
      });
      onDone();
    } catch {
      setError("Couldn't submit — please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={assignment.subject_name} color={assignment.subject_color} />
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">Peer review · {assignment.subject_name}</h2>
              <p className="text-xs text-slate-500 truncate">{assignment.subject_role || ""}{assignment.cycle_name ? ` · ${assignment.cycle_name}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          <div className="space-y-3">
            {PEER_COMPETENCIES.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-slate-700">{c.label} <span className="text-red-500">*</span></span>
                  <span className="text-[11px] text-slate-400">{c.hint}</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRatings((p) => ({ ...p, [c.key]: n }))}
                      className={cn("flex-1 h-9 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-1",
                        ratings[c.key] === n ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-400 hover:border-blue-200")}>
                      <Star className="h-3 w-3" fill={ratings[c.key] != null && ratings[c.key] >= n ? "currentColor" : "none"} /> {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Field label="Strengths" required value={strengths} onChange={setStrengths} placeholder="What does this person do really well?" />
          <Field label="Areas to improve" value={improvements} onChange={setImprovements} placeholder="Where could they grow? Be specific and constructive." />
          <Field label="Anything else (optional)" value={comment} onChange={setComment} placeholder="Context, examples, overall impression…" />

          {avg != null && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <span className="stat-number text-2xl font-extrabold text-slate-900">{avg.toFixed(2)}</span>
              <span className="text-[11px] text-slate-400 font-medium">overall / 5.0</span>
              <span className="ml-auto"><Band band={bandForScore(avg)} /></span>
            </div>
          )}
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={!complete || saving}
            className={cn("inline-flex items-center gap-1.5 rounded-xl text-white px-4 py-2 text-sm font-semibold",
              complete && !saving ? "btn-gradient shadow-glow-blue" : "bg-slate-300 cursor-not-allowed")}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────
function Avatar({ name, color, small }: { name?: string | null; color?: string | null; small?: boolean }) {
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-white shadow-sm",
      small ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm")}
      style={{ backgroundColor: color || "#3b82f6" }}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

function Band({ band }: { band?: string | null }) {
  const color = bandColor(band);
  return (
    <span className="inline-flex items-center text-[13px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>{band || "Unrated"}</span>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-y focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border p-8 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-100">{icon}</div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  );
}
