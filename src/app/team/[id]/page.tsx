"use client";

import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LeaveAnalytics } from "@/components/leave-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  FolderKanban,
  FileText,
  CheckCircle2,
  Clock,
  Code,
  BookOpen,
  Presentation,
  MessageSquare,
  Users,
  ArrowRight,
  Sparkles,
  CalendarDays,
  AlertTriangle,
  Calendar,
  Sun,
  Sunrise,
  Sunset,
  ListChecks,
  Timer,
  Brain,
  Shield,
  Activity,
  TrendingUp,
  CircleDot,
  PauseCircle,
  XCircle,
  Target,
  ChevronLeft,
  ChevronRight,
  Milestone,
  BarChart3,
  Eye,
  GanttChart,
} from "lucide-react";
import {
  users as usersApi,
  projects as projectsApi,
  tasks as tasksApi,
  leave as leaveApi,
  type Task,
  type DeadlineExtension,
  type LeaveRequest,
  type Project,
  type TaskMilestone,
  type User,
  type ProjectUpdate,
} from "@/lib/api-client";
import {
  format,
  formatDistanceToNow,
  parseISO,
  addDays,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  differenceInDays,
  differenceInCalendarDays,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";

// ---- Mock Daily Activity ----

const MOCK_DAILY_ACTIVITY: Record<string, { yesterday: string[]; today: string[]; tomorrow: string[] }> = {
  u2: {
    yesterday: [
      "Validated data quality metrics for churn dataset — 96% completeness achieved",
      "Reviewed Meera's hyperparameter tuning experiment #47 on MLflow",
      "Updated data pipeline documentation with new schema changes",
    ],
    today: [
      "Monitoring MLflow experiments for churn model convergence",
      "Preparing feature importance report for stakeholder review",
      "Slack standup with Meera on SHAP analysis prep",
    ],
    tomorrow: [
      "Start drafting model evaluation report",
      "Review Meera's latest tuning results",
      "Sync with Rahul on churn model progress",
    ],
  },
  u3: {
    yesterday: [
      "Submitted circuit breaker design document for review",
      "Fixed edge case in rate limiter token replenishment logic",
      "Pair programming with Vikram on Redis connection pooling",
    ],
    today: [
      "Implementing circuit breaker state machine — currently on 'half-open' state handling",
      "Code review for Vikram's JWT refresh token PR",
      "Blocked: waiting for Redis staging cluster from DevOps",
    ],
    tomorrow: [
      "Continue circuit breaker implementation — fallback strategies",
      "Write integration tests for rate limiter + Redis",
      "Team sync on milestone m3 status",
    ],
  },
  u4: {
    yesterday: [
      "Ran Optuna trials #51-#75 — best precision so far: 78.3%",
      "Experimented with feature selection using mutual information",
      "Updated MLflow experiment tracking dashboard",
    ],
    today: [
      "Running final batch of hyperparameter trials (#76-#100)",
      "Analyzing convergence patterns across top 10 configurations",
      "Documenting model architecture decisions",
    ],
    tomorrow: [
      "Finalize best hyperparameter configuration",
      "Begin SHAP analysis setup if tuning is complete",
      "Share intermediate results with Rahul",
    ],
  },
  u5: {
    yesterday: [
      "Completed JWT validation middleware — all edge cases covered",
      "Submitted PR #47 for JWT middleware with 100% test coverage",
      "Benchmark results: 18k req/s for routing engine — exceeds target",
    ],
    today: [
      "On sick leave — fever (approved)",
      "PR for JWT middleware is up for review — no blockers for team",
    ],
    tomorrow: [
      "Expected to return",
      "Review rate limiter progress with Arjun",
      "Start production deployment planning for milestone m4",
    ],
  },
};

// ---- AI Performance Insights ----

const AI_INSIGHTS: Record<string, { summary: string; highlights: string[]; recommendation: string }> = {
  u2: {
    summary: "Sanjay is a steady performer who anchors the data science pipeline. His data validation work consistently catches quality issues early, saving downstream rework.",
    highlights: [
      "Data quality validation hit 96% completeness — above the 90% target",
      "Proactively reviewed Meera's experiments, unblocking her tuning work",
      "Documentation updates are thorough and current",
    ],
    recommendation: "Consider assigning Sanjay to lead the model evaluation phase — his attention to data quality would strengthen the review process.",
  },
  u3: {
    summary: "Arjun has had 2 deadline extensions this sprint. Production incident support took priority over circuit breaker work. He's technically strong but stretched across too many responsibilities.",
    highlights: [
      "Circuit breaker design document was well-received by the team",
      "Currently blocked on Redis staging cluster from DevOps — escalate if not resolved by tomorrow",
      "2 deadline extensions requested — both due to external dependencies",
    ],
    recommendation: "Recommend redistributing circuit breaker work or getting DevOps to prioritize the Redis cluster. Arjun performs best when not context-switching between support and feature work.",
  },
  u4: {
    summary: "Meera is deep in hyperparameter optimization and showing strong systematic approach. Her Optuna trial methodology is well-structured, but the tuning phase is taking longer than estimated.",
    highlights: [
      "Best precision at 78.3% after 75 trials — trending toward target",
      "Methodical approach with MLflow tracking for reproducibility",
      "Feature selection experiments show initiative beyond assigned scope",
    ],
    recommendation: "If tuning doesn't converge by trial #100, consider setting a threshold and moving to SHAP analysis. Diminishing returns likely after this point.",
  },
  u5: {
    summary: "Vikram consistently delivers ahead of estimates. The routing engine benchmark at 18k req/s exceeds the 15k target. His JWT middleware PR has 100% test coverage — a team best.",
    highlights: [
      "Routing engine: 18k req/s — 20% above the 15k target",
      "JWT middleware completed with 100% test coverage",
      "Currently on sick leave — no impact on team as PR is ready for review",
    ],
    recommendation: "Consider assigning Vikram more critical-path tasks. His track record of early delivery and thorough testing makes him ideal for milestone-critical work.",
  },
};

// ---- Badge/Color helpers ----

const taskStatusColors: Record<string, string> = {
  planning: "text-slate-700 border-slate-200 bg-slate-50",
  in_progress: "text-blue-700 border-blue-200 bg-blue-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  blocked: "text-red-700 border-red-200 bg-red-50",
  killed: "text-gray-700 border-gray-200 bg-gray-50",
  redefined: "text-purple-700 border-purple-200 bg-purple-50",
};

const taskStatusIcons: Record<string, React.ReactNode> = {
  planning: <CircleDot className="h-3 w-3" />,
  in_progress: <Activity className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  blocked: <PauseCircle className="h-3 w-3" />,
  killed: <XCircle className="h-3 w-3" />,
  redefined: <Target className="h-3 w-3" />,
};

const outcomeStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  submitted: "text-blue-700 border-blue-200 bg-blue-50",
  verified: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
};

const extensionStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  approved: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
  auto_escalated: "text-red-700 border-red-200 bg-red-50",
};

const leaveTypeColors: Record<string, string> = {
  planned: "text-blue-700 border-blue-200 bg-blue-50",
  sick: "text-red-700 border-red-200 bg-red-50",
  personal: "text-purple-700 border-purple-200 bg-purple-50",
  wfh: "text-teal-700 border-teal-200 bg-teal-50",
  half_day: "text-amber-700 border-amber-200 bg-amber-50",
};

const leaveStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  approved: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
};

const typeBadgeColors: Record<string, string> = {
  code: "text-blue-700 border-blue-200 bg-blue-50",
  architecture: "text-purple-700 border-purple-200 bg-purple-50",
  notebook: "text-amber-700 border-amber-200 bg-amber-50",
  document: "text-green-700 border-green-200 bg-green-50",
  demo: "text-pink-700 border-pink-200 bg-pink-50",
  status_update: "text-slate-700 border-slate-200 bg-slate-50",
  meeting_notes: "text-cyan-700 border-cyan-200 bg-cyan-50",
};

const typeIcons: Record<string, React.ReactNode> = {
  code: <Code className="h-4 w-4 text-blue-600" />,
  architecture: <FileText className="h-4 w-4 text-purple-600" />,
  notebook: <BookOpen className="h-4 w-4 text-amber-600" />,
  document: <FileText className="h-4 w-4 text-green-600" />,
  demo: <Presentation className="h-4 w-4 text-pink-600" />,
  status_update: <MessageSquare className="h-4 w-4 text-slate-500" />,
  meeting_notes: <Users className="h-4 w-4 text-cyan-600" />,
};

// ---- Helper: find project for a task (populated at runtime) ----
let _projectMap: Record<string, Project> = {};
function getProjectForTask(task: Task): Project | undefined {
  return _projectMap[task.project_id];
}

function getMilestoneTitle(task: Task, milestoneId: string): string {
  const ms = (task.milestones ?? []).find((m) => m.id === milestoneId);
  return ms?.title || milestoneId;
}

// ---- Deliverable Timeline helpers ----

const deliverableTypeIcons: Record<string, string> = {
  demo: "\uD83C\uDFAC",
  ppt: "\uD83D\uDCC4",
  document: "\uD83D\uDCC4",
  code: "\uD83D\uDCBB",
  data: "\uD83D\uDCCA",
  text: "\u2705",
  meeting_notes: "\u2705",
};

const deliverableTypeLabels: Record<string, string> = {
  demo: "Demo/Presentation",
  ppt: "PPT/Document",
  document: "Document",
  code: "Code Delivery",
  data: "Data/Report",
  text: "Sign-off/Review",
  meeting_notes: "Meeting Notes",
};

type TimelineItem = {
  id: string;
  taskId: string;
  taskTitle: string;
  projectTitle: string;
  projectId: string;
  milestoneTitle: string;
  deliverableType: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualEnd: Date | null;
  status: "completed_on_time" | "completed_late" | "in_progress" | "overdue" | "upcoming";
  delayDays: number;
  deliverables: { title: string; status: string; type: string }[];
  updates: { message: string; created_at: string }[];
};

