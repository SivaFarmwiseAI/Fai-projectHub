"use client";

/** Overview tab — everything at a glance: KPIs, hours, this week's delivery,
 *  daily activity and the outcome-verdict snapshot strip. */

import React from "react";
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { PERIODS, periodWindow, type Period } from "@/lib/period";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
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
import type { Project, Task } from "@/lib/api-client";
import type { OutcomeSummary, HoursAnalysis, DailyActivityItem, VerdictKey } from "./derive";
import { DailyActivityList, deliverableTypeIcons, deliverableTypeLabels, fmtHrs, HoursBar, KpiTile, verdictMeta, WeekStat } from "./shared";

/** The card's active filters, carried into the Tasks & Outcomes tab by
 *  "View details" so the reader keeps their context. */
export type CarriedFilters = {
  projectId: string; // "all" or a project id
  kind: "all" | "milestone" | "task";
  windowLabel: string;
  /** Window bounds (ISO) — the tab filters its list by these. */
  windowStart: string;
  windowEnd: string;
};

export function OverviewTab({
  analysis,
  daily,
  outcomes,
  tasks,
  projectById,
  completedTasks,
  totalTasks,
  onOpenOutcomes,
}: {
  analysis: HoursAnalysis;
  daily: { yesterday: DailyActivityItem[]; today: DailyActivityItem[]; tomorrow: DailyActivityItem[] };
  outcomes: OutcomeSummary;
  tasks: Task[];
  projectById: Record<string, Project>;
  completedTasks: number;
  totalTasks: number;
  onOpenOutcomes?: (carried: CarriedFilters) => void;
}) {
  // Collapsible category groups in "Delivered This Week".
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    tasks: true,
    milestones: true,
    deliverables: true,
  });
  const toggleGroup = (key: string) =>
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }));

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
          projectById={projectById}
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
                {/* Grouped by category; headers collapse, rows navigate */}
                {analysis.tasksDoneThisWeek.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup("tasks")}
                      className="flex w-full items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", !openGroups.tasks && "-rotate-90")} />
                      <CheckCircle2 className="h-3 w-3" />
                      Tasks completed ({analysis.tasksDoneThisWeek.length})
                    </button>
                    {openGroups.tasks && analysis.tasksDoneThisWeek.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.project_id}?tab=tasks&task=${t.id}`}
                        className="flex items-center gap-2 text-xs p-2 rounded-lg border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                        title="Open this task in its project"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate flex-1">{t.title}</span>
                        {t.completed_at && (
                          <span className="text-[10px] text-emerald-600 shrink-0">{format(parseISO(t.completed_at), "EEE")}</span>
                        )}
                        <ChevronRight className="h-3 w-3 text-emerald-400 shrink-0" />
                      </Link>
                    ))}
                  </>
                )}
                {analysis.msDoneThisWeek.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup("milestones")}
                      className="flex w-full items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", !openGroups.milestones && "-rotate-90")} />
                      <Target className="h-3 w-3" />
                      Milestones completed ({analysis.msDoneThisWeek.length})
                    </button>
                    {openGroups.milestones && analysis.msDoneThisWeek.map((m) => (
                      <Link
                        key={m.id}
                        href={`/projects/${m._projectId}?tab=tasks&task=${m._taskId}`}
                        className="flex items-center gap-2 text-xs p-2 rounded-lg border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                        title={`Open task "${m._taskTitle}"`}
                      >
                        <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-medium text-slate-800 truncate flex-1">{m.title}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{m._taskTitle}</span>
                        {m.completed_at && (
                          <span className="text-[10px] text-indigo-500 shrink-0">{format(parseISO(m.completed_at), "EEE")}</span>
                        )}
                        <ChevronRight className="h-3 w-3 text-indigo-400 shrink-0" />
                      </Link>
                    ))}
                  </>
                )}
                {analysis.deliverablesThisWeek.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup("deliverables")}
                      className="flex w-full items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", !openGroups.deliverables && "-rotate-90")} />
                      <FileText className="h-3 w-3" />
                      Deliverables submitted ({analysis.deliverablesThisWeek.length})
                    </button>
                    {openGroups.deliverables && analysis.deliverablesThisWeek.map((d) =>
                      d.url ? (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs p-2 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                          title="Open the deliverable"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate flex-1">{d.title}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{d.msTitle}</span>
                          <ExternalLink className="h-3 w-3 text-blue-400 shrink-0" />
                        </a>
                      ) : (
                        <Link
                          key={d.id}
                          href={`/projects/${d._projectId}?tab=tasks&task=${d._taskId}`}
                          className="flex items-center gap-2 text-xs p-2 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                          title="Open the task this deliverable belongs to"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate flex-1">{d.title}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px] shrink-0">{d.msTitle}</span>
                          <ChevronRight className="h-3 w-3 text-blue-400 shrink-0" />
                        </Link>
                      ),
                    )}
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

const SEGMENT_ORDER: VerdictKey[] = [
  "met", "partially_met", "not_met", "deferred", "unclassified", "unrecorded",
];

const UNIT_STATUS_SEGMENTS = [
  { key: "in_progress", label: "In progress", bar: "bg-blue-500" },
  { key: "open", label: "Not started", bar: "bg-slate-500" },
  { key: "blocked", label: "Blocked", bar: "bg-red-500" },
  { key: "done", label: "Done", bar: "bg-emerald-500" },
] as const;

type UnitCounts = { in_progress: number; open: number; blocked: number; done: number };

function UnitStatusBar({ c }: { c: UnitCounts }) {
  const t = c.in_progress + c.open + c.blocked + c.done;
  return (
    <div className="flex h-3 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
      {t > 0 &&
        UNIT_STATUS_SEGMENTS.map((s) => {
          const v = c[s.key];
          if (!v) return null;
          return (
            <div
              key={s.key}
              className={s.bar}
              style={{ width: `${(v / t) * 100}%` }}
              title={`${v} ${s.label.toLowerCase()}`}
            />
          );
        })}
    </div>
  );
}

/** Stacked verdict-distribution bar for a set of outcome rows. */
function VerdictBar({ rows }: { rows: { verdictKey: VerdictKey }[] }) {
  const total = rows.length;
  const segs = SEGMENT_ORDER
    .map((k) => ({ key: k, count: rows.filter((r) => r.verdictKey === k).length, meta: verdictMeta[k] }))
    .filter((s) => s.count > 0);
  return (
    <div className="flex h-3 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
      {total > 0 &&
        segs.map((s) => (
          <div
            key={s.key}
            className={s.meta.dot}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.count} ${s.meta.label}`}
          />
        ))}
    </div>
  );
}

