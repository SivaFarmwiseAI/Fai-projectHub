"use client";

import { useState, useEffect } from "react";
import {
  Printer, CheckCircle2, AlertTriangle, Users,
  Target, TrendingUp, MessageSquare, ArrowRight,
  Sparkles, Flag, Shield, Loader2, Zap,
} from "lucide-react";
import {
  analytics as analyticsApi, standup as standupApi,
  submissions as submissionsApi, discussions as discussionsApi,
} from "@/lib/api-client";
import type {
  DashboardStats, Project, AiInsight, StandupEntry, Submission, Discussion,
} from "@/lib/api-client";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeboxDays);
  return Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function nameColor(name: string): string {
  const palette = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function Section({
  icon: Icon, title, color, children,
}: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50" style={{ background: `${color}08` }}>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PulseBar({ score }: { score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{score}%</span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
      style={{ background: nameColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function BriefingClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [criticalProjects, setCriticalProjects] = useState<Project[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [todayEntries, setTodayEntries] = useState<StandupEntry[]>([]);
  const [yesterdayEntries, setYesterdayEntries] = useState<StandupEntry[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [openDiscussions, setOpenDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    Promise.all([
      analyticsApi.briefing().then(r => {
        setStats(r.stats);
        setCriticalProjects(r.critical_projects);
        setInsights(r.insights);
      }),
      standupApi.today().then(r => setTodayEntries(r.entries)).catch(() => {}),
      standupApi.today(yesterdayStr).then(r => setYesterdayEntries(r.entries)).catch(() => {}),
      submissionsApi.list().then(r => setPendingSubmissions(r.submissions.filter(s => s.status === "pending"))).catch(() => {}),
      discussionsApi.list().then(r => setOpenDiscussions(r.discussions.filter(d => !d.is_resolved))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Derived standup data
  const moodLabel: Record<number, string> = { 4: "Energised", 3: "Positive", 2: "Steady", 1: "Needs support" };
  const moodColor: Record<number, string> = { 4: "#10b981", 3: "#3b82f6", 2: "#f59e0b", 1: "#ef4444" };
  const moodCounts = todayEntries.reduce<Record<number, number>>((acc, e) => {
    if (e.mood) acc[e.mood] = (acc[e.mood] ?? 0) + 1;
    return acc;
  }, {});
  const blockedToday = todayEntries.filter(
    e => e.blockers?.trim() && !e.blockers.toLowerCase().startsWith("none"),
  );

  const yesterdayWins = yesterdayEntries.filter(e => e.yesterday && e.yesterday.length > 10);
  const todayPlans = todayEntries.filter(e => e.today);
  const activeBlockers = blockedToday;

  const todayDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const severityColor: Record<string, string> = {
    critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#94a3b8",
  };

  return (
    <div className="space-y-6 print:space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Executive Briefing</h1>
          </div>
          <p className="text-sm text-slate-500">Daily CEO briefing · {todayDateStr}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all active:scale-95"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">CEO Executive Briefing</h1>
        <p className="text-sm text-gray-500">{todayDateStr} · Confidential</p>
        <hr className="my-4" />
      </div>

      {/* Quick Stats Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Projects",  value: stats.active_projects,  color: "#3b82f6" },
            { label: "Tasks In Progress", value: stats.active_tasks,    color: "#f59e0b" },
            { label: "Pending Reviews",  value: stats.pending_reviews,  color: "#ef4444" },
            { label: "Blocked Tasks",    value: stats.blocked_tasks,    color: "#8b5cf6" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <Section icon={Sparkles} title="AI Insights" color="#6366f1">
          <div className="space-y-3">
            {insights.slice(0, 4).map(ins => (
              <div key={ins.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100">
                <div
                  className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: severityColor[ins.severity] ?? "#94a3b8" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{ins.title}</p>
                  {ins.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ins.description}</p>
                  )}
                  {ins.action_items?.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {ins.action_items.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <ArrowRight className="h-3 w-3 shrink-0 text-indigo-400" />
                          {a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${severityColor[ins.severity] ?? "#94a3b8"}18`, color: severityColor[ins.severity] ?? "#94a3b8" }}
                >
                  {ins.severity}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Team Pulse */}
      {todayEntries.length > 0 && (
        <Section icon={Users} title="Team Pulse — Today" color="#6366f1">
          <div className="space-y-4">
            {Object.keys(moodCounts).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([4, 3, 2, 1] as const).map(m => moodCounts[m] ? (
                  <div key={m} className="text-center p-3 rounded-xl" style={{ background: `${moodColor[m]}10` }}>
                    <p className="text-xl font-bold" style={{ color: moodColor[m] }}>{moodCounts[m]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{moodLabel[m]}</p>
                  </div>
                ) : null)}
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{todayEntries.length}</span> member{todayEntries.length !== 1 ? "s" : ""} submitted
            </div>
            {activeBlockers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">
                  {activeBlockers.length} team member{activeBlockers.length > 1 ? "s are" : " is"} blocked — needs immediate attention
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Yesterday's Wins */}
      {yesterdayWins.length > 0 && (
        <Section icon={CheckCircle2} title="Yesterday's Wins" color="#10b981">
          <div className="space-y-3">
            {yesterdayWins.map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <Avatar name={e.name ?? "?"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-slate-800">{e.name}</p>
                    {e.department && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <p className="text-xs text-slate-400 truncate">{e.department}</p>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{e.yesterday}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Active Blockers */}
      {activeBlockers.length > 0 && (
        <Section icon={AlertTriangle} title="Active Blockers — Needs Your Attention" color="#ef4444">
          <div className="space-y-3">
            {activeBlockers.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <Avatar name={e.name ?? "?"} />
                <div>
                  <p className="text-sm font-semibold text-red-800">{e.name}</p>
                  <p className="text-sm text-red-700 mt-0.5">{e.blockers}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* At-Risk Projects */}
      {criticalProjects.length > 0 && (
        <Section icon={Flag} title="At-Risk Projects" color="#f59e0b">
          <div className="space-y-3">
            {criticalProjects.map(p => {
              const daysLeft = getDaysRemaining(p.start_date, p.timebox_days);
              const taskCount = p.task_count ?? 0;
              const completedTasks = p.completed_tasks ?? 0;
              const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">{p.title}</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {daysLeft <= 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-900">{progress}%</p>
                    <p className="text-xs text-amber-600">complete</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Team Plans for Today */}
      {todayPlans.length > 0 && (
        <Section icon={TrendingUp} title="Team Plans for Today" color="#3b82f6">
          <div className="space-y-3">
            {todayPlans.map((e, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <Avatar name={e.name ?? "?"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-slate-800">{e.name}</p>
                    {e.department && (
                      <p className="text-xs text-slate-400">{e.department}</p>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{e.today}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Open Discussions */}
      {openDiscussions.length > 0 && (
        <Section icon={MessageSquare} title={`Open Discussions (${openDiscussions.length})`} color="#8b5cf6">
          <div className="space-y-3">
            {openDiscussions.slice(0, 4).map(d => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{d.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {d.project_title && (
                      <span className="text-xs text-slate-400">{d.project_title}</span>
                    )}
                    {d.message_count != null && (
                      <span className="text-xs text-slate-400">{d.message_count} messages</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {openDiscussions.length > 4 && (
              <p className="text-xs text-slate-400 pt-1">+ {openDiscussions.length - 4} more open discussions</p>
            )}
          </div>
        </Section>
      )}

      {/* Pending Reviews */}
      {pendingSubmissions.length > 0 && (
        <Section icon={Shield} title={`Pending Reviews (${pendingSubmissions.length})`} color="#ef4444">
          <div className="space-y-2">
            {pendingSubmissions.slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                <p className="text-sm text-slate-700 flex-1 truncate">{s.title}</p>
                {s.submitted_by_name && (
                  <span className="text-xs text-slate-400 shrink-0">{s.submitted_by_name}</span>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </div>
            ))}
            {pendingSubmissions.length > 4 && (
              <p className="text-xs text-slate-400 pt-1">+ {pendingSubmissions.length - 4} more in review queue</p>
            )}
          </div>
        </Section>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-gray-400 mt-8 pt-4 border-t">
        Confidential · ProjectHub CEO Briefing · FarmwiseAI · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
