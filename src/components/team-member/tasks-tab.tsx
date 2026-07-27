"use client";

/** Tasks & Outcomes tab — every task grouped by project, with a status filter
 *  bar, collapsible project groups and expandable milestone rows. */

import React from "react";
import Link from "next/link";
import {
  ChevronDown,
  FolderKanban,
  ListChecks,
  Milestone,
  Paperclip,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Project, Task, User } from "@/lib/api-client";
import { MilestoneRow } from "./milestone-row";
import { fmtHrs, taskStatusColors, taskStatusIcons } from "./shared";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "planning", label: "Planning" },
  { id: "completed", label: "Completed" },
  { id: "blocked", label: "Blocked" },
] as const;

export function TasksTab({
  user,
  tasksByProject,
}: {
  user: User;
  tasksByProject: Record<string, { project: Project; tasks: Task[] }>;
}) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    // Completed projects start collapsed to keep the tab short.
    const init: Record<string, boolean> = {};
    for (const { project } of Object.values(tasksByProject)) {
      if (project.status !== "active") init[project.id] = true;
    }
    return init;
  });

  const groups = Object.values(tasksByProject)
    .filter(({ project }) => projectFilter === "all" || project.id === projectFilter)
    .map(({ project, tasks }) => ({
      project,
      tasks: tasks.filter((t) => statusFilter === "all" || t.status === statusFilter),
    }))
    .filter((g) => g.tasks.length > 0);

  if (Object.keys(tasksByProject).length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
        <ListChecks className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-500">No tasks assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === f.id
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {Object.keys(tasksByProject).length > 1 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
          >
            <option value="all">All projects</option>
            {Object.values(tasksByProject).map(({ project }) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-muted-foreground">
          No tasks match this filter
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ project, tasks }) => {
            const isCollapsed = collapsed[project.id] ?? false;
            return (
              <Card key={project.id}>
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/projects/${project.id}`} className="hover:underline min-w-0">
                      <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.title}</span>
                      </CardTitle>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={project.status === "active" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-700 border-slate-200 bg-slate-50"}>
                        {project.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [project.id]: !isCollapsed }))}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <TaskGroupRow key={task.id} task={task} project={project} user={user} />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskGroupRow({ task, project, user }: { task: Task; project: Project; user: User }) {
  const taskSteps = task.steps ?? [];
  const completedSteps = taskSteps.filter((s) => s.status === "completed").length;
  const totalSteps = taskSteps.length;
  const taskMilestones = [...(task.milestones ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const msDone = taskMilestones.filter((m) => m.status === "completed").length;
  const totalMs = taskMilestones.length;
  // Prefer milestone completion for the progress readout when the task is
  // milestone-driven; fall back to steps otherwise.
  const progressPct = totalMs > 0
    ? Math.round((msDone / totalMs) * 100)
    : totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;
  const myMilestones = taskMilestones.filter((m) => m.assignee_id === user.id).length;
  const attachmentCount = taskMilestones.reduce(
    (n, m) =>
      n +
      (m.deliverables?.length ?? 0) +
      (m.attachments?.filter((a) => a.url).length ?? 0),
    0,
  );
  const estHrs = task.actual_hours ?? 0;
  const plannedHrs = task.revised_estimate_hours ?? task.estimated_hours ?? 0;

  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-3">
      {/* Task header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Link
            href={`/projects/${project.id}?tab=tasks&task=${task.id}`}
            className="font-medium text-sm text-slate-800 hover:text-blue-600 hover:underline"
          >
            {task.title}
          </Link>
          <Badge variant="outline" className={taskStatusColors[task.status] || ""}>
            <span className="mr-1">{taskStatusIcons[task.status]}</span>
            {task.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <Badge variant="outline" className={
          task.priority === "high" ? "text-red-700 border-red-200 bg-red-50" :
          task.priority === "medium" ? "text-amber-700 border-amber-200 bg-amber-50" :
          "text-slate-700 border-slate-200 bg-slate-50"
        }>
          {task.priority}
        </Badge>
      </div>

      {/* Meta chips: milestones allotted · attachments · hours */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {totalMs > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 font-medium">
            <Milestone className="h-3 w-3" /> {msDone}/{totalMs} milestones
          </span>
        )}
        {myMilestones > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 border border-indigo-200 text-indigo-800 px-2 py-0.5 font-semibold">
            {myMilestones} allotted to {user.name.split(" ")[0]}
          </span>
        )}
        {totalSteps > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 font-medium">
            <ListChecks className="h-3 w-3" /> {completedSteps}/{totalSteps} steps
          </span>
        )}
        {attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 font-medium">
            <Paperclip className="h-3 w-3" /> {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Timer className="h-3 w-3" />
          {task.revised_estimate_hours ? (
            <span>
              {fmtHrs(estHrs)} / <span className="line-through">{task.estimated_hours}h</span>{" "}
              <span className="font-medium text-slate-700">{task.revised_estimate_hours}h</span>
            </span>
          ) : (
            <span>{fmtHrs(estHrs)} / {fmtHrs(plannedHrs)}</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{totalMs > 0 ? "Milestone" : "Step"} progress</span>
          <span>{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Milestones — status, attachments & details */}
      {taskMilestones.length > 0 && (
        <div className="space-y-2 pt-1">
          {taskMilestones.map((ms) => (
            <MilestoneRow key={ms.id} ms={ms} subjectId={user.id} taskId={task.id} />
          ))}
        </div>
      )}
    </div>
  );
}
