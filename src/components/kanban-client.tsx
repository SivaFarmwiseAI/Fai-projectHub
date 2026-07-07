"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, X, Kanban, List, ChevronRight, Loader2, Search,
  LayoutGrid, Layers, Users, Target, Clock, CheckCircle2, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { projects as projectsApi, tasks as tasksApi } from "@/lib/api-client";
import type { Project, Task, TaskMilestone } from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { fireSideCannons } from "@/lib/confetti";
import { formatDistanceToNow } from "date-fns";

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

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, color, size = 22, ring }: { name?: string; color?: string; size?: number; ring?: boolean }) {
  if (!name) return null;
  return (
    <div
      className={cn("rounded-full flex items-center justify-center text-white font-bold shrink-0", ring && "ring-2 ring-white")}
      style={{ height: size, width: size, background: color ?? "#3b82f6", fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}

function AvatarStack({ people, max = 3 }: { people: { name: string; color?: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size={22} ring />)}
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
  task, groupBy, phaseName, moveCols, onMove, onDragStart, onDragEnd, dragging,
}: {
  task: Task;
  groupBy: GroupBy;
  phaseName?: string;
  moveCols: Col[];
  onMove: (id: string, to: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const milestones = task.milestones ?? [];
  const msDone = milestones.filter(m => normMsStatus(m.status) === "completed").length;
  const steps = task.steps ?? [];
  const stepsDone = steps.filter(s => s.status === "completed").length;

  const hasMs = milestones.length > 0;
  const pct = hasMs
    ? Math.round((msDone / milestones.length) * 100)
    : steps.length ? Math.round((stepsDone / steps.length) * 100) : 0;

  const people = task.assignees?.length
    ? task.assignees.map(a => ({ name: a.name, color: a.avatar_color }))
    : task.assignee_name ? [{ name: task.assignee_name, color: task.assignee_color }] : [];

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
      className={cn(
        "bg-white rounded-xl border shadow-card p-3 group cursor-grab active:cursor-grabbing relative transition-all duration-200",
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
          onClick={() => setShowMenu(v => !v)}
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
  ms, members, moveCols, onMove, onDragStart, onDragEnd, dragging,
}: {
  ms: MsCard;
  members: Map<string, { name: string; color: string }>;
  moveCols: Col[];
  onMove: (id: string, to: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
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
      className={cn(
        "bg-white rounded-xl border shadow-card p-3 relative cursor-grab active:cursor-grabbing transition-all duration-200",
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
        <button onClick={() => setShowMenu(v => !v)}
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
        {ms.target_day != null && (
          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Day {ms.target_day}</span>
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
        {assignee && <Avatar name={assignee.name} color={assignee.color} size={22} />}
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

  /* ── persistence: move an item into a column ──────────────── */
  const applyMove = useCallback(async (id: string, to: string) => {
    // Milestone dimension → update milestone status
    if (groupBy === "milestone") {
      const parent = tasksRef.current.find(t => (t.milestones ?? []).some(m => m.id === id));
      const ms = parent?.milestones?.find(m => m.id === id);
      if (!parent || !ms || normMsStatus(ms.status) === to) return;
      const prev = ms.status;
      setTasks(cur => cur.map(t => t.id !== parent.id ? t : {
        ...t, milestones: (t.milestones ?? []).map(m => m.id === id
          ? { ...m, status: to, completed_at: to === "completed" ? new Date().toISOString() : undefined } : m),
      }));
      if (prev !== "completed" && to === "completed") { showToast.success("Milestone completed!"); setTimeout(fireSideCannons, 150); }
      else showToast.info(`Milestone → ${MS_STATUS_COLS[to as MilestoneStatusId].label}`);
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
      patch.status = to2;
      optimistic = { status: to2, completed_at: to2 === "completed" ? new Date().toISOString() : t.completed_at };
      if (t.status !== "completed" && to2 === "completed") { showToast.success("Task marked complete!"); setTimeout(fireSideCannons, 200); }
      else showToast.info(`Moved to ${STATUS_COLS[to2].label}`);
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
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
                      dragging={dragId === ms.id} />
                  ))
                  : (items as Task[]).map(t => (
                    <TaskCard key={t.id} task={t} groupBy={groupBy} phaseName={phaseName(t.phase_id)}
                      moveCols={moveColsFor(col.id)} onMove={applyMove}
                      onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      dragging={dragId === t.id} />
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
                      <div key={ms.id} className={cn("flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50", i < arr.length - 1 && "border-b border-slate-100")}>
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
                      const people = t.assignees?.length ? t.assignees.map(a => ({ name: a.name, color: a.avatar_color }))
                        : t.assignee_name ? [{ name: t.assignee_name, color: t.assignee_color }] : [];
                      return (
                        <div key={t.id} className={cn("flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50", i < arr.length - 1 && "border-b border-slate-100")}>
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
    </div>
  );
}
