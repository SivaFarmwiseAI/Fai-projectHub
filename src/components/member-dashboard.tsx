"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { differenceInDays, addDays, format } from "date-fns";
import {
  FolderKanban, CheckCircle2, Clock, TrendingUp, ArrowRight,
  Activity, MessageSquare, AlertTriangle, Target, ListTodo,
  ChevronRight, Zap, Users, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  projects as projectsApi, tasks as tasksApi,
  standup as standupApi, discussions as discussionsApi,
} from "@/lib/api-client";
import type { Project, Task, StandupEntry, Discussion } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  return differenceInDays(addDays(new Date(startDate), timeboxDays), new Date());
}

function nameColor(name: string): string {
  const palette = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

const typeColors: Record<string, string> = {
  engineering: "text-blue-700 border-blue-200 bg-blue-50",
  research: "text-purple-700 border-purple-200 bg-purple-50",
  mixed: "text-teal-700 border-teal-200 bg-teal-50",
  data_science: "text-violet-700 border-violet-200 bg-violet-50",
  design: "text-pink-700 border-pink-200 bg-pink-50",
  product: "text-emerald-700 border-emerald-200 bg-emerald-50",
};

const statusColors: Record<string, string> = {
  active: "text-emerald-700 border-emerald-200 bg-emerald-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  killed: "text-red-700 border-red-200 bg-red-50",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function MemberDashboard() {
  const { user, isLead, isAdmin } = useAuth();
  const hasTeamView = isLead || isAdmin;

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [todayEntries, setTodayEntries] = useState<StandupEntry[]>([]);
  const [openDiscussions, setOpenDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      projectsApi.list().then(r => setProjectList(r.projects)).catch(() => {}),
      tasksApi.list({ assignee_id: user.id }).then(r => setMyTasks(r.tasks)).catch(() => {}),
      standupApi.today().then(r => setTodayEntries(r.entries)).catch(() => {}),
      discussionsApi.list().then(r => setOpenDiscussions(r.discussions.filter(d => !d.is_resolved).slice(0, 4))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Derived data
  const myProjects = projectList.filter(p =>
    p.owner_id === user?.id || p.assignees?.some(a => a.id === user?.id)
  );
  const activeMyProjects  = myProjects.filter(p => p.status === "active");
  const doneMyProjects    = myProjects.filter(p => p.status === "completed");

  const openTasks    = myTasks.filter(t => !["completed", "killed"].includes(t.status));
  const blockedTasks = myTasks.filter(t => t.status === "blocked");

  const projectMap = Object.fromEntries(projectList.map(p => [p.id, p.title]));

  const teamMemberSet = new Set<string>();
  if (hasTeamView) {
    activeMyProjects.forEach(p => p.assignees?.forEach(a => {
      if (a.id !== user?.id) teamMemberSet.add(a.id);
    }));
  }
  const teamMemberCount = teamMemberSet.size;

  const myTodayStandup  = todayEntries.find(e => e.user_id === user?.id);
  const teamStandups    = hasTeamView ? todayEntries.filter(e => e.user_id !== user?.id) : [];

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Zap className="h-3 w-3 text-white" />
          </div>
          <span className="text-label-upper text-blue-500">
            {hasTeamView ? (isAdmin ? "Admin View" : "Team Lead View") : "My Workspace"}
          </span>
        </div>
        <h1 className="text-display text-slate-900">
          Good {getGreeting()}, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1.5 font-medium">
          {hasTeamView
            ? `Managing ${activeMyProjects.length} active project${activeMyProjects.length !== 1 ? "s" : ""} · ${teamMemberCount} team member${teamMemberCount !== 1 ? "s" : ""}`
            : `${openTasks.length} open task${openTasks.length !== 1 ? "s" : ""} across ${activeMyProjects.length} project${activeMyProjects.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: <FolderKanban className="h-5 w-5" />, color: "#3b82f6", bg: "#eff6ff", value: activeMyProjects.length, label: "Active Projects", sub: "In progress" },
          { icon: <ListTodo className="h-5 w-5" />, color: "#8b5cf6", bg: "#f5f3ff", value: openTasks.length, label: "Open Tasks", sub: blockedTasks.length > 0 ? `${blockedTasks.length} blocked` : "On track", alert: blockedTasks.length > 0 },
          { icon: <CheckCircle2 className="h-5 w-5" />, color: "#22c55e", bg: "#f0fdf4", value: doneMyProjects.length, label: "Completed", sub: "Projects shipped" },
          { icon: hasTeamView ? <Users className="h-5 w-5" /> : <Target className="h-5 w-5" />, color: "#f59e0b", bg: "#fffbeb", value: hasTeamView ? teamMemberCount : myTasks.filter(t => t.status === "completed").length, label: hasTeamView ? "Team Members" : "Tasks Done", sub: hasTeamView ? "In your team" : "All time" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border p-4 sm:p-5 shadow-card card-interactive animate-fade-in-up"
            style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center relative"
                style={{ backgroundColor: s.bg, color: s.color }}>
                {s.icon}
                {s.alert && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />}
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 stat-number animate-number-count">{s.value}</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">{s.label}</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.alert ? "#ef4444" : s.color }} />
              <span className="text-[11px] font-medium text-slate-400">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Standup status */}
      <div className="animate-fade-in-up stagger-1">
        {myTodayStandup ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl border" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">Today's standup posted</p>
              <p className="text-xs text-emerald-600 mt-0.5 truncate">{myTodayStandup.today}</p>
            </div>
            <Link href="/standup" className="text-xs font-semibold text-emerald-700 hover:underline shrink-0">View →</Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-2xl border" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">You haven't posted today's standup</p>
              <p className="text-xs text-amber-600 mt-0.5">Keep your team in the loop — takes 2 minutes</p>
            </div>
            <Link
              href="/standup"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)" }}
            >
              <Activity className="h-3 w-3" />
              Post Now
            </Link>
          </div>
        )}
      </div>

      {/* Blocked tasks alert */}
      {blockedTasks.length > 0 && (
        <div className="space-y-2 animate-fade-in-up stagger-2">
          <p className="text-label-upper text-slate-400 px-1">Needs Attention</p>
          {blockedTasks.slice(0, 3).map(task => (
            <Link key={task.id} href={`/projects/${task.project_id}`}>
              <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-all group">
                <div className="h-8 w-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-800 truncate">{task.title}</p>
                  <p className="text-xs text-red-500 mt-0.5">{projectMap[task.project_id] ?? "Unknown project"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-red-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* My Projects */}
      <div className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-section-title text-slate-900">My Projects</h2>
            <p className="text-xs text-slate-400 mt-0.5">{myProjects.length} total</p>
          </div>
          <Link href="/projects" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group">
            All projects <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {myProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <FolderKanban className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-semibold">No projects assigned yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {myProjects.slice(0, 4).map((project, i) => {
              const taskCount = project.task_count ?? 0;
              const completedTasks = project.completed_tasks ?? 0;
              const progress  = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
              const daysLeft  = getDaysRemaining(project.start_date, project.timebox_days);
              const isOverdue = daysLeft < 0 && project.status === "active";

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div
                    className="card-interactive rounded-2xl border bg-white p-4 sm:p-5 shadow-card cursor-pointer group h-full flex flex-col"
                    style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-snug truncate group-hover:text-blue-600 transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 font-medium">{project.objective}</p>
                      </div>
                      {isOverdue && (
                        <span className="text-[9px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] py-0 font-semibold ${typeColors[project.type] ?? "text-gray-700 border-gray-200 bg-gray-50"}`}>
                        {project.type?.replace("_", " ") ?? "project"}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] py-0 font-semibold ${statusColors[project.status]}`}>
                        {project.status}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 mb-3 mt-auto">
                      <div className="flex justify-between text-[11px] font-medium text-slate-400">
                        <span className="truncate max-w-[120px]">{project.current_phase || "Not started"}</span>
                        <span className="font-bold text-slate-600">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 progress-animate"
                          style={{
                            width: `${progress}%`,
                            background: progress >= 80 ? "linear-gradient(90deg,#22c55e,#16a34a)"
                              : progress >= 40 ? "linear-gradient(90deg,#3b82f6,#6366f1)"
                              : "linear-gradient(90deg,#f59e0b,#f97316)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-auto">
                      <Clock className="h-3 w-3" />
                      {project.status === "active"
                        ? isOverdue
                          ? <span className="text-red-500 font-bold">{Math.abs(daysLeft)}d overdue</span>
                          : <span>{daysLeft}d remaining</span>
                        : <span>Completed</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* My Tasks */}
      {openTasks.length > 0 && (
        <div className="animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-section-title text-slate-900">My Tasks</h2>
              <p className="text-xs text-slate-400 mt-0.5">{openTasks.length} open</p>
            </div>
          </div>
          <div className="space-y-2">
            {openTasks.slice(0, 6).map((task, i) => {
              const statusDot: Record<string, string> = {
                in_progress: "#3b82f6", blocked: "#ef4444", planning: "#94a3b8", redefined: "#f59e0b",
              };
              return (
                <Link key={task.id} href={`/projects/${task.project_id}`}>
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-xl border bg-white hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer animate-fade-in-up"
                    style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 40}ms` }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: statusDot[task.status] ?? "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{task.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{projectMap[task.project_id] ?? "Unknown project"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: task.priority === "high" ? "#f59e0b" : task.priority === "low" ? "#94a3b8" : "#3b82f6",
                          background: task.priority === "high" ? "#fffbeb" : task.priority === "low" ? "#f1f5f9" : "#eff6ff",
                        }}
                      >
                        {task.priority}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Team standup feed (Lead/Admin) */}
      {hasTeamView && teamStandups.length > 0 && (
        <div className="animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-section-title text-slate-900">Team Standups Today</h2>
              <p className="text-xs text-slate-400 mt-0.5">{teamStandups.length} update{teamStandups.length !== 1 ? "s" : ""} posted</p>
            </div>
            <Link href="/standup" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group">
              Full feed <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="space-y-3">
            {teamStandups.map((entry, i) => {
              const color = nameColor(entry.name ?? "?");
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl border shadow-card p-4 animate-fade-in-up"
                  style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {(entry.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-900">{entry.name}</span>
                        {entry.department && <span className="text-xs text-slate-400">{entry.department}</span>}
                      </div>
                      {entry.today && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{entry.today}</p>}
                      {entry.blockers && !entry.blockers.toLowerCase().startsWith("none") && (
                        <p className="text-xs text-red-500 mt-1 line-clamp-1">⚠ {entry.blockers}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Discussions */}
      {openDiscussions.length > 0 && (
        <div className="animate-fade-in-up stagger-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-section-title text-slate-900">Active Discussions</h2>
              <p className="text-xs text-slate-400 mt-0.5">{openDiscussions.length} open threads</p>
            </div>
            <Link href="/discussions" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group">
              View all <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="space-y-2">
            {openDiscussions.map((d, i) => (
              <Link key={d.id} href="/discussions">
                <div
                  className="flex items-center gap-3 p-3.5 rounded-xl border bg-white hover:border-purple-200 hover:bg-purple-50/30 transition-all group cursor-pointer animate-fade-in-up"
                  style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 40}ms` }}
                >
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-purple-50">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-purple-600 transition-colors">{d.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {d.author_name ?? "Unknown"}{d.message_count != null ? ` · ${d.message_count} messages` : ""}
                    </p>
                  </div>
                  {d.project_title && (
                    <span className="text-[10px] font-medium text-slate-400 shrink-0 truncate max-w-[80px]">{d.project_title}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
