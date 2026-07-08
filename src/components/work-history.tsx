"use client";

/**
 * Objective per-employee work history — derived purely from real task/milestone
 * data (not self-reported). Shows, for a single member across all projects:
 *   • a summary of what was completed in the selected interval,
 *   • the tasks & milestones currently allotted / in-flight (prominent),
 *   • the tasks & milestones completed within the interval, and
 *   • a chronological feed of every update & revision they authored.
 *
 * Used inside the employee performance report (EmployeeReportModal) and the
 * team-member page. Backed by GET /api/users/{id}/activity (fn_user_work_history,
 * access-gated by fn_can_view_subject).
 */

import { useEffect, useMemo, useState } from "react";
import {
  parseISO, isWithinInterval, isAfter, format,
  startOfDay, endOfDay, subDays,
} from "date-fns";
import {
  Activity, CheckCircle2, Clock, Flag, GitCommitHorizontal, MessageSquare,
  ListTodo, Link2, Loader2, FileText, Filter, ChevronRight, X, History, Tag,
} from "lucide-react";
import {
  users as usersApi,
  tasks as tasksApi,
  type UserWorkHistory,
  type WorkActivityEntry,
  type WorkHistoryTask,
  type WorkHistoryAllottedMilestone,
  type TaskUpdateEntry,
  type MilestoneUpdateEntry,
  type TaskRevision,
  type MilestoneRevision,
  type RevisionAttachment,
} from "@/lib/api-client";

/** What the detail drawer is currently showing. */
type DetailTarget =
  | { kind: "task"; taskId: string; title: string; project: string }
  | { kind: "milestone"; taskId: string; milestoneId: string; title: string; project: string };

type DatePreset = "7d" | "30d" | "90d" | "all" | "custom";

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

const DONE = new Set(["completed", "done"]);

const ACTIVITY_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  task_update:        { label: "Task update",       icon: <MessageSquare className="h-3.5 w-3.5" />,      color: "#2563eb", bg: "#eff6ff" },
  milestone_update:   { label: "Milestone update",  icon: <Flag className="h-3.5 w-3.5" />,               color: "#7c3aed", bg: "#f5f3ff" },
  task_revision:      { label: "Task revision",     icon: <GitCommitHorizontal className="h-3.5 w-3.5" />, color: "#0891b2", bg: "#ecfeff" },
  milestone_revision: { label: "Milestone revision", icon: <GitCommitHorizontal className="h-3.5 w-3.5" />, color: "#c026d3", bg: "#fdf4ff" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  completed:   { label: "Completed",   color: "#15803d", bg: "#dcfce7" },
  in_progress: { label: "In progress", color: "#1d4ed8", bg: "#dbeafe" },
  blocked:     { label: "Blocked",     color: "#b91c1c", bg: "#fee2e2" },
  planning:    { label: "Planning",    color: "#475569", bg: "#f1f5f9" },
  pending:     { label: "Pending",     color: "#475569", bg: "#f1f5f9" },
  review:      { label: "In review",   color: "#b45309", bg: "#fef3c7" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: "#475569", bg: "#f1f5f9" };
}

function inRange(dateStr: string | null | undefined, from: Date | null, to: Date | null): boolean {
  if (!dateStr) return false;
  if (!from && !to) return true;
  try {
    const d = parseISO(dateStr);
    if (from && to) return isWithinInterval(d, { start: from, end: to });
    if (from) return !isAfter(from, d);
    if (to) return !isAfter(d, to);
  } catch { return false; }
  return true;
}

