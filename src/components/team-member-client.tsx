"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Clock,
  FileText,
  Code,
  Layout,
  BookOpen,
  Monitor,
  ArrowLeft,
  FolderKanban,
  Mail,
  Sparkles,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

const submissionTypeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  document:     { icon: <FileText className="h-4 w-4" />,  color: "#3b82f6", bg: "#eff6ff" },
  code:         { icon: <Code className="h-4 w-4" />,      color: "#8b5cf6", bg: "#f5f3ff" },
  architecture: { icon: <Layout className="h-4 w-4" />,    color: "#06b6d4", bg: "#ecfeff" },
  notebook:     { icon: <BookOpen className="h-4 w-4" />,  color: "#f59e0b", bg: "#fffbeb" },
  demo:         { icon: <Monitor className="h-4 w-4" />,   color: "#22c55e", bg: "#f0fdf4" },
};

const statusColors: Record<string, string> = {
  active:    "text-emerald-700 border-emerald-200 bg-emerald-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  killed:    "text-red-700 border-red-200 bg-red-50",
};

export function TeamMemberClient({ user }: { user: any }) {
  const activeProjects   = user.assignedProjects.filter((ap: any) => ap.project.status === "active");
  const totalSubmissions = user.submissions.length;
  const reviewedCount    = user.submissions.filter((s: any) => s.feedback.length > 0).length;
  const reviewedPct      = totalSubmissions > 0 ? Math.round((reviewedCount / totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* ── Back link ──────────────────────────────────────── */}
      <Link
        href="/team"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors animate-fade-in-up"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Team
      </Link>

      {/* ── Profile Header ─────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl border shadow-card overflow-hidden animate-fade-in-up stagger-1"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        {/* Banner */}
        <div
          className="h-24 w-full"
          style={{
            background: `linear-gradient(135deg, ${user.avatarColor}33 0%, ${user.avatarColor}11 100%)`,
          }}
        />

        <div className="px-4 sm:px-6 pb-5 sm:pb-6">
          <div className="flex items-end gap-4 sm:gap-5 -mt-10 mb-5">
            <div
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-white shadow-lg ring-4 ring-white shrink-0"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.name[0]}
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight tracking-tight">{user.name}</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">{user.role}</p>
              <a
                href={`mailto:${user.email}`}
                className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1.5 mt-1 transition-colors"
              >
                <Mail className="h-3 w-3" />
                {user.email}
              </a>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <QuickStat
              icon={<FolderKanban className="h-4 w-4" />}
              value={activeProjects.length}
              label="Active Projects"
              color="#3b82f6"
              bg="#eff6ff"
            />
            <QuickStat
              icon={<FileText className="h-4 w-4" />}
              value={totalSubmissions}
              label="Submissions"
              color="#8b5cf6"
              bg="#f5f3ff"
            />
            <QuickStat
              icon={<TrendingUp className="h-4 w-4" />}
              value={`${reviewedPct}%`}
              label="Review rate"
              color="#22c55e"
              bg="#f0fdf4"
            />
          </div>
        </div>
      </div>

      {/* ── Active Projects ─────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl border shadow-card animate-fade-in-up stagger-2"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <FolderKanban className="h-4 w-4 text-blue-500" />
          <h2 className="font-bold text-gray-900">Active Projects</h2>
          <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {activeProjects.length}
          </span>
        </div>

        <div className="p-4 space-y-2">
          {activeProjects.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active projects</p>
          ) : (
            activeProjects.map((ap: any) => {
              const project = ap.project;
              const completedPhases = project.phases.filter((p: any) => p.status === "completed").length;
              const progress = project.phases.length
                ? Math.round((completedPhases / project.phases.length) * 100)
                : 0;

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-blue-50/50 transition-colors group border border-transparent hover:border-blue-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {project.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {project.currentPhase || "Not started"}
                      </p>
                    </div>

                    <div className="w-28 shrink-0">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-gray-600">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            background: progress >= 80
                              ? "linear-gradient(90deg, #22c55e, #16a34a)"
                              : "linear-gradient(90deg, #3b82f6, #6366f1)",
                          }}
                        />
                      </div>
                    </div>

                    <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] shrink-0`}>
                      {project.status}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Submissions & Feedback ──────────────────────────── */}
      <div
        className="bg-white rounded-2xl border shadow-card animate-fade-in-up stagger-3"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <FileText className="h-4 w-4 text-purple-500" />
          <h2 className="font-bold text-gray-900">Submissions & Feedback</h2>
          <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {user.submissions.length}
          </span>
        </div>

        <div className="p-4 space-y-4">
          {user.submissions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No submissions yet</p>
          ) : (
            user.submissions.map((sub: any, index: number) => {
              const typeConf = submissionTypeConfig[sub.type] ?? submissionTypeConfig.document;
              return (
                <div key={sub.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="space-y-3">
                    {/* Submission row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
                        >
                          {typeConf.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900 truncate">{sub.title}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0"
                              style={{ color: typeConf.color, borderColor: `${typeConf.color}40`, backgroundColor: typeConf.bg }}
                            >
                              {sub.type}
                            </Badge>
                            {sub.feedback.length > 0 ? (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                            <Link href={`/projects/${sub.project.id}`} className="text-blue-500 hover:underline">
                              {sub.project.title}
                            </Link>
                            <span>·</span>
                            <span>{sub.phase.phaseName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                        <Clock className="h-3 w-3" />
                        {format(new Date(sub.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 leading-relaxed ml-11">{sub.description}</p>

                    {/* Feedback thread */}
                    {sub.feedback.length > 0 && (
                      <div className="ml-11 space-y-2">
                        {sub.feedback.map((fb: any) => (
                          <div
                            key={fb.id}
                            className="flex gap-3 p-3 rounded-xl"
                            style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}
                          >
                            <div
                              className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                              style={{ backgroundColor: fb.fromUser.avatarColor ?? "#3b82f6" }}
                            >
                              {fb.fromUser.name[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-gray-700">{fb.fromUser.name}</span>
                                {fb.isAi && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                                    <Sparkles className="h-2.5 w-2.5" /> AI
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {format(new Date(fb.createdAt), "MMM d")}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{fb.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  value,
  label,
  color,
  bg,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 py-4 rounded-xl text-center"
      style={{ backgroundColor: bg }}
    >
      <span style={{ color }}>{icon}</span>
      <p className="text-2xl font-bold text-gray-900 stat-number">{value}</p>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
