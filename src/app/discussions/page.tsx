"use client";

import { useState, useEffect, useMemo, useRef, memo } from "react";
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
import { BrandLoader } from "@/components/brand-loader";
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
      id={`discussion-${thread.id}`}
      className={cn(
        "rounded-2xl border overflow-hidden transition-all animate-fade-in-up",
        thread.is_resolved
          ? "bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-800 shadow-sm"
          : "bg-white dark:bg-slate-800 shadow-card"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Top stripe — purple for open, green for resolved */}
      <div
        className="h-1 w-full"
        style={{
          background: thread.is_resolved
            ? "linear-gradient(90deg, #10b981, #059669)"
            : "linear-gradient(90deg, #6366f1, #8b5cf6)"
        }}
      />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {thread.is_resolved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Resolved
                </span>
              )}
            </div>

            <button
              onClick={() => setExpandedId(isExpanded ? null : thread.id)}
              className="text-left group"
            >
              <h3 className={cn(
                "font-bold text-sm sm:text-base leading-snug transition-colors",
                thread.is_resolved
                  ? "text-slate-600 dark:text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400"
                  : "text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
              )}>
                {thread.title}
              </h3>
            </button>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {thread.author_name && (
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-blue-500">
                    {thread.author_name[0]}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{thread.author_name}</span>
                </div>
              )}
              {project && (
                <>
                  <span className="text-slate-200 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 font-medium">
                    <FolderKanban className="h-3 w-3" />
                    {project.title}
                  </span>
                </>
              )}
              <span className="text-slate-200 dark:text-slate-700">·</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{messages.length > 0 ? messages.length : (thread.message_count ?? 0)}</span>
            </div>
            {canEdit && (
              <button
                onClick={onEdit}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Edit discussion"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(thread.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete discussion"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : thread.id)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4 animate-fade-in-up">
            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-slate-700" />

            {/* Messages */}
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-3">No replies yet. Be the first to reply.</p>
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
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{msg.author_name ?? msg.author_id}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20">
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
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none transition-colors focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-300 dark:focus:border-indigo-500/50"
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
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
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
  const [statusTab, setStatusTab] = useState<"open" | "resolved">("open");
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

  // Deep-link support: /discussions?thread=<id> (linked from the dashboard's
  // "Active Discussions" list) opens the right tab and expands/scrolls to
  // that specific thread instead of always landing on the generic list.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (loading || deepLinkedRef.current || typeof window === "undefined") return;
    const threadId = new URLSearchParams(window.location.search).get("thread");
    if (!threadId) return;
    const target = threadList.find(t => t.id === threadId);
    if (!target) return;
    deepLinkedRef.current = true;
    setStatusTab(target.is_resolved ? "resolved" : "open");
    setFilterProject("all");
    setExpandedId(threadId);
    setTimeout(() => {
      document.getElementById(`discussion-${threadId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [loading, threadList]);

  // Re-fetch whenever status tab or project filter changes
  useEffect(() => {
    if (loading) return;
    discussionsApi.list()
      .then(r => setThreadList(r.discussions))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab, filterProject]);

  async function refreshDiscussions() {
    try {
      // Always fetch all — client-side useMemo handles resolved/project filtering
      const r = await discussionsApi.list();
      setThreadList(r.discussions);
    } catch (err) { }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return threadList.filter(d => {
      // Status tab filter
      if (statusTab === "open" && d.is_resolved) return false;
      if (statusTab === "resolved" && !d.is_resolved) return false;
      // Project filter
      if (filterProject === "general" && d.project_id != null) return false;
      if (filterProject !== "all" && filterProject !== "general" && d.project_id !== filterProject) return false;
      // Search filter
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [threadList, statusTab, filterProject, searchQuery]);

  const openCount = useMemo(() => threadList.filter(d => !d.is_resolved).length, [threadList]);
  const resolvedCount = useMemo(() => threadList.filter(d => d.is_resolved).length, [threadList]);

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
    return <BrandLoader label="Loading discussions…" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1600px]">
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
            <h1 className="text-display text-slate-900 dark:text-slate-100">Discussions</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Team conversations, decisions, and ideas</p>
          </div>
        </div>
      </div>

      {/* Top bar: status tabs + new button */}
      <div className="flex items-center justify-between gap-3 flex-wrap animate-fade-in-up stagger-1">
        {/* Open / Resolved tab switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 rounded-xl p-1 gap-1">
          <button
            onClick={() => setStatusTab("open")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all",
              statusTab === "open"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open
            <span className={cn(
              "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              statusTab === "open" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-gray-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            )}>
              {openCount}
            </span>
          </button>
          <button
            onClick={() => setStatusTab("resolved")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all",
              statusTab === "resolved"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolved
            <span className={cn(
              "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              statusTab === "resolved" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-gray-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            )}>
              {resolvedCount}
            </span>
          </button>
        </div>

        <button
          onClick={() => setScheduleOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-gradient"
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

      {/* Search + project filter */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-in-up stagger-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search discussions…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
        </div>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="all">All Projects</option>
          <option value="general">General</option>
          {projectList.map(p => (
            <option key={p.id} value={p.id}>{p.title.slice(0, 25)}{p.title.length > 25 ? "…" : ""}</option>
          ))}
        </select>
      </div>

      {/* Thread list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
            <MessageSquare className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-gray-600 dark:text-slate-400">No discussions found</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Try adjusting your filters or start a new discussion</p>
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
