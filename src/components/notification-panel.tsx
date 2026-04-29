"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell, X, CheckCheck, AlertTriangle, Clock, Users,
  MessageSquare, CalendarDays, ClipboardCheck, Flag,
  ChevronRight, Sparkles,
} from "lucide-react";
import { analytics } from "@/lib/api-client";
import type { Notification as ApiNotif } from "@/lib/api-client";
import type { Notification, NotifType, NotifPriority } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/* ── Type mappings ───────────────────────────────────────── */
const TYPE_LINKS: Record<string, string> = {
  review_requested:     "/reviews",
  deadline_approaching: "/projects",
  blocker_flagged:      "/",
  standup_missing:      "/standup",
  leave_approved:       "/team/availability",
  extension_requested:  "/",
  discussion_mention:   "/discussions",
  milestone_reached:    "/projects",
  project_at_risk:      "/projects",
};

const TYPE_PRIORITY: Record<string, NotifPriority> = {
  review_requested:     "high",
  deadline_approaching: "high",
  blocker_flagged:      "critical",
  project_at_risk:      "critical",
  standup_missing:      "medium",
  leave_approved:       "low",
  extension_requested:  "high",
  discussion_mention:   "medium",
  milestone_reached:    "low",
};

function mapApiNotif(n: ApiNotif): Notification {
  return {
    id:          n.id,
    type:        n.type as NotifType,
    priority:    TYPE_PRIORITY[n.type] ?? "medium",
    title:       n.title,
    description: n.message ?? "",
    link:        TYPE_LINKS[n.type],
    time:        new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    read:        n.is_read,
  };
}

/* ── Icon per notification type ─────────────────────────── */
const TYPE_ICONS: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  review_requested:     { icon: ClipboardCheck, color: "#ef4444", bg: "#fef2f2" },
  deadline_approaching: { icon: Clock,          color: "#f97316", bg: "#fff7ed" },
  blocker_flagged:      { icon: AlertTriangle,  color: "#ef4444", bg: "#fef2f2" },
  standup_missing:      { icon: Users,          color: "#f59e0b", bg: "#fffbeb" },
  leave_approved:       { icon: CalendarDays,   color: "#10b981", bg: "#f0fdf4" },
  extension_requested:  { icon: Flag,           color: "#8b5cf6", bg: "#f5f3ff" },
  discussion_mention:   { icon: MessageSquare,  color: "#3b82f6", bg: "#eff6ff" },
  milestone_reached:    { icon: Sparkles,       color: "#10b981", bg: "#f0fdf4" },
  project_at_risk:      { icon: AlertTriangle,  color: "#ef4444", bg: "#fef2f2" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#94a3b8"
};

/* ── Notification Item ───────────────────────────────────── */
function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const cfg = TYPE_ICONS[notif.type] ?? TYPE_ICONS.review_requested;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer relative",
        !notif.read && "bg-blue-50/40"
      )}
      onClick={() => onRead(notif.id)}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="absolute left-2 top-4 h-1.5 w-1.5 rounded-full"
          style={{ background: PRIORITY_DOT[notif.priority] }} />
      )}

      {/* Icon */}
      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.bg }}>
        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-tight", notif.read ? "text-slate-600" : "text-slate-900 font-semibold")}>
          {notif.title}
        </p>
        {notif.description && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.description}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-1">{notif.time}</p>
      </div>

      {/* Link arrow */}
      {notif.link && (
        <Link href={notif.link} onClick={e => e.stopPropagation()}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0 mt-1">
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ── Bell trigger button ─────────────────────────────────── */
export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const panelRef            = useRef<HTMLDivElement>(null);

  useEffect(() => {
    analytics.notifications()
      .then(r => setNotifs(r.notifications.map(mapApiNotif)))
      .catch(() => setNotifs([]));
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifs.filter(n => !n.read).length;

  function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative flex items-center gap-2 rounded-xl transition-all",
          collapsed
            ? "h-9 w-9 justify-center text-slate-400 hover:bg-white/10 hover:text-slate-200"
            : "h-9 px-3 text-slate-400 hover:bg-white/10 hover:text-slate-200 w-full"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="text-sm font-medium">Notifications</span>}
        {unreadCount > 0 && (
          <span className={cn(
            "absolute flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-white",
            collapsed ? "-top-0.5 -right-0.5 h-4 w-4" : "top-1.5 right-2 h-4 min-w-4 px-0.5"
          )}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/80 overflow-hidden z-50 animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="h-5 px-1.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
                  <CheckCheck className="h-3 w-3" />
                  All read
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="ml-2 h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center">
                  <CheckCheck className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm text-slate-500 font-medium">All caught up!</p>
              </div>
            ) : (
              notifs.map(n => <NotifItem key={n.id} notif={n} onRead={markRead} />)
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
            <p className="text-[10px] text-slate-400 text-center">
              Live from backend · {notifs.length} notification{notifs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
