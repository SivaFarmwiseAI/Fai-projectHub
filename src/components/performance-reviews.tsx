"use client";

/**
 * "My Reviews" — the peer-review inbox for a nominated reviewer.
 * Lists reviews colleagues have asked the current user to complete, opens a
 * focused peer-review form, and shows reviews written about the user.
 */

import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, PenLine, CheckCircle2, X, Star, ShieldCheck, Pencil, Crown } from "lucide-react";
import { performanceAssessments, type PeerReviewAssignment, type ReviewReceived } from "@/lib/api-client";
import { bandColor, bandForScore, fmtScore, fmtDate, PEER_QUESTIONS, PEER_SCALE_LABELS } from "@/lib/performance";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";

interface PeerData {
  answers?: Record<string, string>;
  overall?: number;
  /** Legacy shape from the old competency-based form. */
  competencies?: Record<string, number>;
  strengths?: string;
  improvements?: string;
  comment?: string;
}

const isManagerKind = (k?: string | null) => k === "manager";

/** A small chip marking a review as a manager (authoritative) review. */
function KindChip({ kind }: { kind?: string | null }) {
  if (!isManagerKind(kind)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
      <Crown className="h-3 w-3" /> Manager
    </span>
  );
}

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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.subject_name}</p>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="text-[13px] text-slate-400 font-medium truncate">
                    {isManagerKind(r.kind) ? "Reports to you" : r.subject_role || "—"}
                    {!isManagerKind(r.kind) && r.subject_department ? ` · ${r.subject_department}` : ""}
                    {r.cycle_name ? ` · ${r.cycle_name}` : ""}
                    {!isManagerKind(r.kind) && r.nominated_by_name ? ` · asked by ${r.nominated_by_name}` : ""}
                  </p>
                </div>
                <button onClick={() => openWrite(r)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2.5 text-sm font-semibold shadow-glow-blue">
                  <PenLine className="h-4 w-4" /> {isManagerKind(r.kind) ? "Write manager review" : "Write review"}
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
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{r.subject_name}</p>
                    <KindChip kind={r.kind} />
                  </div>
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
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-slate-800 truncate">{r.author_name || (isManagerKind(r.kind) ? "Your manager" : "Peer reviewer")}</p>
                    <KindChip kind={r.kind} />
                  </div>
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
/** Seed answers from saved data; older competency-based reviews map onto the closest new questions. */
function seedAnswers(d?: PeerData): Record<string, string> {
  if (d?.answers) return { ...d.answers };
  const a: Record<string, string> = {};
  if (d?.strengths) a.strength = d.strengths;
  if (d?.improvements) a.improvement = d.improvements;
  if (d?.comment) a.overall = d.comment;
  return a;
}

function PeerReviewForm({ assignment, initial, onClose, onDone }: { assignment: PeerReviewAssignment; initial?: PeerData; onClose: () => void; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => seedAnswers(initial));
  const [overall, setOverall] = useState<number | null>(initial?.overall ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isManager = isManagerKind(assignment.kind);
  const isDone = (q: (typeof PEER_QUESTIONS)[number]) =>
    (answers[q.key] ?? "").trim().length > 0 && (!q.scale || overall != null);
  const doneCount = PEER_QUESTIONS.filter(isDone).length;
  const complete = doneCount === PEER_QUESTIONS.length;

  const submit = async () => {
    if (!complete || overall == null) { setError("Please answer every question and pick the overall 1–5 rating."); return; }
    setSaving(true);
    setError("");
    try {
      const trimmed = Object.fromEntries(PEER_QUESTIONS.map((q) => [q.key, (answers[q.key] ?? "").trim()]));
      await performanceAssessments.update(assignment.id, {
        data: { answers: trimmed, overall },
        total_score: overall,
        rating_band: bandForScore(overall),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={assignment.subject_name} color={assignment.subject_color} />
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {isManager ? "Manager review" : "Peer review"} · {assignment.subject_name}
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  {isManager ? "Your authoritative review as reporting manager" : assignment.subject_role || ""}
                  {assignment.cycle_name ? ` · ${assignment.cycle_name}` : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(doneCount / PEER_QUESTIONS.length) * 100}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
            </div>
            <span className={cn("text-[11px] font-bold whitespace-nowrap", complete ? "text-emerald-600" : "text-slate-400")}>
              {doneCount}/{PEER_QUESTIONS.length} answered
            </span>
          </div>
        </div>

        <div className="p-5 max-h-[62vh] overflow-y-auto space-y-4">
          <p className="text-[12px] text-slate-500 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2">
            All questions are required. Be honest, specific and constructive — your answers are shared with the reporting manager.
          </p>

          {PEER_QUESTIONS.map((q, i) => {
            const done = isDone(q);
            return (
              <div key={q.key}
                className={cn("rounded-xl border p-4 transition-colors", done ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white")}>
                <div className="flex items-start gap-3 mb-2.5">
                  <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 mt-0.5",
                    done ? "bg-emerald-500" : "btn-gradient")}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{q.short}</p>
                    <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                      {q.question} <span className="text-red-500">*</span>
                    </p>
                  </div>
                </div>

                {q.scale && (
                  <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setOverall(n)}
                        title={PEER_SCALE_LABELS[n - 1]}
                        className={cn("rounded-lg border py-2 transition-all flex flex-col items-center gap-0.5",
                          overall === n ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm"
                            : "border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500")}>
                        <span className="flex items-center gap-1 text-sm font-bold">
                          <Star className="h-3.5 w-3.5" fill={overall != null && overall >= n ? "currentColor" : "none"} /> {n}
                        </span>
                        <span className="text-[9px] font-semibold leading-none text-center px-0.5">{PEER_SCALE_LABELS[n - 1]}</span>
                      </button>
                    ))}
                  </div>
                )}

                <textarea value={answers[q.key] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.key]: e.target.value }))}
                  placeholder={q.placeholder} rows={3} required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-y bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
            );
          })}

          {overall != null && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <span className="stat-number text-2xl font-extrabold text-slate-900">{overall}</span>
              <span className="text-[11px] text-slate-400 font-medium">overall / 5</span>
              <span className="ml-auto"><Band band={bandForScore(overall)} /></span>
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

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border p-8 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-100">{icon}</div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  );
}
