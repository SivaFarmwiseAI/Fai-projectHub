"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, FolderKanban, ArrowRight, Search, SlidersHorizontal, X, Download } from "lucide-react";
import { addDays, differenceInDays, formatDistanceToNow } from "date-fns";
import { computeHealthScore } from "@/lib/health-score";
import { projectsToCSVRows, toCSV, downloadCSV } from "@/lib/export";
import { showToast } from "@/lib/toast";

const typeColors: Record<string, string> = {
  engineering:"text-blue-700 border-blue-200 bg-blue-50",research:"text-purple-700 border-purple-200 bg-purple-50",
  mixed:"text-teal-700 border-teal-200 bg-teal-50",data_science:"text-violet-700 border-violet-200 bg-violet-50",
  design:"text-pink-700 border-pink-200 bg-pink-50",sales:"text-orange-700 border-orange-200 bg-orange-50",
  marketing:"text-rose-700 border-rose-200 bg-rose-50",operations:"text-slate-700 border-slate-200 bg-slate-50",
  hr:"text-cyan-700 border-cyan-200 bg-cyan-50",legal:"text-gray-700 border-gray-200 bg-gray-50",
  strategy:"text-indigo-700 border-indigo-200 bg-indigo-50",product:"text-emerald-700 border-emerald-200 bg-emerald-50",
  finance:"text-amber-700 border-amber-200 bg-amber-50",
};
const typeLabels: Record<string, string> = {
  engineering:"Eng",research:"Research",mixed:"Mixed",data_science:"DS",design:"Design",
  sales:"Sales",marketing:"Mktg",operations:"Ops",hr:"HR",legal:"Legal",
  strategy:"Strategy",product:"Product",finance:"Finance",
};
const statusColors: Record<string, string> = {
  active:"text-emerald-700 border-emerald-200 bg-emerald-50",
  completed:"text-green-700 border-green-200 bg-green-50",
  killed:"text-red-700 border-red-200 bg-red-50",
};
const priorityConfig: Record<string, { color: string; bg: string }> = {
  low:{color:"#64748b",bg:"#f1f5f9"},medium:{color:"#3b82f6",bg:"#eff6ff"},
  high:{color:"#f59e0b",bg:"#fffbeb"},critical:{color:"#ef4444",bg:"#fef2f2"},
};

