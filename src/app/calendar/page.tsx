"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
} from "lucide-react";
import {
  projects as projectsApi,
  tasks as tasksApi,
  leave as leaveApi,
  capture as captureApi,
  users as usersApi,
  type Project,
  type Task,
  type LeaveRequest,
  type CaptureItem,
  type User,
} from "@/lib/api-client";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  format,
  addMonths,
  subMonths,
  addDays,
  parseISO,
  isValid,
  differenceInCalendarDays,
} from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType =
  | "deliverable"
  | "leave"
  | "follow_up"
  | "meeting"
  | "commitment"
  | "review"
  | "deadline"
  | "overdue";

type CalendarEvent = {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  date: string; // ISO date yyyy-MM-dd
  userId?: string;
  projectTitle?: string;
  meta?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<
  EventType,
  { label: string; color: string; dot: string; bg: string; text: string }
> = {
  deliverable: {
    label: "Deliverables",
    color: "bg-blue-500",
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
  },
  leave: {
    label: "Leaves",
    color: "bg-red-500",
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
  },
  follow_up: {
    label: "Follow-ups",
    color: "bg-amber-500",
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
  },
  meeting: {
    label: "Meetings",
    color: "bg-purple-500",
    dot: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950",
    text: "text-purple-700 dark:text-purple-300",
  },
  commitment: {
    label: "Commitments",
    color: "bg-teal-500",
    dot: "bg-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950",
    text: "text-teal-700 dark:text-teal-300",
  },
  review: {
    label: "Reviews",
    color: "bg-orange-500",
    dot: "bg-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950",
    text: "text-orange-700 dark:text-orange-300",
  },
  deadline: {
    label: "Deadlines",
    color: "bg-rose-500",
    dot: "bg-rose-500",
    bg: "bg-rose-50 dark:bg-rose-950",
    text: "text-rose-700 dark:text-rose-300",
  },
  overdue: {
    label: "Overdue",
    color: "bg-rose-600",
    dot: "bg-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950",
    text: "text-rose-700 dark:text-rose-300",
  },
};

const ALL_EVENT_TYPES: EventType[] = [
  "deliverable",
  "leave",
  "follow_up",
  "meeting",
  "commitment",
  "review",
  "deadline",
  "overdue",
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Module-level user map for sub-component lookups
let _userMap: Record<string, User> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseDateString(raw: string | undefined): Date | null {
  if (!raw) return null;
  try {
    const d = parseISO(raw);
    if (isValid(d)) return d;
    const fallback = new Date(raw);
    return isValid(fallback) ? fallback : null;
  } catch {
    return null;
  }
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function userInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Event Builder
// ---------------------------------------------------------------------------

function buildCalendarEvents(
  projects: Project[],
  allTasks: Task[],
  allLeaves: LeaveRequest[],
  captureItems: CaptureItem[],
  projectMap: Record<string, Project>,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = new Date();
  const todayKey = toDateKey(today);

  // 1. Deliverables — from tasks with estimated deadlines
  for (const task of allTasks) {
    const project = projectMap[task.project_id];
    if (!project || project.status !== "active") continue;
    const estimatedDays = Math.max(1, Math.ceil((task.estimated_hours || 8) / 8));
    const deadlineDate = addDays(new Date(task.created_at), estimatedDays);
    events.push({
      id: `del-${project.id}-${task.id}`,
      type: "deliverable",
      title: task.title,
      description: project.title,
      date: toDateKey(deadlineDate),
      userId: task.assignee_id,
      projectTitle: project.title,
      meta: {
        status: task.status,
        priority: task.priority,
      },
    });
  }

  // 2. Leaves — one event per day of leave
  for (const leave of allLeaves) {
    if (leave.status === "rejected") continue;
    const user = _userMap[leave.user_id];
    const userName = user?.name ?? "Unknown";
    const start = safeParseDateString(leave.start_date);
    const end = safeParseDateString(leave.end_date);
    if (!start || !end) continue;
    const days = eachDayOfInterval({ start, end });
    for (const day of days) {
      events.push({
        id: `leave-${leave.id}-${toDateKey(day)}`,
        type: "leave",
        title: `${userName} — ${leave.type}`,
        description: leave.reason,
        date: toDateKey(day),
        userId: leave.user_id,
        meta: {
          leaveType: leave.type,
          status: leave.status,
          days: String(leave.days ?? ""),
          startDate: leave.start_date,
          endDate: leave.end_date,
        },
      });
    }
  }

  // 3–5. Capture items (follow_up, meeting, commitment)
  const captureTypeMap: Record<string, EventType> = {
    follow_up: "follow_up",
    meeting: "meeting",
    commitment: "commitment",
  };
  for (const item of captureItems) {
    const mappedType = captureTypeMap[item.type];
    if (!mappedType || !item.due_date) continue;
    const dueDate = safeParseDateString(item.due_date);
    if (!dueDate) continue;
    events.push({
      id: `cap-${item.id}`,
      type: mappedType,
      title: item.title,
      description: item.description,
      date: toDateKey(dueDate),
      userId: item.assignee_id,
      meta: {
        priority: item.priority,
        status: item.status,
      },
    });
  }

  // 7. Deadlines — from project end dates
  for (const project of projects) {
    if (project.status !== "active") continue;
    const endStr = project.end_date ??
      (project.start_date ? toDateKey(addDays(new Date(project.start_date), project.timebox_days)) : null);
    if (!endStr) continue;
    const endDate = safeParseDateString(endStr);
    if (!endDate) continue;
    events.push({
      id: `dead-${project.id}`,
      type: "deadline",
      title: `${project.title} deadline`,
      description: `Project timebox ends`,
      date: toDateKey(endDate),
      projectTitle: project.title,
    });
  }

  // 8. Overdue — tasks past their estimated deadline
  for (const task of allTasks) {
    const project = projectMap[task.project_id];
    if (!project || project.status !== "active") continue;
    if (task.status === "completed" || task.status === "killed") continue;
    const estimatedDays = Math.max(1, Math.ceil((task.estimated_hours || 8) / 8));
    const estimatedEnd = addDays(new Date(task.created_at), estimatedDays);
    if (estimatedEnd >= today) continue;
    const delayDays = differenceInCalendarDays(today, estimatedEnd);
    events.push({
      id: `overdue-task-${project.id}-${task.id}`,
      type: "overdue",
      title: `${task.title} — ${delayDays}d overdue`,
      description: `Was due ${format(estimatedEnd, "MMM d")} · ${project.title}`,
      date: todayKey,
      userId: task.assignee_id,
      projectTitle: project.title,
      meta: {
        delayDays: String(delayDays),
        originalDeadline: toDateKey(estimatedEnd),
        status: task.status,
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function UserAvatar({ userId }: { userId?: string }) {
  if (!userId) return null;
  const user = _userMap[userId];
  if (!user) return null;
  return (
    <div
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: user.avatar_color }}
      title={user.name}
    >
      {userInitials(user.name)}
    </div>
  );
}

function EventTypeBadge({ type }: { type: EventType }) {
  const cfg = EVENT_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label.replace(/s$/, "")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    planning: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    killed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    redefined: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  };
  const cls =
    colorMap[status] ??
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Event Detail Card
// ---------------------------------------------------------------------------

function EventDetailCard({ event }: { event: CalendarEvent }) {
  const user = event.userId ? _userMap[event.userId] : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="pt-0.5">
        <EventTypeBadge type={event.type} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-sm leading-tight">{event.title}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {user && (
            <div className="flex items-center gap-1.5">
              <UserAvatar userId={event.userId} />
              <span className="text-xs text-muted-foreground">{user.name}</span>
            </div>
          )}
          {event.projectTitle && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              {event.projectTitle}
            </div>
          )}
          {event.type === "leave" && event.meta && (
            <>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {event.meta.leaveType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {event.meta.days} day{event.meta.days !== "1" ? "s" : ""}
              </span>
              <StatusBadge status={event.meta.status} />
            </>
          )}
          {event.type === "deliverable" && event.meta && (
            <>
              <StatusBadge status={event.meta.status} />
              {event.meta.priority && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {event.meta.priority}
                </Badge>
              )}
            </>
          )}
          {event.type === "review" && (
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 text-[10px] px-1.5 py-0">
              Pending Review
            </Badge>
          )}
          {event.type === "deadline" && event.meta?.phaseStatus && (
            <StatusBadge status={event.meta.phaseStatus} />
          )}
          {event.type === "overdue" && event.meta && (
            <>
              <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0">
                {event.meta.delayDays}d overdue
              </Badge>
              {event.meta.originalDeadline && (
                <span className="text-xs text-muted-foreground">
                  Due: {event.meta.originalDeadline}
                </span>
              )}
              {event.meta.reason && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {event.meta.reason.replace(/_/g, " ")}
                </Badge>
              )}
              {event.meta.escalation && Number(event.meta.escalation) > 0 && (
                <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">
                  Escalation #{event.meta.escalation}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function CEOCalendarPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [captureItems, setCaptureItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(
    new Set(ALL_EVENT_TYPES)
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      projectsApi.list().then(r => r.projects),
      tasksApi.list().then(r => r.tasks),
      leaveApi.list().then(r => r.leave),
      usersApi.list().then(r => r.users),
      captureApi.list().then(r => r.items).catch(() => [] as CaptureItem[]),
    ]).then(([projs, tasks, leaves, users, caps]) => {
      _userMap = Object.fromEntries(users.map(u => [u.id, u]));
      setProjects(projs);
      setAllTasks(tasks);
      setAllLeaves(leaves);
      setCaptureItems(caps);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p])),
    [projects]
  );

  const allEvents = useMemo(
    () => buildCalendarEvents(projects, allTasks, allLeaves, captureItems, projectMap),
    [projects, allTasks, allLeaves, captureItems, projectMap]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [allEvents]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthEventCounts = useMemo(() => {
    const counts: Record<EventType, number> = {
      deliverable: 0, leave: 0, follow_up: 0, meeting: 0,
      commitment: 0, review: 0, deadline: 0, overdue: 0,
    };
    for (const ev of allEvents) {
      const d = safeParseDateString(ev.date);
      if (!d) continue;
      if (d >= monthStart && d <= monthEnd) counts[ev.type]++;
    }
    return counts;
  }, [allEvents, monthStart, monthEnd]);

  const calendarDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthStart, monthEnd]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    const dayEvents = eventsByDate.get(key) ?? [];
    return dayEvents.filter((ev) => activeFilters.has(ev.type));
  }, [selectedDate, eventsByDate, activeFilters]);

  const groupedSelectedEvents = useMemo(() => {
    const groups = new Map<EventType, CalendarEvent[]>();
    for (const ev of selectedDateEvents) {
      if (!groups.has(ev.type)) groups.set(ev.type, []);
      groups.get(ev.type)!.push(ev);
    }
    return groups;
  }, [selectedDateEvents]);

  const handlePrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const handleNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const handleToday = useCallback(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  }, []);
  const toggleFilter = useCallback((type: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  function getDayEvents(day: Date): CalendarEvent[] {
    const key = toDateKey(day);
    const dayEvents = eventsByDate.get(key) ?? [];
    return dayEvents.filter((ev) => activeFilters.has(ev.type));
  }

  return (
    <div className="min-h-screen p-0 max-w-7xl mx-auto space-y-5">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Schedule</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CEO Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">All deliverables, leaves, and deadlines in one view</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-2xl border shadow-card px-4 py-2.5" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-xl hover:bg-blue-50">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[150px] text-center text-base font-bold text-gray-900">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-xl hover:bg-blue-50">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <Button variant="outline" size="sm" onClick={handleToday} className="rounded-xl border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-semibold">
            Today
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-4">Loading calendar...</div>
      )}

      {/* ---- Filter Chips ---- */}
      <div className="flex flex-wrap gap-2">
        {ALL_EVENT_TYPES.map((type) => {
          const cfg = EVENT_CONFIG[type];
          const count = monthEventCounts[type];
          const active = activeFilters.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? `${cfg.bg} ${cfg.text} border-current/20`
                  : "bg-muted/40 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? cfg.dot : "bg-muted-foreground/40"}`} />
              {cfg.label}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold ${
                  active ? "bg-white/60 dark:bg-black/20" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- Calendar Grid + Detail Panel ---- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = toDateKey(day);
                const inMonth = isSameMonth(day, currentMonth);
                const todayDate = isToday(day);
                const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                const dayEvents = getDayEvents(day);
                const visibleEvents = dayEvents.slice(0, 3);
                const overflowCount = dayEvents.length - 3;

                return (
                  <button
                    key={dayKey}
                    onClick={() => setSelectedDate(day)}
                    className={`relative min-h-[100px] border border-border/50 p-1.5 text-left transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring ${
                      !inMonth ? "opacity-40" : ""
                    } ${
                      todayDate ? "ring-2 ring-blue-500/60 ring-inset bg-blue-50/30 dark:bg-blue-950/20" : ""
                    } ${
                      selected ? "ring-2 ring-primary ring-inset bg-primary/5" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        todayDate ? "bg-blue-600 text-white" : inMonth ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {visibleEvents.map((ev) => {
                        const cfg = EVENT_CONFIG[ev.type];
                        return (
                          <div key={ev.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${cfg.bg}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                            <span className={`truncate text-[10px] font-medium leading-tight ${cfg.text}`}>
                              {ev.title}
                            </span>
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <div className="text-[10px] font-medium text-muted-foreground pl-1">
                          +{overflowCount} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ---- Detail Panel ---- */}
        <div className="space-y-4">
          {selectedDate ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {selectedDateEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Calendar className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No events on this day</p>
                  </div>
                ) : (
                  Array.from(groupedSelectedEvents.entries()).map(([type, events]) => (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${EVENT_CONFIG[type].dot}`} />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {EVENT_CONFIG[type].label} ({events.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {events.map((ev) => (
                          <EventDetailCard key={ev.id} event={ev} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Clock className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Select a day to view details</p>
                <p className="text-xs">Click any day on the calendar to see its events</p>
              </CardContent>
            </Card>
          )}

          {/* Month Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Month Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ALL_EVENT_TYPES.map((type) => {
                  const cfg = EVENT_CONFIG[type];
                  const count = monthEventCounts[type];
                  return (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                        <span className="text-muted-foreground">{cfg.label}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-2 flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {Object.values(monthEventCounts).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
