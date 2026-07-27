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
import { extensionStatusColors, leaveStatusColors, leaveTypeColors } from "./shared";

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
    </div>
  );
}