export function ProjectsListClient({ projects }: { projects: any[] }) {
  const [filterType, setFilterType]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]             = useState("");
  const [showFilters, setShowFilters]   = useState(false);

  const hasFilters = filterType !== "all" || filterStatus !== "all" || search;
  const filtered   = projects.filter((p) => {
    if (filterType !== "all" && p.type !== filterType)       return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 animate-fade-in-up">
        <div>
          <h1 className="text-display text-slate-900">Projects</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {projects.length} total{filtered.length !== projects.length ? ` · ${filtered.length} shown` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const csv = toCSV(projectsToCSVRows(projects as any));
              downloadCSV(csv, `projects-${new Date().toISOString().split("T")[0]}.csv`);
              showToast.success("Projects exported as CSV");
            }}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all flex items-center gap-1.5 text-sm font-semibold"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <Link href="/projects/new">
            <Button className="gap-2 btn-gradient text-white border-0 shadow-glow-blue rounded-xl h-10 px-4 text-sm font-semibold">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────── */}
      <div className="animate-fade-in-up stagger-1">
        {/* Search + toggle row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text" placeholder="Search projects…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal input-focus-ring outline-none shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`h-10 px-3 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-all shrink-0 ${
              showFilters || (filterType !== "all" || filterStatus !== "all")
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {(filterType !== "all" || filterStatus !== "all") && (
              <span className="h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                {(filterType !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm animate-scale-in">
            <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl border-slate-200 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="research">Research/DS</SelectItem>
                <SelectItem value="data_science">Data Science</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl border-slate-200 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="killed">Killed</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <button onClick={() => { setFilterType("all"); setFilterStatus("all"); setSearch(""); }}
                className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1">
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── List ──────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 animate-fade-in-up">
          <FolderKanban className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No projects match your filters</p>
          <button onClick={() => { setFilterType("all"); setFilterStatus("all"); setSearch(""); }}
            className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in-up stagger-2">
          {filtered.map((project, i) => {
            const completedPhases = project.phases.filter((p: any) => p.status === "completed").length;
            const progress  = project.phases.length ? Math.round(completedPhases / project.phases.length * 100) : 0;
            const daysLeft  = differenceInDays(addDays(new Date(project.startDate), project.timeboxDays), new Date());
            const isOverdue = daysLeft < 0 && project.status === "active";
            const pc        = priorityConfig[project.priority] ?? priorityConfig.medium;
            const health    = computeHealthScore(project as any);

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="bg-white rounded-2xl border cursor-pointer group transition-all duration-200 hover:shadow-card-hover hover:-translate-y-px"
                  style={{ borderColor: isOverdue ? "rgba(239,68,68,0.18)" : "rgba(0,0,0,0.06)", animationDelay: `${i * 25}ms` }}>

                  {/* ── Mobile layout (stacked) ──────────── */}
                  <div className="flex sm:hidden flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pc.bg }}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pc.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {project.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge variant="outline" className={`${typeColors[project.type] ?? ""} text-[10px] py-0`}>
                              {typeLabels[project.type] ?? project.type}
                            </Badge>
                            <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] py-0`}>
                              {project.status}
                            </Badge>
                            {isOverdue && <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 text-[10px] py-0">Overdue</Badge>}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 mt-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>{project.currentPhase || "—"}</span>
                        <span className="text-slate-600">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${progress}%`, background: progress >= 80 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                        <Clock className="h-3 w-3" />
                        {project.status === "active" ? (
                          isOverdue ? <span className="text-red-500 font-bold">{Math.abs(daysLeft)}d overdue</span>
                            : <span>{daysLeft}d left</span>
                        ) : <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>}
                      </div>
                      <div className="flex -space-x-1.5">
                        {project.assignees.slice(0, 3).map((a: any) => (
                          <div key={a.user.id} className="h-5 w-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ backgroundColor: a.user.avatarColor }}>{a.user.name[0]}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Desktop layout (row) ─────────────── */}
                  <div className="hidden sm:flex items-center gap-4 px-4 py-3.5">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: pc.bg }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {project.title}
                        </span>
                        <Badge variant="outline" className={`${typeColors[project.type] ?? ""} text-[10px] py-0 font-semibold shrink-0`}>
                          {typeLabels[project.type] ?? project.type}
                        </Badge>
                        <Badge variant="outline" className={`${statusColors[project.status]} text-[10px] py-0 font-semibold shrink-0`}>
                          {project.status}
                        </Badge>
                        {isOverdue && <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 text-[10px] py-0 shrink-0">Overdue</Badge>}
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 truncate">{project.requirement}</p>
                    </div>
                    <div className="w-28 shrink-0 hidden md:block">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400 mb-1">
                        <span className="truncate max-w-[60px]">{project.currentPhase || "—"}</span>
                        <span className="text-slate-600">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: progress >= 80 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-medium shrink-0 w-24 justify-end">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {project.status === "active" ? (
                        isOverdue ? <span className="text-red-500 font-bold">{Math.abs(daysLeft)}d overdue</span>
                          : <span className="text-slate-500">{daysLeft}d left</span>
                      ) : <span className="text-slate-400">{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>}
                    </div>
                    <div className="flex -space-x-1.5 shrink-0">
                      {project.assignees.slice(0, 3).map((a: any) => (
                        <div key={a.user.id} className="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: a.user.avatarColor }}>{a.user.name[0]}</div>
                      ))}
                    </div>
                    {/* Health score badge */}
                    <div className={`shrink-0 hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${health.bg} ${health.color} ${health.border}`}
                      title={`Health: ${health.score}/100`}>
                      {health.grade} <span className="font-normal opacity-70">{health.score}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
