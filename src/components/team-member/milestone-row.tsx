"use client";

/** Milestone detail row (status + outcome + evidence + progress) used in the
 *  Tasks & Outcomes tab of the team member view. */

import { format, formatDistanceToNow } from "date-fns";
import { Calendar, CheckCircle2, Clock, MessageSquare, Milestone, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserLink } from "@/components/user-link";
import { MilestoneLinks } from "@/components/milestone-links";
import type { TaskMilestone } from "@/lib/api-client";
import { classifyVerdict } from "./derive";
import {
  AttachmentPill,
  fmtHrs,
  milestoneStatusColors,
  milestoneStatusIcons,
  verdictMeta,
} from "./shared";

export function MilestoneRow({
  ms,
  subjectId,
  taskId,
}: {
  ms: TaskMilestone;
  subjectId: string;
  taskId: string;
}) {
  const mine = ms.assignee_id === subjectId;
  const dels = ms.deliverables ?? [];
  const updates = ms.updates ?? [];
  const est = ms.estimated_hours ?? 0;
  const act = ms.actual_hours ?? 0;
  const over = est > 0 && act > est;
  const hoursPct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : act > 0 ? 100 : 0;
  const statusCls = milestoneStatusColors[ms.status] || milestoneStatusColors.pending;
  const verdictKey = classifyVerdict(ms.outcome);
  const verdict = verdictMeta[verdictKey];

  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${mine ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-white"}`}>
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Milestone className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-800">{ms.title}</span>
          {mine ? (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-indigo-700 border-indigo-200 bg-indigo-100">
              Allotted
            </Badge>
          ) : ms.assignee_id ? (
            <UserLink userId={ms.assignee_id} className="text-[10px] text-slate-500">
              Another member →
            </UserLink>
          ) : null}
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${statusCls}`}>
          <span className="mr-1">{milestoneStatusIcons[ms.status]}</span>
          {ms.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* meta chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        {ms.target_date ? (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 font-medium">
            <Calendar className="h-2.5 w-2.5" /> {format(new Date(`${ms.target_date}T00:00:00`), "MMM d, yyyy")}
          </span>
        ) : ms.target_day != null ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 font-medium">
            <Calendar className="h-2.5 w-2.5" /> Day {ms.target_day}
          </span>
        ) : null}
        {ms.deliverable_type && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{ms.deliverable_type}</span>
        )}
        <span className={`inline-flex items-center gap-1 font-medium ${over ? "text-red-600" : "text-slate-500"}`}>
          <Clock className="h-2.5 w-2.5" /> {fmtHrs(act)} / {fmtHrs(est)}{over ? " · over" : ""}
        </span>
        {ms.completed_at && (
          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
            <CheckCircle2 className="h-2.5 w-2.5" /> {format(new Date(ms.completed_at), "MMM d")}
          </span>
        )}
      </div>

      {/* hours bar */}
      {(est > 0 || act > 0) && (
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${hoursPct}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
        </div>
      )}

      {/* outcome verdict + notes */}
      {(ms.outcome || ms.outcome_notes) && (
        <div className="rounded-md border border-green-200/70 bg-green-50/60 px-2 py-1.5">
          <p className="text-[11px] font-semibold text-green-800 flex items-center gap-1.5">
            Outcome:
            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${verdict.badge}`}>
              {verdictKey === "unclassified" ? ms.outcome : verdict.label}
            </Badge>
          </p>
          {ms.outcome_notes && <p className="text-[11px] text-green-700/90 whitespace-pre-wrap mt-0.5">{ms.outcome_notes}</p>}
        </div>
      )}

      {/* deliverables */}
      {dels.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            <Paperclip className="h-2.5 w-2.5" /> Deliverables ({dels.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dels.map((d) => <AttachmentPill key={d.id} d={d} />)}
          </div>
        </div>
      )}

      {/* links & files (pasted links / uploaded files) — fetches revision
          attachments when fn_task_full hasn't been deployed with them yet. */}
      <MilestoneLinks taskId={taskId} milestoneId={ms.id} provided={ms.attachments} />

      {/* latest update */}
      {updates.length > 0 && (
        <div className="border-t border-slate-100 pt-1.5">
          <p className="text-[11px] text-slate-600">
            <MessageSquare className="inline h-2.5 w-2.5 mr-1 text-slate-400" />
            {updates[updates.length - 1].message}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(updates[updates.length - 1].created_at), { addSuffix: true })}
            {updates.length > 1 ? ` · ${updates.length} updates` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
