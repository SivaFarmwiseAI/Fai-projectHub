/**
 * Pure derivation functions for the team member detail view (/team/[id]).
 * No React — everything takes plain data and returns plain data, so the
 * view layer can memoize each computation once and share it across tabs.
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type {
  Deliverable,
  LeaveRequest,
  MilestoneAttachment,
  Project,
  Task,
  TaskMilestone,
  User,
} from "@/lib/api-client";

/** Everything the page fetches, bundled once and passed down. */
export type TeamMemberData = {
  user: User;
  projects: Project[];
  projectById: Record<string, Project>;
  tasks: Task[];
  leaves: LeaveRequest[];
};

// ── Daily activity ───────────────────────────────────────────────────────────

export type DailyActivityKind = "done" | "update" | "due" | "in_progress" | "blocked";

export interface DailyActivityItem {
  id: string;
  kind: DailyActivityKind;
  text: string;
  sub?: string;
}

export function computeDailyActivity(
  tasks: Task[],
  projectById: Record<string, Project>,
): { yesterday: DailyActivityItem[]; today: DailyActivityItem[]; tomorrow: DailyActivityItem[] } {
  const now = new Date();
  const yDay = addDays(now, -1);
  const tmDay = addDays(now, 1);
  const yBucket: DailyActivityItem[] = [];
  const tBucket: DailyActivityItem[] = [];
  const tmBucket: DailyActivityItem[] = [];
  const CAP = 8;
  const add = (bucket: DailyActivityItem[], item: DailyActivityItem) => {
    if (bucket.length < CAP && !bucket.some((b) => b.id === item.id)) bucket.push(item);
  };
  const parseDate = (d?: string | null) => (d ? parseISO(d) : null);
  const parseDay = (d?: string | null) => (d ? parseISO(`${d}T00:00:00`) : null);

  for (const task of tasks) {
    const projTitle = projectById[task.project_id]?.title;

    const tc = parseDate(task.completed_at);
    if (task.status === "completed" && tc) {
      if (isSameDay(tc, yDay)) add(yBucket, { id: `tc-${task.id}`, kind: "done", text: `Completed task: ${task.title}`, sub: projTitle });
      else if (isSameDay(tc, now)) add(tBucket, { id: `tc-${task.id}`, kind: "done", text: `Completed task: ${task.title}`, sub: projTitle });
    }

    for (const u of task.updates ?? []) {
      const d = parseDate(u.created_at);
      if (!d) continue;
      if (isSameDay(d, yDay)) add(yBucket, { id: `tu-${u.id}`, kind: "update", text: u.message, sub: task.title });
      else if (isSameDay(d, now)) add(tBucket, { id: `tu-${u.id}`, kind: "update", text: u.message, sub: task.title });
    }

    for (const m of task.milestones ?? []) {
      const mc = parseDate(m.completed_at);
      if (m.status === "completed" && mc) {
        if (isSameDay(mc, yDay)) add(yBucket, { id: `mc-${m.id}`, kind: "done", text: `Completed milestone: ${m.title}`, sub: task.title });
        else if (isSameDay(mc, now)) add(tBucket, { id: `mc-${m.id}`, kind: "done", text: `Completed milestone: ${m.title}`, sub: task.title });
      }
      const md = parseDay(m.target_date);
      if (md && m.status !== "completed") {
        if (isSameDay(md, now)) add(tBucket, { id: `md-${m.id}`, kind: "due", text: `Milestone due today: ${m.title}`, sub: task.title });
        else if (isSameDay(md, tmDay)) add(tmBucket, { id: `md-${m.id}`, kind: "due", text: `Milestone due: ${m.title}`, sub: task.title });
        else if (md < now)
          // Past its end date and still open — belongs at the top of today's list.
          add(tBucket, {
            id: `mo-${m.id}`,
            kind: "blocked",
            text: `Overdue milestone: ${m.title} (was due ${format(md, "MMM d")})`,
            sub: task.title,
          });
      }
      for (const u of m.updates ?? []) {
        const d = parseDate(u.created_at);
        if (!d) continue;
        if (isSameDay(d, yDay)) add(yBucket, { id: `mu-${u.id}`, kind: "update", text: u.message, sub: m.title });
        else if (isSameDay(d, now)) add(tBucket, { id: `mu-${u.id}`, kind: "update", text: u.message, sub: m.title });
      }
    }
  }

  // Today: surface blocked + in-progress work if the day is otherwise sparse.
  for (const b of tasks.filter((t) => t.status === "blocked")) {
    add(tBucket, { id: `blk-${b.id}`, kind: "blocked", text: `Blocked: ${b.title}`, sub: projectById[b.project_id]?.title });
  }
  for (const p of tasks.filter((t) => t.status === "in_progress")) {
    add(tBucket, { id: `wip-${p.id}`, kind: "in_progress", text: `In progress: ${p.title}`, sub: projectById[p.project_id]?.title });
  }

  // Tomorrow: if nothing is due tomorrow, preview the nearest upcoming milestones.
  if (tmBucket.length === 0) {
    const upcoming = tasks
      .flatMap((t) => (t.milestones ?? []).map((m) => ({ m, t })))
      .filter(({ m }) => m.status !== "completed" && m.target_date && (parseDay(m.target_date) as Date) > tmDay)
      .sort((a, b) => (parseDay(a.m.target_date) as Date).getTime() - (parseDay(b.m.target_date) as Date).getTime())
      .slice(0, 4);
    for (const { m, t } of upcoming) {
      add(tmBucket, {
        id: `up-${m.id}`,
        kind: "due",
        text: `Upcoming: ${m.title}`,
        sub: `${t.title} · ${format(parseDay(m.target_date) as Date, "MMM d")}`,
      });
    }
  }

  return { yesterday: yBucket, today: tBucket, tomorrow: tmBucket };
}

