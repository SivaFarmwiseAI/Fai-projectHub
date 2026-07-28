"use client";

/**
 * Team Delivery Board — the CEO/TL cockpit on the team page.
 *
 * One board, three lenses over the same work units (milestones, plus
 * milestone-less tasks):
 *   Status      — each member's current pipeline + what they finished in the window
 *   Project     — the same distribution grouped per project, with who's on it
 *   Deliverable — what kinds of evidence were submitted in the window, by whom
 * All completion/submission figures follow the Day/Week/Month/Year navigator.
 */

import React from "react";
import Link from "next/link";
import { endOfDay, format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  LayoutGrid,
  Loader2,
  Target,
  Users,
} from "lucide-react";
import {
  projects as projectsApi,
  users as usersApi,
  type Project,
  type Task,
  type User,
} from "@/lib/api-client";
import { PERIODS, periodWindow, type Period } from "@/lib/period";
import { classifyVerdict } from "@/components/team-member/derive";
import { deliverableTypeIcons, deliverableTypeLabels } from "@/components/team-member/shared";
import { cn } from "@/lib/utils";

// One judgeable unit of work: a milestone, or a task without milestones.
// A task WITH milestones is represented by its milestones only — the parent
// task is never counted again, so nothing is double-counted.
type WorkUnit = {
  id: string;
  kind: "milestone" | "task";
  title: string;
  status: string; // planning|pending / in_progress / completed / blocked
  projectId: string;
  memberId: string;
  completedAt?: string | null;
  targetDate?: string | null;
  /** Windowing fallback for open units (bare tasks use their creation day). */
  startDate?: string | null;
  verdictKey: ReturnType<typeof classifyVerdict>;
  estimatedHours: number;
  actualHours: number;
};

type Evidence = {
  id: string;
  kind: "milestone" | "task";
  type: string; // deliverable_type, or "link" for url-only attachments
  submittedAt?: string | null;
  memberId: string;
  projectId: string;
};

type MemberData = { user: User; tasks: Task[] };

const STATUS_SEGMENTS = [
  { key: "in_progress", label: "In progress", bar: "bg-blue-500" },
  { key: "open", label: "Not started", bar: "bg-slate-500" },
  { key: "blocked", label: "Blocked", bar: "bg-red-500" },
  { key: "done", label: "Done in window", bar: "bg-emerald-500" },
] as const;

function normUnitStatus(s: string): "in_progress" | "open" | "blocked" | "completed" {
  if (s === "in_progress") return "in_progress";
  if (s === "blocked") return "blocked";
  if (s === "completed") return "completed";
  return "open"; // planning / pending / anything legacy
}

