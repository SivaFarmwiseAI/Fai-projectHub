"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Printer, ShieldAlert, Users2, Award, ChevronDown, ChevronUp, Crown } from "lucide-react";
import { performanceAssessments, type EmployeeReport, type EmployeeReportPeer } from "@/lib/api-client";
import { bandColor, roleLabel, levelLabel, fmtScore, ratingLabel, fmtDate, PEER_COMPETENCIES } from "@/lib/performance";

/* ─── Data shape mirrors gather() in the assessment page ─── */
interface Contribution {
  id?: number;
  title?: string;
  area?: string;
  context?: string;
  problem?: string;
  create?: string;
  adopt?: string;
  changed?: string;
  value?: string;
  sustain?: string;
  evidence?: string;
  proofref?: string;
  self?: number | null;
  reviewer?: number | null;
  impacts?: string[];
  impactWhy?: Record<string, string>;
  flagged?: boolean;
}

interface Entry {
  id?: number;
  rating?: number | null;
  text?: string;
  remark?: string;
}

interface PeerData {
  competencies?: Record<string, number>;
  strengths?: string;
  improvements?: string;
  overall?: number | null;
  comment?: string;
}

interface AssessmentData {
  contributions?: Contribution[];
  teamEntries?: Entry[];
  orgEntries?: Entry[];
  cultRatings?: Record<string, number>;
  cultComment?: string;
  gateFlags?: string[];
  level?: string;
  facets?: string[];
}

const FACET_LABELS: Record<string, string> = {
  eng: "Engineering / Development",
  ds: "Data Science / AI",
  sales: "Sales / Business Development",
  ba: "Product / Business Analysis",
  delivery: "Delivery / Project Management",
  client: "Client Engagement / Management",
};

const IMPACT_LABELS: Record<string, string> = {
  reusable: "Reusable asset / component",
  time: "Time / effort saved",
  quality: "Better quality / fewer errors",
  smarter: "Did it a smarter / different way",
  learning: "Learned & applied a new skill",
  adoption: "Adoption / usage",
  capability: "New capability built",
  cost: "Cost reduction",
  revenue: "Direct revenue",
  strategic: "Strategic (new geography / dept / market)",
  customer: "Customer impact",
  team: "Team multiplication",
};

const CULT_ITEMS: [string, string][] = [
  ["punct",   "Punctuality — arrives on time"],
  ["attend",  "Attendance & regularity"],
  ["deliver", "Delivers on time / meets commitments"],
  ["team",    "Team-friendly & respectful"],
  ["conduct", "Professional conduct & confidentiality"],
  ["commit",  "Commitment & ownership"],
  ["hours",   "Manages workload within working hours"],
];

const RATING_LABELS: Record<number, string> = {
  5: "Exceptional",
  4: "Exceeds",
  3: "Meets",
  2: "Below",
  1: "Unsatisfactory",
};

