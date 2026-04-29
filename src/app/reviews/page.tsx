"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Code, FileText, BookOpen, Presentation,
  MessageSquare, Users, Sparkles, Loader2, Send,
  ArrowRight, CheckCircle2, Clock,
} from "lucide-react";
import {
  submissions as submissionsApi, feedback as feedbackApi,
  projects as projectsApi,
} from "@/lib/api-client";
import type { Submission, Project } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, React.ReactNode> = {
  code:          <Code className="h-4 w-4 text-blue-600" />,
  architecture:  <FileText className="h-4 w-4 text-purple-600" />,
  notebook:      <BookOpen className="h-4 w-4 text-amber-600" />,
  document:      <FileText className="h-4 w-4 text-green-600" />,
  demo:          <Presentation className="h-4 w-4 text-pink-600" />,
  status_update: <MessageSquare className="h-4 w-4 text-slate-500" />,
  meeting_notes: <Users className="h-4 w-4 text-cyan-600" />,
};

const typeBadgeColors: Record<string, string> = {
  code:          "text-blue-700 border-blue-200 bg-blue-50",
  architecture:  "text-purple-700 border-purple-200 bg-purple-50",
  notebook:      "text-amber-700 border-amber-200 bg-amber-50",
  document:      "text-green-700 border-green-200 bg-green-50",
  demo:          "text-pink-700 border-pink-200 bg-pink-50",
  status_update: "text-slate-700 border-slate-200 bg-slate-50",
  meeting_notes: "text-cyan-700 border-cyan-200 bg-cyan-50",
};

export default function ReviewsPage() {
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

  useEffect(() => {
    Promise.all([
      submissionsApi.list().then(r => setAllSubmissions(r.submissions)),
      projectsApi.list({ limit: 50 }).then(r => setProjectList(r.projects)),
    ]).finally(() => setLoading(false));
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
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-amber-600" />
          Review Queue
        </h1>
        <p className="text-muted-foreground mt-1">Review team submissions and provide feedback</p>
      </div>

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
          {Object.keys(typeIcons).map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
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
      </Tabs>
    </div>
  );
}
