"use client";

import { useState, useRef, useEffect } from "react";
import {
  CalendarDays, ZoomIn, ZoomOut,
  CheckCircle2, Clock, Pause, XCircle,
  Loader2, ChevronDown, Search, X,
} from "lucide-react";
import { projects as projectsApi } from "@/lib/api-client";
import type { Project } from "@/lib/api-client";
import { format, addDays, differenceInDays, startOfMonth, startOfYear, addMonths, addYears } from "date-fns";
import { SingleProjectTimeline } from "@/components/single-project-timeline";
import { UserLink } from "@/components/user-link";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeboxDays);
  return Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const STATUS_STYLES: Record<string, { bar: string; text: string; icon: React.ElementType }> = {
  active: { bar: "#3b82f6", text: "#1d4ed8", icon: Clock },
  completed: { bar: "#10b981", text: "#065f46", icon: CheckCircle2 },
  paused: { bar: "#f59e0b", text: "#92400e", icon: Pause },
  killed: { bar: "#ef4444", text: "#991b1b", icon: XCircle },
};

const TYPE_COLORS: Record<string, string> = {
  engineering: "#3b82f6", data_science: "#8b5cf6", design: "#ec4899",
  research: "#06b6d4", marketing: "#f59e0b", strategy: "#10b981",
  operations: "#6366f1", hr: "#f97316", finance: "#84cc16",
  product: "#14b8a6", legal: "#a855f7", sales: "#ef4444", mixed: "#64748b",
};

type ViewMode = "daily" | "weekly" | "monthly" | "yearly";

