"use client";

/** Evidence & Timeline tab — the deliverable calendar/Gantt plus a flat,
 *  sortable table of every deliverable evidence row ("show me the artifact"). */

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, FileSearch, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliverableTimeline } from "./deliverable-timeline";
import type { EvidenceRow, TimelineItem } from "./derive";
import {
  deliverableStatusColors,
  deliverableTypeIcons,
  deliverableTypeLabels,
} from "./shared";

export function EvidenceTab({
  timelineItems,
  evidenceRows,
}: {
  timelineItems: TimelineItem[];
  evidenceRows: EvidenceRow[];
}) {
  return (
    <div className="space-y-6">
      <DeliverableTimeline items={timelineItems} />

      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-blue-600" />
            All Deliverable Evidence
            <span className="text-[11px] font-normal text-muted-foreground">
              {evidenceRows.length} record{evidenceRows.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {evidenceRows.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-500">No deliverables submitted yet</p>
              <p className="text-xs text-muted-foreground">
                Evidence recorded when completing tasks and milestones appears here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-medium">Deliverable</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Milestone / Task</th>
                    <th className="text-left py-2 px-3 font-medium">Project</th>
                    <th className="text-right py-2 pl-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceRows.map(({ deliverable: d, milestoneTitle, taskId, taskTitle, projectId, projectTitle }) => {
                    const href = d.document_url || d.code_pr_url || d.code_repo_url;
                    const when = d.submitted_at ?? d.created_at;
                    return (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="py-2 pr-3">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline"
                            >
                              <span>{deliverableTypeIcons[d.type] || "📎"}</span>
                              <span className="truncate max-w-[220px]">{d.title}</span>
                              <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                              <span>{deliverableTypeIcons[d.type] || "📎"}</span>
                              <span className="truncate max-w-[220px]" title={d.text_content ?? undefined}>
                                {d.title}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-600">
                          {deliverableTypeLabels[d.type] || d.type}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={`text-[10px] ${deliverableStatusColors[d.status] || ""}`}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-600">
                          <Link
                            href={`/projects/${projectId}?tab=tasks&task=${taskId}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {milestoneTitle ?? taskTitle}
                          </Link>
                          {milestoneTitle && (
                            <span className="block text-[10px] text-muted-foreground truncate max-w-[180px]">
                              {taskTitle}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Link href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
                            {projectTitle}
                          </Link>
                        </td>
                        <td className="py-2 pl-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {when ? format(new Date(when), "MMM d, yyyy") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
