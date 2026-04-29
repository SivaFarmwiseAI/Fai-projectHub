"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, FolderKanban, Users, CalendarDays,
  ClipboardCheck, MessageSquare, Activity, Sparkles, BarChart3,
  FileText, GanttChart, LayoutTemplate, Plus, ArrowRight,
  User as UserIcon, Hash, Zap, X,
} from "lucide-react";
import { projects as projectsApi, users as usersApi } from "@/lib/api-client";
import type { Project, User } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────── */
type ResultKind = "page" | "project" | "person" | "action";

type CommandResult = {
  id: string;
  kind: ResultKind;
  label: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  href?: string;
  action?: () => void;
  keywords?: string;
};

/* ── Static items ────────────────────────────────────────── */
const PAGES: CommandResult[] = [
  { id: "p-home",       kind: "page", label: "Command Center",      sub: "Overview",          icon: LayoutDashboard, iconColor: "#3b82f6", href: "/" },
  { id: "p-briefing",  kind: "page", label: "CEO Briefing",         sub: "Daily summary",     icon: FileText,        iconColor: "#6366f1", href: "/briefing" },
  { id: "p-analytics", kind: "page", label: "Analytics",            sub: "Charts & KPIs",     icon: BarChart3,       iconColor: "#10b981", href: "/analytics" },
  { id: "p-projects",  kind: "page", label: "All Projects",         sub: "Projects",          icon: FolderKanban,    iconColor: "#f59e0b", href: "/projects" },
  { id: "p-new",       kind: "page", label: "New Project",          sub: "Create",            icon: Plus,            iconColor: "#10b981", href: "/projects/new" },
  { id: "p-timeline",  kind: "page", label: "Timeline",             sub: "Gantt view",        icon: GanttChart,      iconColor: "#8b5cf6", href: "/projects/timeline" },
  { id: "p-templates", kind: "page", label: "Templates",            sub: "Project templates", icon: LayoutTemplate,  iconColor: "#ec4899", href: "/templates" },
  { id: "p-reviews",   kind: "page", label: "Review Queue",         sub: "Pending reviews",   icon: ClipboardCheck,  iconColor: "#ef4444", href: "/reviews" },
  { id: "p-standup",   kind: "page", label: "Daily Standup",        sub: "Team standup",      icon: Activity,        iconColor: "#06b6d4", href: "/standup" },
  { id: "p-discuss",   kind: "page", label: "Discussions",          sub: "Threads",           icon: MessageSquare,   iconColor: "#a855f7", href: "/discussions" },
  { id: "p-team",      kind: "page", label: "Team",                 sub: "Directory",         icon: Users,           iconColor: "#f97316", href: "/team" },
  { id: "p-avail",     kind: "page", label: "Leave & Availability", sub: "Team calendar",     icon: CalendarDays,    iconColor: "#14b8a6", href: "/team/availability" },
  { id: "p-capture",   kind: "page", label: "AI Capture",           sub: "Smart inbox",       icon: Sparkles,        iconColor: "#3b82f6", href: "/capture" },
  { id: "p-calendar",  kind: "page", label: "Calendar",             sub: "CEO calendar",      icon: CalendarDays,    iconColor: "#64748b", href: "/calendar" },
];

const KIND_LABEL: Record<ResultKind, string> = {
  page: "Pages", project: "Projects", person: "People", action: "Actions",
};

const KIND_ORDER: ResultKind[] = ["action", "page", "project", "person"];

/* ── Fuzzy score ─────────────────────────────────────────── */
function score(item: CommandResult, q: string): number {
  const hay = `${item.label} ${item.sub ?? ""} ${item.keywords ?? ""}`.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return 1;
  if (hay.startsWith(needle)) return 3;
  if (hay.includes(needle)) return 2;
  const words = needle.split(" ");
  if (words.every(w => hay.includes(w))) return 1;
  return 0;
}