function buildTimelineItems(userTasks: Task[], userId: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  const now = new Date();

  for (const task of userTasks) {
    const project = getProjectForTask(task);
    if (!project) continue;

    const taskStart = new Date(task.created_at);
    const hoursEstimate = task.revised_estimate_hours || task.estimated_hours || 8;
    const estimatedDays = Math.max(1, Math.ceil(hoursEstimate / 8));
    const plannedEnd = addDays(taskStart, estimatedDays);

    // Build items from milestones
    const milestones = task.milestones ?? [];
    if (milestones.length > 0) {
      for (const ms of milestones) {
        const msPlannedEnd = ms.target_day
          ? addDays(taskStart, ms.target_day)
          : plannedEnd;
        const msPlannedStart = ms.target_day
          ? addDays(taskStart, Math.max(0, ms.target_day - Math.ceil(estimatedDays / milestones.length)))
          : taskStart;

        const actualEnd = ms.completed_at ? new Date(ms.completed_at) : null;
        let status: TimelineItem["status"];
        let delayDays = 0;

        if (ms.status === "completed" && actualEnd) {
          const diff = differenceInCalendarDays(actualEnd, msPlannedEnd);
          if (diff > 0) {
            status = "completed_late";
            delayDays = diff;
          } else {
            status = "completed_on_time";
          }
        } else if (ms.status === "in_progress" || ms.status === "pending") {
          if (isAfter(now, msPlannedEnd)) {
            status = "overdue";
            delayDays = differenceInCalendarDays(now, msPlannedEnd);
          } else if (ms.status === "in_progress") {
            status = "in_progress";
          } else {
            status = "upcoming";
          }
        } else {
          // blocked
          if (isAfter(now, msPlannedEnd)) {
            status = "overdue";
            delayDays = differenceInCalendarDays(now, msPlannedEnd);
          } else {
            status = "in_progress";
          }
        }

        items.push({
          id: ms.id,
          taskId: task.id,
          taskTitle: task.title,
          projectTitle: project.title,
          projectId: project.id,
          milestoneTitle: ms.title,
          deliverableType: ms.deliverable_type || "text",
          plannedStart: msPlannedStart,
          plannedEnd: msPlannedEnd,
          actualEnd,
          status,
          delayDays,
          deliverables: (ms.deliverables ?? []).map((d) => ({
            title: d.title,
            status: d.status,
            type: d.type,
          })),
          updates: [],
        });
      }
    } else {
      // Task without milestones — treat task itself as a deliverable
      const actualEnd = task.completed_at ? new Date(task.completed_at) : null;
      let status: TimelineItem["status"];
      let delayDays = 0;

      if (task.status === "completed" && actualEnd) {
        const diff = differenceInCalendarDays(actualEnd, plannedEnd);
        if (diff > 0) {
          status = "completed_late";
          delayDays = diff;
        } else {
          status = "completed_on_time";
        }
      } else if (task.status === "in_progress" || task.status === "planning") {
        if (isAfter(now, plannedEnd)) {
          status = "overdue";
          delayDays = differenceInCalendarDays(now, plannedEnd);
        } else if (task.status === "in_progress") {
          status = "in_progress";
        } else {
          status = "upcoming";
        }
      } else {
        status = "upcoming";
      }

      items.push({
        id: task.id,
        taskId: task.id,
        taskTitle: task.title,
        projectTitle: project.title,
        projectId: project.id,
        milestoneTitle: task.title,
        deliverableType: "text",
        plannedStart: taskStart,
        plannedEnd,
        actualEnd,
        status,
        delayDays,
        deliverables: [],
        updates: (task.updates ?? []).map((u) => ({
          message: u.message,
          created_at: u.created_at,
        })),
      });
    }
  }

  return items.sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
}

function getTimelineBarColor(status: TimelineItem["status"]) {
  switch (status) {
    case "completed_on_time": return { planned: "bg-green-100", actual: "bg-green-500", text: "text-green-700", badge: "text-green-700 border-green-200 bg-green-50" };
    case "completed_late": return { planned: "bg-amber-100", actual: "bg-amber-500", text: "text-amber-700", badge: "text-amber-700 border-amber-200 bg-amber-50" };
    case "in_progress": return { planned: "bg-blue-100", actual: "bg-blue-500", text: "text-blue-700", badge: "text-blue-700 border-blue-200 bg-blue-50" };
    case "overdue": return { planned: "bg-red-100", actual: "bg-red-500", text: "text-red-700", badge: "text-red-700 border-red-200 bg-red-50" };
    case "upcoming": return { planned: "bg-slate-100", actual: "bg-slate-400", text: "text-slate-700", badge: "text-slate-700 border-slate-200 bg-slate-50" };
  }
}

function getStatusLabel(status: TimelineItem["status"]) {
  switch (status) {
    case "completed_on_time": return "On Time";
    case "completed_late": return "Delayed";
    case "in_progress": return "In Progress";
    case "overdue": return "Overdue";
    case "upcoming": return "Upcoming";
  }
}

// ---- Deliverable Timeline Component ----

