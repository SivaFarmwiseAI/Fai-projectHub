"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  CalendarDays, ZoomIn, ZoomOut,
  AlertTriangle, CheckCircle2, Clock, Pause, XCircle,
  ExternalLink, Loader2,
} from "lucide-react";
import { projects as projectsApi } from "@/lib/api-client";
import type { Project } from "@/lib/api-client";

function getDaysRemaining(startDate: string | undefined, timeboxDays: number): number {
  if (!startDate) return 0;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeboxDays);
  return Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLES: Record<string, { bar: string; text: string; icon: React.ElementType }> = {
  active:    { bar: "#3b82f6", text: "#1d4ed8", icon: Clock },
  completed: { bar: "#10b981", text: "#065f46", icon: CheckCircle2 },
  paused:    { bar: "#f59e0b", text: "#92400e", icon: Pause },
  killed:    { bar: "#ef4444", text: "#991b1b", icon: XCircle },
};

const TYPE_COLORS: Record<string, string> = {
  engineering: "#3b82f6", data_science: "#8b5cf6", design: "#ec4899",
  research: "#06b6d4", marketing: "#f59e0b", strategy: "#10b981",
  operations: "#6366f1", hr: "#f97316", finance: "#84cc16",
  product: "#14b8a6", legal: "#a855f7", sales: "#ef4444", mixed: "#64748b",
};

export function GanttClient() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayWidth, setDayWidth]       = useState(28);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsApi.list({ limit: 100 }).then(r => setProjectList(r.projects)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const today = new Date();

  // Only include projects with a start_date
  const datable = projectList.filter(p => p.start_date);

  const filtered = datable.filter(p => statusFilter === "all" || p.status === statusFilter);

  // Timeline bounds
  const allStarts = datable.map(p => new Date(p.start_date!));
  const allEnds   = datable.map(p => addDays(p.start_date!, p.timebox_days));
  const rawMin = allStarts.length ? new Date(Math.min(...allStarts.map(d => d.getTime()))) : new Date();
  const rawMax = allEnds.length   ? new Date(Math.max(...allEnds.map(d => d.getTime())))   : new Date();
  rawMin.setDate(rawMin.getDate() - 7);
  rawMax.setDate(rawMax.getDate() + 7);
  const minDate  = rawMin;
  const maxDate  = rawMax;
  const totalDays = daysBetween(minDate, maxDate);

  const weekTicks: { label: string; offset: number }[] = [];
  const cursor = new Date(minDate);
  while (cursor <= maxDate) {
    weekTicks.push({ label: formatDate(cursor), offset: daysBetween(minDate, cursor) * dayWidth });
    cursor.setDate(cursor.getDate() + 7);
  }

  const todayOffset = daysBetween(minDate, today) * dayWidth;

  function zoom(delta: number) {
    setDayWidth(prev => Math.min(60, Math.max(14, prev + delta)));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Project Timeline</h1>
          </div>
          <p className="text-sm text-slate-500">Cross-project Gantt view · {filtered.length} projects</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {["all", "active", "completed", "paused", "killed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === s ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => zoom(-6)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-slate-600 px-1">{dayWidth}px/d</span>
            <button onClick={() => zoom(6)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex">
            {/* Frozen left panel */}
            <div className="w-56 shrink-0 border-r border-slate-100 z-10 bg-white">
              <div className="h-10 flex items-center px-4 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</span>
              </div>
              {filtered.map(p => {
                const style = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
                const Icon = style.icon;
                const daysLeft = getDaysRemaining(p.start_date, p.timebox_days);
                return (
                  <div key={p.id}
                    className="h-16 flex items-center px-4 border-b border-slate-50 hover:bg-slate-50/60 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon className="h-3 w-3 shrink-0" style={{ color: style.bar }} />
                        <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{p.title}</p>
                      </div>
                      {p.owner_name && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                            style={{ background: p.owner_avatar_color ?? "#999" }}>
                            {p.owner_name.charAt(0)}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate">{p.owner_name}</span>
                        </div>
                      )}
                      <div className={`text-[10px] font-medium mt-0.5 ${daysLeft < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </div>
                    </div>
                    <Link href={`/projects/${p.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Scrollable timeline */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-200">
              <div style={{ width: totalDays * dayWidth + 32, minWidth: "100%" }}>
                {/* Date header */}
                <div className="h-10 relative border-b border-slate-100 bg-slate-50">
                  {weekTicks.map((tick, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center"
                      style={{ left: tick.offset + 16 }}>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{tick.label}</span>
                      <div className="absolute top-0 left-0 w-px h-full bg-slate-200 opacity-60" />
                    </div>
                  ))}
                </div>

                {/* Project rows */}
                {filtered.map(p => {
                  const start    = new Date(p.start_date!);
                  const end      = addDays(p.start_date!, p.timebox_days);
                  const barStart = daysBetween(minDate, start) * dayWidth + 16;
                  const barWidth = Math.max(daysBetween(start, end) * dayWidth, 60);
                  const style    = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
                  const catColor = TYPE_COLORS[p.type] ?? "#3b82f6";
                  const isOverdue = end < today && p.status === "active";

                  const phaseBars = (p.phases ?? []).map((ph, phIdx) => {
                    if (!ph.start_date || !ph.end_date) return null;
                    const phStart = daysBetween(minDate, new Date(ph.start_date)) * dayWidth + 16;
                    const phWidth = Math.max(daysBetween(new Date(ph.start_date), new Date(ph.end_date)) * dayWidth, 20);
                    const phColors: Record<string, string> = {
                      completed: "#10b981", active: catColor, in_discussion: "#f59e0b", pending: "#e2e8f0",
                    };
                    return (
                      <div key={phIdx} className="absolute bottom-1 h-2 rounded-full opacity-60"
                        style={{ left: phStart, width: phWidth, background: phColors[ph.status] ?? "#e2e8f0" }}
                        title={`${ph.phase_name} (${ph.status})`}
                      />
                    );
                  }).filter(Boolean);

                  return (
                    <div key={p.id} className="h-16 relative border-b border-slate-50 hover:bg-blue-50/20 transition-colors">
                      {weekTicks.map((tick, i) => (
                        <div key={i} className="absolute top-0 w-px h-full bg-slate-100 opacity-60"
                          style={{ left: tick.offset + 16 }} />
                      ))}
                      <div className="absolute top-4 h-8 rounded-xl flex items-center px-3 cursor-pointer transition-all hover:brightness-95 hover:scale-y-105"
                        style={{
                          left: barStart,
                          width: barWidth,
                          background: isOverdue
                            ? `repeating-linear-gradient(45deg,${style.bar},${style.bar} 4px,${style.bar}cc 4px,${style.bar}cc 8px)`
                            : style.bar,
                          boxShadow: `0 2px 8px ${style.bar}40`,
                        }}>
                        <span className="text-white text-[10px] font-semibold truncate">{p.title}</span>
                        {isOverdue && (
                          <AlertTriangle className="h-3 w-3 text-white ml-auto shrink-0 opacity-90" />
                        )}
                      </div>
                      {phaseBars}
                      <div className="absolute top-0 w-0.5 h-full bg-red-400 opacity-70 z-10"
                        style={{ left: todayOffset + 16 }}>
                        <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
