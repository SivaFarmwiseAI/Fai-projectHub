"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Printer,
  ShieldAlert,
  Users2,
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  Paperclip,
} from "lucide-react";
import {
  performanceAssessments,
  type EmployeeReport,
  type EmployeeReportPeer,
} from "@/lib/api-client";
import {
  bandColor,
  roleLabel,
  levelLabel,
  fmtScore,
  ratingLabel,
  fmtDate,
  PEER_COMPETENCIES,
  PEER_QUESTIONS,
  PEER_SCALE_LABELS,
  MANAGER_QUESTIONS,
  MANAGER_PARAMETERS,
  IMPACT_LABELS,
  CULT_ITEMS,
  RATING_LABELS,
  type Contribution,
  type Entry,
  type PeerData,
  type AssessmentData,
} from "@/lib/performance";
import { printEmployeeReport } from "@/lib/performance-report-print";

/* Data shapes live in @/lib/performance (shared with the print builder);
   re-exported so existing imports from this module keep working. */
export type { Contribution };

const FACET_LABELS: Record<string, string> = {
  eng: "Engineering / Development",
  ds: "Data Science / AI",
  sales: "Sales / Business Development",
  ba: "Product / Business Analysis",
  delivery: "Delivery / Project Management",
  client: "Client Engagement / Management",
};

