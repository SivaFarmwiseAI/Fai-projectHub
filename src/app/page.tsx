"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { MemberDashboard } from "@/components/member-dashboard";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  FolderKanban, ClipboardCheck, CheckCircle2, Users, AlertTriangle, Clock,
  Sparkles, ArrowRight, ShieldAlert, Lightbulb, Zap, BarChart3,
  X, Filter, CalendarClock, Activity, Target,
  Star, Sun, Loader2, TrendingUp,
} from "lucide-react";
import {
  projects as projectsApi, users as usersApi, tasks as tasksApi,
  analytics, leave as leaveApi,
} from "@/lib/api-client";
import type {
  Project, User, Task, DashboardStats, AiInsight, LeaveRequest,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeboxDays);
  return Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const PIPELINE_STAGES = [
  { label: "Kickoff / Planning", color: "#6366f1", bg: "#eef2ff" },
  { label: "In Development",     color: "#3b82f6", bg: "#eff6ff" },
  { label: "Review & Testing",   color: "#f59e0b", bg: "#fffbeb" },
  { label: "Final Stage",        color: "#10b981", bg: "#f0fdf4" },
] as const;

function pipelineStage(phase: string): 0 | 1 | 2 | 3 {
  const p = phase.toLowerCase();
  if (/(plan|req|scop|kick|defin|audit|problem|ideation|discover|eda|feature\s*eng|positioning|scoping)/.test(p)) return 0;
  if (/(dev|build|impl|eng|feature|model|content|ingest|transform|foundation|campaign|data\s*col)/.test(p)) return 1;
  if (/(test|review|eval|qa|polish|analysis|report|feedback|pilot|validat|orch|adoption)/.test(p)) return 2;
  if (/(done|deploy|launch|adopt|sign.off|complet|deliver|handoff|post|monitor)/.test(p)) return 3;
  return 1;
}

const insightIcons: Record<string, React.ReactNode> = {
  risk:        <ShieldAlert className="h-4 w-4 text-red-600" />,
  blocker:     <AlertTriangle className="h-4 w-4 text-red-600" />,
  opportunity: <TrendingUp className="h-4 w-4 text-green-600" />,
  suggestion:  <Lightbulb className="h-4 w-4 text-amber-600" />,
  performance: <Zap className="h-4 w-4 text-blue-600" />,
};

const insightBorders: Record<string, string> = {
  risk:        "border-red-200 bg-red-50",
  blocker:     "border-red-200 bg-red-50",
  opportunity: "border-green-200 bg-green-50",
  suggestion:  "border-amber-200 bg-amber-50",
  performance: "border-blue-200 bg-blue-50",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-600", medium: "bg-blue-600", high: "bg-amber-600", critical: "bg-red-600",
};

const typeColors: Record<string, string> = {
  engineering: "text-blue-700 border-blue-200 bg-blue-50",
  research:    "text-purple-700 border-purple-200 bg-purple-50",
  mixed:       "text-teal-700 border-teal-200 bg-teal-50",
  data_science:"text-violet-700 border-violet-200 bg-violet-50",
  design:      "text-pink-700 border-pink-200 bg-pink-50",
  sales:       "text-orange-700 border-orange-200 bg-orange-50",
  marketing:   "text-rose-700 border-rose-200 bg-rose-50",
  operations:  "text-slate-700 border-slate-200 bg-slate-50",
  hr:          "text-cyan-700 border-cyan-200 bg-cyan-50",
  legal:       "text-gray-700 border-gray-200 bg-gray-50",
  strategy:    "text-indigo-700 border-indigo-200 bg-indigo-50",
  product:     "text-emerald-700 border-emerald-200 bg-emerald-50",
  finance:     "text-amber-700 border-amber-200 bg-amber-50",
};

const statusColors: Record<string, string> = {
  active:    "text-emerald-700 border-emerald-200 bg-emerald-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  killed:    "text-red-700 border-red-200 bg-red-50",
  paused:    "text-amber-700 border-amber-200 bg-amber-50",
};

