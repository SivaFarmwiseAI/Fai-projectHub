"use client";

/** Overview tab — everything at a glance: KPIs, hours, this week's delivery,
 *  daily activity and the outcome-verdict snapshot strip. */

import React from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/api-client";
import type { OutcomeSummary, HoursAnalysis, DailyActivityItem, VerdictKey } from "./derive";
import { DailyActivityList, fmtHrs, HoursBar, KpiTile, verdictMeta, WeekStat } from "./shared";

export function OverviewTab({
  analysis,
  daily,
  outcomes,
  tasks,
  completedTasks,
  totalTasks,
  onOpenOutcomes,
}: {
  analysis: HoursAnalysis;
  daily: { yesterday: DailyActivityItem[]; today: DailyActivityItem[]; tomorrow: DailyActivityItem[] };
  outcomes: OutcomeSummary;
  tasks: Task[];
  completedTasks: number;
  totalTasks: number;
  onOpenOutcomes?: () => void;
}) {
  if (totalTasks === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
        <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-500">No tasks assigned yet</p>
        <p className="text-xs text-muted-foreground">
          Activity, hours and outcomes will appear here once work is assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="animate-fade-in-up stagger-1"><KpiTile label="Planned hours" value={fmtHrs(analysis.totalPlanned)} sub="estimated / revised" color="text-slate-900" /></div>
        <div className="animate-fade-in-up stagger-2"><KpiTile label="Working hours" value={fmtHrs(analysis.totalActual)} sub="actually logged" color="text-violet-600" /></div>
        <div className="animate-fade-in-up stagger-3">
          <KpiTile
            label="Utilization"
            value={`${analysis.utilization}%`}
            sub={analysis.variance > 0 ? `${fmtHrs(analysis.variance)} over` : analysis.variance < 0 ? `${fmtHrs(-analysis.variance)} under` : "on plan"}
            color={analysis.variance > 0 ? "text-red-600" : "text-emerald-600"}
          />
        </div>
        <div className="animate-fade-in-up stagger-4"><KpiTile label="Milestones" value={`${analysis.doneMs}/${analysis.totalMs}`} sub="completed" color="text-indigo-600" /></div>
        <div className="animate-fade-in-up stagger-5"><KpiTile label="Deliverables" value={`${analysis.totalDeliverables}`} sub="submitted" color="text-blue-600" /></div>
        <div className="animate-fade-in-up stagger-6"><KpiTile label="Tasks done" value={`${completedTasks}/${totalTasks}`} sub="all-time" color="text-emerald-600" /></div>
      </div>

      {/* Outcome & Delivery performance — verdicts across tasks & milestones */}
      {outcomes.totalConsidered > 0 && (
        <OutcomeDeliveryCard
          outcomes={outcomes}
          tasks={tasks}
          onOpenOutcomes={onOpenOutcomes}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Estimated vs Working hours ── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-600" />
              Estimated vs Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-2">
              <HoursBar label="Planned" hours={analysis.totalPlanned} max={Math.max(analysis.totalPlanned, analysis.totalActual, 1)} color="#94a3b8" />
              <HoursBar label="Worked" hours={analysis.totalActual} max={Math.max(analysis.totalPlanned, analysis.totalActual, 1)} color={analysis.variance > 0 ? "#ef4444" : "#8b5cf6"} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={analysis.variance > 0 ? "text-red-700 border-red-200 bg-red-50" : "text-emerald-700 border-emerald-200 bg-emerald-50"}>
                {analysis.utilization}% utilization
              </Badge>
              <span className="text-muted-foreground">
                {analysis.variance > 0
                  ? `Working ${fmtHrs(analysis.variance)} over the plan — tends to underestimate`
                  : analysis.variance < 0
                    ? `Working ${fmtHrs(-analysis.variance)} under the plan — efficient / ahead`
                    : "Right on the planned effort"}
              </span>
            </div>

            {/* Per-project breakdown */}
            {analysis.perProject.length > 0 && (
              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-2">By project</p>
                <div className="space-y-2.5">
                  {analysis.perProject.slice(0, 6).map((p) => {
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
                <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /> Planned</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" /> Worked</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── This week's delivery ── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Delivered This Week
              <span className="text-[11px] font-normal text-muted-foreground ml-auto">
                {format(analysis.weekStart, "MMM d")} – {format(analysis.weekEnd, "MMM d")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <WeekStat value={analysis.msDoneThisWeek.length} label="Milestones" color="text-indigo-600" />
              <WeekStat value={analysis.tasksDoneThisWeek.length} label="Tasks" color="text-emerald-600" />
              <WeekStat value={analysis.deliverablesThisWeek.length} label="Deliverables" color="text-blue-600" />
              <WeekStat value={analysis.updatesThisWeek} label="Updates" color="text-slate-700" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Effort delivered: <span className="font-semibold text-slate-700">{fmtHrs(analysis.effortDeliveredThisWeek)}</span> planned
                {analysis.actualDeliveredThisWeek > 0 && <> · <span className="font-semibold text-violet-600">{fmtHrs(analysis.actualDeliveredThisWeek)}</span> worked</>}
              </span>
            </div>

            {analysis.msDoneThisWeek.length === 0 &&
            analysis.deliverablesThisWeek.length === 0 &&
            analysis.tasksDoneThisWeek.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                Nothing completed yet this week
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {/* Grouped by category so tasks, milestones and deliverables
                    never blur into one list */}
                {analysis.tasksDoneThisWeek.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Tasks completed ({analysis.tasksDoneThisWeek.length})
                    </p>
                    {analysis.tasksDoneThisWeek.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded-lg border border-emerald-100 bg-emerald-50/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate flex-1">{t.title}</span>
                        {t.completed_at && (
                          <span className="text-[10px] text-emerald-600 shrink-0">{format(parseISO(t.completed_at), "EEE")}</span>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {analysis.msDoneThisWeek.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      <Target className="h-3 w-3" />
                      Milestones completed ({analysis.msDoneThisWeek.length})
                    </p>
                    {analysis.msDoneThisWeek.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs p-2 rounded-lg border border-indigo-100 bg-indigo-50/40">
                        <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-medium text-slate-800 truncate flex-1">{m.title}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{m._taskTitle}</span>
                        {m.completed_at && (
                          <span className="text-[10px] text-indigo-500 shrink-0">{format(parseISO(m.completed_at), "EEE")}</span>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {analysis.deliverablesThisWeek.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      <FileText className="h-3 w-3" />
                      Deliverables submitted ({analysis.deliverablesThisWeek.length})
                    </p>
                    {analysis.deliverablesThisWeek.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs p-2 rounded-lg border border-blue-100 bg-blue-50/50">
                        <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate flex-1">{d.title}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{d.msTitle}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-600" />
          Daily Activity
          <span className="text-xs font-normal text-muted-foreground ml-1">
            tasks &amp; milestones — completions, updates &amp; due dates
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                <Sunset className="h-4 w-4" />
                Yesterday
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyActivityList items={daily.yesterday} empty="No recorded activity" />
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                <Sun className="h-4 w-4" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyActivityList items={daily.today} empty="No activity logged today yet" />
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                <Sunrise className="h-4 w-4" />
                Tomorrow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyActivityList items={daily.tomorrow} empty="Nothing due or scheduled yet" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Commitment strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
        <span>
          {analysis.totalMs} milestones across {analysis.perProject.length} project{analysis.perProject.length === 1 ? "" : "s"} ·{" "}
          {analysis.doneMs} completed
        </span>
      </div>
    </div>
  );
}

// ── Outcome & Delivery performance card (period-filterable) ──────────────────

type Period = "day" | "week" | "month" | "year";

const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

/** Window for `period` shifted `offset` steps back from now (0 = current). */
function periodWindow(period: Period, offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case "day": {
      const d = addDays(now, offset);
      return {
        start: startOfDay(d),
        end: endOfDay(d),
        label: offset === 0 ? "Today" : offset === -1 ? "Yesterday" : format(d, "EEE, MMM d, yyyy"),
      };
    }
    case "week": {
      const d = addWeeks(now, offset);
      const start = startOfWeek(d, { weekStartsOn: 1 });
      const end = endOfWeek(d, { weekStartsOn: 1 });
      return {
        start,
        end,
        label:
          offset === 0
            ? "This week"
            : offset === -1
              ? "Last week"
              : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      };
    }
    case "month": {
      const d = addMonths(now, offset);
      return {
        start: startOfMonth(d),
        end: endOfMonth(d),
        label: offset === 0 ? "This month" : format(d, "MMMM yyyy"),
      };
    }
    case "year": {
      const d = addYears(now, offset);
      return {
        start: startOfYear(d),
        end: endOfYear(d),
        label: offset === 0 ? "This year" : format(d, "yyyy"),
      };
    }
  }
}

const SEGMENT_ORDER: VerdictKey[] = [
  "met", "partially_met", "not_met", "deferred", "unclassified", "unrecorded",
];

function OutcomeDeliveryCard({
  outcomes,
  tasks,
  onOpenOutcomes,
}: {
  outcomes: OutcomeSummary;
  tasks: Task[];
  onOpenOutcomes?: () => void;
}) {
  const [period, setPeriod] = React.useState<Period>("week");
  // 0 = current window, -1 = previous, -2 = the one before, …
  const [offset, setOffset] = React.useState(0);
  const win = periodWindow(period, offset);
  const inPeriod = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    return isWithinInterval(parseISO(dateStr), { start: win.start, end: win.end });
  };

  const pickPeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  // Outcome rows completed inside the selected window.
  const rows = outcomes.rows.filter((r) => inPeriod(r.completedAt));
  const counts = SEGMENT_ORDER.map((k) => ({
    key: k,
    count: rows.filter((r) => r.verdictKey === k).length,
    meta: verdictMeta[k],
  }));
  const segments = counts.filter((s) => s.count > 0);
  const total = rows.length;
  const metShare = total > 0
    ? Math.round((rows.filter((r) => r.verdictKey === "met").length / total) * 100)
    : null;

  // Delivery vs estimate — hours spent ≤ estimated hours counts as on target.
  // Judged only where both an estimate and logged hours exist.
  const hourJudged = rows.filter((r) => (r.estimated ?? 0) > 0 && r.actual != null);
  const within = hourJudged.filter(
    (r) => (r.actual as number) <= (r.estimated as number),
  ).length;
  const withinPct = hourJudged.length > 0
    ? Math.round((within / hourJudged.length) * 100)
    : null;

  // Completions + evidence submitted inside the period (independent of rows,
  // so a deliverable uploaded this week on older work still counts).
  let msDone = 0;
  let tasksDone = 0;
  let evidence = 0;
  for (const t of tasks) {
    if (t.status === "completed" && inPeriod(t.completed_at)) tasksDone++;
    for (const d of t.deliverables ?? []) {
      if (inPeriod(d.submitted_at ?? d.created_at)) evidence++;
    }
    for (const a of t.attachments ?? []) {
      if (a.url && inPeriod(a.created_at)) evidence++;
    }
    for (const m of t.milestones ?? []) {
      if (m.status === "completed" && inPeriod(m.completed_at)) msDone++;
      for (const d of m.deliverables ?? []) {
        if (inPeriod(d.submitted_at ?? d.created_at)) evidence++;
      }
      for (const a of m.attachments ?? []) {
        if (a.url && inPeriod(a.created_at)) evidence++;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50">
            <Target className="h-3.5 w-3.5 text-indigo-600" />
          </span>
          Outcome &amp; Delivery Performance
          <span className="text-[11px] font-normal text-muted-foreground">
            {total} unit{total === 1 ? "" : "s"} completed
          </span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPeriod(p.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  period === p.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Window navigator — step back through previous days/weeks/… */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label={`Previous ${period}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOffset(0)}
              disabled={offset === 0}
              className={cn(
                "min-w-[110px] rounded-md border px-2 py-1 text-center text-[11px] font-semibold",
                offset === 0
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
              )}
              title={offset === 0 ? undefined : "Back to current"}
            >
              {win.label}
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none"
              aria-label={`Next ${period}`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenOutcomes}
            className="text-[11px] font-medium text-blue-600 hover:underline"
          >
            View details →
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 space-y-3">
        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-muted-foreground">
            Nothing completed in {win.label.toLowerCase()} — use ‹ › to step
            through earlier {period}s or pick a longer period.
          </div>
        ) : (
          <>
            {/* Stacked verdict distribution — the whole story in one bar */}
            <div className="flex h-3.5 w-full gap-0.5 rounded-full overflow-hidden">
              {segments.map((s) => (
                <div
                  key={s.key}
                  className={`${s.meta.dot} first:rounded-l-full last:rounded-r-full transition-all`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={`${s.count} ${s.meta.label}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {segments.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${s.meta.dot}`} />
                  <span className="font-bold tabular-nums">{s.count}</span> {s.meta.label}
                </span>
              ))}
              {metShare !== null && (
                <span className="ml-auto text-[11px] font-semibold text-slate-500">
                  {metShare}% fully met
                </span>
              )}
            </div>
          </>
        )}

        {/* Delivery metrics for the period */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 border border-indigo-100 px-2.5 py-1.5">
            <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">{msDone}</span>{" "}
              milestones
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 border border-emerald-100 px-2.5 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">{tasksDone}</span>{" "}
              tasks done
            </span>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-2.5 py-1.5"
            title="Deliverable records + uploaded files/links submitted in this period"
          >
            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">{evidence}</span>{" "}
              deliverables
            </span>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-2.5 py-1.5"
            title={
              hourJudged.length > 0
                ? `${within} of ${hourJudged.length} completed within estimated hours (spent ≤ estimate)`
                : "Judged once completed work has both an hour estimate and logged hours"
            }
          >
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">
                {withinPct === null ? "—" : `${withinPct}%`}
              </span>{" "}
              within estimate
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
