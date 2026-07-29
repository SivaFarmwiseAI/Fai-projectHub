"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  format, formatDistanceToNow, parseISO, isAfter, isBefore, isWithinInterval,
  startOfDay, endOfDay, subDays,
} from "date-fns";
import {
  Activity, CheckCircle2, AlertTriangle, MessageSquare, FileText, GitCommit,
  Users, Filter, ArrowLeft, ChevronDown, ListChecks, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/brand-loader";
import {
  users as usersApi,
  projects as projectsApi,
  tasks as tasksApi,
  submissions as submissionsApi,
  standup as standupApi,
  type User,
  type Project,
  type Task,
  type Submission,
  type StandupEntry,
} from "@/lib/api-client";

type DatePreset = "all" | "7d" | "30d" | "90d" | "custom";

type FeedItem = {
  id: string;
  kind: "task_completed" | "task_overdue" | "task_update" | "project_update" | "submission" | "standup" | "feedback";
  userId: string;
  userName: string;
  userColor: string;
  projectId?: string;
  projectTitle?: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  status?: "ok" | "warn" | "danger";
};

export default function TeamActivityPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [standups, setStandups] = useState<StandupEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      usersApi.list().then(r => r.users).catch(() => []),
      projectsApi.list().then(r => r.projects).catch(() => []),
      tasksApi.list().then(r => r.tasks).catch(() => []),
      submissionsApi.list().then(r => r.submissions).catch(() => []),
    ]).then(([u, p, t, s]) => {
      setUsers(u ?? []);
      setProjects(p ?? []);
      setTasks(t ?? []);
      setSubmissions(s ?? []);
    }).finally(() => setLoading(false));

    // Load last 90 days of standups for each user (best-effort, sequential per user)
    // We use a simple approach: pull standups for each user across the broadest window.
    usersApi.list().then(r => {
      const all: StandupEntry[] = [];
      Promise.all(
        (r.users ?? []).map(u =>
          standupApi.history(u.id, 90).then(r2 => {
            all.push(...r2.entries);
          }).catch(() => {})
        )
      ).then(() => setStandups(all));
    }).catch(() => {});
  }, []);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === "all") return { from: null as Date | null, to: null as Date | null };
    if (preset === "7d") return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    if (preset === "30d") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    if (preset === "90d") return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    return {
      from: customFrom ? startOfDay(parseISO(customFrom)) : null,
      to:   customTo   ? endOfDay(parseISO(customTo))     : null,
    };
  }, [preset, customFrom, customTo]);

  const inRange = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    if (!from && !to) return true;
    try {
      const d = parseISO(dateStr);
      if (from && to) return isWithinInterval(d, { start: from, end: to });
      if (from) return !isBefore(d, from);
      if (to) return !isAfter(d, to);
    } catch { return false; }
    return true;
  };

  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

  // Build phase-end map across all projects (for overdue detection)
  const phaseEndMap = useMemo(() => {
    const m: Record<string, Date | null> = {};
    projects.forEach(p => p.phases?.forEach(ph => {
      m[ph.id] = ph.end_date ? parseISO(ph.end_date) : null;
    }));
    return m;
  }, [projects]);

  // Build the unified feed
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    const now = new Date();

    for (const task of tasks) {
      const project = projectMap[task.project_id];
      const phaseEnd = task.phase_id ? phaseEndMap[task.phase_id] ?? null : null;

      // Task completion
      if (task.status === "completed" && task.completed_at) {
        const assigneeIds = task.assignees?.map(a => a.id) ?? (task.assignee_id ? [task.assignee_id] : []);
        for (const uid of assigneeIds) {
          const u = userMap[uid];
          if (!u) continue;
          items.push({
            id: `task-done-${task.id}-${uid}`,
            kind: "task_completed",
            userId: uid,
            userName: u.name,
            userColor: u.avatar_color || "#3b82f6",
            projectId: task.project_id,
            projectTitle: project?.title,
            title: `Completed: ${task.title}`,
            subtitle: phaseEnd && isAfter(parseISO(task.completed_at), phaseEnd) ? "Done late" : "Done on time",
            createdAt: task.completed_at,
            status: phaseEnd && isAfter(parseISO(task.completed_at), phaseEnd) ? "warn" : "ok",
          });
        }
      }

      // Task overdue (open + past phase end)
      if (
        task.status !== "completed" &&
        task.status !== "killed" &&
        task.status !== "redefined" &&
        phaseEnd &&
        isAfter(now, phaseEnd)
      ) {
        const assigneeIds = task.assignees?.map(a => a.id) ?? (task.assignee_id ? [task.assignee_id] : []);
        for (const uid of assigneeIds) {
          const u = userMap[uid];
          if (!u) continue;
          items.push({
            id: `task-overdue-${task.id}-${uid}`,
            kind: "task_overdue",
            userId: uid,
            userName: u.name,
            userColor: u.avatar_color || "#3b82f6",
            projectId: task.project_id,
            projectTitle: project?.title,
            title: `Overdue: ${task.title}`,
            subtitle: `Was due ${format(phaseEnd, "MMM d")}`,
            createdAt: phaseEnd.toISOString(),
            status: "danger",
          });
        }
      }

      // Task updates
      for (const upd of task.updates ?? []) {
        const u = userMap[upd.user_id];
        if (!u) continue;
        items.push({
          id: `task-upd-${upd.id}`,
          kind: "task_update",
          userId: upd.user_id,
          userName: u.name,
          userColor: u.avatar_color || "#3b82f6",
          projectId: task.project_id,
          projectTitle: project?.title,
          title: upd.message || `Updated task: ${task.title}`,
          subtitle: `Task: ${task.title}`,
          createdAt: upd.created_at,
        });
      }
    }

    for (const sub of submissions) {
      const u = userMap[sub.user_id];
      const project = projectMap[sub.project_id];
      if (!u) continue;
      items.push({
        id: `sub-${sub.id}`,
        kind: "submission",
        userId: sub.user_id,
        userName: u.name,
        userColor: u.avatar_color || "#3b82f6",
        projectId: sub.project_id,
        projectTitle: project?.title,
        title: `Submitted: ${sub.title}`,
        subtitle: sub.type,
        createdAt: sub.created_at,
      });

      // Feedback the submitter received doesn't belong to them; feedback authors:
      for (const fb of sub.feedback ?? []) {
        const fbUser = fb.from_user_id ? userMap[fb.from_user_id] : null;
        if (!fbUser) continue;
        items.push({
          id: `fb-${fb.id}`,
          kind: "feedback",
          userId: fb.from_user_id!,
          userName: fbUser.name,
          userColor: fbUser.avatar_color || "#3b82f6",
          projectId: sub.project_id,
          projectTitle: project?.title,
          title: `Reviewed: ${sub.title}`,
          subtitle: fb.text?.slice(0, 80) || "Feedback posted",
          createdAt: fb.created_at,
        });
      }
    }

    for (const entry of standups) {
      const u = userMap[entry.user_id];
      if (!u) continue;
      items.push({
        id: `standup-${entry.id}`,
        kind: "standup",
        userId: entry.user_id,
        userName: u.name,
        userColor: u.avatar_color || "#3b82f6",
        title: "Posted standup",
        subtitle: entry.today?.slice(0, 80) || entry.yesterday?.slice(0, 80) || "Daily update",
        createdAt: entry.created_at,
        status: entry.blockers && !entry.blockers.toLowerCase().startsWith("none") ? "warn" : "ok",
      });
    }

    return items
      .filter(i => inRange(i.createdAt))
      .filter(i => selectedUserIds.length === 0 || selectedUserIds.includes(i.userId))
      .filter(i => selectedKinds.length === 0 || selectedKinds.includes(i.kind))
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
  }, [tasks, submissions, standups, userMap, projectMap, phaseEndMap, from, to, selectedUserIds, selectedKinds]);

  // Per-user summary cards
  const perUserSummary = useMemo(() => {
    const map: Record<string, {
      user: User; completed: number; overdue: number; updates: number; submissions: number; standups: number;
    }> = {};

    users.forEach(u => {
      map[u.id] = { user: u, completed: 0, overdue: 0, updates: 0, submissions: 0, standups: 0 };
    });

    for (const item of feed) {
      const s = map[item.userId];
      if (!s) continue;
      if (item.kind === "task_completed") s.completed++;
      else if (item.kind === "task_overdue") s.overdue++;
      else if (item.kind === "task_update" || item.kind === "project_update" || item.kind === "feedback") s.updates++;
      else if (item.kind === "submission") s.submissions++;
      else if (item.kind === "standup") s.standups++;
    }

    return Object.values(map)
      .filter(s => selectedUserIds.length === 0 || selectedUserIds.includes(s.user.id))
      .sort((a, b) => (b.completed + b.updates + b.submissions) - (a.completed + a.updates + a.submissions));
  }, [feed, users, selectedUserIds]);

  const totalCompleted = feed.filter(i => i.kind === "task_completed").length;
  const totalOverdue = feed.filter(i => i.kind === "task_overdue").length;
  const totalUpdates = feed.filter(i => i.kind === "task_update" || i.kind === "project_update").length;
  const totalSubmissions = feed.filter(i => i.kind === "submission").length;

  const toggleKind = (k: string) =>
    setSelectedKinds(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const toggleUser = (id: string) =>
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (loading) {
    return <BrandLoader label="Loading activity…" />;
  }

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/team" className="inline-flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Team
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Team Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-project activity feed — completed tasks, overdue work, updates, submissions, and standups
          </p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Date presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" /> Date
            </div>
            {([
              { id: "7d",  label: "7 days" },
              { id: "30d", label: "30 days" },
              { id: "90d", label: "90 days" },
              { id: "all", label: "All time" },
              { id: "custom", label: "Custom" },
            ] as { id: DatePreset; label: string }[]).map(p => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  preset === p.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Kind filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <ListChecks className="h-3.5 w-3.5" /> Type
            </div>
            {([
              { id: "task_completed", label: "Completed", color: "#22c55e" },
              { id: "task_overdue",   label: "Overdue",   color: "#ef4444" },
              { id: "task_update",    label: "Task update", color: "#3b82f6" },
              { id: "submission",     label: "Submissions", color: "#8b5cf6" },
              { id: "feedback",       label: "Feedback",  color: "#06b6d4" },
              { id: "standup",        label: "Standup",   color: "#f59e0b" },
            ]).map(k => {
              const active = selectedKinds.includes(k.id);
              return (
                <button
                  key={k.id}
                  onClick={() => toggleKind(k.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    active ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800/60"
                  }`}
                  style={active ? { backgroundColor: k.color } : {}}
                >
                  {k.label}
                </button>
              );
            })}
            {selectedKinds.length > 0 && (
              <button onClick={() => setSelectedKinds([])} className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 underline ml-1">
                clear
              </button>
            )}
          </div>

          {/* User filter */}
          <div className="flex items-center gap-2 flex-wrap relative">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" /> Members
            </div>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {selectedUserIds.length === 0 ? "All members" : `${selectedUserIds.length} selected`}
              <ChevronDown className="h-3 w-3" />
            </button>
            {selectedUserIds.length > 0 && (
              <button onClick={() => setSelectedUserIds([])} className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 underline">
                clear
              </button>
            )}
            {userMenuOpen && (
              <div className="absolute top-full left-32 mt-1 z-20 bg-white border rounded-xl shadow-lg p-2 max-h-72 overflow-y-auto w-64 dark:bg-slate-800 dark:border-slate-700">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="h-3.5 w-3.5"
                    />
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: u.avatar_color || "#64748b" }}
                    >
                      {u.name?.[0] ?? "?"}
                    </div>
                    <span className="text-xs flex-1 truncate">{u.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Tasks Completed" value={totalCompleted} color="#22c55e" bg="#f0fdf4" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Overdue Now"     value={totalOverdue}   color="#ef4444" bg="#fef2f2" />
        <SummaryCard icon={<MessageSquare className="h-4 w-4" />} label="Updates Posted"  value={totalUpdates}   color="#3b82f6" bg="#eff6ff" />
        <SummaryCard icon={<FileText className="h-4 w-4" />}      label="Submissions"     value={totalSubmissions} color="#8b5cf6" bg="#f5f3ff" />
      </div>

      {/* ── Per-Member Summary ── */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Per-member summary</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Activity per member in the selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">Member</th>
                  <th className="text-center px-3 py-2 font-bold">Completed</th>
                  <th className="text-center px-3 py-2 font-bold">Overdue</th>
                  <th className="text-center px-3 py-2 font-bold">Updates</th>
                  <th className="text-center px-3 py-2 font-bold">Submissions</th>
                  <th className="text-center px-3 py-2 font-bold">Standups</th>
                  <th className="text-right px-4 py-2 font-bold">Profile</th>
                </tr>
              </thead>
              <tbody>
                {perUserSummary.map(({ user, completed, overdue, updates, submissions, standups }) => (
                  <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ backgroundColor: user.avatar_color || "#64748b" }}
                        >
                          {user.name?.[0] ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">{user.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{user.department || user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{completed}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className={`text-sm font-bold ${overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300 dark:text-slate-600"}`}>{overdue}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{updates}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{submissions}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{standups}</span>
                    </td>
                    <td className="text-right px-4 py-2.5">
                      <Link href={`/team/${user.id}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        View <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Feed ── */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Activity feed</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{feed.length} event{feed.length !== 1 ? "s" : ""} in this view</p>
            </div>
          </div>
          {feed.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
              No activity matches the current filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {feed.slice(0, 200).map(item => (
                <FeedRow key={item.id} item={item} />
              ))}
              {feed.length > 200 && (
                <div className="px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                  Showing 200 of {feed.length} events — narrow the filters to see more.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon, label, value, color, bg,
}: {
  icon: React.ReactNode; label: string; value: number; color: string; bg: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg, color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const kindConfig: Record<FeedItem["kind"], { icon: React.ReactNode; color: string; bg: string }> = {
    task_completed: { icon: <CheckCircle2 className="h-4 w-4" />, color: "#15803d", bg: "#dcfce7" },
    task_overdue:   { icon: <AlertTriangle className="h-4 w-4" />, color: "#b91c1c", bg: "#fee2e2" },
    task_update:    { icon: <GitCommit className="h-4 w-4" />,    color: "#1d4ed8", bg: "#dbeafe" },
    project_update: { icon: <MessageSquare className="h-4 w-4" />, color: "#1d4ed8", bg: "#dbeafe" },
    submission:     { icon: <FileText className="h-4 w-4" />,    color: "#7c3aed", bg: "#ede9fe" },
    feedback:       { icon: <MessageSquare className="h-4 w-4" />, color: "#0891b2", bg: "#cffafe" },
    standup:        { icon: <Activity className="h-4 w-4" />,    color: "#b45309", bg: "#fef3c7" },
  };
  const cfg = kindConfig[item.kind];
  const when = (() => {
    try { return formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true }); } catch { return ""; }
  })();

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: item.userColor }}
          >
            {item.userName[0]}
          </div>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.userName}</span>
          {item.projectTitle && item.projectId && (
            <Link
              href={`/projects/${item.projectId}`}
              className="text-[11px] text-blue-600 hover:underline truncate max-w-[200px]"
            >
              {item.projectTitle}
            </Link>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">{when}</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
        )}
      </div>
    </div>
  );
}
