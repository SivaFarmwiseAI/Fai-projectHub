"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, ClipboardCheck, CheckCircle2, Users,
  AlertTriangle, Clock, TrendingUp, ArrowRight, Zap, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays, addDays } from "date-fns";
import { getActivityFeed } from "@/lib/activity-feed";
import { computeHealthScore } from "@/lib/health-score";

type DashboardProps = {
  projects:       any[];
  users:          any[];
  pendingReviews: any[];
};

function getPhaseProgress(phases: any[]) {
  if (!phases.length) return 0;
  return Math.round(phases.filter((p: any) => p.status === "completed").length / phases.length * 100);
}
function getDaysRemaining(startDate: string, timeboxDays: number) {
  return differenceInDays(addDays(new Date(startDate), timeboxDays), new Date());
}

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: "#64748b", bg: "#f1f5f9", label: "Low" },
  medium:   { color: "#3b82f6", bg: "#eff6ff", label: "Medium" },
  high:     { color: "#f59e0b", bg: "#fffbeb", label: "High" },
  critical: { color: "#ef4444", bg: "#fef2f2", label: "Critical" },
};
const typeColors: Record<string, string> = {
  engineering:"text-blue-700 border-blue-200 bg-blue-50",research:"text-purple-700 border-purple-200 bg-purple-50",
  mixed:"text-teal-700 border-teal-200 bg-teal-50",data_science:"text-violet-700 border-violet-200 bg-violet-50",
  design:"text-pink-700 border-pink-200 bg-pink-50",sales:"text-orange-700 border-orange-200 bg-orange-50",
  marketing:"text-rose-700 border-rose-200 bg-rose-50",operations:"text-slate-700 border-slate-200 bg-slate-50",
  hr:"text-cyan-700 border-cyan-200 bg-cyan-50",legal:"text-gray-700 border-gray-200 bg-gray-50",
  strategy:"text-indigo-700 border-indigo-200 bg-indigo-50",product:"text-emerald-700 border-emerald-200 bg-emerald-50",
  finance:"text-amber-700 border-amber-200 bg-amber-50",
};
const typeLabels: Record<string, string> = {
  engineering:"Engineering",research:"Research/DS",mixed:"Mixed",data_science:"Data Science",
  design:"Design",sales:"Sales",marketing:"Marketing",operations:"Operations",
  hr:"HR",legal:"Legal",strategy:"Strategy",product:"Product",finance:"Finance",
};
const statusColors: Record<string, string> = {
  active:"text-emerald-700 border-emerald-200 bg-emerald-50",
  completed:"text-green-700 border-green-200 bg-green-50",
  killed:"text-red-700 border-red-200 bg-red-50",
};

