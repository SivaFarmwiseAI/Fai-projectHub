"use client";

/**
 * "My Team" — a Team Lead's direct + indirect reports with their review status,
 * each opening the full per-employee report. Leadership/HR see it too (scoped
 * server-side by fn_can_view_subject).
 */

import { useEffect, useState } from "react";
import { Users2, Loader2, FileText, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { performanceAssessments, type TeamReportRow } from "@/lib/api-client";
import { bandColor, fmtScore } from "@/lib/performance";
import { EmployeeReportModal } from "@/components/performance-report";
import { PerfLoader } from "@/components/performance-loader";

export function PerformanceTeam() {
  const [reports, setReports] = useState<TeamReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    performanceAssessments.team()
      .then((r) => { if (alive) setReports(r.reports || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <PerfLoader label="Loading your team…" />;
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-10 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-100">
          <Users2 className="h-6 w-6 text-blue-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No reports yet</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
          Nobody reports to you in the org tree yet. HR or an admin can set reporting managers under the Org Tree tab.
        </p>
      </div>
    );
  }

  const done = reports.filter((r) => r.self_status === "submitted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users2 className="h-5 w-5 text-blue-500" />
        <h3 className="text-base font-bold text-slate-900">Your team</h3>
        <span className="text-sm text-slate-400 font-medium">· {done}/{reports.length} self-assessments submitted</span>
      </div>

      <div className="bg-white rounded-2xl border shadow-card overflow-hidden divide-y divide-slate-100" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        {reports.map((r, i) => {
          const color = bandColor(r.rating_band);
          const submitted = r.self_status === "submitted";
          return (
            <button key={r.id} onClick={() => setOpenSubject(r.id)}
              className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-white shadow-sm"
                style={{ backgroundColor: r.avatar_color || "#3b82f6" }}>
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-900 truncate">{r.name}</p>
                  {r.severity && r.severity !== "none" && <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />}
                </div>
                <p className="text-[13px] text-slate-400 font-medium truncate">{r.role || "—"}{r.department ? ` · ${r.department}` : ""}</p>
              </div>

              {/* Self status */}
              <span className={`hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full ${submitted ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-slate-500 bg-slate-100"}`}>
                {submitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                Self {submitted ? "done" : "pending"}
              </span>

              {/* Peer progress */}
              <span className="hidden md:inline text-[13px] font-medium text-slate-500 w-24 text-right">
                Peers {r.peer_done}/{r.peer_total}
              </span>

              {/* Band + score */}
              {submitted && r.rating_band ? (
                <span className="inline-flex items-center text-[12px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>{r.rating_band}</span>
              ) : null}
              <span className="stat-number text-lg font-bold text-slate-900 w-14 text-right">{fmtScore(r.total_score)}</span>
              <FileText className="h-5 w-5 text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>

      {openSubject && <EmployeeReportModal subjectId={openSubject} onClose={() => setOpenSubject(null)} />}

      {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
    </div>
  );
}
