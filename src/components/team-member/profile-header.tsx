"use client";

/** Ultra-compact single-row header for the team member view. One line gives
 *  the CEO/TL: identity (with employee no + joining date/tenure), the
 *  data-derived performance index, health chips and headline counts. */

import { differenceInMonths, format } from "date-fns";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListChecks,
  Mail,
} from "lucide-react";
import type { User } from "@/lib/api-client";
import type { HoursAnalysis, PerformanceProfile } from "./derive";

function tenureLabel(dateOfJoining: string): string {
  const months = differenceInMonths(new Date(), new Date(dateOfJoining));
  if (months < 1) return "new joiner";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}

function MiniStat({
  icon,
  value,
  label,
  color,
  bg,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
        style={{ color, backgroundColor: bg }}
      >
        {icon}
      </span>
      <span className="leading-none">
        <span className="stat-number block text-sm font-extrabold text-slate-900">{value}</span>
        <span className="block text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">{label}</span>
      </span>
    </div>
  );
}

function healthChip(pct: number) {
  if (pct >= 70) return "text-green-700 border-green-200 bg-green-50";
  if (pct >= 40) return "text-amber-700 border-amber-200 bg-amber-50";
  return "text-red-700 border-red-200 bg-red-50";
}

export function ProfileHeader({
  user,
  activeProjects,
  totalTasks,
  completedTasks,
  inProgressTasks,
  profile,
  analysis,
}: {
  user: User;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  profile: PerformanceProfile;
  analysis: HoursAnalysis;
}) {
  const utilizationCls =
    analysis.variance > 0
      ? "text-red-700 border-red-200 bg-red-50"
      : "text-green-700 border-green-200 bg-green-50";

  return (
    <div
      className="bg-white rounded-2xl border shadow-card overflow-hidden animate-fade-in-up"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      {/* Slim identity accent */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, ${user.avatar_color} 0%, ${user.avatar_color}66 60%, ${user.avatar_color}22 100%)`,
        }}
      />

      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {/* Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-lg font-extrabold text-white shadow-sm shrink-0"
            style={{ backgroundColor: user.avatar_color }}
          >
            {user.name[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight tracking-tight truncate">
                {user.name}
              </h1>
              <span className="text-xs text-slate-500 font-medium truncate">{user.role}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5 text-[11px] text-gray-400">
              <a
                href={`mailto:${user.email}`}
                className="hover:text-blue-500 flex items-center gap-1 transition-colors truncate"
              >
                <Mail className="h-3 w-3 shrink-0" />
                {user.email}
              </a>
              {user.employee_no && (
                <span className="flex items-center gap-1 text-slate-500 font-medium">
                  <BadgeCheck className="h-3 w-3 text-indigo-400" />
                  {user.employee_no}
                </span>
              )}
              {user.date_of_joining && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 font-semibold text-indigo-600"
                  title={`Date of joining: ${format(new Date(user.date_of_joining), "MMMM d, yyyy")}`}
                >
                  <CalendarDays className="h-3 w-3" />
                  Joined {format(new Date(user.date_of_joining), "MMM d, yyyy")} ·{" "}
                  {tenureLabel(user.date_of_joining)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Health chips + headline counts */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {profile.adherenceTotal > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthChip(profile.onTimePercent)}`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {profile.onTimePercent}% on time
            </span>
          )}
          {analysis.totalPlanned > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${utilizationCls}`}
            >
              <Clock className="h-3 w-3" />
              {analysis.utilization}% utilization
            </span>
          )}
          <MiniStat
            icon={<FolderKanban className="h-3 w-3" />}
            value={activeProjects}
            label="Projects"
            color="#3b82f6"
            bg="#eff6ff"
          />
          <MiniStat
            icon={<ListChecks className="h-3 w-3" />}
            value={totalTasks}
            label="Tasks"
            color="#6366f1"
            bg="#eef2ff"
          />
          <MiniStat
            icon={<CheckCircle2 className="h-3 w-3" />}
            value={completedTasks}
            label="Done"
            color="#16a34a"
            bg="#f0fdf4"
          />
          <MiniStat
            icon={<Clock className="h-3 w-3" />}
            value={inProgressTasks}
            label="Active"
            color="#d97706"
            bg="#fffbeb"
          />
        </div>
      </div>
    </div>
  );
}
