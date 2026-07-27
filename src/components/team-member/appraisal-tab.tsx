"use client";

/**
 * Appraisal tab — the TL/CEO evaluation cockpit.
 *
 * Aggregates the objective signals used during appraisal: outcome verdicts,
 * delivery reliability, effort/utilization, and the per-milestone evidence
 * review list — and launches the formal 360° report.
 *
 * Chart colors are a status palette (semantic verdict states, never bare
 * color: every slice/bar ships with a label + count). Chromatic slots
 * (#16a34a / #d97706 / #b91c1c) validated ≥3:1 on white; the gray is the
 * deliberate neutral for Deferred / No-verdict.
 */

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Milestone as MilestoneIcon,
  ScrollText,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiProductivityPanel } from "@/components/ai-productivity-panel";
import { EmployeeReportModal } from "@/components/performance-report";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/api-client";
import {
  ratingBandColor,
  type EmployeeRating,
  type HoursAnalysis,
  type OutcomeSummary,
  type PerformanceProfile,
  type TimelineItem,
  type VerdictKey,
} from "./derive";
import { AttachmentPill, fmtHrs, HoursBar, KpiTile, verdictMeta } from "./shared";

/** Status palette for verdicts — validated (see header comment). */
const VERDICT_COLORS: Record<VerdictKey, string> = {
  met: "#16a34a",
  partially_met: "#d97706",
  not_met: "#b91c1c",
  deferred: "#64748b",
  unclassified: "#6366f1",
  unrecorded: "#cbd5e1",
};

const DONUT_ORDER: VerdictKey[] = ["met", "partially_met", "not_met", "deferred", "unclassified", "unrecorded"];

/** Trend palette (completed / extensions / leaves) — all six checks pass. */
const TREND_COLORS = { completed: "#059669", extensions: "#d97706", leaves: "#2563eb" };

const FILTERS: { key: "all" | VerdictKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "met", label: "Met" },
  { key: "partially_met", label: "Partially met" },
  { key: "not_met", label: "Not met" },
  { key: "deferred", label: "Deferred" },
  { key: "unrecorded", label: "No verdict" },
];

function timelinessChip(t?: { status: TimelineItem["status"]; delayDays: number }) {
  if (!t) return null;
  if (t.status === "completed_on_time")
    return <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 bg-green-50">On time</Badge>;
  if (t.status === "completed_late")
    return <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">Late +{t.delayDays}d</Badge>;
  if (t.status === "overdue")
    return <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50">Overdue +{t.delayDays}d</Badge>;
  return null;
}

