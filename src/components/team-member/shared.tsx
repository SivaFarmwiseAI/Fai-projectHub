"use client";

/**
 * Shared presentational primitives + status/color vocabularies for the team
 * member detail view (/team/[id]). Pure display — all data derivation lives
 * in ./derive.ts.
 */

import React from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  PauseCircle,
  Target,
  XCircle,
} from "lucide-react";
import type { Deliverable } from "@/lib/api-client";
import type { DailyActivityItem, DailyActivityKind } from "./derive";

// ── Status vocabularies ──────────────────────────────────────────────────────

export const taskStatusColors: Record<string, string> = {
  planning: "text-slate-700 border-slate-200 bg-slate-50",
  in_progress: "text-blue-700 border-blue-200 bg-blue-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  blocked: "text-red-700 border-red-200 bg-red-50",
  killed: "text-gray-700 border-gray-200 bg-gray-50",
  redefined: "text-purple-700 border-purple-200 bg-purple-50",
};

export const taskStatusIcons: Record<string, React.ReactNode> = {
  planning: <CircleDot className="h-3 w-3" />,
  in_progress: <Activity className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  blocked: <PauseCircle className="h-3 w-3" />,
  killed: <XCircle className="h-3 w-3" />,
  redefined: <Target className="h-3 w-3" />,
};

export const milestoneStatusColors: Record<string, string> = {
  pending: "text-slate-700 border-slate-200 bg-slate-50",
  in_progress: "text-blue-700 border-blue-200 bg-blue-50",
  completed: "text-green-700 border-green-200 bg-green-50",
  blocked: "text-red-700 border-red-200 bg-red-50",
};

export const milestoneStatusIcons: Record<string, React.ReactNode> = {
  pending: <CircleDot className="h-3 w-3" />,
  in_progress: <Activity className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  blocked: <PauseCircle className="h-3 w-3" />,
};

export const extensionStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  approved: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
  auto_escalated: "text-red-700 border-red-200 bg-red-50",
};

export const leaveTypeColors: Record<string, string> = {
  planned: "text-blue-700 border-blue-200 bg-blue-50",
  sick: "text-red-700 border-red-200 bg-red-50",
  personal: "text-purple-700 border-purple-200 bg-purple-50",
  wfh: "text-teal-700 border-teal-200 bg-teal-50",
  half_day: "text-amber-700 border-amber-200 bg-amber-50",
};

export const leaveStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  approved: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
};

export const deliverableStatusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  submitted: "text-blue-700 border-blue-200 bg-blue-50",
  verified: "text-green-700 border-green-200 bg-green-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
};

export const deliverableTypeIcons: Record<string, string> = {
  demo: "🎬",
  ppt: "📄",
  document: "📄",
  code: "💻",
  data: "📊",
  text: "✅",
  meeting_notes: "✅",
};

export const deliverableTypeLabels: Record<string, string> = {
  demo: "Demo/Presentation",
  ppt: "PPT/Document",
  document: "Document",
  code: "Code Delivery",
  data: "Data/Report",
  text: "Sign-off/Review",
  meeting_notes: "Meeting Notes",
};

/** Outcome verdict presentation (met / partially_met / not_met / deferred +
 *  the tolerant buckets for legacy free-text values). */
export const verdictMeta: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  met: {
    label: "Met",
    badge: "text-green-700 border-green-200 bg-green-50",
    dot: "bg-green-500",
  },
  partially_met: {
    label: "Partially met",
    badge: "text-amber-700 border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
  },
  not_met: {
    label: "Not met",
    badge: "text-red-700 border-red-200 bg-red-50",
    dot: "bg-red-500",
  },
  deferred: {
    label: "Deferred",
    badge: "text-slate-700 border-slate-200 bg-slate-100",
    dot: "bg-slate-400",
  },
  unclassified: {
    label: "Recorded",
    badge: "text-indigo-700 border-indigo-200 bg-indigo-50",
    dot: "bg-indigo-400",
  },
  unrecorded: {
    label: "No verdict",
    badge: "text-slate-500 border-slate-200 bg-slate-50",
    dot: "bg-slate-300",
  },
};

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtHrs(h?: number | null): string {
  if (h == null) return "—";
  return `${Math.round(h * 10) / 10}h`;
}

// ── Small presentational blocks ──────────────────────────────────────────────

export function KpiTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`stat-number text-2xl font-extrabold mt-1 ${color ?? "text-slate-900"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function HoursBar({
  label,
  hours,
  max,
  color,
}: {
  label: string;
  hours: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono text-slate-500">{fmtHrs(hours)}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (hours / max) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function WeekStat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 py-2">
      <p className={`text-lg font-bold tabular-nums ${color ?? "text-slate-800"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function DailyActivityList({
  items,
  empty,
}: {
  items: DailyActivityItem[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{empty}</p>;
  }
  const style: Record<DailyActivityKind, { icon: React.ReactNode; text: string }> = {
    done: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />, text: "text-slate-700" },
    update: { icon: <Activity className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />, text: "text-slate-700" },
    due: { icon: <Calendar className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />, text: "text-amber-700 font-medium" },
    in_progress: { icon: <Clock className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />, text: "text-slate-700" },
    blocked: { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />, text: "text-red-700 font-medium" },
  };
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const s = style[item.kind];
        return (
          <li key={item.id} className="flex items-start gap-2">
            {s.icon}
            <div className="min-w-0">
              <span className={`text-sm ${s.text}`}>{item.text}</span>
              {item.sub && <span className="block text-[11px] text-muted-foreground truncate">{item.sub}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Clickable deliverable evidence pill (opens document/PR/repo link). */
export function AttachmentPill({ d }: { d: Deliverable }) {
  const href = d.document_url || d.code_pr_url || d.code_repo_url;
  const label = d.title || deliverableTypeLabels[d.type] || d.type;
  const statusCls = deliverableStatusColors[d.status] || deliverableStatusColors.pending;
  const inner = (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 transition-colors">
      <span className="shrink-0">{deliverableTypeIcons[d.type] || "📎"}</span>
      <span className="truncate max-w-[150px] font-medium">{label}</span>
      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold border ${statusCls}`}>{d.status}</span>
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