// ── Deliverable timeline ─────────────────────────────────────────────────────

export type TimelineItem = {
  id: string;
  taskId: string;
  taskTitle: string;
  projectTitle: string;
  projectId: string;
  milestoneTitle: string;
  deliverableType: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualEnd: Date | null;
  status: "completed_on_time" | "completed_late" | "in_progress" | "overdue" | "upcoming";
  delayDays: number;
  deliverables: { title: string; status: string; type: string }[];
  updates: { message: string; created_at: string }[];
  /** True when the planned end comes from a real deadline (milestone
   *  target date/day) rather than a synthesized estimate. */
  hasDeadline: boolean;
};

export function buildTimelineItems(
  tasks: Task[],
  projectById: Record<string, Project>,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const now = new Date();

  for (const task of tasks) {
    const project = projectById[task.project_id];
    if (!project) continue;

    const taskStart = new Date(task.created_at);
    const hoursEstimate = task.revised_estimate_hours || task.estimated_hours || 8;
    const estimatedDays = Math.max(1, Math.ceil(hoursEstimate / 8));
    const plannedEnd = addDays(taskStart, estimatedDays);

    const milestones = task.milestones ?? [];
    if (milestones.length > 0) {
      for (const ms of milestones) {
        // Prefer the lead-chosen absolute date; fall back to the target_day
        // offset, then to the task's planned end.
        // Placement date: explicit end date if set; a completed milestone
        // sits on its actual end; an open one on its start date.
        const msPlannedEnd = ms.target_date
          ? new Date(`${ms.target_date}T00:00:00`)
          : ms.completed_at
            ? new Date(ms.completed_at)
            : ms.start_date
              ? new Date(`${ms.start_date}T00:00:00`)
              : ms.target_day
                ? addDays(taskStart, ms.target_day)
                : plannedEnd;
        // Prefer the explicitly chosen start date; older milestones without
        // one fall back to the derived approximation.
        const msPlannedStart = ms.start_date
          ? new Date(`${ms.start_date}T00:00:00`)
          : ms.target_date
            ? addDays(msPlannedEnd, -Math.ceil(estimatedDays / milestones.length))
            : ms.target_day
              ? addDays(taskStart, Math.max(0, ms.target_day - Math.ceil(estimatedDays / milestones.length)))
              : taskStart;

        const actualEnd = ms.completed_at ? new Date(ms.completed_at) : null;
        let status: TimelineItem["status"];
        let delayDays = 0;

        if (ms.status === "completed" && actualEnd) {
          const diff = differenceInCalendarDays(actualEnd, msPlannedEnd);
          if (diff > 0) {
            status = "completed_late";
            delayDays = diff;
          } else {
            status = "completed_on_time";
          }
        } else if (ms.status === "in_progress" || ms.status === "pending") {
          if (isAfter(now, msPlannedEnd)) {
            status = "overdue";
            delayDays = differenceInCalendarDays(now, msPlannedEnd);
          } else if (ms.status === "in_progress") {
            status = "in_progress";
          } else {
            status = "upcoming";
          }
        } else {
          // blocked
          if (isAfter(now, msPlannedEnd)) {
            status = "overdue";
            delayDays = differenceInCalendarDays(now, msPlannedEnd);
          } else {
            status = "in_progress";
          }
        }

        items.push({
          id: ms.id,
          taskId: task.id,
          taskTitle: task.title,
          projectTitle: project.title,
          projectId: project.id,
          milestoneTitle: ms.title,
          deliverableType: ms.deliverable_type || "text",
          plannedStart: msPlannedStart,
          plannedEnd: msPlannedEnd,
          actualEnd,
          status,
          delayDays,
          deliverables: (ms.deliverables ?? []).map((d) => ({
            title: d.title,
            status: d.status,
            type: d.type,
          })),
          updates: [],
          hasDeadline: !!ms.target_date || ms.target_day != null,
        });
      }
    } else {
      // Task without milestones — treat task itself as a deliverable
      const actualEnd = task.completed_at ? new Date(task.completed_at) : null;
      let status: TimelineItem["status"];
      let delayDays = 0;

      if (task.status === "completed" && actualEnd) {
        const diff = differenceInCalendarDays(actualEnd, plannedEnd);
        if (diff > 0) {
          status = "completed_late";
          delayDays = diff;
        } else {
          status = "completed_on_time";
        }
      } else if (task.status === "in_progress" || task.status === "planning") {
        if (isAfter(now, plannedEnd)) {
          status = "overdue";
          delayDays = differenceInCalendarDays(now, plannedEnd);
        } else if (task.status === "in_progress") {
          status = "in_progress";
        } else {
          status = "upcoming";
        }
      } else {
        status = "upcoming";
      }

      items.push({
        id: task.id,
        taskId: task.id,
        taskTitle: task.title,
        projectTitle: project.title,
        projectId: project.id,
        milestoneTitle: task.title,
        deliverableType: "text",
        plannedStart: taskStart,
        plannedEnd,
        actualEnd,
        status,
        delayDays,
        deliverables: [],
        updates: (task.updates ?? []).map((u) => ({
          message: u.message,
          created_at: u.created_at,
        })),
        hasDeadline: false,
      });
    }
  }

  return items.sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
}

