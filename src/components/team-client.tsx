"use client";

import Link from "next/link";
import { FolderKanban, FileText, MessageSquare, ArrowRight, Users, Mail } from "lucide-react";

export function TeamClient({ users }: { users: any[] }) {
  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <h1 className="text-display text-slate-900">Team</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          {users.length} member{users.length !== 1 ? "s" : ""} across all projects
        </p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 animate-fade-in-up">
          <Users className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No team members yet</p>
          <p className="text-sm text-slate-400 mt-1">Seed the database to add members</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {users.map((user, i) => {
            const activeProjects   = user.assignedProjects.filter((ap: any) => ap.project.status === "active").length;
            const totalSubmissions = user.submissions.length;
            const feedbackReceived = user.submissions.reduce((sum: number, s: any) => sum + s.feedback.length, 0);
            const workloadPct      = Math.min(100, (activeProjects / 5) * 100);
            const wColor = workloadPct >= 80 ? "#ef4444" : workloadPct >= 60 ? "#f59e0b" : "#22c55e";
            const wLabel = workloadPct >= 80 ? "High" : workloadPct >= 60 ? "Medium" : "Normal";

            return (
              <Link key={user.id} href={`/team/${user.id}`}>
                <div
                  className="bg-white rounded-2xl border shadow-card card-interactive cursor-pointer group overflow-hidden h-full animate-fade-in-up"
                  style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${i * 55}ms` }}
                >
                  {/* colour band */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: user.avatarColor, opacity: 0.7 }} />

                  <div className="p-4 sm:p-5">
                    {/* User row */}
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="relative shrink-0">
                        <div
                          className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-extrabold text-white shadow-sm"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.name[0]}
                        </div>
                        {activeProjects > 0 && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white status-dot-active" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors text-[15px] truncate">
                          {user.name}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">{user.role}</p>
                        <a href={`mailto:${user.email}`} onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-medium text-slate-400 hover:text-blue-500 flex items-center gap-1 mt-1 w-fit transition-colors">
                          <Mail className="h-3 w-3" />{user.email}
                        </a>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </div>

                    {/* Workload */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className="text-slate-400 uppercase tracking-wide">Workload</span>
                        <span style={{ color: wColor }}>{wLabel}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${workloadPct}%`, backgroundColor: wColor }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: <FolderKanban className="h-3.5 w-3.5" />, val: activeProjects, label: "Active",    color: "#3b82f6", bg: "#eff6ff" },
                        { icon: <FileText     className="h-3.5 w-3.5" />, val: totalSubmissions, label: "Submitted", color: "#8b5cf6", bg: "#f5f3ff" },
                        { icon: <MessageSquare className="h-3.5 w-3.5" />, val: feedbackReceived, label: "Feedback",  color: "#22c55e", bg: "#f0fdf4" },
                      ].map(({ icon, val, label, color, bg }) => (
                        <div key={label} className="flex flex-col items-center gap-1 py-2.5 rounded-xl" style={{ backgroundColor: bg }}>
                          <span style={{ color }}>{icon}</span>
                          <p className="text-base font-extrabold text-slate-900 stat-number">{val}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
