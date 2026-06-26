"use client";

/**
 * Per-employee performance report (Keka-style): the subject's self-assessment
 * alongside every peer review, with scores and a print/PDF action. Opened from
 * the Team view and the leadership Analysis. Fully app-styled.
 */

import { useEffect, useState } from "react";
import { X, Loader2, Printer, ShieldAlert, Users2, Award } from "lucide-react";
import { performanceAssessments, type EmployeeReport } from "@/lib/api-client";
import { bandColor, roleLabel, levelLabel, fmtScore, ratingLabel, fmtDate, PEER_COMPETENCIES } from "@/lib/performance";

interface Contribution { title?: string; area?: string; self?: number | null; value?: string; changed?: string }
interface PeerData {
  competencies?: Record<string, number>;
  strengths?: string;
  improvements?: string;
  overall?: number | null;
  comment?: string;
}

export function EmployeeReportModal({ subjectId, cycleId, onClose }: { subjectId: string; cycleId?: string; onClose: () => void }) {
  const [report, setReport] = useState<EmployeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    performanceAssessments.report(subjectId, cycleId)
      .then((r) => { if (alive) setReport(r.report); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectId, cycleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subject = report?.subject;
  const self = report?.self;
  const peers = report?.peers ?? [];
  const contributions = (self?.data?.contributions as Contribution[] | undefined) ?? [];
  const color = bandColor(self?.rating_band);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 overflow-y-auto print:p-0 print:bg-white"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 animate-scale-in print-header" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          {loading || !subject ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>
          ) : (
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 ring-2 ring-white shadow"
                style={{ backgroundColor: subject.avatar_color || "#3b82f6" }}>
                {subject.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-slate-900 truncate">{subject.name}</h2>
                <p className="text-xs text-slate-500 font-medium">
                  {subject.role || "—"}{subject.department ? ` · ${subject.department}` : ""}
                  {subject.manager_name ? ` · Reports to ${subject.manager_name}` : ""}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 shrink-0 print:hidden">
            <button onClick={() => window.print()} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-10 text-center text-sm text-slate-500">Couldn&apos;t load this report.</div>
        ) : loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="p-5 max-h-[70vh] overflow-y-auto print:max-h-none space-y-6">
            {/* Self-assessment */}
            <section>
              <SectionLabel icon={<Award className="h-3.5 w-3.5 text-indigo-500" />} text="Self-assessment" />
              {!self ? (
                <p className="text-sm text-slate-400">No self-assessment submitted yet.</p>
              ) : (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-4 flex-wrap" style={{ background: `${color}0d` }}>
                    <div>
                      <div className="stat-number text-3xl font-extrabold text-slate-900 leading-none">{fmtScore(self.total_score)}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-1">weighted / 5.0</div>
                    </div>
                    <Band band={self.rating_band} capped={self.capped} />
                    <div className="flex items-center gap-3 ml-auto">
                      <Pill label="Individual" value={self.individual_score} />
                      <Pill label="Team" value={self.team_score} />
                      <Pill label="Org" value={self.org_score} />
                      <Pill label="Culture" value={self.culture_score} />
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500">{levelLabel(self.career_level)}</span>
                      {(self.role_areas ?? []).map((k) => (
                        <span key={k} className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">{roleLabel(k)}</span>
                      ))}
                    </div>
                    {contributions.length > 0 && (
                      <div className="space-y-2">
                        {contributions.map((c, i) => (
                          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-bold text-slate-800">{c.title || `Contribution #${i + 1}`}</p>
                              <span className="text-[11px] font-semibold text-slate-500 shrink-0">{ratingLabel(c.self)}</span>
                            </div>
                            {c.area && <p className="text-[11px] text-indigo-600 font-medium mt-0.5">{roleLabel(c.area)}</p>}
                            {(c.value || c.changed) && <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed line-clamp-3">{c.value || c.changed}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {self.severity && self.severity !== "none" && (
                      <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 flex items-center gap-2 text-xs font-bold text-red-700">
                        <ShieldAlert className="h-3.5 w-3.5" /> Integrity gate — {self.severity}{self.capped ? " · rating capped one band" : ""}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Peer reviews */}
            <section>
              <SectionLabel icon={<Users2 className="h-3.5 w-3.5 text-indigo-500" />} text={`Peer reviews (${peers.length})`} />
              {peers.length === 0 ? (
                <p className="text-sm text-slate-400">No peer reviewers nominated yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {peers.map((p) => {
                    const d = (p.data ?? {}) as PeerData;
                    const comps = d.competencies ?? {};
                    return (
                      <div key={p.id} className="rounded-2xl border border-slate-100 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: p.author_color || "#64748b" }}>
                            {(p.author_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{p.author_name || "Peer reviewer"}</p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {p.status === "submitted" ? `Submitted ${fmtDate(p.submitted_at || p.created_at)}` : "Pending"}
                            </p>
                          </div>
                          {p.status === "submitted" ? <Band band={p.rating_band} small /> : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Awaiting</span>
                          )}
                        </div>
                        {p.status === "submitted" ? (
                          <div className="space-y-2.5">
                            {PEER_COMPETENCIES.filter((c) => comps[c.key] != null).map((c) => (
                              <div key={c.key} className="flex items-center gap-2">
                                <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500 truncate">{c.label}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${(comps[c.key] / 5) * 100}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 w-4 text-right">{comps[c.key]}</span>
                              </div>
                            ))}
                            {d.strengths && <Note label="Strengths" text={d.strengths} />}
                            {d.improvements && <Note label="To improve" text={d.improvements} />}
                          </div>
                        ) : (
                          <p className="text-[12px] text-slate-400">This reviewer hasn&apos;t submitted yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-1.5 mb-3">{icon}<h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{text}</h3></div>;
}

function Band({ band, capped, small }: { band?: string | null; capped?: boolean; small?: boolean }) {
  const color = bandColor(band);
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${small ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"}`}
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>
      {band || "Unrated"}{capped ? " ▾" : ""}
    </span>
  );
}

function Pill({ label, value }: { label: string; value?: number | null }) {
  return (
    <span className="flex flex-col items-center">
      <span className="stat-number text-sm font-bold text-slate-800">{fmtScore(value)}</span>
      <span className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">{label}</span>
    </span>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-[12px]">
      <span className="font-bold text-slate-600">{label}: </span>
      <span className="text-slate-500 leading-relaxed">{text}</span>
    </div>
  );
}
