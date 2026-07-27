"use client";

/**
 * Team Delivery Board — the CEO/TL cockpit on the team page.
 *
 * One board, three lenses over the same work units (milestones, plus
 * milestone-less tasks):
 *   Status      — each member's current pipeline + what they finished in the window
 *   Project     — the same distribution grouped per project, with who's on it
 *   Deliverable — what kinds of evidence were submitted in the window, by whom
 * All completion/submission figures follow the Day/Week/Month/Year navigator.
 */

import React from "react";
import Link from "next/link";
import { isWithinInterval, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  LayoutGrid,
  Loader2,
  Target,
  Users,
} from "lucide-react";
import {
  projects as projectsApi,
  users as usersApi,
  type Project,
  type Task,
  type User,
} from "@/lib/api-client";
import { PERIODS, periodWindow, type Period } from "@/lib/period";
import { classifyVerdict } from "@/components/team-member/derive";
import { deliverableTypeIcons, deliverableTypeLabels } from "@/components/team-member/shared";
import { cn } from "@/lib/utils";

// One judgeable unit of work: a milestone, or a task without milestones.
type WorkUnit = {
  id: string;
  status: string; // planning|pending / in_progress / completed / blocked
  projectId: string;
  memberId: string;
  completedAt?: string | null;
  verdictKey: ReturnType<typeof classifyVerdict>;
  actualHours: number;
};

type Evidence = {
  id: string;
  type: string; // deliverable_type, or "link" for url-only attachments
  submittedAt?: string | null;
  memberId: string;
  projectId: string;
};

type MemberData = { user: User; tasks: Task[] };

const STATUS_SEGMENTS = [
  { key: "in_progress", label: "In progress", bar: "bg-blue-500" },
  { key: "open", label: "Not started", bar: "bg-slate-300" },
  { key: "blocked", label: "Blocked", bar: "bg-red-500" },
  { key: "done", label: "Done in window", bar: "bg-emerald-500" },
] as const;

function normUnitStatus(s: string): "in_progress" | "open" | "blocked" | "completed" {
  if (s === "in_progress") return "in_progress";
  if (s === "blocked") return "blocked";
  if (s === "completed") return "completed";
  return "open"; // planning / pending / anything legacy
}