/** Row label identifying which kind of work a bar belongs to. */
function KindTag({ kind, count }: { kind: "milestone" | "task"; count: number }) {
  const Icon = kind === "milestone" ? Target : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex w-28 items-center gap-1 text-[10px] font-semibold shrink-0",
        kind === "milestone" ? "text-indigo-600" : "text-emerald-700",
      )}
    >
      <Icon className="h-3 w-3" />
      {kind === "milestone" ? "Milestones" : "Tasks"} ({count})
    </span>
  );
}

function OutcomeDeliveryCard({
  outcomes,
  tasks,
  projectById,
  onOpenOutcomes,
}: {
  outcomes: OutcomeSummary;
  tasks: Task[];
  projectById: Record<string, Project>;
  onOpenOutcomes?: (carried: CarriedFilters) => void;
}) {
  const [period, setPeriod] = React.useState<Period | "custom">("week");
  // 0 = current window, -1 = previous, -2 = the one before, …
  const [offset, setOffset] = React.useState(0);
  const [lens, setLens] = React.useState<"outcomes" | "status" | "project" | "deliverable">("outcomes");
  // Custom range (yyyy-mm-dd) — applied once both ends are chosen.
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const customReady = period === "custom" && !!customFrom && !!customTo;
  const win = React.useMemo(() => {
    if (customReady) {
      const a = parseISO(customFrom);
      const b = parseISO(customTo);
      const [from, to] = a <= b ? [a, b] : [b, a];
      return {
        start: startOfDay(from),
        end: endOfDay(to),
        label: `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
      };
    }
    // Custom picked but incomplete → keep showing the current week.
    return periodWindow(period === "custom" ? "week" : period, offset);
  }, [period, offset, customReady, customFrom, customTo]);
  const inPeriod = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    return isWithinInterval(parseISO(dateStr), { start: win.start, end: win.end });
  };

  const pickPeriod = (p: Period | "custom") => {
    setPeriod(p);
    setOffset(0);
  };

  // ── Kind filter — everything, only milestones, or only bare tasks ──
  const [kindFilter, setKindFilter] = React.useState<"all" | "milestone" | "task">("all");

  // ── Project filter — scopes every lens and the metrics strip ──
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const projectOptions = React.useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.project_id))];
    return ids
      .map((id) => ({ id, title: projectById[id]?.title ?? "Unknown project" }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks, projectById]);
  const scopedTasks =
    projectFilter === "all" ? tasks : tasks.filter((t) => t.project_id === projectFilter);

  // ── Work units: each milestone, or the task itself when it has none ──
  const normStatus = (s: string): "in_progress" | "open" | "blocked" | "completed" => {
    if (s === "in_progress" || s === "blocked" || s === "completed") return s;
    return "open";
  };
  type Unit = {
    id: string;
    kind: "milestone" | "task";
    status: string;
    projectId: string;
    completedAt?: string | null;
    startDate?: string | null;
  };
  const allUnits: Unit[] = [];
  const allEvidence: { id: string; kind: "milestone" | "task"; type: string; submittedAt?: string | null }[] = [];
  for (const t of scopedTasks) {
    const ms = t.milestones ?? [];
    if (ms.length > 0) {
      for (const m of ms) {
        allUnits.push({ id: m.id, kind: "milestone", status: m.status, projectId: t.project_id, completedAt: m.completed_at, startDate: m.start_date });
        for (const d of m.deliverables ?? [])
          allEvidence.push({ id: d.id, kind: "milestone", type: d.type, submittedAt: m.completed_at ?? m.start_date });
        for (const a of m.attachments ?? [])
          if (a.url) allEvidence.push({ id: a.id, kind: "milestone", type: "link", submittedAt: m.completed_at ?? m.start_date });
      }
    } else {
      allUnits.push({ id: t.id, kind: "task", status: t.status, projectId: t.project_id, completedAt: t.completed_at, startDate: t.created_at?.slice(0, 10) ?? null });
      for (const d of t.deliverables ?? [])
        allEvidence.push({ id: d.id, kind: "task", type: d.type, submittedAt: t.completed_at });
      for (const a of t.attachments ?? [])
        if (a.url) allEvidence.push({ id: a.id, kind: "task", type: "link", submittedAt: t.completed_at });
    }
  }
  const units = kindFilter === "all" ? allUnits : allUnits.filter((u) => u.kind === kindFilter);
  const evidenceRows = kindFilter === "all" ? allEvidence : allEvidence.filter((e) => e.kind === kindFilter);
  // Window rule: completed units filter by their END date; open units fall
  // back to their START date, so every week shows its own picture.
  const segmentCounts = (list: Unit[]) => {
    const c = { in_progress: 0, open: 0, blocked: 0, done: 0 };
    for (const u of list) {
      const s = normStatus(u.status);
      if (s === "completed") {
        if (inPeriod(u.completedAt)) c.done++;
      } else if (inPeriod(u.startDate)) {
        c[s]++;
      }
    }
    return c;
  };

  // Outcome rows completed inside the selected window (+ project/kind scope).
  const rows = outcomes.rows.filter(
    (r) =>
      (projectFilter === "all" || r.projectId === projectFilter) &&
      (kindFilter === "all" || r.kind === kindFilter) &&
      inPeriod(r.completedAt),
  );
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

  // Same window rule as a reusable predicate — used so every count shown
  // next to a windowed bar agrees with the bar.
  const inScopeWindow = (u: Unit) =>
    normStatus(u.status) === "completed"
      ? inPeriod(u.completedAt)
      : inPeriod(u.startDate);
  const windowTotal = (c: { in_progress: number; open: number; blocked: number; done: number }) =>
    c.in_progress + c.open + c.blocked + c.done;

  // In "All work" mode, split the graphs per kind so milestones and tasks are
  // identifiable at a glance (only when both kinds actually have data).
  const rowsMs = rows.filter((r) => r.kind === "milestone");
  const rowsTask = rows.filter((r) => r.kind === "task");
  const splitOutcomes = kindFilter === "all" && rowsMs.length > 0 && rowsTask.length > 0;
  const msUnits = units.filter((u) => u.kind === "milestone");
  const taskUnits = units.filter((u) => u.kind === "task");
  const msCounts = segmentCounts(msUnits);
  const taskCounts = segmentCounts(taskUnits);
  const splitStatus =
    kindFilter === "all" && windowTotal(msCounts) > 0 && windowTotal(taskCounts) > 0;

  // On-time — each milestone judged against its own end date: completed on
  // or before it counts on time. Undated work is excluded, never penalized.
  const dated = rows.filter(
    (r) =>
      r.hasDeadline &&
      (r.timeliness?.status === "completed_on_time" ||
        r.timeliness?.status === "completed_late"),
  );
  const onTime = dated.filter((r) => r.timeliness!.status === "completed_on_time").length;
  const withinPct = dated.length > 0 ? Math.round((onTime / dated.length) * 100) : null;

  // Completions + evidence inside the window — derived from the same
  // filtered units/evidence, so every chip follows project AND kind scope.
  const doneInWindow = (kind: "milestone" | "task") =>
    units.filter(
      (u) => u.kind === kind && normStatus(u.status) === "completed" && inPeriod(u.completedAt),
    ).length;
  const msDone = doneInWindow("milestone");
  const tasksDone = doneInWindow("task");
  let evidence = 0;
  for (const e of evidenceRows) if (inPeriod(e.submittedAt)) evidence++;

  const statusCounts = segmentCounts(units);
  const statusTotal =
    statusCounts.in_progress + statusCounts.open + statusCounts.blocked + statusCounts.done;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50">
            <Target className="h-3.5 w-3.5 text-indigo-600" />
          </span>
          Outcome &amp; Delivery Performance
        </h3>
        {/* Scope dropdowns — pinned top-right beside the title */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={cn(
              "h-7 max-w-[180px] rounded-lg border bg-white px-2 text-[11px] font-medium",
              projectFilter === "all"
                ? "border-slate-200 text-slate-600"
                : "border-blue-300 text-blue-700 bg-blue-50/50",
            )}
            title="Scope the card to one project"
          >
            <option value="all">All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | "milestone" | "task")}
            className={cn(
              "h-7 rounded-lg border bg-white px-2 text-[11px] font-medium",
              kindFilter === "all"
                ? "border-slate-200 text-slate-600"
                : "border-indigo-300 text-indigo-700 bg-indigo-50/50",
            )}
            title="Scope to milestones or bare tasks"
          >
            <option value="all">All work</option>
            <option value="milestone">Milestones only</option>
            <option value="task">Tasks only</option>
          </select>
          {(projectFilter !== "all" ||
            kindFilter !== "all" ||
            period !== "week" ||
            offset !== 0 ||
            customFrom ||
            customTo) && (
            <button
              type="button"
              onClick={() => {
                setProjectFilter("all");
                setKindFilter("all");
                setPeriod("week");
                setOffset(0);
                setCustomFrom("");
                setCustomTo("");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              title="Reset project, work kind and time window to defaults"
            >
              Clear filters ×
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onOpenOutcomes?.({
                projectId: projectFilter,
                kind: kindFilter,
                windowLabel: win.label,
                windowStart: win.start.toISOString(),
                windowEnd: win.end.toISOString(),
              })
            }
            className="text-[11px] font-medium text-blue-600 hover:underline"
          >
            View details →
          </button>
        </div>
      </div>

      {/* Lens + time controls on their own row */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
          {/* Lens switch — same board language as the team page */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                { id: "outcomes", label: "Outcomes" },
                { id: "status", label: "Status" },
                { id: "project", label: "Project" },
                { id: "deliverable", label: "Deliverable" },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLens(l.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  lens === l.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {[...PERIODS, { id: "custom" as const, label: "Custom" }].map((p) => (
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
          {period === "custom" ? (
            /* Custom range — both ends required before it applies */
            <div className="inline-flex items-center gap-1">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 cursor-pointer"
                aria-label="From date"
              />
              <span className="text-[11px] text-muted-foreground">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 cursor-pointer"
                aria-label="To date"
              />
              {!customReady && (
                <span className="text-[10px] text-amber-600 font-medium">
                  pick both dates
                </span>
              )}
            </div>
          ) : (
            /* Window navigator — step back through previous days/weeks/… */
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
                  "min-w-[104px] rounded-md border px-2 py-1 text-center text-[11px] font-semibold",
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
          )}
        </div>
      </div>

      <div className="px-4 pb-5 pt-4 space-y-4">
        {/* ── Lens: outcome verdicts ── */}
        {lens === "outcomes" &&
          (total === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-muted-foreground">
              Nothing completed in {win.label.toLowerCase()} —{" "}
              {period === "custom"
                ? "adjust the date range above."
                : `use ‹ › to step through earlier ${period}s or pick a longer period.`}
            </div>
          ) : (
            <>
              {splitOutcomes ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <KindTag kind="milestone" count={rowsMs.length} />
                    <VerdictBar rows={rowsMs} />
                  </div>
                  <div className="flex items-center gap-2">
                    <KindTag kind="task" count={rowsTask.length} />
                    <VerdictBar rows={rowsTask} />
                  </div>
                </div>
              ) : (
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
              )}
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
          ))}

        {/* ── Lens: current pipeline by status ── */}
        {lens === "status" && (
          <>
            {splitStatus ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <KindTag kind="milestone" count={windowTotal(msCounts)} />
                  <UnitStatusBar c={msCounts} />
                </div>
                <div className="flex items-center gap-2">
                  <KindTag kind="task" count={windowTotal(taskCounts)} />
                  <UnitStatusBar c={taskCounts} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <UnitStatusBar c={statusCounts} />
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {statusTotal} unit{statusTotal === 1 ? "" : "s"}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {UNIT_STATUS_SEGMENTS.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                  <span className="font-bold tabular-nums">
                    {statusCounts[s.key]}
                  </span>{" "}
                  {s.key === "done" ? `Done (${win.label.toLowerCase()})` : s.label}
                </span>
              ))}
            </div>
          </>
        )}

        {/* ── Lens: per project ── */}
        {lens === "project" && (
          <div className="space-y-1.5">
            {(() => {
              const byProject = new Map<string, Unit[]>();
              for (const u of units) {
                if (!byProject.has(u.projectId)) byProject.set(u.projectId, []);
                byProject.get(u.projectId)!.push(u);
              }
              const rows2 = [...byProject.entries()]
                .map(([pid, list]) => ({
                  pid,
                  c: segmentCounts(list),
                  // Counters follow the same window as the bar beside them.
                  ms: list.filter((u) => u.kind === "milestone" && inScopeWindow(u)).length,
                  tk: list.filter((u) => u.kind === "task" && inScopeWindow(u)).length,
                }))
                // Projects with nothing in this window don't render a dead row.
                .filter((r) => windowTotal(r.c) > 0)
                .sort((a, b) => (b.c.done + b.c.in_progress) - (a.c.done + a.c.in_progress));
              if (rows2.length === 0)
                return (
                  <p className="py-5 text-center text-xs text-muted-foreground">
                    No project work in {win.label.toLowerCase()} — use ‹ › or a longer period.
                  </p>
                );
              return rows2.map(({ pid, c, ms, tk }) => (
                <Link
                  key={pid}
                  href={`/projects/${pid}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
                >
                  <FolderKanban className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="w-44 truncate text-xs font-medium text-slate-800 shrink-0">
                    {projectById[pid]?.title ?? "Unknown project"}
                  </span>
                  <UnitStatusBar c={c} />
                  {kindFilter === "all" && (
                    <span
                      className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 tabular-nums"
                      title={`${ms} milestone${ms === 1 ? "" : "s"} · ${tk} task${tk === 1 ? "" : "s"}`}
                    >
                      <Target className="h-3 w-3 text-indigo-400" />
                      {ms}
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />
                      {tk}
                    </span>
                  )}
                  <span className="w-28 text-right text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {c.done} done · {c.in_progress} active
                  </span>
                </Link>
              ));
            })()}
          </div>
        )}

        {/* ── Lens: deliverable types submitted in window ── */}
        {lens === "deliverable" && (
          <div className="space-y-1.5">
            {(() => {
              const byType = new Map<string, { count: number; ms: number; tk: number }>();
              for (const e of evidenceRows) {
                if (!inPeriod(e.submittedAt)) continue;
                if (!byType.has(e.type)) byType.set(e.type, { count: 0, ms: 0, tk: 0 });
                const r = byType.get(e.type)!;
                r.count++;
                if (e.kind === "milestone") r.ms++;
                else r.tk++;
              }
              const sorted = [...byType.entries()].sort((a, b) => b[1].count - a[1].count);
              if (sorted.length === 0)
                return (
                  <p className="py-5 text-center text-xs text-muted-foreground">
                    No deliverables submitted in {win.label.toLowerCase()} —{" "}
                    {period === "custom"
                      ? "adjust the date range above."
                      : `use ‹ › to look at earlier ${period}s.`}
                  </p>
                );
              const max = sorted[0][1].count;
              return sorted.map(([type, r]) => (
                <div key={type} className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2">
                  <span className="text-sm shrink-0">{deliverableTypeIcons[type] || "🔗"}</span>
                  <span className="w-40 truncate text-xs font-medium text-slate-800 shrink-0">
                    {type === "link" ? "File / Link" : deliverableTypeLabels[type] || type}
                  </span>
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                  {kindFilter === "all" && (
                    <span
                      className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 tabular-nums"
                      title={`${r.ms} from milestones · ${r.tk} from tasks`}
                    >
                      <Target className="h-3 w-3 text-indigo-400" />
                      {r.ms}
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />
                      {r.tk}
                    </span>
                  )}
                  <span className="w-10 text-right text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                    {r.count}
                  </span>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Delivery metrics for the period — shared across lenses */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div
            className="flex items-center gap-2 rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2"
            title={`${msDone} completed in this window, of ${msUnits.length} milestone${msUnits.length === 1 ? "" : "s"} in the current scope`}
          >
            <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">
                {msDone === 0 ? "0" : `${msDone}/${msUnits.length}`}
              </span>{" "}
              milestones done
            </span>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2"
            title={`${tasksDone} completed in this window, of ${taskUnits.length} task${taskUnits.length === 1 ? "" : "s"} in the current scope`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">
                {tasksDone === 0 ? "0" : `${tasksDone}/${taskUnits.length}`}
              </span>{" "}
              tasks done
            </span>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2"
            title="Deliverable records + uploaded files/links submitted in this period"
          >
            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">{evidence}</span>{" "}
              deliverables
            </span>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2"
            title={
              dated.length > 0
                ? `${onTime} of ${dated.length} completed on or before their end date`
                : "Judged once dated milestones are completed (each against its own end date)"
            }
          >
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] text-slate-600">
              <span className="stat-number font-extrabold text-slate-900">
                {withinPct === null ? "—" : `${withinPct}%`}
              </span>{" "}
              on time
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