export function DashboardClient({ projects, users, pendingReviews }: DashboardProps) {
  const activeProjects    = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const overdueProjects   = activeProjects.filter((p) => getDaysRemaining(p.startDate, p.timeboxDays) < 0);
  const completionRate    = projects.length ? Math.round(completedProjects.length / projects.length * 100) : 0;

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshKey, setRefreshKey]  = useState(0);

  useEffect(() => {
    setSecondsAgo(0);
    const ticker = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(ticker);
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const updatedLabel =
    secondsAgo < 5  ? "Just now" :
    secondsAgo < 60 ? `${secondsAgo}s ago` :
    `${Math.floor(secondsAgo / 60)}m ago`;

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Zap className="h-3 w-3 text-white" />
          </div>
          <span className="text-label-upper text-blue-500">Live Overview</span>
          {/* Live ticker */}
          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-slate-400 font-medium tabular-nums">Updated {updatedLabel}</span>
            <button
              onClick={handleRefresh}
              title="Refresh metrics"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
        <h1 className="text-display text-slate-900">Command Center</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1.5 font-medium">
          Real-time snapshot of all projects and team activity
        </p>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<FolderKanban className="h-5 w-5" />}
          iconColor="#3b82f6" iconBg="#eff6ff"
          label="Active Projects" value={activeProjects.length}
          trend={`${activeProjects.length} in progress`} trendPositive delay={0}
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          iconColor="#f59e0b" iconBg="#fffbeb"
          label="Pending Reviews" value={pendingReviews.length}
          trend={pendingReviews.length > 0 ? "Needs attention" : "All clear"}
          trendPositive={pendingReviews.length === 0}
          alert={pendingReviews.length > 0} delay={1}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="#22c55e" iconBg="#f0fdf4"
          label="Completed" value={completedProjects.length}
          trend={`${completionRate}% rate`} trendPositive delay={2}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconColor="#8b5cf6" iconBg="#f5f3ff"
          label="Team Members" value={users.length}
          trend="Across all projects" trendPositive delay={3}
        />
      </div>

      {/* ── Alerts ─────────────────────────────────────────── */}
      {(overdueProjects.length > 0 || pendingReviews.length > 0) && (
        <div className="space-y-2 animate-fade-in-up stagger-2">
          <p className="text-label-upper text-slate-400 px-1">Attention Required</p>
          {overdueProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-all group">
                <div className="h-8 w-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-800 truncate">{p.title}</p>
                  <p className="text-xs text-red-500 mt-0.5">Overdue by {Math.abs(getDaysRemaining(p.startDate, p.timeboxDays))} days</p>
                </div>
                <ArrowRight className="h-4 w-4 text-red-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </Link>
          ))}
          {pendingReviews.length > 0 && (
            <Link href="/reviews">
              <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-all group">
                <div className="h-8 w-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800">
                    {pendingReviews.length} submission{pendingReviews.length !== 1 ? "s" : ""} awaiting review
                  </p>
                  <p className="text-xs text-amber-500 mt-0.5">Go to Review Queue</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Projects Grid ─────────────────────────────────── */}
      <div className="animate-fade-in-up stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-section-title text-slate-900">Projects</h2>
            <p className="text-xs text-slate-400 mt-0.5">{projects.length} total</p>
          </div>
          <Link href="/projects" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group">
            View all <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <FolderKanban className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-semibold">No projects yet</p>
            <Link href="/projects/new" className="mt-3 text-sm text-blue-600 hover:underline font-medium">
              Create your first project →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4">
            {projects.map((project, i) => {
              const progress    = getPhaseProgress(project.phases);
              const daysLeft    = getDaysRemaining(project.startDate, project.timeboxDays);
              const isOverdue   = daysLeft < 0 && project.status === "active";
              const pendingCount = project.submissions.filter((s: any) => s.feedback.length === 0).length;
              const pc          = priorityConfig[project.priority] ?? priorityConfig.medium;
              const health      = computeHealthScore(project as any);

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div
                    className="card-interactive rounded-2xl border bg-white p-4 sm:p-5 shadow-card cursor-pointer group h-full flex flex-col"
                    style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 40}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full"
                            style={{ color: pc.color, backgroundColor: pc.bg }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pc.color }} />
                            {pc.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm sm:text-[15px] text-slate-900 leading-snug truncate group-hover:text-blue-600 transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 font-medium">{project.requirement}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {pendingCount > 0 && (
                          <span className="flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500 text-[10px] font-bold text-white px-1.5">
                            {pendingCount}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[9px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                            OVERDUE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Type + status + health badges */}
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] py-0 font-semibold ${typeColors[project.type] ?? "text-gray-700 border-gray-200 bg-gray-50"}`}>
                        {typeLabels[project.type] ?? project.type}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] py-0 font-semibold ${statusColors[project.status]}`}>
                        {project.status}
                      </Badge>
                      <span className={`text-[10px] py-0 px-1.5 font-bold rounded-full border ${health.bg} ${health.color} ${health.border}`}
                        title={`Health score: ${health.score}/100`}>
                        {health.grade} {health.score}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 mb-3 mt-auto">
                      <div className="flex justify-between text-[11px] font-medium text-slate-400">
                        <span className="truncate max-w-[120px]">{project.currentPhase || "Not started"}</span>
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

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                        <Clock className="h-3 w-3" />
                        {project.status === "active" ? (
                          isOverdue
                            ? <span className="text-red-500 font-bold">{Math.abs(daysLeft)}d overdue</span>
                            : <span>{daysLeft}d remaining</span>
                        ) : (
                          <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                        )}
                      </div>
                      <div className="flex -space-x-1.5">
                        {project.assignees.slice(0, 4).map((a: any) => (
                          <div key={a.user.id}
                            className="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white/50"
                            style={{ backgroundColor: a.user.avatarColor }} title={a.user.name}>
                            {a.user.name[0]}
                          </div>
                        ))}
                        {project.assignees.length > 4 && (
                          <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                            +{project.assignees.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Team Workload ─────────────────────────────────── */}
      <div className="animate-fade-in-up stagger-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-section-title text-slate-900">Team Workload</h2>
            <p className="text-xs text-slate-400 mt-0.5">Active project assignments</p>
          </div>
          <Link href="/team" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group">
            View team <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {users.map((user, i) => {
            const activeCount = user.assignedProjects.filter((ap: any) => ap.project.status === "active").length;
            const workloadPct = Math.min(100, (activeCount / 5) * 100);
            const wColor = workloadPct >= 80 ? "#ef4444" : workloadPct >= 60 ? "#f59e0b" : "#22c55e";
            const wLabel = workloadPct >= 80 ? "High" : workloadPct >= 60 ? "Medium" : "Normal";

            return (
              <Link key={user.id} href={`/team/${user.id}`}>
                <div className="card-interactive rounded-2xl border bg-white p-4 shadow-card cursor-pointer"
                  style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: user.avatarColor }}>
                        {user.name[0]}
                      </div>
                      {activeCount > 0 && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white status-dot-active" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{user.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-extrabold text-slate-900 stat-number">{activeCount}</p>
                      <p className="text-[10px] text-slate-400 font-medium">project{activeCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-slate-400">Workload</span>
                      <span style={{ color: wColor }}>{wLabel}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${workloadPct}%`, backgroundColor: wColor }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Activity Feed ────────────────────────────────── */}
      <ActivityFeed />

      {/* ── Portfolio Health ──────────────────────────────── */}
      {completedProjects.length > 0 && (
        <div className="animate-fade-in-up stagger-5 rounded-2xl p-4 sm:p-6 border"
          style={{ background: "linear-gradient(135deg,#f0f9ff 0%,#f5f3ff 100%)", borderColor: "rgba(59,130,246,0.12)" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="font-bold text-slate-700">Portfolio Health</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
            {[
              { value: `${completionRate}%`, label: "Completion rate", cls: "gradient-text" },
              { value: completedProjects.length, label: "Shipped",        cls: "text-emerald-600" },
              { value: overdueProjects.length,   label: "Overdue",        cls: "text-red-500" },
            ].map(({ value, label, cls }) => (
              <div key={label}>
                <p className={`text-2xl sm:text-3xl font-extrabold stat-number animate-number-count ${cls}`}>{value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Activity Feed ──────────────────────────────────────────── */
function ActivityFeed() {
  const [showAll, setShowAll] = useState(false);
  const events = getActivityFeed(20);
  const visible = showAll ? events : events.slice(0, 6);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-section-title text-slate-900">Recent Activity</h2>
          <p className="text-xs text-slate-400 mt-0.5">Latest actions across all projects</p>
        </div>
        {events.length > 6 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            {showAll ? "Show less" : `See all ${events.length}`}
            <ArrowRight className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl border shadow-card overflow-hidden" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        {visible.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm font-medium">
            No recent activity
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {visible.map((event, i) => (
              <div key={event.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors">
                <span className="text-base shrink-0 w-7 text-center">{event.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
                  <p className="text-xs text-slate-400 font-medium truncate">{event.subtitle}</p>
                </div>
                {event.userColor && (
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: event.userColor }}
                    title={event.userName}
                  >
                    {event.userName?.[0]}
                  </div>
                )}
                <span className="text-[11px] text-slate-400 font-medium shrink-0 min-w-[60px] text-right">
                  {event.relativeTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({ icon, iconColor, iconBg, label, value, trend, trendPositive, alert, delay }: {
  icon: React.ReactNode; iconColor: string; iconBg: string;
  label: string; value: number; trend: string; trendPositive?: boolean; alert?: boolean; delay: number;
}) {
  return (
    <div className="bg-white rounded-2xl border p-4 sm:p-5 shadow-card card-interactive animate-fade-in-up"
      style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${delay * 70}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center relative"
          style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
          {alert && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-white animate-pulse" />}
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 stat-number animate-number-count">{value}</p>
      <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">{label}</p>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: trendPositive ? "#22c55e" : "#ef4444" }} />
        <span className="text-[11px] font-medium text-slate-400">{trend}</span>
      </div>
    </div>
  );
}
