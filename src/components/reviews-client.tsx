"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Loader2,
  MessageSquare,
  Clock,
  FileText,
  Code,
  Layout,
  BookOpen,
  Monitor,
  CheckCircle2,
  ArrowRight,
  Send,
  Inbox,
} from "lucide-react";
import { format } from "date-fns";
import { showToast } from "@/lib/toast";

const submissionTypeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  document:     { icon: <FileText className="h-4 w-4" />,  color: "#3b82f6", bg: "#eff6ff" },
  code:         { icon: <Code className="h-4 w-4" />,      color: "#8b5cf6", bg: "#f5f3ff" },
  architecture: { icon: <Layout className="h-4 w-4" />,    color: "#06b6d4", bg: "#ecfeff" },
  notebook:     { icon: <BookOpen className="h-4 w-4" />,  color: "#f59e0b", bg: "#fffbeb" },
  demo:         { icon: <Monitor className="h-4 w-4" />,   color: "#22c55e", bg: "#f0fdf4" },
};

export function ReviewsClient({
  pendingSubmissions,
  allSubmissions,
  users,
}: {
  pendingSubmissions: any[];
  allSubmissions: any[];
  users: any[];
}) {
  const router = useRouter();
  const [feedbackText, setFeedbackText]   = useState<Record<string, string>>({});
  const [aiReviewing, setAiReviewing]     = useState<string | null>(null);
  const [sentFeedback, setSentFeedback]   = useState<Set<string>>(new Set());

  async function aiReview(submission: any) {
    setAiReviewing(submission.id);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: submission.title,
          type: submission.type,
          description: submission.description,
          projectContext: submission.project?.requirement,
        }),
      });
      const data = await res.json();
      setFeedbackText((prev) => ({ ...prev, [submission.id]: data.feedback }));
      showToast.success("AI review ready", "Claude has drafted feedback for this submission.");
    } catch {
      showToast.error("AI review failed", "Could not reach the AI service. Try again.");
    } finally {
      setAiReviewing(null);
    }
  }

  async function sendFeedback(submissionId: string) {
    const text = feedbackText[submissionId];
    if (!text) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        fromUserId: users[0]?.id,
        text,
        isAi: false,
      }),
    });
    setSentFeedback((prev) => new Set(prev).add(submissionId));
    setFeedbackText((prev) => ({ ...prev, [submissionId]: "" }));
    showToast.success("Feedback submitted", "Your review has been saved successfully.");
    setTimeout(() => {
      router.refresh();
    }, 1200);
  }

  function SubmissionCard({
    submission,
    showFeedback = false,
    index = 0,
  }: {
    submission: any;
    showFeedback?: boolean;
    index?: number;
  }) {
    const typeConf = submissionTypeConfig[submission.type] ?? submissionTypeConfig.document;
    const hasFeedback = submission.feedback?.length > 0;
    const wasSent = sentFeedback.has(submission.id);

    return (
      <div
        className="bg-white rounded-2xl border overflow-hidden shadow-card card-interactive animate-fade-in-up"
        style={{
          borderColor: "rgba(0,0,0,0.06)",
          animationDelay: `${index * 60}ms`,
        }}
      >
        {/* Card top accent line */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${typeConf.color}, ${typeConf.color}88)` }} />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
              >
                {typeConf.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 truncate">{submission.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0"
                    style={{ color: typeConf.color, borderColor: `${typeConf.color}40`, backgroundColor: typeConf.bg }}
                  >
                    {submission.type}
                  </Badge>
                  {hasFeedback && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      Reviewed
                    </span>
                  )}
                  {!hasFeedback && !showFeedback && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full animate-pulse">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Submitter + time */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-gray-700">{submission.user.name}</p>
                <p className="text-[10px] text-gray-400 flex items-center justify-end gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(submission.createdAt), "MMM d, HH:mm")}
                </p>
              </div>
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white shadow-sm"
                style={{ backgroundColor: submission.user.avatarColor }}
              >
                {submission.user.name[0]}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed">{submission.description}</p>

          {/* Project breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              href={`/projects/${submission.project.id}`}
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              {submission.project.title}
              <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-gray-400">{submission.phase.phaseName}</span>
          </div>

          {/* Existing feedback (all-submissions view) */}
          {showFeedback && hasFeedback && (
            <div className="space-y-2 pt-1">
              {submission.feedback.map((fb: any) => (
                <div
                  key={fb.id}
                  className="flex gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: fb.fromUser.avatarColor ?? "#3b82f6" }}
                  >
                    {fb.fromUser.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{fb.fromUser.name}</span>
                      {fb.isAi && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{fb.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Review actions for pending */}
          {!showFeedback && (
            <div className="space-y-3 pt-1">
              {wasSent ? (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 animate-scale-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-sm font-medium text-emerald-700">Feedback sent successfully</p>
                </div>
              ) : (
                <>
                  <Textarea
                    value={feedbackText[submission.id] || ""}
                    onChange={(e) =>
                      setFeedbackText((prev) => ({ ...prev, [submission.id]: e.target.value }))
                    }
                    placeholder="Write your feedback here…"
                    className="min-h-[80px] text-sm rounded-xl border-gray-200 bg-gray-50 resize-none focus:bg-white transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-xl border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-300"
                      onClick={() => aiReview(submission)}
                      disabled={aiReviewing === submission.id}
                    >
                      {aiReviewing === submission.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {aiReviewing === submission.id ? "Reviewing…" : "AI Review"}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl btn-gradient text-white border-0 shadow-glow-blue disabled:opacity-50 disabled:shadow-none disabled:transform-none"
                      onClick={() => sendFeedback(submission.id)}
                      disabled={!feedbackText[submission.id]}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Feedback
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <h1 className="text-display text-slate-900">Review Queue</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Review team submissions and provide feedback
        </p>
      </div>

      {/* ── Summary strip ──────────────────────────────────── */}
      <div className="flex items-center gap-4 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-semibold text-amber-700">
            {pendingSubmissions.length} pending
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <span className="text-sm text-gray-500">
            {allSubmissions.length} total submissions
          </span>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="pending" className="animate-fade-in-up stagger-2">
        <TabsList className="bg-gray-100/80 rounded-xl p-1">
          <TabsTrigger value="pending" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Pending
            {pendingSubmissions.length > 0 && (
              <span className="flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500 text-[10px] font-bold text-white px-1.5">
                {pendingSubmissions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            All Submissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-5">
          {pendingSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="font-semibold text-gray-700">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No submissions awaiting review</p>
            </div>
          ) : (
            pendingSubmissions.map((sub, i) => (
              <SubmissionCard key={sub.id} submission={sub} index={i} />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-5">
          {allSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <Inbox className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No submissions yet</p>
            </div>
          ) : (
            allSubmissions.map((sub, i) => (
              <SubmissionCard key={sub.id} submission={sub} showFeedback index={i} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
