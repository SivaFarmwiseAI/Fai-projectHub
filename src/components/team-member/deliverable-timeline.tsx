"use client";

/** Deliverable Timeline — week/month calendar + planned-vs-actual Gantt bars +
 *  selected-day deliverable cards. Extracted from the team member page. */

import React from "react";
import Link from "next/link";
import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Eye, GanttChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTimelineBarColor,
  getTimelineStatusLabel,
  type TimelineItem,
} from "./derive";
import { deliverableTypeIcons, deliverableTypeLabels } from "./shared";

/** The window (or single selected day) the timeline is currently showing —
 *  published so sibling sections (e.g. the evidence table) can follow it. */
export type TimelineScope = {
  start: Date;
  end: Date;
  label: string;
  day: Date | null;
};

export function DeliverableTimeline({
  items,
  onScopeChange,
}: {
  items: TimelineItem[];
  onScopeChange?: (scope: TimelineScope) => void;
}) {
  const [viewMode, setViewMode] = React.useState<"week" | "month">("month");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  const timelineItems = items;

  // Navigation — moving the window always clears the day selection so the
  // list below falls back to "everything in view".
  const goForward = () => {
    setCurrentDate((d) => (viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
    setSelectedDate(null);
  };
  const goBackward = () => {
    setCurrentDate((d) => (viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
    setSelectedDate(null);
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };
  // Clicking a day selects it; clicking it again unselects (back to all).
  const toggleDate = (day: Date) =>
    setSelectedDate((prev) => (prev && isSameDay(prev, day) ? null : day));

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

  const getDueItemsForDay = (day: Date) => {
    return timelineItems.filter((item) => {
      return isSameDay(item.plannedEnd, day) || (item.actualEnd && isSameDay(item.actualEnd, day));
    });
  };

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

  // One active scope drives BOTH the detail list and the summary tiles:
  // a selected day narrows to that day; otherwise everything in the window.
  const windowLabel =
    viewMode === "week"
      ? `${format(calendarStart, "MMM d")} – ${format(calendarEnd, "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");
  const activeItems = (selectedDate
    ? getDueItemsForDay(selectedDate)
    : visibleItems
  ).slice().sort((a, b) => a.plannedEnd.getTime() - b.plannedEnd.getTime());
  // The Gantt follows the same scope: selected day only, else the window.
  const ganttItems = selectedDate ? activeItems : visibleItems;

  // Publish the active scope so sibling sections stay in sync.
  const scopeStart = (selectedDate ? startOfDay(selectedDate) : calendarStart).getTime();
  const scopeEnd = (selectedDate ? endOfDay(selectedDate) : calendarEnd).getTime();
  const scopeLabel = selectedDate
    ? format(selectedDate, "EEE, MMM d, yyyy")
    : windowLabel;
  const selectedMs = selectedDate?.getTime() ?? null;
  React.useEffect(() => {
    onScopeChange?.({
      start: new Date(scopeStart),
      end: new Date(scopeEnd),
      label: scopeLabel,
      day: selectedMs === null ? null : new Date(selectedMs),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStart, scopeEnd, scopeLabel, selectedMs]);

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
                onClick={() => {
                  setViewMode("week");
                  setSelectedDate(null);
                }}
              >
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode("month");
                  setSelectedDate(null);
                }}
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
                    onClick={() => toggleDate(day)}
                    title={isSelected ? "Click again to show the whole period" : undefined}
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
                              title={`${item.milestoneTitle} (${getTimelineStatusLabel(item.status)})`}
                            >
                              {deliverableTypeIcons[item.deliverableType] || "✅"} {item.milestoneTitle.slice(0, 12)}
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

          {/* B) Gantt-style Timeline View — follows the day selection */}
          {ganttItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Planned vs Actual Timeline
                <span className="text-[11px] font-normal text-muted-foreground">
                  {selectedDate
                    ? `${format(selectedDate, "MMM d")} only · ${ganttItems.length} item${ganttItems.length === 1 ? "" : "s"}`
                    : `${ganttItems.length} item${ganttItems.length === 1 ? "" : "s"} in view`}
                </span>
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
                {ganttItems.map((item) => {
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
                        <span className="text-sm">{deliverableTypeIcons[item.deliverableType] || "✅"}</span>
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
                            {getTimelineStatusLabel(item.status)}
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

          {/* C) Deliverable cards — the selected day, or the whole window */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-500" />
                {selectedDate
                  ? `Deliverables for ${format(selectedDate, "EEEE, MMM d, yyyy")}`
                  : `All deliverables · ${windowLabel}`}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {activeItems.length} item{activeItems.length === 1 ? "" : "s"}
                </span>
              </h3>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  Show whole {viewMode} ×
                </button>
              )}
            </div>

            {activeItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                {selectedDate
                  ? "No deliverables due on this date — click the day again to see the whole period."
                  : `No deliverables in ${windowLabel}.`}
              </div>
            ) : (
              <div className="space-y-2">
                {activeItems.map((item) => {
                    const colors = getTimelineBarColor(item.status);
                    return (
                      <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{deliverableTypeIcons[item.deliverableType] || "✅"}</span>
                            <span className="font-medium text-sm">{item.milestoneTitle}</span>
                            <Badge variant="outline" className={colors.badge}>
                              {getTimelineStatusLabel(item.status)}
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

          {/* Summary stats — follow the same scope as the list above */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-200">
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-bold text-slate-700">{activeItems.length}</p>
              <p className="text-xs text-muted-foreground">
                {selectedDate ? "Due This Day" : "Total in View"}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50">
              <p className="text-lg font-bold text-green-700">
                {activeItems.filter((i) => i.status === "completed_on_time").length}
              </p>
              <p className="text-xs text-muted-foreground">On Time</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-50">
              <p className="text-lg font-bold text-amber-700">
                {activeItems.filter((i) => i.status === "completed_late").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed Late</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50">
              <p className="text-lg font-bold text-blue-700">
                {activeItems.filter((i) => i.status === "in_progress").length}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50">
              <p className="text-lg font-bold text-red-700">
                {activeItems.filter((i) => i.status === "overdue").length}
              </p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