export function TeamDeliveryBoard({ members }: { members: User[] }) {
  const [mode, setMode] = React.useState<"status" | "project" | "deliverable">("status");
  const [period, setPeriod] = React.useState<Period>("week");
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<MemberData[]>([]);
  const [projectById, setProjectById] = React.useState<Record<string, Project>>({});

  const memberIds = members.map((m) => m.id).join(",");
  React.useEffect(() => {
    if (members.length === 0) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([
      projectsApi.list().then((r) => r.projects).catch(() => [] as Project[]),
      // One fn_task_full fetch per member — bounded to keep large orgs sane.
      Promise.all(
        members.slice(0, 40).map((m) =>
          usersApi
            .tasks(m.id)
            .then((r) => ({ user: m, tasks: r.tasks }))
            .catch(() => ({ user: m, tasks: [] as Task[] })),
        ),
      ),
    ]).then(([projects, memberData]) => {
      if (!alive) return;
      setProjectById(Object.fromEntries(projects.map((p) => [p.id, p])));
      setData(memberData);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

  const win = periodWindow(period, offset);
  const inWindow = React.useCallback(
    (d?: string | null) =>
      !!d && isWithinInterval(parseISO(d), { start: win.start, end: win.end }),
    [win.start, win.end],
  );

  // Flatten every member's tasks into work units + evidence rows.
  const { unitsByMember, evidence } = React.useMemo(() => {
    const unitsByMember = new Map<string, WorkUnit[]>();
    const evidence: Evidence[] = [];
    const seenEvidence = new Set<string>();
    for (const { user, tasks } of data) {
      const units: WorkUnit[] = [];
      for (const t of tasks) {
        const milestones = t.milestones ?? [];
        if (milestones.length > 0) {
          for (const m of milestones) {
            units.push({
              id: m.id,
              status: m.status,
              projectId: t.project_id,
              memberId: user.id,
              completedAt: m.completed_at,
              verdictKey: classifyVerdict(m.outcome),
              actualHours: m.actual_hours ?? 0,
            });
            for (const d of m.deliverables ?? []) {
              if (seenEvidence.has(d.id)) continue;
              seenEvidence.add(d.id);
              evidence.push({
                id: d.id, type: d.type, submittedAt: d.submitted_at ?? d.created_at,
                memberId: d.submitted_by ?? user.id, projectId: t.project_id,
              });
            }
            for (const a of m.attachments ?? []) {
              if (!a.url || seenEvidence.has(a.id)) continue;
              seenEvidence.add(a.id);
              evidence.push({
                id: a.id, type: "link", submittedAt: a.created_at,
                memberId: user.id, projectId: t.project_id,
              });
            }
          }
        } else {
          units.push({
            id: t.id,
            status: t.status,
            projectId: t.project_id,
            memberId: user.id,
            completedAt: t.completed_at,
            verdictKey: classifyVerdict(t.outcome),
            actualHours: t.actual_hours ?? 0,
          });
          for (const d of t.deliverables ?? []) {
            if (seenEvidence.has(d.id)) continue;
            seenEvidence.add(d.id);
            evidence.push({
              id: d.id, type: d.type, submittedAt: d.submitted_at ?? d.created_at,
              memberId: d.submitted_by ?? user.id, projectId: t.project_id,
            });
          }
        }
      }
      unitsByMember.set(user.id, units);
    }
    return { unitsByMember, evidence };
  }, [data]);

  // Segment counts for a set of units under the current window.
  const segment = React.useCallback(
    (units: WorkUnit[]) => {
      const c = { in_progress: 0, open: 0, blocked: 0, done: 0 };
      for (const u of units) {
        const s = normUnitStatus(u.status);
        if (s === "completed") {
          if (inWindow(u.completedAt)) c.done++;
        } else {
          c[s]++;
        }
      }
      return c;
    },
    [inWindow],
  );

  // Window-scoped team summary (units deduped across shared tasks).
  const summary = React.useMemo(() => {
    const seen = new Set<string>();
    let done = 0;
    let met = 0;
    let judged = 0;
    let hours = 0;
    for (const units of unitsByMember.values()) {
      for (const u of units) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        if (normUnitStatus(u.status) === "completed" && inWindow(u.completedAt)) {
          done++;
          hours += u.actualHours;
          if (u.verdictKey !== "unrecorded" && u.verdictKey !== "unclassified") {
            judged++;
            if (u.verdictKey === "met") met++;
          }
        }
      }
    }
    const evidenceInWindow = evidence.filter((e) => inWindow(e.submittedAt)).length;
    return {
      done,
      evidence: evidenceInWindow,
      metPct: judged > 0 ? Math.round((met / judged) * 100) : null,
      hours: Math.round(hours * 10) / 10,
    };
  }, [unitsByMember, evidence, inWindow]);

  const memberById = React.useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      {/* Header: title · mode switch · window navigator */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-3.5 pb-2 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-purple-100 bg-purple-50">
            <LayoutGrid className="h-3.5 w-3.5 text-purple-600" />
          </span>
          Team Delivery Board
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                { id: "status", label: "Status" },
                { id: "project", label: "Project" },
                { id: "deliverable", label: "Deliverable" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mode === m.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  setOffset(0);
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  period === p.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label={`Previous ${period}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOffset(0)}
              disabled={offset === 0}
              className={cn(
                "min-w-[104px] rounded-md border px-2 py-1 text-center text-[11px] font-semibold",
                offset === 0
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
              )}
              title={offset === 0 ? undefined : "Back to current"}
            >
              {win.label}
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset === 0}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none"
              aria-label={`Next ${period}`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team delivery data…
        </div>
      ) : (
        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Window summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 border border-emerald-100 px-2.5 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.done}</span> completed
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.evidence}</span> deliverables
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 border border-indigo-100 px-2.5 py-1.5">
              <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">
                  {summary.metPct === null ? "—" : `${summary.metPct}%`}
                </span>{" "}
                outcomes met
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-50/60 border border-violet-100 px-2.5 py-1.5">
              <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span className="text-[11px] text-slate-600">
                <span className="stat-number font-extrabold text-slate-900">{summary.hours}h</span> logged
              </span>
            </div>
          </div>

          {/* Legend (status & project lenses share it) */}
          {mode !== "deliverable" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {STATUS_SEGMENTS.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                  {s.label}
                </span>
              ))}
            </div>
          )}

          {/* ── Lens: per member ── */}
          {mode === "status" && (
            <div className="space-y-1.5">
              {data.map(({ user }) => {
                const units = unitsByMember.get(user.id) ?? [];
                const c = segment(units);
                const total = c.in_progress + c.open + c.blocked + c.done;
                return (
                  <Link
                    key={user.id}
                    href={`/team/${user.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
                  >
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: user.avatar_color || "#64748b" }}
                    >
                      {user.name?.[0] ?? "?"}
                    </div>
                    <span className="w-36 truncate text-xs font-medium text-slate-800 shrink-0">{user.name}</span>
                    <div className="flex h-2.5 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                      {total > 0 &&
                        STATUS_SEGMENTS.map((s) => {
                          const v = c[s.key === "done" ? "done" : s.key];
                          if (!v) return null;
                          return (
                            <div
                              key={s.key}
                              className={s.bar}
                              style={{ width: `${(v / total) * 100}%` }}
                              title={`${v} ${s.label.toLowerCase()}`}
                            />
                          );
                        })}
                    </div>
                    <span className="w-40 text-right text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {c.done} done · {c.in_progress} active · {c.blocked} blocked
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Lens: per project ── */}
          {mode === "project" && (
            <div className="space-y-1.5">
              {(() => {
                const byProject = new Map<string, { units: WorkUnit[]; memberIds: Set<string> }>();
                const seen = new Set<string>();
                for (const units of unitsByMember.values()) {
                  for (const u of units) {
                    if (!byProject.has(u.projectId)) byProject.set(u.projectId, { units: [], memberIds: new Set() });
                    const g = byProject.get(u.projectId)!;
                    g.memberIds.add(u.memberId);
                    if (seen.has(u.id)) continue;
                    seen.add(u.id);
                    g.units.push(u);
                  }
                }
                const rows = [...byProject.entries()]
                  .map(([pid, g]) => ({ pid, ...g, c: segment(g.units) }))
                  .sort((a, b) => (b.c.done + b.c.in_progress) - (a.c.done + a.c.in_progress));
                if (rows.length === 0)
                  return <p className="py-6 text-center text-xs text-muted-foreground">No project work found.</p>;
                return rows.map(({ pid, memberIds: mids, c }) => {
                  const total = c.in_progress + c.open + c.blocked + c.done;
                  const title = projectById[pid]?.title ?? "Unknown project";
                  return (
                    <Link
                      key={pid}
                      href={`/projects/${pid}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-slate-200 hover:bg-slate-50/60 transition-colors"
                    >
                      <FolderKanban className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="w-44 truncate text-xs font-medium text-slate-800 shrink-0" title={title}>
                        {title}
                      </span>
                      <div className="flex h-2.5 flex-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                        {total > 0 &&
                          STATUS_SEGMENTS.map((s) => {
                            const v = c[s.key === "done" ? "done" : s.key];
                            if (!v) return null;
                            return (
                              <div
                                key={s.key}
                                className={s.bar}
                                style={{ width: `${(v / total) * 100}%` }}
                                title={`${v} ${s.label.toLowerCase()}`}
                              />
                            );
                          })}
                      </div>
                      <div className="flex -space-x-1.5 shrink-0">
                        {[...mids].slice(0, 5).map((mid) => {
                          const m = memberById[mid];
                          if (!m) return null;
                          return (
                            <span
                              key={mid}
                              className="h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ backgroundColor: m.avatar_color || "#64748b" }}
                              title={m.name}
                            >
                              {m.name?.[0] ?? "?"}
                            </span>
                          );
                        })}
                        {mids.size > 5 && (
                          <span className="h-5 w-5 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                            +{mids.size - 5}
                          </span>
                        )}
                      </div>
                      <span className="w-24 text-right text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {c.done} done
                      </span>
                    </Link>
                  );
                });
              })()}
            </div>
          )}

          {/* ── Lens: deliverable types submitted in window ── */}
          {mode === "deliverable" && (
            <div className="space-y-1.5">
              {(() => {
                const rows = new Map<string, { count: number; memberIds: Set<string> }>();
                for (const e of evidence) {
                  if (!inWindow(e.submittedAt)) continue;
                  if (!rows.has(e.type)) rows.set(e.type, { count: 0, memberIds: new Set() });
                  const r = rows.get(e.type)!;
                  r.count++;
                  r.memberIds.add(e.memberId);
                }
                const sorted = [...rows.entries()].sort((a, b) => b[1].count - a[1].count);
                if (sorted.length === 0)
                  return (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No deliverables submitted in {win.label.toLowerCase()} — use ‹ › to look at earlier {period}s.
                    </p>
                  );
                const max = sorted[0][1].count;
                return sorted.map(([type, r]) => (
                  <div key={type} className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2">
                    <span className="text-sm shrink-0">{deliverableTypeIcons[type] || "🔗"}</span>
                    <span className="w-40 truncate text-xs font-medium text-slate-800 shrink-0">
                      {type === "link" ? "File / Link" : deliverableTypeLabels[type] || type}
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </div>
                    <div className="flex -space-x-1.5 shrink-0">
                      {[...r.memberIds].slice(0, 5).map((mid) => {
                        const m = memberById[mid];
                        if (!m) return null;
                        return (
                          <span
                            key={mid}
                            className="h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: m.avatar_color || "#64748b" }}
                            title={m.name}
                          >
                            {m.name?.[0] ?? "?"}
                          </span>
                        );
                      })}
                    </div>
                    <span className="w-10 text-right text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                      {r.count}
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