function StatCard({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: number; alert?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="relative">
            {icon}
            {alert && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { isCEO, isAdmin } = useAuth();

  if (!isCEO && !isAdmin) return <MemberDashboard />;

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [pendingLeave, setPendingLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  useEffect(() => {
    Promise.all([
      projectsApi.list().then(r => setProjectList(r.projects)),
      tasksApi.list().then(r => setTaskList(r.tasks)),
      usersApi.list().then(r => setUserList(r.users)),
      analytics.dashboard().then(r => setStats(r.stats)),
      analytics.briefing().then(r => setInsights(r.insights ?? [])).catch(() => {}),
      leaveApi.list({ status: "pending" }).then(r => setPendingLeave(r.leave)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const statusMap: Record<string, string> = {
    "In Progress": "in_progress", "Blocked": "blocked",
    "Completed": "completed", "Planning": "planning",
  };
  const priorityMap: Record<string, string> = {
    "High": "high", "Medium": "medium", "Low": "low",
  };

  const filteredTasks = useMemo(() => {
    let list = taskList;
    if (selectedPerson) list = list.filter(t => t.assignee_id === selectedPerson);
    if (statusFilter !== "All") list = list.filter(t => t.status === statusMap[statusFilter]);
    if (priorityFilter !== "All") list = list.filter(t => t.priority === priorityMap[priorityFilter]);
    return list;
  }, [taskList, selectedPerson, statusFilter, priorityFilter]);

  const filteredProjects = useMemo(() => {
    if (!selectedPerson && statusFilter === "All" && priorityFilter === "All") {
      return projectList.filter(p => p.status !== "completed");
    }
    let list = projectList;
    if (selectedPerson) {
      list = list.filter(p =>
        p.owner_id === selectedPerson ||
        p.assignees?.some(u => u.id === selectedPerson)
      );
    }
    if (statusFilter !== "All" || priorityFilter !== "All") {
      const taskIds = new Set(filteredTasks.map(t => t.project_id));
      list = list.filter(p => taskIds.has(p.id));
    }
    return list;
  }, [projectList, selectedPerson, statusFilter, priorityFilter, filteredTasks]);

  const selectedUser = selectedPerson ? userList.find(u => u.id === selectedPerson) : null;
  const hasActiveFilters = selectedPerson !== null || statusFilter !== "All" || priorityFilter !== "All";

  const blockedProjectIds = useMemo(() => {
    const ids = new Set<string>();
    taskList.filter(t => t.status === "blocked").forEach(t => ids.add(t.project_id));
    return ids;
  }, [taskList]);

  const pipelineProjects = useMemo(
    () => projectList.filter(p => p.status === "active"),
    [projectList]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground mt-1">Your projects, team, and AI-powered insights at a glance</p>
      </div>

      {/* My Day */}
      {(stats?.pending_reviews ?? 0) + (stats?.pending_captures ?? 0) + (stats?.pending_leave ?? 0) + (stats?.blocked_tasks ?? 0) > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                  <Sun className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">My Day</h2>
                  <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Reviews", value: stats?.pending_reviews ?? 0, href: "/reviews", color: "text-amber-600", icon: <ClipboardCheck className="h-4 w-4" /> },
                { label: "Pending Leave", value: stats?.pending_leave ?? 0, href: "/team/availability", color: "text-blue-600", icon: <CalendarClock className="h-4 w-4" /> },
                { label: "Blocked Tasks", value: stats?.blocked_tasks ?? 0, href: "/", color: "text-red-600", icon: <AlertTriangle className="h-4 w-4" /> },
                { label: "AI Captures", value: stats?.pending_captures ?? 0, href: "/capture", color: "text-purple-600", icon: <Sparkles className="h-4 w-4" /> },
              ].filter(s => s.value > 0).map(s => (
                <Link key={s.label} href={s.href}>
                  <div className={`flex items-center gap-2 p-3 rounded-xl bg-white/70 border hover:bg-white transition-colors ${s.color}`}>
                    {s.icon}
                    <div>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pending leave list */}
            {pendingLeave.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pending Leave Approvals</p>
                {pendingLeave.slice(0, 3).map(lr => (
                  <div key={lr.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60 border border-blue-100 text-xs">
                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                      {(lr.user_name ?? "?")[0]}
                    </div>
                    <span className="font-medium text-slate-700">{lr.user_name}</span>
                    <span className="text-muted-foreground">{lr.type}</span>
                    <span className="text-muted-foreground ml-auto">{lr.start_date} – {lr.end_date}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<FolderKanban className="h-8 w-8 text-blue-600" />} label="Active Projects" value={stats.active_projects} />
          <StatCard icon={<CheckCircle2 className="h-8 w-8 text-green-600" />} label="Completed" value={stats.completed_projects} />
          <StatCard icon={<AlertTriangle className="h-8 w-8 text-red-600" />} label="Blocked Tasks" value={stats.blocked_tasks} alert={stats.blocked_tasks > 0} />
          <StatCard icon={<Users className="h-8 w-8 text-purple-600" />} label="Team Size" value={stats.team_size} />
        </div>
      )}

      {/* ── Project Pipeline Flow ─────────────────────────── */}
      {pipelineProjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">Project Pipeline</h2>
              <span className="text-sm font-normal text-muted-foreground">
                ({pipelineProjects.length} active)
              </span>
            </div>
            <Link href="/projects/timeline">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                Timeline View
              </Button>
            </Link>
          </div>

          {/* CEO action banner — blockers + overdue */}
          {(() => {
            const overdueCount  = pipelineProjects.filter(p => getDaysRemaining(p.start_date, p.timebox_days) < 0).length;
            const blockedCount  = pipelineProjects.filter(p => blockedProjectIds.has(p.id)).length;
            if (!overdueCount && !blockedCount) return null;
            return (
              <div className="flex flex-wrap gap-3">
                {blockedCount > 0 && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-700">
                      {blockedCount} project{blockedCount > 1 ? "s" : ""} blocked — intervention needed
                    </span>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-700">
                      {overdueCount} project{overdueCount > 1 ? "s" : ""} past deadline
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Swimlane */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PIPELINE_STAGES.map((stage, stageIdx) => {
              const stageProjects = pipelineProjects.filter(
                p => pipelineStage(p.current_phase) === stageIdx
              );
              return (
                <div
                  key={stage.label}
                  className="rounded-xl border-2 border-dashed p-3 min-h-[120px]"
                  style={{ borderColor: stage.color + "40", background: stage.bg }}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: stage.color }}
                    >
                      {stageIdx + 1}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 leading-tight">{stage.label}</span>
                    {stageProjects.length > 0 && (
                      <span
                        className="ml-auto h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                        style={{ background: stage.color }}
                      >
                        {stageProjects.length}
                      </span>
                    )}
                  </div>

                  {/* Project cards */}
                  <div className="space-y-2">
                    {stageProjects.map(p => {
                      const taskCount     = p.task_count ?? 0;
                      const completed     = p.completed_tasks ?? 0;
                      const progress      = taskCount > 0 ? (completed / taskCount) * 100 : 0;
                      const daysLeft      = getDaysRemaining(p.start_date, p.timebox_days);
                      const isBlocked     = blockedProjectIds.has(p.id);
                      const isOverdue     = daysLeft < 0;
                      const barColor      = isBlocked ? "#ef4444" : isOverdue ? "#f59e0b" : stage.color;

                      return (
                        <Link key={p.id} href={`/projects/${p.id}`}>
                          <div
                            className={cn(
                              "p-2.5 rounded-xl bg-white border cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all",
                              isBlocked  ? "border-red-300"   :
                              isOverdue  ? "border-amber-300" : "border-slate-100/80"
                            )}
                          >
                            {/* Status badges */}
                            {(isBlocked || isOverdue) && (
                              <div className="flex gap-1 mb-1.5">
                                {isBlocked && (
                                  <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                    BLOCKED
                                  </span>
                                )}
                                {isOverdue && (
                                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                            )}

                            <p className="text-[11px] font-bold text-slate-900 truncate leading-tight mb-0.5">
                              {p.title}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mb-2">
                              {p.current_phase}
                            </p>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-1 mb-1.5">
                              <div
                                className="h-1 rounded-full transition-all"
                                style={{ width: `${Math.min(progress, 100)}%`, background: barColor }}
                              />
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-semibold text-slate-400">
                                {completed}/{taskCount} tasks
                              </span>
                              <span
                                className={cn(
                                  "text-[9px] font-bold",
                                  isBlocked ? "text-red-500" :
                                  isOverdue ? "text-amber-600" : "text-slate-400"
                                )}
                              >
                                {isOverdue
                                  ? `${Math.abs(daysLeft)}d over`
                                  : daysLeft === 0 ? "Due today"
                                  : `${daysLeft}d left`}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}

                    {stageProjects.length === 0 && (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-[10px] text-slate-300 font-medium">No projects</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phase legend */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Flow:</span>
            {PIPELINE_STAGES.map((s, i) => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: s.color }}>
                  {s.label}
                </span>
                {i < PIPELINE_STAGES.length - 1 && (
                  <span className="text-slate-300 text-xs">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">AI Insights</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.slice(0, 6).map(insight => (
              <div
                key={insight.id}
                className={`p-4 rounded-xl border ${insightBorders[insight.type] ?? "border-gray-200 bg-gray-50"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{insightIcons[insight.type] ?? <Star className="h-4 w-4 text-gray-500" />}</div>
                  <div>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    {insight.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{insight.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by:</span>
          </div>

          {/* Person filter */}
          <select
            value={selectedPerson ?? ""}
            onChange={e => setSelectedPerson(e.target.value || null)}
            className="text-xs border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Team Members</option>
            {userList.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
            ))}
          </select>

          {/* Status filter */}
          {["All", "In Progress", "Blocked", "Planning", "Completed"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                statusFilter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {s}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={() => { setSelectedPerson(null); setStatusFilter("All"); setPriorityFilter("All"); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {selectedUser && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: selectedUser.avatar_color }}
            >
              {selectedUser.name[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">{selectedUser.name}</p>
              <p className="text-xs text-blue-600">{selectedUser.role} · {selectedUser.department}</p>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-blue-700">
              <span><strong>{filteredTasks.filter(t => t.status !== "completed").length}</strong> active tasks</span>
              <span><strong>{filteredTasks.filter(t => t.status === "completed").length}</strong> done</span>
              <span><strong>{filteredTasks.filter(t => t.status === "blocked").length}</strong> blocked</span>
            </div>
          </div>
        )}
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-blue-600" />
            Projects
            <span className="text-sm font-normal text-muted-foreground">({filteredProjects.length})</span>
          </h2>
          <Link href="/projects">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              View All
            </Button>
          </Link>
        </div>
        <div className="space-y-3">
          {filteredProjects.slice(0, 12).map(project => {
            const taskCount = project.task_count ?? 0;
            const completedTasks = project.completed_tasks ?? 0;
            const progress = taskCount > 0 ? (completedTasks / taskCount) * 100 : 0;
            const daysLeft = getDaysRemaining(project.start_date, project.timebox_days);
            const isOverdue = daysLeft < 0;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:bg-gray-50 transition-colors cursor-pointer group">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-3 w-3 rounded-full shrink-0 ${priorityColors[project.priority]}`} />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm group-hover:text-blue-600 transition-colors truncate">
                            {project.title}
                          </h3>
                          <Badge variant="outline" className={typeColors[project.type] ?? "text-gray-700 border-gray-200 bg-gray-50"}>
                            {project.type.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="outline" className={statusColors[project.status]}>
                            {project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 max-w-sm">
                          <Progress value={progress} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{completedTasks}/{taskCount}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {project.status === "completed" ? (
                          <span className="text-xs text-green-600 font-medium">Done</span>
                        ) : isOverdue ? (
                          <span className="text-xs text-red-600 font-medium">{Math.abs(daysLeft)}d overdue</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{daysLeft}d left</span>
                        )}
                      </div>
                      <div className="flex -space-x-2 shrink-0">
                        {project.assignees?.slice(0, 4).map(u => (
                          <div
                            key={u.id}
                            className="h-7 w-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: u.avatar_color }}
                            title={u.name}
                          >
                            {u.name[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {filteredProjects.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No projects match the current filters.</p>
          )}
        </div>
      </div>

      {/* Tasks */}
      {(selectedPerson || statusFilter !== "All") && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">
              Tasks
              <span className="text-sm font-normal text-muted-foreground ml-2">({filteredTasks.length})</span>
            </h2>
          </div>
          <div className="space-y-2">
            {filteredTasks.slice(0, 20).map(task => {
              const project = projectList.find(p => p.id === task.project_id);
              return (
                <Card key={task.id} className="hover:bg-gray-50 transition-colors">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${
                        task.status === "completed" ? "bg-green-500" :
                        task.status === "blocked" ? "bg-red-500" :
                        task.status === "in_progress" ? "bg-blue-500" : "bg-slate-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {project && (
                          <p className="text-xs text-muted-foreground">{project.title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                        <Badge variant="outline" className="text-[10px]">{task.status.replace(/_/g, " ")}</Badge>
                        {task.assignee_name && (
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: task.assignee_color ?? "#3b82f6" }}
                            title={task.assignee_name}
                          >
                            {task.assignee_name[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredTasks.length === 0 && (
              <p className="text-center py-6 text-muted-foreground text-sm">No tasks match the current filters.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
