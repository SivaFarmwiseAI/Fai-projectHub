"use client";

import { useState, useEffect, useMemo } from "react";
import {
  parseISO,
  differenceInCalendarDays,
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  isAfter,
  isBefore,
  isWithinInterval,
} from "date-fns";
import { Eye, X, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { leave as leaveApi } from "@/lib/api-client";
import type { LeaveRequest, LeaveAnalytics as LeaveAnalyticsSummary } from "@/lib/api-client";

interface LeaveAnalyticsProps {
  userId: string;
  onClose: () => void;
}

const FY_START = new Date(2025, 3, 1);
const FY_END   = new Date(2026, 2, 31);

const TYPE_LABELS: Record<string, string> = {
  planned: "Planned Leave",
  sick: "Sick Leave",
  personal: "Personal Leave",
  wfh: "Work from Home",
  half_day: "Half Day",
};

const TYPE_COLORS: Record<string, string> = {
  planned: "#3b82f6", sick: "#ef4444", personal: "#f59e0b",
  wfh: "#10b981", half_day: "#8b5cf6",
};

function isInFY(leave: LeaveRequest): boolean {
  const start = parseISO(leave.start_date);
  return isWithinInterval(start, { start: FY_START, end: FY_END });
}

function isUnplanned(leave: LeaveRequest): boolean {
  const created = parseISO(leave.created_at);
  const start   = parseISO(leave.start_date);
  return differenceInCalendarDays(start, created) <= 1;
}

export function LeaveAnalytics({ userId, onClose }: LeaveAnalyticsProps) {
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [teamSummary, setTeamSummary] = useState<LeaveAnalyticsSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      leaveApi.list({ user_id: userId }).then(r => setAllLeaves(r.leave)).catch(() => {}),
      leaveApi.analytics().then(r => setTeamSummary(r.analytics)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [userId]);

  const userName = allLeaves[0]?.user_name ?? "Unknown";

  const fyLeaves = useMemo(() => allLeaves.filter(isInFY), [allLeaves]);

  const breakdown = useMemo(() => {
    const result: Record<string, { days: number; count: number; reasons: string[] }> = {
      planned: { days: 0, count: 0, reasons: [] },
      sick:    { days: 0, count: 0, reasons: [] },
      personal:{ days: 0, count: 0, reasons: [] },
      wfh:     { days: 0, count: 0, reasons: [] },
      half_day:{ days: 0, count: 0, reasons: [] },
    };
    for (const l of fyLeaves) {
      const key = l.type as string;
      if (!result[key]) result[key] = { days: 0, count: 0, reasons: [] };
      result[key].days += l.days;
      result[key].count += 1;
      if (l.reason && !result[key].reasons.includes(l.reason)) result[key].reasons.push(l.reason);
    }
    return result;
  }, [fyLeaves]);

  const totalDaysOff  = fyLeaves.filter(l => l.type !== "wfh").reduce((s, l) => s + l.days, 0);
  const totalWfh      = breakdown.wfh?.days ?? 0;
  const totalLeaves   = fyLeaves.filter(l => l.type !== "wfh").length;

  const nonWfhLeaves  = fyLeaves.filter(l => l.type !== "wfh");
  const unplannedLeaves = nonWfhLeaves.filter(isUnplanned);
  const unplannedDays   = unplannedLeaves.reduce((s, l) => s + l.days, 0);
  const unplannedPct    = totalDaysOff > 0 ? Math.round((unplannedDays / totalDaysOff) * 100) : 0;
  const lastMinuteLeaves = nonWfhLeaves.filter(l =>
    differenceInCalendarDays(parseISO(l.start_date), parseISO(l.created_at)) === 0
  );

  const monthlyPattern = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const ref    = subMonths(now, 2 - i);
      const mStart = startOfMonth(ref);
      const mEnd   = endOfMonth(ref);
      const days   = fyLeaves
        .filter(l => l.type !== "wfh" && !isBefore(parseISO(l.start_date), mStart) && !isAfter(parseISO(l.start_date), mEnd))
        .reduce((s, l) => s + l.days, 0);
      return { label: format(ref, "MMMM"), days };
    });
  }, [fyLeaves]);

  const teamAvg = useMemo(() => {
    if (!teamSummary.length) return 0;
    const total = teamSummary.reduce((s, u) => s + (u.total_leave_days - (u.wfh_days ?? 0)), 0);
    return Math.round((total / teamSummary.length) * 10) / 10;
  }, [teamSummary]);

  const insights = useMemo(() => {
    const msgs: { type: "warning" | "info" | "positive"; text: string }[] = [];
    if (breakdown.sick?.count >= 3) {
      msgs.push({ type: "warning", text: `${breakdown.sick.count} sick leave instances this year — frequent pattern, may need attention.` });
    } else if (breakdown.sick?.count >= 2) {
      msgs.push({ type: "info", text: `${breakdown.sick.count} sick leaves taken — within normal range.` });
    }
    if (unplannedPct > 50) {
      msgs.push({ type: "warning", text: `${unplannedPct}% of leaves were unplanned (requested same day or day before). This is high.` });
    } else if (unplannedPct > 25) {
      msgs.push({ type: "info", text: `${unplannedPct}% of leaves were unplanned — moderate, could be improved.` });
    } else if (totalLeaves > 0) {
      msgs.push({ type: "positive", text: "Most leaves were planned well in advance. Good planning discipline." });
    }
    if (lastMinuteLeaves.length > 0) {
      msgs.push({ type: "warning", text: `${lastMinuteLeaves.length} same-day leave request${lastMinuteLeaves.length > 1 ? "s" : ""} — applied on the day itself.` });
    }
    if (totalDaysOff > teamAvg + 3) {
      msgs.push({ type: "warning", text: `Total ${totalDaysOff} days off is above team average of ${teamAvg} days.` });
    } else if (totalDaysOff <= teamAvg) {
      msgs.push({ type: "positive", text: `Total ${totalDaysOff} days off is at or below team average (${teamAvg} days).` });
    }
    if (totalWfh >= 3) {
      msgs.push({ type: "info", text: `${totalWfh} WFH days this year. Consider if a regular WFH day would help.` });
    }
    return msgs.slice(0, 5);
  }, [breakdown, unplannedPct, lastMinuteLeaves, totalDaysOff, totalLeaves, totalWfh, teamAvg]);

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/30 to-white shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold">Leave Summary — {userName}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">Financial Year: Apr 2025 – Mar 2026</p>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Charts */}
            {fyLeaves.length > 0 && (() => {
              const pieData = Object.entries(breakdown)
                .filter(([, v]) => v.days > 0)
                .map(([type, v]) => ({ name: TYPE_LABELS[type] ?? type, value: v.days, color: TYPE_COLORS[type] ?? "#94a3b8" }));

              const now = new Date();
              const barData = Array.from({ length: 6 }, (_, i) => {
                const ref    = subMonths(now, 5 - i);
                const mStart = startOfMonth(ref);
                const mEnd   = endOfMonth(ref);
                const days   = fyLeaves
                  .filter(l => { const s = parseISO(l.start_date); return !isBefore(s, mStart) && !isAfter(s, mEnd); })
                  .reduce((s, l) => s + l.days, 0);
                return { month: format(ref, "MMM"), days };
              });

              return (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">By Type (days)</p>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%"
                            innerRadius={28} outerRadius={50} paddingAngle={3}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [`${v}d`, ""]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                      {pieData.map(d => (
                        <span key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Monthly (days)</p>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                          <Tooltip formatter={(v) => [`${v}d`, "Days"]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                          <Bar dataKey="days" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Overall Numbers */}
            <div className="bg-white border border-gray-100 rounded-lg p-3 space-y-1.5">
              <p className="text-sm">
                <span className="font-semibold">{totalDaysOff} day{totalDaysOff !== 1 ? "s" : ""}</span> off this year
                {totalWfh > 0 && <span className="text-teal-600"> + {totalWfh} WFH day{totalWfh !== 1 ? "s" : ""}</span>}
              </p>
              {teamAvg > 0 && (
                <p className="text-xs text-muted-foreground">
                  Team average: {teamAvg} days off
                  {totalDaysOff > teamAvg + 2 && <span className="text-red-600 font-medium"> (above average)</span>}
                  {totalDaysOff <= teamAvg && <span className="text-green-600 font-medium"> (at or below average)</span>}
                </p>
              )}
            </div>

            <Separator className="bg-gray-100" />

            {/* Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Breakdown</h4>
              {Object.entries(breakdown).filter(([, v]) => v.count > 0).map(([type, v]) => (
                <div key={type} className="text-sm space-y-0.5">
                  <p>
                    <span className="font-medium" style={{ color: TYPE_COLORS[type] ?? "#64748b" }}>
                      {TYPE_LABELS[type] ?? type}:
                    </span>{" "}
                    {v.days} day{v.days !== 1 ? "s" : ""} ({v.count} time{v.count !== 1 ? "s" : ""})
                  </p>
                  {v.reasons.length > 0 && (
                    <p className="text-xs text-muted-foreground pl-3">Reasons: {v.reasons.join(", ")}</p>
                  )}
                </div>
              ))}
              {fyLeaves.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No leaves taken this financial year.</p>
              )}
            </div>

            <Separator className="bg-gray-100" />

            {/* Planning pattern */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Planning Pattern</h4>
              {totalLeaves > 0 ? (
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Unplanned leaves:</span>{" "}
                    {unplannedLeaves.length} of {totalLeaves}
                    <span className={`ml-1.5 text-xs font-medium ${
                      unplannedPct > 50 ? "text-red-600" : unplannedPct > 25 ? "text-amber-600" : "text-green-600"
                    }`}>({unplannedPct}%)</span>
                  </p>
                  {lastMinuteLeaves.length > 0 && (
                    <p className="text-xs text-red-600">
                      {lastMinuteLeaves.length} leave{lastMinuteLeaves.length !== 1 ? "s" : ""} applied on the same day
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No non-WFH leaves to analyze.</p>
              )}
            </div>

            <Separator className="bg-gray-100" />

            {/* Last 3 months */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last 3 Months</h4>
              <div className="text-sm text-muted-foreground">
                {monthlyPattern.map(m => (
                  <span key={m.label} className="inline-block mr-3">
                    <span className="font-medium text-gray-700">{m.label}:</span>{" "}
                    {m.days > 0 ? `${m.days} day${m.days !== 1 ? "s" : ""} off` : "none"}
                  </span>
                ))}
              </div>
            </div>

            <Separator className="bg-gray-100" />

            {/* Insights */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Insights</h4>
              </div>
              <div className="space-y-1">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {ins.type === "warning"  && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                    {ins.type === "info"     && <span className="h-3.5 w-3.5 shrink-0 mt-0.5 flex items-center justify-center text-amber-500 font-bold text-[10px]">i</span>}
                    {ins.type === "positive" && <span className="h-3.5 w-3.5 shrink-0 mt-0.5 flex items-center justify-center text-green-500 font-bold text-[10px]">✓</span>}
                    <span className={ins.type === "warning" ? "text-red-700" : ins.type === "positive" ? "text-green-700" : "text-gray-600"}>
                      {ins.text}
                    </span>
                  </div>
                ))}
                {insights.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Not enough data for insights.</p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