export function WorkHistory({
  subjectId,
  defaultPreset = "30d",
}: {
  subjectId: string;
  defaultPreset?: DatePreset;
}) {
  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<UserWorkHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const openTask = (t: WorkHistoryTask) =>
    setDetail({ kind: "task", taskId: t.id, title: t.title, project: t.project_title });
  const openMilestone = (m: WorkHistoryAllottedMilestone) =>
    setDetail({ kind: "milestone", taskId: m.task_id, milestoneId: m.id, title: m.title, project: m.project_title });
  const openActivity = (a: WorkActivityEntry) =>
    setDetail(
      a.milestone_id
        ? { kind: "milestone", taskId: a.task_id, milestoneId: a.milestone_id, title: a.milestone_title || a.task_title, project: a.project_title }
        : { kind: "task", taskId: a.task_id, title: a.task_title, project: a.project_title },
    );

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === "all") return { from: null as Date | null, to: null as Date | null };
    if (preset === "custom") {
      return {
        from: customFrom ? startOfDay(parseISO(customFrom)) : null,
        to: customTo ? endOfDay(parseISO(customTo)) : null,
      };
    }
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    return { from: startOfDay(subDays(now, days)), to: endOfDay(now) };
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    usersApi
      .activity(subjectId, {
        from: from ? from.toISOString() : undefined,
        to: to ? to.toISOString() : undefined,
      })
      .then((r) => { if (alive) setData(r.activity); })
      .catch((e) => { if (alive) setError(e?.message || "Couldn't load work history"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subjectId, from, to]);

  // ── Derived buckets ────────────────────────────────────────────────────────
  const tasks = data?.tasks ?? [];
  const milestones = data?.milestones ?? [];
  const activity = data?.activity ?? [];

  const completedTasks = useMemo(
    () => tasks.filter((t) => DONE.has(t.status) && inRange(t.completed_at, from, to)),
    [tasks, from, to],
  );
  const completedMilestones = useMemo(
    () => milestones.filter((m) => DONE.has(m.status) && inRange(m.completed_at, from, to)),
    [milestones, from, to],
  );

  // Allotted / in-flight = not yet completed (independent of the interval).
  const inflightTasks = useMemo(
    () => tasks.filter((t) => !DONE.has(t.status)),
    [tasks],
  );
  const inflightMilestones = useMemo(
    () => milestones.filter((m) => !DONE.has(m.status)),
    [milestones],
  );

  const actualHoursInRange = useMemo(
    () => completedMilestones.reduce((s, m) => s + (Number(m.actual_hours) || 0), 0),
    [completedMilestones],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading work history…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-slate-400 py-6 text-center">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* ── Interval selector ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Interval
        </div>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              preset === p.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border rounded px-2 py-1" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border rounded px-2 py-1" />
          </div>
        )}
        <span className="ml-auto text-[11px] text-slate-400">
          {from || to
            ? `${from ? format(from, "MMM d, yyyy") : "—"} → ${to ? format(to, "MMM d, yyyy") : "—"}`
            : "All time"}
        </span>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Tasks completed"
          value={completedTasks.length} sub="in interval" color="#22c55e" bg="#f0fdf4" />
        <SummaryCard icon={<Flag className="h-4 w-4" />} label="Milestones completed"
          value={completedMilestones.length} sub={`${actualHoursInRange ? `${actualHoursInRange}h logged` : "in interval"}`} color="#8b5cf6" bg="#f5f3ff" />
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="Updates & revisions"
          value={activity.length} sub="in interval" color="#3b82f6" bg="#eff6ff" />
        <SummaryCard icon={<ListTodo className="h-4 w-4" />} label="Allotted / in-flight"
          value={inflightTasks.length + inflightMilestones.length} sub={`${inflightTasks.length} tasks · ${inflightMilestones.length} milestones`} color="#f59e0b" bg="#fffbeb" />
      </div>

      {/* ── Allotted / in-flight (prominent) ── */}
      <Section title={`Allotted & in-flight (${inflightTasks.length + inflightMilestones.length})`} icon={<ListTodo className="h-3.5 w-3.5 text-amber-500" />}>
        {inflightTasks.length === 0 && inflightMilestones.length === 0 ? (
          <Empty text="Nothing open — all assigned work is completed." />
        ) : (
          <div className="space-y-1.5">
            {inflightTasks.map((t) => <TaskRow key={t.id} t={t} onOpen={() => openTask(t)} />)}
            {inflightMilestones.map((m) => <MilestoneRow key={m.id} m={m} onOpen={() => openMilestone(m)} />)}
          </div>
        )}
      </Section>

      {/* ── Completed in interval ── */}
      <Section title={`Completed in interval (${completedTasks.length + completedMilestones.length})`} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}>
        {completedTasks.length === 0 && completedMilestones.length === 0 ? (
          <Empty text="No tasks or milestones completed in this interval." />
        ) : (
          <div className="space-y-1.5">
            {completedTasks.map((t) => <TaskRow key={t.id} t={t} done onOpen={() => openTask(t)} />)}
            {completedMilestones.map((m) => <MilestoneRow key={m.id} m={m} done onOpen={() => openMilestone(m)} />)}
          </div>
        )}
      </Section>

      {/* ── Activity feed ── */}
      <Section title={`Activity — what they did (${activity.length})`} icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}>
        {activity.length === 0 ? (
          <Empty text="No updates or revisions posted in this interval." />
        ) : (
          <ol className="relative border-l border-slate-200 ml-1.5 space-y-3 pl-4">
            {activity.map((a) => <ActivityItem key={`${a.kind}-${a.id}`} a={a} onOpen={() => openActivity(a)} />)}
          </ol>
        )}
      </Section>

      <ItemHistoryDrawer detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