export function AppraisalTab({
  user,
  outcomes,
  profile,
  analysis,
  timelineItems,
  rating,
}: {
  user: User;
  outcomes: OutcomeSummary;
  profile: PerformanceProfile;
  analysis: HoursAnalysis;
  timelineItems: TimelineItem[];
  rating: EmployeeRating;
}) {
  const [showReport, setShowReport] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | VerdictKey>("all");

  const donutData = DONUT_ORDER
    .map((k) => ({ key: k, name: verdictMeta[k].label, value: outcomes.counts[k] }))
    .filter((d) => d.value > 0);

  const trendData = profile.scorecard.map((m) => ({
    month: m.label,
    Completed: m.completed,
    Extensions: m.extensions,
    Leaves: m.leaves,
  }));

  const onTimeItems = timelineItems.filter((i) => i.status === "completed_on_time").length;
  const lateItems = timelineItems.filter((i) => i.status === "completed_late").length;
  const overdueItems = timelineItems.filter((i) => i.status === "overdue").length;

  const filteredRows = outcomes.rows.filter((r) => filter === "all" || r.verdictKey === filter);

  return (
    <div className="space-y-6">
      {/* Header row — formal report launcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" />
            Appraisal Evidence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verdicts and evidence here are objective inputs — the formal rating is
            captured in the 360° report.
          </p>
        </div>
        <Button className="btn-gradient gap-1.5" onClick={() => setShowReport(true)}>
          <ScrollText className="h-4 w-4" />
          Open 360° Appraisal Report
        </Button>
      </div>

      {/* Performance Index — how the headline score is built */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Performance Index
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ratingBandColor(rating.band)}`}
            >
              {rating.band}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="text-center sm:text-left shrink-0">
              <span
                className={cn(
                  "stat-number block text-5xl font-extrabold leading-none",
                  rating.score === null
                    ? "text-slate-300"
                    : rating.score >= 85
                      ? "text-emerald-600"
                      : rating.score >= 70
                        ? "text-blue-600"
                        : rating.score >= 50
                          ? "text-amber-600"
                          : "text-red-600",
                )}
              >
                {rating.score === null ? "—" : rating.score}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
                out of 100
                {rating.stars !== null && ` · ${rating.stars.toFixed(1)} ★`}
              </span>
            </div>
            <div className="flex-1 space-y-2.5">
              {rating.components.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium text-slate-700">
                      {c.label}
                      <span className="ml-1.5 text-[10px] text-slate-400">({c.weight}%)</span>
                    </span>
                    <span className="font-mono text-slate-500">
                      {c.score === null ? "no data" : `${c.score}/100`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        c.score === null
                          ? "bg-slate-200"
                          : c.score >= 70
                            ? "bg-emerald-500"
                            : c.score >= 50
                              ? "bg-amber-500"
                              : "bg-red-500",
                      )}
                      style={{ width: `${c.score ?? 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.detail}</p>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-slate-100">
                Computed live from recorded outcomes, delivery timing, evidence and
                hours — dimensions without data are excluded and weights re-balance,
                so the score is never punished for missing signals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* a) Outcome Scorecard */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-600" />
            Outcome Scorecard
            <span className="text-[11px] font-normal text-muted-foreground">
              {outcomes.totalConsidered} completed unit{outcomes.totalConsidered === 1 ? "" : "s"} of work
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {outcomes.totalConsidered === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No outcome verdicts recorded yet — verdicts appear here as milestones
              and tasks are completed with the structured outcome form.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.key} fill={VERDICT_COLORS[d.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="stat-number text-xl font-extrabold text-slate-900">
                    {outcomes.totalConsidered}
                  </span>
                  <span className="text-[10px] text-muted-foreground">outcomes</span>
                </div>
              </div>
              <div className="grid flex-1 w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiTile label="Met" value={`${outcomes.counts.met}`} color="text-green-600" />
                <KpiTile label="Partially met" value={`${outcomes.counts.partially_met}`} color="text-amber-600" />
                <KpiTile label="Not met" value={`${outcomes.counts.not_met}`} color="text-red-600" />
                <KpiTile label="Deferred" value={`${outcomes.counts.deferred}`} color="text-slate-600" />
                <KpiTile
                  label="No verdict"
                  value={`${outcomes.counts.unrecorded + outcomes.counts.unclassified}`}
                  sub={outcomes.counts.unclassified > 0 ? `${outcomes.counts.unclassified} legacy free-text` : "completed before rollout"}
                  color="text-slate-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* b) Delivery Reliability */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              Delivery Reliability
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {profile.adherenceTotal > 0 ? (
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold",
                  profile.onTimePercent >= 70
                    ? "text-green-700 border-green-200 bg-green-50"
                    : profile.onTimePercent >= 40
                      ? "text-amber-700 border-amber-200 bg-amber-50"
                      : "text-red-700 border-red-200 bg-red-50",
                )}>
                  <CheckCircle2 className="h-4 w-4" />
                  {profile.onTimePercent}% on-time
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No dated phases to measure adherence against yet.</span>
              )}
              {profile.lateCount > 0 && (
                <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                  {profile.lateCount} late · avg {profile.avgLateDays}d
                </Badge>
              )}
              {profile.overdueCount > 0 && (
                <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">
                  {profile.overdueCount} overdue now
                </Badge>
              )}
            </div>

            {/* Deliverable timeline rollup */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 border border-green-100 py-2">
                <p className="text-lg font-bold tabular-nums text-green-700">{onTimeItems}</p>
                <p className="text-[10px] text-muted-foreground">On time</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 py-2">
                <p className="text-lg font-bold tabular-nums text-amber-700">{lateItems}</p>
                <p className="text-[10px] text-muted-foreground">Completed late</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 py-2">
                <p className="text-lg font-bold tabular-nums text-red-700">{overdueItems}</p>
                <p className="text-[10px] text-muted-foreground">Overdue</p>
              </div>
            </div>

            {/* Extensions */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Deadline extensions:{" "}
                <span className={cn(
                  "font-semibold",
                  profile.extensionCount === 0 ? "text-green-600" : profile.extensionCount <= 2 ? "text-amber-600" : "text-red-600",
                )}>
                  {profile.extensionCount}
                </span>
                {profile.extensionCount > 0 && (
                  <> — {profile.firstTimeExts} first-time, {profile.repeatExts} escalated</>
                )}
              </p>
              {profile.topReasons.length > 0 && (
                <p>
                  Top reasons:{" "}
                  {profile.topReasons.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] mr-1">{r}</Badge>
                  ))}
                </p>
              )}
            </div>

            {/* Monthly trend */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Last 3 months
              </p>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} barGap={2} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    <Bar dataKey="Completed" fill={TREND_COLORS.completed} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="Extensions" fill={TREND_COLORS.extensions} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="Leaves" fill={TREND_COLORS.leaves} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TREND_COLORS.completed }} /> Completed</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TREND_COLORS.extensions }} /> Extensions</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TREND_COLORS.leaves }} /> Leaves</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* c) Effort & Utilization */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-600" />
              Effort &amp; Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "stat-number text-3xl font-extrabold",
                analysis.variance > 0 ? "text-red-600" : "text-emerald-600",
              )}>
                {analysis.utilization}%
              </span>
              <span className="text-xs text-muted-foreground">
                utilization —{" "}
                {analysis.variance > 0
                  ? `${fmtHrs(analysis.variance)} over plan`
                  : analysis.variance < 0
                    ? `${fmtHrs(-analysis.variance)} under plan`
                    : "on plan"}
              </span>
            </div>
            <div className="space-y-2">
              <HoursBar label="Planned" hours={analysis.totalPlanned} max={Math.max(analysis.totalPlanned, analysis.totalActual, 1)} color="#94a3b8" />
              <HoursBar label="Worked" hours={analysis.totalActual} max={Math.max(analysis.totalPlanned, analysis.totalActual, 1)} color={analysis.variance > 0 ? "#ef4444" : "#8b5cf6"} />
            </div>
            {profile.effortInsight && (
              <p className={cn(
                "text-xs font-semibold flex items-center gap-1.5",
                profile.effortInsight.includes("underestimate") ? "text-amber-600" : "text-green-600",
              )}>
                <TrendingUp className="h-3.5 w-3.5" />
                {profile.effortInsight}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Avg estimated {profile.avgEstimated}h per task
              {profile.avgRevised !== null && <> vs revised {profile.avgRevised}h</>}
              {" · "}{profile.completionPercent}% of all tasks completed
              {" · "}{profile.activeProjectCount} active project{profile.activeProjectCount === 1 ? "" : "s"} of {profile.totalProjects}
            </p>
            {analysis.perProject.length > 0 && (
              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-2">By project</p>
                <div className="space-y-2.5">
                  {analysis.perProject.slice(0, 5).map((p) => {
                    const over = p.actual > p.planned && p.planned > 0;
                    return (
                      <div key={p.title}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700 truncate pr-2">{p.title}</span>
                          <span className={`font-mono shrink-0 ${over ? "text-red-600" : "text-slate-500"}`}>
                            {fmtHrs(p.actual)} / {fmtHrs(p.planned)}
                          </span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-slate-300/70 rounded-full" style={{ width: `${Math.min(100, (p.planned / analysis.maxHours) * 100)}%` }} />
                          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (p.actual / analysis.maxHours) * 100)}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* d) Outcomes & Evidence review list */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-blue-600" />
              Outcomes &amp; Evidence Review
              <span className="text-[11px] font-normal text-muted-foreground">
                {filteredRows.length} of {outcomes.rows.length}
              </span>
            </CardTitle>
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                    filter === f.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-muted-foreground">
              {outcomes.rows.length === 0
                ? "No completed work to review yet"
                : "Nothing matches this filter"}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRows.map((row) => {
                const meta = verdictMeta[row.verdictKey];
                return (
                  <div key={`${row.kind}-${row.id}`} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <MilestoneIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="text-sm font-semibold text-slate-800">{row.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${meta.badge}`}>
                          {row.verdictKey === "unclassified" ? row.rawVerdict : meta.label}
                        </Badge>
                        {timelinessChip(row.timeliness)}
                        {(row.estimated != null || row.actual != null) && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {fmtHrs(row.actual)} / {fmtHrs(row.estimated)}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {row.completedAt ? format(new Date(row.completedAt), "MMM d, yyyy") : "—"}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      <Link href={`/projects/${row.projectId}`} className="text-blue-600 hover:underline">
                        {row.projectTitle}
                      </Link>
                      {row.kind === "milestone" && (
                        <>
                          {" / "}
                          <Link
                            href={`/projects/${row.projectId}?tab=tasks&task=${row.taskId}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {row.taskTitle}
                          </Link>
                        </>
                      )}
                    </p>

                    {row.notes && (
                      <p className="rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 whitespace-pre-wrap">
                        {row.notes}
                      </p>
                    )}

                    {row.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.deliverables.map((d) => (
                          <AttachmentPill key={d.id} d={d} />
                        ))}
                      </div>
                    )}
                    {row.deliverables.length === 0 && (row.attachments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.attachments!.filter((a) => a.url).map((a) => (
                          <a
                            key={a.id}
                            href={a.url ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            <span className="truncate max-w-[150px] font-medium">{a.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* e) AI Productivity Assessment */}
      <AiProductivityPanel userId={user.id} />

      {showReport && (
        <EmployeeReportModal subjectId={user.id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
