"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Loader2,
  Paintbrush,
  Paperclip,
  PenTool,
  Plus,
  Code as CodeIcon,
  Link as LinkIcon,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfirm } from "@/components/confirm-provider";
import {
  phases as phasesApi,
  tasks as tasksApi,
  type MilestoneRevision,
  type PhaseRevision,
  type RevisionAttachment,
  type TaskRevision,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

import { AddRevisionDialog } from "./add-revision-dialog";

type Entity = "phase" | "task" | "milestone";

type AnyRevision = PhaseRevision | TaskRevision | MilestoneRevision;

type Props = {
  entity: Entity;
  entityId: string;
  /** Required when entity === "milestone": the parent task id. */
  parentId?: string;
  entityLabel?: string;
  /** Tone of the embedded panel — phase cards use indigo, task cards use slate. */
  accent?: "indigo" | "slate";
  /**
   * Render only inline action buttons (Revise · History) suitable for embedding
   * in a row header. The full timeline is still reachable via the drawer.
   */
  compact?: boolean;
};

export function RevisionHistory({
  entity,
  entityId,
  parentId,
  entityLabel,
  accent = "indigo",
  compact = false,
}: Props) {
  const [revisions, setRevisions] = useState<AnyRevision[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const confirm = useConfirm();
  /** In compact mode we only fetch the count up front so we don't hammer the API
   *  for every collapsed phase row. The full list is loaded lazily when needed. */
  const [loadedFull, setLoadedFull] = useState(false);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const r =
          entity === "phase"
            ? await phasesApi.revisions(entityId)
            : entity === "milestone"
              ? await tasksApi.milestoneRevisions(parentId ?? "", entityId)
              : await tasksApi.revisions(entityId);
        setRevisions(r.revisions ?? []);
        setLoadedFull(true);
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
    [entity, entityId, parentId],
  );

  useEffect(() => {
    if (compact) return; // panel mode loads eagerly; compact loads on demand
    load();
  }, [load, compact]);

  const ensureLoaded = () => {
    if (!loadedFull && !loading) load();
  };

  const openDrawer = () => {
    ensureLoaded();
    setDrawerOpen(true);
  };

  const handleAdded = (rev: AnyRevision) => {
    setRevisions((prev) => (prev ? [rev, ...prev] : [rev]));
    setLoadedFull(true);
  };

  const handleDelete = async (rev: AnyRevision) => {
    const ok = await confirm({
      title: "Delete this revision?",
      description: (
        <span>
          This will permanently remove the entry
          {rev.summary ? (
            <>
              {" "}<span className="font-medium text-slate-900">&ldquo;{rev.summary}&rdquo;</span>
            </>
          ) : null}
          {" "}and any attachments tied to it. This action cannot be undone.
        </span>
      ),
      confirmLabel: "Delete revision",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(rev.id);
    try {
      if (entity === "phase") {
        await phasesApi.deleteRevision(entityId, rev.id);
      } else if (entity === "milestone") {
        await tasksApi.deleteMilestoneRevision(parentId ?? "", entityId, rev.id);
      } else {
        await tasksApi.deleteRevision(entityId, rev.id);
      }
      setRevisions((prev) => (prev ? prev.filter((r) => r.id !== rev.id) : prev));
      showToast.success("Revision deleted");
    } catch (err) {
      showToast.error(
        "Could not delete revision",
        err instanceof Error ? err.message : "Please try again",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const recent = (revisions ?? []).slice(0, 3);
  const hasMore = (revisions?.length ?? 0) > recent.length;
  const accentClass =
    accent === "indigo"
      ? "border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 to-white"
      : "border-slate-200 bg-slate-50/60";
  const count = revisions?.length;

  const dialogs = (
    <>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-b from-white to-white/95 px-6 pt-5 pb-3 backdrop-blur">
            <SheetHeader className="space-y-1">
              <SheetTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <History className="h-4 w-4" />
                </span>
                Revision history
              </SheetTitle>
              {entityLabel && (
                <p className="text-xs text-slate-500 truncate">
                  {entity === "phase" ? "Phase" : entity === "milestone" ? "Milestone" : "Task"} · {entityLabel}
                </p>
              )}
            </SheetHeader>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {revisions?.length ?? 0} revision
                {(revisions?.length ?? 0) === 1 ? "" : "s"} · most recent first
              </p>
              <Button
                size="sm"
                className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Revise
              </Button>
            </div>
          </div>

          <div className="px-6 pb-8 pt-4">
            {loading && !loadedFull ? (
              <RevisionSkeleton />
            ) : (revisions ?? []).length === 0 ? (
              <EmptyState
                message="No history captured yet. Use Revise to log your first change or closure."
                onAdd={() => setAddOpen(true)}
              />
            ) : (
              <ol className="relative ml-3 border-l-2 border-dashed border-indigo-200 pl-5 space-y-4">
                {(revisions ?? []).map((rev) => (
                  <li key={rev.id} className="relative">
                    <span className="absolute -left-[29px] top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-indigo-400 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    </span>
                    <RevisionRow
                      rev={rev}
                      onDelete={() => handleDelete(rev)}
                      deleting={deletingId === rev.id}
                    />
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
        parentId={parentId}
        entityLabel={entityLabel}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={handleAdded}
      />
    </>
  );

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1"
        data-revision-history-compact
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] gap-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
          onClick={(e) => {
            e.stopPropagation();
            openDrawer();
          }}
          title="View revision history"
        >
          <History className="h-3 w-3" />
          History
          {typeof count === "number" && count > 0 && (
            <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
              {count}
            </span>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[10px] gap-1 bg-indigo-600 hover:bg-indigo-700"
          onClick={(e) => {
            e.stopPropagation();
            setAddOpen(true);
          }}
          title="Log a new revision"
        >
          <Plus className="h-3 w-3" />
          Revise
        </Button>
        {dialogs}
      </span>
    );
  }

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
              onClick={openDrawer}
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
              <RevisionRow
                key={rev.id}
                rev={rev}
                compact
                onDelete={() => handleDelete(rev)}
                deleting={deletingId === rev.id}
              />
            ))}
            {hasMore && (
              <li>
                <button
                  type="button"
                  onClick={openDrawer}
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

      {dialogs}
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

function RevisionRow({
  rev,
  compact,
  onDelete,
  deleting,
}: {
  rev: AnyRevision;
  compact?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const authorInitial = (rev.author_name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="group/rev rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm hover:border-indigo-200 hover:shadow transition">
      <div className="flex flex-wrap items-start gap-2">
        <ChangeTypeBadge type={rev.change_type} />
        <span className="flex-1 text-sm font-semibold text-slate-900 leading-tight">
          {rev.summary}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            title="Delete revision"
            className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition opacity-0 group-hover/rev:opacity-100 focus:opacity-100"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        {rev.author_name && (
          <>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: rev.author_color || "#6366f1" }}
              title={rev.author_name}
            >
              {authorInitial}
            </span>
            <span className="font-medium text-slate-700">{rev.author_name}</span>
            <span className="text-slate-300">·</span>
          </>
        )}
        <Clock className="h-3 w-3" />
        <span title={new Date(rev.created_at).toLocaleString()}>
          {formatTime(rev.created_at)}
        </span>
      </div>
      {!compact && rev.details && (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
          {rev.details}
        </p>
      )}
      {!compact && (rev.previous_value || rev.new_value) && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
          {rev.previous_value && (
            <div className="rounded-md border border-rose-200/70 bg-rose-50/70 px-2 py-1.5 text-rose-800">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Before
              </span>
              <span className="whitespace-pre-wrap">{rev.previous_value}</span>
            </div>
          )}
          {rev.new_value && (
            <div className="rounded-md border border-emerald-200/70 bg-emerald-50/70 px-2 py-1.5 text-emerald-800">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                After
              </span>
              <span className="whitespace-pre-wrap">{rev.new_value}</span>
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