// ── Detail drawer: full update + revision history of one task / milestone ──────
// Self-contained slide-over (no portal/base-ui) so it stacks correctly whether
// it's opened from the team page or from inside the performance report modal.
function ItemHistoryDrawer({ detail, onClose }: { detail: DetailTarget | null; onClose: () => void }) {
  const [updates, setUpdates] = useState<(TaskUpdateEntry | MilestoneUpdateEntry)[]>([]);
  const [revisions, setRevisions] = useState<(TaskRevision | MilestoneRevision)[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && detail) { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [detail, onClose]);

  useEffect(() => {
    if (!detail) return;
    let alive = true;
    setLoading(true);
    setUpdates([]);
    setRevisions([]);
    const revP = detail.kind === "milestone"
      ? tasksApi.milestoneRevisions(detail.taskId, detail.milestoneId).then((r) => r.revisions ?? [])
      : tasksApi.revisions(detail.taskId).then((r) => r.revisions ?? []);
    Promise.all([
      tasksApi.get(detail.taskId).then((r) => {
        if (detail.kind === "task") return r.task.updates ?? [];
        return (r.task.milestones ?? []).find((m) => m.id === detail.milestoneId)?.updates ?? [];
      }).catch(() => []),
      revP.catch(() => []),
    ])
      .then(([u, rev]) => { if (alive) { setUpdates(u); setRevisions(rev); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [detail]);

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto animate-fade-in-right"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              {detail.kind === "milestone"
                ? <Flag className="h-4 w-4 text-violet-500 shrink-0" />
                : <ListTodo className="h-4 w-4 text-blue-500 shrink-0" />}
              <span className="truncate">{detail.title}</span>
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {detail.kind === "milestone" ? "Milestone" : "Task"} · {detail.project}
            </p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Progress updates */}
            <Section title={`Progress updates (${updates.length})`} icon={<MessageSquare className="h-3.5 w-3.5 text-blue-500" />}>
              {updates.length === 0 ? (
                <Empty text="No progress updates logged on this item yet." />
              ) : (
                <ol className="relative border-l border-slate-200 ml-1.5 space-y-2.5 pl-4">
                  {updates.map((u) => <UpdateRow key={u.id} u={u} />)}
                </ol>
              )}
            </Section>

            {/* Revision history */}
            <Section title={`Revision history (${revisions.length})`} icon={<History className="h-3.5 w-3.5 text-indigo-500" />}>
              {revisions.length === 0 ? (
                <Empty text="No revisions captured for this item yet." />
              ) : (
                <ol className="relative border-l border-slate-200 ml-1.5 space-y-3 pl-4">
                  {revisions.map((rev) => <RevisionCard key={rev.id} rev={rev} />)}
                </ol>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function RevisionCard({ rev }: { rev: TaskRevision | MilestoneRevision }) {
  let when = "";
  try { when = format(parseISO(rev.created_at), "MMM d, yyyy · h:mm a"); } catch { when = rev.created_at; }
  return (
    <li className="relative">
      <span className="absolute -left-[1.31rem] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white" />
      <div className="rounded-xl border border-slate-100 p-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">
            <Tag className="h-3 w-3" />{String(rev.change_type || "revision").replace(/_/g, " ")}
          </span>
          {rev.author_name && <span className="text-[11px] font-medium text-slate-600">{rev.author_name}</span>}
          <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1"><Clock className="h-3 w-3" />{when}</span>
        </div>
        <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">{rev.summary}</p>
        {rev.details && <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap mt-1">{rev.details}</p>}
        {(rev.previous_value || rev.new_value) && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {rev.previous_value && (
              <div className="rounded-md border border-rose-200/70 bg-rose-50/70 px-2 py-1.5 text-rose-800">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-600">Before</span>
                <span className="whitespace-pre-wrap">{rev.previous_value}</span>
              </div>
            )}
            {rev.new_value && (
              <div className="rounded-md border border-emerald-200/70 bg-emerald-50/70 px-2 py-1.5 text-emerald-800">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">After</span>
                <span className="whitespace-pre-wrap">{rev.new_value}</span>
              </div>
            )}
          </div>
        )}
        {rev.attachments?.length > 0 && <AttachmentChips attachments={rev.attachments} />}
      </div>
    </li>
  );
}

function AttachmentChips({ attachments }: { attachments: RevisionAttachment[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((att) =>
        att.url ? (
          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
            <Link2 className="h-3 w-3" /> {att.title || att.type}
          </a>
        ) : (
          <span key={att.id} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <FileText className="h-3 w-3" /> {att.title || att.type}
          </span>
        ),
      )}
    </div>
  );
}

function UpdateRow({ u }: { u: TaskUpdateEntry | MilestoneUpdateEntry }) {
  const author = "user_name" in u ? u.user_name : undefined;
  let when = "";
  try { when = format(parseISO(u.created_at), "MMM d, yyyy · h:mm a"); } catch { when = u.created_at; }
  return (
    <li className="relative">
      <span className="absolute -left-[1.31rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-400 ring-2 ring-white" />
      <div className="rounded-xl border border-slate-100 p-3">
        <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">{u.message}</p>
        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
          {author ? <>{author} · </> : null}<Clock className="h-3 w-3" />{when}
        </p>
      </div>
    </li>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl">{text}</p>;
}

function SummaryCard({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: number | string; sub: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 p-3 bg-white">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg, color }}>{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ t, done, onOpen }: { t: WorkHistoryTask; done?: boolean; onOpen: () => void }) {
  const info = statusMeta(t.status);
  const msDone = t.milestones.filter((m) => DONE.has(m.status)).length;
  return (
    <button type="button" onClick={onOpen} title="View task history"
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
        style={{ color: info.color, background: info.bg }}>{info.label}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-slate-800 truncate">{t.title}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {t.project_title}{t.phase_name ? ` · ${t.phase_name}` : ""}
          {t.milestones.length > 0 ? ` · ${msDone}/${t.milestones.length} milestones` : ""}
          {!t.is_primary ? " · co-assignee" : ""}
        </p>
      </div>
      {t.priority && (
        <span className="hidden sm:inline text-[10px] font-medium text-slate-400 capitalize shrink-0">{t.priority}</span>
      )}
      <span className="text-[10px] text-slate-400 shrink-0 w-14 text-right">
        {done && t.completed_at ? format(parseISO(t.completed_at), "MMM d") : (t.actual_hours ? `${t.actual_hours}h` : "—")}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
    </button>
  );
}

function MilestoneRow({ m, done, onOpen }: { m: WorkHistoryAllottedMilestone; done?: boolean; onOpen: () => void }) {
  const info = statusMeta(m.status);
  return (
    <button type="button" onClick={onOpen} title="View milestone history"
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors">
      <Flag className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
        style={{ color: info.color, background: info.bg }}>{info.label}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-slate-800 truncate">{m.title}</p>
        <p className="text-[11px] text-slate-400 truncate">
          {m.task_title} · {m.project_title}
          {m.target_date
            ? ` · due ${format(parseISO(m.target_date), "MMM d, yyyy")}`
            : m.target_day != null
              ? ` · day ${m.target_day}`
              : ""}
        </p>
      </div>
      <span className="text-[10px] text-slate-400 shrink-0 w-14 text-right">
        {done && m.completed_at ? format(parseISO(m.completed_at), "MMM d") : (m.estimated_hours ? `${m.estimated_hours}h` : "—")}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
    </button>
  );
}

function ActivityItem({ a, onOpen }: { a: WorkActivityEntry; onOpen: () => void }) {
  const meta = ACTIVITY_META[a.kind] ?? ACTIVITY_META.task_update;
  let when = "";
  try { when = format(parseISO(a.created_at), "MMM d, yyyy · h:mm a"); } catch { when = a.created_at; }
  return (
    <li className="relative">
      <span className="absolute -left-[1.36rem] top-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-white"
        style={{ background: meta.bg, color: meta.color }}>{meta.icon}</span>
      <div className="rounded-xl border border-slate-100 p-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}{a.change_type && a.change_type !== "revision" ? ` · ${String(a.change_type).replace(/_/g, " ")}` : ""}
          </span>
          <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1"><Clock className="h-3 w-3" />{when}</span>
        </div>
        <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">{a.summary}</p>
        {a.details && <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap mt-1">{a.details}</p>}
        <button type="button" onClick={onOpen} title="View full history"
          className="text-[11px] text-slate-400 mt-1.5 truncate flex items-center gap-1 hover:text-blue-600 transition-colors max-w-full">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate">{a.milestone_title ? `${a.milestone_title} · ` : ""}{a.task_title} · {a.project_title}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
        </button>
        {a.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.attachments.map((att) =>
              att.url ? (
                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
                  <Link2 className="h-3 w-3" /> {att.title || att.type}
                </a>
              ) : (
                <span key={att.id} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  <FileText className="h-3 w-3" /> {att.title || att.type}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </li>
  );
}
