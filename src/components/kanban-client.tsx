"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, X, Kanban, List, ChevronRight, Loader2, Search,
  LayoutGrid, Layers, Users, Target, Clock, CheckCircle2, GripVertical,
  FileText, GitBranch, ExternalLink, Link as LinkIcon, PenTool, Paintbrush,
  Code as CodeIcon, MessageSquare, Flag, Calendar, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { projects as projectsApi, tasks as tasksApi } from "@/lib/api-client";
import type { Project, Task, TaskMilestone, Deliverable } from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { fireSideCannons } from "@/lib/confetti";
import { BrandLoader } from "@/components/brand-loader";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { RevisionHistory } from "@/components/revision-history";
import { UserLink } from "@/components/user-link";
import { MilestoneLinks } from "@/components/milestone-links";
import { CompleteWorkDialog } from "@/components/complete-work-dialog";

/* ═══════════════════════════════════════════════════════════════════════════
   Enhanced Kanban — a full project-transaction board.
   Group tasks four ways: by Status, by Phase, by Member, or by Milestone.
   Cards are rich (phase, assignees, milestone rollup, hours) and dragging a
   card across columns re-assigns the grouped attribute and persists it.
   ═══════════════════════════════════════════════════════════════════════════ */

type GroupBy = "status" | "phase" | "member" | "milestone";
type StatusId = "planning" | "in_progress" | "blocked" | "completed";
type MilestoneStatusId = "pending" | "in_progress" | "completed" | "blocked";

interface Col {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  avatar?: { name: string; color: string };
}

