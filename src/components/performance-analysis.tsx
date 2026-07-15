"use client";

/**
 * Leadership Performance Analysis
 * ───────────────────────────────
 * Read-only, app-styled rollup of submitted performance assessments. Reads the
 * single `fn_performance_analysis` aggregation (totals, rating-band distribution,
 * breakdowns by role area / career level, and the recent submissions feed) and
 * lets a leader open any submission to see the full assessment snapshot.
 *
 * Rendered inside the Performance Assessment page's "Analysis" tab — open to any
 * authenticated user. It deliberately uses pure Tailwind / app utilities (no
 * scoped `.pa` styles) so it matches Analytics, Reviews and the dashboards.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Award, Users, TrendingUp, AlertTriangle, X, Loader2, Inbox,
  ClipboardList, BarChart3, ShieldAlert, RefreshCw, FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { downloadPerformanceRatingsExcel } from "@/lib/performance-export";
import {
  performanceAssessments,
  type PerformanceAnalysisData,
  type PerformanceAssessmentRow,
  type PerformanceAssessment,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";
import { ContributionCard, EmployeeReportModal, type Contribution } from "@/components/performance-report";

// ── Display maps (mirror the assessment form) ────────────────────────────────
const BAND_COLOR: Record<string, string> = {
  "Exceptional": "#059669",
  "Exceeds Expectation": "#16a34a",
  "Meets Expectation": "#f59e0b",
  "Below Expectation": "#f97316",
  "Not Satisfactory": "#ef4444",
  "Unrated": "#94a3b8",
};

const ROLE_LABEL: Record<string, string> = {
  eng: "Engineering / Development",
  ds: "Data Science / AI",
  sales: "Sales / Business Development",
  ba: "Product / Business Analysis",
  delivery: "Delivery / Project Management",
  client: "Client Engagement / Management",
};

const LEVEL_LABEL: Record<string, string> = {
  junior: "Fresher / Junior",
  mid: "Mid-level",
  senior: "Senior / Lead",
};

const CULT_LABEL: Record<string, string> = {
  punct: "Punctuality",
  attend: "Attendance & regularity",
  deliver: "Delivers on time",
  team: "Team-friendly & respectful",
  conduct: "Professional conduct",
  commit: "Commitment & ownership",
  hours: "Workload within hours",
};

const LN = ["Exceptional", "Exceeds", "Meets", "Below", "Unsatisfactory"];
const NUM = [5, 4, 3, 2, 1];
const ratingLabel = (n: number | null | undefined) =>
  n == null ? "—" : `${LN[NUM.indexOf(n)] ?? n} (${n})`;

const bandColor = (band?: string | null) => (band && BAND_COLOR[band]) || "#94a3b8";
const roleLabel = (k: string) => ROLE_LABEL[k] ?? k;
const fmtScore = (n?: number | null) => (n == null ? "—" : Number(n).toFixed(2));
const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return s;
  }
};

// Loose shape of the stored `data` snapshot (mirrors the form's gather()).
interface Entry { rating?: number | null; text?: string; remark?: string }
interface Snapshot {
  mode?: string; sev?: string; level?: string; facets?: string[];
  emp?: string; rev?: string; desig?: string; period?: string;
  contributions?: Contribution[]; teamEntries?: Entry[]; orgEntries?: Entry[];
  cultRatings?: Record<string, number>; cultComment?: string; gateFlags?: string[];
}

// ── Component ────────────────────────────────────────────────────────────────
export function PerformanceAnalysis() {
  const [data, setData] = useState<PerformanceAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<PerformanceAssessmentRow | null>(null);
  const { isCEO, isHR, isAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const canExport = isCEO || isHR || isAdmin;

  const exportExcel = async () => {
    setExporting(true);
    setExportError("");
    try {
      await downloadPerformanceRatingsExcel();
    } catch (e) {
      console.error("ratings export failed", e);
      setExportError("Couldn't build the Excel export — please try again.");
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    performanceAssessments
      .analysis()
      .then((r) => setData(r.analysis))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Initial load — set state only in async callbacks (loading starts true).
  useEffect(() => {
    let alive = true;
    performanceAssessments
      .analysis()
      .then((r) => { if (alive) setData(r.analysis); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <PerfLoader label="Loading analysis…" />;

  if (error) {
    return (
      <EmptyCard
        icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
        title="Couldn't load performance analysis"
        body="The analysis service is unreachable. The backend may not be deployed yet, or your session expired."
        action={<RetryButton onClick={load} />}
      />
    );
  }

  const totals = data?.totals;
  const hasData = (totals?.submissions ?? 0) > 0;

  if (!hasData) {
    return (
      <EmptyCard
        icon={<Inbox className="h-6 w-6 text-blue-500" />}
        title="No assessments submitted yet"
        body="Once team members and reviewers submit their performance assessments, the leadership rollup — ratings, distribution and trends — will appear here."
        action={<RetryButton onClick={load} />}
      />
    );
  }

  const bands = data!.band_distribution;
  const maxBand = Math.max(1, ...bands.map((b) => b.count));

  return (
    <div className="space-y-5">
      {/* Ratings Excel export — CEO / HR / Admin only */}
      {canExport && (
        <div className="flex items-center justify-end gap-3">
          {exportError && (
            <span className="text-xs font-medium text-red-600">{exportError}</span>
          )}
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors"
            title="Download the Performance Review Ratings sheet (Self / Peers / RM / CR / percentiles / hike bands)"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {exporting ? "Preparing…" : "Download Ratings Excel"}
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={<ClipboardList className="h-5 w-5" />} color="#3b82f6"
          value={totals!.submissions} label="Assessments" sub="submitted in total" stagger="stagger-1" />
        <KpiCard icon={<Users className="h-5 w-5" />} color="#8b5cf6"
          value={totals!.employees} label="People assessed" sub="distinct employees" stagger="stagger-2" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} color="#16a34a"
          value={fmtScore(totals!.avg_total)} label="Average score" sub="weighted, out of 5.0" stagger="stagger-3" />
        <KpiCard icon={<ShieldAlert className="h-5 w-5" />} color={totals!.flagged > 0 ? "#ef4444" : "#64748b"}
          value={totals!.flagged} label="Integrity flags" sub="raised in manager reviews" stagger="stagger-4" />
      </div>

      {/* Rating-band distribution */}
      <div className="bg-white rounded-2xl border p-5 shadow-card animate-fade-in-up stagger-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900">Rating distribution</h3>
        </div>
        <div className="space-y-2.5">
          {bands.map((b) => {
            const pct = (b.count / maxBand) * 100;
            const color = bandColor(b.band);
            return (
              <div key={b.band} className="flex items-center gap-3">
                <span className="w-36 sm:w-44 shrink-0 text-xs font-semibold text-slate-600 truncate">{b.band}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg progress-animate flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 6)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}>
                    <span className="text-[13px] font-bold text-white">{b.count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard title="By role area" icon={<Award className="h-4 w-4 text-indigo-500" />}
          rows={data!.by_role_area.map((r) => ({ label: roleLabel(r.key), count: r.count, avg: r.avg_total }))}
          stagger="stagger-3" />
        <BreakdownCard title="By career level" icon={<Users className="h-4 w-4 text-indigo-500" />}
          rows={data!.by_level.map((r) => ({ label: LEVEL_LABEL[r.key] ?? r.key, count: r.count, avg: r.avg_total }))}
          stagger="stagger-4" />
      </div>

      {/* Recent submissions */}
      <div className="bg-white rounded-2xl border shadow-card overflow-hidden animate-fade-in-up stagger-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">Recent submissions</h3>
            <span className="text-xs text-slate-400 font-medium">({data!.recent.length})</span>
          </div>
          <button onClick={load} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {data!.recent.map((row, i) => (
            <button key={row.id} onClick={() => setSelected(row)}
              className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-white shadow-sm"
                style={{ backgroundColor: row.employee_color || "#3b82f6" }}>
                {(row.employee_name || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{row.employee_name}</p>
                  {row.severity !== "none" && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0">
                      <ShieldAlert className="h-2.5 w-2.5" /> {row.severity}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-slate-400 font-medium truncate">
                  {row.designation || "—"}
                  {row.review_period ? ` · ${row.review_period}` : ""}
                  {` · ${row.filled_by === "self" ? "Self" : "Reviewer"}`}
                  {` · ${fmtDate(row.created_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <BandBadge band={row.rating_band} capped={row.capped} />
                <span className="stat-number text-base font-extrabold text-slate-900 w-12 text-right">{fmtScore(row.total_score)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Full 360° report (self + manager review + peer reviews) whenever the
          submission is tied to a subject user; the thin snapshot modal only
          remains for legacy rows without one. */}
      {selected && (selected.subject_user_id ? (
        <EmployeeReportModal
          subjectId={selected.subject_user_id}
          cycleId={selected.cycle_id ?? undefined}
          onClose={() => setSelected(null)}
        />
      ) : (
        <DetailModal row={selected} onClose={() => setSelected(null)} />
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ icon, color, value, label, sub, stagger }: {
  icon: React.ReactNode; color: string; value: React.ReactNode; label: string; sub: string; stagger: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border p-4 sm:p-5 shadow-card card-interactive animate-fade-in-up", stagger)}
      style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 stat-number animate-number-count">{value}</p>
      <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">{label}</p>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-medium text-slate-400">{sub}</span>
      </div>
    </div>
  );
}

function BreakdownCard({ title, icon, rows, stagger }: {
  title: string; icon: React.ReactNode; rows: { label: string; count: number; avg: number | null }[]; stagger: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border p-5 shadow-card animate-fade-in-up", stagger)} style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-bold text-slate-900">{title}</h3></div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-[13px] font-medium text-slate-700 truncate">{r.label}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[13px] font-semibold text-slate-400">{r.count} {r.count === 1 ? "entry" : "entries"}</span>
                <span className="stat-number text-sm font-bold text-slate-900 w-10 text-right">{fmtScore(r.avg)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BandBadge({ band, capped }: { band?: string | null; capped?: boolean }) {
  const color = bandColor(band);
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>
      {band || "Unrated"}{capped ? " ▾" : ""}
    </span>
  );
}

function EmptyCard({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-10 shadow-card text-center animate-fade-in-up" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-100">{icon}</div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2 text-sm font-semibold shadow-glow-blue">
      <RefreshCw className="h-3.5 w-3.5" /> Reload
    </button>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ row, onClose }: { row: PerformanceAssessmentRow; onClose: () => void }) {
  const [full, setFull] = useState<PerformanceAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `loading` initialises true; set state only in async callbacks.
    let alive = true;
    performanceAssessments.get(row.id)
      .then((r) => { if (alive) setFull(r.assessment); })
      .catch(() => { /* fall back to the row summary */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const snap = (full?.data ?? {}) as Snapshot;
  const color = bandColor(row.rating_band);

  return (
    <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-white shadow"
              style={{ backgroundColor: row.employee_color || "#3b82f6" }}>
              {(row.employee_name || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">{row.employee_name}</h2>
              <p className="text-xs text-slate-500 font-medium truncate">
                {row.designation || "—"}{row.review_period ? ` · ${row.review_period}` : ""}
                {` · ${row.filled_by === "self" ? "Self-assessment" : "Reviewer"}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Score banner */}
        <div className="px-5 py-4 flex items-center gap-4 flex-wrap border-b border-slate-100" style={{ background: `${color}0d` }}>
          <div>
            <div className="stat-number text-3xl font-extrabold text-slate-900 leading-none">{fmtScore(row.total_score)}</div>
            <div className="text-[13px] text-slate-400 font-medium mt-1">weighted / 5.0</div>
          </div>
          <BandBadge band={row.rating_band} capped={row.capped} />
          <div className="flex items-center gap-3 text-xs text-slate-500 ml-auto">
            <ScorePill label="Individual" value={full?.individual_score} />
            <ScorePill label="Team" value={full?.team_score} />
            <ScorePill label="Org" value={full?.org_score} />
            <ScorePill label="Culture" value={full?.culture_score} />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading full assessment…
            </div>
          ) : (
            <div className="space-y-5">
              {full?.role_areas && full.role_areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {full.role_areas.map((k) => (
                    <span key={k} className="text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                      {roleLabel(k)}
                    </span>
                  ))}
                </div>
              )}

              <Section title={`Individual contributions${snap.contributions?.length ? ` (${snap.contributions.length})` : ""}`}>
                {(snap.contributions ?? []).length === 0 ? <Muted>No contributions recorded.</Muted> : (
                  <div className="space-y-3">
                    {snap.contributions!.map((c, i) => (
                      <ContributionCard key={c.id ?? i} c={c} index={i} />
                    ))}
                  </div>
                )}
              </Section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EntrySection title="Team contribution" entries={snap.teamEntries} />
                <EntrySection title="Organization contribution" entries={snap.orgEntries} />
              </div>

              {snap.cultRatings && Object.keys(snap.cultRatings).length > 0 && (
                <Section title="Culture & discipline">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(snap.cultRatings).map(([k, v]) => (
                      <span key={k} className="text-[13px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {CULT_LABEL[k] ?? k}: <b className="text-slate-900">{v} / 5</b>
                      </span>
                    ))}
                  </div>
                  {snap.cultComment && <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">{snap.cultComment}</p>}
                </Section>
              )}

              {((snap.gateFlags?.length ?? 0) > 0 || (full?.severity && full.severity !== "none")) && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                    <ShieldAlert className="h-3.5 w-3.5" /> Integrity gate — {full?.severity ?? "flagged"}
                    {row.capped && <span className="font-semibold">· rating capped one band</span>}
                  </div>
                  {(snap.gateFlags?.length ?? 0) > 0 && (
                    <p className="text-[13.5px] text-red-600 mt-1.5">{snap.gateFlags!.join(" · ")}</p>
                  )}
                </div>
              )}

              <p className="text-[13px] text-slate-400 pt-1">
                Submitted {fmtDate(row.created_at)}{row.submitted_by_name ? ` by ${row.submitted_by_name}` : ""}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value?: number | null }) {
  return (
    <span className="flex flex-col items-center">
      <span className="stat-number text-sm font-bold text-slate-800">{fmtScore(value)}</span>
      <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[13px] font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function EntrySection({ title, entries }: { title: string; entries?: Entry[] }) {
  return (
    <Section title={title}>
      {(entries ?? []).length === 0 ? <Muted>None recorded.</Muted> : (
        <div className="space-y-2">
          {entries!.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[13.5px]">
              <span className="font-bold text-slate-700 shrink-0">{ratingLabel(e.rating)}</span>
              <span className="min-w-0">
                <span className="text-slate-500 block whitespace-pre-wrap">{e.text || "—"}</span>
                {e.remark && <span className="text-slate-400 italic block mt-0.5 whitespace-pre-wrap">{e.remark}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-slate-400">{children}</p>;
}
