"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BrandLoader } from "@/components/brand-loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardCheck, Code, FileText, BookOpen, Presentation,
  MessageSquare, Users, Sparkles, Loader2, Send,
  ArrowRight, CheckCircle2, Clock, Pencil, Trash2, Eye,
} from "lucide-react";
import {
  submissions as submissionsApi, feedback as feedbackApi,
  projects as projectsApi, reviews as reviewsApi,
} from "@/lib/api-client";
import type { Submission, Project, ReviewTask } from "@/lib/api-client";
import { format, formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { EditReviewDialog } from "@/components/edit-review-dialog";
import { showToast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-provider";
import { REVIEW_STATUS_LABELS, REVIEW_PRIORITY_LABELS, REVIEW_TYPE_LABELS } from "@/lib/labels";

const typeIcons: Record<string, React.ReactNode> = {
  document:     <FileText className="h-4 w-4 text-green-600" />,
  code:         <Code className="h-4 w-4 text-blue-600" />,
  architecture: <FileText className="h-4 w-4 text-purple-600" />,
  design:       <Sparkles className="h-4 w-4 text-rose-500" />,
  notebook:     <BookOpen className="h-4 w-4 text-amber-600" />,
  demo:         <Presentation className="h-4 w-4 text-pink-600" />,
};

const typeBadgeColors: Record<string, string> = {
  document:     "text-green-700 border-green-200 bg-green-50",
  code:         "text-blue-700 border-blue-200 bg-blue-50",
  architecture: "text-purple-700 border-purple-200 bg-purple-50",
  design:       "text-rose-700 border-rose-200 bg-rose-50",
  notebook:     "text-amber-700 border-amber-200 bg-amber-50",
  demo:         "text-pink-700 border-pink-200 bg-pink-50",
};

export default function ReviewsPage() {
  const confirm = useConfirm();
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [sentFeedback, setSentFeedback] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [editTarget, setEditTarget] = useState<ReviewTask | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [viewingReview, setViewingReview] = useState<ReviewTask | null>(null);

  async function loadReviewData() {
    await Promise.all([
      submissionsApi.list().then(r => setAllSubmissions(r.submissions)),
      projectsApi.list({ limit: 50 }).then(r => setProjectList(r.projects)),
      reviewsApi.list().then(r => setReviewTasks(r.reviews)).catch(() => setReviewTasks([])),
    ]);
  }

  async function handleDeleteReview(rev: ReviewTask) {
    const ok = await confirm({
      title: "Delete review task?",
      description: <><span className="font-medium">{rev.title}</span> will be permanently removed.</>,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await reviewsApi.delete(rev.id);
      setReviewTasks(prev => prev.filter(r => r.id !== rev.id));
      showToast.success("Review deleted");
    } catch (e) {
      showToast.error("Failed to delete review", e instanceof Error ? e.message : undefined);
    }
  }

  async function handleViewReview(rev: ReviewTask) {
    setViewingReview(rev);
    try {
      const { review } = await reviewsApi.get(rev.id);
      setViewingReview(review);
      setReviewTasks(prev => prev.map(r => (r.id === rev.id ? review : r)));
    } catch {
      // best-effort
    }
  }

  function handleReviewSaved(updated: ReviewTask) {
    setReviewTasks(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  }

  useEffect(() => {
    loadReviewData().finally(() => setLoading(false));
  }, []);

  const applyFiltersAndSort = (items: Submission[]) => {
    let result = items;
    if (filterProject !== "all") result = result.filter(s => s.project_id === filterProject);
    if (filterType !== "all") result = result.filter(s => s.type === filterType);
    return [...result].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortDirection === "newest" ? diff : -diff;
    });
  };

  const pendingSubmissions = useMemo(
    () => applyFiltersAndSort(allSubmissions.filter(s => s.status === "pending")),
    [allSubmissions, filterProject, filterType, sortDirection]
  );
  const allFiltered = useMemo(
    () => applyFiltersAndSort(allSubmissions),
    [allSubmissions, filterProject, filterType, sortDirection]
  );
  const filteredReviewTasks = useMemo(() => {
    let result = reviewTasks;
    if (filterProject !== "all") result = result.filter(r => r.project_id === filterProject);
    if (filterType !== "all") result = result.filter(r => r.type === filterType);
    return [...result].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortDirection === "newest" ? diff : -diff;
    });
  }, [reviewTasks, filterProject, filterType, sortDirection]);

  async function handleAiReview(subId: string, type: string) {
    setAiLoading(prev => ({ ...prev, [subId]: true }));
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `Submission type: ${type}`, content_type: type }),
        credentials: "include",
      });
      if (res.ok) {
        const { review } = await res.json();
        setFeedbackTexts(prev => ({ ...prev, [subId]: review.summary }));
      }
    } finally {
      setAiLoading(prev => ({ ...prev, [subId]: false }));
    }
  }

  async function handleSendFeedback(subId: string) {
    const text = feedbackTexts[subId]?.trim();
    if (!text) return;
    await feedbackApi.create({ submission_id: subId, text });
    setSentFeedback(prev => new Set(prev).add(subId));
    // Refresh pending count
    submissionsApi.list().then(r => setAllSubmissions(r.submissions)).catch(() => {});
  }

  const renderCard = (sub: Submission, isPending: boolean) => {
    const isSent = sentFeedback.has(sub.id);
    const project = projectList.find(p => p.id === sub.project_id);

    return (
      <Card key={sub.id} className={`transition-colors ${isSent ? "border-green-200 bg-green-50" : ""}`}>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{typeIcons[sub.type] ?? typeIcons.document}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm">{sub.title}</h3>
                <Badge variant="outline" className={typeBadgeColors[sub.type] ?? ""}>
                  {sub.type.replace(/_/g, " ")}
                </Badge>
                {sub.status === "reviewed" || isSent ? (
                  <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Reviewed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                    <Clock className="h-3 w-3 mr-1" />Pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {sub.submitted_by_name && <span>{sub.submitted_by_name}</span>}
                <span>{formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}</span>
                {project && (
                  <Link href={`/projects/${project.id}`} className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                    {project.title}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {sub.description && (
            <p className="text-sm text-muted-foreground pl-7 whitespace-pre-line line-clamp-3">{sub.description}</p>
          )}

          {sub.feedback && sub.feedback.length > 0 && (
            <div className="pl-7 space-y-2">
              {sub.feedback.map(fb => (
                <div key={fb.id} className="p-3 rounded-lg bg-gray-100 border border-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    {fb.from_user_name && <span className="text-xs font-medium">{fb.from_user_name}</span>}
                    {fb.is_ai && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-line">{fb.text}</p>
                  {fb.action_items?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {fb.action_items.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isPending && !isSent && (
            <div className="pl-7 space-y-3">
              <Separator />
              <Textarea
                placeholder="Write your feedback..."
                value={feedbackTexts[sub.id] || ""}
                onChange={e => setFeedbackTexts(prev => ({ ...prev, [sub.id]: e.target.value }))}
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={aiLoading[sub.id]}
                  onClick={() => handleAiReview(sub.id, sub.type)}
                >
                  {aiLoading[sub.id] ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reviewing...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" />AI Review</>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!feedbackTexts[sub.id]?.trim()}
                  onClick={() => handleSendFeedback(sub.id)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Feedback
                </Button>
              </div>
            </div>
          )}

          {isSent && (
            <div className="pl-7 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Feedback sent successfully
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <BrandLoader label="Loading reviews…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-amber-600" />
            Review Queue
          </h1>
          <p className="text-muted-foreground mt-1">Review team submissions and provide feedback</p>
        </div>
        <Button className="gap-1.5 self-start" onClick={() => setScheduleOpen(true)}>
          <Plus className="h-4 w-4" /> Schedule Review
        </Button>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultTab="review"
        onCreated={loadReviewData}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All Projects</option>
          {projectList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All Types</option>
          {Object.keys(typeIcons).map(t => <option key={t} value={t}>{REVIEW_TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select
          value={sortDirection}
          onChange={e => setSortDirection(e.target.value as "newest" | "oldest")}
          className="text-xs border rounded px-2 py-1.5 bg-white ml-auto"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      <Tabs value={activeTab} onValueChange={v => v && setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingSubmissions.length > 0 && (
              <span className="ml-1.5 flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500 text-[10px] font-bold text-white px-1.5">
                {pendingSubmissions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Submissions</TabsTrigger>
          <TabsTrigger value="tasks">
            Review Tasks
            {filteredReviewTasks.length > 0 && (
              <span className="ml-1.5 flex items-center justify-center h-5 min-w-[20px] rounded-full bg-blue-500 text-[10px] font-bold text-white px-1.5">
                {filteredReviewTasks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingSubmissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p>All caught up! No pending reviews.</p>
            </div>
          ) : (
            pendingSubmissions.map(s => renderCard(s, true))
          )}
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-4">
          {allFiltered.map(s => renderCard(s, false))}
        </TabsContent>
        <TabsContent value="tasks" className="mt-4 space-y-3">
          {filteredReviewTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-8 w-8 mx-auto mb-2 text-blue-400" />
              <p className="text-sm">{reviewTasks.length === 0 ? "No review tasks yet." : "No review tasks match the current filters."}</p>
              {reviewTasks.length === 0 && <p className="text-xs mt-1">Click <span className="font-semibold">Schedule Review</span> above to add one.</p>}
            </div>
          ) : (
            filteredReviewTasks.map(rt => (
              <ReviewTaskCard
                key={rt.id}
                review={rt}
                expanded={expandedReviewId === rt.id}
                onView={() => handleViewReview(rt)}
                onEdit={() => setEditTarget(rt)}
                onDelete={() => handleDeleteReview(rt)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <EditReviewDialog
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        review={editTarget}
        onSaved={handleReviewSaved}
      />

      <ViewReviewDialog
        review={viewingReview}
        onOpenChange={(o) => { if (!o) setViewingReview(null); }}
      />
    </div>
  );
}

/* ───────── Review Task Card ───────── */
function ReviewTaskCard({
  review, expanded, onView, onEdit, onDelete,
}: {
  review: ReviewTask;
  expanded: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending:     "text-amber-700 border-amber-200 bg-amber-50",
    in_progress: "text-blue-700 border-blue-200 bg-blue-50",
    completed:   "text-emerald-700 border-emerald-200 bg-emerald-50",
    rejected:    "text-red-700 border-red-200 bg-red-50",
  };
  const priorityColors: Record<string, string> = {
    high:   "text-red-700 border-red-200 bg-red-50",
    medium: "text-amber-700 border-amber-200 bg-amber-50",
    low:    "text-slate-700 border-slate-200 bg-slate-50",
  };
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="h-4 w-4 text-blue-500 mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm">{review.title}</h3>
              <Badge variant="outline" className={statusColors[review.status] ?? ""}>
                {REVIEW_STATUS_LABELS[review.status] ?? review.status}
              </Badge>
              <Badge variant="outline" className={priorityColors[review.priority] ?? ""}>
                {REVIEW_PRIORITY_LABELS[review.priority] ?? review.priority}
              </Badge>
              <Badge variant="outline">{REVIEW_TYPE_LABELS[review.type] ?? review.type}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {review.assignee_name && <span>Assigned: {review.assignee_name}</span>}
              {review.requester_name && <span>By: {review.requester_name}</span>}
              {review.project_title && <span>Project: {review.project_title}</span>}
              {review.due_date && (
                <span className="text-amber-700 font-medium">
                  Due {format(new Date(review.due_date), "MMM d, yyyy")}
                </span>
              )}
              <span>Created {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onView} title="View">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

/* ───────── View Review Dialog ───────── */
function ViewReviewDialog({
  review,
  onOpenChange,
}: {
  review: ReviewTask | null;
  onOpenChange: (o: boolean) => void;
}) {
  const statusColors: Record<string, string> = {
    pending:     "text-amber-700 border-amber-200 bg-amber-50",
    in_progress: "text-blue-700 border-blue-200 bg-blue-50",
    completed:   "text-emerald-700 border-emerald-200 bg-emerald-50",
    rejected:    "text-red-700 border-red-200 bg-red-50",
  };
  const priorityColors: Record<string, string> = {
    high:   "text-red-700 border-red-200 bg-red-50",
    medium: "text-amber-700 border-amber-200 bg-amber-50",
    low:    "text-slate-700 border-slate-200 bg-slate-50",
  };

  return (
    <Dialog open={!!review} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Review Details
          </DialogTitle>
        </DialogHeader>

        {review && (() => {
          const statusLabels: Record<string, string> = {
            pending: "Pending", in_progress: "In Progress",
            completed: "Completed", rejected: "Rejected",
          };
          const priorityLabels: Record<string, string> = {
            high: "High", medium: "Medium", low: "Low",
          };
          const typeLabels: Record<string, string> = {
            code: "Code", architecture: "Architecture", notebook: "Notebook",
            document: "Document", demo: "Demo", design: "Design",
          };
          return (
          <div className="space-y-4 text-sm">
            {/* Title */}
            <p className="font-semibold text-base text-slate-900">{review.title}</p>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColors[review.status] ?? ""}>
                {statusLabels[review.status] ?? review.status}
              </Badge>
              <Badge variant="outline" className={priorityColors[review.priority] ?? ""}>
                {priorityLabels[review.priority] ?? review.priority}
              </Badge>
              <Badge variant="outline">
                {typeLabels[review.type] ?? review.type}
              </Badge>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs border rounded-lg p-3 bg-gray-50">
              {review.assignee_name && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Assigned To</p>
                  <p className="font-medium text-slate-800">{review.assignee_name}</p>
                </div>
              )}
              {review.requester_name && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Requested By</p>
                  <p className="font-medium text-slate-800">{review.requester_name}</p>
                </div>
              )}
              {review.project_title && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-0.5">Project</p>
                  <p className="font-medium text-slate-800">{review.project_title}</p>
                </div>
              )}
              {review.due_date && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Due Date</p>
                  <p className="font-medium text-amber-700">{format(new Date(review.due_date), "MMM d, yyyy")}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-0.5">Created</p>
                <p className="font-medium text-slate-800">{format(new Date(review.created_at), "MMM d, yyyy")}</p>
              </div>
            </div>

            {/* Description */}
            {review.description ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</p>
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{review.description}</p>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">No description provided.</p>
            )}

            {/* Feedback */}
            {review.feedback_text && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Feedback</p>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{review.feedback_text}</p>
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