function DeliverableTimeline({ userTasks, userId }: { userTasks: Task[]; userId: string }) {
  const [viewMode, setViewMode] = React.useState<"week" | "month">("month");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  const timelineItems = React.useMemo(() => buildTimelineItems(userTasks, userId), [userTasks, userId]);

  // Navigation
  const goForward = () => {
    setCurrentDate((d) => (viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  };
  const goBackward = () => {
    setCurrentDate((d) => (viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Calendar days
  const calendarStart = viewMode === "week" ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
  const calendarEnd = viewMode === "week" ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Pad month view to full weeks
  const monthStartPadded = startOfWeek(calendarStart, { weekStartsOn: 1 });
  const monthEndPadded = endOfWeek(calendarEnd, { weekStartsOn: 1 });
  const displayDays = viewMode === "month"
    ? eachDayOfInterval({ start: monthStartPadded, end: monthEndPadded })
    : calendarDays;

  // Find items relevant to each day (deliverable due on that day based on plannedEnd or actualEnd)
  const getItemsForDay = (day: Date) => {
    return timelineItems.filter((item) => {
      const onPlannedEnd = isSameDay(item.plannedEnd, day);
      const onActualEnd = item.actualEnd && isSameDay(item.actualEnd, day);
      const inRange = isWithinInterval(day, {
        start: item.plannedStart,
        end: item.actualEnd || item.plannedEnd,
      });
      return onPlannedEnd || onActualEnd || inRange;
    });
  };

  const getDueItemsForDay = (day: Date) => {
    return timelineItems.filter((item) => {
      return isSameDay(item.plannedEnd, day) || (item.actualEnd && isSameDay(item.actualEnd, day));
    });
  };

  // Items for selected date card view
  const selectedDateItems = selectedDate ? getDueItemsForDay(selectedDate) : [];

  // Timeline range for the Gantt-style view
  const visibleItems = timelineItems.filter((item) => {
    const itemStart = item.plannedStart;
    const itemEnd = item.actualEnd && isAfter(item.actualEnd, item.plannedEnd) ? item.actualEnd : item.plannedEnd;
    return (
      isWithinInterval(itemStart, { start: calendarStart, end: calendarEnd }) ||
      isWithinInterval(itemEnd, { start: calendarStart, end: calendarEnd }) ||
      (isBefore(itemStart, calendarStart) && isAfter(itemEnd, calendarEnd))
    );
  });

  const totalCalendarDays = differenceInCalendarDays(calendarEnd, calendarStart) + 1;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <GanttChart className="h-5 w-5 text-indigo-600" />
        Deliverable Timeline
      </h2>

      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-5">
          {/* A) Date Navigator */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                Month
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goBackward}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {viewMode === "week"
                  ? `${format(calendarStart, "MMM d")} - ${format(calendarEnd, "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")}
              </span>
              <Button variant="outline" size="sm" onClick={goForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> On Time</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> In Progress</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Overdue</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Delayed</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px">
              {displayDays.map((day) => {
                const dayItems = getDueItemsForDay(day);
                const isSelected = selectedDate && isSameDay(selectedDate, day);
                const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
                const dayIsToday = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative p-1.5 min-h-[60px] text-left border rounded-md transition-colors
                      ${isSelected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:bg-slate-50"}
                      ${!isCurrentMonth ? "opacity-40" : ""}
                      ${dayIsToday ? "bg-blue-50/50" : ""}
                    `}
                  >
                    <span className={`text-xs font-medium ${dayIsToday ? "text-blue-600 font-bold" : "text-slate-600"}`}>
                      {format(day, "d")}
                    </span>
                    {dayItems.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => {
                          const colors = getTimelineBarColor(item.status);
                          return (
                            <div
                              key={item.id}
                              className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 ${colors.actual} text-white`}
                              title={`${item.milestoneTitle} (${getStatusLabel(item.status)})`}
                            >
                              {deliverableTypeIcons[item.deliverableType] || "\u2705"} {item.milestoneTitle.slice(0, 12)}
                            </div>
                          );
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-muted-foreground text-center">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* B) Gantt-style Timeline View */}
          {visibleItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Planned vs Actual Timeline
              </h3>
              <div className="space-y-1.5 overflow-x-auto">
                {/* Date axis */}
                <div className="flex items-center border-b border-slate-200 pb-1 min-w-[600px]">
                  <div className="w-[200px] shrink-0 text-xs text-muted-foreground pr-2">Deliverable</div>
                  <div className="flex-1 flex">
                    {calendarDays.filter((_, i) => {
                      // Show every 3rd day for month view, every day for week
                      return viewMode === "week" || i % Math.max(1, Math.floor(totalCalendarDays / 10)) === 0;
                    }).map((d) => (
                      <div
                        key={d.toISOString()}
                        className="text-[10px] text-muted-foreground"
                        style={{
                          position: "absolute" as const,
                          left: `${200 + ((differenceInCalendarDays(d, calendarStart) / totalCalendarDays) * 100)}%`,
                        }}
                      >
                        {format(d, "MMM d")}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bars */}
                {visibleItems.map((item) => {
                  const colors = getTimelineBarColor(item.status);
                  const barStart = Math.max(0, differenceInCalendarDays(item.plannedStart, calendarStart));
                  const barPlannedEnd = Math.min(totalCalendarDays, differenceInCalendarDays(item.plannedEnd, calendarStart) + 1);
                  const barActualEnd = item.actualEnd
                    ? Math.min(totalCalendarDays, differenceInCalendarDays(item.actualEnd, calendarStart) + 1)
                    : item.status === "in_progress" || item.status === "overdue"
                      ? Math.min(totalCalendarDays, differenceInCalendarDays(new Date(), calendarStart) + 1)
                      : barPlannedEnd;

                  const plannedLeft = (barStart / totalCalendarDays) * 100;
                  const plannedWidth = Math.max(2, ((barPlannedEnd - barStart) / totalCalendarDays) * 100);
                  const actualWidth = Math.max(2, ((barActualEnd - barStart) / totalCalendarDays) * 100);
                  const hasOverflow = actualWidth > plannedWidth;

                  return (
                    <div key={item.id} className="flex items-center min-w-[600px] group">
                      <div className="w-[200px] shrink-0 pr-2 flex items-center gap-1.5">
                        <span className="text-sm">{deliverableTypeIcons[item.deliverableType] || "\u2705"}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" title={item.milestoneTitle}>{item.milestoneTitle}</p>
                          <p className="text-[10px] text-muted-foreground truncate" title={item.projectTitle}>{item.projectTitle}</p>
                        </div>
                      </div>
                      <div className="flex-1 relative h-6">
                        {/* Planned bar (lighter) */}
                        <div
                          className={`absolute top-0.5 h-5 rounded ${colors.planned} border border-slate-200/50`}
                          style={{ left: `${plannedLeft}%`, width: `${plannedWidth}%` }}
                          title={`Planned: ${format(item.plannedStart, "MMM d")} - ${format(item.plannedEnd, "MMM d")}`}
                        />
                        {/* Actual bar (solid) */}
                        <div
                          className={`absolute top-1.5 h-3 rounded ${colors.actual}`}
                          style={{
                            left: `${plannedLeft}%`,
                            width: `${Math.min(actualWidth, plannedWidth)}%`,
                            opacity: 0.85,
                          }}
                        />
                        {/* Overdue extension (red) */}
                        {hasOverflow && (
                          <div
                            className="absolute top-1.5 h-3 rounded-r bg-red-500"
                            style={{
                              left: `${plannedLeft + plannedWidth}%`,
                              width: `${actualWidth - plannedWidth}%`,
                              opacity: 0.7,
                            }}
                            title={`Overdue by ${item.delayDays} day(s)`}
                          />
                        )}
                        {/* Status badge on hover */}
                        <div className="absolute top-0 right-0 hidden group-hover:block">
                          <Badge variant="outline" className={`text-[10px] ${colors.badge}`}>
                            {getStatusLabel(item.status)}
                            {item.delayDays > 0 && ` (+${item.delayDays}d)`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* C) Deliverable Cards for Selected Date */}
          {selectedDate && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-500" />
                Deliverables for {format(selectedDate, "EEEE, MMM d, yyyy")}
              </h3>

              {selectedDateItems.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                  No deliverables due on this date
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateItems.map((item) => {
                    const colors = getTimelineBarColor(item.status);
                    return (
                      <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{deliverableTypeIcons[item.deliverableType] || "\u2705"}</span>
                            <span className="font-medium text-sm">{item.milestoneTitle}</span>
                            <Badge variant="outline" className={colors.badge}>
                              {getStatusLabel(item.status)}
                              {item.delayDays > 0 && ` (+${item.delayDays}d)`}
                            </Badge>
                            <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50 text-xs">
                              {deliverableTypeLabels[item.deliverableType] || item.deliverableType}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Planned: <span className="font-medium text-slate-700">{format(item.plannedStart, "MMM d")} - {format(item.plannedEnd, "MMM d")}</span>
                          </span>
                          {item.actualEnd && (
                            <>
                              <ArrowRight className="h-3 w-3" />
                              <span>
                                Actual: <span className="font-medium text-slate-700">{format(item.actualEnd, "MMM d, yyyy")}</span>
                              </span>
                            </>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <Link href={`/projects/${item.projectId}`} className="text-blue-600 hover:underline">
                            {item.projectTitle}
                          </Link>
                          {" / "}
                          <span className="text-slate-600">{item.taskTitle}</span>
                        </div>

                        {/* Deliverable submissions */}
                        {item.deliverables.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-600">Submissions:</p>
                            {item.deliverables.map((d, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className={
                                  d.status === "verified" ? "text-green-700 border-green-200 bg-green-50" :
                                  d.status === "submitted" ? "text-blue-700 border-blue-200 bg-blue-50" :
                                  d.status === "rejected" ? "text-red-700 border-red-200 bg-red-50" :
                                  "text-amber-700 border-amber-200 bg-amber-50"
                                }>
                                  {d.status}
                                </Badge>
                                <span className="text-slate-700">{d.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Latest updates */}
                        {item.updates.length > 0 && (
                          <div className="space-y-1 border-t border-slate-100 pt-1.5">
                            <p className="text-xs font-medium text-slate-600">Latest update:</p>
                            <p className="text-xs text-slate-600">{item.updates[item.updates.length - 1].message}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.updates[item.updates.length - 1].created_at), { addSuffix: true })}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-200">
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-bold text-slate-700">{timelineItems.length}</p>
              <p className="text-xs text-muted-foreground">Total Deliverables</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50">
              <p className="text-lg font-bold text-green-700">
                {timelineItems.filter((i) => i.status === "completed_on_time").length}
              </p>
              <p className="text-xs text-muted-foreground">On Time</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-50">
              <p className="text-lg font-bold text-amber-700">
                {timelineItems.filter((i) => i.status === "completed_late").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed Late</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50">
              <p className="text-lg font-bold text-blue-700">
                {timelineItems.filter((i) => i.status === "in_progress").length}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50">
              <p className="text-lg font-bold text-red-700">
                {timelineItems.filter((i) => i.status === "overdue").length}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Component ----

export default function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const [user, setUser] = React.useState<User | null>(null);
  const [userProjects, setUserProjects] = React.useState<Project[]>([]);
  const [userTasks, setUserTasks] = React.useState<Task[]>([]);
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showLeaveAnalytics, setShowLeaveAnalytics] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      usersApi.get(id),
      projectsApi.list({ assignee_id: id }),
      usersApi.tasks(id),
      usersApi.leave(id),
    ]).then(([u, p, t, l]) => {
      setUser(u.user);
      const projs = p.projects;
      setUserProjects(projs);
      _projectMap = Object.fromEntries(projs.map((proj) => [proj.id, proj]));
      setUserTasks(t.tasks);
      setLeaves(l.leave);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Derived values (safe with empty arrays while loading)
  const activeProjects = userProjects.filter((p) => p.status === "active");
  const completedTasks = userTasks.filter((t) => t.status === "completed");
  const pendingDeadlineTasks = userTasks.filter(
    (t) => t.status === "in_progress" || t.status === "planning"
  );
  const extensions = userTasks.flatMap((t) => t.deadline_extensions ?? []);
  const userUpdates: Array<ProjectUpdate & { _project: Project }> = [];

  // Group tasks by project
  const tasksByProject = userTasks.reduce<Record<string, { project: Project; tasks: Task[] }>>((acc, task) => {
    const project = getProjectForTask(task);
    if (!project) return acc;
    if (!acc[project.id]) {
      acc[project.id] = { project, tasks: [] };
    }
    acc[project.id].tasks.push(task);
    return acc;
  }, {});

  // ---- Performance Profile computations ----
  const performanceProfile = React.useMemo(() => {
    if (!user) return null;
    const now = new Date();
    const exts = userTasks.flatMap((t) => t.deadline_extensions ?? []);

    // 1. Deadline Adherence
    let onTimeCount = 0;
    let lateCount = 0;
    let totalLateDays = 0;
    let overdueCount = 0;
    let adherenceTotal = 0;

    for (const task of userTasks) {
      const project = getProjectForTask(task);
      if (!project || !task.phase_id) continue;
      const phase = (project.phases ?? []).find((p) => p.id === task.phase_id);
      if (!phase || !phase.end_date) continue;
      const phaseEnd = parseISO(phase.end_date);

      if (task.status === "completed" && task.completed_at) {
        adherenceTotal++;
        const completedDate = parseISO(task.completed_at);
        if (completedDate <= phaseEnd) {
          onTimeCount++;
        } else {
          lateCount++;
          totalLateDays += differenceInCalendarDays(completedDate, phaseEnd);
        }
      } else if (task.status !== "completed" && task.status !== "killed" && task.status !== "redefined") {
        if (isAfter(now, phaseEnd)) {
          overdueCount++;
          adherenceTotal++;
        }
      }
    }
    const onTimePercent = adherenceTotal > 0 ? Math.round((onTimeCount / adherenceTotal) * 100) : 0;
    const avgLateDays = lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0;

    // 2. Extension History
    const firstTimeExts = exts.filter((e) => e.escalation_level === 0).length;
    const repeatExts = exts.filter((e) => e.escalation_level > 0).length;
    const reasonCounts: Record<string, number> = {};
    for (const ext of exts) {
      reasonCounts[ext.reason] = (reasonCounts[ext.reason] || 0) + 1;
    }
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([r]) => r.replace(/_/g, " "));

    // 3. Submission Record (no cross-project API available)
    const totalSubmissions = 0;
    const reviewedSubmissions = 0;
    const pendingSubmissions = 0;
    const submissionTypes = "";

    // 4. Monthly Scorecard — Last 3 Months
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = subMonths(now, i);
      months.push({
        label: format(d, "MMM"),
        start: startOfMonth(d),
        end: endOfMonth(d),
      });
    }

    const scorecard = months.map((m) => {
      const inRange = (dateStr: string) => {
        const d = parseISO(dateStr);
        return !isBefore(d, m.start) && !isAfter(d, m.end);
      };
      return {
        label: m.label,
        completed: userTasks.filter((t) => t.completed_at && inRange(t.completed_at)).length,
        extensions: exts.filter((e) => inRange(e.created_at)).length,
        leaves: leaves.filter((l) => inRange(l.start_date)).length,
        submissions: 0,
      };
    });

    // 5. Commitment Summary
    const activeTasks = userTasks.filter((t) => t.status === "in_progress" || t.status === "planning");
    const inProgressCount = userTasks.filter((t) => t.status === "in_progress").length;
    const planningCount = userTasks.filter((t) => t.status === "planning").length;
    const completionPercent = userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0;

    const avgEstimated = userTasks.length > 0
      ? Math.round(userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0) / userTasks.length)
      : 0;
    const tasksWithRevised = userTasks.filter((t) => t.revised_estimate_hours !== undefined);
    const avgRevised = tasksWithRevised.length > 0
      ? Math.round(tasksWithRevised.reduce((sum, t) => sum + (t.revised_estimate_hours || t.estimated_hours || 0), 0) / tasksWithRevised.length)
      : null;
    let effortInsight = "";
    if (avgRevised !== null) {
      if (avgRevised > avgEstimated) {
        effortInsight = "Tends to underestimate effort";
      } else {
        effortInsight = "Efficient — often finishes ahead of estimates";
      }
    }

    // 6. Organizational Contributions
    const totalProjects = userProjects.length;
    const activeProjectCount = activeProjects.length;
    const reviewsDone = 0;
    const coverageProvided = 0;

    return {
      onTimeCount, lateCount, avgLateDays, overdueCount, adherenceTotal, onTimePercent,
      firstTimeExts, repeatExts, topReasons,
      totalSubmissions, reviewedSubmissions, pendingSubmissions, submissionTypes,
      scorecard,
      activeTasks: activeTasks.length, inProgressCount, planningCount,
      completionPercent, avgEstimated, avgRevised, effortInsight,
      totalProjects, activeProjectCount, reviewsDone, coverageProvided,
    };
  }, [userTasks, leaves, userProjects, activeProjects, completedTasks, user]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pt-12 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user || !performanceProfile) {
    notFound();
  }

  const dailyActivity = MOCK_DAILY_ACTIVITY[user.id] || { yesterday: [], today: [], tomorrow: [] };
  const aiInsight = AI_INSIGHTS[user.id];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Back link */}
      <Link href="/team">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Team
        </Button>
      </Link>

      {/* ===== Section 1: Profile Header ===== */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-muted-foreground">{user.role}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{activeProjects.length}</p>
                <p className="text-xs text-muted-foreground">Active Projects</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <ListChecks className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold">{userTasks.length}</p>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold">{pendingDeadlineTasks.length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Section 2: Daily Activity — Yesterday / Today / Tomorrow ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-600" />
          Daily Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Yesterday */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                <Sunset className="h-4 w-4" />
                Yesterday
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dailyActivity.yesterday.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No recorded activity</p>
              ) : (
                <ul className="space-y-2.5">
                  {dailyActivity.yesterday.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Today */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                <Sun className="h-4 w-4" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dailyActivity.today.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No planned activity</p>
              ) : (
                <ul className="space-y-2.5">
                  {dailyActivity.today.map((item, i) => {
                    const isBlocked = item.toLowerCase().startsWith("blocked");
                    const isLeave = item.toLowerCase().includes("leave");
                    return (
                      <li key={i} className="flex items-start gap-2">
                        {isBlocked ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                        ) : isLeave ? (
                          <Calendar className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        ) : (
                          <Activity className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <span className={`text-sm ${isBlocked ? "text-red-700 font-medium" : isLeave ? "text-amber-700 font-medium" : "text-slate-700"}`}>
                          {item}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Tomorrow */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                <Sunrise className="h-4 w-4" />
                Tomorrow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {dailyActivity.tomorrow.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nothing planned yet</p>
              ) : (
                <ul className="space-y-2.5">
                  {dailyActivity.tomorrow.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== Deliverable Timeline ===== */}
      <DeliverableTimeline userTasks={userTasks} userId={user.id} />

      {/* ===== Section 3: Tasks Across All Projects ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          Tasks Across All Projects
        </h2>
        {Object.keys(tasksByProject).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tasks assigned
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.values(tasksByProject).map(({ project, tasks }) => (
              <Card key={project.id}>
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        {project.title}
                      </CardTitle>
                    </Link>
                    <Badge variant="outline" className={project.status === "active" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-700 border-slate-200 bg-slate-50"}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const taskSteps = task.steps ?? [];
                      const completedSteps = taskSteps.filter((s) => s.status === "completed").length;
                      const totalSteps = taskSteps.length;
                      const stepProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                      const taskMilestones = task.milestones ?? [];

                      return (
                        <div key={task.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5">
                          {/* Task header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{task.title}</span>
                              <Badge variant="outline" className={taskStatusColors[task.status] || ""}>
                                <span className="mr-1">{taskStatusIcons[task.status]}</span>
                                {task.status.replace(/_/g, " ")}
                              </Badge>
                              {taskMilestones.length > 0 && (
                                <Badge variant="outline" className="text-slate-700 border-slate-200 bg-slate-50 text-xs">
                                  {taskMilestones[0].title}
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className={
                              task.priority === "high" ? "text-red-700 border-red-200 bg-red-50" :
                              task.priority === "medium" ? "text-amber-700 border-amber-200 bg-amber-50" :
                              "text-slate-700 border-slate-200 bg-slate-50"
                            }>
                              {task.priority}
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Steps: {completedSteps}/{totalSteps}</span>
                              <span>{stepProgress}%</span>
                            </div>
                            <Progress value={stepProgress} className="h-1.5" />
                          </div>

                          {/* Estimate row */}
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Timer className="h-3 w-3" />
                              {task.revised_estimate_hours ? (
                                <span>
                                  <span className="line-through">{task.estimated_hours}h</span>{" "}
                                  <span className="font-medium text-slate-700">{task.revised_estimate_hours}h</span>
                                </span>
                              ) : (
                                <span>{task.estimated_hours ?? 0}h est.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== Section 4: Deadline & Extension History ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Deadline Extensions
        </h2>
        {extensions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No deadline extensions requested
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {extensions.map((ext) => {
              const project = _projectMap[ext.project_id];
              const task = userTasks.find((t) => t.id === ext.task_id);
              const milestone = task ? (task.milestones ?? []).find((m) => m.id === ext.milestone_id) : undefined;

              return (
                <Card key={ext.id}>
                  <CardContent className="py-4 px-5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {task?.title || milestone?.title || "Extension Request"}
                          </span>
                          <Badge variant="outline" className={extensionStatusColors[ext.status] || ""}>
                            {ext.status.replace(/_/g, " ")}
                          </Badge>
                          {ext.escalation_level > 0 && (
                            <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">
                              Escalation #{ext.escalation_level}
                            </Badge>
                          )}
                        </div>
                        {project && (
                          <Link href={`/projects/${project.id}`} className="text-xs text-blue-600 hover:underline">
                            {project.title}
                          </Link>
                        )}
                      </div>
                      <Badge variant="outline" className="text-slate-700 border-slate-200 bg-slate-50 text-xs whitespace-nowrap">
                        {ext.reason.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">{ext.reason_detail}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {ext.original_deadline && (
                        <>
                          <span>
                            Original: <span className="font-medium text-slate-700">{format(new Date(ext.original_deadline), "MMM d, yyyy")}</span>
                          </span>
                          <ArrowRight className="h-3 w-3" />
                        </>
                      )}
                      <span>
                        Requested: <span className="font-medium text-slate-700">{format(new Date(ext.requested_deadline), "MMM d, yyyy")}</span>
                      </span>
                    </div>

                    {ext.impact && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">
                        Impact: {ext.impact}
                      </p>
                    )}

                    {ext.ceo_comment && (
                      <div className="text-xs p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="font-medium text-slate-600">CEO Response: </span>
                        <span className="text-slate-700">{ext.ceo_comment}</span>
                      </div>
                    )}

                    {ext.action_taken && (
                      <Badge variant="outline" className="text-indigo-700 border-indigo-200 bg-indigo-50 text-xs">
                        Action: {ext.action_taken.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Section 5: Leave History ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Leave History
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
            onClick={() => setShowLeaveAnalytics((v) => !v)}
          >
            <Eye className="h-4 w-4" />
            <span className="text-xs">Analytics</span>
          </Button>
        </div>
        {showLeaveAnalytics && (
          <div className="mb-4">
            <LeaveAnalytics userId={user.id} onClose={() => setShowLeaveAnalytics(false)} />
          </div>
        )}
        {leaves.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No leave requests
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <Card key={leave.id}>
                <CardContent className="py-4 px-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={leaveTypeColors[leave.type] || ""}>
                        {leave.type === "wfh" ? "WFH" : leave.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className={leaveStatusColors[leave.status] || ""}>
                        {leave.status}
                      </Badge>
                      {leave.days != null && (
                        <span className="text-sm text-muted-foreground">
                          {leave.days} {leave.days === 1 ? "day" : "days"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(leave.start_date), "MMM d")}
                      {leave.start_date !== leave.end_date && (
                        <> — {format(new Date(leave.end_date), "MMM d, yyyy")}</>
                      )}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">{leave.reason}</p>

                  {leave.coverage_plan && (
                    <div className="text-xs p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="font-medium text-slate-600">Coverage: </span>
                      <span className="text-slate-700">{leave.coverage_plan}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== Section 6: Recent Submissions ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          Recent Submissions
        </h2>
        {userUpdates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No submissions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {userUpdates.slice(0, 10).map((update) => (
              <Card key={update.id}>
                <CardContent className="py-4 px-5 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {typeIcons[update.type] || typeIcons.document}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{update.title}</span>
                        <Badge variant="outline" className={typeBadgeColors[update.type] || ""}>
                          {update.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                        </span>
                        <Link
                          href={`/projects/${update._project.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {update._project.title}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {update.description && (
                    <p className="text-sm text-muted-foreground pl-7 line-clamp-2">
                      {update.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== Section 7: Performance Profile ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Performance Profile
        </h2>
        <Card className="border-indigo-200">
          <CardContent className="py-5 px-5 space-y-5">

            {/* 1. Deadline Adherence */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Deadline Adherence</p>
              <div className="space-y-1 text-sm">
                <p>
                  On-time completions:{" "}
                  <span className={`font-semibold ${performanceProfile.onTimePercent >= 70 ? "text-green-600" : performanceProfile.onTimePercent >= 40 ? "text-amber-600" : "text-red-600"}`}>
                    {performanceProfile.onTimeCount} of {performanceProfile.adherenceTotal} tasks ({performanceProfile.onTimePercent}%)
                  </span>
                </p>
                {performanceProfile.lateCount > 0 && (
                  <p>
                    Late completions:{" "}
                    <span className="font-semibold text-amber-600">
                      {performanceProfile.lateCount} tasks — avg {performanceProfile.avgLateDays} days late
                    </span>
                  </p>
                )}
                {performanceProfile.overdueCount > 0 && (
                  <p>
                    Currently overdue:{" "}
                    <span className="font-semibold text-red-600">{performanceProfile.overdueCount} tasks</span>
                  </p>
                )}
                {performanceProfile.lateCount === 0 && performanceProfile.overdueCount === 0 && (
                  <p className="text-green-600 font-semibold">No late or overdue tasks</p>
                )}
              </div>
            </div>

            <Separator />

            {/* 2. Extension History */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Extension History</p>
              <div className="space-y-1 text-sm">
                <p>
                  Deadline extensions requested:{" "}
                  <span className={`font-semibold ${extensions.length === 0 ? "text-green-600" : extensions.length <= 2 ? "text-amber-600" : "text-red-600"}`}>
                    {extensions.length}
                  </span>
                </p>
                {extensions.length > 0 && (
                  <>
                    <p className="pl-4">First-time requests: <span className="font-semibold">{performanceProfile.firstTimeExts}</span></p>
                    <p className="pl-4">Repeat extensions (escalation): <span className={`font-semibold ${performanceProfile.repeatExts > 0 ? "text-red-600" : ""}`}>{performanceProfile.repeatExts}</span></p>
                    {performanceProfile.topReasons.length > 0 && (
                      <p className="pl-4">
                        Top reasons:{" "}
                        {performanceProfile.topReasons.map((r, i) => (
                          <Badge key={i} variant="outline" className="text-xs mr-1">{r}</Badge>
                        ))}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* 3. Submission Record */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Submission Record</p>
              <div className="space-y-1 text-sm">
                <p>Total submissions: <span className="font-semibold">{performanceProfile.totalSubmissions}</span></p>
                <p>
                  Reviewed: <span className="font-semibold text-green-600">{performanceProfile.reviewedSubmissions}</span>
                  {" | "}
                  Pending review: <span className={`font-semibold ${performanceProfile.pendingSubmissions > 0 ? "text-amber-600" : ""}`}>{performanceProfile.pendingSubmissions}</span>
                </p>
                {performanceProfile.submissionTypes && (
                  <p>Submission types: <span className="text-muted-foreground">{performanceProfile.submissionTypes}</span></p>
                )}
              </div>
            </div>

            <Separator />

            {/* 4. Monthly Scorecard — Last 3 Months */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Monthly Scorecard — Last 3 Months</p>
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left pr-6 py-1 font-medium"></th>
                      {performanceProfile.scorecard.map((m) => (
                        <th key={m.label} className="text-center px-4 py-1 font-semibold">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="pr-6 py-1 text-muted-foreground">Completed</td>
                      {performanceProfile.scorecard.map((m) => (
                        <td key={m.label} className="text-center px-4 py-1 font-semibold">{m.completed}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="pr-6 py-1 text-muted-foreground">Extensions</td>
                      {performanceProfile.scorecard.map((m) => (
                        <td key={m.label} className={`text-center px-4 py-1 font-semibold ${m.extensions > 0 ? "text-amber-600" : ""}`}>{m.extensions}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="pr-6 py-1 text-muted-foreground">Leaves</td>
                      {performanceProfile.scorecard.map((m) => (
                        <td key={m.label} className="text-center px-4 py-1 font-semibold">{m.leaves}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="pr-6 py-1 text-muted-foreground">Submissions</td>
                      {performanceProfile.scorecard.map((m) => (
                        <td key={m.label} className="text-center px-4 py-1 font-semibold">{m.submissions}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* 5. Commitment Summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Commitment Summary</p>
              <div className="space-y-1 text-sm">
                <p>
                  Active tasks: <span className="font-semibold">{performanceProfile.activeTasks}</span>
                  {" "}({performanceProfile.inProgressCount} in progress, {performanceProfile.planningCount} planning)
                </p>
                <p>
                  Completed: <span className={`font-semibold ${performanceProfile.completionPercent >= 50 ? "text-green-600" : "text-amber-600"}`}>
                    {completedTasks.length} of {userTasks.length} total tasks ({performanceProfile.completionPercent}%)
                  </span>
                </p>
                <p>
                  Avg estimated hours per task: <span className="font-semibold">{performanceProfile.avgEstimated}h</span>
                  {performanceProfile.avgRevised !== null && (
                    <> vs revised: <span className="font-semibold">{performanceProfile.avgRevised}h</span></>
                  )}
                </p>
                {performanceProfile.effortInsight && (
                  <p className={`font-semibold ${performanceProfile.effortInsight.includes("underestimate") ? "text-amber-600" : "text-green-600"}`}>
                    {performanceProfile.effortInsight}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* 6. Organizational Contributions */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Organizational Contributions</p>
              <div className="space-y-1 text-sm">
                <p>
                  Projects: <span className="font-semibold">{performanceProfile.activeProjectCount} active</span>, {performanceProfile.totalProjects} total
                </p>
                <p>
                  Reviews done for others: <span className="font-semibold">{performanceProfile.reviewsDone}</span>
                </p>
                <p>
                  Leave coverage provided: <span className="font-semibold">{performanceProfile.coverageProvided} times</span>
                </p>
              </div>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground italic">
              Updated monthly — last updated: {format(new Date(), "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Section 8: AI Performance Insight ===== */}
      {aiInsight && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Performance Insight
          </h2>
          <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="py-5 px-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{aiInsight.summary}</p>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Key Highlights</p>
                    {aiInsight.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-700">{h}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Recommendation</span>
                      <p className="text-sm text-slate-700 mt-0.5">{aiInsight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