export function getTimelineBarColor(status: TimelineItem["status"]) {
  switch (status) {
    case "completed_on_time": return { planned: "bg-green-100", actual: "bg-green-500", text: "text-green-700", badge: "text-green-700 border-green-200 bg-green-50" };
    case "completed_late": return { planned: "bg-amber-100", actual: "bg-amber-500", text: "text-amber-700", badge: "text-amber-700 border-amber-200 bg-amber-50" };
    case "in_progress": return { planned: "bg-blue-100", actual: "bg-blue-500", text: "text-blue-700", badge: "text-blue-700 border-blue-200 bg-blue-50" };
    case "overdue": return { planned: "bg-red-100", actual: "bg-red-500", text: "text-red-700", badge: "text-red-700 border-red-200 bg-red-50" };
    case "upcoming": return { planned: "bg-slate-100", actual: "bg-slate-400", text: "text-slate-700", badge: "text-slate-700 border-slate-200 bg-slate-50" };
  }
}

export function getTimelineStatusLabel(status: TimelineItem["status"]) {
  switch (status) {
    case "completed_on_time": return "On Time";
    case "completed_late": return "Delayed";
    case "in_progress": return "In Progress";
    case "overdue": return "Overdue";
    case "upcoming": return "Upcoming";
  }
}

