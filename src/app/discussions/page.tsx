"use client";

import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  MessageSquare, Pin, CheckCircle2, AlertCircle, Lightbulb,
  Megaphone, HelpCircle, ChevronDown, ChevronUp, Send, Plus,
  Search, X, FolderKanban, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { discussions as discussionsApi, projects as projectsApi } from "@/lib/api-client";
import type { Discussion, DiscussionMessage, Project } from "@/lib/api-client";

export default function DiscussionsPage() {
  const { user } = useAuth();
  const [threadList, setThreadList] = useState<Discussion[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const [sentReplies, setSentReplies] = useState<Set<string>>(new Set());

  const [newThread, setNewThread] = useState({ title: "", project_id: "" });
  const [newSubmitting, setNewSubmitting] = useState(false);
  const [newSubmitted, setNewSubmitted] = useState(false);

  useEffect(() => {
    Promise.all([
      discussionsApi.list().then(r => setThreadList(r.discussions)),
      projectsApi.list({ limit: 20 }).then(r => setProjectList(r.projects)),
    ]).finally(() => setLoading(false));
  }, []);

  function refreshDiscussions() {
    discussionsApi.list({ is_resolved: showResolved ? undefined : false }).then(r => setThreadList(r.discussions)).catch(() => {});
  }

  const filtered = threadList.filter(d => {
    if (!showResolved && d.is_resolved) return false;
    if (filterProject !== "all") {
      if (filterProject === "general" && d.project_id != null) return false;
      if (filterProject !== "general" && d.project_id !== filterProject) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.title.toLowerCase().includes(q);
    }
    return true;
  });

  const openCount = threadList.filter(d => !d.is_resolved).length;

  async function handleReply(threadId: string) {
    const text = replyText[threadId];
    if (!text?.trim()) return;
    setSubmittingReply(threadId);
    try {
      await discussionsApi.addMsg(threadId, text);
      setSentReplies(prev => new Set(prev).add(threadId));
      setReplyText(prev => ({ ...prev, [threadId]: "" }));
      refreshDiscussions();
    } finally {
      setSubmittingReply(null);
    }
  }

  async function handleNewThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newThread.title) return;
    setNewSubmitting(true);
    try {
      await discussionsApi.create({ title: newThread.title, project_id: newThread.project_id || undefined });
      setNewSubmitted(true);
      refreshDiscussions();
    } finally {
      setNewSubmitting(false);
    }
  }

  async function handleResolve(id: string) {
    await discussionsApi.resolve(id);
    refreshDiscussions();
  }

  function ThreadCard({ thread, index = 0 }: { thread: Discussion; index?: number }) {
    const isExpanded = expandedId === thread.id;
    const project = thread.project_id ? projectList.find(p => p.id === thread.project_id) : null;
    const replySent = sentReplies.has(thread.id);

    return (
      <div
        className={cn(
          "bg-white rounded-2xl border shadow-card overflow-hidden animate-fade-in-up transition-all",
          thread.is_resolved && "opacity-70"
        )}
        style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${index * 50}ms` }}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {thread.is_resolved && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    Resolved
                  </span>
                )}
              </div>

              <button
                onClick={() => setExpandedId(isExpanded ? null : thread.id)}
                className="text-left group"
              >
                <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors leading-snug">
                  {thread.title}
                </h3>
              </button>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {thread.author_name && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-blue-500">
                      {thread.author_name[0]}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{thread.author_name}</span>
                  </div>
                )}
                {project && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                      <FolderKanban className="h-3 w-3" />
                      {project.title}
                    </span>
                  </>
                )}
                <span className="text-slate-200">·</span>
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 text-slate-400">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">{thread.message_count ?? 0}</span>
              </div>
              <button
                onClick={() => setExpandedId(isExpanded ? null : thread.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-gray-100 hover:text-slate-700 transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-4 animate-fade-in-up">
              {/* Messages */}
              {thread.messages && thread.messages.length > 0 && (
                <div className="space-y-3">
                  {thread.messages.map((msg, i) => (
                    <div key={msg.id} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5 bg-blue-500">
                        {(msg.author_name ?? "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-800">{msg.author_name ?? msg.author_id}</span>
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl text-sm text-slate-700 leading-relaxed" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {!thread.is_resolved && (
                replySent ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700">Reply posted!</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-1.5 bg-blue-500">
                      {user?.initials ?? "?"}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={replyText[thread.id] ?? ""}
                        onChange={e => setReplyText(prev => ({ ...prev, [thread.id]: e.target.value }))}
                        placeholder="Write a reply…"
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-colors focus:bg-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReply(thread.id)}
                          disabled={submittingReply === thread.id || !replyText[thread.id]?.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingReply === thread.id ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Reply
                        </button>
                        <button
                          onClick={() => handleResolve(thread.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}
          >
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-display text-slate-900">Discussions</h1>
            <p className="text-sm font-medium text-slate-500">Team conversations, decisions, and ideas</p>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-3 flex-wrap animate-fade-in-up stagger-1">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-700">{openCount} open</span>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient"
        >
          <Plus className="h-4 w-4" />
          New Discussion
        </button>
      </div>

      {/* New Thread Form */}
      {showNewForm && (
        <div
          className="bg-white rounded-2xl border shadow-card p-5 space-y-4 animate-scale-in"
          style={{ borderColor: "rgba(99,102,241,0.2)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">New Discussion</h3>
            <button
              onClick={() => { setShowNewForm(false); setNewSubmitted(false); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {newSubmitted ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-bold text-emerald-800">Discussion started!</p>
              <button
                onClick={() => { setShowNewForm(false); setNewSubmitted(false); setNewThread({ title: "", project_id: "" }); }}
                className="text-sm text-emerald-600 hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleNewThread} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newThread.project_id}
                  onChange={e => setNewThread(f => ({ ...f, project_id: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 outline-none"
                >
                  <option value="">General</option>
                  {projectList.map(p => (
                    <option key={p.id} value={p.id}>{p.title.slice(0, 30)}{p.title.length > 30 ? "…" : ""}</option>
                  ))}
                </select>
              </div>
              <input
                required
                value={newThread.title}
                onChange={e => setNewThread(f => ({ ...f, title: e.target.value }))}
                placeholder="Discussion title…"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white"
              />
              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newSubmitting || !newThread.title}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {newSubmitting ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-in-up stagger-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search discussions…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
        </div>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-slate-700 outline-none"
        >
          <option value="all">All Projects</option>
          <option value="general">General</option>
          {projectList.map(p => (
            <option key={p.id} value={p.id}>{p.title.slice(0, 25)}{p.title.length > 25 ? "…" : ""}</option>
          ))}
        </select>
        <button
          onClick={() => setShowResolved(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
            showResolved ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-slate-500 hover:border-gray-300"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Resolved
        </button>
      </div>

      {/* Thread list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
            <p className="font-semibold text-gray-600">No discussions found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or start a new discussion</p>
          </div>
        ) : (
          filtered.map((thread, i) => <ThreadCard key={thread.id} thread={thread} index={i} />)
        )}
      </div>
    </div>
  );
}
