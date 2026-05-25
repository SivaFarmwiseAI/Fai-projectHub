"use client";

import { useMemo, useState, useEffect } from "react";
import {
  format,
  parseISO,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import {
  CheckCircle2, AlertTriangle, Activity, PauseCircle,
  FileText, MessageSquare, TrendingUp, ChevronRight, Filter, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  submissions as submissionsApi,
  projects as projectsApi,
  type Project,
  type Task,
  type User,
  type Submission,
  type ProjectUpdate,
} from "@/lib/api-client";

type Member = User & { roleInProject?: "owner" | "co-owner" | "assignee" };

type DatePreset = "all" | "7d" | "30d" | "90d" | "custom";

function getStatusForTask(task: Task, phaseEnd: Date | null, now: Date): "done_on_time" | "done_late" | "overdue" | "in_progress" | "blocked" | "planning" {
  if (task.status === "completed") {
    if (phaseEnd && task.completed_at) {
      return isAfter(parseISO(task.completed_at), phaseEnd) ? "done_late" : "done_on_time";
    }
    return "done_on_time";
  }
  if (task.status === "blocked") return "blocked";
  if (task.status === "planning") return "planning";
  if (phaseEnd && isAfter(now, phaseEnd)) return "overdue";
  return "in_progress";
}

function inDateRange(dateStr: string | undefined, from: Date | null, to: Date | null): boolean {
  if (!dateStr) return false;
  if (!from && !to) return true;
  try {
    const d = parseISO(dateStr);
    if (from && to) return isWithinInterval(d, { start: from, end: to });
    if (from) return !isBefore(d, from);
    if (to) return !isAfter(d, to);
  } catch { return false; }
  return true;
}

export function ProjectPerformanceTab({
  project,
  tasks,
}: {
  project: Project;
  tasks: Task[];
}) {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    submissionsApi.list({ project_id: project.id }).then(r => setSubmissions(r.submissions)).catch(() => {});
    projectsApi.updates(project.id).then(r => setProjectUpdates(r.updates)).catch(() => {});
  }, [project.id]);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === "all") return { from: null, to: null };
    if (preset === "7d") return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    if (preset === "30d") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    if (preset === "90d") return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    return {
      from: customFrom ? startOfDay(parseISO(customFrom)) : null,
      to: customTo ? endOfDay(parseISO(customTo)) : null,
    };
  }, [preset, customFrom, customTo]);

  // Build member list (owner + co-owners + assignees, deduped)
  const members: Member[] = useMemo(() => {
    const map = new Map<string, Member>();
    if (project.owner_id) {
      map.set(project.owner_id, {
        id: project.owner_id,
        name: project.owner_name ?? "Owner",
        email: "",
        role: "Owner",
        role_type: "Member",
        department: "",
        avatar_color: project.owner_avatar_color ?? "#3b82f6",
        roleInProject: "owner",
      });
    }
    project.co_owners?.forEach(u => map.set(u.id, { ...u, roleInProject: "co-owner" }));
    project.assignees?.forEach(u => {
      if (!map.has(u.id)) map.set(u.id, { ...u, roleInProject: "assignee" });
    });
    return Array.from(map.values());
  }, [project]);

  const phaseEndMap = useMemo(() => {
    const m: Record<string, Date | null> = {};
    project.phases?.forEach(p => {
      m[p.id] = p.end_date ? parseISO(p.end_date) : null;
    });
    return m;
  }, [project.phases]);

  // Compute per-member metrics
  const memberStats = useMemo(() => {
    const now = new Date();
    return members.map(member => {
      const myTasks = tasks.filter(t =>
        t.assignee_id === member.id ||
        t.assignees?.some(a => a.id === member.id),
      );

      const completed = myTasks.filter(t => t.status === "completed");
      const completedInRange = completed.filter(t => inDateRange(t.completed_at, from, to));

      let overdueCount = 0;
      let doneLate = 0;
      let doneOnTime = 0;
      let inProgress = 0;
      let blocked = 0;
      let planning = 0;

      for (const task of myTasks) {
        const phaseEnd = task.phase_id ? phaseEndMap[task.phase_id] ?? null : null;
        const status = getStatusForTask(task, phaseEnd, now);
        if (status === "done_on_time" && inDateRange(task.completed_at, from, to)) doneOnTime++;
        if (status === "done_late" && inDateRange(task.completed_at, from, to)) doneLate++;
        if (status === "overdue") overdueCount++;
        if (status === "in_progress") inProgress++;
        if (status === "blocked") blocked++;
        if (status === "planning") planning++;
      }

      const taskUpdatesInRange = myTasks.flatMap(t => (t.updates ?? []).filter(u => u.user_id === member.id && inDateRange(u.created_at, from, to)));
      const submissionsInRange = submissions.filter(s => s.user_id === member.id && inDateRange(s.created_at, from, to));
      const updatesInRange = projectUpdates.filter(u => u.user_id === member.id && inDateRange(u.created_at, from, to));

      const totalTasks = myTasks.length;
      const completionPercent = totalTasks > 0 ? Math.round((completed.length / totalTasks) * 100) : 0;
      const onTimeRate = (doneOnTime + doneLate) > 0 ? Math.round((doneOnTime / (doneOnTime + doneLate)) * 100) : null;

      return {
        member,
        totalTasks,
        completedInRange: completedInRange.length,
        doneOnTime,
        doneLate,
        overdueCount,
        inProgress,
        blocked,
        planning,
        completionPercent,
        onTimeRate,
        taskUpdates: taskUpdatesInRange.length,
        projectUpdates: updatesInRange.length,
        submissions: submissionsInRange.length,
        activityScore: doneOnTime * 3 + doneLate * 1 + taskUpdatesInRange.length + updatesInRange.length + submissionsInRange.length * 2 - blocked * 2 - overdueCount,
      };
    });
  }, [members, tasks, phaseEndMap, from, to, projectUpdates, submissions]);

  const sortedStats = useMemo(
    () => [...memberStats].sort((a, b) => b.activityScore - a.activityScore),
    [memberStats],
  );

  const selectedStats = selectedMemberId
    ? memberStats.find(s => s.member.id === selectedMemberId)
    : null;

  const selectedMemberTasks = useMemo(() => {
    if (!selectedStats) return [];
    return tasks.filter(t =>
      t.assignee_id === selectedStats.member.id ||
      t.assignees?.some(a => a.id === selectedStats.member.id),
    );
  }, [tasks, selectedStats]);

  return (
    <div className="space-y-6">
      {/* ── Filter Bar ── */}
      <Card className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Date range
          </div>
          {([
            { id: "7d",  label: "Last 7 days" },
            { id: "30d", label: "Last 30 days" },
            { id: "90d", label: "Last 90 days" },
            { id: "all", label: "All time" },
            { id: "custom", label: "Custom" },
          ] as { id: DatePreset; label: string }[]).map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                preset === p.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              />
            </div>
          )}
          <div className="ml-auto text-[11px] text-slate-400">
            {from || to ? (
              <span>
                {from ? format(from, "MMM d, yyyy") : "—"} → {to ? format(to, "MMM d, yyyy") : "—"}
              </span>
            ) : (
              <span>All time</span>
            )}
          </div>
        </div>
      </Card>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tasks Completed"
          value={memberStats.reduce((s, m) => s + m.doneOnTime + m.doneLate, 0)}
          sub={`${memberStats.reduce((s, m) => s + m.doneOnTime, 0)} on time`}
          color="#22c55e"
          bg="#f0fdf4"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Overdue Tasks"
          value={memberStats.reduce((s, m) => s + m.overdueCount, 0)}
          sub={`${memberStats.reduce((s, m) => s + m.blocked, 0)} blocked`}
          color="#ef4444"
          bg="#fef2f2"
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Updates Posted"
          value={memberStats.reduce((s, m) => s + m.taskUpdates + m.projectUpdates, 0)}
          sub={`${memberStats.reduce((s, m) => s + m.submissions, 0)} submissions`}
          color="#3b82f6"
          bg="#eff6ff"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Team Members"
          value={members.length}
          sub={`${memberStats.filter(m => m.totalTasks > 0).length} active`}
          color="#8b5cf6"
          bg="#f5f3ff"
        />
      </div>

      {/* ── Members Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Member Performance</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Sorted by activity score</p>
            </div>
          </div>

          {sortedStats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No team members on this project yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedStats.map((stats, i) => {
                const m = stats.member;
                const isSelected = selectedMemberId === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(isSelected ? null : m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-blue-50/60" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-400 w-5 shrink-0">#{i + 1}</span>
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: m.avatar_color || "#64748b" }}
                    >
                      {m.name?.[0] ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                        {m.roleInProject && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 capitalize">
                            {m.roleInProject}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.role}</p>
                    </div>

                    {/* Mini stats */}
                    <div className="hidden md:flex items-center gap-4 text-xs shrink-0">
                      <MiniStat label="Done" value={stats.doneOnTime + stats.doneLate} color="#22c55e" />
                      <MiniStat label="Overdue" value={stats.overdueCount} color="#ef4444" />
                      <MiniStat label="In Prog" value={stats.inProgress} color="#3b82f6" />
                      <MiniStat label="Updates" value={stats.taskUpdates + stats.projectUpdates} color="#8b5cf6" />
                    </div>

                    {/* On-time rate */}
                    <div className="w-24 shrink-0 hidden sm:block">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 mb-0.5">
                        <span>On-time</span>
                        <span className="font-bold text-slate-700">
                          {stats.onTimeRate !== null ? `${stats.onTimeRate}%` : "—"}
                        </span>
                      </div>
                      <Progress value={stats.onTimeRate ?? 0} className="h-1.5" />
                    </div>

                    <ChevronRight
                      className={`h-4 w-4 text-slate-300 shrink-0 transition-transform ${
                        isSelected ? "rotate-90 text-blue-500" : ""
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Drill-down Detail ── */}
      {selectedStats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-base font-bold text-white"
                  style={{ backgroundColor: selectedStats.member.avatar_color || "#64748b" }}
                >
                  {selectedStats.member.name?.[0] ?? "?"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedStats.member.name}'s contribution
                  </h3>
                  <p className="text-xs text-slate-400">
                    {project.title}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMemberId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <DetailStat icon={<CheckCircle2 />} label="Completed" value={selectedStats.doneOnTime + selectedStats.doneLate} color="#22c55e" />
              <DetailStat icon={<AlertTriangle />} label="Overdue" value={selectedStats.overdueCount} color="#ef4444" />
              <DetailStat icon={<Activity />} label="In Progress" value={selectedStats.inProgress} color="#3b82f6" />
              <DetailStat icon={<PauseCircle />} label="Blocked" value={selectedStats.blocked} color="#f59e0b" />
            </div>

            {/* Task list */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Tasks ({selectedMemberTasks.length})
              </h4>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {selectedMemberTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No tasks assigned</p>
                ) : (
                  selectedMemberTasks.map(task => {
                    const phaseEnd = task.phase_id ? phaseEndMap[task.phase_id] ?? null : null;
                    const status = getStatusForTask(task, phaseEnd, new Date());
                    const statusInfo: Record<string, { label: string; color: string; bg: string }> = {
                      done_on_time: { label: "Done", color: "#15803d", bg: "#dcfce7" },
                      done_late:    { label: "Done late", color: "#b45309", bg: "#fef3c7" },
                      overdue:      { label: "Overdue", color: "#b91c1c", bg: "#fee2e2" },
                      in_progress:  { label: "In progress", color: "#1d4ed8", bg: "#dbeafe" },
                      blocked:      { label: "Blocked", color: "#b91c1c", bg: "#fee2e2" },
                      planning:     { label: "Planning", color: "#475569", bg: "#f1f5f9" },
                    };
                    const info = statusInfo[status];
                    const delay = status === "done_late" && task.completed_at && phaseEnd
                      ? differenceInCalendarDays(parseISO(task.completed_at), phaseEnd)
                      : status === "overdue" && phaseEnd
                        ? differenceInCalendarDays(new Date(), phaseEnd)
                        : 0;

                    return (
                      <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                          style={{ color: info.color, background: info.bg }}
                        >
                          {info.label}
                          {delay > 0 ? ` +${delay}d` : ""}
                        </span>
                        <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{task.title}</span>
                        {task.priority && (
                          <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                            {task.priority}
                          </Badge>
                        )}
                        {task.completed_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {format(parseISO(task.completed_at), "MMM d")}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Activity counts */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-1">
                  <Activity className="h-3 w-3" /> Task updates
                </div>
                <p className="text-lg font-bold text-slate-900">{selectedStats.taskUpdates}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-1">
                  <MessageSquare className="h-3 w-3" /> Project updates
                </div>
                <p className="text-lg font-bold text-slate-900">{selectedStats.projectUpdates}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-1">
                  <FileText className="h-3 w-3" /> Submissions
                </div>
                <p className="text-lg font-bold text-slate-900">{selectedStats.submissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, color, bg,
}: {
  icon: React.ReactNode; label: string; value: number | string; sub: string; color: string; bg: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg, color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold leading-none" style={{ color }}>{value}</p>
      <p className="text-[9px] font-medium text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function DetailStat({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <div className="p-2.5 rounded-lg border border-slate-100">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