const STATUS_COLS: Record<StatusId, Omit<Col, "id">> = {
  planning:    { label: "Planning",    color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400" },
  in_progress: { label: "In Progress", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  blocked:     { label: "Blocked",     color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500" },
  completed:   { label: "Done",        color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
};

const MS_STATUS_COLS: Record<MilestoneStatusId, Omit<Col, "id">> = {
  pending:     { label: "Pending",     color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400" },
  in_progress: { label: "In Progress", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  blocked:     { label: "Blocked",     color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500" },
  completed:   { label: "Completed",   color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
};

const NEUTRAL: Omit<Col, "id" | "label"> = {
  color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:      "text-slate-500 bg-slate-100",
  medium:   "text-blue-600  bg-blue-100",
  high:     "text-amber-600 bg-amber-100",
  critical: "text-red-600   bg-red-100",
};

const PHASE_DOT: Record<string, string> = {
  active: "bg-blue-500", in_discussion: "bg-amber-500",
  completed: "bg-emerald-500", pending: "bg-slate-400",
};

const GROUP_TABS: { id: GroupBy; label: string; icon: typeof LayoutGrid }[] = [
  { id: "status",    label: "Status",    icon: LayoutGrid },
  { id: "phase",     label: "Phase",     icon: Layers },
  { id: "member",    label: "Member",    icon: Users },
  { id: "milestone", label: "Milestone", icon: Target },
];

/* ── helpers ─────────────────────────────────────────────────── */
const normStatus = (s: string): StatusId =>
  (["planning", "in_progress", "blocked", "completed"].includes(s) ? s : "planning") as StatusId;

const normMsStatus = (s: string): MilestoneStatusId =>
  (["pending", "in_progress", "completed", "blocked"].includes(s) ? s : "pending") as MilestoneStatusId;

const initials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

const fmtHours = (h?: number) => (h == null ? "—" : `${Math.round(h * 10) / 10}h`);

/** Format a milestone's lead-chosen date ("YYYY-MM-DD") for display. Parsed as
 *  local time (append T00:00:00) so the day doesn't shift across timezones. */
const fmtMsDate = (d?: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, color, size = 22, ring, userId }: { name?: string; color?: string; size?: number; ring?: boolean; userId?: string | null }) {
  if (!name) return null;
  const circle = (
    <div
      className={cn("rounded-full flex items-center justify-center text-white font-bold shrink-0", ring && "ring-2 ring-white", userId && "hover:ring-2 hover:ring-blue-300 transition-shadow")}
      style={{ height: size, width: size, background: color ?? "#3b82f6", fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name)}
    </div>
  );
  if (!userId) return circle;
  return (
    <UserLink userId={userId} title={name} className="inline-flex shrink-0 hover:no-underline">
      {circle}
    </UserLink>
  );
}

function AvatarStack({ people, max = 3 }: { people: { name: string; color?: string; id?: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size={22} ring userId={p.id} />)}
      {extra > 0 && (
        <div className="h-[22px] w-[22px] rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
          +{extra}
        </div>
      )}
    </div>
  );
}

/* ── mini progress bar ──────────────────────────────────────── */
function MiniBar({ pct, done }: { pct: number; done?: boolean }) {
  return (
    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: done || pct === 100 ? "#22c55e" : "#3b82f6" }} />
    </div>
  );
}

/* ── Task card ──────────────────────────────────────────────── */
function TaskCard({
  task, groupBy, phaseName, moveCols, onMove, onDragStart, onDragEnd, dragging, onOpen,
}: {
  task: Task;
  groupBy: GroupBy;
  phaseName?: string;
  moveCols: Col[];
  onMove: (id: string, to: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  onOpen: (taskId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const milestones = task.milestones ?? [];
  const msDone = milestones.filter(m => normMsStatus(m.status) === "completed").length;
  const steps = task.steps ?? [];
  const stepsDone = steps.filter(s => s.status === "completed").length;
  const linkCount = milestones.reduce((n, m) => n + (m.attachments?.filter(a => a.url).length ?? 0), 0);

  const hasMs = milestones.length > 0;
  const pct = hasMs
    ? Math.round((msDone / milestones.length) * 100)
    : steps.length ? Math.round((stepsDone / steps.length) * 100) : 0;

  const people = task.assignees?.length
    ? task.assignees.map(a => ({ name: a.name, color: a.avatar_color, id: a.id }))
    : task.assignee_name ? [{ name: task.assignee_name, color: task.assignee_color, id: task.assignee_id }] : [];

  const est = task.estimated_hours ?? 0;
  const act = task.actual_hours ?? 0;
  const hoursPct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : 0;
  const over = est > 0 && act > est;

  const st = STATUS_COLS[normStatus(task.status)];

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("id", task.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task.id)}
      className={cn(
        "bg-white rounded-xl border shadow-card p-3 group cursor-pointer relative transition-all duration-200",
        dragging ? "opacity-40 scale-95" : "hover:-translate-y-0.5 hover:shadow-card-hover"
      )}
    >
      {/* top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0 -ml-1" />
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </span>
          {groupBy !== "status" && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500">
              <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
              {st.label}
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="text-slate-300 hover:text-slate-600 shrink-0 text-lg leading-none px-1 -mt-1"
          title="Move"
        >⋯</button>
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">{task.title}</p>

      {/* context chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {groupBy !== "phase" && phaseName && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
            <Layers className="h-2.5 w-2.5" /> {phaseName}
          </span>
        )}
        {hasMs && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md">
            <Target className="h-2.5 w-2.5" /> {msDone}/{milestones.length}
          </span>
        )}
        {linkCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
            <LinkIcon className="h-2.5 w-2.5" /> {linkCount}
          </span>
        )}
        {(est > 0 || act > 0) && (
          <span className={cn("inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md",
            over ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100")}>
            <Clock className="h-2.5 w-2.5" /> {fmtHours(act)}/{fmtHours(est)}
          </span>
        )}
      </div>

      {/* progress */}
      {(hasMs || steps.length > 0) && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 font-medium">
              {hasMs ? `${msDone}/${milestones.length} milestones` : `${stepsDone}/${steps.length} steps`}
            </span>
            <span className="text-[9px] text-slate-400 font-medium">{pct}%</span>
          </div>
          <MiniBar pct={pct} done={normStatus(task.status) === "completed"} />
        </div>
      )}

      {/* hours bar */}
      {est > 0 && (
        <div className="mb-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${hoursPct}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
          </div>
        </div>
      )}

      {/* footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[10px] text-slate-400">
          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </span>
        {groupBy !== "member" && people.length > 0 && <AvatarStack people={people} />}
        {groupBy === "member" && people.length > 1 && <AvatarStack people={people} />}
      </div>

      {/* move menu */}
      {showMenu && (
        <div className="absolute top-8 right-2 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[160px]"
          onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Move to</p>
          <div className="max-h-52 overflow-y-auto">
            {moveCols.map(col => (
              <button key={col.id}
                onClick={() => { onMove(task.id, col.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                {col.avatar
                  ? <Avatar name={col.avatar.name} color={col.avatar.color} size={16} />
                  : <span className={cn("h-2 w-2 rounded-full shrink-0", col.dot)} />}
                <span className="truncate">{col.label}</span>
                <ChevronRight className="h-3 w-3 ml-auto text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
          <button onClick={() => setShowMenu(false)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 mt-0.5 rounded-lg text-xs text-slate-400 hover:bg-slate-50">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Milestone card ─────────────────────────────────────────── */
type MsCard = TaskMilestone & { _taskId: string; _taskTitle: string; _phaseName?: string };

function MilestoneCard({
  ms, members, moveCols, onMove, onDragStart, onDragEnd, dragging, onOpen,
}: {
  ms: MsCard;
  members: Map<string, { name: string; color: string }>;
  moveCols: Col[];
  onMove: (id: string, to: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  onOpen: (taskId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const assignee = ms.assignee_id ? members.get(ms.assignee_id) : undefined;
  const est = ms.estimated_hours ?? 0;
  const act = ms.actual_hours ?? 0;
  const over = est > 0 && act > est;
  const hoursPct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : 0;
  const stat = MS_STATUS_COLS[normMsStatus(ms.status)];

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("id", ms.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(ms._taskId)}
      className={cn(
        "bg-white rounded-xl border shadow-card p-3 relative cursor-pointer transition-all duration-200",
        dragging ? "opacity-40 scale-95" : "hover:-translate-y-0.5 hover:shadow-card-hover"
      )}
    >
      {/* status badge + menu */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
            <Target className="h-2.5 w-2.5" /> Milestone
          </span>
          <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border", stat.bg, stat.color, stat.border)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", stat.dot)} /> {stat.label}
          </span>
        </div>
        <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="text-slate-300 hover:text-slate-600 text-lg leading-none px-1 -mt-1">⋯</button>
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug mb-1.5 line-clamp-2">{ms.title}</p>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md max-w-full truncate">
          <List className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{ms._taskTitle}</span>
        </span>
        {ms._phaseName && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
            <Layers className="h-2.5 w-2.5" /> {ms._phaseName}
          </span>
        )}
        {ms.target_date ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
            <Calendar className="h-2.5 w-2.5" /> {fmtMsDate(ms.target_date)}
          </span>
        ) : ms.target_day != null ? (
          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Day {ms.target_day}</span>
        ) : null}
        {(ms.attachments?.filter(a => a.url).length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
            <LinkIcon className="h-2.5 w-2.5" /> {ms.attachments!.filter(a => a.url).length}
          </span>
        )}
      </div>

      {/* working hours — estimated vs actual */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500">
            <Clock className="h-2.5 w-2.5" /> Hours
          </span>
          <span className={cn("text-[9px] font-bold tabular-nums", over ? "text-red-600" : "text-slate-600")}>
            {fmtHours(act)} / {fmtHours(est)}{over ? " · over" : ""}
          </span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${est > 0 ? hoursPct : act > 0 ? 100 : 0}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        {ms.completed_at
          ? <span className="text-[10px] text-emerald-600 font-medium inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Done</span>
          : <span className="text-[10px] text-slate-400">In flight</span>}
        {assignee && <Avatar name={assignee.name} color={assignee.color} size={22} userId={ms.assignee_id} />}
      </div>

      {showMenu && (
        <div className="absolute top-8 right-2 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[150px]"
          onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Move to</p>
          {moveCols.map(col => (
            <button key={col.id}
              onClick={() => { onMove(ms.id, col.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <span className={cn("h-2 w-2 rounded-full", col.dot)} /> {col.label}
              <ChevronRight className="h-3 w-3 ml-auto text-slate-400" />
            </button>
          ))}
          <button onClick={() => setShowMenu(false)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 mt-0.5 rounded-lg text-xs text-slate-400 hover:bg-slate-50">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Column shell ───────────────────────────────────────────── */
function Column({
  col, count, hours, isOver, onDragOver, onDragLeave, onDrop, children,
}: {
  col: Col;
  count: number;
  hours?: { est: number; act: number };
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col gap-2 min-w-[270px] w-[270px] shrink-0 rounded-2xl p-1.5 transition-colors",
        isOver ? "bg-blue-50/70 ring-2 ring-blue-300" : "bg-transparent")}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", col.bg, col.border)}>
        {col.avatar
          ? <Avatar name={col.avatar.name} color={col.avatar.color} size={22} />
          : <span className={cn("h-2 w-2 rounded-full shrink-0", col.dot)} />}
        <div className="min-w-0">
          <div className={cn("text-xs font-bold uppercase tracking-wide truncate", col.color)}>{col.label}</div>
          {(col.sublabel || hours) && (
            <div className="text-[9px] text-slate-400 font-medium truncate">
              {col.sublabel}
              {hours && (hours.est > 0 || hours.act > 0) ? `${col.sublabel ? " · " : ""}${fmtHours(hours.act)}/${fmtHours(hours.est)}` : ""}
            </div>
          )}
        </div>
        <span className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full border shrink-0", col.bg, col.color, col.border)}>
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-h-[120px]">
        {count === 0 && (
          <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8">
            <p className="text-xs text-slate-300 font-medium">Drop here</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Stat pill ──────────────────────────────────────────────── */
function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={cn("text-xl font-extrabold tabular-nums", accent ?? "text-slate-900")}>{value}</div>
      <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

/* ── Progress bar (labelled) ────────────────────────────────── */
function ProgressRow({ label, done, total, pct, tone = "blue" }: {
  label: string; done?: number; total?: number; pct: number; tone?: "blue" | "violet";
}) {
  const complete = pct >= 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
        <span className="text-[11px] font-bold tabular-nums text-slate-600">
          {done != null && total != null ? `${done}/${total} · ` : ""}{pct}%
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: complete ? "#22c55e" : tone === "violet" ? "#8b5cf6" : "#3b82f6" }} />
      </div>
    </div>
  );
}

/* ── Deliverable / attachment chip ──────────────────────────── */
function delIcon(type: string) {
  switch (type) {
    case "repo": case "code_repo": return GitBranch;
    case "figma": return PenTool;
    case "design": return Paintbrush;
    case "document": case "doc": return FileText;
    case "code": return CodeIcon;
    default: return LinkIcon;
  }
}

function DeliverableChip({ d }: { d: Deliverable }) {
  const Icon = delIcon(d.type);
  const href = d.document_url || d.code_repo_url || d.code_pr_url;
  const inner = (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 transition">
      <Icon className="h-3 w-3 shrink-0 text-slate-500" />
      <span className="truncate max-w-[180px] font-medium">{d.title || d.type}</span>
      {href && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()} className="inline-block max-w-full">
      {inner}
    </a>
  );
}

/* ── Milestone detail block (inside the task sheet) ─────────── */
function MilestoneDetail({
  ms, taskId, members,
}: {
  ms: TaskMilestone;
  taskId: string;
  members: Map<string, { name: string; color: string }>;
}) {
  const stat = MS_STATUS_COLS[normMsStatus(ms.status)];
  const assignee = ms.assignee_id ? members.get(ms.assignee_id) : undefined;
  const est = ms.estimated_hours ?? 0;
  const act = ms.actual_hours ?? 0;
  const over = est > 0 && act > est;
  const hoursPct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : act > 0 ? 100 : 0;
  const deliverables = ms.deliverables ?? [];
  const updates = ms.updates ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border", stat.bg, stat.color, stat.border)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", stat.dot)} /> {stat.label}
            </span>
            {ms.target_date ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                <Calendar className="h-2.5 w-2.5" /> {fmtMsDate(ms.target_date)}
              </span>
            ) : ms.target_day != null ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                <Calendar className="h-2.5 w-2.5" /> Day {ms.target_day}
              </span>
            ) : null}
            {ms.deliverable_type && (
              <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">{ms.deliverable_type}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{ms.title}</p>
        </div>
        {assignee && <Avatar name={assignee.name} color={assignee.color} size={24} userId={ms.assignee_id} />}
      </div>

      {ms.description && <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{ms.description}</p>}

      {/* hours */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Clock className="h-3 w-3" /> Hours</span>
          <span className={cn("text-[11px] font-bold tabular-nums", over ? "text-red-600" : "text-slate-600")}>
            {fmtHours(act)} / {fmtHours(est)}{over ? " · over" : ""}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${hoursPct}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
        </div>
      </div>

      {/* success criteria */}
      {ms.success_criteria?.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            <ListChecks className="h-3 w-3" /> Success criteria
          </p>
          <ul className="space-y-1">
            {ms.success_criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" /> <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* outcome */}
      {(ms.outcome || ms.outcome_notes) && (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-0.5">Outcome</p>
          {ms.outcome && <p className="text-[13px] font-medium text-emerald-800">{ms.outcome}</p>}
          {ms.outcome_notes && <p className="text-[12px] text-emerald-700/90 whitespace-pre-wrap mt-0.5">{ms.outcome_notes}</p>}
        </div>
      )}

      {/* deliverables / attachments */}
      {deliverables.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
            <FileText className="h-3 w-3" /> Deliverables ({deliverables.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {deliverables.map(d => <DeliverableChip key={d.id} d={d} />)}
          </div>
        </div>
      )}

      {/* links & files (pasted links / uploaded files) — falls back to fetching
          the milestone's revision attachments when fn_task_full hasn't been
          deployed with the aggregated `attachments` field yet. */}
      <MilestoneLinks taskId={taskId} milestoneId={ms.id} provided={ms.attachments} />

      {/* update feed */}
      {updates.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
            <MessageSquare className="h-3 w-3" /> Progress updates ({updates.length})
          </p>
          <ol className="space-y-1.5">
            {updates.map(u => (
              <li key={u.id} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{u.message}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* per-milestone revision history */}
      <RevisionHistory entity="milestone" entityId={ms.id} parentId={taskId} entityLabel={ms.title} accent="slate" compact />
    </div>
  );
}

/* ── Task detail sheet ──────────────────────────────────────── */
function TaskDetailSheet({
  taskId, initialTask, phaseName, members, onClose,
}: {
  taskId: string;
  initialTask?: Task;
  phaseName?: string;
  members: Map<string, { name: string; color: string }>;
  onClose: () => void;
}) {
  const [task, setTask] = useState<Task | undefined>(initialTask);
  const [loading, setLoading] = useState(!initialTask);

  useEffect(() => {
    let alive = true;
    setTask(initialTask);
    setLoading(!initialTask);
    // Always refetch the full task so deliverables + update feeds are current.
    tasksApi.get(taskId)
      .then(r => { if (alive) setTask(r.task); })
      .catch(() => { /* keep the board snapshot */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, initialTask]);

  const milestones = task?.milestones ?? [];
  const msDone = milestones.filter(m => normMsStatus(m.status) === "completed").length;
  const steps = task?.steps ?? [];
  const stepsDone = steps.filter(s => s.status === "completed").length;
  const msPct = milestones.length ? Math.round((msDone / milestones.length) * 100) : 0;
  const stepPct = steps.length ? Math.round((stepsDone / steps.length) * 100) : 0;

  const est = task?.estimated_hours ?? 0;
  const act = task?.actual_hours ?? 0;
  const hoursPct = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : act > 0 ? 100 : 0;
  const over = est > 0 && act > est;

  const people = task?.assignees?.length
    ? task.assignees.map(a => ({ name: a.name, color: a.avatar_color, id: a.id }))
    : task?.assignee_name ? [{ name: task.assignee_name, color: task.assignee_color, id: task.assignee_id }] : [];

  const st = task ? STATUS_COLS[normStatus(task.status)] : null;
  const updates = task?.updates ?? [];

  return (
    <Sheet open onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto">
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-5 pt-5 pb-3">
          <SheetHeader className="p-0 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 pr-8">
              {task && (
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", PRIORITY_COLORS[task.priority])}>
                  {task.priority}
                </span>
              )}
              {st && (
                <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border", st.bg, st.color, st.border)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
                </span>
              )}
              {phaseName && (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                  <Layers className="h-2.5 w-2.5" /> {phaseName}
                </span>
              )}
            </div>
            <SheetTitle className="text-lg font-extrabold text-slate-900 leading-snug pr-8">
              {task?.title ?? "Loading…"}
            </SheetTitle>
          </SheetHeader>
        </div>

        {loading && !task ? (
          <BrandLoader label="Loading task…" />
        ) : task ? (
          <div className="px-5 py-4 space-y-5">
            {/* description / approach */}
            {task.description && (
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            )}
            {task.approach && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Approach</p>
                <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{task.approach}</p>
              </div>
            )}

            {/* progress summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Overall progress</p>
              {milestones.length > 0 && <ProgressRow label="Milestones" done={msDone} total={milestones.length} pct={msPct} tone="violet" />}
              {steps.length > 0 && <ProgressRow label="Steps" done={stepsDone} total={steps.length} pct={stepPct} />}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Clock className="h-3 w-3" /> Hours logged</span>
                  <span className={cn("text-[11px] font-bold tabular-nums", over ? "text-red-600" : "text-slate-600")}>
                    {fmtHours(act)} / {fmtHours(est)}{over ? " · over" : ""}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${hoursPct}%`, background: over ? "#ef4444" : "#8b5cf6" }} />
                </div>
              </div>
              {people.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">Team</span>
                  <AvatarStack people={people} max={5} />
                </div>
              )}
            </div>

            {/* success / kill criteria */}
            {(task.success_criteria?.length > 0 || task.kill_criteria?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {task.success_criteria?.length > 0 && (
                  <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3">
                    <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Success criteria
                    </p>
                    <ul className="space-y-1">
                      {task.success_criteria.map((c, i) => <li key={i} className="text-[12px] text-emerald-800">• {c}</li>)}
                    </ul>
                  </div>
                )}
                {task.kill_criteria?.length > 0 && (
                  <div className="rounded-lg border border-red-200/70 bg-red-50/40 p-3">
                    <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-600 mb-1.5">
                      <Flag className="h-3 w-3" /> Kill criteria
                    </p>
                    <ul className="space-y-1">
                      {task.kill_criteria.map((c, i) => <li key={i} className="text-[12px] text-red-800">• {c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* milestones */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <Target className="h-3.5 w-3.5 text-violet-500" /> Milestones
                </p>
                {milestones.length > 0 && (
                  <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{msDone}/{milestones.length} done</span>
                )}
              </div>
              {milestones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center">
                  <p className="text-xs text-slate-400">No milestones on this task.</p>
                </div>
              ) : (
                [...milestones]
                  .sort((a, b) => a.order_index - b.order_index)
                  .map(ms => <MilestoneDetail key={ms.id} ms={ms} taskId={task.id} members={members} />)
              )}
            </div>

            {/* task-level progress updates */}
            {updates.length > 0 && (
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Task updates ({updates.length})
                </p>
                <ol className="space-y-1.5">
                  {updates.map(u => (
                    <li key={u.id} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">{u.user_name ?? "Update"}</span>
                        <span className="text-[10px] text-slate-400">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-0.5">{u.message}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* task revision history */}
            <div>
              <RevisionHistory entity="task" entityId={task.id} entityLabel={task.title} accent="slate" />
            </div>
          </div>
        ) : (
          <div className="px-5 py-20 text-center text-sm text-slate-400">Couldn’t load this task.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════════════════════════════ */
export function KanbanClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");

  // filters
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterMember, setFilterMember] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");

  // dnd
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // task detail sheet
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      projectsApi.get(projectId).then(r => setProject(r.project)),
      // Use the project-tasks endpoint (fn_task_full shape) so each task carries
      // its nested `milestones` + `steps`. tasksApi.list() omits milestones,
      // which left the Milestone grouping and card rollups empty.
      projectsApi.tasks(projectId).then(r => setTasks(r.tasks)),
    ]).finally(() => setLoading(false));
  }, [projectId]);

  /* ── derived: members, phases ─────────────────────────────── */
  const members = useMemo(() => {
    const m = new Map<string, { name: string; color: string; role?: string }>();
    const add = (id?: string | null, name?: string, color?: string, role?: string) => {
      if (id && !m.has(id)) m.set(id, { name: name || "—", color: color || "#3b82f6", role });
    };
    if (project) {
      add(project.owner_id, project.owner_name, project.owner_avatar_color, "Owner");
      (project.co_owners ?? []).forEach(u => add(u.id, u.name, u.avatar_color, "Co-owner"));
      (project.assignees ?? []).forEach(u => add(u.id, u.name, u.avatar_color, u.role));
    }
    tasks.forEach(t => {
      add(t.assignee_id, t.assignee_name, t.assignee_color);
      (t.assignees ?? []).forEach(a => add(a.id, a.name, a.avatar_color, a.role));
    });
    return m;
  }, [project, tasks]);

  const phases = useMemo(
    () => [...(project?.phases ?? [])].sort((a, b) => a.order_index - b.order_index),
    [project]
  );
  const phaseName = useCallback(
    (id?: string) => phases.find(p => p.id === id)?.phase_name,
    [phases]
  );

  /* ── filters ──────────────────────────────────────────────── */
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterPhase !== "all" && (t.phase_id ?? "none") !== filterPhase) return false;
    if (filterMember !== "all") {
      const on = t.assignee_id === filterMember || (t.assignees ?? []).some(a => a.id === filterMember);
      if (!on) return false;
    }
    return true;
  }), [tasks, search, filterPriority, filterPhase, filterMember]);

  const filteredMilestones = useMemo<MsCard[]>(() =>
    filteredTasks.flatMap(t => (t.milestones ?? []).map(ms => ({
      ...ms, _taskId: t.id, _taskTitle: t.title, _phaseName: phaseName(t.phase_id),
    }))), [filteredTasks, phaseName]);

  /* ── columns per dimension ────────────────────────────────── */
  const columns = useMemo<Col[]>(() => {
    if (groupBy === "status")
      return (Object.keys(STATUS_COLS) as StatusId[]).map(id => ({ id, ...STATUS_COLS[id] }));
    if (groupBy === "milestone")
      return (Object.keys(MS_STATUS_COLS) as MilestoneStatusId[]).map(id => ({ id, ...MS_STATUS_COLS[id] }));
    if (groupBy === "phase")
      return [
        ...phases.map(p => ({
          id: p.id, label: p.phase_name, sublabel: p.status?.replace(/_/g, " "),
          ...NEUTRAL, dot: PHASE_DOT[p.status] ?? "bg-slate-400",
        })),
        { id: "none", label: "No phase", ...NEUTRAL },
      ];
    // member
    return [
      ...[...members.entries()].map(([id, m]) => ({
        id, label: m.name, sublabel: m.role, ...NEUTRAL,
        dot: "bg-slate-400", avatar: { name: m.name, color: m.color },
      })),
      { id: "none", label: "Unassigned", ...NEUTRAL },
    ];
  }, [groupBy, phases, members]);

  /* ── bucket assignment ────────────────────────────────────── */
  const colKeyForTask = useCallback((t: Task): string => {
    if (groupBy === "status") return normStatus(t.status);
    if (groupBy === "phase") return t.phase_id ?? "none";
    if (groupBy === "member") return t.assignee_id ?? "none";
    return "";
  }, [groupBy]);

  const itemsByCol = useCallback((colId: string) => {
    if (groupBy === "milestone")
      return filteredMilestones.filter(ms => normMsStatus(ms.status) === colId);
    return filteredTasks.filter(t => colKeyForTask(t) === colId);
  }, [groupBy, filteredTasks, filteredMilestones, colKeyForTask]);

  /* ── completion interception: drag-to-Done opens the structured dialog ── */
  const [completeTarget, setCompleteTarget] = useState<
    | { kind: "milestone"; taskId: string; msId: string; title: string;
        deliverableType?: string; hasEvidence: boolean }
    | { kind: "task"; taskId: string; title: string; total: number; done: number;
        hasEvidence: boolean; showHours: boolean; defaultHours?: number; expected?: string }
    | null
  >(null);

  /* ── persistence: move an item into a column ──────────────── */
  const applyMove = useCallback(async (id: string, to: string) => {
    // Milestone dimension → update milestone status
    if (groupBy === "milestone") {
      const parent = tasksRef.current.find(t => (t.milestones ?? []).some(m => m.id === id));
      const ms = parent?.milestones?.find(m => m.id === id);
      if (!parent || !ms || normMsStatus(ms.status) === to) return;
      const prev = ms.status;
      // Completing requires an outcome verdict + deliverable evidence — the
      // dialog handles the PATCH; the card stays put until it succeeds.
      if (prev !== "completed" && to === "completed") {
        setCompleteTarget({
          kind: "milestone", taskId: parent.id, msId: id, title: ms.title,
          deliverableType: ms.deliverable_type,
          hasEvidence: (ms.deliverables?.length ?? 0) > 0 || (ms.attachments?.length ?? 0) > 0,
        });
        return;
      }
      setTasks(cur => cur.map(t => t.id !== parent.id ? t : {
        ...t, milestones: (t.milestones ?? []).map(m => m.id === id
          ? { ...m, status: to, completed_at: to === "completed" ? new Date().toISOString() : undefined } : m),
      }));
      showToast.info(`Milestone → ${MS_STATUS_COLS[to as MilestoneStatusId].label}`);
      try { await tasksApi.updateMilestone(parent.id, id, { status: to }); }
      catch {
        showToast.error("Couldn't save — reverting");
        setTasks(cur => cur.map(t => t.id !== parent.id ? t : {
          ...t, milestones: (t.milestones ?? []).map(m => m.id === id ? { ...m, status: prev } : m),
        }));
      }
      return;
    }

    // Task dimensions
    const t = tasksRef.current.find(x => x.id === id);
    if (!t) return;
    const target: string | undefined = to === "none" ? undefined : to;

    const patch: Partial<Task> = {};
    let optimistic: Partial<Task> = {};
    if (groupBy === "status") {
      const to2 = normStatus(to);
      if (normStatus(t.status) === to2) return;
      // Completing goes through the structured dialog (and is blocked while
      // milestones are still open) — the card stays put until it succeeds.
      if (t.status !== "completed" && to2 === "completed") {
        const total = (t.milestones ?? []).length;
        const done = (t.milestones ?? []).filter(m => m.status === "completed").length;
        if (total > 0 && done < total) {
          showToast.error(
            "Milestones still open",
            `Complete all ${total} milestones first (${total - done} remaining).`,
          );
          return;
        }
        setCompleteTarget({
          kind: "task", taskId: t.id, title: t.title, total, done,
          hasEvidence: (t.deliverables?.length ?? 0) > 0 || (t.attachments?.length ?? 0) > 0,
          showHours: !(total > 0 && !t.hours_overridden),
          defaultHours: t.actual_hours ?? t.estimated_hours,
          expected: t.expected_deliverable,
        });
        return;
      }
      patch.status = to2;
      optimistic = { status: to2, completed_at: to2 === "completed" ? new Date().toISOString() : t.completed_at };
      showToast.info(`Moved to ${STATUS_COLS[to2].label}`);
    } else if (groupBy === "phase") {
      if ((t.phase_id ?? undefined) === target) return;
      patch.phase_id = target; optimistic = { phase_id: target };
      showToast.info(target ? `Moved to ${phaseName(to) ?? "phase"}` : "Removed from phase");
    } else {
      if ((t.assignee_id ?? undefined) === target) return;
      const mem = target ? members.get(target) : undefined;
      patch.assignee_id = target;
      optimistic = { assignee_id: target, assignee_name: mem?.name, assignee_color: mem?.color };
      showToast.info(mem ? `Assigned to ${mem.name}` : "Unassigned");
    }

    const snapshot = tasksRef.current;
    setTasks(prevTasks => prevTasks.map(x => x.id === id ? { ...x, ...optimistic } : x));
    try { await tasksApi.update(id, patch); }
    catch {
      showToast.error("Couldn't save — reverting");
      setTasks(snapshot);
    }
  }, [groupBy, phaseName, members]);

  /* ── dnd handlers ─────────────────────────────────────────── */
  const onDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id") || dragId;
    setOverCol(null); setDragId(null);
    if (id) applyMove(id, colId);
  };

  if (loading)
    return <BrandLoader label="Loading board…" />;
  if (!project) return null;

  /* ── overview metrics ─────────────────────────────────────── */
  const doneTasks = tasks.filter(t => normStatus(t.status) === "completed").length;
  const allMs = tasks.flatMap(t => t.milestones ?? []);
  const doneMs = allMs.filter(m => normMsStatus(m.status) === "completed").length;
  const totalEst = tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
  const totalAct = tasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0);
  const donePhases = phases.filter(p => p.status === "completed").length;

  const colHours = (colId: string) => {
    const items = itemsByCol(colId) as (Task | MsCard)[];
    return {
      est: items.reduce((s, x) => s + (x.estimated_hours ?? 0), 0),
      act: items.reduce((s, x) => s + (x.actual_hours ?? 0), 0),
    };
  };
  const moveColsFor = (currentColId: string) => columns.filter(c => c.id !== currentColId);
  const totalShown = groupBy === "milestone" ? filteredMilestones.length : filteredTasks.length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {completeTarget && (
        <CompleteWorkDialog
          entity={completeTarget.kind}
          taskId={completeTarget.taskId}
          milestoneId={completeTarget.kind === "milestone" ? completeTarget.msId : undefined}
          title={completeTarget.title}
          milestonesGate={
            completeTarget.kind === "task"
              ? { total: completeTarget.total, completed: completeTarget.done }
              : undefined
          }
          defaultDeliverableType={
            completeTarget.kind === "milestone" ? completeTarget.deliverableType : undefined
          }
          hasExistingDeliverable={completeTarget.hasEvidence}
          showHours={completeTarget.kind === "milestone" ? true : completeTarget.showHours}
          defaultHours={completeTarget.kind === "task" ? completeTarget.defaultHours : undefined}
          expectedDeliverable={completeTarget.kind === "task" ? completeTarget.expected : undefined}
          open
          onOpenChange={(o) => { if (!o) setCompleteTarget(null); }}
          onCompleted={(updated) => {
            if (completeTarget.kind === "milestone") {
              const ms = updated as TaskMilestone;
              setTasks(cur => cur.map(t => t.id !== completeTarget.taskId ? t : {
                ...t,
                milestones: (t.milestones ?? []).map(m => m.id !== completeTarget.msId ? m : {
                  ...m, status: "completed",
                  completed_at: ms.completed_at ?? new Date().toISOString(),
                  outcome: ms.outcome, outcome_notes: ms.outcome_notes,
                  actual_hours: ms.actual_hours ?? m.actual_hours,
                }),
              }));
            } else {
              const task = updated as Task;
              setTasks(cur => cur.map(t => t.id !== completeTarget.taskId ? t : {
                ...t, status: "completed",
                completed_at: task.completed_at ?? new Date().toISOString(),
                outcome: task.outcome, outcome_notes: task.outcome_notes,
                actual_hours: task.actual_hours ?? t.actual_hours,
              }));
            }
            setTimeout(fireSideCannons, 150);
            setCompleteTarget(null);
          }}
        />
      )}
      {/* Header */}
      <div>
        <Link href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 font-medium mb-3 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to project
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Kanban className="h-5 w-5 text-blue-500" />
              <span className="text-label-upper text-blue-500">Project Board</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{project.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalShown} {groupBy === "milestone" ? "milestones" : "tasks"} · grouped by {groupBy}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setView("board")}
                className={cn("p-1.5 rounded-md transition-all", view === "board" ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                title="Board view"><Kanban className="h-3.5 w-3.5" /></button>
              <button onClick={() => setView("list")}
                className={cn("p-1.5 rounded-md transition-all", view === "list" ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                title="List view"><List className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Tasks" value={tasks.length} sub={`${doneTasks} done`} accent="text-slate-900" />
        <Stat label="Milestones" value={`${doneMs}/${allMs.length}`} sub="completed" accent="text-violet-600" />
        <Stat label="Phases" value={`${donePhases}/${phases.length}`} sub="completed" accent="text-blue-600" />
        <Stat label="Members" value={members.size} sub="on project" accent="text-slate-900" />
        <Stat label="Est. hours" value={fmtHours(totalEst)} sub="planned" accent="text-slate-700" />
        <Stat label="Actual hours" value={fmtHours(totalAct)} sub={totalEst > 0 ? `${Math.round((totalAct / totalEst) * 100)}% of est` : "logged"}
          accent={totalAct > totalEst && totalEst > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {/* Group-by tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {GROUP_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setGroupBy(tab.id)}
                className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  groupBy === tab.id ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}>
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            className="text-xs border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 bg-white text-slate-700 font-medium w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All priorities</option>
          <option value="low">Low</option><option value="medium">Medium</option>
          <option value="high">High</option><option value="critical">Critical</option>
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All members</option>
          {[...members.entries()].map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
        </select>
        <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="all">All phases</option>
          {phases.map(p => <option key={p.id} value={p.id}>{p.phase_name}</option>)}
          <option value="none">No phase</option>
        </select>
        {(search || filterPriority !== "all" || filterMember !== "all" || filterPhase !== "all") && (
          <button onClick={() => { setSearch(""); setFilterPriority("all"); setFilterMember("all"); setFilterPhase("all"); }}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Board view */}
      {view === "board" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map(col => {
            const items = itemsByCol(col.id);
            return (
              <Column key={col.id} col={col} count={items.length}
                hours={groupBy !== "status" ? colHours(col.id) : undefined}
                isOver={overCol === col.id}
                onDragOver={e => { e.preventDefault(); setOverCol(col.id); }}
                onDragLeave={() => setOverCol(c => c === col.id ? null : c)}
                onDrop={e => onDrop(e, col.id)}>
                {groupBy === "milestone"
                  ? (items as MsCard[]).map(ms => (
                    <MilestoneCard key={ms.id} ms={ms} members={members}
                      moveCols={moveColsFor(col.id)} onMove={applyMove}
                      onDragStart={() => setDragId(ms.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      dragging={dragId === ms.id} onOpen={setDetailId} />
                  ))
                  : (items as Task[]).map(t => (
                    <TaskCard key={t.id} task={t} groupBy={groupBy} phaseName={phaseName(t.phase_id)}
                      moveCols={moveColsFor(col.id)} onMove={applyMove}
                      onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      dragging={dragId === t.id} onOpen={setDetailId} />
                  ))}
              </Column>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-3">
          {columns.map(col => {
            const items = itemsByCol(col.id);
            if (items.length === 0) return null;
            return (
              <div key={col.id}>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-t-xl border", col.bg, col.border)}>
                  {col.avatar ? <Avatar name={col.avatar.name} color={col.avatar.color} size={18} />
                    : <span className={cn("h-2 w-2 rounded-full", col.dot)} />}
                  <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                  <span className="text-xs text-slate-400 ml-1">({items.length})</span>
                </div>
                <div className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden">
                  {groupBy === "milestone"
                    ? (items as MsCard[]).map((ms, i, arr) => (
                      <div key={ms.id} onClick={() => setDetailId(ms._taskId)}
                        className={cn("flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 cursor-pointer", i < arr.length - 1 && "border-b border-slate-100")}>
                        <Target className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{ms.title}</p>
                        <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{ms._taskTitle}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{fmtHours(ms.actual_hours)}/{fmtHours(ms.estimated_hours)}</span>
                        {ms.assignee_id && members.get(ms.assignee_id) &&
                          <Avatar name={members.get(ms.assignee_id)!.name} color={members.get(ms.assignee_id)!.color} size={22} />}
                      </div>
                    ))
                    : (items as Task[]).map((t, i, arr) => {
                      const ms = t.milestones ?? [];
                      const md = ms.filter(m => normMsStatus(m.status) === "completed").length;
                      const people = t.assignees?.length ? t.assignees.map(a => ({ name: a.name, color: a.avatar_color, id: a.id }))
                        : t.assignee_name ? [{ name: t.assignee_name, color: t.assignee_color, id: t.assignee_id }] : [];
                      return (
                        <div key={t.id} onClick={() => setDetailId(t.id)}
                          className={cn("flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 cursor-pointer", i < arr.length - 1 && "border-b border-slate-100")}>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                          <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{t.title}</p>
                          {phaseName(t.phase_id) && <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">{phaseName(t.phase_id)}</span>}
                          {ms.length > 0 && <span className="text-[10px] text-violet-500 shrink-0">{md}/{ms.length}</span>}
                          <span className="text-[10px] text-slate-400 shrink-0">{fmtHours(t.actual_hours)}/{fmtHours(t.estimated_hours)}</span>
                          {people.length > 0 && <AvatarStack people={people} max={2} />}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail drawer — milestones, attachments & full progress */}
      {detailId && (
        <TaskDetailSheet
          key={detailId}
          taskId={detailId}
          initialTask={tasks.find(t => t.id === detailId)}
          phaseName={phaseName(tasks.find(t => t.id === detailId)?.phase_id)}
          members={members}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
