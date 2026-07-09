"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  GitBranch,
  PenTool,
  Paintbrush,
  Code as CodeIcon,
  Link as LinkIcon,
} from "lucide-react";

import { tasks as tasksApi, type MilestoneAttachment } from "@/lib/api-client";

/**
 * MilestoneLinks — shows the links/files attached to a milestone (kanban detail
 * sheet, project milestone tab, individual dashboard).
 *
 * Pasted links / uploaded files are persisted as milestone *revision*
 * attachments (`addMilestoneRevision`), so they only reach the milestone JSON
 * once the backend's `fn_task_full` aggregates them (migration 022). To stay
 * functional BEFORE that deploy, this component:
 *   - uses `provided` (milestone.attachments from fn_task_full) when the backend
 *     already supplies it, otherwise
 *   - lazily fetches the milestone's revisions (an endpoint that already exists
 *     on the deployed backend) and flattens their attachments.
 */
function iconFor(type: string) {
  switch (type) {
    case "repo":
    case "code_repo":
      return GitBranch;
    case "figma":
      return PenTool;
    case "design":
      return Paintbrush;
    case "document":
    case "doc":
      return FileText;
    case "code":
      return CodeIcon;
    default:
      return LinkIcon;
  }
}

export function MilestoneLinks({
  taskId,
  milestoneId,
  provided,
  showHeader = true,
  className,
}: {
  taskId: string;
  milestoneId: string;
  /** milestone.attachments from fn_task_full, when the backend supplies it. */
  provided?: MilestoneAttachment[] | null;
  showHeader?: boolean;
  className?: string;
}) {
  const [fetched, setFetched] = useState<MilestoneAttachment[] | null>(null);

  // `undefined`/`null` means the backend didn't embed attachments yet → fetch.
  // An empty array means the backend answered "none" → trust it, don't fetch.
  const needFetch = provided == null;

  useEffect(() => {
    if (!needFetch) return;
    let alive = true;
    tasksApi
      .milestoneRevisions(taskId, milestoneId)
      .then((r) => {
        const atts: MilestoneAttachment[] = (r.revisions ?? [])
          .flatMap((rev) => rev.attachments ?? [])
          .filter((a) => a.url)
          .map((a) => ({
            id: a.id,
            title: a.title,
            type: a.type,
            url: a.url ?? null,
            created_at: a.created_at,
          }));
        if (alive) setFetched(atts);
      })
      .catch(() => {
        if (alive) setFetched([]);
      });
    return () => {
      alive = false;
    };
  }, [needFetch, taskId, milestoneId]);

  const links = (provided && provided.length ? provided : fetched ?? []).filter(
    (a) => a.url,
  );
  if (links.length === 0) return null;

  return (
    <div className={className}>
      {showHeader && (
        <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
          <LinkIcon className="h-3 w-3" /> Links &amp; files ({links.length})
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {links.map((a) => {
          const Icon = iconFor(a.type);
          return (
            <a
              key={a.id}
              href={a.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={a.title || a.url || undefined}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Icon className="h-3 w-3 shrink-0 text-blue-500" />
              <span className="truncate max-w-[180px] font-medium">
                {a.title || a.url}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
