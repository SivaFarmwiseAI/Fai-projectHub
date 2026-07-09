"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, CalendarDays, FileText, CheckCircle2, Clock, Pause, XCircle,
  ClipboardList, MessageSquare, Layers, ArrowLeft, FileUp, ListChecks,
  ZoomIn, ZoomOut,
} from "lucide-react";
import {
  projects as projectsApi,
  tasks as tasksApi,
  reviews as reviewsApi,
} from "@/lib/api-client";
import type {
  Project, Task, ProjectDocument, ProjectUpdate, ReviewTask,
} from "@/lib/api-client";
import { format, addDays, startOfDay } from "date-fns";
import { UserLink } from "@/components/user-link";

type ViewMode = "daily" | "weekly" | "monthly";

const STATUS_STYLES: Record<string, { bar: string; ring: string; icon: React.ElementType; label: string }> = {
  active:     { bar: "#3b82f6", ring: "ring-blue-200",    icon: Clock,        label: "Active" },
  completed:  { bar: "#10b981", ring: "ring-emerald-200", icon: CheckCircle2, label: "Completed" },
  paused:     { bar: "#f59e0b", ring: "ring-amber-200",   icon: Pause,        label: "Paused" },
  killed:     { bar: "#ef4444", ring: "ring-red-200",     icon: XCircle,      label: "Killed" },
  in_discussion: { bar: "#f59e0b", ring: "ring-amber-200", icon: MessageSquare, label: "In Discussion" },
  pending:    { bar: "#94a3b8", ring: "ring-slate-200",   icon: Clock,        label: "Pending" },
  in_progress:{ bar: "#3b82f6", ring: "ring-blue-200",    icon: Clock,        label: "In Progress" },
  blocked:    { bar: "#ef4444", ring: "ring-red-200",     icon: XCircle,      label: "Blocked" },
  todo:       { bar: "#94a3b8", ring: "ring-slate-200",   icon: Clock,        label: "To Do" },
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

type TimelineEvent = {
  id: string;
  kind: "project_start" | "project_end" | "phase" | "task_start" | "task_end" | "document" | "review" | "update";
  date: Date;
  title: string;
  subtitle?: string;
  color: string;
  icon: React.ElementType;
  meta?: string;
};

export function SingleProjectTimeline({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [reviews, setReviews] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [dayWidth, setDayWidth] = useState(28);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      projectsApi.get(projectId).then(r => r.project).catch(() => null),
      projectsApi.tasks(projectId).then(r => r.tasks).catch(() => []),
      projectsApi.documents(projectId).then(r => r.documents).catch(() => []),
      projectsApi.updates(projectId).then(r => r.updates).catch(() => []),
      reviewsApi.list({ project_id: projectId }).then(r => r.reviews).catch(() => []),
    ]).then(([p, t, d, u, r]) => {
      setProject(p);
      setTasks(t);
      setDocuments(d);
      setUpdates(u);
      setReviews(r);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const events: TimelineEvent[] = useMemo(() => {
    if (!project) return [];
    const evs: TimelineEvent[] = [];

    if (project.start_date) {
      evs.push({
        id: `proj-start-${project.id}`,
        kind: "project_start",
        date: new Date(project.start_date),
        title: "Project kickoff",
        subtitle: project.title,
        color: "#6366f1",
        icon: CalendarDays,
      });
    }

    if (project.end_date) {
      evs.push({
        id: `proj-end-${project.id}`,
        kind: "project_end",
        date: new Date(project.end_date),
        title: "Project deadline",
        subtitle: `Timebox: ${project.timebox_days} days`,
        color: "#ef4444",
        icon: CalendarDays,
      });
    } else if (project.start_date) {
      evs.push({
        id: `proj-end-${project.id}`,
        kind: "project_end",
        date: addDays(new Date(project.start_date), project.timebox_days),
        title: "Project deadline (est.)",
        subtitle: `Timebox: ${project.timebox_days} days`,
        color: "#ef4444",
        icon: CalendarDays,
      });
    }

    (project.phases ?? []).forEach(ph => {
      if (ph.start_date) {
        evs.push({
          id: `phase-start-${ph.id}`,
          kind: "phase",
          date: new Date(ph.start_date),
          title: `Phase started · ${ph.phase_name}`,
          subtitle: ph.description,
          color: "#8b5cf6",
          icon: Layers,
          meta: ph.status,
        });
      }
      if (ph.completed_at) {
        evs.push({
          id: `phase-end-${ph.id}`,
          kind: "phase",
          date: new Date(ph.completed_at),
          title: `Phase completed · ${ph.phase_name}`,
          color: "#10b981",
          icon: CheckCircle2,
          meta: "completed",
        });
      } else if (ph.end_date) {
        evs.push({
          id: `phase-due-${ph.id}`,
          kind: "phase",
          date: new Date(ph.end_date),
          title: `Phase due · ${ph.phase_name}`,
          color: "#a855f7",
          icon: Layers,
          meta: ph.status,
        });
      }
    });

    tasks.forEach(t => {
      if (t.created_at) {
        evs.push({
          id: `task-start-${t.id}`,
          kind: "task_start",
          date: new Date(t.created_at),
          title: `Task started · ${t.title}`,
          subtitle: t.assignee_name ? `Assigned to ${t.assignee_name}` : undefined,
          color: "#3b82f6",
          icon: ListChecks,
          meta: t.status,
        });
      }
      if (t.completed_at) {
        evs.push({
          id: `task-end-${t.id}`,
          kind: "task_end",
          date: new Date(t.completed_at),
          title: `Task completed · ${t.title}`,
          color: "#10b981",
          icon: CheckCircle2,
        });
      }
    });

    documents.forEach(d => {
      evs.push({
        id: `doc-${d.id}`,
        kind: "document",
        date: new Date(d.created_at),
        title: `Document uploaded · ${d.title}`,
        subtitle: d.type,
        color: "#f59e0b",
        icon: FileUp,
        meta: d.status,
      });
    });

    reviews.forEach(r => {
      const date = r.due_date ? new Date(r.due_date) : new Date(r.created_at);
      evs.push({
        id: `review-${r.id}`,
        kind: "review",
        date,
        title: `Review ${r.due_date ? "due" : "requested"} · ${r.title}`,
        subtitle: r.assignee_name ? `Reviewer: ${r.assignee_name}` : undefined,
        color: "#ec4899",
        icon: ClipboardList,
        meta: r.status,
      });
    });

    updates.forEach(u => {
      evs.push({
        id: `update-${u.id}`,
        kind: "update",
        date: new Date(u.created_at),
        title: u.title || "Project update",
        subtitle: u.author_name ? `By ${u.author_name}` : undefined,
        color: "#0ea5e9",
        icon: MessageSquare,
        meta: u.type,
      });
    });

    return evs.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [project, tasks, documents, updates, reviews]);

  // Gantt timeline bounds
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!project || events.length === 0) {
      const today = new Date();
      return { minDate: today, maxDate: addDays(today, 30), totalDays: 30 };
    }
    const dates = events.map(e => e.date.getTime());
    const rawMin = new Date(Math.min(...dates));
    const rawMax = new Date(Math.max(...dates));
    const padding = viewMode === "monthly" ? 30 : 7;
    const mn = addDays(rawMin, -padding);
    const mx = addDays(rawMax, padding);
    return { minDate: mn, maxDate: mx, totalDays: daysBetween(mn, mx) };
  }, [project, events, viewMode]);

  // Generate time ticks
  const timeTicks = useMemo(() => {
    const ticks: { label: string; subLabel?: string; offset: number }[] = [];
    let cursor = new Date(minDate);
    if (viewMode === "daily") {
      while (cursor <= maxDate) {
        ticks.push({
          label: format(cursor, "d"),
          subLabel: format(cursor, "MMM"),
          offset: daysBetween(minDate, cursor) * dayWidth,
        });
        cursor = addDays(cursor, 1);
      }
    } else if (viewMode === "weekly") {
      while (cursor <= maxDate) {
        ticks.push({
          label: format(cursor, "MMM d"),
          offset: daysBetween(minDate, cursor) * dayWidth,
        });
        cursor = addDays(cursor, 7);
      }
    } else {
      cursor.setDate(1);
      while (cursor <= maxDate) {
        ticks.push({
          label: format(cursor, "MMM yyyy"),
          offset: daysBetween(minDate, cursor) * dayWidth,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    return ticks;
  }, [minDate, maxDate, viewMode, dayWidth]);

  // Auto-scroll to today on load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const today = new Date();
      const offset = daysBetween(minDate, today) * dayWidth;
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          const w = scrollRef.current.clientWidth;
          scrollRef.current.scrollLeft = Math.max(0, offset - w / 2 + 16);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, minDate, dayWidth]);

  const handleViewModeChange = (m: ViewMode) => {
    setViewMode(m);
    if (m === "daily") setDayWidth(60);
    else if (m === "weekly") setDayWidth(28);
    else setDayWidth(8);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">
        Project not found.
      </div>
    );
  }

  const today = new Date();
  const todayOffset = daysBetween(minDate, today) * dayWidth;
  const projectStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const ProjectIcon = projectStyle.icon;

  // Project bar
  const pStart = project.start_date ? new Date(project.start_date) : null;
  const pEnd = pStart ? addDays(pStart, project.timebox_days) : null;

  // Group events by day for the chronological feed
  const eventsByDay = events.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const key = format(startOfDay(e.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  // Build Gantt rows: project + phases + tasks
  type Row = {
    id: string;
    label: string;
    sublabel?: string;
    start?: Date;
    end?: Date;
    color: string;
    kind: "project" | "phase" | "task" | "review";
    statusKey?: string;
  };
  const rows: Row[] = [];
  if (pStart && pEnd) {
    rows.push({
      id: project.id, label: project.title, sublabel: "Project",
      start: pStart, end: pEnd, color: projectStyle.bar, kind: "project",
      statusKey: project.status,
    });
  }
  (project.phases ?? []).forEach(ph => {
    if (ph.start_date && ph.end_date) {
      rows.push({
        id: ph.id, label: ph.phase_name, sublabel: "Phase",
        start: new Date(ph.start_date),
        end: new Date(ph.completed_at ?? ph.end_date),
        color: ph.status === "completed" ? "#10b981" : "#8b5cf6",
        kind: "phase", statusKey: ph.status,
      });
    }
  });
  tasks.forEach(t => {
    const ts = t.created_at ? new Date(t.created_at) : null;
    const te = t.completed_at ? new Date(t.completed_at) : (ts ? addDays(ts, 1) : null);
    if (ts && te) {
      rows.push({
        id: t.id, label: t.title, sublabel: t.assignee_name ? `Task · ${t.assignee_name}` : "Task",
        start: ts, end: te,
        color: t.status === "completed" ? "#10b981" : t.status === "blocked" ? "#ef4444" : "#3b82f6",
        kind: "task", statusKey: t.status,
      });
    }
  });

  return (
    <div className="h-full flex flex-col space-y-4 pt-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shrink-0"
            title="Back to all projects"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-lg" style={{ background: projectStyle.bar, boxShadow: `0 4px 12px ${projectStyle.bar}40` }}>
                <ProjectIcon className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 truncate max-w-md">{project.title}</h1>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1 ${projectStyle.ring}`}
                style={{ color: projectStyle.bar, background: `${projectStyle.bar}10` }}
              >
                {projectStyle.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {pStart ? format(pStart, "MMM d, yyyy") : "No start"} → {pEnd ? format(pEnd, "MMM d, yyyy") : "No end"}
              {project.owner_name && <> · Owner: <UserLink userId={project.owner_id} className="font-semibold text-slate-700">{project.owner_name}</UserLink></>}
              <> · {events.length} events</>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(["daily", "weekly", "monthly"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => handleViewModeChange(v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === v ? "bg-purple-100 text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setDayWidth(w => Math.max(2, w - w * 0.2))} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-bold text-slate-600 px-1 w-14 text-center">{Math.round(dayWidth * 10) / 10}px/d</span>
            <button onClick={() => setDayWidth(w => Math.min(120, w + w * 0.2))} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
        <StatCard icon={Layers} label="Phases" value={project.phases?.length ?? 0} color="#8b5cf6" />
        <StatCard icon={ListChecks} label="Tasks" value={tasks.length} color="#3b82f6" sub={`${tasks.filter(t => t.status === "completed").length} done`} />
        <StatCard icon={FileUp} label="Documents" value={documents.length} color="#f59e0b" />
        <StatCard icon={ClipboardList} label="Reviews" value={reviews.length} color="#ec4899" sub={`${reviews.filter(r => r.status === "pending").length} pending`} />
        <StatCard icon={MessageSquare} label="Updates" value={updates.length} color="#0ea5e9" />
      </div>

      {/* Main: Gantt + Event Feed */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Gantt: phases + tasks */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Gantt View</h2>
            </div>
            <span className="text-[10px] text-slate-400">{rows.length} rows</span>
          </div>

          {rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm flex-1">
              No dated phases or tasks yet.
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Date header */}
              <div className="flex shrink-0">
                <div className="w-48 shrink-0 border-r border-slate-100 bg-slate-50/80 h-10 flex items-center px-3 border-b z-20">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Item</span>
                </div>
                <div className="flex-1 overflow-hidden h-10 border-b bg-slate-50/80" id="spt-gantt-header">
                  <div style={{ width: totalDays * dayWidth + 64, height: "100%", position: "relative" }}>
                    {timeTicks.map((t, i) => (
                      <div key={i} className="absolute top-0 h-full flex flex-col justify-center border-l border-slate-200/60"
                        style={{ left: t.offset + 16, paddingLeft: 4 }}>
                        <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap leading-none">{t.label}</span>
                        {t.subLabel && <span className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{t.subLabel}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows */}
              <div className="flex flex-1 min-h-0">
                <div className="w-48 shrink-0 border-r border-slate-100 bg-white overflow-hidden" id="spt-gantt-left">
                  {rows.map(r => (
                    <div key={r.id} className="h-12 flex flex-col justify-center px-3 border-b border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{r.label}</p>
                      </div>
                      {r.sublabel && <p className="text-[9px] text-slate-400 truncate ml-3.5">{r.sublabel}</p>}
                    </div>
                  ))}
                </div>
                <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin"
                  onScroll={e => {
                    const h = document.getElementById("spt-gantt-header");
                    const l = document.getElementById("spt-gantt-left");
                    if (h) h.scrollLeft = e.currentTarget.scrollLeft;
                    if (l) l.scrollTop = e.currentTarget.scrollTop;
                  }}>
                  <div style={{ width: totalDays * dayWidth + 64, minWidth: "100%", position: "relative" }}>
                    {rows.map(r => {
                      if (!r.start || !r.end) return <div key={r.id} className="h-12 border-b border-slate-50" />;
                      const left = daysBetween(minDate, r.start) * dayWidth + 16;
                      const width = Math.max(daysBetween(r.start, r.end) * dayWidth, 12);
                      const isOverdue = r.end < today && r.statusKey !== "completed" && r.kind !== "project";
                      return (
                        <div key={r.id} className="h-12 relative border-b border-slate-50 hover:bg-blue-50/10">
                          {timeTicks.map((t, i) => (
                            <div key={i} className="absolute top-0 w-px h-full bg-slate-100 opacity-60" style={{ left: t.offset + 16 }} />
                          ))}
                          <div
                            className="absolute top-3 h-6 rounded-lg flex items-center px-2 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                            style={{
                              left, width,
                              background: isOverdue
                                ? `repeating-linear-gradient(45deg,${r.color},${r.color} 4px,${r.color}cc 4px,${r.color}cc 8px)`
                                : r.color,
                              boxShadow: `0 2px 6px ${r.color}40`,
                              opacity: r.kind === "task" ? 0.85 : 1,
                            }}
                            title={`${r.label} · ${format(r.start, "MMM d")} → ${format(r.end, "MMM d")}`}
                          >
                            {width > 50 && (
                              <span className="text-white text-[9px] font-bold truncate">{r.label}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Today marker */}
                    {todayOffset >= 0 && todayOffset <= totalDays * dayWidth && (
                      <div className="absolute top-0 w-px h-full bg-red-400 z-10" style={{ left: todayOffset + 16 }}>
                        <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-400 shadow-sm" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Event Feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Event Stream</h2>
            </div>
            <span className="text-[10px] text-slate-400">{events.length} events</span>
          </div>

          {events.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm flex-1">
              No timeline events recorded yet.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="relative px-4 py-4">
                <div className="absolute left-[26px] top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
                {Object.entries(eventsByDay).map(([day, dayEvents]) => {
                  const d = new Date(day);
                  const isToday = format(today, "yyyy-MM-dd") === day;
                  const isPast = d < today;
                  return (
                    <div key={day} className="relative mb-5">
                      <div className="ml-10 mb-2 flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-red-600" : isPast ? "text-slate-400" : "text-purple-600"}`}>
                          {format(d, "EEE, MMM d, yyyy")}
                          {isToday && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[8px]">TODAY</span>}
                        </span>
                      </div>
                      {dayEvents.map(e => {
                        const Icon = e.icon;
                        return (
                          <div key={e.id} className="relative pl-10 mb-2 group">
                            <div
                              className="absolute left-[18px] top-1.5 h-4 w-4 rounded-full ring-4 ring-white flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110"
                              style={{ background: e.color }}
                            >
                              <Icon className="h-2.5 w-2.5 text-white" />
                            </div>
                            <div className="bg-slate-50/50 hover:bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 transition-colors">
                              <p className="text-[11px] font-semibold text-slate-800 leading-tight">{e.title}</p>
                              {e.subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{e.subtitle}</p>}
                              {e.meta && (
                                <span className="inline-block mt-1 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                                  {e.meta.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, sub,
}: {
  icon: React.ElementType; label: string; value: number; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">{label}</p>
        <p className="text-base font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[9px] text-slate-400 leading-none">{sub}</p>}
      </div>
    </div>
  );
}
