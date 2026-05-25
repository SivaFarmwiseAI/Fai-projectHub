"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Paintbrush,
  Paperclip,
  PenTool,
  Plus,
  Code as CodeIcon,
  Link as LinkIcon,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  phases as phasesApi,
  tasks as tasksApi,
  type PhaseRevision,
  type RevisionAttachment,
  type TaskRevision,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

import { AddRevisionDialog } from "./add-revision-dialog";

type Entity = "phase" | "task";

type AnyRevision = PhaseRevision | TaskRevision;

type Props = {
  entity: Entity;
  entityId: string;
  entityLabel?: string;
  /** Tone of the embedded panel — phase cards use indigo, task cards use slate. */
  accent?: "indigo" | "slate";
};

export function RevisionHistory({
  entity,
  entityId,
  entityLabel,
  accent = "indigo",
}: Props) {
  const [revisions, setRevisions] = useState<AnyRevision[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const r =
          entity === "phase"
            ? await phasesApi.revisions(entityId)
            : await tasksApi.revisions(entityId);
        setRevisions(r.revisions ?? []);
      } catch (err) {
        showToast.error(
          "Could not load history",
          err instanceof Error ? err.message : "Please try again",
        );
        setRevisions([]);
      } finally {
        setLoading(false);
      }
    },
    [entity, entityId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleAdded = (rev: AnyRevision) => {
    setRevisions((prev) => (prev ? [rev, ...prev] : [rev]));
  };

  const recent = (revisions ?? []).slice(0, 3);
  const hasMore = (revisions?.length ?? 0) > recent.length;
  const accentClass =
    accent === "indigo"
      ? "border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 to-white"
      : "border-slate-200 bg-slate-50/60";

  return (
    <>
      <div
        className={`rounded-xl border ${accentClass} p-3 space-y-3`}
        data-revision-history
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            <History className="h-3.5 w-3.5" />
            Revision history
            {revisions && revisions.length > 0 && (
              <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium text-slate-600 normal-case tracking-normal">
                {revisions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setDrawerOpen(true)}
            >
              View all
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Revise
            </Button>
          </div>
        </div>

        {loading && !revisions ? (
          <RevisionSkeleton />
        ) : recent.length === 0 ? (
          <EmptyState
            message="No revisions yet."
            onAdd={() => setAddOpen(true)}
          />
        ) : (
          <ol className="space-y-2.5">
            {recent.map((rev) => (
              <RevisionRow key={rev.id} rev={rev} compact />
            ))}
            {hasMore && (
              <li>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  + {(revisions?.length ?? 0) - recent.length} earlier
                  revision{(revisions?.length ?? 0) - recent.length === 1 ? "" : "s"}
                </button>
              </li>
            )}
          </ol>
        )}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {entityLabel ? `History · ${entityLabel}` : "Revision history"}
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {revisions?.length ?? 0} revision
                {(revisions?.length ?? 0) === 1 ? "" : "s"} · most recent first
              </p>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Revise
              </Button>
            </div>
            {(revisions ?? []).length === 0 ? (
              <EmptyState
                message="No history captured yet. Use Revise to log your first change or closure."
              />
            ) : (
              <ol className="relative ml-3 border-l border-slate-200 pl-5 space-y-5">
                {(revisions ?? []).map((rev) => (
                  <li key={rev.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-indigo-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    </span>
                    <RevisionRow rev={rev} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddRevisionDialog
        entity={entity}
        entityId={entityId}
        entityLabel={entityLabel}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={handleAdded}
      />
    </>
  );
}

function RevisionSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-slate-100/80"
        />
      ))}
    </div>
  );
}

function EmptyState({
  message,
  onAdd,
}: {
  message: string;
  onAdd?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center">
      <p className="text-xs text-slate-500">{message}</p>
      {onAdd && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 text-xs text-indigo-600 hover:text-indigo-800"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add the first revision
        </Button>
      )}
    </div>
  );
}

function RevisionRow({ rev, compact }: { rev: AnyRevision; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ChangeTypeBadge type={rev.change_type} />
        <span className="text-sm font-medium text-slate-900">{rev.summary}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        <Clock className="h-3 w-3" />
        {formatTime(rev.created_at)}
        {rev.author_name && (
          <>
            <span>·</span>
            <span className="font-medium text-slate-700">{rev.author_name}</span>
          </>
        )}
      </div>
      {!compact && rev.details && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {rev.details}
        </p>
      )}
      {!compact && (rev.previous_value || rev.new_value) && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
          {rev.previous_value && (
            <div className="rounded-md bg-rose-50/70 px-2 py-1 text-rose-800">
              <span className="font-semibold">Before:</span> {rev.previous_value}
            </div>
          )}
          {rev.new_value && (
            <div className="rounded-md bg-emerald-50/70 px-2 py-1 text-emerald-800">
              <span className="font-semibold">After:</span> {rev.new_value}
            </div>
          )}
        </div>
      )}
      {rev.attachments && rev.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rev.attachments.map((a) => (
            <AttachmentChip key={a.id} att={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    revision:         { label: "Revision",   cls: "bg-indigo-100 text-indigo-700" },
    status_change:    { label: "Status",     cls: "bg-amber-100 text-amber-800" },
    closure:          { label: "Closure",    cls: "bg-emerald-100 text-emerald-800" },
    description_edit: { label: "Edit",       cls: "bg-sky-100 text-sky-800" },
    note:             { label: "Note",       cls: "bg-slate-100 text-slate-700" },
  };
  const m = map[type] ?? { label: type, cls: "bg-slate-100 text-slate-700" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.cls}`}
    >
      <Tag className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function AttachmentChip({ att }: { att: RevisionAttachment }) {
  const Icon = iconForType(att.type);
  const href = att.url;
  const inner = (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[160px]">{att.title}</span>
      {href && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block max-w-full">
      {inner}
    </a>
  );
}

function iconForType(type: string) {
  switch (type) {
    case "repo":
      return GitBranch;
    case "figma":
      return PenTool;
    case "design":
      return Paintbrush;
    case "document":
      return FileText;
    case "code":
      return CodeIcon;
    case "url":
    default:
      return LinkIcon;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export { Paperclip };