// ── Hours & weekly delivery analysis ─────────────────────────────────────────

export function computeHoursAnalysis(
  tasks: Task[],
  projectById: Record<string, Project>,
) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const inWeek = (d?: string | null) =>
    d ? isWithinInterval(parseISO(d), { start: weekStart, end: weekEnd }) : false;

  let totalEst = 0;
  let totalPlanned = 0; // revised estimate when present, else estimated
  let totalActual = 0;
  const perProjectMap: Record<string, { title: string; planned: number; actual: number }> = {};

  const msDoneThisWeek: Array<TaskMilestone & { _taskTitle: string; _taskId: string; _projectId: string }> = [];
  const deliverablesThisWeek: Array<{
    id: string; title: string; type: string; msTitle: string;
    _taskId: string; _projectId: string; url?: string;
  }> = [];
  let updatesThisWeek = 0;
  let effortDeliveredThisWeek = 0;
  let actualDeliveredThisWeek = 0;

  for (const t of tasks) {
    // Planned = the sum of the MILESTONES' estimated hours; Working = the sum
    // of the MILESTONES' logged hours. A task without milestones falls back
    // to its own task-level estimate / logged hours.
    const est = t.estimated_hours ?? 0;
    const taskMs = t.milestones ?? [];
    const planned = taskMs.length > 0
      ? taskMs.reduce((s, m) => s + (m.estimated_hours ?? 0), 0)
      : est;
    const act = taskMs.length > 0
      ? taskMs.reduce((s, m) => s + (m.actual_hours ?? 0), 0)
      : t.actual_hours ?? 0;
    totalEst += est;
    totalPlanned += planned;
    totalActual += act;

    const key = t.project_id;
    if (!perProjectMap[key]) perProjectMap[key] = { title: projectById[key]?.title ?? "—", planned: 0, actual: 0 };
    perProjectMap[key].planned += planned;
    perProjectMap[key].actual += act;

    for (const m of t.milestones ?? []) {
      if (m.status === "completed" && inWeek(m.completed_at)) {
        msDoneThisWeek.push({ ...m, _taskTitle: t.title, _taskId: t.id, _projectId: t.project_id });
        effortDeliveredThisWeek += m.estimated_hours ?? 0;
        actualDeliveredThisWeek += m.actual_hours ?? 0;
      }
      // Evidence is dated by its milestone's END date, falling back to the
      // START date while the milestone is still open.
      for (const d of m.deliverables ?? []) {
        if (inWeek(m.completed_at ?? m.start_date)) {
          deliverablesThisWeek.push({
            id: d.id, title: d.title, type: d.type, msTitle: m.title,
            _taskId: t.id, _projectId: t.project_id,
            url: d.document_url || d.code_pr_url || d.code_repo_url || undefined,
          });
        }
      }
      for (const u of m.updates ?? []) if (inWeek(u.created_at)) updatesThisWeek++;
    }
    for (const u of t.updates ?? []) if (inWeek(u.created_at)) updatesThisWeek++;
    // Task-level evidence (milestone-less tasks) — dated by the task's END date.
    for (const d of t.deliverables ?? []) {
      if (inWeek(t.completed_at)) {
        deliverablesThisWeek.push({
          id: d.id, title: d.title, type: d.type, msTitle: t.title,
          _taskId: t.id, _projectId: t.project_id,
          url: d.document_url || d.code_pr_url || d.code_repo_url || undefined,
        });
      }
    }
  }

  const tasksDoneThisWeek = tasks.filter((t) => t.status === "completed" && inWeek(t.completed_at));
  const utilization = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const variance = totalActual - totalPlanned; // + = over, − = under
  const allMs = tasks.flatMap((t) => t.milestones ?? []);
  const doneMs = allMs.filter((m) => m.status === "completed").length;
  // Evidence on record = structured deliverable rows PLUS uploaded files /
  // links (revision attachments) — the legacy completion flow stored evidence
  // only as attachments, so counting rows alone under-reports.
  const totalDeliverables =
    allMs.reduce(
      (n, m) =>
        n + (m.deliverables?.length ?? 0) + (m.attachments?.filter((a) => a.url).length ?? 0),
      0,
    ) +
    tasks.reduce(
      (n, t) =>
        n + (t.deliverables?.length ?? 0) + (t.attachments?.filter((a) => a.url).length ?? 0),
      0,
    );
  const perProject = Object.values(perProjectMap)
    .filter((p) => p.planned > 0 || p.actual > 0)
    .sort((a, b) => b.actual - a.actual);
  const maxHours = Math.max(1, ...perProject.map((p) => Math.max(p.planned, p.actual)));

  return {
    weekStart, weekEnd,
    totalEst, totalPlanned, totalActual, utilization, variance,
    perProject, maxHours,
    msDoneThisWeek, deliverablesThisWeek, tasksDoneThisWeek,
    updatesThisWeek, effortDeliveredThisWeek, actualDeliveredThisWeek,
    doneMs, totalMs: allMs.length, totalDeliverables,
  };
}