/* ─── Main Modal ─── */
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
  const manager = report?.manager ?? null;
  const data = (self?.data ?? {}) as AssessmentData;
  const contributions = data.contributions ?? [];
  const teamEntries = data.teamEntries ?? [];
  const orgEntries = data.orgEntries ?? [];
  const cultRatings = data.cultRatings ?? {};
  const cultComment = data.cultComment ?? "";
  const gateFlags = data.gateFlags ?? [];
  const color = bandColor(self?.rating_band);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 overflow-y-auto bg-black/45 backdrop-blur-sm print:static print:block print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible"
      onClick={onClose}
    >
      <div
        id="report-print"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 animate-scale-in print-header print:shadow-none print:rounded-none print:my-0 print:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white rounded-t-2xl z-10 print:static">
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
            <button onClick={() => window.print()} className="h-10 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="h-10 w-10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-10 text-center text-sm text-slate-500">Couldn&apos;t load this report.</div>
        ) : loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="p-5 max-h-[78vh] overflow-y-auto print:max-h-none print:overflow-visible space-y-6">

            {/* ── Score summary ── */}
            <section>
              <SectionLabel icon={<Award className="h-3.5 w-3.5 text-indigo-500" />} text="Self-assessment" />
              {!self ? (
                <p className="text-sm text-slate-400">No self-assessment submitted yet.</p>
              ) : (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-4 flex-wrap" style={{ background: `${color}0d` }}>
                    <div>
                      <div className="text-3xl font-extrabold text-slate-900 leading-none">{fmtScore(self.total_score)}</div>
                      <div className="text-[13px] text-slate-400 font-medium mt-1">weighted / 5.0</div>
                    </div>
                    <Band band={self.rating_band} capped={self.capped} />
                    <div className="flex items-center gap-3 ml-auto flex-wrap">
                      <Pill label="Individual" value={self.individual_score} />
                      <Pill label="Team" value={self.team_score} />
                      <Pill label="Org" value={self.org_score} />
                      <Pill label="Culture" value={self.culture_score} />
                    </div>
                  </div>
                  <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5 border-b border-slate-100">
                    <span className="text-[13px] font-semibold text-slate-500">{levelLabel(self.career_level)}</span>
                    {(self.role_areas ?? []).map((k) => (
                      <span key={k} className="text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">{roleLabel(k)}</span>
                    ))}
                    {self.review_period && (
                      <span className="ml-auto text-[15px] text-slate-600 font-semibold">Period: {self.review_period}</span>
                    )}
                  </div>
                  {self.severity && self.severity !== "none" && (
                    <div className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 border-b border-red-100">
                      <ShieldAlert className="h-3.5 w-3.5" /> Integrity gate flagged — {self.severity}{self.capped ? " · rating capped one band" : ""}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Manager review (authoritative / final) ── */}
            <section>
              <SectionLabel icon={<Crown className="h-3.5 w-3.5 text-indigo-500" />} text="Manager review (final)" />
              <ManagerReviewCard manager={manager} managerName={subject?.manager_name} />
            </section>

            {/* ── Contributions ── */}
            {contributions.length > 0 && (
              <section>
                <SectionLabel icon={<span className="text-indigo-500 text-[15px] font-bold">①</span>} text={`Individual contributions (${contributions.length})`} />
                <div className="space-y-4">
                  {contributions.map((c, i) => (
                    <ContributionCard key={c.id ?? i} c={c} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Team ── */}
            {teamEntries.length > 0 && (
              <section>
                <SectionLabel icon={<span className="text-blue-500 text-[15px] font-bold">②</span>} text="Team impact" />
                <div className="space-y-3">
                  {teamEntries.map((e, i) => (
                    <EntryCard key={e.id ?? i} entry={e} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Org ── */}
            {orgEntries.length > 0 && (
              <section>
                <SectionLabel icon={<span className="text-purple-500 text-[15px] font-bold">③</span>} text="Organisation impact" />
                <div className="space-y-3">
                  {orgEntries.map((e, i) => (
                    <EntryCard key={e.id ?? i} entry={e} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Culture ── */}
            {CULT_ITEMS.some(([k]) => cultRatings[k] != null) && (
              <section>
                <SectionLabel icon={<span className="text-emerald-500 text-[15px] font-bold">④</span>} text="Culture & values" />
                <div className="rounded-2xl border border-slate-100 p-5 space-y-4">
                  {CULT_ITEMS.filter(([k]) => cultRatings[k] != null).map(([k, label]) => (
                    <div key={k} className="flex items-center gap-5">
                      <span
                        className="w-80 shrink-0 truncate text-[15px] text-slate-700 font-medium"
                        title={label}
                      >
                        {label}
                      </span>
                      <div className="flex-1 min-w-[80px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(cultRatings[k] / 5) * 100}%` }} />
                      </div>
                      <span className="w-36 shrink-0 text-right text-[14px] font-bold text-slate-700 whitespace-nowrap">
                        {cultRatings[k]} — {RATING_LABELS[cultRatings[k]] ?? ""}
                      </span>
                    </div>
                  ))}
                  {cultComment && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wide mb-1">Additional comment</p>
                      <p className="text-[15px] text-slate-600 leading-relaxed">{cultComment}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Integrity Gate ── */}
            {gateFlags.length > 0 && (
              <section>
                <SectionLabel icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />} text="Integrity gate — flagged behaviours" />
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 flex flex-wrap gap-2">
                  {gateFlags.map((f) => (
                    <span key={f} className="text-[14px] font-semibold text-red-700 bg-white border border-red-200 px-2.5 py-1 rounded-full">{f}</span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Peer reviews ── */}
            <section>
              <SectionLabel icon={<Users2 className="h-3.5 w-3.5 text-indigo-500" />} text={`Peer reviews (${peers.length})`} />
              {peers.length === 0 ? (
                <p className="text-sm text-slate-400">No peer reviewers nominated yet.</p>
              ) : (
                <div className="space-y-4">
                  {peers.map((p) => {
                    const d = (p.data ?? {}) as PeerData;
                    const comps = d.competencies ?? {};
                    return (
                      <div key={p.id} className="rounded-2xl border border-slate-200 p-6 print:break-inside-avoid">
                        {/* Header */}
                        <div className="flex items-center gap-3.5 pb-4 mb-5 border-b border-slate-100">
                          <div className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                            style={{ backgroundColor: p.author_color || "#64748b" }}>
                            {(p.author_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-bold text-slate-900 truncate">{p.author_name || "Peer reviewer"}</p>
                            <p className="text-xs text-slate-400 font-medium">
                              {p.status === "submitted" ? `Submitted ${fmtDate(p.submitted_at || p.created_at)}` : "Pending review"}
                            </p>
                          </div>
                          {p.status === "submitted" ? <Band band={p.rating_band} /> : (
                            <span className="text-[13px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">Awaiting</span>
                          )}
                        </div>
                        {p.status === "submitted" ? (
                          <>
                            {/* Competencies — stacked vertically */}
                            <div className="space-y-4">
                              {PEER_COMPETENCIES.filter((c) => comps[c.key] != null).map((c) => (
                                <div key={c.key} className="flex items-center gap-4">
                                  <span className="w-56 shrink-0 text-sm font-medium text-slate-600 truncate">{c.label}</span>
                                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(comps[c.key] / 5) * 100}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                                  </div>
                                  <span className="text-sm font-bold text-slate-700 w-6 text-right">{comps[c.key]}</span>
                                </div>
                              ))}
                            </div>
                            {/* Qualitative notes */}
                            {(d.strengths || d.improvements) && (
                              <div className="space-y-4 mt-5 pt-5 border-t border-slate-100">
                                {d.strengths && <Note label="Strengths" text={d.strengths} />}
                                {d.improvements && <Note label="To improve" text={d.improvements} />}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-slate-400">This reviewer hasn&apos;t submitted yet.</p>
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

/* ─── Manager review — the authoritative third actor ─── */
function ManagerReviewCard({ manager, managerName }: { manager: EmployeeReportPeer | null; managerName?: string | null }) {
  if (!manager) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
        <p className="text-sm text-indigo-900/70 font-medium">
          {managerName ? `Awaiting review from ${managerName}.` : "Manager review pending — assigned once a reporting manager is set."}
        </p>
      </div>
    );
  }
  const d = (manager.data ?? {}) as PeerData;
  const comps = d.competencies ?? {};
  const submitted = manager.status === "submitted";
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-6 print:break-inside-avoid">
      <div className="flex items-center gap-3.5 pb-4 mb-5 border-b border-indigo-100">
        <div className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 ring-2 ring-white shadow"
          style={{ backgroundColor: manager.author_color || "#6366f1" }}>
          {(manager.author_name || managerName || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-slate-900 truncate">{manager.author_name || managerName || "Reporting manager"}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-full">
              <Crown className="h-3 w-3" /> Manager
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {manager.author_role ? `${manager.author_role} · ` : ""}
            {submitted ? `Submitted ${fmtDate(manager.submitted_at || manager.created_at)}` : "Pending review"}
          </p>
        </div>
        {submitted ? <Band band={manager.rating_band} /> : (
          <span className="text-[13px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">Awaiting</span>
        )}
      </div>
      {submitted ? (
        <>
          <div className="space-y-4">
            {PEER_COMPETENCIES.filter((c) => comps[c.key] != null).map((c) => (
              <div key={c.key} className="flex items-center gap-4">
                <span className="w-56 shrink-0 text-sm font-medium text-slate-600 truncate">{c.label}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(comps[c.key] / 5) * 100}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                </div>
                <span className="text-sm font-bold text-slate-700 w-6 text-right">{comps[c.key]}</span>
              </div>
            ))}
          </div>
          {(d.strengths || d.improvements || d.comment) && (
            <div className="space-y-4 mt-5 pt-5 border-t border-indigo-100">
              {d.strengths && <Note label="Strengths" text={d.strengths} />}
              {d.improvements && <Note label="To improve" text={d.improvements} />}
              {d.comment && <Note label="Manager comment" text={d.comment} />}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400">Your manager hasn&apos;t submitted this review yet.</p>
      )}
    </div>
  );
}

/* ─── Contribution Card with expand/collapse ─── */
function ContributionCard({ c, index }: { c: Contribution; index: number }) {
  const [open, setOpen] = useState(false);
  const ratingColor = c.self === 5 ? "#059669" : c.self === 4 ? "#16a34a" : c.self === 3 ? "#f59e0b" : c.self != null ? "#ef4444" : "#64748b";

  const fields: [string, string | undefined][] = [
    ["Context / background", c.context],
    ["Problem statement", c.problem],
    ["What was created / built", c.create],
    ["What was adopted / used by others", c.adopt],
    ["What changed as a result", c.changed],
    ["Business / team value", c.value],
    ["How to sustain this outcome", c.sustain],
    ["Evidence / proof", c.evidence],
    ["Reference / link", c.proofref],
  ];
  const visibleFields = fields.filter(([, v]) => v?.trim());

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      {/* Summary row — always visible */}
      <button className="print-visible w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[14px] font-bold text-slate-400">#{index + 1}</span>
            <p className="text-[15px] font-bold text-slate-900">{c.title || `Contribution ${index + 1}`}</p>
            {c.area && (
              <span className="text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {FACET_LABELS[c.area] ?? c.area}
              </span>
            )}
            {c.flagged && (
              <span className="text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldAlert className="h-2.5 w-2.5" /> Flagged
              </span>
            )}
          </div>
          {(c.impacts ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(c.impacts ?? []).map((imp) => (
                <span key={imp} className="text-[12px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {IMPACT_LABELS[imp] ?? imp}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-bold px-2.5 py-1 rounded-full" style={{ color: ratingColor, background: `${ratingColor}18`, border: `1px solid ${ratingColor}40` }}>
            {ratingLabel(c.self)}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded detail — always rendered so it prints in full even when
          collapsed on screen. */}
      <div
        className={`border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-3.5 ${
          open ? "" : "hidden print:block"
        }`}
      >
        {visibleFields.map(([label, val]) => (
          <Field key={label} label={label} value={val!} />
        ))}
        {/* Impact reasons */}
        {Object.entries(c.impactWhy ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => (
          <Field key={k} label={`Impact detail — ${IMPACT_LABELS[k] ?? k}`} value={v} />
        ))}
        {visibleFields.length === 0 && <p className="text-[14px] text-slate-400">No additional detail entered.</p>}
      </div>
    </div>
  );
}

/* ─── Team / Org Entry Card ─── */
function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  const ratingColor = entry.rating === 5 ? "#059669" : entry.rating === 4 ? "#16a34a" : entry.rating === 3 ? "#f59e0b" : entry.rating != null ? "#ef4444" : "#64748b";
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <span className="text-[13px] font-bold text-slate-400 mt-0.5">#{index + 1}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          {entry.text && <p className="text-[15px] text-slate-800 leading-relaxed">{entry.text}</p>}
          {entry.remark && <p className="text-[14px] text-slate-500 italic leading-relaxed">{entry.remark}</p>}
        </div>
        {entry.rating != null && (
          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: ratingColor, background: `${ratingColor}18`, border: `1px solid ${ratingColor}40` }}>
            {entry.rating} — {RATING_LABELS[entry.rating] ?? ""}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Small helpers ─── */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-1.5 mb-3">{icon}<h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{text}</h3></div>;
}

function Band({ band, capped, small }: { band?: string | null; capped?: boolean; small?: boolean }) {
  const color = bandColor(band);
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${small ? "text-[12px] px-2 py-0.5" : "text-[13.5px] px-3.5 py-1.5"}`}
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>
      {band || "Unrated"}{capped ? " ▾" : ""}
    </span>
  );
}

function Pill({ label, value }: { label: string; value?: number | null }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-lg font-bold text-slate-800">{fmtScore(value)}</span>
      <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</span>
    </span>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-sm">
      <span className="font-bold text-slate-700">{label}: </span>
      <span className="text-slate-500 leading-relaxed">{text}</span>
    </div>
  );
}
