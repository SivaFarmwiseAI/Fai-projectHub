"use client";

/**
 * "My Reviews" — the peer-review inbox for a nominated reviewer.
 * Lists reviews colleagues have asked the current user to complete, opens a
 * focused peer-review form, and shows reviews written about the user.
 */

import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, PenLine, CheckCircle2, X, Star, ShieldCheck, Lock, Crown } from "lucide-react";
import { performanceAssessments, type PeerReviewAssignment, type ReviewReceived } from "@/lib/api-client";
import { bandColor, bandForScore, capOneBand, fmtScore, fmtDate, PEER_QUESTIONS, PEER_SCALE_LABELS, MANAGER_QUESTIONS, MANAGER_PARAMETERS, GATE_FLAGS, GATE_SEVERITIES } from "@/lib/performance";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";

interface ManagerAnswer { rating?: number; text?: string }

interface PeerData {
  answers?: Record<string, string>;
  overall?: number;
  /** Manager-review shape: per-question rating + narrative, behavioural grid. */
  managerAnswers?: Record<string, ManagerAnswer>;
  parameters?: Record<string, number>;
  /** Culture & Integrity Gate (manager review): flagged behaviours + severity. */
  gateFlags?: string[];
  severity?: string;
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
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
      <Crown className="h-3 w-3" /> Manager
    </span>
  );
}

