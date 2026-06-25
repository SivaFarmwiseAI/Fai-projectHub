"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Send, Plus,
  Search, FolderKanban, Loader2, Trash2, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { discussions as discussionsApi, projects as projectsApi } from "@/lib/api-client";
import type { Discussion, DiscussionMessage, Project } from "@/lib/api-client";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { EditDiscussionDialog } from "@/components/edit-discussion-dialog";
import { showToast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-provider";

/* ─── Thread Card Component ─────────────────────────────────── */
const ThreadCard = memo(function ThreadCard({
  thread,
  index = 0,
  projectList,
  expandedId,
  setExpandedId,
  userInitials,
  onAfterReply,
  onResolve,
  onDelete,
  onEdit,
  canEdit,
  canDelete,
}: {
  thread: Discussion;
  index?: number;
  projectList: Project[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  userInitials: string;
  onAfterReply: (id: string) => void;
  onResolve: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const isExpanded = expandedId === thread.id;
  const project = thread.project_id ? projectList.find(p => p.id === thread.project_id) : null;
  const [replyText, setReplyText] = useState("");
  const [messages, setMessages] = useState<DiscussionMessage[]>(thread.messages ?? []);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const fetchMessages = async () => {
    setLoadingMsgs(true);
    try {
      const { discussion } = await discussionsApi.get(thread.id);
      setMessages(discussion.messages ?? []);
    } catch {}
    finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (isExpanded) fetchMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, thread.id]);

  const handleReplySubmit = async () => {
    if (!replyText.trim() || sendingReply) return;
    const text = replyText;
    setReplyText("");
    setSendingReply(true);
    try {
      await discussionsApi.addMsg(thread.id, text);
      await fetchMessages();
      onAfterReply(thread.id);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border shadow-card overflow-hidden transition-all",
        thread.is_resolved && "opacity-70",
        "animate-fade-in-up"
      )}
      style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${index * 40}ms` }}
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
              <span className="text-xs font-semibold">{messages.length > 0 ? messages.length : (thread.message_count ?? 0)}</span>
            </div>
            {canEdit && (
              <button
                onClick={onEdit}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                title="Edit discussion"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(thread.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Delete discussion"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
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
            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Messages */}
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-center text-slate-400 py-3">No replies yet. Be the first to reply.</p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={msg.id} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                    >
                      {(msg.author_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-800">{msg.author_name ?? msg.author_id}</span>
                        <span className="text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div
                        className="px-3.5 py-2.5 rounded-xl text-sm text-slate-700 leading-relaxed"
                        style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {!thread.is_resolved && (
              <div className="flex gap-3 pt-1">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-1"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  {userInitials}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReplySubmit(); }}
                    placeholder="Write a reply… (Ctrl+Enter to send)"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-colors focus:bg-white focus:border-indigo-300"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReplySubmit}
                      disabled={sendingReply || !replyText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingReply ? (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Reply
                    </button>
                    <button
                      onClick={() => onResolve(thread.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* ─── Main Page Component ───────────────────────────────────── */
export default function DiscussionsPage() {
  const { user, isCEO, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [threadList, setThreadList] = useState<Discussion[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Discussion | null>(null);

  function handleDiscussionSaved(updated: Discussion) {
    setThreadList(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)));
  }

  useEffect(() => {
    Promise.all([
      discussionsApi.list().then(r => setThreadList(r.discussions)),
      projectsApi.list({ limit: 20 }).then(r => setProjectList(r.projects)),
    ]).finally(() => setLoading(false));
  }, []);

  async function refreshDiscussions() {
    try {
      const r = await discussionsApi.list({ is_resolved: showResolved ? undefined : false });
      setThreadList(r.discussions);
    } catch (err) { }
  }

  const filtered = useMemo(() => {
    return threadList.filter(d => {
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
  }, [threadList, showResolved, filterProject, searchQuery]);

  const openCount = useMemo(() => {
    return threadList.filter(d => !d.is_resolved).length;
  }, [threadList]);

  function handleAfterReply(_id: string) {
    refreshDiscussions();
  }

  async function handleResolve(id: string) {
    await discussionsApi.resolve(id);
    refreshDiscussions();
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this discussion?",
      description: "The discussion and all of its replies will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await discussionsApi.delete(id);
      setThreadList(prev => prev.filter(t => t.id !== id));
      if (expandedId === id) setExpandedId(null);
      showToast.success("Discussion deleted");
    } catch (e) {
      showToast.error("Failed to delete discussion", e instanceof Error ? e.message : undefined);
    }
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
          onClick={() => setScheduleOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient"
        >
          <Plus className="h-4 w-4" />
          Schedule Discussion
        </button>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultTab="discussion"
        onCreated={refreshDiscussions}
      />

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
          filtered.map((thread, i) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              index={i}
              projectList={projectList}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              userInitials={user?.initials ?? "?"}
              onAfterReply={handleAfterReply}
              onResolve={handleResolve}
              onDelete={handleDelete}
              onEdit={() => setEditTarget(thread)}
              canEdit={thread.author_id === user?.id || isCEO || isAdmin}
              canDelete={thread.author_id === user?.id || isCEO || isAdmin}
            />
          ))
        )}
      </div>

      <EditDiscussionDialog
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        discussion={editTarget}
        onSaved={handleDiscussionSaved}
      />
    </div>
  );
}