export function GanttClient() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayWidth, setDayWidth] = useState(28);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsApi.list({ limit: 100 }).then(r => setProjectList(r.projects)).finally(() => setLoading(false));
  }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  // Initial scroll to today
  useEffect(() => {
    if (!loading && scrollRef.current && projectList.length > 0) {
      const today = new Date();
      // Only include projects with a start_date to match rawMin calculation
      const datable = projectList.filter(p => p.start_date);
      if (datable.length === 0) return;

      const allStarts = datable.map(p => new Date(p.start_date!));
      const rawMin = new Date(Math.min(...allStarts.map(d => d.getTime())));
      const padding = viewMode === "yearly" ? 365 : viewMode === "monthly" ? 60 : 14;
      const minDate = addDays(rawMin, -padding);

      const offset = daysBetween(minDate, today) * dayWidth;

      // Small delay to ensure layout is complete
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          const containerWidth = scrollRef.current.clientWidth;
          scrollRef.current.scrollLeft = offset - containerWidth / 2 + 16;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, projectList.length, viewMode, dayWidth]);

  // Sync zoom level when view mode changes to a reasonable default
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "daily") setDayWidth(60);
    else if (mode === "weekly") setDayWidth(28);
    else if (mode === "monthly") setDayWidth(8);
    else if (mode === "yearly") setDayWidth(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Single-project drill-down view
  if (selectedProjectId) {
    return (
      <SingleProjectTimeline
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  const today = new Date();
  const filteredPickerProjects = projectList.filter(p =>
    !pickerSearch || p.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // Only include projects with a start_date
  const datable = projectList.filter(p => p.start_date);
  const filtered = datable.filter(p => statusFilter === "all" || p.status === statusFilter);

  // Timeline bounds
  const allStarts = datable.map(p => new Date(p.start_date!));
  const allEnds = datable.map(p => addDays(new Date(p.start_date!), p.timebox_days));
  const rawMin = allStarts.length ? new Date(Math.min(...allStarts.map(d => d.getTime()))) : new Date();
  const rawMax = allEnds.length ? new Date(Math.max(...allEnds.map(d => d.getTime()))) : new Date();

  // Padding based on view mode
  const padding = viewMode === "yearly" ? 365 : viewMode === "monthly" ? 60 : 14;
  const minDate = addDays(rawMin, -padding);
  const maxDate = addDays(rawMax, padding);
  const totalDays = daysBetween(minDate, maxDate);

  // Generate ticks based on view mode
  const timeTicks: { label: string; offset: number; subLabel?: string }[] = [];
  let cursor = new Date(minDate);

  if (viewMode === "daily") {
    while (cursor <= maxDate) {
      timeTicks.push({
        label: format(cursor, "d"),
        subLabel: format(cursor, "MMM"),
        offset: daysBetween(minDate, cursor) * dayWidth
      });
      cursor = addDays(cursor, 1);
    }
  } else if (viewMode === "weekly") {
    while (cursor <= maxDate) {
      timeTicks.push({
        label: format(cursor, "MMM d"),
        offset: daysBetween(minDate, cursor) * dayWidth
      });
      cursor = addDays(cursor, 7);
    }
  } else if (viewMode === "monthly") {
    cursor = startOfMonth(cursor);
    while (cursor <= maxDate) {
      timeTicks.push({
        label: format(cursor, "MMM yyyy"),
        offset: daysBetween(minDate, cursor) * dayWidth
      });
      cursor = addMonths(cursor, 1);
    }
  } else if (viewMode === "yearly") {
    cursor = startOfYear(cursor);
    while (cursor <= maxDate) {
      timeTicks.push({
        label: format(cursor, "yyyy"),
        offset: daysBetween(minDate, cursor) * dayWidth
      });
      cursor = addYears(cursor, 1);
    }
  }

  const todayOffset = daysBetween(minDate, today) * dayWidth;

  function zoom(delta: number) {
    setDayWidth(prev => {
      const minW = viewMode === "yearly" ? 0.5 : viewMode === "monthly" ? 2 : 10;
      const maxW = viewMode === "daily" ? 120 : 60;
      return Math.min(maxW, Math.max(minW, prev + delta));
    });
  }

  return (
    <div className="h-full flex flex-col space-y-4 pt-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Project Timeline</h1>
          </div>
          <p className="text-[11px] text-slate-500">Cross-project Gantt view · {filtered.length} projects</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Picker */}
          <div ref={pickerRef} className="relative">
            <button
              onClick={() => setPickerOpen(o => !o)}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center gap-2 text-[11px] font-bold text-slate-700 shadow-sm"
            >
              <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
              <span>View single project</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
            {pickerOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search projects…"
                      className="w-full h-8 pl-8 pr-2 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    />
                    {pickerSearch && (
                      <button onClick={() => setPickerSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {filteredPickerProjects.length === 0 ? (
                    <div className="p-6 text-center text-[11px] text-slate-400">No projects found.</div>
                  ) : (
                    filteredPickerProjects.map(p => {
                      const ps = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
                      const Icon = ps.icon;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setPickerOpen(false);
                            setPickerSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors border-b border-slate-50 last:border-b-0 flex items-center gap-2.5"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: ps.bar }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{p.title}</p>
                            <p className="text-[9px] text-slate-400 truncate">
                              {p.owner_name ?? "—"} · {p.status}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(["daily", "weekly", "monthly", "yearly"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => handleViewModeChange(v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewMode === v ? "bg-purple-100 text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {["all", "active", "completed", "paused", "killed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${statusFilter === s ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => zoom(-dayWidth * 0.2)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-bold text-slate-600 px-1 w-14 text-center">{Math.round(dayWidth * 10) / 10}px/d</span>
            <button onClick={() => zoom(dayWidth * 0.2)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 shrink-0">
        {Object.entries(STATUS_STYLES).map(([s, style]) => {
          const Icon = style.icon;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" style={{ color: style.bar }} />
              <span className="capitalize">{s}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="h-3 w-0.5 bg-red-400" />
          <span>Today</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">
          No projects with a timeline set.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 relative">
          {/* Header Row: Corner + Date Timeline */}
          <div className="flex shrink-0">
            <div className="w-56 shrink-0 border-r border-slate-100 bg-slate-50/80 backdrop-blur-sm h-12 flex items-center px-4 border-b z-20">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project</span>
            </div>
            <div className="flex-1 overflow-hidden h-12 border-b bg-slate-50/80 backdrop-blur-sm relative z-10" id="gantt-header-scroll">
              <div style={{ width: totalDays * dayWidth + 100, height: "100%", position: "relative" }}>
                {timeTicks.map((tick, i) => (
                  <div key={i} className="absolute top-0 h-full flex flex-col justify-center border-l border-slate-200/60"
                    style={{ left: tick.offset + 16, paddingLeft: 4 }}>
                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap leading-none">{tick.label}</span>
                    {tick.subLabel && <span className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{tick.subLabel}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content Area: Projects + Timeline Grid */}
          <div className="flex flex-1 min-h-0">
            {/* Frozen Left: Project List */}
            <div className="w-56 shrink-0 border-r border-slate-100 bg-white overflow-hidden z-20" id="gantt-projects-scroll">
              {filtered.map(p => {
                const style = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
                const Icon = style.icon;
                const daysLeft = getDaysRemaining(p.start_date, p.timebox_days);
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className="h-16 flex items-center px-4 border-b border-slate-50 hover:bg-purple-50/40 transition-colors group cursor-pointer"
                    title="View full timeline for this project"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 shrink-0" style={{ color: style.bar }} />
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{p.title}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {p.owner_name && (
                          <UserLink userId={p.owner_id} title={p.owner_name} className="flex items-center gap-1 min-w-0 hover:no-underline">
                            <div className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                              style={{ background: p.owner_avatar_color ?? "#999" }}>
                              {p.owner_name.charAt(0)}
                            </div>
                            <span className="text-[9px] text-slate-400 truncate hover:text-blue-600">{p.owner_name}</span>
                          </UserLink>
                        )}
                        <div className={`text-[9px] font-bold shrink-0 ${daysLeft < 0 ? "text-red-500" : "text-slate-400"}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable Right: Grid + Bars */}
            <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-200 z-10"
              onScroll={(e) => {
                const header = document.getElementById("gantt-header-scroll");
                const projects = document.getElementById("gantt-projects-scroll");
                if (header) header.scrollLeft = e.currentTarget.scrollLeft;
                if (projects) projects.scrollTop = e.currentTarget.scrollTop;
              }}>
              <div style={{ width: totalDays * dayWidth + 100, minWidth: "100%", position: "relative" }}>
                {filtered.map(p => {
                  const start = new Date(p.start_date!);
                  const end = addDays(new Date(p.start_date!), p.timebox_days);
                  const barStart = daysBetween(minDate, start) * dayWidth + 16;
                  const barWidth = Math.max(daysBetween(start, end) * dayWidth, viewMode === "yearly" ? 4 : 20);
                  const style = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
                  const catColor = TYPE_COLORS[p.type] ?? "#3b82f6";
                  const isOverdue = end < today && p.status === "active";

                  const phaseBars = (p.phases ?? []).map((ph, phIdx) => {
                    if (!ph.start_date || !ph.end_date) return null;
                    const phStart = daysBetween(minDate, new Date(ph.start_date)) * dayWidth + 16;
                    const phWidth = Math.max(daysBetween(new Date(ph.start_date), new Date(ph.end_date)) * dayWidth, 2);
                    const phColors: Record<string, string> = { completed: "#10b981", active: catColor, in_discussion: "#f59e0b", pending: "#e2e8f0" };
                    return (
                      <div key={phIdx} className="absolute bottom-1.5 h-1.5 rounded-full opacity-60"
                        style={{ left: phStart, width: phWidth, background: phColors[ph.status] ?? "#e2e8f0" }}
                      />
                    );
                  }).filter(Boolean);

                  return (
                    <div key={p.id} className="h-16 relative border-b border-slate-50 hover:bg-blue-50/10 transition-colors">
                      {/* Sub-grid lines based on view mode */}
                      {timeTicks.map((tick, i) => (
                        <div key={i} className="absolute top-0 w-px h-full bg-slate-100 opacity-60"
                          style={{ left: tick.offset + 16 }} />
                      ))}

                      <div className="absolute top-4 h-7 rounded-xl flex items-center px-3 cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                          left: barStart, width: barWidth,
                          background: isOverdue
                            ? `repeating-linear-gradient(45deg,${style.bar},${style.bar} 4px,${style.bar}cc 4px,${style.bar}cc 8px)`
                            : style.bar,
                          boxShadow: `0 2px 8px ${style.bar}30`,
                        }}>
                        {barWidth > 40 && (
                          <span className="text-white text-[9px] font-bold truncate">{p.title}</span>
                        )}
                      </div>
                      {phaseBars}
                    </div>
                  );
                })}
                {/* Today marker */}
                <div className="absolute top-0 w-px h-full bg-red-400 z-10" style={{ left: todayOffset + 16 }}>
                  <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-400 shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
