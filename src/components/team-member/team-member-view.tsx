"use client";

/** Tab shell for the team member detail view — persistent profile header,
 *  segmented tab bar (deep-linkable via ?tab=), role-gated Appraisal tab. */

import React from "react";
import {
  Award,
  FileSearch,
  History,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import type { Project, Task } from "@/lib/api-client";
import { AppraisalTab } from "./appraisal-tab";
import {
  buildTimelineItems,
  computeDailyActivity,
  computeEmployeeRating,
  computeEvidenceRows,
  computeHoursAnalysis,
  computeOutcomeSummary,
  computePerformanceProfile,
  type TeamMemberData,
} from "./derive";
import { EvidenceTab } from "./evidence-tab";
import { HistoryTab } from "./history-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileHeader } from "./profile-header";
import { TasksTab } from "./tasks-tab";

type TabId = "overview" | "tasks" | "evidence" | "appraisal" | "history";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; gated?: boolean }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks & Outcomes", icon: ListChecks },
  { id: "evidence", label: "Evidence & Timeline", icon: FileSearch },
  { id: "appraisal", label: "Appraisal", icon: Award, gated: true },
  { id: "history", label: "History", icon: History },
];

function initialTab(canAppraise: boolean): TabId {
  if (typeof window === "undefined") return "overview";
  const t = new URLSearchParams(window.location.search).get("tab") as TabId | null;
  if (t && TABS.some((x) => x.id === t)) {
    // A gated deep link falls back to Overview for viewers without access.
    if (t === "appraisal" && !canAppraise) return "overview";
    return t;
  }
  return "overview";
}

export function TeamMemberView({ data }: { data: TeamMemberData }) {
  const { user: authUser, isLead, hasFullPerformanceAccess } = useAuth();
  const { user, projects, projectById, tasks, leaves } = data;

  // CEO/Admin/HR/Leadership see every appraisal; a Team Lead only their
  // direct reports. Client gate is UX — the report endpoint enforces access.
  const canAppraise =
    hasFullPerformanceAccess ||
    (isLead && user.manager_id != null && user.manager_id === authUser?.id);

  const [tab, setTab] = React.useState<TabId>(() => initialTab(canAppraise));

  const selectTab = (t: TabId) => {
    setTab(t);
    // Keep the URL shareable without triggering a navigation.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // history API unavailable — tab still switches.
    }
  };

  // Derive everything once; tabs receive plain props.
  const analysis = React.useMemo(() => computeHoursAnalysis(tasks, projectById), [tasks, projectById]);
  const profile = React.useMemo(
    () => computePerformanceProfile(tasks, projects, leaves, projectById),
    [tasks, projects, leaves, projectById],
  );
  const daily = React.useMemo(() => computeDailyActivity(tasks, projectById), [tasks, projectById]);
  const timelineItems = React.useMemo(() => buildTimelineItems(tasks, projectById), [tasks, projectById]);
  const outcomes = React.useMemo(
    () => computeOutcomeSummary(tasks, projectById, timelineItems),
    [tasks, projectById, timelineItems],
  );
  const evidenceRows = React.useMemo(() => computeEvidenceRows(tasks, projectById), [tasks, projectById]);
  const rating = React.useMemo(
    () => computeEmployeeRating(outcomes, analysis),
    [outcomes, analysis],
  );

  const tasksByProject = React.useMemo(() => {
    return tasks.reduce<Record<string, { project: Project; tasks: Task[] }>>((acc, task) => {
      const project = projectById[task.project_id];
      if (!project) return acc;
      if (!acc[project.id]) acc[project.id] = { project, tasks: [] };
      acc[project.id].tasks.push(task);
      return acc;
    }, {});
  }, [tasks, projectById]);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "planning",
  ).length;

  const visibleTabs = TABS.filter((t) => !t.gated || canAppraise);

  return (
    <div className="space-y-4">
      <ProfileHeader
        user={user}
        activeProjects={activeProjects}
        totalTasks={tasks.length}
        completedTasks={completedTasks}
        inProgressTasks={inProgressTasks}
        profile={profile}
        analysis={analysis}
      />

      {/* Tab bar */}
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.id === "tasks" && tasks.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-500",
                )}>
                  {tasks.length}
                </span>
              )}
              {t.id === "evidence" && evidenceRows.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-500",
                )}>
                  {evidenceRows.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — rendered conditionally so self-fetching children
          (WorkHistory, AiProductivityPanel, LeaveAnalytics, report modal)
          only fetch when their tab is opened. */}
      <div className="animate-fade-in-up">
        {tab === "overview" && (
          <OverviewTab
            analysis={analysis}
            daily={daily}
            outcomes={outcomes}
            tasks={tasks}
            completedTasks={completedTasks}
            totalTasks={tasks.length}
            onOpenOutcomes={() => selectTab(canAppraise ? "appraisal" : "tasks")}
          />
        )}
        {tab === "tasks" && <TasksTab user={user} tasksByProject={tasksByProject} />}
        {tab === "evidence" && (
          <EvidenceTab timelineItems={timelineItems} evidenceRows={evidenceRows} />
        )}
        {tab === "appraisal" && canAppraise && (
          <AppraisalTab
            user={user}
            outcomes={outcomes}
            profile={profile}
            analysis={analysis}
            timelineItems={timelineItems}
            rating={rating}
          />
        )}
        {tab === "history" && (
          <HistoryTab user={user} tasks={tasks} leaves={leaves} projectById={projectById} />
        )}
      </div>
    </div>
  );
}