export type HoursAnalysis = ReturnType<typeof computeHoursAnalysis>;

// ── Performance profile (deadline adherence, extensions, scorecard) ──────────

export function computePerformanceProfile(
  tasks: Task[],
  projects: Project[],
  leaves: LeaveRequest[],
  projectById: Record<string, Project>,
) {
  const now = new Date();
  const exts = tasks.flatMap((t) => t.deadline_extensions ?? []);
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const activeProjects = projects.filter((p) => p.status === "active");

  // 1. Deadline Adherence (vs the task's phase end date)
  let onTimeCount = 0;
  let lateCount = 0;
  let totalLateDays = 0;
  let overdueCount = 0;
  let adherenceTotal = 0;

  for (const task of tasks) {
    const project = projectById[task.project_id];
    if (!project || !task.phase_id) continue;
    const phase = (project.phases ?? []).find((p) => p.id === task.phase_id);
    if (!phase || !phase.end_date) continue;
    const phaseEnd = parseISO(phase.end_date);

    if (task.status === "completed" && task.completed_at) {
      adherenceTotal++;
      const completedDate = parseISO(task.completed_at);
      if (completedDate <= phaseEnd) {
        onTimeCount++;
      } else {
        lateCount++;
        totalLateDays += differenceInCalendarDays(completedDate, phaseEnd);
      }
    } else if (task.status !== "completed" && task.status !== "killed" && task.status !== "redefined") {
      if (isAfter(now, phaseEnd)) {
        overdueCount++;
        adherenceTotal++;
      }
    }
  }
  const onTimePercent = adherenceTotal > 0 ? Math.round((onTimeCount / adherenceTotal) * 100) : 0;
  const avgLateDays = lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0;

  // 2. Extension History
  const firstTimeExts = exts.filter((e) => e.escalation_level === 0).length;
  const repeatExts = exts.filter((e) => e.escalation_level > 0).length;
  const reasonCounts: Record<string, number> = {};
  for (const ext of exts) {
    reasonCounts[ext.reason] = (reasonCounts[ext.reason] || 0) + 1;
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([r]) => r.replace(/_/g, " "));

  // 3. Monthly Scorecard — Last 3 Months
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = subMonths(now, i);
    months.push({ label: format(d, "MMM"), start: startOfMonth(d), end: endOfMonth(d) });
  }
  const scorecard = months.map((m) => {
    const inRange = (dateStr: string) => {
      const d = parseISO(dateStr);
      return !isBefore(d, m.start) && !isAfter(d, m.end);
    };
    return {
      label: m.label,
      completed: tasks.filter((t) => t.completed_at && inRange(t.completed_at)).length,
      extensions: exts.filter((e) => inRange(e.created_at)).length,
      leaves: leaves.filter((l) => inRange(l.start_date)).length,
    };
  });

  // 4. Commitment Summary
  const activeTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "planning");
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const planningCount = tasks.filter((t) => t.status === "planning").length;
  const completionPercent = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const avgEstimated = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0) / tasks.length)
    : 0;
  const tasksWithRevised = tasks.filter((t) => t.revised_estimate_hours !== undefined && t.revised_estimate_hours !== null);
  const avgRevised = tasksWithRevised.length > 0
    ? Math.round(tasksWithRevised.reduce((sum, t) => sum + (t.revised_estimate_hours || t.estimated_hours || 0), 0) / tasksWithRevised.length)
    : null;
  let effortInsight = "";
  if (avgRevised !== null) {
    effortInsight = avgRevised > avgEstimated
      ? "Tends to underestimate effort"
      : "Efficient — often finishes ahead of estimates";
  }

  return {
    onTimeCount, lateCount, avgLateDays, overdueCount, adherenceTotal, onTimePercent,
    extensionCount: exts.length, firstTimeExts, repeatExts, topReasons,
    scorecard,
    activeTasks: activeTasks.length, inProgressCount, planningCount,
    completionPercent, avgEstimated, avgRevised, effortInsight,
    totalProjects: projects.length, activeProjectCount: activeProjects.length,
  };
}

