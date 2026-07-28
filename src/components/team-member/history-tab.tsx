"use client";

/** History tab — objective work-history feed, deadline extensions and leave
 *  history (with the leave analytics toggle). */

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Activity, AlertTriangle, ArrowRight, Calendar, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveAnalytics } from "@/components/leave-analytics";
import { WorkHistory } from "@/components/work-history";
import type { DeadlineExtension, LeaveRequest, Project, Task, User } from "@/lib/api-client";
import { extensionStatusColors, leaveStatusColors } from "./shared";

export function HistoryTab({
  user,
  tasks,
  leaves,
  projectById,
}: {
  user: User;
  tasks: Task[];
  leaves: LeaveRequest[];
  projectById: Record<string, Project>;
}) {
  const [showLeaveAnalytics, setShowLeaveAnalytics] = React.useState(false);
  const extensions: DeadlineExtension[] = tasks.flatMap((t) => t.deadline_extensions ?? []);

  return (
    <div className="space-y-8">
      {/* Work History & Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Work History &amp; Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkHistory subjectId={user.id} />
        </CardContent>
      </Card>

      {/* Deadline Extensions */}
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
              const project = projectById[ext.project_id];
              const task = tasks.find((t) => t.id === ext.task_id);
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

      {/* Leave History */}
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
          (() => {
            const LEAF_HEADER: Record<string, string> = {
              planned: "bg-blue-500",
              sick: "bg-red-500",
              personal: "bg-purple-500",
              wfh: "bg-teal-500",
              half_day: "bg-amber-500",
            };
            const TYPE_LABEL: Record<string, string> = {
              planned: "Planned leave",
              sick: "Sick leave",
              personal: "Personal leave",
              wfh: "Work from home",
              half_day: "Half day",
            };
            const approved = leaves.filter((l) => l.status === "approved");
            const approvedDays = approved.reduce((s, l) => s + (l.days ?? 1), 0);
            const rejected = leaves.filter((l) => l.status === "rejected").length;
            const pending = leaves.filter((l) => l.status === "pending").length;
            const sorted = [...leaves].sort(
              (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
            );
            return (
              <Card>
                {/* Summary strip — the year at a glance */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-slate-100 px-5 py-3 text-[11px] text-slate-600">
                  <span>
                    <span className="stat-number font-extrabold text-slate-900">{approvedDays}</span>{" "}
                    day{approvedDays === 1 ? "" : "s"} taken
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-bold tabular-nums">{approved.length}</span> approved
                  </span>
                  {pending > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-bold tabular-nums">{pending}</span> pending
                    </span>
                  )}
                  {rejected > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="font-bold tabular-nums">{rejected}</span> rejected
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {leaves.length} request{leaves.length === 1 ? "" : "s"}
                  </span>
                </div>

                <CardContent className="px-5 py-1 divide-y divide-slate-100">
                  {sorted.map((leave) => {
                    const start = new Date(leave.start_date);
                    const coverNames =
                      leave.cover_person_names?.length
                        ? leave.cover_person_names
                        : leave.cover_person_name
                          ? [leave.cover_person_name]
                          : [];
                    return (
                      <div key={leave.id} className="flex items-center gap-4 py-3.5">
                        {/* Calendar leaf */}
                        <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm">
                          <div
                            className={`${LEAF_HEADER[leave.type] ?? "bg-slate-400"} py-0.5 text-[9px] font-bold uppercase tracking-wider text-white`}
                          >
                            {format(start, "MMM")}
                          </div>
                          <div className="stat-number py-0.5 text-lg font-extrabold text-slate-900">
                            {format(start, "d")}
                          </div>
                        </div>

                        {/* What & why */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {TYPE_LABEL[leave.type] ?? leave.type.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {leave.days ?? 1} {(leave.days ?? 1) === 1 ? "day" : "days"}
                            </span>
                            {leave.is_planned === false && leave.type !== "sick" && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[9px] font-semibold text-amber-700">
                                unplanned
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {leave.start_date === leave.end_date
                              ? format(start, "EEEE, MMM d yyyy")
                              : `${format(start, "MMM d")} – ${format(new Date(leave.end_date), "MMM d, yyyy")}`}
                            {leave.reason?.trim() ? ` · ${leave.reason}` : ""}
                          </p>
                          {(leave.status === "rejected" ||
                            coverNames.length > 0 ||
                            (leave.status === "approved" && leave.approved_by_name)) && (
                            <p className="mt-0.5 text-[11px] truncate">
                              {leave.status === "rejected" ? (
                                <span className="text-red-600">
                                  {leave.rejection_reason?.trim()
                                    ? `Rejected — ${leave.rejection_reason}`
                                    : "Rejected"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {[
                                    coverNames.length > 0 ? `Covered by ${coverNames.join(", ")}` : null,
                                    leave.status === "approved" && leave.approved_by_name
                                      ? `Approved by ${leave.approved_by_name}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        <Badge
                          variant="outline"
                          className={`shrink-0 capitalize ${leaveStatusColors[leave.status] || ""}`}
                        >
                          {leave.status}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()
        )}
      </div>
    </div>
  );
}