/* ── Result row ──────────────────────────────────────────── */
function ResultRow({
  result, active, onClick,
}: { result: CommandResult; active: boolean; onClick: () => void }) {
  const Icon = result.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        active ? "bg-blue-50" : "hover:bg-slate-50"
      )}
    >
      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${result.iconColor}18` }}>
        <Icon className="h-3.5 w-3.5" style={{ color: result.iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", active ? "text-blue-700" : "text-slate-800")}>
          {result.label}
        </p>
        {result.sub && (
          <p className="text-xs text-slate-400 truncate">{result.sub}</p>
        )}
      </div>
      <span className={cn(
        "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0",
        active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
      )}>
        {result.kind}
      </span>
      <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", active ? "text-blue-400" : "text-slate-300")} />
    </button>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Load projects + users once palette is first opened */
  useEffect(() => {
    if (!open || projectList.length > 0) return;
    Promise.all([
      projectsApi.list().then(r => setProjectList(r.projects)).catch(() => {}),
      usersApi.list().then(r => setUserList(r.users)).catch(() => {}),
    ]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Build full item list dynamically */
  const allItems = useCallback((): CommandResult[] => {
    const projectItems: CommandResult[] = projectList.map(p => ({
      id: `proj-${p.id}`,
      kind: "project" as ResultKind,
      label: p.title,
      sub: `${p.type} · ${p.status}`,
      icon: FolderKanban,
      iconColor: "#f59e0b",
      href: `/projects/${p.id}`,
      keywords: p.requirement,
    }));

    const peopleItems: CommandResult[] = userList.map(u => ({
      id: `user-${u.id}`,
      kind: "person" as ResultKind,
      label: u.name,
      sub: `${u.role_type} · ${u.department}`,
      icon: UserIcon,
      iconColor: u.avatar_color,
      href: `/team/${u.id}`,
    }));

    const actionItems: CommandResult[] = [
      { id: "act-new",     kind: "action", label: "Create new project",  sub: "Open wizard",      icon: Plus,           iconColor: "#10b981", href: "/projects/new" },
      { id: "act-review",  kind: "action", label: "Go to review queue",  sub: "Pending reviews",  icon: ClipboardCheck, iconColor: "#ef4444", href: "/reviews" },
      { id: "act-standup", kind: "action", label: "Submit standup",      sub: "Daily check-in",   icon: Activity,       iconColor: "#06b6d4", href: "/standup" },
      { id: "act-capture", kind: "action", label: "Open AI Capture",     sub: "Parse text notes", icon: Sparkles,       iconColor: "#6366f1", href: "/capture" },
    ];

    return [...actionItems, ...PAGES, ...projectItems, ...peopleItems];
  }, [projectList, userList]);

  /* Filtered + ranked results */
  const results = query.trim()
    ? allItems()
        .map(item => ({ item, s: score(item, query) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind))
        .map(x => x.item)
        .slice(0, 10)
    : allItems().filter(i => i.kind === "action" || i.kind === "page").slice(0, 8);

  /* Navigate to selected result */
  const navigate = useCallback((result: CommandResult) => {
    setOpen(false);
    setQuery("");
    if (result.action) { result.action(); return; }
    if (result.href) router.push(result.href);
  }, [router]);

  /* Keyboard shortcut to open */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setActiveIdx(0);
    } else {
      setQuery("");
    }
  }, [open]);

  /* Keep active item scrolled into view */
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  /* Arrow key navigation */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) navigate(results[activeIdx]);
    }
  }

  if (!open) return null;

  /* Group results by kind */
  const groups: Record<string, CommandResult[]> = {};
  for (const r of results) {
    if (!groups[r.kind]) groups[r.kind] = [];
    groups[r.kind].push(r);
  }
  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: "rgba(15,15,30,0.6)", backdropFilter: "blur(6px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.06)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, projects, people…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")}
              className="h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
              <X className="h-3 w-3" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px] text-slate-400 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <Hash className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            KIND_ORDER.filter(k => groups[k]).map(kind => (
              <div key={kind}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {KIND_LABEL[kind]}
                </p>
                {groups[kind].map(result => {
                  const idx = flatIdx++;
                  return (
                    <ResultRow
                      key={result.id}
                      result={result}
                      active={idx === activeIdx}
                      onClick={() => navigate(result)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
          {[
            ["↑↓", "navigate"],
            ["↵", "select"],
            ["Esc", "close"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-mono text-slate-500 bg-white">
                {key}
              </kbd>
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] text-slate-400">{results.length} results</span>
        </div>
      </div>
    </div>
  );
}

/* ── Trigger hint shown in sidebar / top bar ─────────────── */
export function CommandPaletteTrigger({ collapsed = false }: { collapsed?: boolean }) {
  function open() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  }

  if (collapsed) {
    return (
      <button onClick={open}
        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all">
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button onClick={open}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300 transition-all group">
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left text-xs">Search everything…</span>
      <div className="flex items-center gap-0.5">
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-mono text-slate-500 bg-white/5 group-hover:border-white/20">
          Ctrl
        </kbd>
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-mono text-slate-500 bg-white/5 group-hover:border-white/20">
          K
        </kbd>
      </div>
    </button>
  );
}