/* ─── Main Modal ─── */
export function EmployeeReportModal({
  subjectId,
  cycleId,
  onClose,
}: {
  subjectId: string;
  cycleId?: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<EmployeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Which actor's view is on screen; print always includes all three. */
  const [tab, setTab] = useState<"self" | "manager" | "peers">("self");

  useEffect(() => {
    let alive = true;
    performanceAssessments
      .report(subjectId, cycleId)
      .then((r) => {
        if (alive) setReport(r.report);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [subjectId, cycleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // While the report is open, the print stylesheet strips everything on the
  // page except the report, so printing captures only the report document.
  useEffect(() => {
    document.body.classList.add("report-print-open");
    return () => document.body.classList.remove("report-print-open");
  }, []);

  const subject = report?.subject;
  const self = report?.self;
  const rawPeers = report?.peers ?? [];
  // The manager review normally arrives in `report.manager`; if a backend
  // returns it inside the reviews list instead (kind === "manager" or the
  // manager-questionnaire data shape), pick it out so it is never dropped.
  const manager =
    report?.manager ??
    rawPeers.find(
      (p) =>
        p.kind === "manager" ||
        (p.data as PeerData | undefined)?.managerAnswers,
    ) ??
    null;
  const peers = rawPeers.filter((p) => !manager || p.id !== manager.id);
  const data = (self?.data ?? {}) as AssessmentData;
  const contributions = data.contributions ?? [];
  const teamEntries = data.teamEntries ?? [];
  const orgEntries = data.orgEntries ?? [];
  const cultRatings = data.cultRatings ?? {};
  const cultComment = data.cultComment ?? "";
  const gateFlags = data.gateFlags ?? [];
  const color = bandColor(self?.rating_band);
  const submittedPeers = peers.filter((p) => p.status === "submitted").length;
  const printedOn = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 overflow-y-auto bg-black/45 backdrop-blur-sm print:static print:block print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible"
      onClick={onClose}
    >
      <div
        id="report-print"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 animate-scale-in print:shadow-none print:rounded-none print:my-0 print:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white rounded-t-2xl z-10 print:hidden">
          {loading || !subject ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : (
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 ring-2 ring-white shadow"
                style={{ backgroundColor: subject.avatar_color || "#3b82f6" }}
              >
                {subject.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-slate-900 truncate">
                  {subject.name}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {subject.role || "—"}
                  {subject.department ? ` · ${subject.department}` : ""}
                  {subject.manager_name
                    ? ` · Reports to ${subject.manager_name}`
                    : ""}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 shrink-0 print:hidden">
            <button
              onClick={() => report && printEmployeeReport(report)}
              disabled={!report}
              className="h-10 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Couldn&apos;t load this report.
          </div>
        ) : loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="p-5 max-h-[78vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 space-y-6">
            {/* ── Print-only masthead — a proper document header replacing
                 the on-screen modal chrome when the report is printed. ── */}
            {subject && (
              <div className="hidden print:block">
                <div
                  className="h-1.5 rounded-full mb-4"
                  style={{
                    background:
                      "linear-gradient(90deg,#4f46e5,#7c3aed,#2563eb)",
                  }}
                />
                <div className="flex items-end justify-between gap-4 pb-3 border-b-2 border-slate-800">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo-600 mb-1">
                      ProjectHub · Confidential
                    </p>
                    <h1 className="text-[22px] font-extrabold text-slate-900 leading-tight">
                      Performance Assessment Report
                    </h1>
                  </div>
                  <div className="text-right text-[11px] font-semibold text-slate-500 shrink-0">
                    {self?.review_period && (
                      <p>
                        Review period:{" "}
                        <span className="text-slate-800 font-bold">
                          {self.review_period}
                        </span>
                      </p>
                    )}
                    <p>
                      Printed on{" "}
                      <span className="text-slate-800 font-bold">
                        {printedOn}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-4">
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                    style={{
                      backgroundColor: subject.avatar_color || "#3b82f6",
                    }}
                  >
                    {subject.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {subject.name}
                    </h2>
                    <p className="text-[12px] text-slate-500 font-medium">
                      {subject.role || "—"}
                      {subject.department ? ` · ${subject.department}` : ""}
                      {subject.manager_name
                        ? ` · Reports to ${subject.manager_name}`
                        : ""}
                    </p>
                  </div>
                  {self && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-3xl font-extrabold text-slate-900 leading-none">
                          {fmtScore(self.total_score)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mt-1">
                          weighted / 5.0
                        </div>
                      </div>
                      <Band band={self.rating_band} capped={self.capped} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <MastheadStat
                    label="Career level"
                    value={self ? levelLabel(self.career_level) : "—"}
                  />
                  <MastheadStat
                    label="Role area"
                    value={
                      (self?.role_areas ?? []).map(roleLabel).join(", ") || "—"
                    }
                  />
                  <MastheadStat
                    label="Manager review"
                    value={
                      manager?.status === "submitted"
                        ? manager.rating_band || "Submitted"
                        : "Pending"
                    }
                  />
                  <MastheadStat
                    label="Peer reviews"
                    value={`${submittedPeers} of ${peers.length} submitted`}
                  />
                </div>
              </div>
            )}

            {/* ── Actor tabs — self / manager / peers, each viewed separately.
                 Printing always includes all three streams. ── */}
            <div
              className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit max-w-full flex-wrap print:hidden"
              role="tablist"
              aria-label="Report sections"
            >
              <ReportTab active={tab === "self"} onClick={() => setTab("self")}>
                <Award className="h-3.5 w-3.5" /> Self-assessment
                <StatusDot state={self ? "done" : "none"} />
              </ReportTab>
              <ReportTab
                active={tab === "manager"}
                onClick={() => setTab("manager")}
              >
                <Crown className="h-3.5 w-3.5" /> Manager review
                <StatusDot
                  state={
                    manager?.status === "submitted"
                      ? "done"
                      : manager
                        ? "pending"
                        : "none"
                  }
                />
              </ReportTab>
              <ReportTab
                active={tab === "peers"}
                onClick={() => setTab("peers")}
              >
                <Users2 className="h-3.5 w-3.5" /> Peer reviews
                <span className="text-[11px] font-bold text-slate-400">
                  {peers.filter((p) => p.status === "submitted").length}/
                  {peers.length}
                </span>
              </ReportTab>
            </div>

            {/* ═══ Self-assessment ═══ */}
            <div
              className={
                tab === "self"
                  ? "space-y-6"
                  : "hidden print:block print:space-y-6"
              }
            >
              <PrintPartBanner
                part={1}
                title="Self-assessment"
                note="Submitted by the employee"
              />
              {/* ── Score summary ── */}
              <section>
                <SectionLabel
                  icon={<Award className="h-3.5 w-3.5 text-indigo-500" />}
                  text="Self-assessment"
                  className="print:hidden"
                />
                {!self ? (
                  <p className="text-sm text-slate-400">
                    No self-assessment submitted yet.
                  </p>
                ) : (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden print:break-inside-avoid">
                    <div
                      className="px-4 py-3 flex items-center gap-4 flex-wrap"
                      style={{ background: `${color}0d` }}
                    >
                      <div>
                        <div className="text-3xl font-extrabold text-slate-900 leading-none">
                          {fmtScore(self.total_score)}
                        </div>
                        <div className="text-[13px] text-slate-400 font-medium mt-1">
                          weighted / 5.0
                        </div>
                      </div>
                      <Band band={self.rating_band} capped={self.capped} />
                      <div className="flex items-center gap-3 ml-auto flex-wrap">
                        <Pill
                          label="Individual"
                          value={self.individual_score}
                        />
                        <Pill label="Team" value={self.team_score} />
                        <Pill label="Org" value={self.org_score} />
                        <Pill label="Culture" value={self.culture_score} />
                      </div>
                    </div>
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5 border-b border-slate-100">
                      <span className="text-[13px] font-semibold text-slate-500">
                        {levelLabel(self.career_level)}
                      </span>
                      {(self.role_areas ?? []).map((k) => (
                        <span
                          key={k}
                          className="text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full"
                        >
                          {roleLabel(k)}
                        </span>
                      ))}
                      {self.review_period && (
                        <span className="ml-auto text-[15px] text-slate-600 font-semibold">
                          Period: {self.review_period}
                        </span>
                      )}
                    </div>
                    {self.severity && self.severity !== "none" && (
                      <div className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 border-b border-red-100">
                        <ShieldAlert className="h-3.5 w-3.5" /> Integrity gate
                        flagged — {self.severity}
                        {self.capped ? " · rating capped one band" : ""}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Contributions ── */}
              {self && (
                <section>
                  <SectionLabel
                    icon={
                      <span className="text-indigo-500 text-[15px] font-bold">
                        ①
                      </span>
                    }
                    text={`Individual contributions (${contributions.length})`}
                  />
                  {contributions.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No individual contributions were recorded in this
                      submission.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {contributions.map((c, i) => (
                        <ContributionCard key={c.id ?? i} c={c} index={i} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ── Team ── */}
              {self && (
                <section>
                  <SectionLabel
                    icon={
                      <span className="text-blue-500 text-[15px] font-bold">
                        ②
                      </span>
                    }
                    text="Team impact"
                  />
                  {teamEntries.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No team impact entries were recorded in this submission.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {teamEntries.map((e, i) => (
                        <EntryCard key={e.id ?? i} entry={e} index={i} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ── Org ── */}
              {self && (
                <section>
                  <SectionLabel
                    icon={
                      <span className="text-purple-500 text-[15px] font-bold">
                        ③
                      </span>
                    }
                    text="Organisation impact"
                  />
                  {orgEntries.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No organisation impact entries were recorded in this
                      submission.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {orgEntries.map((e, i) => (
                        <EntryCard key={e.id ?? i} entry={e} index={i} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ── Culture ── */}
              {self && CULT_ITEMS.some(([k]) => cultRatings[k] != null) && (
                <section>
                  <SectionLabel
                    icon={
                      <span className="text-emerald-500 text-[15px] font-bold">
                        ④
                      </span>
                    }
                    text="Culture & values"
                  />
                  <div className="rounded-2xl border border-slate-100 p-5 space-y-4 print:break-inside-avoid">
                    {CULT_ITEMS.filter(([k]) => cultRatings[k] != null).map(
                      ([k, label]) => (
                        <div key={k} className="flex items-center gap-5">
                          <span
                            className="w-80 shrink-0 truncate text-[15px] text-slate-700 font-medium"
                            title={label}
                          >
                            {label}
                          </span>
                          <div className="flex-1 min-w-[80px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{
                                width: `${(cultRatings[k] / 5) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-36 shrink-0 text-right text-[14px] font-bold text-slate-700 whitespace-nowrap">
                            {cultRatings[k]} —{" "}
                            {RATING_LABELS[cultRatings[k]] ?? ""}
                          </span>
                        </div>
                      ),
                    )}
                    {cultComment && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          Additional comment
                        </p>
                        <p className="text-[15px] text-slate-600 leading-relaxed">
                          {cultComment}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Integrity Gate ── */}
              {gateFlags.length > 0 && (
                <section>
                  <SectionLabel
                    icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                    text="Integrity gate — flagged behaviours"
                  />
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 flex flex-wrap gap-2">
                    {gateFlags.map((f) => (
                      <span
                        key={f}
                        className="text-[14px] font-semibold text-red-700 bg-white border border-red-200 px-2.5 py-1 rounded-full"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ═══ Manager review (authoritative / final) ═══ */}
            <div
              className={
                tab === "manager"
                  ? "print:break-before-page print:mt-0"
                  : "hidden print:block print:break-before-page print:mt-0"
              }
            >
              <PrintPartBanner
                part={2}
                title="Manager review — final"
                note={
                  manager?.author_name || subject?.manager_name || undefined
                }
              />
              <section>
                <SectionLabel
                  icon={<Crown className="h-3.5 w-3.5 text-indigo-500" />}
                  text="Manager review (final)"
                  className="print:hidden"
                />
                <ManagerReviewCard
                  manager={manager}
                  managerName={subject?.manager_name}
                />
              </section>
            </div>

            {/* ═══ Peer reviews ═══ */}
            <div
              className={
                tab === "peers"
                  ? "print:break-before-page print:mt-0"
                  : "hidden print:block print:break-before-page print:mt-0"
              }
            >
              <PrintPartBanner
                part={3}
                title="Peer reviews"
                note={`${submittedPeers} of ${peers.length} submitted`}
              />
              {/* ── Peer reviews ── */}
              <section>
                <SectionLabel
                  icon={<Users2 className="h-3.5 w-3.5 text-indigo-500" />}
                  text={`Peer reviews (${peers.length})`}
                  className="print:hidden"
                />
                {peers.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No peer reviewers nominated yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {peers.map((p) => {
                      const d = (p.data ?? {}) as PeerData;
                      return (
                        <div
                          key={p.id}
                          className="rounded-2xl border border-slate-200 p-6"
                        >
                          {/* Header */}
                          <div className="flex items-center gap-3.5 pb-4 mb-5 border-b border-slate-100">
                            <div
                              className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                              style={{
                                backgroundColor: p.author_color || "#64748b",
                              }}
                            >
                              {(p.author_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-bold text-slate-900 truncate">
                                {p.author_name || "Peer reviewer"}
                              </p>
                              <p className="text-xs text-slate-400 font-medium">
                                {p.status === "submitted"
                                  ? `Submitted ${fmtDate(p.submitted_at || p.created_at)}`
                                  : "Pending review"}
                              </p>
                            </div>
                            {p.status === "submitted" ? (
                              <Band band={p.rating_band} />
                            ) : (
                              <span className="text-[13px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                                Awaiting
                              </span>
                            )}
                          </div>
                          {p.status === "submitted" ? (
                            <PeerReviewBody
                              d={d}
                              gradient="linear-gradient(90deg,#3b82f6,#6366f1)"
                            />
                          ) : (
                            <p className="text-sm text-slate-400">
                              This reviewer hasn&apos;t submitted yet.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* ── Print-only footer ── */}
            <div className="hidden print:block pt-3 border-t border-slate-200 text-center text-[10px] font-semibold text-slate-400">
              Generated from ProjectHub on {printedOn} · Confidential — for
              internal use only
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab button + status dot for the actor tabs ─── */
function ReportTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
        active
          ? "bg-white text-indigo-600 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/** Green = submitted, amber = pending, grey = not assigned/submitted yet. */
function StatusDot({ state }: { state: "done" | "pending" | "none" }) {
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${
        state === "done"
          ? "bg-emerald-500"
          : state === "pending"
            ? "bg-amber-400"
            : "bg-slate-300"
      }`}
    />
  );
}

/* ─── Manager review — the authoritative third actor ─── */
function ManagerReviewCard({
  manager,
  managerName,
}: {
  manager: EmployeeReportPeer | null;
  managerName?: string | null;
}) {
  if (!manager) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
        <p className="text-sm text-indigo-900/70 font-medium">
          {managerName
            ? `Awaiting review from ${managerName}.`
            : "Manager review pending — assigned once a reporting manager is set."}
        </p>
      </div>
    );
  }
  const d = (manager.data ?? {}) as PeerData;
  const submitted = manager.status === "submitted";
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-6">
      <div className="flex items-center gap-3.5 pb-4 mb-5 border-b border-indigo-100">
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 ring-2 ring-white shadow"
          style={{ backgroundColor: manager.author_color || "#6366f1" }}
        >
          {(manager.author_name || managerName || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-slate-900 truncate">
              {manager.author_name || managerName || "Reporting manager"}
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-full">
              <Crown className="h-3 w-3" /> Manager
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {manager.author_role ? `${manager.author_role} · ` : ""}
            {submitted
              ? `Submitted ${fmtDate(manager.submitted_at || manager.created_at)}`
              : "Pending review"}
          </p>
        </div>
        {submitted ? (
          <Band band={manager.rating_band} />
        ) : (
          <span className="text-[13px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Awaiting
          </span>
        )}
      </div>
      {submitted ? (
        <PeerReviewBody
          d={d}
          gradient="linear-gradient(90deg,#6366f1,#8b5cf6)"
          managerComment
        />
      ) : (
        <p className="text-sm text-slate-400">
          Your manager hasn&apos;t submitted this review yet.
        </p>
      )}
    </div>
  );
}

/* ─── Contribution Card with expand/collapse ─── */
export function ContributionCard({
  c,
  index,
}: {
  c: Contribution;
  index: number;
}) {
  // Open by default: reviewers (TL / leadership) must see everything the
  // employee submitted without having to expand each card.
  const [open, setOpen] = useState(true);
  const ratingColor =
    c.self === 5
      ? "#059669"
      : c.self === 4
        ? "#16a34a"
        : c.self === 3
          ? "#f59e0b"
          : c.self != null
            ? "#ef4444"
            : "#64748b";
  const reviewerColor =
    c.reviewer === 5
      ? "#059669"
      : c.reviewer === 4
        ? "#16a34a"
        : c.reviewer === 3
          ? "#f59e0b"
          : c.reviewer != null
            ? "#ef4444"
            : "#64748b";

  const fields: [string, string | undefined][] = [
    ["Context / background", c.context],
    ["Problem statement", c.problem],
    ["What was created / built", c.create],
    ["What was adopted / used by others", c.adopt],
    ["What changed as a result", c.changed],
    ["Business / team value", c.value],
    ["How to sustain this outcome", c.sustain],
    ["Evidence / proof", c.evidence],
  ];
  const visibleFields = fields.filter(([, v]) => v?.trim());
  const impactWhys = Object.entries(c.impactWhy ?? {}).filter(([, v]) =>
    v?.trim(),
  );
  const customPoints = (c.custom ?? []).filter(
    (p) => p.q?.trim() || p.a?.trim(),
  );
  const hasDetail =
    visibleFields.length > 0 ||
    impactWhys.length > 0 ||
    customPoints.length > 0 ||
    !!c.proofref?.trim() ||
    !!c.prooffilename?.trim() ||
    !!c.proofurl?.trim() ||
    !!c.rjust?.trim();

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      {/* Summary row — always visible */}
      <button
        className="print-visible w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[14px] font-bold text-slate-400">
              #{index + 1}
            </span>
            <p className="text-[15px] font-bold text-slate-900">
              {c.title || `Contribution ${index + 1}`}
            </p>
            {c.area && (
              <span className="text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {FACET_LABELS[c.area] ?? c.area}
              </span>
            )}
            {(c.proofref?.trim() || c.prooffilename?.trim()) && (
              <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Paperclip className="h-2.5 w-2.5" /> Proof attached
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
                <span
                  key={imp}
                  className="text-[12px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full"
                >
                  {IMPACT_LABELS[imp] ?? imp}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[13px] font-bold px-2.5 py-1 rounded-full"
            style={{
              color: ratingColor,
              background: `${ratingColor}18`,
              border: `1px solid ${ratingColor}40`,
            }}
          >
            Self: {ratingLabel(c.self)}
          </span>
          {c.reviewer != null && (
            <span
              className="text-[13px] font-bold px-2.5 py-1 rounded-full"
              style={{
                color: reviewerColor,
                background: `${reviewerColor}18`,
                border: `1px solid ${reviewerColor}40`,
              }}
            >
              Reviewer: {ratingLabel(c.reviewer)}
            </span>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400 print:hidden" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 print:hidden" />
          )}
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
        {/* Proof — link and/or attached file, exactly as the employee entered */}
        {c.proofref?.trim() && (
          <div>
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              Proof — reference / link
            </p>
            {/^https?:\/\//i.test(c.proofref.trim()) ? (
              <a
                href={c.proofref.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] text-indigo-600 font-medium underline underline-offset-2 break-all hover:text-indigo-700"
              >
                {c.proofref.trim()}
              </a>
            ) : (
              <p className="text-[15px] text-slate-700 leading-relaxed break-all">
                {c.proofref}
              </p>
            )}
          </div>
        )}
        {(c.prooffilename?.trim() || c.proofurl?.trim()) && (
          <div>
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              Proof — attached file
            </p>
            {c.proofurl?.trim() ? (
              <a
                href={c.proofurl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[15px] text-indigo-600 font-medium underline underline-offset-2 break-all hover:text-indigo-700"
                title="Open / download the attached proof file"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />{" "}
                {c.prooffilename?.trim() || "Attached file"}
                <span className="text-[12px] font-semibold text-indigo-400">
                  (view)
                </span>
              </a>
            ) : (
              <p className="text-[15px] text-slate-700 leading-relaxed flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />{" "}
                {c.prooffilename}
                <span className="text-[12px] text-slate-400">
                  (file name only — submitted before uploads were stored)
                </span>
              </p>
            )}
          </div>
        )}
        {/* Impact reasons */}
        {impactWhys.map(([k, v]) => (
          <Field
            key={k}
            label={`Impact detail — ${IMPACT_LABELS[k] ?? k}`}
            value={v}
          />
        ))}
        {/* Employee's own points ("+ Add your own point" in the form) */}
        {customPoints.map((p, i) => (
          <Field
            key={`custom-${i}`}
            label={`Own point — ${p.q?.trim() || "untitled"}`}
            value={p.a?.trim() || "—"}
          />
        ))}
        {/* Reviewer justification (reviewer-filled assessments) */}
        {c.rjust?.trim() && (
          <Field label="Reviewer justification" value={c.rjust} />
        )}
        {!hasDetail && (
          <p className="text-[14px] text-slate-400">
            No additional detail entered.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Team / Org Entry Card ─── */
function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  const ratingColor =
    entry.rating === 5
      ? "#059669"
      : entry.rating === 4
        ? "#16a34a"
        : entry.rating === 3
          ? "#f59e0b"
          : entry.rating != null
            ? "#ef4444"
            : "#64748b";
  return (
    <div className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
      <div className="flex items-start gap-3">
        <span className="text-[13px] font-bold text-slate-400 mt-0.5">
          #{index + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          {entry.text && (
            <p className="text-[15px] text-slate-800 leading-relaxed">
              {entry.text}
            </p>
          )}
          {entry.remark && (
            <p className="text-[14px] text-slate-500 italic leading-relaxed">
              {entry.remark}
            </p>
          )}
        </div>
        {entry.rating != null && (
          <span
            className="text-[13px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{
              color: ratingColor,
              background: `${ratingColor}18`,
              border: `1px solid ${ratingColor}40`,
            }}
          >
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
    <div className="print:break-inside-avoid">
      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function SectionLabel({
  icon,
  text,
  className = "",
}: {
  icon: React.ReactNode;
  text: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 mb-3 ${className}`}>
      {icon}
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">
        {text}
      </h3>
    </div>
  );
}

/* ─── Print-only pieces: stream banner + masthead stat tile ─── */
function PrintPartBanner({
  part,
  title,
  note,
}: {
  part: number;
  title: string;
  note?: string;
}) {
  return (
    <div
      className="report-part-banner hidden print:flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4"
      style={{ background: "linear-gradient(90deg,#4f46e5,#6d28d9)" }}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/75">
        Part {part}
      </span>
      <span className="text-[14px] font-extrabold text-white">{title}</span>
      {note && (
        <span className="ml-auto text-[11px] font-semibold text-white/85">
          {note}
        </span>
      )}
    </div>
  );
}

function MastheadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-[12.5px] font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function Band({
  band,
  capped,
  small,
}: {
  band?: string | null;
  capped?: boolean;
  small?: boolean;
}) {
  const color = bandColor(band);
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${small ? "text-[12px] px-2 py-0.5" : "text-[13.5px] px-3.5 py-1.5"}`}
      style={{
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      {band || "Unrated"}
      {capped ? " ▾" : ""}
    </span>
  );
}

function Pill({ label, value }: { label: string; value?: number | null }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-lg font-bold text-slate-800">
        {fmtScore(value)}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </span>
    </span>
  );
}

/** Rating bar + numeric chip used across review answers. */
function RatingLine({ value, gradient }: { value: number; gradient: string }) {
  return (
    <div className="flex items-center gap-3 mt-2.5">
      <div className="flex-1 h-2.5 bg-slate-200/60 rounded-full overflow-hidden max-w-[240px]">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / 5) * 100}%`, background: gradient }}
        />
      </div>
      <span className="text-sm font-bold text-slate-800">{value}/5</span>
      <span className="text-[11px] font-semibold text-slate-400">
        {PEER_SCALE_LABELS[value - 1] ?? ""}
      </span>
    </div>
  );
}

/**
 * Body of a submitted peer/manager review. Renders the manager questionnaire
 * (rating + narrative per question, behavioural parameter grid), the peer
 * questionnaire (written answer per question, 1–5 scale on the overall one),
 * or falls back to the legacy competency bars for reviews saved by old forms.
 */
function PeerReviewBody({
  d,
  gradient,
  managerComment,
}: {
  d: PeerData;
  gradient: string;
  managerComment?: boolean;
}) {
  const ma = d.managerAnswers;
  if (ma) {
    // Answers saved under question keys that are no longer in MANAGER_QUESTIONS
    // (older questionnaire versions) must still be shown, not silently dropped.
    const knownKeys = new Set<string>(MANAGER_QUESTIONS.map((q) => q.key));
    const legacyAnswers = Object.entries(ma).filter(
      ([k, v]) =>
        !knownKeys.has(k) && ((v?.text ?? "").trim() || v?.rating != null),
    );
    return (
      <div className="space-y-4">
        {MANAGER_QUESTIONS.filter(
          (q) =>
            (ma[q.key]?.text ?? "").trim() ||
            ma[q.key]?.rating != null ||
            (q.grid && d.parameters) ||
            (q.gate && (d.severity || (d.gateFlags?.length ?? 0) > 0)),
        ).map((q) => (
          <div
            key={q.key}
            className="rounded-xl bg-slate-50/70 border border-slate-100 p-4 print:break-inside-avoid"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-400 mb-0.5">
              {q.short}
            </p>
            <p className="text-[13px] font-semibold text-slate-700 leading-snug">
              {q.question}
            </p>
            {q.grid ? (
              <div className="space-y-2.5 mt-3">
                {MANAGER_PARAMETERS.filter(
                  (p) => d.parameters?.[p.key] != null,
                ).map((p) => (
                  <div key={p.key} className="flex items-center gap-4">
                    <span className="w-56 shrink-0 text-[13px] font-medium text-slate-600 truncate">
                      {p.label}
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-200/60 rounded-full overflow-hidden max-w-[240px]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(d.parameters![p.key] / 5) * 100}%`,
                          background: gradient,
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-6 text-right">
                      {d.parameters![p.key]}
                    </span>
                  </div>
                ))}
              </div>
            ) : q.gate ? (
              <div className="mt-3 space-y-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full ${
                    !d.severity || d.severity === "none"
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : "text-red-700 bg-red-50 border border-red-200"
                  }`}
                >
                  {(d.severity ?? "none") !== "none" && (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                  {!d.severity || d.severity === "none"
                    ? "No concerns"
                    : d.severity === "concern"
                      ? "Concern noted"
                      : "Serious concern — rating capped one band"}
                </span>
                {(d.gateFlags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.gateFlags!.map((f) => (
                      <span
                        key={f}
                        className="text-[12px] font-semibold text-red-700 bg-white border border-red-200 px-2.5 py-0.5 rounded-full"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              ma[q.key]?.rating != null && (
                <RatingLine value={ma[q.key]!.rating!} gradient={gradient} />
              )
            )}
            {(ma[q.key]?.text ?? "").trim() && (
              <p className="text-sm text-slate-500 leading-relaxed mt-2 whitespace-pre-wrap">
                {ma[q.key]!.text}
              </p>
            )}
          </div>
        ))}
        {legacyAnswers.map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl bg-slate-50/70 border border-slate-100 p-4 print:break-inside-avoid"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-400 mb-0.5">
              {k}
            </p>
            {v?.rating != null && (
              <RatingLine value={v.rating} gradient={gradient} />
            )}
            {(v?.text ?? "").trim() && (
              <p className="text-sm text-slate-500 leading-relaxed mt-2 whitespace-pre-wrap">
                {v.text}
              </p>
            )}
          </div>
        ))}
        {legacyAnswers.length === 0 &&
          !MANAGER_QUESTIONS.some(
            (q) =>
              (ma[q.key]?.text ?? "").trim() ||
              ma[q.key]?.rating != null ||
              (q.grid && d.parameters),
          ) && (
            <p className="text-sm text-slate-400">
              This review was submitted without readable answers.
            </p>
          )}
      </div>
    );
  }

  const answers = d.answers;
  if (answers) {
    return (
      <div className="space-y-4">
        {PEER_QUESTIONS.filter((q) => (answers[q.key] ?? "").trim()).map(
          (q) => (
            <div
              key={q.key}
              className="rounded-xl bg-slate-50/70 border border-slate-100 p-4 print:break-inside-avoid"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                {q.short}
              </p>
              <p className="text-[13px] font-semibold text-slate-700 leading-snug">
                {q.question}
              </p>
              {q.scale && d.overall != null && (
                <RatingLine value={d.overall} gradient={gradient} />
              )}
              <p className="text-sm text-slate-500 leading-relaxed mt-2 whitespace-pre-wrap">
                {answers[q.key]}
              </p>
            </div>
          ),
        )}
      </div>
    );
  }

  // Legacy competency-based review
  const comps = d.competencies ?? {};
  return (
    <>
      <div className="space-y-4">
        {PEER_COMPETENCIES.filter((c) => comps[c.key] != null).map((c) => (
          <div key={c.key} className="flex items-center gap-4">
            <span className="w-56 shrink-0 text-sm font-medium text-slate-600 truncate">
              {c.label}
            </span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(comps[c.key] / 5) * 100}%`,
                  background: gradient,
                }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700 w-6 text-right">
              {comps[c.key]}
            </span>
          </div>
        ))}
      </div>
      {(d.strengths || d.improvements || (managerComment && d.comment)) && (
        <div className="space-y-4 mt-5 pt-5 border-t border-slate-100">
          {d.strengths && <Note label="Strengths" text={d.strengths} />}
          {d.improvements && <Note label="To improve" text={d.improvements} />}
          {managerComment && d.comment && (
            <Note label="Manager comment" text={d.comment} />
          )}
        </div>
      )}
    </>
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
