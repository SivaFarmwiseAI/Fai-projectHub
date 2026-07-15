"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart3, TrendingUp, Users, Zap, CheckCircle2,
  AlertTriangle, Clock, Printer, Target, Activity, Download,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import {
  analytics as analyticsApi, projects as projectsApi,
} from "@/lib/api-client";
import { BrandLoader } from "@/components/brand-loader";
import type {
  DashboardStats, TeamHealthRow, VelocityRow, WorkloadRow, Project,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { ShieldCheck, Filter } from "lucide-react";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeboxDays);
  return Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function KPICard({
  label, value, sub, icon: Icon, color, trend, trendDir,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
  trend?: string; trendDir?: "up" | "down" | "flat";
}) {
  const TrendIcon = trendDir === "up" ? ArrowUp : trendDir === "down" ? ArrowDown : Minus;
  const trendColor = trendDir === "up" ? "#10b981" : trendDir === "down" ? "#ef4444" : "#94a3b8";
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: trendColor }}>
            <TrendIcon className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const truncateText = (text: string, maxLength: number = 10) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength - 2) + ".." : text;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function AnalyticsClient() {
  const { isCEO, isAdmin } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamHealth, setTeamHealth] = useState<TeamHealthRow[]>([]);
  const [velocity, setVelocity] = useState<VelocityRow[]>([]);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Legend toggling states
  const [hiddenStatus, setHiddenStatus] = useState<Record<string, boolean>>({});
  const [hiddenWorkload, setHiddenWorkload] = useState<Record<string, boolean>>({});
  const [hiddenVelocity, setHiddenVelocity] = useState<Record<string, boolean>>({});
  const [hiddenHealth, setHiddenHealth] = useState<Record<string, boolean>>({});

  const toggleStatus = (name: string) => {
    setHiddenStatus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleWorkloadLegendClick = (o: any) => {
    const { dataKey } = o;
    if (dataKey) {
      setHiddenWorkload(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    }
  };

  const handleVelocityLegendClick = (o: any) => {
    const { dataKey } = o;
    if (dataKey) {
      setHiddenVelocity(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    }
  };

  const handleHealthLegendClick = (o: any) => {
    const { dataKey } = o;
    if (dataKey) {
      setHiddenHealth(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    }
  };

  const renderLegendText = (value: string) => (
    <span className="inline-block max-w-[90px] md:max-w-[150px] truncate align-middle text-slate-600 font-medium select-none" title={value}>
      {value}
    </span>
  );

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard().then(r => setStats(r.stats)),
      analyticsApi.teamHealth().then(r => setTeamHealth(r.team_health)),
      analyticsApi.velocity(28).then(r => setVelocity(r.velocity)),
      analyticsApi.workload().then(r => setWorkload(r.workload)),
      projectsApi.list({ limit: 100 }).then(r => setProjectList(r.projects)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <BrandLoader label="Loading analytics…" />;
  }

  // Derived chart data
  const statusData = [
    { name: "Active", value: stats?.active_projects ?? 0, color: "#3b82f6" },
    { name: "Completed", value: stats?.completed_projects ?? 0, color: "#10b981" },
    { name: "Killed", value: stats?.killed_projects ?? 0, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const visibleStatusData = statusData.map(d => ({
    ...d,
    value: hiddenStatus[d.name] ? 0 : d.value
  })).filter(d => d.value > 0);

  const workloadData = workload.map(w => ({
    name: w.name.split(" ")[0],
    active: w.in_progress,
    planning: w.planning,
    blocked: w.blocked,
  }));

  const velocityData = velocity.map(v => ({
    week: v.week,
    completed: v.completed,
    hours: v.hours_logged,
  }));

  const healthData = teamHealth.map(h => ({
    name: h.name.split(" ")[0],
    score: Math.round(h.health_score),
    mood: Math.round(h.avg_mood * 20),
  }));

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 print:hidden bg-white/50 backdrop-blur-md p-6 -mx-6 -mt-6 border-b border-slate-100 mb-6 sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-none">Analytics</h1>
              <p className="text-sm text-slate-500 mt-1.5">Organisation-wide performance & team health</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
        >
          <Download className="h-4 w-4" />
          Export Report
        </button>
      </div>

      <div className="px-6 space-y-8 pb-10">

        {/* KPI Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard label="Active Projects" value={stats.active_projects} sub={`of ${stats.active_projects + stats.completed_projects} total`} icon={Target} color="#3b82f6" />
            <KPICard label="Active Tasks" value={stats.active_tasks} sub={`${stats.blocked_tasks} blocked`} icon={Activity} color="#f59e0b" />
            <KPICard label="Completed" value={stats.completed_projects} sub="projects done" icon={CheckCircle2} color="#10b981" />
            <KPICard label="Blocked Tasks" value={stats.blocked_tasks} sub="needs attention" icon={AlertTriangle} color="#ef4444" />
            <KPICard label="Pending Reviews" value={stats.pending_reviews} sub="submissions" icon={Clock} color="#6366f1" />
            <KPICard label="Team Size" value={stats.team_size} sub="members" icon={Users} color="#ec4899" />
          </div>
        )}

        {/* Row 1: Status + Workload */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Status Donut */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader title="Project Status Breakdown" sub="Current distribution across all projects" />
            {statusData.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="flex-1 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={visibleStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80} paddingAngle={3}>
                        {visibleStatusData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2.5">
                  {statusData.map(s => {
                    const isHidden = hiddenStatus[s.name];
                    return (
                      <div
                        key={s.name}
                        onClick={() => toggleStatus(s.name)}
                        className={`flex items-center gap-2.5 cursor-pointer select-none transition-all hover:opacity-85 ${
                          isHidden ? "opacity-35 line-through decoration-slate-400" : ""
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-sm text-slate-600 truncate max-w-[100px]" title={s.name}>{s.name}</span>
                        <span className="text-sm font-bold text-slate-900 ml-auto pl-3">{s.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No project data</div>
            )}
          </div>

          {/* Team Workload */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader title="Team Workload Distribution" sub="Tasks per team member" />
            {workloadData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData} margin={{ left: -10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => truncateText(val, 10)} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend onClick={handleWorkloadLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: "pointer" }} />
                    <Bar dataKey="active" name="In Progress" stackId="a" fill="#3b82f6" hide={hiddenWorkload.active} />
                    <Bar dataKey="planning" name="Planning" stackId="a" fill="#94a3b8" hide={hiddenWorkload.planning} />
                    <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} hide={hiddenWorkload.blocked} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No workload data</div>
            )}
          </div>
        </div>

        {/* Row 2: Velocity + Team Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Velocity */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader title="Delivery Velocity" sub="Tasks completed per week" />
            {velocityData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={velocityData} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(val) => truncateText(val, 10)} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend onClick={handleVelocityLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: "pointer" }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} hide={hiddenVelocity.completed} />
                    <Line type="monotone" dataKey="hours" name="Hours" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b" }} strokeDasharray="6 3" hide={hiddenVelocity.hours} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No velocity data</div>
            )}
          </div>

          {/* Team Health */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader title="Team Health Scores" sub="Health score and avg mood per member" />
            {healthData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthData} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => truncateText(val, 10)} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend onClick={handleHealthLegendClick} formatter={renderLegendText} wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: "pointer" }} />
                    <Bar dataKey="score" name="Health Score" fill="#10b981" radius={[4, 4, 0, 0]} hide={hiddenHealth.score} />
                    <Bar dataKey="mood" name="Mood (×20)" fill="#6366f1" radius={[4, 4, 0, 0]} hide={hiddenHealth.mood} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No health data</div>
            )}
          </div>
        </div>

        {/* Project Health Scorecard */}
        {projectList.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <SectionHeader title="Project Health Scorecard" sub="Live progress per project" />
            <div className="space-y-3">
              {projectList.filter(p => p.status === "active").slice(0, 15).map(p => {
                const taskCount = p.task_count ?? 0;
                const completedTasks = p.completed_tasks ?? 0;
                const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
                const daysLeft = getDaysRemaining(p.start_date, p.timebox_days);
                const isOverdue = daysLeft < 0;
                const healthColor = isOverdue ? "#ef4444" : daysLeft <= 3 ? "#f59e0b" : "#10b981";
                return (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: healthColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-blue-50 text-blue-700">
                          {p.status}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: healthColor }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <span className="font-bold text-slate-800 w-8 text-right">{progress}%</span>
                      <span className={`font-medium w-16 text-right ${isOverdue ? "text-red-500" : "text-slate-500"}`}>
                        {isOverdue ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="hidden print:block text-center text-xs text-gray-400 mt-8 pt-4 border-t">
          ProjectHub Analytics · Confidential · FarmwiseAI
        </div>
      </div>
    </div>
  );
}