export type PerformanceProfile = ReturnType<typeof computePerformanceProfile>;

// ── Outcome verdict rollup + review rows (appraisal) ─────────────────────────

export type VerdictKey = "met" | "partially_met" | "not_met" | "deferred" | "unclassified" | "unrecorded";

const KNOWN_VERDICTS = new Set(["met", "partially_met", "not_met", "deferred"]);

/** Tolerant mapper — legacy rows may carry free-text outcome strings. */
export function classifyVerdict(outcome?: string | null): VerdictKey {
  const v = (outcome ?? "").trim();
  if (!v) return "unrecorded";
  return KNOWN_VERDICTS.has(v) ? (v as VerdictKey) : "unclassified";
}

export type OutcomeRow = {
  id: string;
  kind: "milestone" | "task";
  title: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle: string;
  verdictKey: VerdictKey;
  /** Raw stored value — shown for unclassified legacy strings. */
  rawVerdict?: string | null;
  notes?: string | null;
  completedAt?: string | null;
  estimated?: number | null;
  actual?: number | null;
  deliverables: Deliverable[];
  attachments?: MilestoneAttachment[];
  timeliness?: { status: TimelineItem["status"]; delayDays: number };
  /** True only when a real deadline was set (milestone target date/day) —
   *  timeliness is judged only for these; undated work is never "late". */
  hasDeadline: boolean;
};

export type OutcomeSummary = {
  counts: Record<VerdictKey, number>;
  /** Rows for completed (or verdict-bearing) milestones + milestone-less tasks, newest first. */
  rows: OutcomeRow[];
  totalConsidered: number;
};

/** Roll up completion verdicts across all milestones (and milestone-less
 *  tasks) for the appraisal scorecard + evidence review list. */
