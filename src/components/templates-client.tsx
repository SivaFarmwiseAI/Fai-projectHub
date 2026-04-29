"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate, Clock, Users, ChevronRight, Check,
  Layers, Search, ArrowRight, Plus, Tag,
} from "lucide-react";
import { PROJECT_TEMPLATES, getTemplatesByCategory, ProjectTemplate } from "@/lib/templates-data";
import { projects as projectsApi } from "@/lib/api-client";
import type { Project } from "@/lib/api-client";
import { showToast } from "@/lib/toast";

const CATEGORIES = [
  { id: "all",          label: "All",          count: PROJECT_TEMPLATES.length },
  { id: "engineering",  label: "Engineering",  count: PROJECT_TEMPLATES.filter(t => t.category === "engineering").length },
  { id: "data_science", label: "Data Science", count: PROJECT_TEMPLATES.filter(t => t.category === "data_science").length },
  { id: "design",       label: "Design",       count: PROJECT_TEMPLATES.filter(t => t.category === "design").length },
  { id: "research",     label: "Research",     count: PROJECT_TEMPLATES.filter(t => t.category === "research").length },
  { id: "strategy",     label: "Strategy",     count: PROJECT_TEMPLATES.filter(t => t.category === "strategy").length },
  { id: "marketing",    label: "Marketing",    count: PROJECT_TEMPLATES.filter(t => t.category === "marketing").length },
];

/* ── Template Card ───────────────────────────────────────── */
function TemplateCard({
  template,
  onPreview,
  onUse,
  liveUses,
}: {
  template: ProjectTemplate;
  onPreview: (t: ProjectTemplate) => void;
  onUse: (t: ProjectTemplate) => void;
  liveUses?: number;
}) {
  return (
    <div
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden flex flex-col"
    >
      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: template.color }} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${template.color}15` }}>
            {template.icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${template.color}15`, color: template.color }}>
            {template.category.replace("_", " ")}
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-slate-900 leading-tight mb-1.5">{template.name}</h3>
        <p className="text-sm text-slate-500 leading-relaxed flex-1 line-clamp-2">{template.description}</p>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{template.timeboxDays}d timebox</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>{template.phases.length} phases</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Users className="h-3.5 w-3.5" />
            <span>{liveUses ?? 0} active</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {template.tags.map(tag => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              #{tag}
            </span>
          ))}
        </div>

        {/* Phase preview */}
        <div className="flex items-center gap-1 mt-3 overflow-hidden">
          {template.phases.map((ph, i) => (
            <div key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
              <span className="text-[10px] text-slate-400 truncate">{ph.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex gap-2">
        <button
          onClick={() => onPreview(template)}
          className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all"
        >
          Preview
        </button>
        <button
          onClick={() => onUse(template)}
          className="flex-1 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:brightness-105 active:scale-95"
          style={{ background: template.color }}
        >
          <Plus className="h-3.5 w-3.5" />
          Use Template
        </button>
      </div>
    </div>
  );
}

/* ── Preview Modal ───────────────────────────────────────── */
function PreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: ProjectTemplate;
  onClose: () => void;
  onUse: (t: ProjectTemplate) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-slate-100">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${template.color}15` }}>
            {template.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{template.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{template.description}</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Timebox", value: `${template.timeboxDays} days` },
              { label: "Phases", value: template.phases.length },
              { label: "Sample Tasks", value: template.sampleTasks.length },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl border border-slate-100">
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Phases */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Phases</h3>
            <div className="space-y-3">
              {template.phases.map((ph, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: template.color }}>
                      {i + 1}
                    </div>
                    {i < template.phases.length - 1 && (
                      <div className="w-0.5 flex-1 mt-1" style={{ background: `${template.color}30` }} />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800">{ph.name}</p>
                      <span className="text-[10px] text-slate-400">{ph.estimatedDuration}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{ph.description}</p>
                    <div className="space-y-1">
                      {ph.checklist.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-slate-500">
                          <Check className="h-3 w-3 shrink-0" style={{ color: template.color }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Tasks */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Sample Tasks</h3>
            <div className="space-y-2">
              {template.sampleTasks.map((task, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: template.color }}>
                    T{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{task.estimatedHours}h · {task.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI hint */}
          <div className="p-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/50">
            <p className="text-xs font-semibold text-blue-700 mb-1">AI Prompt Suggestion</p>
            <p className="text-sm text-blue-800 italic">"{template.aiPromptHint}"</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
            Close
          </button>
          <button
            onClick={() => { onClose(); onUse(template); }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-105"
            style={{ background: template.color }}
          >
            <Plus className="h-4 w-4" />
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export function TemplatesClient() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ProjectTemplate | null>(null);
  const [projectList, setProjectList] = useState<Project[]>([]);

  useEffect(() => {
    projectsApi.list({ limit: 100 }).then(r => setProjectList(r.projects)).catch(() => {});
  }, []);

  // Compute live usage count per template category from real projects
  const usageByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    projectList.forEach(p => {
      map[p.type] = (map[p.type] ?? 0) + 1;
    });
    return map;
  }, [projectList]);

  const filtered = getTemplatesByCategory(activeCategory).filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  function handleUse(template: ProjectTemplate) {
    // Navigate to new project wizard with template params in URL
    const params = new URLSearchParams({
      template: template.id,
      category: template.category,
      timebox: template.timeboxDays.toString(),
      requirement: template.aiPromptHint,
    });
    showToast.success(`Template loaded: ${template.name}`, "Fill in the details to create your project.");
    router.push(`/projects/new?${params.toString()}`);
  }

  return (
    <>
      {preview && (
        <PreviewModal
          template={preview}
          onClose={() => setPreview(null)}
          onUse={handleUse}
        />
      )}

      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <LayoutTemplate className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Project Templates</h1>
            </div>
            <p className="text-sm text-slate-500">
              {PROJECT_TEMPLATES.length} templates — pick one to launch faster ·{" "}
              <span className="font-medium text-slate-700">{projectList.length} active projects</span>
            </p>
          </div>
        </div>

        {/* ── Search + Filters ────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}>
                {cat.label}
                <span className={`ml-1.5 ${activeCategory === cat.id ? "text-slate-400" : "text-slate-400"}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={setPreview}
                onUse={handleUse}
                liveUses={usageByCategory[template.category]}
              />
            ))}
          </div>
        )}

        {/* ── Recently used from PROJECTS ─────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            Active Projects by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["engineering", "data_science", "design", "research", "marketing", "strategy", "operations", "product"].map(cat => {
              const count = projectList.filter(p => p.type === cat && p.status === "active").length;
              return (
                <div key={cat} className="text-center p-3 rounded-xl border border-slate-50 bg-slate-50/60">
                  <p className="text-lg font-bold text-slate-900">{count}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{cat.replace("_", " ")}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