export function PerformanceReviews() {
  const [reviews, setReviews] = useState<PeerReviewAssignment[]>([]);
  const [received, setReceived] = useState<ReviewReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PeerReviewAssignment | null>(null);

  const openWrite = (r: PeerReviewAssignment) => setActive(r);

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
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reviews to complete</h3>
          {pending.length > 0 && (
            <span className="flex items-center justify-center h-6 min-w-[24px] rounded-full bg-amber-500 text-xs font-bold text-white px-1.5">{pending.length}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <Empty icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} title="You're all caught up" body="No peer reviews are waiting on you right now." />
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl border p-4 shadow-card flex items-center gap-3 animate-fade-in-up">
                <Avatar name={r.subject_name} color={r.subject_color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{r.subject_name}</p>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="text-[13px] text-slate-400 dark:text-slate-500 font-medium truncate">
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Completed</h3>
          </div>
          <div className="space-y-2">
            {done.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border px-4 py-3 flex items-center gap-3">
                <Avatar name={r.subject_name} color={r.subject_color} small />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">{r.subject_name}</p>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="text-[12px] text-slate-400 dark:text-slate-500">Submitted {fmtDate(r.submitted_at || r.created_at)}</p>
                </div>
                {r.rating_band && <Band band={r.rating_band} />}
                <span className="stat-number text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{fmtScore(r.total_score)}</span>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 dark:text-slate-500 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700"
                  title="Submitted reviews are final and can no longer be edited">
                  <Lock className="h-3 w-3" /> Final
                </span>
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
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reviews about you</h3>
          </div>
          <div className="space-y-3">
            {received.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border px-5 py-4 flex items-center gap-4">
                <Avatar name={r.author_name} color={r.author_color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200 truncate">{r.author_name || (isManagerKind(r.kind) ? "Your manager" : "Peer reviewer")}</p>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="text-[13px] text-slate-400 dark:text-slate-500">{r.status === "submitted" ? `Submitted ${fmtDate(r.submitted_at || r.created_at)}` : "Pending"}</p>
                </div>
                {r.status === "submitted" ? (r.rating_band && <Band band={r.rating_band} />) : (
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 rounded-full">Awaiting</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {active && (isManagerKind(active.kind)
        ? <ManagerReviewForm assignment={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />
        : <PeerReviewForm assignment={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />)}
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

/** "Are you sure?" gate shown before a review is submitted — submission is
 *  final, so this is the reviewer's last chance to go back and edit. */
function SubmitConfirmDialog({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onCancel}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Submit {label}?</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          Once submitted, <strong className="text-slate-700 dark:text-slate-300">you cannot edit or make any changes</strong> to this review.
        </p>
        <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1.5">Are you sure you want to submit?</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">
            Go back &amp; review
          </button>
          <button onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2 text-sm font-semibold shadow-glow-blue">
            <CheckCircle2 className="h-3.5 w-3.5" /> Yes, submit
          </button>
        </div>
      </div>
    </div>
  );
}

function PeerReviewForm({ assignment, initial, onClose, onDone }: { assignment: PeerReviewAssignment; initial?: PeerData; onClose: () => void; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => seedAnswers(initial));
  const [overall, setOverall] = useState<number | null>(initial?.overall ?? null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const isDone = (q: (typeof PEER_QUESTIONS)[number]) =>
    (answers[q.key] ?? "").trim().length > 0 && (!q.scale || overall != null);
  const doneCount = PEER_QUESTIONS.filter(isDone).length;
  const complete = doneCount === PEER_QUESTIONS.length;

  // Validate first; the actual submit only runs after the confirmation dialog.
  const askSubmit = () => {
    if (!complete || overall == null) { setError("Please answer every question and pick the overall 1–5 rating."); return; }
    setError("");
    setShowConfirm(true);
  };

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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={assignment.subject_name} color={assignment.subject_color} />
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  Peer review · {assignment.subject_name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {assignment.subject_role || ""}
                  {assignment.cycle_name ? ` · ${assignment.cycle_name}` : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(doneCount / PEER_QUESTIONS.length) * 100}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
            </div>
            <span className={cn("text-[11px] font-bold whitespace-nowrap", complete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
              {doneCount}/{PEER_QUESTIONS.length} answered
            </span>
          </div>
        </div>

        <div className="p-5 max-h-[62vh] overflow-y-auto space-y-4">
          <p className="text-[12px] text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg px-3 py-2">
            All questions are required. Be honest, specific and constructive — your answers are shared with the reporting manager.
          </p>

          {PEER_QUESTIONS.map((q, i) => {
            const done = isDone(q);
            return (
              <div key={q.key}
                className={cn("rounded-xl border p-4 transition-colors", done ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900")}>
                <div className="flex items-start gap-3 mb-2.5">
                  <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 mt-0.5",
                    done ? "bg-emerald-500" : "btn-gradient")}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{q.short}</p>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                      {q.question} <span className="text-red-500">*</span>
                    </p>
                  </div>
                </div>

                {q.scale && <ScalePicker value={overall} onSelect={setOverall} />}

                <textarea value={answers[q.key] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.key]: e.target.value }))}
                  placeholder={q.placeholder} rows={3} required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm resize-y bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20" />
              </div>
            );
          })}

          {overall != null && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-4 py-3">
              <span className="stat-number text-2xl font-extrabold text-slate-900 dark:text-slate-100">{overall}</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">overall / 5</span>
              <span className="ml-auto"><Band band={bandForScore(overall)} /></span>
            </div>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={askSubmit} disabled={!complete || saving}
            className={cn("inline-flex items-center gap-1.5 rounded-xl text-white px-4 py-2 text-sm font-semibold",
              complete && !saving ? "btn-gradient shadow-glow-blue" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed")}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
      {showConfirm && (
        <SubmitConfirmDialog
          label="peer review"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); submit(); }}
        />
      )}
    </div>
  );
}

// ── Manager review form ───────────────────────────────────────────────────────
/**
 * The authoritative appraisal a reporting manager writes. Every question needs
 * a 1–5 rating AND a written answer; the behavioural-parameters question swaps
 * the single scale for a 5-parameter grid; the Culture & Integrity Gate
 * question swaps it for behaviour flags + a severity call (a serious concern
 * caps the final band one step); the overall question's rating becomes the
 * review's total score.
 */
export function ManagerReviewForm({ assignment, initial, onClose, onDone }: { assignment: PeerReviewAssignment; initial?: PeerData; onClose: () => void; onDone: () => void }) {
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(MANAGER_QUESTIONS.map((q) => [q.key, initial?.managerAnswers?.[q.key]?.text ?? ""])));
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const r: Record<string, number> = {};
    for (const q of MANAGER_QUESTIONS) {
      const v = initial?.managerAnswers?.[q.key]?.rating;
      if (v != null) r[q.key] = v;
    }
    return r;
  });
  const [params, setParams] = useState<Record<string, number>>(initial?.parameters ?? {});
  const [gateFlags, setGateFlags] = useState<Set<string>>(() => new Set(initial?.gateFlags ?? []));
  const [severity, setSeverity] = useState<"none" | "concern" | "serious" | null>(() =>
    initial?.severity === "none" || initial?.severity === "concern" || initial?.severity === "serious" ? initial.severity : null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const toggleGateFlag = (flag: string) => setGateFlags((p) => {
    const n = new Set(p);
    if (n.has(flag)) n.delete(flag);
    else n.add(flag);
    return n;
  });

  const isDone = (q: (typeof MANAGER_QUESTIONS)[number]) => {
    // Gate question: an explicit severity call is required; the written context
    // only becomes mandatory once a concern is raised.
    if (q.gate) return severity != null && (severity === "none" || (texts[q.key] ?? "").trim().length > 0);
    if (!(texts[q.key] ?? "").trim()) return false;
    if (q.grid) return MANAGER_PARAMETERS.every((p) => params[p.key] != null);
    return ratings[q.key] != null;
  };
  const doneCount = MANAGER_QUESTIONS.filter(isDone).length;
  const complete = doneCount === MANAGER_QUESTIONS.length;
  const overall = ratings.overall ?? null;
  const overallBand = overall != null ? bandForScore(overall) : null;
  const capped = severity === "serious" && overallBand != null && capOneBand(overallBand) !== overallBand;
  const finalBand = overallBand != null ? (severity === "serious" ? capOneBand(overallBand) : overallBand) : null;

  // Validate first; the actual submit only runs after the confirmation dialog.
  const askSubmit = () => {
    if (!complete || overall == null) { setError("Every question needs both a 1–5 rating and a written answer, and the integrity gate needs a severity call."); return; }
    setError("");
    setShowConfirm(true);
  };

  const submit = async () => {
    if (!complete || overall == null || finalBand == null) { setError("Every question needs both a 1–5 rating and a written answer, and the integrity gate needs a severity call."); return; }
    setSaving(true);
    setError("");
    try {
      const managerAnswers = Object.fromEntries(MANAGER_QUESTIONS.map((q) => [q.key, {
        ...(q.grid || q.gate ? {} : { rating: ratings[q.key] }),
        text: (texts[q.key] ?? "").trim(),
      }]));
      await performanceAssessments.update(assignment.id, {
        data: { managerAnswers, parameters: params, overall, gateFlags: [...gateFlags], severity: severity ?? "none" },
        total_score: overall,
        rating_band: finalBand,
        severity: severity ?? "none",
        capped,
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl my-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-indigo-100 dark:border-indigo-500/20 bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-500/10 dark:to-slate-800 rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={assignment.subject_name} color={assignment.subject_color} />
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                  Manager review · {assignment.subject_name}
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-full">
                    <Crown className="h-3 w-3" /> Authoritative
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Your appraisal as reporting manager{assignment.cycle_name ? ` · ${assignment.cycle_name}` : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-indigo-100/70 dark:bg-indigo-500/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(doneCount / MANAGER_QUESTIONS.length) * 100}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            </div>
            <span className={cn("text-[11px] font-bold whitespace-nowrap", complete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
              {doneCount}/{MANAGER_QUESTIONS.length} answered
            </span>
          </div>
        </div>

        <div className="p-5 max-h-[62vh] overflow-y-auto space-y-4">
          <p className="text-[12px] text-indigo-900/70 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-3 py-2">
            Every question needs a 1–5 rating and a written answer; the Culture &amp; Integrity Gate needs a
            severity call instead. This is the authoritative review — the overall summary is shared with the
            employee during the appraisal discussion.
          </p>

          {MANAGER_QUESTIONS.map((q, i) => {
            const done = isDone(q);
            return (
              <div key={q.key}
                className={cn("rounded-xl border p-4 transition-colors", done ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900")}>
                <div className="flex items-start gap-3 mb-2.5">
                  <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 mt-0.5",
                    done ? "bg-emerald-500" : "bg-gradient-to-br from-indigo-500 to-violet-500")}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-400">{q.short}</p>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                      {q.question} <span className="text-red-500">*</span>
                    </p>
                  </div>
                </div>

                {q.grid ? (
                  <div className="space-y-2 mb-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-3">
                    {MANAGER_PARAMETERS.map((p) => (
                      <div key={p.key} className="flex items-center gap-3">
                        <span className="flex-1 text-[13px] font-medium text-slate-600 dark:text-slate-400">{p.label} <span className="text-red-500">*</span></span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" title={PEER_SCALE_LABELS[n - 1]}
                              onClick={() => setParams((prev) => ({ ...prev, [p.key]: n }))}
                              className={cn("h-8 w-8 rounded-lg border text-[13px] font-bold transition-all",
                                params[p.key] === n ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-sm"
                                  : "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-indigo-300 hover:text-indigo-500")}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : q.gate ? (
                  <div className="space-y-3 mb-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {GATE_FLAGS.map((flag) => (
                        <button key={flag} type="button" onClick={() => toggleGateFlag(flag)}
                          className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold transition-all",
                            gateFlags.has(flag) ? "border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-red-300 hover:text-red-500")}>
                          {flag}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Severity <span className="text-red-500">*</span></span>
                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        {GATE_SEVERITIES.map((s) => (
                          <button key={s.key} type="button" onClick={() => setSeverity(s.key)}
                            className={cn("px-3.5 py-1.5 text-[12.5px] font-semibold transition-all",
                              severity === s.key
                                ? s.key === "none" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800")}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {severity === "serious" && (
                      <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-800 rounded-lg px-2.5 py-1.5">
                        Serious concern — the overall rating will be capped one band lower.
                      </p>
                    )}
                  </div>
                ) : (
                  <ScalePicker value={ratings[q.key] ?? null} onSelect={(n) => setRatings((prev) => ({ ...prev, [q.key]: n }))} accent="indigo" />
                )}

                <textarea value={texts[q.key] ?? ""} onChange={(e) => setTexts((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  placeholder={q.placeholder} rows={3} required={!q.gate || severity !== "none"}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm resize-y bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20" />
              </div>
            );
          })}

          {overall != null && (
            <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="stat-number text-2xl font-extrabold text-slate-900 dark:text-slate-100">{overall}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">overall / 5</span>
                <span className="ml-auto"><Band band={finalBand} /></span>
              </div>
              {capped && (
                <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 mt-2">
                  Integrity gate: a serious concern was flagged, so the rating is capped one band lower
                  ({overallBand} → {finalBand}).
                </p>
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={askSubmit} disabled={!complete || saving}
            className={cn("inline-flex items-center gap-1.5 rounded-xl text-white px-4 py-2 text-sm font-semibold",
              complete && !saving ? "bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200 dark:shadow-none" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed")}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Submitting…" : "Submit manager review"}
          </button>
        </div>
      </div>
      {showConfirm && (
        <SubmitConfirmDialog
          label="manager review"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); submit(); }}
        />
      )}
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────
/** 1–5 selector with the band label under each option. */
function ScalePicker({ value, onSelect, accent = "blue" }: { value: number | null; onSelect: (n: number) => void; accent?: "blue" | "indigo" }) {
  const on  = accent === "indigo" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-sm" : "border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shadow-sm";
  const off = accent === "indigo" ? "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-indigo-300 hover:text-indigo-500" : "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 hover:text-blue-500";
  return (
    <div className="grid grid-cols-5 gap-1.5 mb-2.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onSelect(n)} title={PEER_SCALE_LABELS[n - 1]}
          className={cn("rounded-lg border py-2 transition-all flex flex-col items-center gap-0.5", value === n ? on : off)}>
          <span className="flex items-center gap-1 text-sm font-bold">
            <Star className="h-3.5 w-3.5" fill={value != null && value >= n ? "currentColor" : "none"} /> {n}
          </span>
          <span className="text-[9px] font-semibold leading-none text-center px-0.5">{PEER_SCALE_LABELS[n - 1]}</span>
        </button>
      ))}
    </div>
  );
}

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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border p-8 shadow-card text-center">
      <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-100 dark:ring-slate-700">{icon}</div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{body}</p>
    </div>
  );
}