export function TeamDeliveryBoard({ members }: { members: User[] }) {
  const [mode, setMode] = React.useState<"status" | "project" | "deliverable">("status");
  // Scope everything to milestones only, bare tasks only, or both.
  const [kindFilter, setKindFilter] = React.useState<"all" | "milestone" | "task">("all");
  const [period, setPeriod] = React.useState<Period | "custom">("week");
  const [offset, setOffset] = React.useState(0);
  // Custom range (yyyy-mm-dd) — applied once both ends are chosen.
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const customReady = period === "custom" && !!customFrom && !!customTo;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<MemberData[]>([]);
  const [projectById, setProjectById] = React.useState<Record<string, Project>>({});

  const memberIds = members.map((m) => m.id).join(",");
  React.useEffect(() => {
    if (members.length === 0) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([
      projectsApi.list().then((r) => r.projects).catch(() => [] as Project[]),
      // One fn_task_full fetch per member — bounded to keep large orgs sane.
      Promise.all(
        members.slice(0, 40).map((m) =>
          usersApi
            .tasks(m.id)
            .then((r) => ({ user: m, tasks: r.tasks }))
            .catch(() => ({ user: m, tasks: [] as Task[] })),
        ),
      ),
    ]).then(([projects, memberData]) => {
      if (!alive) return;
      setProjectById(Object.fromEntries(projects.map((p) => [p.id, p])));
      setData(memberData);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

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
  const inWindow = React.useCallback(
    (d?: string | null) =>
      !!d && isWithinInterval(parseISO(d), { start: win.start, end: win.end }),
    [win.start, win.end],
  );

  // Flatten every member's tasks into work units + evidence rows.
  const { unitsByMember, evidence } = React.useMemo(() => {
    const unitsByMember = new Map<string, WorkUnit[]>();
    const evidence: Evidence[] = [];
    const seenEvidence = new Set<string>();
    for (const { user, tasks } of data) {
      const units: WorkUnit[] = [];
      for (const t of tasks) {
        const milestones = t.milestones ?? [];
        if (milestones.length > 0) {
          for (const m of milestones) {
            if (kindFilter !== "task") {
              units.push({
                id: m.id,
                kind: "milestone",
                title: m.title,
                status: m.status,
                projectId: t.project_id,
                memberId: user.id,
                completedAt: m.completed_at,
                targetDate: m.target_date ?? null,
                startDate: m.start_date ?? null,
                verdictKey: classifyVerdict(m.outcome),
                estimatedHours: m.estimated_hours ?? 0,
                actualHours: m.actual_hours ?? 0,
              });
              for (const d of m.deliverables ?? []) {
                if (seenEvidence.has(d.id)) continue;
                seenEvidence.add(d.id);
                evidence.push({
                  id: d.id, kind: "milestone", type: d.type, submittedAt: m.completed_at ?? m.start_date,
                  memberId: d.submitted_by ?? user.id, projectId: t.project_id,
                });
              }
              for (const a of m.attachments ?? []) {
                if (!a.url || seenEvidence.has(a.id)) continue;
                seenEvidence.add(a.id);
                evidence.push({
                  id: a.id, kind: "milestone", type: "link", submittedAt: m.completed_at ?? m.start_date,
                  memberId: user.id, projectId: t.project_id,
                });
              }
            }
          }
        } else if (kindFilter !== "milestone") {
          units.push({
            id: t.id,
            kind: "task",
            title: t.title,
            status: t.status,
            projectId: t.project_id,
            memberId: user.id,
            completedAt: t.completed_at,
            targetDate: null,
            startDate: t.created_at?.slice(0, 10) ?? null,
            verdictKey: classifyVerdict(t.outcome),
            estimatedHours: t.revised_estimate_hours ?? t.estimated_hours ?? 0,
            actualHours: t.actual_hours ?? 0,
          });
          for (const d of t.deliverables ?? []) {
            if (seenEvidence.has(d.id)) continue;
            seenEvidence.add(d.id);
            evidence.push({
              id: d.id, kind: "task", type: d.type, submittedAt: t.completed_at,
              memberId: d.submitted_by ?? user.id, projectId: t.project_id,
            });
          }
        }
      }
      unitsByMember.set(user.id, units);
    }
    return { unitsByMember, evidence };
  }, [data, kindFilter]);

  // Segment counts under the current window: completed units filter by END
  // date; open units fall back to their START date.
  const segment = React.useCallback(
    (units: WorkUnit[]) => {
      const c = { in_progress: 0, open: 0, blocked: 0, done: 0 };
      for (const u of units) {
        const s = normUnitStatus(u.status);
        if (s === "completed") {
          if (inWindow(u.completedAt)) c.done++;
        } else if (inWindow(u.startDate)) {
          c[s]++;
        }
      }
      return c;
    },
    [inWindow],
  );
  // Same rule as a predicate — keeps every counter in sync with its bar.
  const inScopeWindow = React.useCallback(
    (u: WorkUnit) =>
      normUnitStatus(u.status) === "completed"
        ? inWindow(u.completedAt)
        : inWindow(u.startDate),
    [inWindow],
  );

  // Window-scoped team summary (units deduped across shared tasks) — plus the
  // current risk picture: what is blocked or in flight RIGHT NOW.
  const summary = React.useMemo(() => {
    const seen = new Set<string>();
    let done = 0;
    let met = 0;
    let judged = 0;
    let hours = 0;
    let activeNow = 0;
    let overdueNow = 0;
    let estJudged = 0;
    let estWithin = 0;
    const now = new Date();
    const blockedItems: { id: string; title: string; memberId: string; projectId: string }[] = [];
    const teamCounts = { in_progress: 0, open: 0, blocked: 0, done: 0 };
    for (const units of unitsByMember.values()) {
      for (const u of units) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        const s = normUnitStatus(u.status);
        if (s === "completed") {
          if (inWindow(u.completedAt)) {
            done++;
            teamCounts.done++;
            hours += u.actualHours;
            if (u.verdictKey !== "unrecorded" && u.verdictKey !== "unclassified") {
              judged++;
              if (u.verdictKey === "met") met++;
            }
            // On-time: each milestone judged against its own end date.
            if (u.targetDate && u.completedAt) {
              estJudged++;
              if (parseISO(u.completedAt) <= endOfDay(parseISO(u.targetDate))) estWithin++;
            }
          }
        } else {
          // Whole-team bar follows the window (open units by start date);
          // the "now" chips below stay deliberately window-free.
          if (inWindow(u.startDate)) teamCounts[s]++;
          if (s === "blocked") blockedItems.push({ id: u.id, title: u.title, memberId: u.memberId, projectId: u.projectId });
          if (s === "in_progress") activeNow++;
          // Past its own target date and still open → overdue right now.
          if (u.targetDate && endOfDay(parseISO(u.targetDate)) < now) overdueNow++;
        }
      }
    }
    const evidenceInWindow = evidence.filter((e) => inWindow(e.submittedAt)).length;
    return {
      done,
      evidence: evidenceInWindow,
      metPct: judged > 0 ? Math.round((met / judged) * 100) : null,
      withinPct: estJudged > 0 ? Math.round((estWithin / estJudged) * 100) : null,
      hours: Math.round(hours * 10) / 10,
      activeNow,
      overdueNow,
      blockedItems,
      teamCounts,
    };
  }, [unitsByMember, evidence, inWindow]);

  // Per-member window stats: outcome quality, hours logged, evidence submitted.
  const memberStats = React.useMemo(() => {
    const stats = new Map<
      string,
      { metPct: number | null; hours: number; deliverables: number }
    >();
    for (const [mid, units] of unitsByMember) {
      const doneUnits = units.filter(
        (u) => normUnitStatus(u.status) === "completed" && inWindow(u.completedAt),
      );
      const judged = doneUnits.filter(
        (u) => u.verdictKey !== "unrecorded" && u.verdictKey !== "unclassified",
      );
      const met = judged.filter((u) => u.verdictKey === "met").length;
      stats.set(mid, {
        metPct: judged.length > 0 ? Math.round((met / judged.length) * 100) : null,
        hours: Math.round(doneUnits.reduce((s, u) => s + u.actualHours, 0) * 10) / 10,
        deliverables: 0,
      });
    }
    for (const e of evidence) {
      if (!inWindow(e.submittedAt)) continue;
      const s = stats.get(e.memberId);
      if (s) s.deliverables++;
    }
    return stats;
  }, [unitsByMember, evidence, inWindow]);

  const memberById = React.useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  const metBadgeCls = (pct: number) =>
    pct >= 70
      ? "text-green-700 border-green-200 bg-green-50"
      : pct >= 40
        ? "text-amber-700 border-amber-200 bg-amber-50"
        : "text-red-700 border-red-200 bg-red-50";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      {/* Header: title · mode switch · window navigator */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-3.5 pb-2 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-purple-100 bg-purple-50">
            <LayoutGrid className="h-3.5 w-3.5 text-purple-600" />
          </span>
          Team Delivery Board
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kind scope — answers "is this milestones or tasks?" directly */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | "milestone" | "task")}
            className={cn(
              "h-7 rounded-lg border bg-white px-2 text-[11px] font-medium",
              kindFilter === "all"
                ? "border-slate-200 text-slate-600"
                : "border-indigo-300 text-indigo-700 bg-indigo-50/50",
            )}
            title="Count milestones only, bare tasks only, or both"
          >
            <option value="all">All work</option>
            <option value="milestone">Milestones only</option>
            <option value="task">Tasks only</option>
          </select>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                { id: "status", label: "Status" },
                { id: "project", label: "Project" },
                { id: "deliverable", label: "Deliverable" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode === m.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {[...PERIODS, { id: "custom" as const, label: "Custom" }].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  setOffset(0);
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  period === p.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
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
                <span className="text-[10px] text-amber-600 font-medium">pick both dates</span>
              )}
            </div>
          ) : (
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team delivery data…
        </div>
      ) : (
        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Window summary strip — delivery + the current risk picture */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 border border-emerald-100 px-2.5 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.done}</span> completed
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.evidence}</span> deliverables
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 border border-indigo-100 px-2.5 py-1.5">
              <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">
                  {summary.metPct === null ? "—" : `${summary.metPct}%`}
                </span>{" "}
                outcomes met
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-50/60 border border-violet-100 px-2.5 py-1.5">
              <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.hours}h</span> logged
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-2.5 py-1.5"
              title="Share of this window's dated completions finished on or before their own end date"
            >
              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">
                  {summary.withinPct === null ? "—" : `${summary.withinPct}%`}
                </span>{" "}
                on time
              </span>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 border",
                summary.overdueNow > 0
                  ? "bg-orange-50/70 border-orange-200"
                  : "bg-slate-50/60 border-slate-100",
              )}
              title="Open units past their own target date right now (not window-bound)"
            >
              <Target
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  summary.overdueNow > 0 ? "text-orange-500" : "text-slate-400",
                )}
              />
              <span className="text-[11px] text-slate-600">
                <span
                  className={cn(
                    "stat-number font-extrabold",
                    summary.overdueNow > 0 ? "text-orange-600" : "text-slate-900",
                  )}
                >
                  {summary.overdueNow}
                </span>{" "}
                overdue now
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-lg bg-sky-50/60 border border-sky-100 px-2.5 py-1.5"
              title="Units in progress across the team right now (not window-bound)"
            >
              <Clock className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.activeNow}</span> in flight
              </span>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 border",
                summary.blockedItems.length > 0
                  ? "bg-red-50/70 border-red-200"
                  : "bg-slate-50/60 border-slate-100",
              )}
              title="Units blocked across the team right now (not window-bound)"
            >
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  summary.blockedItems.length > 0 ? "text-red-500" : "text-slate-400",
                )}
              />
              <span className="text-[11px] text-slate-600">
                <span
                  className={cn(
                    "stat-number font-extrabold",
                    summary.blockedItems.length > 0 ? "text-red-600" : "text-slate-900",
                  )}
                >
                  {summary.blockedItems.length}
                </span>{" "}
                blocked now
              </span>
            </div>
          </div>

          {/* Needs-attention strip — blocked work is a conversation, not a stat */}
          {summary.blockedItems.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs attention
              </p>
              <p className="mt-0.5 text-[11px] text-red-700/90">
                {summary.blockedItems.slice(0, 3).map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && " · "}
                    <span className="font-medium">{b.title}</span>
                    {" ("}
                    {memberById[b.memberId]?.name?.split(" ")[0] ?? "—"}
                    {" · "}
                    {projectById[b.projectId]?.title ?? "—"}
                    {")"}
                  </span>
                ))}
                {summary.blockedItems.length > 3 && (
                  <span> · +{summary.blockedItems.length - 3} more</span>
                )}
              </p>
            </div>
          )}

          {/* Legend + how-it-counts explainer (status & project lenses) */}
          {mode !== "deliverable" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {STATUS_SEGMENTS.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                  {s.label}
                </span>
              ))}
              <span
                className="ml-auto inline-flex items-center gap-1 text-slate-400"
                title="A task that HAS milestones is represented by its milestones only — the parent task is never counted again, so nothing is double-counted. 'Done in window' follows the period above; the other segments show current state."
              >
                Counted as work units:
                <Target className="h-3 w-3 text-indigo-400" /> each milestone ·
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> each task without milestones
              </span>
            </div>
          )}

          {/* ── Lens: per member — ranked by delivery, team total on top ── */}
          {mode === "status" && (
            <div className="space-y-1.5">
              {(() => {
                const tc = summary.teamCounts;
                const teamTotal = tc.in_progress + tc.open + tc.blocked + tc.done;
                return (
                  <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/40 px-2.5 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="w-36 truncate text-xs font-bold text-indigo-900 shrink-0">Whole team</span>
                    <div className="flex h-2.5 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                      {teamTotal > 0 &&
                        STATUS_SEGMENTS.map((s) => {
                          const v = tc[s.key === "done" ? "done" : s.key];
                          if (!v) return null;
                          return (
                            <div
                              key={s.key}
                              className={s.bar}
                              style={{ width: `${(v / teamTotal) * 100}%` }}
                              title={`${v} ${s.label.toLowerCase()}`}
                            />
                          );
                        })}
                    </div>
                    <span className="w-40 text-right text-[10px] font-semibold text-indigo-700 shrink-0 tabular-nums">
                      {tc.done} done · {tc.in_progress} active · {tc.blocked} blocked
                    </span>
                  </div>
                );
              })()}
              {[...data]
                .sort((a, b) => {
                  const ca = segment(unitsByMember.get(a.user.id) ?? []);
                  const cb = segment(unitsByMember.get(b.user.id) ?? []);
                  return (
                    cb.done - ca.done ||
                    cb.in_progress - ca.in_progress ||
                    (a.user.name ?? "").localeCompare(b.user.name ?? "")
                  );
                })
                .map(({ user }) => {
                  const units = unitsByMember.get(user.id) ?? [];
                  const c = segment(units);
                  const total = c.in_progress + c.open + c.blocked + c.done;
                  const st = memberStats.get(user.id);
                  const msN = units.filter((u) => u.kind === "milestone" && inScopeWindow(u)).length;
                  const tkN = units.filter((u) => u.kind === "task" && inScopeWindow(u)).length;
                  return (
                    <Link
                      key={user.id}
                      href={`/team/${user.id}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
                    >
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: user.avatar_color || "#64748b" }}
                      >
                        {user.name?.[0] ?? "?"}
                      </div>
                      <span className="w-36 truncate text-xs font-medium text-slate-800 shrink-0">{user.name}</span>
                      <div className="flex h-2.5 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                        {total > 0 &&
                          STATUS_SEGMENTS.map((s) => {
                            const v = c[s.key === "done" ? "done" : s.key];
                            if (!v) return null;
                            return (
                              <div
                                key={s.key}
                                className={s.bar}
                                style={{ width: `${(v / total) * 100}%` }}
                                title={`${v} ${s.label.toLowerCase()}`}
                              />
                            );
                          })}
                      </div>
                      {kindFilter === "all" && (
                        <span
                          className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 tabular-nums"
                          title={`${msN} milestone${msN === 1 ? "" : "s"} · ${tkN} bare task${tkN === 1 ? "" : "s"}`}
                        >
                          <Target className="h-3 w-3 text-indigo-400" />
                          {msN}
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />
                          {tkN}
                        </span>
                      )}
                      {/* Window quality + effort + evidence, per member */}
                      <span className="hidden xl:inline-flex items-center gap-1.5 shrink-0">
                        {st?.metPct != null && (
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-px text-[9px] font-semibold",
                              metBadgeCls(st.metPct),
                            )}
                            title="Outcomes fully met among this window's completions"
                          >
                            {st.metPct}% met
                          </span>
                        )}
                        {(st?.hours ?? 0) > 0 && (
                          <span
                            className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[9px] font-semibold text-violet-700"
                            title="Hours logged on this window's completions"
                          >
                            {st!.hours}h
                          </span>
                        )}
                        {(st?.deliverables ?? 0) > 0 && (
                          <span
                            className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-px text-[9px] font-semibold text-blue-700"
                            title="Deliverables submitted in this window"
                          >
                            {st!.deliverables} 📄
                          </span>
                        )}
                      </span>
                      <span className="w-40 text-right text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {c.done} done · {c.in_progress} active ·{" "}
                        <span className={c.blocked > 0 ? "font-semibold text-red-600" : undefined}>
                          {c.blocked} blocked
                        </span>
                      </span>
                    </Link>
                  );
                })}
            </div>
          )}

          {/* ── Lens: per project ── */}
          {mode === "project" && (
            <div className="space-y-1.5">
              {(() => {
                const byProject = new Map<string, { units: WorkUnit[]; memberIds: Set<string> }>();
                const seen = new Set<string>();
                for (const units of unitsByMember.values()) {
                  for (const u of units) {
                    if (!byProject.has(u.projectId)) byProject.set(u.projectId, { units: [], memberIds: new Set() });
                    const g = byProject.get(u.projectId)!;
                    g.memberIds.add(u.memberId);
                    if (seen.has(u.id)) continue;
                    seen.add(u.id);
                    g.units.push(u);
                  }
                }
                const evidenceByProject = new Map<string, number>();
                for (const e of evidence) {
                  if (!inWindow(e.submittedAt)) continue;
                  evidenceByProject.set(e.projectId, (evidenceByProject.get(e.projectId) ?? 0) + 1);
                }
                const rows = [...byProject.entries()]
                  .map(([pid, g]) => {
                    const doneUnits = g.units.filter(
                      (u) => normUnitStatus(u.status) === "completed" && inWindow(u.completedAt),
                    );
                    const judged = doneUnits.filter(
                      (u) => u.verdictKey !== "unrecorded" && u.verdictKey !== "unclassified",
                    );
                    const met = judged.filter((u) => u.verdictKey === "met").length;
                    return {
                      pid,
                      ...g,
                      c: segment(g.units),
                      metPct: judged.length > 0 ? Math.round((met / judged.length) * 100) : null,
                      evidenceCount: evidenceByProject.get(pid) ?? 0,
                      // Counters follow the same window as the bar beside them.
                      msN: g.units.filter((u) => u.kind === "milestone" && inScopeWindow(u)).length,
                      tkN: g.units.filter((u) => u.kind === "task" && inScopeWindow(u)).length,
                    };
                  })
                  // Projects with nothing in this window don't render a dead row.
                  .filter((r) => r.c.in_progress + r.c.open + r.c.blocked + r.c.done > 0)
                  .sort((a, b) => (b.c.done + b.c.in_progress) - (a.c.done + a.c.in_progress));
                if (rows.length === 0)
                  return (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No project work in {win.label.toLowerCase()} — use ‹ › or a longer period.
                    </p>
                  );
                return rows.map(({ pid, memberIds: mids, c, metPct, evidenceCount, msN, tkN }) => {
                  const total = c.in_progress + c.open + c.blocked + c.done;
                  const title = projectById[pid]?.title ?? "Unknown project";
                  return (
                    <Link
                      key={pid}
                      href={`/projects/${pid}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
                    >
                      <FolderKanban className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="w-44 truncate text-xs font-medium text-slate-800 shrink-0" title={title}>
                        {title}
                      </span>
                      <div className="flex h-2.5 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                        {total > 0 &&
                          STATUS_SEGMENTS.map((s) => {
                            const v = c[s.key === "done" ? "done" : s.key];
                            if (!v) return null;
                            return (
                              <div
                                key={s.key}
                                className={s.bar}
                                style={{ width: `${(v / total) * 100}%` }}
                                title={`${v} ${s.label.toLowerCase()}`}
                              />
                            );
                          })}
                      </div>
                      <div className="flex -space-x-1.5 shrink-0">
                        {[...mids].slice(0, 5).map((mid) => {
                          const m = memberById[mid];
                          if (!m) return null;
                          return (
                            <span
                              key={mid}
                              className="h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ backgroundColor: m.avatar_color || "#64748b" }}
                              title={m.name}
                            >
                              {m.name?.[0] ?? "?"}
                            </span>
                          );
                        })}
                        {mids.size > 5 && (
                          <span className="h-5 w-5 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                            +{mids.size - 5}
                          </span>
                        )}
                      </div>
                      {kindFilter === "all" && (
                        <span
                          className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 tabular-nums"
                          title={`${msN} milestone${msN === 1 ? "" : "s"} · ${tkN} bare task${tkN === 1 ? "" : "s"}`}
                        >
                          <Target className="h-3 w-3 text-indigo-400" />
                          {msN}
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />
                          {tkN}
                        </span>
                      )}
                      <span className="hidden lg:inline-flex items-center gap-1.5 shrink-0">
                        {metPct != null && (
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-px text-[9px] font-semibold",
                              metBadgeCls(metPct),
                            )}
                            title="Outcomes fully met among this window's completions"
                          >
                            {metPct}% met
                          </span>
                        )}
                        {evidenceCount > 0 && (
                          <span
                            className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-px text-[9px] font-semibold text-blue-700"
                            title="Deliverables submitted in this window"
                          >
                            {evidenceCount} 📄
                          </span>
                        )}
                      </span>
                      <span className="w-24 text-right text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {c.done} done
                        {c.blocked > 0 && (
                          <span className="font-semibold text-red-600"> · {c.blocked} ⛔</span>
                        )}
                      </span>
                    </Link>
                  );
                });
              })()}
            </div>
          )}

          {/* ── Lens: deliverable types submitted in window ── */}
          {mode === "deliverable" && (
            <div className="space-y-1.5">
              {(() => {
                const rows = new Map<string, { count: number; memberIds: Set<string> }>();
                for (const e of evidence) {
                  if (!inWindow(e.submittedAt)) continue;
                  if (!rows.has(e.type)) rows.set(e.type, { count: 0, memberIds: new Set() });
                  const r = rows.get(e.type)!;
                  r.count++;
                  r.memberIds.add(e.memberId);
                }
                const sorted = [...rows.entries()].sort((a, b) => b[1].count - a[1].count);
                if (sorted.length === 0)
                  return (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No deliverables submitted in {win.label.toLowerCase()} — use ‹ › to look at earlier {period}s.
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
                    <div className="flex -space-x-1.5 shrink-0">
                      {[...r.memberIds].slice(0, 5).map((mid) => {
                        const m = memberById[mid];
                        if (!m) return null;
                        return (
                          <span
                            key={mid}
                            className="h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: m.avatar_color || "#64748b" }}
                            title={m.name}
                          >
                            {m.name?.[0] ?? "?"}
                          </span>
                        );
                      })}
                    </div>
                    <span className="w-10 text-right text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                      {r.count}
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