export function computeOutcomeSummary(
  tasks: Task[],
  projectById: Record<string, Project>,
  timelineItems: TimelineItem[],
): OutcomeSummary {
  const counts: Record<VerdictKey, number> = {
    met: 0, partially_met: 0, not_met: 0, deferred: 0, unclassified: 0, unrecorded: 0,
  };
  const timelinessById = new Map(timelineItems.map((i) => [i.id, { status: i.status, delayDays: i.delayDays }]));
  const rows: OutcomeRow[] = [];

  for (const task of tasks) {
    const project = projectById[task.project_id];
    const milestones = task.milestones ?? [];
    if (milestones.length > 0) {
      for (const ms of milestones) {
        const relevant = ms.status === "completed" || !!ms.outcome;
        if (!relevant) continue;
        const key = classifyVerdict(ms.outcome);
        counts[key]++;
        rows.push({
          id: ms.id,
          kind: "milestone",
          title: ms.title,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.project_id,
          projectTitle: project?.title ?? "—",
          verdictKey: key,
          rawVerdict: ms.outcome,
          notes: ms.outcome_notes,
          completedAt: ms.completed_at,
          estimated: ms.estimated_hours,
          actual: ms.actual_hours,
          deliverables: ms.deliverables ?? [],
          attachments: ms.attachments,
          timeliness: timelinessById.get(ms.id),
          hasDeadline: !!ms.target_date || ms.target_day != null,
        });
      }
    } else {
      const relevant = task.status === "completed" || !!task.outcome;
      if (!relevant) continue;
      const key = classifyVerdict(task.outcome);
      counts[key]++;
      rows.push({
        id: task.id,
        kind: "task",
        title: task.title,
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.project_id,
        projectTitle: project?.title ?? "—",
        verdictKey: key,
        rawVerdict: task.outcome,
        notes: task.outcome_notes,
        completedAt: task.completed_at,
        estimated: task.revised_estimate_hours ?? task.estimated_hours,
        actual: task.actual_hours,
        deliverables: task.deliverables ?? [],
        attachments: task.attachments,
        timeliness: timelinessById.get(task.id),
        // A bare task's planned end is synthesized from created_at + estimate,
        // not a chosen deadline — don't judge timeliness against it.
        hasDeadline: false,
      });
    }
  }

  rows.sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tb - ta;
  });

  return {
    counts,
    rows,
    totalConsidered: rows.length,
  };
}

// ── Employee performance index (objective, data-derived) ─────────────────────

export type RatingComponent = {
  key: "outcomes" | "delivery" | "evidence" | "effort";
  label: string;
  /** 0–100, or null when there is not enough data to judge this dimension. */
  score: number | null;
  weight: number;
  detail: string;
};

export type EmployeeRating = {
  /** 0–100 composite, or null when no dimension has data yet. */
  score: number | null;
  /** score / 20 → 0–5, one decimal. */
  stars: number | null;
  band: "Outstanding" | "Strong" | "Developing" | "Needs attention" | "No data yet";
  components: RatingComponent[];
};

const VERDICT_SCORE: Record<string, number> = {
  met: 100,
  partially_met: 60,
  deferred: 50,
  not_met: 0,
};

export function ratingBandColor(band: EmployeeRating["band"]): string {
  switch (band) {
    case "Outstanding": return "text-emerald-700 border-emerald-200 bg-emerald-50";
    case "Strong": return "text-blue-700 border-blue-200 bg-blue-50";
    case "Developing": return "text-amber-700 border-amber-200 bg-amber-50";
    case "Needs attention": return "text-red-700 border-red-200 bg-red-50";
    default: return "text-slate-500 border-slate-200 bg-slate-50";
  }
}

/**
 * Composite 0–100 index over four objective dimensions. Each dimension only
 * counts when it has data; weights are re-normalized over the available ones,
 * so a person with no dated phases isn't punished for the missing signal.
 *
 *  outcomes (40) — avg verdict quality of completed work (met=100, partial=60,
 *                  deferred=50, not met=0; unrecorded/legacy excluded)
 *  delivery (30) — completed within its estimated hours (spent ≤ estimate)
 *  evidence (15) — share of completed work with a deliverable on record
 *  effort   (15) — how close worked hours track the plan (100 = on plan)
 */
