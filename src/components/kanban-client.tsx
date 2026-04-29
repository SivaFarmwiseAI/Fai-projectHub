"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, X, Kanban, List, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { projects as projectsApi, tasks as tasksApi } from "@/lib/api-client";
import type { Project, Task } from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { fireSideCannons } from "@/lib/confetti";
import { formatDistanceToNow } from "date-fns";

/* ── Column config ─────────────────────────────────────────── */
type ColId = "planning" | "in_progress" | "blocked" | "completed";

const COLUMNS: { id: ColId; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { id: "planning",    label: "Planning",    color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-400" },
  { id: "in_progress", label: "In Progress", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  { id: "blocked",     label: "Blocked",     color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500" },
  { id: "completed",   label: "Done",        color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low:      "text-slate-500  bg-slate-100",
  medium:   "text-blue-600   bg-blue-100",
  high:     "text-amber-600  bg-amber-100",
  critical: "text-red-600    bg-red-100",
};

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, color, size = 6 }: { name?: string; color?: string; size?: number }) {
  if (!name) return null;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={`h-${size} w-${size} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: color ?? "#3b82f6", fontSize: size <= 6 ? "0.55rem" : "0.7rem" }}
      title={name}
    >
      {initials}
    </div>
  );
}

/* ── Task card ──────────────────────────────────────────────── */
function TaskCard({
  task,
  onMove,
  dragging,
}: {
  task: Task;
  onMove: (taskId: string, to: ColId) => void;
  dragging: string | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const steps = task.steps ?? [];
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const totalSteps = steps.length;
  const pct = totalSteps ? Math.round(completedSteps / totalSteps * 100) : 0;
  const nextCols = COLUMNS.filter(c => c.id !== task.status);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-card p-3.5 group cursor-pointer relative transition-all duration-200",
        dragging === task.id ? "opacity-50 scale-95" : "hover:-translate-y-0.5 hover:shadow-card-hover"
      )}
      onClick={() => setShowMenu(v => !v)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
        <Avatar name={task.assignee_name} color={task.assignee_color} size={6} />
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug mb-1.5 line-clamp-2">{task.title}</p>

      {totalSteps > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 font-medium">{completedSteps}/{totalSteps} steps</span>
            <span className="text-[10px] text-slate-400 font-medium">{pct}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#3b82f6" }}
            />
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
      </p>

      {showMenu && (
        <div
          className="absolute top-2 right-2 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[140px]"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Move to</p>
          {nextCols.map(col => (
            <button
              key={col.id}
              onClick={() => { onMove(task.id, col.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className={cn("h-2 w-2 rounded-full", col.dot)} />
              {col.label}
              <ChevronRight className="h-3 w-3 ml-auto text-slate-400" />
            </button>
          ))}
          <button
            onClick={() => setShowMenu(false)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 mt-0.5 rounded-lg text-xs text-slate-400 hover:bg-slate-50"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Column ─────────────────────────────────────────────────── */
function KanbanColumn({
  col, tasks, onMove, onDragOver, onDrop, dragging,
}: {
  col: typeof COLUMNS[number];
  tasks: Task[];
  onMove: (taskId: string, to: ColId) => void;
  onDragOver: (e: React.DragEvent, colId: ColId) => void;
  onDrop: (e: React.DragEvent, colId: ColId) => void;
  dragging: string | null;
}) {
  return (
    <div
      className="flex flex-col gap-2 min-w-[260px] flex-1"
      onDragOver={e => onDragOver(e, col.id)}
      onDrop={e => onDrop(e, col.id)}
    >
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", col.bg, col.border)}>
        <span className={cn("h-2 w-2 rounded-full shrink-0", col.dot)} />
        <span className={cn("text-xs font-bold uppercase tracking-wide", col.color)}>{col.label}</span>
        <span className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full", col.bg, col.color, col.border, "border")}>
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-h-[120px]">
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8">
            <p className="text-xs text-slate-300 font-medium">No tasks</p>
          </div>
        )}
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onMove={onMove} dragging={dragging} />
        ))}
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export function KanbanClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      projectsApi.get(projectId).then(r => setProject(r.project)),
      tasksApi.list({ project_id: projectId }).then(r =>
        setTasks(r.tasks.map(t => ({
          ...t,
          status: (["planning","in_progress","blocked","completed"].includes(t.status) ? t.status : "planning") as ColId,
        })))
      ),
    ]).finally(() => setLoading(false));
  }, [projectId]);

  const moveTask = useCallback((taskId: string, to: ColId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const wasCompleted = t.status === "completed";
      const nowCompleted = to === "completed";
      if (!wasCompleted && nowCompleted) {
        showToast.success("Task marked complete!");
        setTimeout(() => fireSideCannons(), 200);
      } else {
        showToast.info(`Moved to ${COLUMNS.find(c => c.id === to)?.label}`);
      }
      return { ...t, status: to };
    }));
  }, []);

  const handleDragOver = (e: React.DragEvent, _colId: ColId) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, colId: ColId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) moveTask(taskId, colId);
    setDragging(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return null;

  const filteredTasks = filterPriority === "all" ? tasks : tasks.filter(t => t.priority === filterPriority);
  const tasksByCol = (colId: ColId) => filteredTasks.filter(t => t.status === colId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 font-medium mb-3 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to project
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Kanban className="h-5 w-5 text-blue-500" />
              <span className="text-label-upper text-blue-500">Kanban Board</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{project.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{tasks.length} tasks across {COLUMNS.length} columns</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setView("board")}
                className={cn("p-1.5 rounded-md transition-all", view === "board" ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                title="Board view"
              >
                <Kanban className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn("p-1.5 rounded-md transition-all", view === "list" ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Board view */}
      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={tasksByCol(col.id)}
              onMove={moveTask}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              dragging={dragging}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {COLUMNS.map(col => {
            const colTasks = tasksByCol(col.id);
            if (colTasks.length === 0) return null;
            return (
              <div key={col.id}>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-t-xl border", col.bg, col.border)}>
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                  <span className="text-xs text-slate-400 ml-1">({colTasks.length})</span>
                </div>
                <div className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden">
                  {colTasks.map((task, i) => (
                    <div key={task.id} className={cn("flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors", i < colTasks.length - 1 && "border-b border-slate-100")}>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0", PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{task.title}</p>
                      <Avatar name={task.assignee_name} color={task.assignee_color} size={6} />
                      <div className="flex items-center gap-1 shrink-0">
                        {COLUMNS.filter(c => c.id !== col.id).map(c => (
                          <button
                            key={c.id}
                            onClick={() => moveTask(task.id, c.id)}
                            className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all hover:scale-105", c.bg, c.color, c.border)}
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const count = tasksByCol(col.id).length;
          const pct = tasks.length ? Math.round(count / tasks.length * 100) : 0;
          return (
            <div key={col.id} className={cn("rounded-xl border p-3 text-center", col.bg, col.border)}>
              <div className={cn("text-2xl font-extrabold tabular-nums", col.color)}>{count}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{col.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