export function computeEmployeeRating(
  outcomes: OutcomeSummary,
  analysis: HoursAnalysis,
): EmployeeRating {
  // 1. Outcome quality
  const judged = outcomes.rows.filter((r) => r.verdictKey in VERDICT_SCORE);
  const outcomeScore = judged.length > 0
    ? Math.round(judged.reduce((s, r) => s + VERDICT_SCORE[r.verdictKey], 0) / judged.length)
    : null;

  // 2. On-time delivery — each milestone is judged against its own end date:
  // completed on or before it counts on time. Work without an end date is
  // excluded, never penalized.
  const dated = outcomes.rows.filter(
    (r) =>
      r.hasDeadline &&
      (r.timeliness?.status === "completed_on_time" ||
        r.timeliness?.status === "completed_late"),
  );
  const onTimeCount2 = dated.filter(
    (r) => r.timeliness!.status === "completed_on_time",
  ).length;
  const deliveryDen = dated.length;
  const deliveryScore = deliveryDen > 0 ? Math.round((onTimeCount2 / deliveryDen) * 100) : null;

  // 3. Evidence discipline — completed work backed by a deliverable/attachment
  const completedRows = outcomes.rows;
  const evidenced = completedRows.filter(
    (r) => r.deliverables.length > 0 || (r.attachments?.length ?? 0) > 0,
  ).length;
  const evidenceScore = completedRows.length > 0
    ? Math.round((evidenced / completedRows.length) * 100)
    : null;

  // 4. Effort accuracy — distance from 100% utilization
  const effortScore = analysis.totalPlanned > 0
    ? Math.max(0, 100 - Math.min(100, Math.abs(100 - analysis.utilization)))
    : null;

  const components: RatingComponent[] = [
    {
      key: "outcomes", label: "Outcome quality", score: outcomeScore, weight: 40,
      detail: judged.length > 0
        ? `${judged.length} completed outcome${judged.length === 1 ? "" : "s"} judged`
        : "No outcome verdicts yet",
    },
    {
      key: "delivery", label: "On-time delivery", score: deliveryScore, weight: 30,
      detail: deliveryDen > 0
        ? `${onTimeCount2} of ${deliveryDen} completed by their end date`
        : "No dated completions yet",
    },
    {
      key: "evidence", label: "Deliverable evidence", score: evidenceScore, weight: 15,
      detail: completedRows.length > 0
        ? `${evidenced} of ${completedRows.length} with evidence on record`
        : "No completed work yet",
    },
    {
      key: "effort", label: "Effort vs plan", score: effortScore, weight: 15,
      detail: analysis.totalPlanned > 0
        ? `${analysis.utilization}% of planned hours used`
        : "No planned hours yet",
    },
  ];

  const usable = components.filter((c) => c.score !== null);
  const totalWeight = usable.reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0
    ? Math.round(usable.reduce((s, c) => s + (c.score as number) * c.weight, 0) / totalWeight)
    : null;

  const band: EmployeeRating["band"] =
    score === null ? "No data yet"
    : score >= 85 ? "Outstanding"
    : score >= 70 ? "Strong"
    : score >= 50 ? "Developing"
    : "Needs attention";

  return {
    score,
    stars: score === null ? null : Math.round(score / 2) / 10,
    band,
    components,
  };
}

// ── Flat evidence table rows ─────────────────────────────────────────────────

export type EvidenceRow = {
  deliverable: Deliverable;
  milestoneTitle?: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle: string;
  /** END date of the owning milestone/task — the date every filter keys on. */
  completedAt?: string | null;
};

/** Every deliverable evidence row across all milestones and tasks, dated by
 *  the owning unit's END date, newest first. */
export function computeEvidenceRows(
  tasks: Task[],
  projectById: Record<string, Project>,
): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  for (const task of tasks) {
    const projectTitle = projectById[task.project_id]?.title ?? "—";
    for (const d of task.deliverables ?? []) {
      rows.push({ deliverable: d, taskId: task.id, taskTitle: task.title, projectId: task.project_id, projectTitle, completedAt: task.completed_at });
    }
    for (const ms of task.milestones ?? []) {
      for (const d of ms.deliverables ?? []) {
        // End date when completed, start date while still open.
        rows.push({ deliverable: d, milestoneTitle: ms.title, taskId: task.id, taskTitle: task.title, projectId: task.project_id, projectTitle, completedAt: ms.completed_at ?? ms.start_date });
      }
    }
  }
  rows.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return rows;
}
